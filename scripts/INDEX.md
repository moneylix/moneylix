# Moneylix Scripts - Complete Index

**Created**: 2026-06-07  
**Project**: Moneylix  
**Location**: `D:\Projects\Money\scripts\`

---

## 📑 Quick Navigation

### 🚀 Getting Started (Start Here!)
1. **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute quick start guide
2. **[INSTALLATION_GUIDE.md](../INSTALLATION_GUIDE.md)** - Complete installation & setup
3. **[README.md](./README.md)** - Full feature documentation

### 📋 The Three Scripts

| Script | Purpose | Documentation |
|--------|---------|---|
| **[setup-ssl-renewal.sh](./setup-ssl-renewal.sh)** | SSL certificate auto-renewal | [SSL Section](./README.md#script-setup-ssl-renewalsh) |
| **[deploy.sh](./deploy.sh)** | Application deployment | [Deploy Section](./README.md#script-deploysh) |
| **[health-check.sh](./health-check.sh)** | Health monitoring | [Health Section](./README.md#script-health-checksh) |

### 📖 Documentation Files

| File | Size | Purpose | Target Reader |
|------|------|---------|---|
| **README.md** | 17.9 KB | Complete documentation | Administrators |
| **QUICKSTART.md** | 9.0 KB | Quick reference | New users |
| **INDEX.md** | This file | Navigation guide | Everyone |

---

## 🎯 Choose Your Path

### Path 1: First Time Setup (Recommended)
```
1. Read this file (INDEX.md)
   ↓
2. Read QUICKSTART.md (5 min)
   ↓
3. Follow INSTALLATION_GUIDE.md
   ↓
4. Run: bash health-check.sh
   ↓
5. Test each script
```

### Path 2: Quick Reference
```
Need to know: QUICKSTART.md → Copy command → Run it
```

### Path 3: Deep Learning
```
1. Read QUICKSTART.md for overview
   ↓
2. Read README.md for details
   ↓
3. Read script comments for implementation
   ↓
4. Experiment with each script
```

### Path 4: Troubleshooting
```
1. Run: bash health-check.sh
   ↓
2. Check README.md Troubleshooting section
   ↓
3. Review log files
   ↓
4. Search script comments
```

---

## 📊 File Overview

### Executable Scripts (3 files, ~1,140 lines)

#### 1. setup-ssl-renewal.sh (9.8 KB)
```bash
# SSL Certificate Auto-Renewal

Usage:
  sudo bash setup-ssl-renewal.sh

Features:
  ✓ Validates certbot installation
  ✓ Performs dry-run test
  ✓ Sets up monthly cron job
  ✓ Manages log rotation
  ✓ Displays renewal status

Key Points:
  • Requires sudo privileges
  • Runs monthly automatically
  • No manual renewal needed
  • Safe testing before production
```

[Full Documentation →](./README.md#script-setup-ssl-renewalsh)

#### 2. deploy.sh (13.3 KB)
```bash
# Application Deployment Automation

Usage:
  bash deploy.sh [options]

Options:
  --env=staging          Deploy to staging
  --branch=develop       Deploy specific branch
  --skip-build          Skip build step

Features:
  ✓ Git pull latest code
  ✓ Clean npm install
  ✓ Build application
  ✓ Restart PM2 process
  ✓ Verify deployment
  ✓ Rollback instructions

Key Points:
  • Automated deployment pipeline
  • Error handling at each step
  • Deployment logging
  • Rollback on failure
```

[Full Documentation →](./README.md#script-deploysh)

#### 3. health-check.sh (13.6 KB)
```bash
# System & Application Health Monitoring

Usage:
  bash health-check.sh [options]

Options:
  --json               JSON output
  --critical-only      Critical issues only
  --email             Send alerts
  --domain=custom.com  Custom domain

Features:
  ✓ PM2 process status
  ✓ Port connectivity
  ✓ SSL certificate validity
  ✓ Disk space usage
  ✓ Memory usage
  ✓ Application logs
  ✓ System load

Key Points:
  • Run frequently (every 5-15 min)
  • JSON for integration
  • Email alerts on critical
  • Exit codes for automation
