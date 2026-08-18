#!/usr/bin/env bash
# Runs on the VPS for the duration of a load test. Two jobs:
#
#   1. Record what the box is doing, every 2s, to a CSV — this IS the weakness
#      report's raw data. Load-test output tells you Living got slow; this tells
#      you which resource ran out first.
#   2. Abort the test if a neighbour starts suffering. Actively probes other
#      sites on the box rather than inferring from load average — a canary that
#      measures the thing you actually care about.
#
#   ./watchdog.sh <run-name>          # ctrl-C to stop, or it stops on abort
#
# Abort = touch a flag file the k6 side polls, plus SIGTERM to local k6.
set -uo pipefail

RUN=${1:-run-$(date +%H%M%S)}
OUT=/root/loadtest-$RUN.csv
ABORT=/root/loadtest.abort
PM2_APP=${PM2_APP:-platform-api}
INTERVAL=${INTERVAL:-2}

# Neighbour canaries. If any of these degrades, the test stops. Defaults are the
# busiest third-party sites on this box; override with CANARIES="url1 url2".
CANARIES=${CANARIES:-"https://exam.doode.in https://inplass.com https://tripeze.in"}
CANARY_TIMEOUT=${CANARY_TIMEOUT:-5}
CANARY_SLOW_MS=${CANARY_SLOW_MS:-3000}
CANARY_FAILS_TO_ABORT=${CANARY_FAILS_TO_ABORT:-2}

# Tripwires (4-core / 15 GB box).
MAX_LOAD1=${MAX_LOAD1:-6.0}
MIN_MEM_AVAIL_MB=${MIN_MEM_AVAIL_MB:-1500}
MAX_PG_CONN_PCT=${MAX_PG_CONN_PCT:-70}
MAX_REDIS_PCT=${MAX_REDIS_PCT:-80}

rm -f "$ABORT"
canary_fails=0

abort() {
  echo "!!! ABORT: $*" | tee -a "$OUT.log"
  echo "$*" > "$ABORT"
  pkill -TERM k6 2>/dev/null || true   # only helps if k6 is local; normally it isn't

  # k6 runs off-box, so we stop it by taking its route away: revoke the firewall
  # rule and every request fails instantly. k6's http_req_failed threshold has
  # abortOnFail set, so it exits on its own within ~30s.
  if command -v ufw >/dev/null; then
    ip=$(grep '^K6_IP=' /root/.living-envelope 2>/dev/null | tail -1 | cut -d= -f2)
    [[ -n "${ip:-}" ]] && ufw delete allow from "$ip" to any port "${API_PORT:-8104}" proto tcp >/dev/null 2>&1 \
      && echo "  revoked $ip → :${API_PORT:-8104}; k6 will self-abort" | tee -a "$OUT.log"
  fi
  echo "Test halted. Envelope still applied — run ./envelope.sh down when finished."
  exit 1
}

pg() { sudo -u postgres psql -Atc "$1" 2>/dev/null; }

PG_MAX=$(pg "SHOW max_connections;"); PG_MAX=${PG_MAX:-100}
REDIS_MAXMEM=$(redis-cli -p 6379 CONFIG GET maxmemory 2>/dev/null | tail -1); REDIS_MAXMEM=${REDIS_MAXMEM:-0}

echo "ts,load1,mem_avail_mb,api_cpu_pct,api_rss_mb,api_restarts,pg_conns,pg_living_conns,pg_max,redis_mb,redis_evicted,canary_ms,canary_status" > "$OUT"
echo "watchdog: $RUN → $OUT   (canaries: $CANARIES)"

