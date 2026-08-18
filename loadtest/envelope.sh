#!/usr/bin/env bash
# Build (and tear down) a resource envelope around the Living API so it can be
# stress-tested on a shared host without starving the neighbours.
#
# The idea: cap Living itself. Then the load test finds LIVING's ceiling, and
# the shared CPU, shared Postgres and shared Redis never get to the point where
# anyone else notices. A test that can't hurt the neighbours doesn't need
# anyone to be careful during it.
#
#   ./envelope.sh up <k6-source-ip>   # apply caps, open the port to that IP
#   ./envelope.sh status              # show what is currently applied
#   ./envelope.sh down                # restore everything
#
# Run as root on the VPS. Safe to re-run.
set -euo pipefail

CG=/sys/fs/cgroup/livingtest
STATE=/root/.living-envelope
PM2_APP=${PM2_APP:-platform-api}
API_PORT=${API_PORT:-8104}

# Caps. 4-core box: give Living 2 cores and 2 GB and no more.
CPU_CORES=${CPU_CORES:-2}
MEM_HIGH=${MEM_HIGH:-1500M}   # throttle+reclaim here (soft, no kill)
MEM_MAX=${MEM_MAX:-2G}        # hard backstop
PG_CONN_LIMIT=${PG_CONN_LIMIT:-25}

die() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "run as root"

# ── discover how Living is actually wired ────────────────────────────────────
discover() {
  APP_DIR=$(pm2 describe "$PM2_APP" 2>/dev/null | awk '/exec cwd/{print $4}')
  [[ -n "${APP_DIR:-}" ]] || die "pm2 app '$PM2_APP' not found (set PM2_APP=)"
  [[ -f "$APP_DIR/.env" ]] || die "no .env at $APP_DIR"

  DB_URL=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'')
  [[ -n "${DB_URL:-}" ]] || die "DATABASE_URL not found in $APP_DIR/.env"
  # postgresql://USER:PASS@HOST:PORT/DBNAME?params
  PG_USER=$(sed -E 's#^[^:]+://([^:]+):.*#\1#' <<<"$DB_URL")
  PG_DB=$(sed -E 's#.*/([^/?]+)(\?.*)?$#\1#' <<<"$DB_URL")
  API_PID=$(pm2 pid "$PM2_APP" 2>/dev/null | tr -d '[:space:]')
}

# ── cgroup v2: cap CPU and memory for the API process ────────────────────────
cgroup_up() {
  [[ -f /sys/fs/cgroup/cgroup.controllers ]] || die "cgroup v2 not mounted"
  grep -q cpu /sys/fs/cgroup/cgroup.subtree_control 2>/dev/null \
    || echo "+cpu +memory" > /sys/fs/cgroup/cgroup.subtree_control 2>/dev/null || true

  mkdir -p "$CG"
  echo "$((CPU_CORES * 100000)) 100000" > "$CG/cpu.max"
  echo "$MEM_HIGH" > "$CG/memory.high"
  echo "$MEM_MAX"  > "$CG/memory.max"
  attach
  echo "  cgroup: ${CPU_CORES} cores, high=${MEM_HIGH} max=${MEM_MAX}"
}

# PM2 restarts spawn a new PID outside the cgroup. The watchdog calls this on a
# loop; platform-api has a restart history, so this is not hypothetical.
attach() {
  local pid; pid=$(pm2 pid "$PM2_APP" 2>/dev/null | tr -d '[:space:]')
  [[ -n "$pid" && "$pid" != "0" ]] || return 0
  grep -qx "$pid" "$CG/cgroup.procs" 2>/dev/null && return 0
  echo "$pid" > "$CG/cgroup.procs" 2>/dev/null || true
}

cgroup_down() {
  [[ -d "$CG" ]] || return 0
  # Processes must leave before the group can be removed.
  while read -r pid; do echo "$pid" > /sys/fs/cgroup/cgroup.procs 2>/dev/null || true
  done < <(cat "$CG/cgroup.procs" 2>/dev/null || true)
  rmdir "$CG" 2>/dev/null || true
  echo "  cgroup: removed"
}

