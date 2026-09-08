#!/bin/bash

################################################################################
# Moneylix Deployment Script
# 
# Purpose: Automated deployment of Moneylix application
# Features:
#   - Pulls latest code from git repository
#   - Installs dependencies with npm ci
#   - Builds application
#   - Restarts PM2 process
#   - Provides deployment status with timestamp
#   - Includes rollback instructions
#
# Usage: bash deploy.sh [--env=production|staging] [--skip-build]
# 
# Requirements: 
#   - Git installed and configured
#   - Node.js and npm installed
#   - PM2 installed and configured
#   - Application directory properly configured
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
ENVIRONMENT="${ENVIRONMENT:-production}"
SKIP_BUILD="${SKIP_BUILD:-false}"
APP_DIR="${APP_DIR:-.}"
PM2_APP_NAME="moneylix"
GIT_BRANCH="${GIT_BRANCH:-main}"
LOG_DIR="/var/log/moneylix"
LOG_FILE="$LOG_DIR/deployment-$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="$APP_DIR/.backups"
DEPLOYMENT_STATE="$BACKUP_DIR/last-deployment.state"

# Deployment tracking
DEPLOYMENT_ID="$(date +%s)"
DEPLOYMENT_START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

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

log_info() {
    echo -e "${CYAN}[ℹ]${NC} $*" | tee -a "$LOG_FILE"
}

cleanup_and_exit() {
    local exit_code=$1
    local message="${2:-Deployment terminated}"
    
    log_error "$message (Exit code: $exit_code)"
    
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo -e "${YELLOW}════════════════════════════════════════════${NC}"
        echo -e "${YELLOW}           ROLLBACK INSTRUCTIONS            ${NC}"
        echo -e "${YELLOW}════════════════════════════════════════════${NC}"
        show_rollback_instructions
    fi
    
    exit $exit_code
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env=*)
                ENVIRONMENT="${1#*=}"
                shift
                ;;
            --skip-build)
                SKIP_BUILD="true"
                shift
                ;;
            --branch=*)
                GIT_BRANCH="${1#*=}"
                shift
                ;;
            *)
                log_warning "Unknown argument: $1"
                shift
                ;;
        esac
    done
}

setup_logging() {
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    touch "$LOG_FILE"
    
    log_success "Logging initialized to: $LOG_FILE"
}

check_prerequisites() {
    log ""
    log "Checking prerequisites..."
    
    local missing_tools=0
    
    # Check git
    if ! command -v git &> /dev/null; then
        log_error "git is not installed"
        missing_tools=$((missing_tools + 1))
    else
        log_success "git is installed: $(git --version)"
    fi
    
    # Check node
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        missing_tools=$((missing_tools + 1))
    else
        log_success "Node.js is installed: $(node --version)"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        missing_tools=$((missing_tools + 1))
    else
        log_success "npm is installed: $(npm --version)"
    fi
    
    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 is not installed"
        missing_tools=$((missing_tools + 1))
    else
        log_success "PM2 is installed: $(pm2 --version)"
    fi
    
    # Check git repository
    if ! [ -d "$APP_DIR/.git" ]; then
        log_error "Not a git repository: $APP_DIR"
        missing_tools=$((missing_tools + 1))
    else
        log_success "Git repository detected"
    fi
    
    if [ $missing_tools -gt 0 ]; then
        cleanup_and_exit 1 "Missing $missing_tools required tool(s)"
    fi
}

save_deployment_state() {
    local git_hash=$(cd "$APP_DIR" && git rev-parse HEAD)
    local git_branch=$(cd "$APP_DIR" && git rev-parse --abbrev-ref HEAD)
    
    cat > "$DEPLOYMENT_STATE" << EOF
DEPLOYMENT_ID=$DEPLOYMENT_ID
DEPLOYMENT_TIME=$DEPLOYMENT_START_TIME
GIT_HASH=$git_hash
GIT_BRANCH=$git_branch
ENVIRONMENT=$ENVIRONMENT
APP_DIR=$APP_DIR
EOF
    
    log_success "Deployment state saved"
}

git_pull() {
    log ""
    log "=========================================="
    log "Step 1: Fetching latest code from git"
    log "=========================================="
    
    cd "$APP_DIR" || cleanup_and_exit 1 "Cannot change to app directory"
    
    log "Current branch: $(git rev-parse --abbrev-ref HEAD)"
    log "Current commit: $(git rev-parse --short HEAD)"
    
    # Fetch latest
    if ! git fetch origin "$GIT_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
        cleanup_and_exit 1 "Failed to fetch from git"
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_warning "Uncommitted changes detected:"
        git status --short | tee -a "$LOG_FILE"
        log_warning "Stashing changes before pull..."
        git stash 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Pull latest
    if ! git pull origin "$GIT_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
        cleanup_and_exit 1 "Failed to pull from git"
    fi
    
    NEW_COMMIT=$(git rev-parse --short HEAD)
    log_success "Git pull completed. New commit: $NEW_COMMIT"
}

install_dependencies() {
    log ""
    log "=========================================="
    log "Step 2: Installing dependencies"
    log "=========================================="
    
    cd "$APP_DIR" || cleanup_and_exit 1 "Cannot change to app directory"
    
    if [ ! -f "package.json" ]; then
        cleanup_and_exit 1 "package.json not found in $APP_DIR"
    fi
    
    log "Using npm ci (clean install)..."
    
    if ! npm ci 2>&1 | tee -a "$LOG_FILE"; then
        cleanup_and_exit 1 "Failed to install dependencies"
    fi
    
    log_success "Dependencies installed successfully"
    log_info "Installed packages: $(npm list --depth=0 2>/dev/null | wc -l) total"
}

build_application() {
    log ""
    log "=========================================="
    log "Step 3: Building application"
    log "=========================================="
    
    cd "$APP_DIR" || cleanup_and_exit 1 "Cannot change to app directory"
    
    if [ "$SKIP_BUILD" == "true" ]; then
        log_warning "Skipping build (--skip-build flag set)"
        return 0
    fi
    
    if ! grep -q '"build"' package.json; then
        log_warning "No build script found in package.json, skipping..."
        return 0
    fi
    
    log "Running: npm run build"
    
    # Build with environment variable
    if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
        cleanup_and_exit 1 "Build failed"
    fi
    
    log_success "Build completed successfully"
    
    # Check build output
    if [ -d "dist" ] || [ -d "build" ]; then
        BUILD_DIR=$([ -d "dist" ] && echo "dist" || echo "build")
        BUILD_SIZE=$(du -sh "$BUILD_DIR" 2>/dev/null | awk '{print $1}')
        log_success "Build output size: $BUILD_SIZE"
    fi
}

stop_pm2() {
    log ""
    log "Stopping PM2 process..."
    
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        if ! pm2 stop "$PM2_APP_NAME" 2>&1 | tee -a "$LOG_FILE"; then
            log_warning "Could not stop PM2 process (it may not exist)"
        else
            log_success "PM2 process stopped"
            sleep 2  # Give process time to fully stop
        fi
    else
        log_warning "PM2 process '$PM2_APP_NAME' not running"
    fi
}

restart_pm2() {
    log ""
    log "=========================================="
    log "Step 4: Restarting PM2 process"
    log "=========================================="
    
    cd "$APP_DIR" || cleanup_and_exit 1 "Cannot change to app directory"
    
    # Check if app is configured in PM2
    if ! pm2 list | grep -q "$PM2_APP_NAME"; then
        log_warning "PM2 app '$PM2_APP_NAME' not found. Please configure it with PM2 first."
        log_info "You can do this with: pm2 start app.js --name $PM2_APP_NAME"
        cleanup_and_exit 1 "PM2 app not configured"
    fi
    
    log "Restarting PM2 app: $PM2_APP_NAME"
    
    if ! pm2 restart "$PM2_APP_NAME" 2>&1 | tee -a "$LOG_FILE"; then
        cleanup_and_exit 1 "Failed to restart PM2 process"
    fi
    
    sleep 3  # Wait for process to start
    
    # Verify process is running
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        log_success "PM2 process restarted and is online"
        pm2 show "$PM2_APP_NAME" 2>&1 | tee -a "$LOG_FILE"
    else
        cleanup_and_exit 1 "PM2 process is not running after restart"
    fi
}

