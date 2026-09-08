#!/bin/bash

################################################################################
# Moneylix Health Check Script
# 
# Purpose: Monitor and report on application and system health
# Features:
#   - Checks PM2 process status
#   - Verifies port 3006 is responding
#   - Displays SSL certificate expiry date
#   - Reports disk space usage
#   - Generates comprehensive health summary
#
# Usage: bash health-check.sh [--json] [--email] [--critical-only]
# 
# Requirements: 
#   - PM2 installed
#   - curl or nc for port checking
#   - openssl for SSL certificate checking
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PM2_APP_NAME="moneylix"
APP_PORT="3006"
APP_HOST="localhost"
DOMAIN="moneylix.in"
SSL_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/cert.pem"
LOG_FILE="/var/log/moneylix/health-check-$(date +%Y%m%d).log"
OUTPUT_JSON="${OUTPUT_JSON:-false}"
CRITICAL_ONLY="${CRITICAL_ONLY:-false}"
EMAIL_ON_ERROR="${EMAIL_ON_ERROR:-false}"
EMAIL_ADDRESS="${EMAIL_ADDRESS:-admin@moneylix.in}"

# Health status counters
HEALTH_OK=0
HEALTH_WARNING=0
HEALTH_ERROR=0

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $*"
}

status_ok() {
    HEALTH_OK=$((HEALTH_OK + 1))
    [ "$OUTPUT_JSON" = "false" ] && log_success "$1"
}

status_warning() {
    HEALTH_WARNING=$((HEALTH_WARNING + 1))
    [ "$OUTPUT_JSON" = "false" ] && log_warning "$1"
}

status_error() {
    HEALTH_ERROR=$((HEALTH_ERROR + 1))
    [ "$OUTPUT_JSON" = "false" ] && log_error "$1"
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --json)
                OUTPUT_JSON="true"
                shift
                ;;
            --critical-only)
                CRITICAL_ONLY="true"
                shift
                ;;
            --email)
                EMAIL_ON_ERROR="true"
                shift
                ;;
            --domain=*)
                DOMAIN="${1#*=}"
                SSL_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/cert.pem"
                shift
                ;;
            --port=*)
                APP_PORT="${1#*=}"
                shift
                ;;
            *)
                log "Unknown argument: $1"
                shift
                ;;
        esac
    done
}

setup_logging() {
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
}

# ============================================================================
# HEALTH CHECK FUNCTIONS
# ============================================================================

check_pm2_process() {
    local check_name="PM2 Process Status"
    
    if ! command -v pm2 &> /dev/null; then
        status_error "$check_name: PM2 not installed"
        return 1
    fi
    
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        local pm2_status=$(pm2 list | grep "$PM2_APP_NAME" | awk '{print $11}')
        
        if [ "$pm2_status" = "online" ]; then
            local uptime=$(pm2 show "$PM2_APP_NAME" 2>/dev/null | grep "uptime" | awk -F: '{print $2}' | xargs)
            status_ok "$check_name: Running (uptime: $uptime)"
            return 0
        elif [ "$pm2_status" = "stopped" ]; then
            status_error "$check_name: Process is STOPPED"
            return 1
        else
            status_warning "$check_name: Status is $pm2_status"
            return 2
        fi
    else
        status_error "$check_name: Application '$PM2_APP_NAME' not found in PM2"
        return 1
    fi
}

check_port_response() {
    local check_name="Port $APP_PORT Response"
    local timeout=5
    
    # Try with curl first
    if command -v curl &> /dev/null; then
        if curl -s --max-time $timeout http://$APP_HOST:$APP_PORT/ &> /dev/null; then
            status_ok "$check_name: Port is responding"
            return 0
        fi
    fi
    
    # Try with nc (netcat)
    if command -v nc &> /dev/null; then
        if nc -z -w $timeout $APP_HOST $APP_PORT &> /dev/null; then
            status_ok "$check_name: Port is open"
            return 0
        fi
    fi
    
    # Try with bash TCP redirection
    if bash -c "echo >/dev/tcp/$APP_HOST/$APP_PORT" 2>/dev/null; then
        status_ok "$check_name: Port is responding"
        return 0
    fi
    
    status_error "$check_name: Port is not responding"
    return 1
}

