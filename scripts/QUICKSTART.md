# Moneylix Scripts - Quick Start Guide

A fast reference guide for getting started with the three essential Moneylix deployment and operations scripts.

## 🚀 Quick Setup (5 minutes)

### 1. Make Scripts Executable
```bash
cd D:\Projects\Money\scripts
chmod +x *.sh
```

### 2. Verify Permissions
```bash
ls -la *.sh
# Should show: -rwxr-xr-x (or similar with x)
```

### 3. Install Prerequisites
```bash
# Core tools (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y git nodejs npm curl

# PM2 (global Node package)
sudo npm install -g pm2

# SSL tools (for SSL renewal)
sudo apt-get install -y certbot certbot-nginx

# Optional: monitoring tools
sudo apt-get install -y net-tools dnsutils
```

---

## 📋 The Three Scripts

### Script #1: setup-ssl-renewal.sh
**Purpose**: Automatic SSL certificate renewal  
**Run**: Once per server (after initial setup)  
**Frequency**: Automatic monthly via cron

```bash
# Setup SSL auto-renewal
sudo bash setup-ssl-renewal.sh

# Verify it worked
certbot certificates
crontab -l | grep certbot
```

✅ **What it does**:
- Installs certbot if needed
- Tests renewal with dry-run
- Sets up monthly cron job
- Configures log rotation

⏰ **Schedule**: 1st of every month at 2 AM UTC

---

### Script #2: deploy.sh
**Purpose**: Deploy application updates  
**Run**: On-demand or scheduled  
**Frequency**: As needed

```bash
# Deploy to production
bash deploy.sh

# Deploy to staging
bash deploy.sh --env=staging

# Deploy specific branch
bash deploy.sh --branch=develop

# Deploy without rebuild
bash deploy.sh --skip-build
```

✅ **What it does**:
1. Pulls latest code from git
2. Installs dependencies (`npm ci`)
3. Builds application (`npm run build`)
4. Restarts PM2 process
5. Verifies everything is running

⏱️ **Duration**: 2-5 minutes typically

📝 **Deploy with schedule**:
```bash
# Auto-deploy daily at 2 AM
0 2 * * * cd /path/to/moneylix && bash scripts/deploy.sh
```

---

### Script #3: health-check.sh
**Purpose**: Monitor system and application health  
**Run**: On-demand or continuous monitoring  
**Frequency**: Every 5-15 minutes recommended

```bash
# Quick health check
bash health-check.sh

# JSON output (for monitoring systems)
bash health-check.sh --json

# Critical issues only
bash health-check.sh --critical-only

# Send email alert on errors
EMAIL_ADDRESS=ops@company.com bash health-check.sh --email
```

✅ **What it checks**:
- PM2 process status
- Port 3006 responding
- SSL certificate validity
- Disk space usage
- Memory usage
- Application logs
- System load

📊 **Example output**:
```
Health Summary:
  ✓ Healthy:  6
  ! Warning:  0
  ✗ Critical: 0

Overall Status: HEALTHY
```

⏱️ **Duration**: 5-10 seconds

📝 **Monitor continuously**:
```bash
# Check every 5 minutes
*/5 * * * * bash /path/to/health-check.sh >> /var/log/moneylix/health.log 2>&1
```

---

## 🎯 Common Workflows

### Workflow 1: Initial Server Setup
```bash
# 1. Make scripts executable
chmod +x *.sh

# 2. Setup SSL auto-renewal
sudo bash setup-ssl-renewal.sh

# 3. Configure PM2
cd /path/to/moneylix
pm2 start app.js --name moneylix
pm2 save

# 4. Test deployment script
bash deploy.sh

# 5. Start monitoring
bash health-check.sh
```

### Workflow 2: Daily Operations
```bash
# Morning: Health check
bash health-check.sh

# Maintenance window: Deploy updates
bash deploy.sh

# Verify: Post-deployment check
bash health-check.sh
pm2 show moneylix
```

### Workflow 3: Emergency Troubleshooting
```bash
# 1. Check status
bash health-check.sh

# 2. View logs
pm2 logs moneylix | head -50

# 3. Restart if needed
pm2 restart moneylix

# 4. Verify
bash health-check.sh --critical-only
```

### Workflow 4: Continuous Monitoring Setup
```bash
# Add to crontab
crontab -e

# Add these lines:
0 2 1 * * sudo bash /path/to/setup-ssl-renewal.sh >> /var/log/ssl-renewal.log 2>&1
0 2 * * * bash /path/to/deploy.sh >> /var/log/auto-deploy.log 2>&1
*/5 * * * * bash /path/to/health-check.sh >> /var/log/health.log 2>&1

# View your crontab
crontab -l
```

---

## 🔧 Configuration

### Set Environment Variables
```bash
# For SSL renewal
export DOMAIN="yourdomain.com"
export EMAIL="admin@yourdomain.com"

# For deployment
export APP_DIR="/home/deploy/moneylix"
export GIT_BRANCH="main"
export ENVIRONMENT="production"

# For health checks
export APP_PORT="3006"
export PM2_APP_NAME="moneylix"

# Then run scripts
sudo bash setup-ssl-renewal.sh
bash deploy.sh
bash health-check.sh
```