while true; do
  ts=$(date +%s)
  load1=$(awk '{print $1}' /proc/loadavg)
  mem_avail=$(( $(awk '/MemAvailable/{print $2}' /proc/meminfo) / 1024 ))

  # Keep the API inside its cgroup across PM2 restarts.
  "$(dirname "$0")/envelope.sh" attach >/dev/null 2>&1 || true

  pid=$(pm2 pid "$PM2_APP" 2>/dev/null | tr -d '[:space:]')
  if [[ -n "$pid" && "$pid" != "0" && -d /proc/$pid ]]; then
    api_cpu=$(ps -p "$pid" -o %cpu= 2>/dev/null | tr -d ' ')
    api_rss=$(( $(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ' || echo 0) / 1024 ))
  else
    api_cpu=0; api_rss=0
  fi
  restarts=$(pm2 jlist 2>/dev/null | grep -o "\"name\":\"$PM2_APP\".*" | grep -o '"restart_time":[0-9]*' | head -1 | cut -d: -f2)

  pg_conns=$(pg "SELECT count(*) FROM pg_stat_activity;"); pg_conns=${pg_conns:-0}
  pg_living=$(pg "SELECT count(*) FROM pg_stat_activity WHERE usename NOT IN ('postgres');"); pg_living=${pg_living:-0}

  redis_mb=$(( $(redis-cli -p 6379 INFO memory 2>/dev/null | awk -F: '/used_memory:/{print int($2)}' || echo 0) / 1048576 ))
  redis_evicted=$(redis-cli -p 6379 INFO stats 2>/dev/null | awk -F: '/evicted_keys:/{print int($2)}')

  # Canary: one probe per tick, round-robin, so we add ~0 load ourselves.
  url=$(echo $CANARIES | tr ' ' '\n' | sed -n "$(( (ts % $(echo $CANARIES | wc -w)) + 1 ))p")
  c_ms=$(curl -o /dev/null -s -w '%{time_total}' --max-time "$CANARY_TIMEOUT" "$url" 2>/dev/null)
  c_code=$(curl -o /dev/null -s -w '%{http_code}' --max-time "$CANARY_TIMEOUT" "$url" 2>/dev/null)
  c_ms=$(awk -v t="${c_ms:-99}" 'BEGIN{printf "%d", t*1000}')

  echo "$ts,$load1,$mem_avail,${api_cpu:-0},$api_rss,${restarts:-0},$pg_conns,$pg_living,$PG_MAX,$redis_mb,${redis_evicted:-0},$c_ms,${c_code:-000}" >> "$OUT"

  # ── tripwires ──────────────────────────────────────────────────────────────
  awk -v l="$load1" -v m="$MAX_LOAD1" 'BEGIN{exit !(l>m)}' && abort "load1 $load1 > $MAX_LOAD1"
  (( mem_avail < MIN_MEM_AVAIL_MB )) && abort "MemAvailable ${mem_avail}MB < ${MIN_MEM_AVAIL_MB}MB"
  (( pg_conns * 100 / PG_MAX > MAX_PG_CONN_PCT )) && abort "postgres $pg_conns/$PG_MAX conns > ${MAX_PG_CONN_PCT}%"
  if (( REDIS_MAXMEM > 0 )) && (( redis_mb * 1048576 * 100 / REDIS_MAXMEM > MAX_REDIS_PCT )); then
    abort "redis ${redis_mb}MB > ${MAX_REDIS_PCT}% of maxmemory"
  fi
  (( ${redis_evicted:-0} > 0 )) && abort "redis evicted ${redis_evicted} keys — neighbours are losing data"

  if [[ "${c_code:-000}" != "200" ]] || (( c_ms > CANARY_SLOW_MS )); then
    canary_fails=$(( canary_fails + 1 ))
    echo "  canary warn ($canary_fails/$CANARY_FAILS_TO_ABORT): $url → ${c_code} ${c_ms}ms" | tee -a "$OUT.log"
    (( canary_fails >= CANARY_FAILS_TO_ABORT )) && abort "neighbour $url degraded (${c_code}, ${c_ms}ms)"
  else
    canary_fails=0
  fi

  sleep "$INTERVAL"
done
