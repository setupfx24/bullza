# Disaster Recovery Runbook

Rebuild the full stack on a fresh VPS from the encrypted backups produced by
`scripts/backup.sh`. Target time: ~30 minutes. Prerequisites: the latest
`postgres-*.sql.gz.gpg` (+ optionally `uploads-*.tar.gz.gpg` and
`timescale-*.sql.gz.gpg`) dumps, and the `.env` + GPG key/passphrase from your
password manager. **Practice this quarterly on a throwaway VPS.**

## 1. Provision + install Docker

```bash
apt-get update && apt-get install -y ca-certificates curl git gnupg rclone
curl -fsSL https://get.docker.com | sh
```

## 2. Clone the repo

```bash
git clone <your-git-remote> /opt/broker
cd /opt/broker
chmod +x scripts/*.sh
```

If the old server used the pre-rename compose project name, also
`export COMPOSE_PROJECT_NAME=<old-name>` — otherwise skip this.

## 3. Restore secrets

- Copy `.env` from your password manager into `/opt/broker/.env`. Do **not**
  regenerate JWT secrets — existing password hashes are independent, but new
  secrets invalidate active sessions only (acceptable); DB passwords must
  match what the dumps expect only if you skip restore (a full restore
  recreates roles from the dump).
- Restore the backup GPG private key (`gpg --import`) or the passphrase file
  (`/etc/broker/backup.pass`, mode 0600), matching whichever mode
  `BACKUP_GPG_RECIPIENT` / `BACKUP_GPG_PASSPHRASE_FILE` was used.

## 4. Fetch the latest dumps

```bash
mkdir -p /opt/broker/backups
rclone config            # recreate the offsite remote if needed
rclone copy <remote>:/ /opt/broker/backups --include "*.gpg" --max-age 48h
ls -lt /opt/broker/backups | head
```

## 5. Restore

```bash
set -a && source .env && set +a
./scripts/restore.sh \
  backups/postgres-<latest>.sql.gz.gpg \
  backups/uploads-<latest>.tar.gz.gpg \
  backups/timescale-<latest>.sql.gz.gpg
```

The script starts Postgres/Timescale alone, decrypts + pipes the dumps into
`psql`, and extracts `uploads/`. It prompts before overwriting; answer `yes`.
TimescaleDB is optional — omitting the dump only loses chart history
(market-data refills it going forward).

## 6. Deploy the stack

```bash
./scripts/deploy.sh --no-pull        # build images, run migrations, up -d
```

## 7. Point DNS + nginx

- Install nginx, copy `deploy/nginx/broker.conf` (with the tenant domain
  substituted for `example.com`) into `/etc/nginx/sites-enabled/`, copy
  `deploy/nginx/snippets/security-headers.conf` into `/etc/nginx/snippets/`,
  install the TLS origin certs, then `nginx -t && systemctl reload nginx`.
- Update DNS (or Cloudflare) A records for apex, `trade.`, `admin.`, `api.`
  to the new server IP.

## 8. Verify + re-arm backups

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -s https://api.<tenant-domain>/health
./scripts/install-backup-cron.sh     # daily 03:00 backups on the NEW host
```

Log into the admin panel, spot-check a user's balance/trades against the
pre-incident state, and place a demo trade end-to-end.