```

[Full Documentation →](./README.md#script-health-checksh)

---

## 📚 Documentation Files

### QUICKSTART.md (9.0 KB)
**Best for**: Getting started quickly

Contains:
- 5-minute setup guide
- Common workflows
- One-liner examples
- Quick troubleshooting
- Learning path

→ [Read QUICKSTART.md](./QUICKSTART.md)

### README.md (17.9 KB)
**Best for**: Comprehensive learning

Contains:
- Complete feature documentation
- Setup instructions
- Configuration options
- Usage examples
- CI/CD integration
- Troubleshooting guide
- Best practices

→ [Read README.md](./README.md)

### INSTALLATION_GUIDE.md (14.5 KB)
**Best for**: Step-by-step installation

Contains:
- Installation checklist
- Configuration guide
- First run commands
- Troubleshooting
- Monitoring setup
- Learning path

→ [Read INSTALLATION_GUIDE.md](../INSTALLATION_GUIDE.md)

---

## 🚀 Command Quick Reference

### Most Common Commands

```bash
# Check system health
bash health-check.sh

# Deploy application
bash deploy.sh

# Setup SSL renewal
sudo bash setup-ssl-renewal.sh

# Get JSON status
bash health-check.sh --json

# Deploy to staging
bash deploy.sh --env=staging

# Deploy without building
bash deploy.sh --skip-build

# Test with critical-only
bash health-check.sh --critical-only
```

### Setup Commands

```bash
# Make scripts executable
chmod +x setup-ssl-renewal.sh deploy.sh health-check.sh

# Check bash syntax
bash -n setup-ssl-renewal.sh
bash -n deploy.sh
bash -n health-check.sh

# View script contents
cat setup-ssl-renewal.sh | head -50
```

### Monitoring Commands

```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs moneylix

# Show application details
pm2 show moneylix

# Check SSL certificates
certbot certificates

# View cron jobs
crontab -l

# Check disk usage
df -h

# Check memory
free -h
```

---

## 🎓 Learning Resources

### For Beginners
1. Start with **QUICKSTART.md** (5 minutes)
2. Run **health-check.sh** to test
3. Read relevant sections of **README.md**
4. Try each script individually

### For Intermediate Users
1. Review **README.md** thoroughly
2. Configure environment variables
3. Setup automated monitoring
4. Integrate with CI/CD systems

### For Advanced Users
1. Study script implementations
2. Customize for your environment
3. Integrate with monitoring systems
4. Create custom workflows

---

## 🔧 Configuration

### Default Configuration
```bash
DOMAIN="moneylix.com"
EMAIL="admin@moneylix.com"
APP_PORT="3006"
PM2_APP_NAME="moneylix"
GIT_BRANCH="main"
ENVIRONMENT="production"
```

### Customize Via Environment Variables
```bash
export DOMAIN="yourdomain.com"
export EMAIL="ops@yourdomain.com"
bash setup-ssl-renewal.sh
```

### Customize Via Config File
```bash
# Create scripts/config.sh with your settings
source scripts/config.sh
bash deploy.sh
```

See [README.md Configuration Section](./README.md#configuration) for details.

---

## 📋 Common Workflows

### Daily Operations
```bash
# Morning health check
bash health-check.sh

# Deploy updates
bash deploy.sh

# Verify post-deployment
bash health-check.sh
```

### Weekly Review
```bash
# Check recent deployments
ls -lt /var/log/moneylix/deployment-*.log | head -5

# Review health trends
grep "Overall Status" /var/log/moneylix/health-check*.log

# Check SSL status
certbot certificates
```

### Monthly Maintenance
```bash
# Verify SSL renewal cron
crontab -l | grep certbot

