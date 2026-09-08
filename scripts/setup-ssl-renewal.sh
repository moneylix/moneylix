#!/bin/bash

################################################################################
# SSL Auto-Renewal Setup Script for Moneylix
# 
# Purpose: Configure automatic SSL certificate renewal using Let's Encrypt
# Features:
#   - Validates certbot installation
#   - Performs dry-run test before enabling renewal
#   - Sets up cron job for monthly renewal
#   - Provides renewal status and next renewal date
#
# Usage: sudo bash setup-ssl-renewal.sh
# 
# Requirements: Root privileges, certbot installed (will prompt if missing)
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-moneylix.in}"
EMAIL="${EMAIL:-admin@moneylix.in}"
RENEWAL_MONTH="0"  # 0 = monthly via cron
CRON_SCHEDULE="0 2 1 * *"  # 2 AM on the 1st of each month
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/cert.pem"
LOG_FILE="/var/log/moneylix-ssl-renewal.log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $*" | tee -a "$LOG_FILE"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use: sudo bash setup-ssl-renewal.sh)"
        exit 1
    fi
}

check_certbot() {
    log "Checking if certbot is installed..."
    
    if ! command -v certbot &> /dev/null; then
        log_error "certbot is not installed"
        log "Attempting to install certbot..."
        
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y certbot python3-certbot-nginx
            log_success "certbot installed via apt"
        elif command -v yum &> /dev/null; then
            yum install -y certbot python3-certbot-nginx
            log_success "certbot installed via yum"
        else
            log_error "Could not detect package manager. Please install certbot manually."
            exit 1
        fi
    else
        CERTBOT_VERSION=$(certbot --version)
        log_success "certbot is installed: $CERTBOT_VERSION"
    fi
}

check_nginx() {
    log "Checking if nginx is installed..."
    
    if ! command -v nginx &> /dev/null; then
        log_warning "nginx is not installed. SSL renewal will still work but nginx plugin won't be available."
        return 1
    else
        log_success "nginx is installed"
        return 0
    fi
}

check_certificate_exists() {
    log "Checking if SSL certificate already exists..."
    
    if [ -f "$CERT_PATH" ]; then
        log_success "Certificate found at $CERT_PATH"
        
        # Display expiry date
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
        log "Certificate expires on: $EXPIRY_DATE"
        
        # Calculate days until expiry
        CERT_EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (CERT_EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
        
        if [ "$DAYS_LEFT" -lt 0 ]; then
            log_error "Certificate has expired! Days left: $DAYS_LEFT"
            return 1
        elif [ "$DAYS_LEFT" -lt 30 ]; then
            log_warning "Certificate expires in $DAYS_LEFT days (renewal recommended)"
        else
            log_success "Certificate is valid for $DAYS_LEFT more days"
        fi
        
        return 0
    else
        log_warning "Certificate not found at $CERT_PATH"
        return 1
    fi
}

test_renewal_dryrun() {
    log ""
    log "=========================================="
    log "Testing renewal with --dry-run..."
    log "=========================================="
    
    if check_nginx; then
        if certbot renew --dry-run --nginx --quiet 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Dry-run test passed! Renewal process is configured correctly."
            return 0
        else
            log_error "Dry-run test failed. Check logs above for details."
            return 1
        fi
    else
        if certbot renew --dry-run --standalone --quiet 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Dry-run test passed (standalone mode)!"
            return 0
        else
            log_error "Dry-run test failed. Check logs above for details."
            return 1
        fi
    fi
}

setup_cron_job() {
    log ""
    log "=========================================="
    log "Setting up cron job for auto-renewal..."
    log "=========================================="
    
    CRON_COMMAND="0 2 1 * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx' >> $LOG_FILE 2>&1"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "certbot renew"; then
        log_warning "Cron job for certbot already exists. Updating..."
        (crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_COMMAND") | crontab -
    else
        log "Adding new cron job..."
        (crontab -l 2>/dev/null || echo ""; echo "$CRON_COMMAND") | crontab -
    fi
    
    log_success "Cron job configured"
    log "Schedule: $CRON_SCHEDULE (1st of each month at 2 AM UTC)"
    log "Command: certbot renew --quiet --post-hook 'systemctl reload nginx'"
    
    # Verify cron job
    if crontab -l 2>/dev/null | grep -q "certbot renew"; then
        log_success "Cron job verified successfully"
        return 0
    else
        log_error "Failed to set cron job"
        return 1
    fi
}

get_renewal_status() {
    log ""
    log "=========================================="
    log "SSL Renewal Status Summary"
    log "=========================================="
    
    # Get next renewal date
    if [ -f "$CERT_PATH" ]; then
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
        RENEWAL_DATE=$(date -d "$EXPIRY_DATE - 30 days" +'%Y-%m-%d %H:%M:%S')
        
        log_success "Domain: $DOMAIN"
        log_success "Certificate expiry: $EXPIRY_DATE"
        log_success "Scheduled renewal date: $RENEWAL_DATE"
        log_success "Auto-renewal: ENABLED"
    else
        log_warning "Certificate not found. Auto-renewal configured but no certificate detected."
    fi
    
    # Show cron job
    log ""
    log "Cron job configuration:"
    crontab -l 2>/dev/null | grep "certbot" || log_warning "No certbot cron job found"
    
    # Show recent renewal logs
    log ""
    log "Recent renewal attempts (last 5):"
    if [ -f "$LOG_FILE" ]; then
        tail -n 5 "$LOG_FILE" || log_warning "No renewal logs yet"
    else
        log_warning "No renewal logs found"
    fi
}

cleanup_logs() {
    log ""
    log "Setting up log rotation for renewal logs..."
    
    # Create logrotate config if it doesn't exist
    if [ ! -f "/etc/logrotate.d/moneylix-ssl-renewal" ]; then
        cat > /etc/logrotate.d/moneylix-ssl-renewal << 'EOF'
/var/log/moneylix-ssl-renewal.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
EOF
        log_success "Log rotation configured at /etc/logrotate.d/moneylix-ssl-renewal"
    else
        log_success "Log rotation already configured"
    fi
}

main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Moneylix SSL Auto-Renewal Setup Script                  ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    # Run checks
    check_root
    check_certbot
    check_nginx || log_warning "Continuing without nginx plugin..."
    check_certificate_exists || log_warning "Continuing setup anyway..."
    
    # Test renewal
    if ! test_renewal_dryrun; then
        log_error "Dry-run failed. Please fix any issues and run this script again."
        exit 1
    fi
    
    # Setup cron
    if ! setup_cron_job; then
        log_error "Failed to setup cron job"
        exit 1
    fi
    
    # Setup log rotation
    cleanup_logs
    
    # Display final status
    get_renewal_status
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       SSL Auto-Renewal Setup Complete!                       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_success "All configurations completed successfully"
    echo ""
    echo "Next steps:"
    echo "  • Monitor renewal logs: tail -f $LOG_FILE"
    echo "  • Manual renewal (if needed): sudo certbot renew"
    echo "  • Certificate status: certbot certificates"
    echo ""
}

# Run main function
main "$@"
