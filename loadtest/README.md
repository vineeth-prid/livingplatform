# Load testing Living on the shared VPS

The box hosting Living also hosts ~16 other apps, a university site and two exam
portals, on 4 cores and 15 GB, behind **one** nginx. So this suite is built on a
single principle:

> Cap Living so it hits **its own** ceiling well before any shared resource runs
> out. A test that cannot hurt the neighbours doesn't need anyone to be careful
> while it runs.

Three isolation layers do that:

| Shared resource | How Living is kept off it |
| --- | --- |
| CloudPanel nginx (fronts every site) | **Not used.** k6 hits `:8104` directly — the API already binds `0.0.0.0`. Cloudflare is bypassed too, so you measure Living, not an edge. |
| CPU / RAM (4 cores, shared) | cgroup v2 cap: 2 cores, 1.5 GB soft / 2 GB hard. Living throttles; the box does not. |
| Postgres `max_connections` (shared cluster) | `ALTER ROLE … CONNECTION LIMIT 25`. Living gets connection errors before neighbours get refused. |
| Redis `:6379` (shared) | Not isolated — checked, and the watchdog **aborts on the first evicted key**. See the warning `envelope.sh up` prints. |

On top of that, the watchdog probes three neighbour sites throughout and stops
the test if any of them slows down.

## Before the first run

1. **Realistic data.** This matters more than any tuning. Every slow query in
   this app is slow at 50k rows, not at 20 — a load test against the demo seed
   measures nothing you'll ever hit in production. Ask for the generator if the
   Living DB is still demo-sized.
2. **Test accounts** — one resident, one security guard, one staff/technician,
   one community admin, plus the `communityId` they belong to.
3. **A load generator that is not this VPS.** Running k6 on the box you're
   measuring invalidates the result and doubles the risk. A laptop is fine.
4. **Resolve `platform-api`'s restart count first.** It restarted 14 times in
   two days while everything else on the box sat at 0. Load-testing a process
   that already dies on its own gives you a breaking point you can't attribute.

## Running

On the VPS:

```bash
./envelope.sh up <your-k6-source-ip>      # caps + firewall; prints what it changed
./watchdog.sh run1                        # leave running; writes /root/loadtest-run1.csv
```

From the load generator:

```bash
k6 run -e BASE=http://<vps-ip>:8104/api/v1 \
       -e COMMUNITY_ID=<uuid> \
       -e RESIDENT_USER=... -e RESIDENT_PASS=... \
       -e GUARD_USER=...    -e GUARD_PASS=... \
       -e STAFF_USER=...    -e STAFF_PASS=... \
       -e ADMIN_USER=...    -e ADMIN_PASS=... \
       -e PROFILE=baseline \
       --out csv=k6-baseline.csv living.js
```

Then, on the VPS:

```bash
./envelope.sh down                        # always, even after an abort
```

Run the profiles in order — each one is only interpretable against the previous:

| `PROFILE` | Shape | Answers |
| --- | --- | --- |
| `baseline` | 1 VU, 2 min | What is "fast" here, with no contention? |
| `load` | ramp to 50 VUs, 15 min | Does realistic peak traffic stay acceptable? |
| `stress` | ramp to 400 VUs, 13 min | Where is the knee, and what breaks first? |
| `soak` | 25 VUs, 90 min | Does anything leak — RSS, DB connections, SSE streams? |

## Rate limits will distort this unless you handle them

Three limiters sit in front of the API. Going direct to `:8104` removes two of
them (Cloudflare, nginx `30r/s`). The third is in the app and still applies:

- **Global**: `THROTTLE_LIMIT=120` per 60s **per IP** — i.e. 2 req/s. From one
  k6 machine you will plateau there and measure the rate limiter, not Living.
  Raise it in `.env` for the test window and `pm2 restart platform-api
  --update-env`. **Put it back afterwards.**
- **Login**: `@Throttle(5/min)` on `POST /auth/login`, which the global setting
  does *not* override. `living.js` handles this by logging in once per role in
  `setup()` with 13s spacing and 429 backoff; VUs never log in.

## Reading the output

Two files per run, and you need both:

- `k6-<profile>.csv` — latency and error rate. Tells you Living got slow.
- `/root/loadtest-<run>.csv` — load, MemAvailable, API CPU/RSS, PM2 restart
  count, Postgres connections, Redis memory + evictions, canary latency. Tells
  you **which resource ran out first**, which is the part you can act on.

The `sse_connections_held` counter is worth watching on its own: nothing has
ever measured how many concurrent streams this process will carry, and streams
are held for up to an hour.

## Abort behaviour

The watchdog stops the test when any of these trips:

| Tripwire | Default | Why |
| --- | --- | --- |
| 1-min load average | > 6.0 | 4 cores; beyond this neighbours queue |
| MemAvailable | < 1500 MB | Below this the OOM killer starts picking victims |
| Postgres connections | > 70% of `max_connections` | Before neighbours get refused |
| Redis evicted keys | **> 0** | An evicted key is a neighbour losing data |
| Neighbour canary | 2 consecutive failures or > 3 s | The thing we actually care about |

k6 runs off-box, so the watchdog stops it by revoking the firewall rule; every
request then fails and k6's `abortOnFail` threshold exits it within ~30s.

**An abort leaves the envelope applied on purpose** — so you can inspect the box
in the state that tripped it. Run `./envelope.sh down` when you're finished.

## Cleanup

Load-test tickets are titled `[loadtest] <vu>-<iter>`; delete by that prefix.
