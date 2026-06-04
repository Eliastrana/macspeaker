#!/bin/bash
# Installs the Mac Speaker listener as a launchd service so it starts on login
# and restarts automatically if it ever crashes.
#
# Usage:  ./install.sh          (run from inside the mac-listener folder)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.macspeaker.listener"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node || true)"

if [ -z "$NODE" ]; then
  echo "✗ node not found on PATH. Install Node 18+ first (e.g. brew install node)."
  exit 1
fi

if [ ! -f "$DIR/.env" ]; then
  echo "✗ $DIR/.env not found. Copy .env.example to .env and fill it in first."
  exit 1
fi

if [ ! -d "$DIR/node_modules" ]; then
  echo "→ Installing dependencies…"
  (cd "$DIR" && npm install)
fi

echo "→ Writing $PLIST"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--env-file=.env</string>
    <string>listen.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$DIR/listener.log</string>
  <key>StandardErrorPath</key>
  <string>$DIR/listener.log</string>
</dict>
</plist>
PLIST_EOF

echo "→ (Re)loading service"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "✓ Installed. The listener is running and will start on every login."
echo "  Logs:    tail -f \"$DIR/listener.log\""
echo "  Stop:    launchctl unload \"$PLIST\""
echo "  Start:   launchctl load \"$PLIST\""
