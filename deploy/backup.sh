#!/bin/bash
# =====================================================
# Backup script - Chay hang ngay bang cron
# Luu database + uploads vao /home/ubuntu/backups
# =====================================================

BACKUP_DIR="/home/ubuntu/backups"
APP_DIR="/home/ubuntu/cloud-clipboard"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/clipboard_backup_$DATE.tar.gz"

# Tao thu muc backup
mkdir -p "$BACKUP_DIR"

# Backup database (safe copy while running)
sqlite3 "$APP_DIR/clipboard.db" ".backup '$BACKUP_DIR/clipboard_temp.db'"

# Tao archive
tar -czf "$BACKUP_FILE" \
    -C "$BACKUP_DIR" clipboard_temp.db \
    -C "$APP_DIR" uploads/

# Xoa file temp
rm -f "$BACKUP_DIR/clipboard_temp.db"

# Giu lai 7 ban backup gan nhat
ls -t "$BACKUP_DIR"/clipboard_backup_*.tar.gz | tail -n +8 | xargs rm -f 2>/dev/null

echo "Backup thanh cong: $BACKUP_FILE"
echo "Kich thuoc: $(du -h "$BACKUP_FILE" | cut -f1)"
