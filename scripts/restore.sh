#!/usr/bin/env bash
#
# Restore Postgres (and optionally uploads + timescaledb) from
# backup files produced by scripts/backup.sh.
#
# Usage:
#   scripts/restore.sh <postgres.gpg> [<uploads.gpg>] [<timescale.gpg>]
#
# Backups are encrypted; this script decrypts them on the fly. It picks
# the decryption mode from the same env vars the backup uses:
#
#   * BACKUP_GPG_RECIPIENT  → uses gpg-agent / your private key
#   * BACKUP_GPG_PASSPHRASE_FILE → symmetric, file mode 0600
#
# Legacy unencrypted *.sql.gz / *.tar.gz files are also accepted for
# one-shot restores from old backups; they will be rejected once those
# are sweep-deleted by the new backup.sh.
set -euo pipefail

DUMP="${1:?dump path required}"
UPLOADS="${2:-}"
TS_DUMP="${3:-}"
# APP_DIR points at the compose checkout.
COMPOSE_DIR="${APP_DIR:-/opt/broker}"
GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-}"
GPG_PASS_FILE="${BACKUP_GPG_PASSPHRASE_FILE:-}"

[[ -f "$DUMP" ]] || { echo "[restore] $DUMP not found"; exit 1; }
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || { echo "[restore] $UPLOADS not found"; exit 1; }
[[ -z "$TS_DUMP" || -f "$TS_DUMP" ]] || { echo "[restore] $TS_DUMP not found"; exit 1; }

cd "$COMPOSE_DIR"

# decrypt_stream PATH — emit gunzipped SQL on stdout. Handles both .gpg
# (encrypted) and legacy plain .gz inputs.
decrypt_stream() {
  local f="$1"
  if [[ "$f" == *.gpg ]]; then
    if [[ -n "$GPG_PASS_FILE" ]]; then
      gpg --batch --quiet --pinentry-mode loopback \
          --passphrase-file "$GPG_PASS_FILE" --decrypt "$f"
    else
      gpg --batch --quiet --decrypt "$f"
    fi
  else
    cat "$f"
  fi
}

echo
echo "[restore] target stack:    $COMPOSE_DIR"
echo "[restore] postgres dump:   $DUMP"
[[ -n "$UPLOADS" ]] && echo "[restore] uploads tarball: $UPLOADS"
[[ -n "$TS_DUMP" ]] && echo "[restore] timescale dump:  $TS_DUMP"
echo
read -r -p "[restore] this will OVERWRITE the running database. Continue? (yes/N) " ans
[[ "$ans" == "yes" ]] || { echo "aborted"; exit 1; }

# ─── Postgres ─────────────────────────────────────────────────────────
echo "[restore] starting postgres alone"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres
for i in $(seq 1 30); do
  if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
       pg_isready -U "${POSTGRES_USER:-broker}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[restore] decrypting + piping $DUMP → psql"
decrypt_stream "$DUMP" | gunzip -c | \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T postgres psql -U "${POSTGRES_USER:-broker}" -d postgres -v ON_ERROR_STOP=1

# ─── TimescaleDB (optional) ───────────────────────────────────────────
if [[ -n "$TS_DUMP" ]]; then
  echo "[restore] starting timescaledb alone"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d timescaledb
  for i in $(seq 1 30); do
    if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T timescaledb \
         pg_isready -U "${TIMESCALE_USER:-broker}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  echo "[restore] decrypting + piping $TS_DUMP → timescale psql"
  decrypt_stream "$TS_DUMP" | gunzip -c | \
    docker compose -f docker-compose.yml -f docker-compose.prod.yml \
      exec -T timescaledb psql -U "${TIMESCALE_USER:-broker}" -d postgres -v ON_ERROR_STOP=1
fi

# ─── Uploads (optional) ───────────────────────────────────────────────
if [[ -n "$UPLOADS" ]]; then
  echo "[restore] decrypting + extracting $UPLOADS → $COMPOSE_DIR"
  decrypt_stream "$UPLOADS" | tar xzf - -C "$COMPOSE_DIR"
fi

echo
echo "[restore] DB + files restored. Bring the rest of the stack up with:"
echo
echo "  cd $COMPOSE_DIR && \\"
echo "  APP_VERSION=\$(date +%s) docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo
