#!/usr/bin/env bash
# Detached, low-priority, memory-gentle launcher for the CMIP6 batch on Spark.
# - setsid: own session, survives ssh/terminal teardown (reparents to init).
# - nice: yields CPU to co-tenant jobs (e.g. botnaut-engine).
# - EXIT= marker: records the exit code so a silent death is diagnosable
#   (137 = SIGKILL/OOM, 143 = SIGTERM, 0 = clean).
# - CDS_CONCURRENCY default 3: keeps peak RAM low on a loaded box. Override via env.
set -u
cd "$(dirname "$0")"
: > batch.log
export CDS_CONCURRENCY="${CDS_CONCURRENCY:-3}"
setsid nice -n 10 bash -c '
  .venv/bin/python fetch_reduce.py >> batch.log 2>&1
  echo "EXIT=$? at $(date -Is)" >> batch.log
' < /dev/null &
echo "launched (setsid, nice 10, CDS_CONCURRENCY=$CDS_CONCURRENCY); log: batch.log"
