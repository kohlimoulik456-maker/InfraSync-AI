#!/bin/zsh
set -e

PROJECT_DIR="${0:A:h}"
MOBILE_DIR="$PROJECT_DIR/mobile"
FLUTTER="$HOME/development/flutter/bin/flutter"
API_KEY="local-dev-mobile-key"
WEB_PORT="8080"
BACKEND_PORT=""
LOG_DIR="$HOME/Library/Logs/InfraSync"
BACKEND_LOG="$LOG_DIR/backend.log"
WEB_LOG="$LOG_DIR/mobile-web.log"

mkdir -p "$LOG_DIR"

if [[ ! -x "$FLUTTER" ]]; then
  echo "Flutter was not found at $FLUTTER"
  read -r "?Press Enter to close..."
  exit 1
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -z "$LAN_IP" ]]; then
  LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [[ -z "$LAN_IP" ]]; then
  echo "Could not find a Wi-Fi IP address. Connect this Mac to Wi-Fi first."
  read -r "?Press Enter to close..."
  exit 1
fi

for candidate_port in 3000 3001; do
  if curl -fsS --max-time 2 -H "Authorization: Bearer $API_KEY" \
    "http://localhost:$candidate_port/api/projects" >/dev/null 2>&1; then
    BACKEND_PORT="$candidate_port"
    break
  fi
done

if [[ -z "$BACKEND_PORT" ]]; then
  BACKEND_PORT=3000
  echo "Starting backend on http://$LAN_IP:$BACKEND_PORT"
  cd "$PROJECT_DIR"
  nohup npm run dev -- --hostname 0.0.0.0 --port "$BACKEND_PORT" >"$BACKEND_LOG" 2>&1 < /dev/null &
  for attempt in {1..30}; do
    if curl -fsS --max-time 1 "http://localhost:$BACKEND_PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl -fsS --max-time 2 http://localhost:$WEB_PORT >/dev/null 2>&1; then
  echo "Starting Flutter web app on http://$LAN_IP:$WEB_PORT"
  cd "$MOBILE_DIR"
  nohup "$FLUTTER" run -d web-server --web-hostname 0.0.0.0 --web-port "$WEB_PORT" \
    --dart-define=INFRASYNC_API_BASE_URL="http://$LAN_IP:$BACKEND_PORT" \
    --dart-define=INFRASYNC_API_KEY="$API_KEY" >"$WEB_LOG" 2>&1 < /dev/null &
  sleep 8
fi

URL="http://$LAN_IP:$WEB_PORT"
echo ""
echo "InfraSync Supervisor is available on your phone at:"
echo "$URL"
echo ""
echo "Keep this Mac awake and connected to the same Wi-Fi as your phone."
echo "Logs: $LOG_DIR"
open "$URL"
read -r "?Press Enter to close this window. The app will keep running..."
