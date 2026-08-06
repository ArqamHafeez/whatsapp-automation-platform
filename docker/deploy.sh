#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit secrets before production use."
fi
set -a
source .env
set +a
docker compose -f docker-compose.yml build --pull
sudo docker compose -f docker-compose.yml up -d || docker compose -f docker-compose.yml up -d
sudo docker compose -f docker-compose.yml ps || docker compose -f docker-compose.yml ps
echo "App URL: ${WEBHOOK_PUBLIC_URL:-http://localhost}"
echo "Logs: docker compose -f docker/docker-compose.yml logs -f api frontend waha nginx"