### Create Config File
```bash
# Create scripts/config.sh
cat > config.sh << 'EOF'
# Moneylix Script Configuration
export DOMAIN="moneylix.com"
export EMAIL="ops@moneylix.com"
export APP_DIR="/home/deploy/moneylix"
export APP_PORT="3006"
export PM2_APP_NAME="moneylix"
export GIT_BRANCH="main"
EOF

# Source before running
source scripts/config.sh
bash deploy.sh
```

---

## 🐛 Quick Troubleshooting

### Issue: "Permission denied" when running script
```bash
# Fix: Make executable
chmod +x script-name.sh

# Verify
ls -la script-name.sh  # Should show x in permissions
```

### Issue: "Command not found: pm2"
```bash
# Fix: Install PM2
sudo npm install -g pm2

# Verify
pm2 --version
```

### Issue: "SSL certificate not found"
```bash
# Check existing certificates
sudo certbot certificates

# List certificate files
ls -la /etc/letsencrypt/live/

# If missing, request new certificate
sudo certbot certonly --standalone -d moneylix.com
```

### Issue: "Port 3006 not responding"
```bash
# Check process status
pm2 status

# View logs
pm2 logs moneylix

# Restart process
pm2 restart moneylix

# Test port directly
curl http://localhost:3006/
```

### Issue: "Git pull failed"
```bash
# Check git status
cd /path/to/app
git status

# Stash uncommitted changes
git stash

# Try pull again
git pull origin main
```

### Issue: npm install fails
```bash
# Clear cache
npm cache clean --force

# Try clean install
npm ci

# If still failing, check logs
npm ci --loglevel=verbose
```

---

## 📊 Monitoring Integration

### Simple Cron-Based Monitoring
```bash
# Add to crontab for hourly health checks
0 * * * * bash /path/to/health-check.sh >> /var/log/health-checks.log 2>&1

# View health history
tail -100 /var/log/health-checks.log
```

### JSON Export for External Monitoring
```bash
# Get status as JSON
bash health-check.sh --json > /tmp/health-status.json

# View as formatted JSON
cat /tmp/health-status.json | jq .

# Export to monitoring system
bash health-check.sh --json | curl -X POST -d @- \
  https://your-monitoring-system/api/health
```

### Email Alerts
```bash
# Send email on critical issues
bash health-check.sh --email

# Or in cron job
*/5 * * * * bash /path/to/health-check.sh --email 2>&1 | logger
```

---

## 🚨 Rollback Quick Reference

If a deployment goes wrong:

```bash
# 1. Check what was deployed
cat .backups/last-deployment.state

# 2. See recent commits
git log --oneline -10

# 3. Revert to previous version
git checkout <COMMIT_HASH>

# 4. Reinstall and rebuild
npm ci && npm run build

# 5. Restart application
pm2 restart moneylix

# 6. Verify
bash health-check.sh
```

---

## 📚 Full Documentation

For detailed documentation, see [README.md](./README.md)

Topics covered:
- Complete feature list
- All configuration options
- Advanced usage patterns
- CI/CD integration examples
- Comprehensive troubleshooting
- Best practices

---

## 🎓 Learning Path

1. **Start**: Read this QUICKSTART guide
2. **Practice**: Run `bash health-check.sh` to verify setup
3. **Deploy**: Try `bash deploy.sh --skip-build` (safe first run)
4. **Monitor**: Set up cron job with health checks
5. **Automate**: Add SSL renewal and full monitoring
6. **Master**: Read README.md for advanced topics

---

## ⚡ One-Liner Examples

```bash
# Quick health check
bash health-check.sh

# Deploy and verify
bash deploy.sh && bash health-check.sh

# Setup SSL (requires sudo)
sudo bash setup-ssl-renewal.sh

# JSON health status
bash health-check.sh --json | jq .status

# Deploy to staging without build
bash deploy.sh --env=staging --skip-build

# Show critical issues only
bash health-check.sh --critical-only

# Monitor continuously (every 10 seconds)
watch -n 10 'bash health-check.sh --critical-only'

# Get status for alerting
bash health-check.sh; echo "Exit code: $?"
```

---

## 🆘 Getting Help

**Stuck?** Here are the most useful commands:

```bash
# View script help/comments
head -30 script-name.sh

# Check logs for errors
tail -50 /var/log/moneylix/*.log

# Monitor application logs
pm2 logs moneylix

# Check system resources
free -h          # Memory
df -h            # Disk space
top -b -n 1      # Process list
uptime           # System load

# Verify services running
pm2 status
sudo systemctl status nginx
sudo certbot certificates
```

---

**Quick Links**:
- 📖 [Full Documentation](./README.md)
- 🔐 [SSL Renewal Setup](./setup-ssl-renewal.sh)
- 🚀 [Deployment Script](./deploy.sh)
- 🏥 [Health Check Script](./health-check.sh)

**Version**: 1.0.0  
**Last Updated**: 2026-06-07
