# Deploy

From `/opt/swisdex` on the prod server: `make deploy`.

That runs `scripts/deploy.sh`, which always invokes the prod compose overlay (`-f docker-compose.yml -f docker-compose.prod.yml`) — it refuses to start if `docker-compose.prod.yml` is missing.

**Do NOT** run `docker compose up -d` or `docker compose build` without the prod overlay. The dev compose binds host ports 3010/8000 on `0.0.0.0` and runs `uvicorn --reload`; nginx upstreams point at `127.0.0.1:3012/8002` so a dev-mode container produces 502s and exposes ports past nginx (2026-05-12 outage).

`/etc/nginx/snippets/security-headers.conf` is a symlink to `deploy/nginx/snippets/security-headers.conf` in this repo, so `git pull && sudo nginx -t && sudo nginx -s reload` is the full CSP-change workflow.
