#!/bin/bash
# =====================================================
# Cloud Clipboard - AWS Lightsail Setup Script
# Chay tren Ubuntu 22.04+ (AMD64)
# =====================================================

set -e

echo "============================================"
echo "  Cloud Clipboard - Setup Script"
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }

# ===== 1. Update system =====
echo ""
echo "--- 1/7: Cap nhat he thong ---"
sudo apt update && sudo apt upgrade -y
log "He thong da cap nhat"

# ===== 2. Install Node.js 20 LTS =====
echo ""
echo "--- 2/7: Cai dat Node.js 20 ---"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    log "Node.js $(node -v) da cai dat"
else
    log "Node.js $(node -v) da co san"
fi

# ===== 3. Install Nginx =====
echo ""
echo "--- 3/7: Cai dat Nginx ---"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    log "Nginx da cai dat"
else
    log "Nginx da co san"
fi

# ===== 4. Install build tools (for better-sqlite3) =====
echo ""
echo "--- 4/7: Cai dat build tools ---"
sudo apt install -y build-essential python3
log "Build tools da cai dat"

# ===== 5. Setup app =====
echo ""
echo "--- 5/7: Setup ung dung ---"
APP_DIR="/home/ubuntu/cloud-clipboard"

if [ ! -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR"
    log "Da tao thu muc $APP_DIR"
fi

cd "$APP_DIR"

# Copy files if running from source directory
if [ -f "package.json" ]; then
    log "Files da co san, chay npm install..."
else
    warn "Ban can copy source code vao $APP_DIR truoc"
    warn "Dung: scp -r ./* ubuntu@<ip>:~/cloud-clipboard/"
    exit 1
fi

npm install --production
log "Dependencies da cai dat"

# Create uploads directory
mkdir -p uploads
log "Thu muc uploads da tao"

# ===== 6. Setup systemd service =====
echo ""
echo "--- 6/7: Cau hinh systemd service ---"
sudo cp deploy/cloud-clipboard.service /etc/systemd/system/cloud-clipboard.service
sudo systemctl daemon-reload
sudo systemctl enable cloud-clipboard
sudo systemctl start cloud-clipboard
log "Service da chay"

# ===== 7. Setup Nginx =====
echo ""
echo "--- 7/7: Cau hinh Nginx ---"
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cloud-clipboard
sudo ln -sf /etc/nginx/sites-available/cloud-clipboard /etc/nginx/sites-enabled/cloud-clipboard
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
log "Nginx da cau hinh"

# ===== Open firewall =====
echo ""
echo "--- Mo firewall ---"
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true
sudo ufw allow 22/tcp 2>/dev/null || true
# Also try iptables for non-ufw systems
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true
log "Firewall da mo port 80, 443"

# ===== Done =====
echo ""
echo "============================================"
echo -e "${GREEN}  SETUP HOAN TAT!${NC}"
echo "============================================"
echo ""

# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "<your-ip>")
echo "  Truy cap:  http://$PUBLIC_IP"
echo ""
echo "  Lenh huu ich:"
echo "    sudo systemctl status cloud-clipboard  # Xem trang thai"
echo "    sudo systemctl restart cloud-clipboard  # Khoi dong lai"
echo "    sudo journalctl -u cloud-clipboard -f   # Xem log"
echo ""
echo "  De cai SSL (HTTPS):"
echo "    sudo apt install certbot python3-certbot-nginx"
echo "    sudo certbot --nginx -d your-domain.com"
echo ""
