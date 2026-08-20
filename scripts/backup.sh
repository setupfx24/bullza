#!/usr/bin/env bash
#
# Daily backup of Postgres + TimescaleDB + uploads/.
#
# Runs on the host (NOT inside a container) and shells into the running
# postgres / timescaledb containers via `docker compose exec` to take
# logical dumps with pg_dumpall. Output goes to the local `backups/`
# directory and (optionally) an `rclone` remote configured by the
# operator with `rclone config`.
#
# All artefacts are encrypted with GPG before being written to disk —
# unencrypted dumps never touch persistent storage. Two modes:
#
#   * BACKUP_GPG_RECIPIENT=ops@example.com  (preferred — public-key)
#       Each artefact is encrypted to that key. The corresponding private
#       key lives only in your password manager / HSM. Backups can be
#       written by the host but only decrypted by an authorised operator.
#
#   * BACKUP_GPG_PASSPHRASE_FILE=/etc/broker/backup.pass  (fallback)
#       Symmetric encryption with AES-256. Simpler bootstrap; the file
#       must be 0600 root:root and SHOULD be a long random string stored
#       independently of the host (1Password / Bitwarden secure note).
#
# If neither variable is set the script ABORTS — we will not write
# unencrypted PII (KYC docs, password hashes) to disk.
#
# Designed to be invoked by host cron with the project's `.env` already
# sourced into the environment. See `scripts/install-backup-cron.sh`.
set -euo pipefail

# ─── Config (overridable via env or .env) ─────────────────────────────
# APP_DIR is the canonical variable; legacy SWISDEX_DIR still honoured as
# a fallback so already-installed cron entries keep working.
COMPOSE_DIR="${APP_DIR:-${SWISDEX_DIR:-/opt/broker}}"
DEST="${BACKUP_LOCAL_DIR:-${COMPOSE_DIR}/backups}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-14}"
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-}"
GPG_PASS_FILE="${BACKUP_GPG_PASSPHRASE_FILE:-}"
STAMP="$(date +%Y-%m-%d_%H%M)"

log() { printf '[backup %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# ─── Encryption guard ─────────────────────────────────────────────────
if ! command -v gpg >/dev/null; then
  log "FATAL: gpg is not installed — refuse to write unencrypted backups"
  exit 1
fi

if [[ -z "$GPG_RECIPIENT" && -z "$GPG_PASS_FILE" ]]; then
  log "FATAL: set BACKUP_GPG_RECIPIENT or BACKUP_GPG_PASSPHRASE_FILE — refuse to write unencrypted backups"
  exit 1
fi

if [[ -n "$GPG_PASS_FILE" && ! -r "$GPG_PASS_FILE" ]]; then
  log "FATAL: passphrase file $GPG_PASS_FILE not readable"
  exit 1
fi

# encrypt_to OUT_PATH — reads stdin, writes encrypted bytes to OUT_PATH.
encrypt_to() {
  local out="$1"
  if [[ -n "$GPG_RECIPIENT" ]]; then
    gpg --batch --yes --trust-model always \
        --cipher-algo AES256 --compress-algo none \
        --recipient "$GPG_RECIPIENT" \
        --output "$out" --encrypt
  else
    gpg --batch --yes --pinentry-mode loopback \
        --cipher-algo AES256 --compress-algo none \
        --passphrase-file "$GPG_PASS_FILE" \
        --symmetric \
        --output "$out"
  fi
}

mkdir -p "$DEST"
chmod 700 "$DEST"
cd "$COMPOSE_DIR"

# ─── 1. Postgres ──────────────────────────────────────────────────────
DUMP="$DEST/postgres-$STAMP.sql.gz.gpg"
log "dumping postgres → $DUMP"
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T postgres pg_dumpall -U "${POSTGRES_USER:-broker}" \
  | gzip | encrypt_to "$DUMP"
chmod 600 "$DUMP"

# ─── 2. Uploads (KYC + manual deposit screenshots) ─────────────────────
UPLOADS="$DEST/uploads-$STAMP.tar.gz.gpg"
if [[ -d "$COMPOSE_DIR/uploads" ]]; then
  log "archiving uploads → $UPLOADS"
  tar czf - -C "$COMPOSE_DIR" uploads | encrypt_to "$UPLOADS"
  chmod 600 "$UPLOADS"
else
  log "no uploads/ directory — skipping"
fi

# ─── 3. TimescaleDB (separate DB, separate dump) ──────────────────────
TS="$DEST/timescale-$STAMP.sql.gz.gpg"
if docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q timescaledb >/dev/null 2>&1 \
   && [[ -n "$(docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q timescaledb)" ]]; then
  log "dumping timescaledb → $TS"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T timescaledb pg_dumpall -U "${TIMESCALE_USER:-broker}" \
    | gzip | encrypt_to "$TS"
  chmod 600 "$TS"
else
  log "timescaledb not running — skipping"
fi

# ─── 4. Local retention ───────────────────────────────────────────────
log "purging local backups older than ${RETAIN_DAYS}d"
find "$DEST" -name "*.gpg" -type f -mtime +"$RETAIN_DAYS" -delete
# Sweep up legacy unencrypted dumps from before the GPG-mandatory change.
find "$DEST" \( -name "*.sql.gz" -o -name "*.tar.gz" \) -type f -mtime +0 -print -delete || true

# ─── 5. Offsite mirror ────────────────────────────────────────────────
if [[ -n "$RCLONE_REMOTE" ]]; then
  if command -v rclone >/dev/null; then
    log "syncing to $RCLONE_REMOTE"
    rclone copy --transfers=2 --checkers=2 --quiet --include="*.gpg" "$DEST" "$RCLONE_REMOTE/"
    rclone delete --min-age "${RETAIN_DAYS}d" --include="*.gpg" "$RCLONE_REMOTE/" --quiet || true
  else
    log "WARN: BACKUP_RCLONE_REMOTE is set but rclone is not installed; skipping offsite sync"
  fi
else
  log "BACKUP_RCLONE_REMOTE not set — local-only backup (NOT safe for prod)"
fi

log "done in ${SECONDS}s"
