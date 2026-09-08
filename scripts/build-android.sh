#!/bin/bash

# ============================================================================
# Moneylix Android Build Script
# ============================================================================
# This script automates the Android build process for Moneylix, generating
# a signed Android App Bundle (AAB) ready for Play Store distribution.
#
# Usage: ./build-android.sh [--clean] [--debug]
# ============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/android"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_PATH="${PROJECT_ROOT}/moneylix.jks"
KEYSTORE_ALIAS="moneylix"
OUTPUT_DIR="${ANDROID_DIR}/app/build/outputs/bundle/release"

# Build options
CLEAN_BUILD=false
DEBUG_MODE=false

# ============================================================================
# Function Definitions
# ============================================================================

print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════╗${NC}" >&2
    echo -e "${BLUE}║${NC} $1" >&2
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n" >&2
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}✓${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1" >&2
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --clean         Perform a clean build (removes previous build artifacts)
    --debug         Enable debug mode with verbose output
    -h, --help      Show this help message

Examples:
    $0                  # Standard build
    $0 --clean          # Clean build
    $0 --clean --debug  # Clean build with verbose output

EOF
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if we're in the right directory
    if [ ! -f "${ANDROID_DIR}/gradlew" ]; then
        print_error "gradlew not found in ${ANDROID_DIR}"
        exit 1
    fi
    print_success "gradlew found"

    # Check if keystore exists
    if [ ! -f "${KEYSTORE_PATH}" ]; then
        print_error "Keystore not found at ${KEYSTORE_PATH}"
        print_info "Please ensure moneylix.jks exists in the project root"
        exit 1
    fi
    print_success "Keystore file found: ${KEYSTORE_PATH}"

    # Check if build.gradle exists
    if [ ! -f "${ANDROID_DIR}/build.gradle" ]; then
        print_error "build.gradle not found in ${ANDROID_DIR}"
        exit 1
    fi
    print_success "build.gradle found"

    print_success "All prerequisites met\n"
}

validate_keystore() {
    print_header "Validating Keystore"

    # Attempt to list keystore contents
    if keytool -list -v -keystore "${KEYSTORE_PATH}" -storepass "${KEYSTORE_PASSWORD}" &>/dev/null; then
        print_success "Keystore validation successful"
        print_success "Key alias: ${KEYSTORE_ALIAS}"
    else
        print_error "Keystore validation failed"
        print_warning "This may indicate an incorrect password or corrupted keystore"
        return 1
    fi
}

setup_signing_config() {
    print_header "Preparing Signing Configuration"

    # Verify environment variables are set
    if [ -z "${KEYSTORE_PASSWORD}" ]; then
        print_error "KEYSTORE_PASSWORD environment variable not set"
        print_info "Please set: export KEYSTORE_PASSWORD='your_password'"
        exit 1
    fi

    if [ -z "${KEY_PASSWORD}" ]; then
        print_error "KEY_PASSWORD environment variable not set"
        print_info "Please set: export KEY_PASSWORD='your_key_password'"
        exit 1
    fi

    print_success "Signing credentials configured"
    print_info "Keystore: ${KEYSTORE_PATH}"
    print_info "Alias: ${KEYSTORE_ALIAS}"
}

clean_build() {
    print_header "Cleaning Previous Build Artifacts"

    cd "${ANDROID_DIR}"
    print_info "Running ./gradlew clean..."
    
    if [ "$DEBUG_MODE" = true ]; then
        ./gradlew clean --stacktrace
    else
        ./gradlew clean
    fi

    print_success "Clean build completed"
}

build_release_bundle() {
    print_header "Building Release Android App Bundle (AAB)"

    cd "${ANDROID_DIR}"
    
    print_info "Configuration:"
    print_info "  - Build type: Release"
    print_info "  - Output format: Android App Bundle (AAB)"
    print_info "  - Signing: Enabled (moneylix.jks)"
    print_info ""
    print_info "Running ./gradlew bundleRelease..."
    print_info ""

    if [ "$DEBUG_MODE" = true ]; then
        # Run with debug output
        ./gradlew bundleRelease \
            --stacktrace \
            -x test \
            -Dorg.gradle.jvmargs="-Xmx4096m"
    else
        # Run normally with progress
        ./gradlew bundleRelease \
            -x test \
            -Dorg.gradle.jvmargs="-Xmx4096m"
    fi

    print_success "Release bundle build completed"
}