verify_deployment() {
    log ""
    log "=========================================="
    log "Step 5: Verifying deployment"
    log "=========================================="
    
    # Check PM2 status
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        log_success "Application is running in PM2"
    else
        log_error "Application is not running in PM2"
        return 1
    fi
    
    # Check port (assuming default 3006)
    if lsof -i :3006 &> /dev/null || netstat -tuln 2>/dev/null | grep -q :3006; then
        log_success "Port 3006 is listening"
    else
        log_warning "Port 3006 is not responding yet (startup may be in progress)"
    fi
    
    # Check for errors in logs
    if pm2 logs "$PM2_APP_NAME" --lines 5 2>&1 | grep -i error | tail -n 1; then
        log_warning "Recent errors detected in application logs"
    fi
    
    return 0
}

show_rollback_instructions() {
    cat << 'EOF'

To rollback to the previous version:

1. Navigate to the application directory:
   cd $APP_DIR

2. Check the last deployment state:
   cat .backups/last-deployment.state

3. Checkout the previous commit:
   git checkout <PREVIOUS_COMMIT_HASH>

4. Reinstall dependencies:
   npm ci

5. Rebuild (if applicable):
   npm run build

6. Restart the application:
   pm2 restart moneylix

7. Verify the application is running:
   pm2 status

Manual git log check:
   git log --oneline -10

Check PM2 logs for errors:
   pm2 logs moneylix

Check process status:
   pm2 show moneylix

EOF
}

display_summary() {
    local deployment_end_time=$(date '+%Y-%m-%d %H:%M:%S')
    local elapsed_time=$(( $(date +%s) - DEPLOYMENT_ID ))
    
    echo ""
    echo -e "${GREEN}╔═════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              DEPLOYMENT COMPLETED SUCCESSFULLY               ║${NC}"
    echo -e "${GREEN}╚═════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_success "Deployment Summary:"
    echo ""
    echo "  Environment:       $ENVIRONMENT"
    echo "  Application:       $PM2_APP_NAME"
    echo "  Start Time:        $DEPLOYMENT_START_TIME"
    echo "  End Time:          $deployment_end_time"
    echo "  Duration:          ${elapsed_time}s"
    echo "  Deployment ID:     $DEPLOYMENT_ID"
    echo "  Deployment Log:    $LOG_FILE"
    echo ""
    
    log_success "Quick status commands:"
    echo ""
    echo "  • Check status:     pm2 status"
    echo "  • View logs:        pm2 logs $PM2_APP_NAME"
    echo "  • Show details:     pm2 show $PM2_APP_NAME"
    echo "  • Restart:          pm2 restart $PM2_APP_NAME"
    echo ""
}

main() {
    echo ""
    echo -e "${BLUE}╔═════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           Moneylix Deployment Script                        ║${NC}"
    echo -e "${BLUE}╚═════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Parse arguments
    parse_arguments "$@"
    
    # Setup
    setup_logging
    log_info "Environment: $ENVIRONMENT"
    log_info "Application Directory: $APP_DIR"
    log_info "Git Branch: $GIT_BRANCH"
    
    # Run deployment steps
    check_prerequisites
    save_deployment_state
    git_pull
    install_dependencies
    build_application
    stop_pm2
    restart_pm2
    
    if ! verify_deployment; then
        log_warning "Deployment verification found issues, but application may still be running"
    fi
    
    display_summary
}

# Run main function
main "$@"
