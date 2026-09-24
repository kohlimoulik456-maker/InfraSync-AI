#!/bin/zsh
set -e

PROJECT_DIR="${0:A:h}"
MOBILE_DIR="$PROJECT_DIR/mobile"
FLUTTER="$HOME/development/flutter/bin/flutter"
API_KEY="local-dev-mobile-key"
LOG_DIR="$HOME/Library/Logs/InfraSync"
BACKEND_LOG="$LOG_DIR/backend.log"

mkdir -p "$LOG_DIR"

if [[ ! -x "$FLUTTER" ]]; then
  echo "Flutter was not found at $FLUTTER"
  echo "Install Flutter or update the FLUTTER path in this launcher."
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

if ! curl -fsS --max-time 2 http://localhost:3000 >/dev/null 2>&1; then
  echo "Starting backend on http://$LAN_IP:3000"
  cd "$PROJECT_DIR"
  npm run dev -- --hostname 0.0.0.0 >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
  trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT
  for attempt in {1..30}; do
    if curl -fsS --max-time 1 http://localhost:3000 >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Backend is already running on http://$LAN_IP:3000"
fi

cd "$MOBILE_DIR"
echo ""
echo "Available Flutter devices:"
"$FLUTTER" devices
echo ""
read -r "DEVICE_ID?Enter the phone device ID (or chrome for a browser test): "
if [[ -z "$DEVICE_ID" ]]; then
  echo "No device selected."
  exit 1
fi

echo "Launching InfraSync Supervisor on $DEVICE_ID"
"$FLUTTER" run -d "$DEVICE_ID" \
  --dart-define=INFRASYNC_API_BASE_URL="http://$LAN_IP:3000" \
  --dart-define=INFRASYNC_API_KEY="$API_KEY"
