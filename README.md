# Cloud Clipboard

Self-hosted cloud clipboard for storing images and text content, accessible from any device.

## Features

- **Text & Image Storage** - Save text snippets and images
- **Copy & Paste** - Paste images directly from clipboard (Ctrl+V)
- **Drag & Drop** - Drop files to upload
- **Categories** - Organize items into custom categories
- **Pin Items** - Pin important items to the top
- **Download** - Download any stored image
- **Auto Refresh** - Syncs across devices every 10 seconds
- **Dark Theme** - Modern dark UI with SVG icons

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla HTML/CSS/JS
- **Upload:** Multer (50MB max)

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Or start in dev mode (auto-restart on changes)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to AWS Lightsail

1. Create an Ubuntu 22.04 instance on [AWS Lightsail](https://lightsail.aws.amazon.com) (Singapore region)
2. Open ports 80 and 443 in Networking > Firewall
3. Upload code to server:
   ```bash
   scp -i your-key.pem -r server.js package.json package-lock.json public/ deploy/ ubuntu@<IP>:~/cloud-clipboard/
   ```
4. SSH into server and run setup:
   ```bash
   cd ~/cloud-clipboard
   chmod +x deploy/setup.sh
   ./deploy/setup.sh
   ```

The setup script automatically installs Node.js, Nginx, configures systemd service, and opens firewall ports.

### Optional: HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Optional: Daily Backups

```bash
chmod +x deploy/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/cloud-clipboard/deploy/backup.sh") | crontab -
```

## Project Structure

```
cloud-clipboard/
  server.js          # Express backend + API
  package.json
  public/
    index.html       # Main UI
    style.css        # Dark theme styles
    app.js           # Frontend logic
  deploy/
    setup.sh         # Auto-setup script for Ubuntu VPS
    nginx.conf       # Nginx reverse proxy config
    cloud-clipboard.service  # Systemd service
    backup.sh        # Daily backup script
```

## License

MIT