# ── Postgres: Living can never exhaust the shared connection pool ────────────
pg_up() {
  local prev
  prev=$(sudo -u postgres psql -Atc \
    "SELECT COALESCE(rolconnlimit,-1) FROM pg_roles WHERE rolname='$PG_USER';")
  [[ -n "$prev" ]] || die "postgres role '$PG_USER' not found"
  echo "PG_USER=$PG_USER"       >> "$STATE"
  echo "PG_PREV_LIMIT=$prev"    >> "$STATE"
  sudo -u postgres psql -qc "ALTER ROLE \"$PG_USER\" CONNECTION LIMIT $PG_CONN_LIMIT;"

  local maxc; maxc=$(sudo -u postgres psql -Atc "SHOW max_connections;")
  echo "  postgres: role '$PG_USER' limited to $PG_CONN_LIMIT of $maxc (was: $prev)"

  if ! grep -q 'connection_limit=' <<<"$DB_URL"; then
    cat <<WARN

  ⚠  DATABASE_URL has no ?connection_limit= parameter, so Prisma self-sizes its
     pool. The role limit above is a hard backstop, but Prisma will bounce off
     it with connection errors instead of queueing politely. For a cleaner test
     add to $APP_DIR/.env and restart pm2:

       DATABASE_URL="...?connection_limit=$((PG_CONN_LIMIT - 5))&pool_timeout=10"

WARN
  fi
}

pg_down() {
  [[ -f "$STATE" ]] || return 0
  local u l; u=$(grep '^PG_USER=' "$STATE" | tail -1 | cut -d= -f2)
  l=$(grep '^PG_PREV_LIMIT=' "$STATE" | tail -1 | cut -d= -f2)
  [[ -n "$u" ]] || return 0
  sudo -u postgres psql -qc "ALTER ROLE \"$u\" CONNECTION LIMIT ${l:--1};"
  echo "  postgres: role '$u' restored to ${l:--1}"
}

# ── Redis: refuse to run if a flood could evict a neighbour's keys ───────────
redis_check() {
  local policy mem
  policy=$(redis-cli -p 6379 CONFIG GET maxmemory-policy 2>/dev/null | tail -1)
  mem=$(redis-cli -p 6379 CONFIG GET maxmemory 2>/dev/null | tail -1)
  echo "  redis :6379 → maxmemory=${mem:-?} policy=${policy:-?}"
  if [[ "$policy" != "noeviction" && "${mem:-0}" != "0" ]]; then
    cat <<WARN
  ⚠  Shared Redis has a bounded maxmemory and an EVICTING policy ($policy).
     Living's BullMQ queue lives here. Under load Redis can evict OTHER apps'
     keys to make room — the neighbours lose cache/session data and you will
     not see it in Living's metrics. Either set policy to noeviction, or give
     Living its own instance (you already do this for voice on :6380).
     The watchdog aborts on Redis memory regardless.
WARN
  fi
}

# ── firewall: only the load generator may reach the API port directly ────────
fw_up() {
  local ip=$1
  command -v ufw >/dev/null || { echo "  firewall: ufw absent, skipping"; return 0; }
  ufw allow from "$ip" to any port "$API_PORT" proto tcp comment 'living-loadtest' >/dev/null
  echo "K6_IP=$ip" >> "$STATE"
  echo "  firewall: $ip → :$API_PORT allowed"
}

fw_down() {
  command -v ufw >/dev/null || return 0
  local ip; ip=$(grep '^K6_IP=' "$STATE" 2>/dev/null | tail -1 | cut -d= -f2)
  [[ -n "${ip:-}" ]] || return 0
  ufw delete allow from "$ip" to any port "$API_PORT" proto tcp >/dev/null 2>&1 || true
  echo "  firewall: $ip revoked"
}

case "${1:-}" in
  up)
    [[ -n "${2:-}" ]] || die "usage: $0 up <k6-source-ip>"
    discover; : > "$STATE"
    echo "Living load-test envelope — applying"
    echo "  app: $PM2_APP  pid=$API_PID  dir=$APP_DIR  db=$PG_DB"
    cgroup_up; pg_up; redis_check; fw_up "$2"
    echo
    echo "Baseline restart count (compare after the run):"
    pm2 describe "$PM2_APP" | grep -E "restarts|uptime" || true
    echo
    echo "Next: start watchdog.sh on this box, then run k6 from $2."
    ;;
  down)
    discover 2>/dev/null || true
    echo "Living load-test envelope — removing"
    cgroup_down; pg_down; fw_down; rm -f "$STATE"
    echo "  done. Restart pm2 if you edited .env: pm2 restart $PM2_APP --update-env"
    ;;
  status)
    discover
    echo "cgroup:   $( [[ -d $CG ]] && echo "cpu.max=$(cat $CG/cpu.max) mem.max=$(cat $CG/memory.max) pids=$(wc -l < $CG/cgroup.procs)" || echo 'not applied')"
    sudo -u postgres psql -c "SELECT rolname, rolconnlimit FROM pg_roles WHERE rolname='$PG_USER';"
    sudo -u postgres psql -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname ORDER BY 2 DESC;"
    redis_check
    ;;
  attach) discover; attach ;;   # used by the watchdog
  *) die "usage: $0 {up <ip>|down|status}" ;;
esac
