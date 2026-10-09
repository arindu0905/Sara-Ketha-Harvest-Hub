#!/usr/bin/env bash
# Rebuilds a scratch PostgreSQL database from all migrations + seed, then runs the SQL regression scripts.
# Usage:  PGHOST=localhost PGPORT=5432 PGUSER=postgres ./run.sh        (needs a throw-away Postgres 14+; NEVER point it at production)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/.."
export PGOPTIONS='-c client_min_messages=warning'
DB="${DB:-hh_test}"
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" || exit 1
P="psql -q -d $DB"
$P -f "$HERE/00_supabase_stub.sql" >/dev/null 2>&1          # auth schema / roles that Supabase provides
for f in "$ROOT"/migrations/0*.sql; do $P -f "$f" 2>&1 | grep -iE "error" | sed "s|^|$(basename "$f"): |"; done
$P -f "$ROOT/seed/001_seed_data.sql" 2>&1 | grep -iE "error"
for t in "$HERE"/0[1-9]_*.sql; do echo "=== $(basename "$t")"; $P -f "$t" 2>&1; done
echo "Expected: only the INVALID_STATE / INSUFFICIENT_STOCK / EXCESSIVE_RESERVATION / INVALID_QTY errors that the scripts provoke on purpose."