# Archive old logs
tar -czf logs-archive.tar.gz /var/log/moneylix/*.log

# Clean up old deployments
find /var/log/moneylix -name "deployment-*.log" -mtime +30 -delete
```

See [README.md Common Workflows](./README.md#common-usage-patterns) for more.

---

## 🐛 Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Scripts won't run | [Make Executable](./QUICKSTART.md#issue-permission-denied-when-running-script) |
| Command not found | [Install Prerequisites](./INSTALLATION_GUIDE.md#1-prerequisites-installation) |
| Deployment fails | [Deployment Troubleshooting](./README.md#troubleshooting) |
| Health check errors | [Health Check Help](./README.md#troubleshooting-health-check-issues) |
| SSL issues | [SSL Troubleshooting](./README.md#troubleshooting-ssl-renewal-issues) |

---

## 📞 Help & Support

### Documentation
- **Overview**: This file (INDEX.md)
- **Quick Help**: [QUICKSTART.md](./QUICKSTART.md)
- **Full Docs**: [README.md](./README.md)
- **Setup Help**: [INSTALLATION_GUIDE.md](../INSTALLATION_GUIDE.md)

### Logs & Status
- **SSL Logs**: `/var/log/moneylix-ssl-renewal.log`
- **Deploy Logs**: `/var/log/moneylix/deployment-*.log`
- **Health Logs**: `/var/log/moneylix/health-check-*.log`
- **App Logs**: `pm2 logs moneylix`

### Commands
```bash
# Quick status check
bash health-check.sh

# Verify prerequisites
bash verify-setup.sh

# Manual SSL renewal
sudo certbot renew --verbose

# Check all logs
ls -la /var/log/moneylix/
```

---

## ✨ Features Summary

### 🔐 SSL Management (setup-ssl-renewal.sh)
- ✅ Automatic certificate renewal
- ✅ Monthly scheduled execution
- ✅ Pre-production dry-run testing
- ✅ Automatic nginx reload
- ✅ Log rotation configured
- ✅ Status monitoring
- ✅ Expiry date tracking

### 🚀 Deployment (deploy.sh)
- ✅ Automated code deployment
- ✅ Dependency management (npm ci)
- ✅ Application building
- ✅ Process restart (PM2)
- ✅ Verification after deployment
- ✅ Rollback instructions
- ✅ Comprehensive logging
- ✅ Multi-environment support

### 🏥 Health Monitoring (health-check.sh)
- ✅ PM2 process monitoring
- ✅ Port connectivity checks
- ✅ SSL certificate validation
- ✅ Disk space monitoring
- ✅ Memory usage tracking
- ✅ Application log analysis
- ✅ System load monitoring
- ✅ JSON output support
- ✅ Email alerts on critical
- ✅ Exit codes for automation

---

## 🎯 Next Steps

### If you're NEW:
1. Read **QUICKSTART.md** (5 min)
2. Run **health-check.sh** (1 min)
3. Follow **INSTALLATION_GUIDE.md** (10 min)

### If you're EXPERIENCED:
1. Read **README.md** relevant section
2. Configure for your environment
3. Run the script

### If you have ISSUES:
1. Run **health-check.sh** for diagnostics
2. Check **README.md** troubleshooting
3. Review log files
4. Try manual commands

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 1,138 |
| Total Documentation Lines | 1,070 |
| Total Files | 8 |
| Scripts | 3 |
| Documentation Files | 5 |
| Total Size | ~63 KB |
| Estimated Setup Time | 30 minutes |
| Maintenance Per Month | 15 minutes |

---

## ✅ Quality Assurance

All scripts include:
- ✅ Professional bash shebang
- ✅ Comprehensive error handling
- ✅ Detailed logging with timestamps
- ✅ Color-coded output
- ✅ Status reporting
- ✅ Configuration flexibility
- ✅ Multiple output formats
- ✅ Inline documentation

---

## 📝 Version Information

- **Version**: 1.0.0
- **Created**: 2026-06-07
- **Status**: Production Ready
- **Maintenance**: Stable

---

## 🗺️ File Map

```
D:\Projects\Money\scripts\
├── INDEX.md                    ← You are here
├── README.md                   ← Full documentation
├── QUICKSTART.md              ← Quick start guide
├── setup-ssl-renewal.sh       ← SSL renewal script
├── deploy.sh                  ← Deployment script
└── health-check.sh            ← Health monitoring script

Plus in workspace/artifacts/:
├── MONEYLIX_SCRIPTS_SUMMARY.md
└── INSTALLATION_GUIDE.md
```

---

## 🎓 Quick Tutorial

### 1. Setup (5 minutes)
```bash
cd D:\Projects\Money\scripts
chmod +x *.sh
bash health-check.sh
```

### 2. Read (10 minutes)
```bash
cat QUICKSTART.md
```

### 3. Configure (5 minutes)
```bash
# Edit scripts or set environment variables
export DOMAIN="yourdomain.com"
```

### 4. Deploy (5 minutes)
```bash
bash deploy.sh --skip-build
```

### 5. Monitor (ongoing)
```bash
bash health-check.sh
```

---

**Ready to get started? →** [Read QUICKSTART.md](./QUICKSTART.md)

**Need detailed help? →** [Read README.md](./README.md)

**Want to install? →** [Read INSTALLATION_GUIDE.md](../INSTALLATION_GUIDE.md)

---

**Created**: 2026-06-07 | **Version**: 1.0.0 | **Status**: ✅ Production Ready