locate_aab_file() {
    print_header "Locating Build Output"

    # Find the AAB file
    AAB_FILE=$(find "${ANDROID_DIR}/app/build/outputs/bundle" -name "*.aab" -type f | head -n 1)

    if [ -z "${AAB_FILE}" ]; then
        print_error "AAB file not found in build outputs"
        print_info "Expected location: ${OUTPUT_DIR}/*.aab"
        return 1
    fi

    print_success "AAB file found:"
    print_info "  Path: ${AAB_FILE}"
    print_info "  Size: $(du -h "${AAB_FILE}" | cut -f1)"
    
    # Calculate file size for verification
    FILE_SIZE=$(stat -f%z "${AAB_FILE}" 2>/dev/null || stat -c%s "${AAB_FILE}" 2>/dev/null || echo "unknown")
    print_info "  Bytes: ${FILE_SIZE}"

    echo "${AAB_FILE}"
}

generate_build_report() {
    print_header "Build Report"

    local aab_file=$1
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="${ANDROID_DIR}/build_report.txt"

    cat > "${report_file}" << EOF
Moneylix Android Build Report
Generated: ${timestamp}

BUILD INFORMATION
─────────────────────────────────────
Build Type: Release (Signed)
Output Format: Android App Bundle (AAB)
Build Tool: Gradle

KEYSTORE INFORMATION
─────────────────────────────────────
Keystore Path: ${KEYSTORE_PATH}
Keystore Alias: ${KEYSTORE_ALIAS}
Note: Password stored in KEYSTORE_PASSWORD environment variable

KEY ALIAS: ${KEYSTORE_ALIAS}
Note: Password stored in KEY_PASSWORD environment variable

OUTPUT FILES
─────────────────────────────────────
AAB Path: ${aab_file}
AAB Size: $(du -h "${aab_file}" | cut -f1)

BUILD OUTPUTS DIRECTORY
─────────────────────────────────────
${ANDROID_DIR}/app/build/outputs/

NEXT STEPS
─────────────────────────────────────
1. The AAB is ready for upload to Google Play Console
2. Use Fastlane for automated Play Store deployment:
   fastlane android deploy_internal_testing

3. For manual upload:
   - Visit: https://play.google.com/console/
   - Select app: Moneylix
   - Go to Release > Internal Testing
   - Click "Create new release"
   - Upload the AAB file

4. To verify the bundle locally:
   bundletool build-apks --bundle=${aab_file} \\
     --output=app.apks \\
     --mode=universal

SIGNING NOTES
─────────────────────────────────────
- Signing credentials (passwords) should NEVER be committed to version control
- Store KEYSTORE_PASSWORD and KEY_PASSWORD in secure environment or CI/CD secrets
- The keystore file (moneylix.jks) must be kept secure and backed up

TROUBLESHOOTING
─────────────────────────────────────
If build fails:
1. Check Java version: java -version (should be 11+)
2. Verify Android SDK is installed and paths are correct
3. Run './gradlew clean' before rebuilding
4. Check gradle.properties for memory settings (-Xmx4096m)

EOF

    print_success "Build report generated: ${report_file}"
    cat "${report_file}"
}

# ============================================================================
# Main Script Execution
# ============================================================================

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --debug)
            DEBUG_MODE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution flow
print_header "Moneylix Android Build Script"
print_info "Project Root: ${PROJECT_ROOT}"
print_info "Android Directory: ${ANDROID_DIR}"

# Check prerequisites
check_prerequisites

# Setup signing
setup_signing_config

# Optional keystore validation
if [ "$DEBUG_MODE" = true ]; then
    validate_keystore
fi

# Clean if requested
if [ "$CLEAN_BUILD" = true ]; then
    clean_build
fi

# Build the release bundle
build_release_bundle

# Locate and display the output AAB
if AAB_FILE=$(locate_aab_file); then
    BUILD_STATUS=0
else
    BUILD_STATUS=$?
fi

if [ $BUILD_STATUS -eq 0 ]; then
    # Generate comprehensive build report
    generate_build_report "${AAB_FILE}"
    
    print_success "Android build completed successfully!"
    print_info "AAB ready for distribution: ${AAB_FILE}"
    exit 0
else
    print_error "Build failed or AAB file not found"
    exit 1
fi