check_ssl_certificate() {
    local check_name="SSL Certificate"
    
    if [ ! -f "$SSL_CERT_PATH" ]; then
        status_warning "$check_name: Certificate not found at $SSL_CERT_PATH"
        return 1
    fi
    
    # Get expiry date
    local expiry_date=$(openssl x509 -enddate -noout -in "$SSL_CERT_PATH" 2>/dev/null | cut -d= -f2)
    
    if [ -z "$expiry_date" ]; then
        status_error "$check_name: Could not read certificate"
        return 1
    fi
    
    # Calculate days until expiry
    local cert_expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -f - +%s <<<"$expiry_date")
    local current_epoch=$(date +%s)
    local days_left=$(( (cert_expiry_epoch - current_epoch) / 86400 ))
    
    if [ "$days_left" -lt 0 ]; then
        status_error "$check_name: EXPIRED (expired $((-days_left)) days ago)"
        return 1
    elif [ "$days_left" -lt 7 ]; then
        status_error "$check_name: Expires in $days_left days (URGENT RENEWAL)"
        return 1
    elif [ "$days_left" -lt 30 ]; then
        status_warning "$check_name: Expires in $days_left days (renewal recommended)"
        return 2
    else
        status_ok "$check_name: Valid for $days_left days (expires: $expiry_date)"
        return 0
    fi
}

check_disk_space() {
    local check_name="Disk Space"
    
    # Get root filesystem usage
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    local disk_threshold=80
    local critical_threshold=90
    
    if [ "$disk_usage" -ge "$critical_threshold" ]; then
        status_error "$check_name: CRITICAL - $disk_usage% used"
        return 1
    elif [ "$disk_usage" -ge "$disk_threshold" ]; then
        status_warning "$check_name: $disk_usage% used (threshold: ${disk_threshold}%)"
        return 2
    else
        status_ok "$check_name: $disk_usage% used"
        return 0
    fi
}

check_memory_usage() {
    local check_name="Memory Usage"
    
    if ! command -v free &> /dev/null; then
        status_warning "$check_name: Cannot check (free command not available)"
        return 2
    fi
    
    local memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
    local memory_threshold=80
    local critical_threshold=90
    
    if [ "$memory_usage" -ge "$critical_threshold" ]; then
        status_error "$check_name: CRITICAL - $memory_usage% used"
        return 1
    elif [ "$memory_usage" -ge "$memory_threshold" ]; then
        status_warning "$check_name: $memory_usage% used (threshold: ${memory_threshold}%)"
        return 2
    else
        status_ok "$check_name: $memory_usage% used"
        return 0
    fi
}

check_application_logs() {
    local check_name="Application Logs"
    
    if ! command -v pm2 &> /dev/null; then
        return 0
    fi
    
    # Check for recent errors in PM2 logs
    local recent_errors=$(pm2 logs "$PM2_APP_NAME" --lines 20 --nostream 2>/dev/null | grep -i error | wc -l)
    
    if [ "$recent_errors" -gt 5 ]; then
        status_warning "$check_name: $recent_errors errors detected in recent logs"
        return 2
    elif [ "$recent_errors" -gt 0 ]; then
        status_warning "$check_name: $recent_errors minor errors in recent logs"
        return 2
    else
        status_ok "$check_name: No recent errors detected"
        return 0
    fi
}

check_system_resources() {
    local check_name="System Load"
    
    local load_avg=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}')
    local cpu_count=$(nproc 2>/dev/null || echo "1")
    
    if [ -z "$load_avg" ]; then
        status_warning "$check_name: Could not determine load average"
        return 2
    fi
    
    # Convert to percentage (load / cpu_count)
    local load_percent=$(awk -v load="$load_avg" -v cpus="$cpu_count" 'BEGIN {printf("%.0f", (load/cpus)*100)}')
    
    if [ "$load_percent" -ge 80 ]; then
        status_warning "$check_name: High load ($load_avg on $cpu_count CPUs)"
        return 2
    else
        status_ok "$check_name: Normal ($load_avg on $cpu_count CPUs)"
        return 0
    fi
}

# ============================================================================
# REPORTING FUNCTIONS
# ============================================================================

