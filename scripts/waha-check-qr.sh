#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="${HOME}/internshiptasks/waha/.env"
KEY="$(grep '^WAHA_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r\n')"
SESSION="${1:-Arqam}"

echo "=== Session: $SESSION ==="
curl -s -H "X-Api-Key: ${KEY}" "http://127.0.0.1:8081/api/sessions/${SESSION}"
echo
echo
echo "=== QR fetch ==="
HTTP=$(curl -s -w "%{http_code}" -H "X-Api-Key: ${KEY}" -H "Accept: image/png" \
  "http://127.0.0.1:8081/api/${SESSION}/auth/qr" -o /tmp/waha-qr-test.bin)
echo "HTTP ${HTTP}"
file /tmp/waha-qr-test.bin
head -c 200 /tmp/waha-qr-test.bin || true
echo
