# Moneylix Deployment & Operations Scripts

A comprehensive suite of production-ready bash scripts for managing the Moneylix application deployment, SSL certificate auto-renewal, and system health monitoring.

## Table of Contents

1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [Script: setup-ssl-renewal.sh](#script-setup-ssl-renewalsh)
4. [Script: deploy.sh](#script-deploysh)
5. [Script: health-check.sh](#script-health-checksh)
6. [Common Usage Patterns](#common-usage-patterns)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Overview

### Available Scripts

| Script | Purpose | Frequency | Privileges |
|--------|---------|-----------|------------|
| `setup-ssl-renewal.sh` | Configure automatic SSL certificate renewal | Once per server | Root (sudo) |
| `deploy.sh` | Deploy application updates | On-demand | Regular user |
| `health-check.sh` | Monitor system and application health | Continuous/Scheduled | Regular user |

### Key Features

- **Error Handling**: Comprehensive error checking and informative error messages
- **Logging**: All operations logged with timestamps
- **Rollback Support**: Built-in rollback instructions for failed deployments
- **Status Reporting**: Clear visual feedback with color-coded output
- **JSON Output**: Machine-readable output for monitoring systems
- **Automation-Ready**: Can be integrated with cron, CI/CD, or monitoring systems

## Setup Instructions

### 1. Create the Scripts Directory

```bash
mkdir -p D:\Projects\Money\scripts
cd D:\Projects\Money\scripts
```

### 2. Make Scripts Executable

```bash
chmod +x setup-ssl-renewal.sh
chmod +x deploy.sh
chmod +x health-check.sh
```

### 3. Verify Permissions

```bash
ls -la D:\Projects\Money\scripts/
```

### 4. Install Prerequisites

**For all scripts:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y curl git nodejs npm

# Install PM2 globally
npm install -g pm2
```

**For SSL renewal script:**
```bash
sudo apt-get install -y certbot certbot-nginx
```

**For health checks (optional enhancements):**
```bash
sudo apt-get install -y net-tools dnsutils
```

### 5. Configure Application in PM2

```bash
cd /path/to/moneylix
pm2 start app.js --name moneylix
pm2 save
pm2 startup
```

## Script: setup-ssl-renewal.sh

### Purpose

Automates SSL certificate renewal using Let's Encrypt (certbot), ensuring your HTTPS connections stay valid without manual intervention.

### Features

- ✓ Validates certbot installation (auto-installs if missing)
- ✓ Checks for existing certificates
- ✓ Performs dry-run test before enabling
- ✓ Sets up monthly cron job for auto-renewal
- ✓ Configures log rotation
- ✓ Displays renewal status and next renewal date

### Usage

**Basic setup:**
```bash
sudo bash setup-ssl-renewal.sh
```

**With custom domain:**
```bash
sudo DOMAIN=yourdomain.com EMAIL=admin@yourdomain.com bash setup-ssl-renewal.sh
```

**Environment Variables:**
- `DOMAIN`: Your domain name (default: moneylix.com)
- `EMAIL`: Email for Let's Encrypt notifications (default: admin@moneylix.com)

### Output Example

```
[2026-06-07 10:15:23] Starting SSL certificate renewal setup...
[✓] certbot is installed: certbot 2.6.0
[✓] nginx is installed
[✓] Certificate found
[✓] Certificate is valid for 45 more days
[✓] Dry-run test passed!
[✓] Cron job configured
[✓] Log rotation configured

Schedule: 0 2 1 * * (1st of each month at 2 AM UTC)
```

### Cron Job Details

```
0 2 1 * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx' >> /var/log/moneylix-ssl-renewal.log 2>&1
```

- **Runs**: 1st of every month at 2:00 AM UTC
- **Action**: Renews certificates and reloads nginx if updated
- **Logging**: All output logged to `/var/log/moneylix-ssl-renewal.log`

### Monitoring

```bash
# Check renewal status
certbot certificates

# View renewal logs
tail -f /var/log/moneylix-ssl-renewal.log

# Check cron job
crontab -l | grep certbot

# Manual renewal (if needed)
sudo certbot renew --verbose
```

### Troubleshooting SSL Renewal

```bash
# Test renewal without making changes
sudo certbot renew --dry-run

# Renew a specific certificate
sudo certbot renew --cert-name moneylix.com

# Check certificate details
openssl x509 -in /etc/letsencrypt/live/moneylix.com/cert.pem -noout -text
```

## Script: deploy.sh

### Purpose

Automates the entire deployment process: pulling updates, installing dependencies, building the application, and restarting the service.

### Features

- ✓ Validates all prerequisites (git, node, npm, PM2)
- ✓ Pulls latest code from specified git branch
- ✓ Installs dependencies with `npm ci`
- ✓ Builds application with error handling
- ✓ Restarts PM2 process and verifies it's running
- ✓ Logs all operations with timestamps
- ✓ Provides comprehensive rollback instructions on failure
- ✓ Saves deployment state for reference

### Usage

**Standard deployment (production):**
```bash
bash deploy.sh
```

**Staging environment:**
```bash
bash deploy.sh --env=staging
```

**Deploy specific branch:**
```bash
bash deploy.sh --branch=develop
```

**Skip build step:**
```bash
bash deploy.sh --skip-build
```

**Combined example:**
```bash
bash deploy.sh --env=staging --branch=develop --skip-build
```

### Environment Variables

- `ENVIRONMENT`: Deployment environment (default: production)
- `APP_DIR`: Application directory (default: current directory)
- `GIT_BRANCH`: Git branch to deploy (default: main)
- `SKIP_BUILD`: Skip npm build step (default: false)

### Deployment Steps

1. **Prerequisite Check**: Validates git, node, npm, PM2 installation
2. **Git Pull**: Fetches and pulls latest code from specified branch
3. **Dependency Installation**: Runs `npm ci` for clean install
4. **Build**: Executes `npm run build` (can be skipped)
5. **PM2 Restart**: Stops and restarts the application
6. **Verification**: Confirms application is running and responsive

### Output Example

```
[2026-06-07 10:30:45] Starting deployment...
[✓] git is installed
[✓] Node.js is installed: v18.16.0
[✓] npm is installed: 9.6.7
[✓] PM2 is installed: 5.3.0

Step 1: Fetching latest code from git
[✓] Git pull completed. New commit: a1b2c3d

Step 2: Installing dependencies
[✓] Dependencies installed successfully

Step 3: Building application
[✓] Build completed successfully
[ℹ] Build output size: 2.5M

Step 4: Restarting PM2 process
[✓] PM2 process restarted and is online

════════════════════════════════════════════════
              DEPLOYMENT COMPLETED SUCCESSFULLY
════════════════════════════════════════════════
```

### Logs and State

- **Deployment Log**: `/var/log/moneylix/deployment-YYYYMMDD_HHMMSS.log`
- **Deployment State**: `.backups/last-deployment.state`

```bash
# View deployment state
cat .backups/last-deployment.state

# Monitor active deployment log
tail -f /var/log/moneylix/deployment-*.log
```

### Rollback Process

If deployment fails, follow these steps:

```bash
# 1. Check what was deployed
cat .backups/last-deployment.state

# 2. See git history
git log --oneline -10

# 3. Revert to previous commit
git checkout <PREVIOUS_COMMIT_HASH>

# 4. Reinstall and rebuild
npm ci
npm run build

# 5. Restart application
pm2 restart moneylix

# 6. Verify
pm2 status
pm2 show moneylix
```

### CI/CD Integration

**With GitHub Actions:**
```yaml
- name: Deploy to production
  run: |
    ssh user@server.com 'cd /path/to/moneylix && bash scripts/deploy.sh'
```

**With Jenkins:**
```groovy
stage('Deploy') {
    steps {
        sh 'bash scripts/deploy.sh --env=production'
    }
}
```

## Script: health-check.sh

### Purpose

Monitors application and system health, providing real-time status and alerting on issues.

### Features

- ✓ Checks PM2 process status and uptime
- ✓ Verifies port 3006 is responding (HTTP/TCP)
- ✓ Validates SSL certificate expiry
- ✓ Monitors disk space usage
- ✓ Checks system memory usage
- ✓ Analyzes application logs for errors
- ✓ Monitors system load average
- ✓ JSON output for monitoring systems
- ✓ Email alerts on critical issues

### Usage

**Interactive health check:**
```bash
bash health-check.sh
```

**JSON output (for monitoring systems):**
```bash
bash health-check.sh --json
```

**Show only critical issues:**
```bash
bash health-check.sh --critical-only
```

**Send email alert on errors:**
```bash
EMAIL_ADDRESS=ops@moneylix.com bash health-check.sh --email
```

**Custom domain/port:**
```bash
bash health-check.sh --domain=custom.com --port=3007
```

### Environment Variables

- `DOMAIN`: Domain name for SSL check (default: moneylix.com)
- `APP_PORT`: Application port (default: 3006)
- `PM2_APP_NAME`: PM2 application name (default: moneylix)
- `EMAIL_ADDRESS`: Email for alerts (default: admin@moneylix.com)
- `CRITICAL_ONLY`: Show only critical issues (default: false)
- `OUTPUT_JSON`: JSON output format (default: false)

### Health Checks Performed

| Check | Status | Threshold |
|-------|--------|-----------|
| PM2 Process | Running/Stopped | Must be online |
| Port Response | 3006 listening | Must respond |
| SSL Certificate | Validity/Expiry | >30 days optimal |
| Disk Space | Usage % | Warning: 80%, Critical: 90% |
| Memory Usage | Usage % | Warning: 80%, Critical: 90% |
| Application Logs | Recent errors | Warning: 1-5 errors, Critical: 5+ errors |
| System Load | Load average | Warning: 80% CPU utilization |

### Output Example

```
╔═══════════════════════════════════════════════════════╗
║     Moneylix Application Health Check Report          ║
╚═══════════════════════════════════════════════════════╝

Timestamp: 2026-06-07 10:45:30
Application: moneylix
Domain: moneylix.com
Port: 3006

Health Summary:
  ✓ Healthy:  6
  ! Warning:  0
  ✗ Critical: 0

Overall Status: HEALTHY
All systems operational
```

### JSON Output

```bash
bash health-check.sh --json
```

```json
{
  "timestamp": "2026-06-07T10:45:30Z",
  "application": "moneylix",
  "status": "healthy",
  "summary": {
    "healthy": 6,
    "warning": 0,
    "critical": 0
  },
  "domain": "moneylix.com",
  "port": 3006,
  "ssl_cert_path": "/etc/letsencrypt/live/moneylix.com/cert.pem"
}
```

### Automated Monitoring

**Schedule health checks with cron:**

```bash
# Check every 15 minutes
*/15 * * * * bash /path/to/health-check.sh >> /var/log/moneylix/health-check.log 2>&1

# Daily summary at 9 AM
0 9 * * * bash /path/to/health-check.sh --json | logger

# Alert on critical issues
*/5 * * * * bash /path/to/health-check.sh --email 2>&1 || true
```

**Monitor with external service:**

```bash
# Send health status to monitoring service
bash health-check.sh --json | curl -X POST \
  -H "Content-Type: application/json" \
  -d @- \
  https://monitoring.service.com/api/health
```

### Exit Codes

- `0`: All checks passed (Healthy)
- `1`: Critical issue detected
- `2`: Warning detected

This allows integration with alerting systems:

```bash
bash health-check.sh
case $? in
    0) echo "All OK" ;;
    1) echo "CRITICAL ALERT"; send_alert ;;
    2) echo "WARNING"; log_warning ;;
esac
```

## Common Usage Patterns

### Daily Deployment Schedule

```bash
# Deploy every day at 2 AM
0 2 * * * cd /path/to/moneylix && bash scripts/deploy.sh >> /var/log/moneylix/auto-deploy.log 2>&1
```

### Health Monitoring Stack

```bash
# Hourly comprehensive health check
0 * * * * bash /path/to/health-check.sh >> /var/log/moneylix/health.log 2>&1

# Quick check every 5 minutes
*/5 * * * * bash /path/to/health-check.sh --critical-only > /dev/null 2>&1 || bash /path/to/health-check.sh --email

# Daily summary report
0 8 * * * bash /path/to/health-check.sh --json > /tmp/health-report.json
```

### Complete Deployment Workflow

```bash
#!/bin/bash
# Complete deployment with verification

cd /path/to/moneylix

# Deploy
bash scripts/deploy.sh || exit 1

# Wait for startup
sleep 10

# Health check
bash scripts/health-check.sh || {
    echo "Health check failed!"
    # Rollback here if needed
    exit 1
}

echo "Deployment successful!"
```

### Integration with Monitoring Systems

**Prometheus metrics export:**

```bash
#!/bin/bash
# Export health check results as Prometheus metrics

result=$(bash health-check.sh --json)
timestamp=$(echo $result | jq -r '.timestamp')
status=$(echo $result | jq -r '.status')
healthy=$(echo $result | jq -r '.summary.healthy')
warning=$(echo $result | jq -r '.summary.warning')
critical=$(echo $result | jq -r '.summary.critical')

cat << EOF
# HELP moneylix_health_status Application health status (0=healthy, 1=warning, 2=critical)
# TYPE moneylix_health_status gauge
moneylix_health_status{application="moneylix"} $([[ "$status" == "healthy" ]] && echo 0 || echo 1)

# HELP moneylix_health_checks_passed Number of passing health checks
# TYPE moneylix_health_checks_passed gauge
moneylix_health_checks_passed{application="moneylix"} $healthy

# HELP moneylix_health_checks_warning Number of warning health checks
# TYPE moneylix_health_checks_warning gauge
moneylix_health_checks_warning{application="moneylix"} $warning

# HELP moneylix_health_checks_critical Number of critical health checks
# TYPE moneylix_health_checks_critical gauge
moneylix_health_checks_critical{application="moneylix"} $critical
EOF
```

## Troubleshooting

### SSL Renewal Issues

**Problem**: "Dry-run test failed"

**Solution**:
```bash
# Check certbot configuration
sudo certbot certificates

# Verify nginx is running
sudo systemctl status nginx

# Test renewal manually
sudo certbot renew --verbose

# Check for port conflicts
sudo lsof -i :80
sudo lsof -i :443
```

### Deployment Failures

**Problem**: "Failed to restart PM2 process"

**Solution**:
```bash
# Check PM2 status
pm2 status

# View PM2 logs
pm2 logs moneylix

# Restart PM2 manually
pm2 stop moneylix
pm2 start app.js --name moneylix

# Check for errors
npm run build 2>&1 | tail -20
```

**Problem**: "Git pull failed"

**Solution**:
```bash
# Check git status
cd /path/to/moneylix
git status

# View git log
git log --oneline -5

# Check remote
git remote -v

# Manually pull to diagnose
git pull origin main
```

### Health Check Issues

**Problem**: "Port 3006 not responding"

**Solution**:
```bash
# Check if process is running
pm2 status

# Check if port is in use
lsof -i :3006
netstat -tuln | grep 3006

# Check application logs
pm2 logs moneylix

# Test directly
curl http://localhost:3006/

# Check firewall
sudo ufw status
sudo iptables -L -n | grep 3006
```

**Problem**: "SSL certificate not found"

**Solution**:
```bash
# List certificates
sudo certbot certificates

# Check certificate path
ls -la /etc/letsencrypt/live/

# Request certificate if missing
sudo certbot certonly --standalone -d moneylix.com
```

## Best Practices

### 1. Run Deployments During Maintenance Windows

```bash
# Schedule deployment for low-traffic hours
bash deploy.sh 2>&1 | tee -a /var/log/moneylix/deployment-$(date +%Y%m%d).log
```

### 2. Always Test SSL Renewal Before Production

```bash
# Test renewal setup
sudo bash setup-ssl-renewal.sh
# Dry-run is automatic, review output carefully
```

### 3. Monitor Health Checks Continuously

```bash
# Run health checks every 5 minutes
*/5 * * * * bash health-check.sh >> /var/log/moneylix/health.log 2>&1
```

### 4. Keep Deployment Logs for Audit Trail

```bash
# View deployment history
ls -lt /var/log/moneylix/deployment-*.log | head -10

# Archive old logs
find /var/log/moneylix -name "deployment-*.log" -mtime +30 -exec gzip {} \;
```

### 5. Set Up Alerts for Critical Issues

```bash
# Email alerts on health check failures
bash health-check.sh --email

# Slack notification
bash health-check.sh --json | curl -X POST -d @- https://hooks.slack.com/...
```

### 6. Regular Backup Before Deployment

```bash
# Backup database before deployment
pg_dump moneylix_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Then deploy
bash deploy.sh
```

### 7. Document Custom Configuration

Create a `.env` file or configuration script:

```bash
# scripts/config.sh
export DOMAIN="moneylix.com"
export EMAIL="ops@moneylix.com"
export PM2_APP_NAME="moneylix"
export APP_PORT="3006"
export GIT_BRANCH="main"
export APP_DIR="/home/deploy/moneylix"
```

Then source it:
```bash
source scripts/config.sh
bash deploy.sh
```

### 8. Test Scripts on Staging First

Always test deployment and renewal scripts on staging before production:

```bash
# Deploy to staging
bash deploy.sh --env=staging

# Test SSL renewal
sudo bash setup-ssl-renewal.sh

# Run comprehensive health checks
bash health-check.sh
```

## Support and Maintenance

### Useful Commands

```bash
# Check all PM2 processes
pm2 status

# View application logs
pm2 logs moneylix --lines 100

# Restart application
pm2 restart moneylix

# Stop application
pm2 stop moneylix

# Delete log files
pm2 flush

# Run health check as JSON
bash health-check.sh --json | jq .
```

### Log Locations

- **SSL Renewal**: `/var/log/moneylix-ssl-renewal.log`
- **Deployment**: `/var/log/moneylix/deployment-*.log`
- **Health Check**: `/var/log/moneylix/health-check-*.log`
- **Application**: PM2 managed, view with `pm2 logs`

### Updating Scripts

To update these scripts, simply replace the files and test thoroughly:

```bash
# Download updated scripts
# ... (obtain updates)

# Make executable
chmod +x *.sh

# Test on staging first
bash health-check.sh

# Then deploy to production
bash deploy.sh
```

---

**Last Updated**: 2026-06-07  
**Version**: 1.0.0  
**Maintained By**: Moneylix DevOps Team