generate_json_report() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local overall_status="healthy"
    
    if [ $HEALTH_ERROR -gt 0 ]; then
        overall_status="critical"
    elif [ $HEALTH_WARNING -gt 0 ]; then
        overall_status="warning"
    fi
    
    cat << EOF
{
  "timestamp": "$timestamp",
  "application": "$PM2_APP_NAME",
  "status": "$overall_status",
  "summary": {
    "healthy": $HEALTH_OK,
    "warning": $HEALTH_WARNING,
    "critical": $HEALTH_ERROR
  },
  "domain": "$DOMAIN",
  "port": $APP_PORT,
  "ssl_cert_path": "$SSL_CERT_PATH",
  "log_file": "$LOG_FILE"
}
EOF
}

generate_text_report() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         Moneylix Application Health Check Report          ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Application: $PM2_APP_NAME"
    echo "Domain: $DOMAIN"
    echo "Port: $APP_PORT"
    echo ""
    
    # Summary box
    echo -e "${CYAN}Health Summary:${NC}"
    echo "  ✓ Healthy:  $HEALTH_OK"
    echo "  ! Warning:  $HEALTH_WARNING"
    echo "  ✗ Critical: $HEALTH_ERROR"
    echo ""
    
    # Overall status
    if [ $HEALTH_ERROR -gt 0 ]; then
        echo -e "${RED}Overall Status: CRITICAL${NC}"
        echo "Action Required: Please address critical issues immediately"
    elif [ $HEALTH_WARNING -gt 0 ]; then
        echo -e "${YELLOW}Overall Status: WARNING${NC}"
        echo "Action Recommended: Monitor and address warnings"
    else
        echo -e "${GREEN}Overall Status: HEALTHY${NC}"
        echo "All systems operational"
    fi
    echo ""
}

send_email_report() {
    if [ "$EMAIL_ON_ERROR" != "true" ] || [ $HEALTH_ERROR -eq 0 ]; then
        return 0
    fi
    
    if ! command -v mail &> /dev/null; then
        log_warning "Mail command not available, cannot send email"
        return 1
    fi
    
    local subject="[CRITICAL] Moneylix Health Check Alert - $PM2_APP_NAME"
    local body="Health check detected $HEALTH_ERROR critical issue(s).
    
Application: $PM2_APP_NAME
Domain: $DOMAIN
Port: $APP_PORT
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')

Please investigate and take corrective action.

Log file: $LOG_FILE"
    
    echo "$body" | mail -s "$subject" "$EMAIL_ADDRESS"
    
    log "Health check alert email sent to $EMAIL_ADDRESS"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    if [ "$OUTPUT_JSON" = "false" ]; then
        echo ""
        log "Starting Moneylix health check..."
    fi
    
    # Setup
    parse_arguments "$@"
    setup_logging
    
    # Run health checks (each may return non-zero on warning/error;
    # `|| true` keeps the script running under `set -e` so every
    # check executes and the summary reflects all of them)
    check_pm2_process || true
    check_port_response || true
    check_ssl_certificate || true
    check_disk_space || true
    check_memory_usage || true
    check_application_logs || true
    check_system_resources || true
    
    # Generate output
    if [ "$OUTPUT_JSON" = "true" ]; then
        generate_json_report
    else
        generate_text_report
        
        # Suggested actions based on status
        if [ $HEALTH_ERROR -gt 0 ]; then
            echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${RED}RECOMMENDED ACTIONS:${NC}"
            echo ""
            
            # Check which items failed and suggest actions
            pm2 list 2>/dev/null | grep -q "$PM2_APP_NAME" || \
                echo "  1. Start PM2 application: pm2 start app.js --name $PM2_APP_NAME"
            
            ssl_check=$(check_ssl_certificate 2>&1) || \
                echo "  2. Renew SSL certificate: sudo certbot renew"
            
            disk_check=$(df / | awk 'NR==2 {print $5}' | sed 's/%//') && \
                [ "$disk_check" -gt 90 ] && \
                echo "  3. Cleanup disk space: df -h && du -sh /*"
            
            echo ""
        fi
        
        echo "Log file: $LOG_FILE"
        echo ""
    fi
    
    # Send email if configured
    send_email_report
    
    # Exit with appropriate code
    if [ $HEALTH_ERROR -gt 0 ]; then
        exit 1
    elif [ $HEALTH_WARNING -gt 0 ]; then
        exit 2
    else
        exit 0
    fi
}

# Run main function
main "$@"
