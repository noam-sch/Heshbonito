#!/bin/bash
# ============================================================
#  Creates a "חשבונית׳ו.app" on the Desktop that launches
#  Heshbonito in Terminal with a single double-click.
#  Run this once: ./create-app.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="חשבונית׳ו"
APP_PATH="$HOME/Desktop/${APP_NAME}.app"
START_SCRIPT="$SCRIPT_DIR/start.sh"

echo "Creating ${APP_NAME}.app on your Desktop..."

# Create the AppleScript source
APPLESCRIPT=$(cat <<EOF
tell application "Terminal"
    activate
    do script "${START_SCRIPT}"
end tell
EOF
)

# Compile into a .app bundle
osacompile -o "$APP_PATH" -e "$APPLESCRIPT"

# Create a custom icon using a simple emoji-based approach
# (The app will use the default Script Editor icon, but we'll
#  set a nice name that shows חשבונית׳ו in the Dock)

echo ""
echo "✅ Created: $APP_PATH"
echo ""
echo "You can now:"
echo "  • Double-click it on the Desktop to launch Heshbonito"
echo "  • Drag it to the Dock for quick access"
echo "  • Move it to /Applications if you prefer"
echo ""
echo "Tip: Right-click the app in Dock → Options → Keep in Dock"
