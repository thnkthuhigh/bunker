#!/bin/bash
# =====================================================
# Auto-deploy script for Cloud Clipboard
# Chay bang webhook hoac cron
# Pull code moi tu GitHub va restart service
# =====================================================

APP_DIR="/home/ubuntu/cloud-clipboard"
LOG_FILE="/home/ubuntu/deploy.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "=== Auto-deploy started ==="

cd "$APP_DIR" || { log "ERROR: Cannot cd to $APP_DIR"; exit 1; }

# Pull latest code
log "Pulling latest code..."
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "Already up to date. Skipping."
    exit 0
fi

git pull origin main
log "Code updated: $LOCAL -> $REMOTE"

# Install new dependencies if package.json changed
if git diff "$LOCAL" "$REMOTE" --name-only | grep -q "package.json"; then
    log "package.json changed, running npm install..."
    npm install --production
    log "Dependencies updated"
fi

# Restart service
log "Restarting service..."
sudo systemctl restart cloud-clipboard
sleep 2

if sudo systemctl is-active --quiet cloud-clipboard; then
    log "Service restarted successfully!"
else
    log "ERROR: Service failed to start!"
    sudo journalctl -u cloud-clipboard --no-pager -n 20 >> "$LOG_FILE"
    exit 1
fi

log "=== Auto-deploy completed ==="
