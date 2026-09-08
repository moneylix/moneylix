# Moneylix iOS & Android Screenshot Automation Guide

This guide provides detailed instructions for capturing and organizing screenshots for iOS and Android app store listings.

---

## Table of Contents

1. [iOS Screenshots - Xcode Simulator Method](#ios-screenshots---xcode-simulator-method)
2. [Screen List & Navigation Steps](#screen-list--navigation-steps)
3. [Android Screenshots - ADB Method](#android-screenshots---adb-method)
4. [Device Frame & Mockup Tools](#device-frame--mockup-tools)
5. [Play Store Feature Graphics](#play-store-feature-graphics)
6. [Directory Structure](#directory-structure)

---

## iOS Screenshots - Xcode Simulator Method

### Prerequisites

- Xcode installed with iOS simulators
- Device Frames Figma plugin or Previewed.app (optional but recommended)
- Screenshot storage directory created

### Setting Up the iPhone 15 Pro Max Simulator

```bash
# List all available simulators
xcrun simctl list devices

# Find the iPhone 15 Pro Max UDID
xcrun simctl list devices | grep "iPhone 15 Pro Max"

# If not available, create it
xcrun simctl create "iPhone 15 Pro Max" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max \
  com.apple.CoreSimulator.SimRuntime.iOS-17-4

# Boot the simulator
xcrun simctl boot "iPhone 15 Pro Max"

# Launch Xcode
open -a Xcode

# Or boot the simulator through Xcode menu: Xcode > Open Developer Tool > Simulator
```

### Capturing Screenshots Using Xcode Simulator

#### Method 1: Using Keyboard Shortcut (Recommended)

1. Launch the Moneylix app in the iPhone 15 Pro Max simulator
2. Navigate to each screen (see navigation steps below)
3. Take a screenshot with keyboard shortcut:
   ```
   Cmd + S
   ```
4. A save dialog will appear - save to your screenshots folder with the naming convention

#### Method 2: Using xcrun Command Line (Batch Automated)

```bash
# Define variables
SIMULATOR_NAME="iPhone 15 Pro Max"
SIMULATOR_UDID=$(xcrun simctl list devices | grep "iPhone 15 Pro Max" | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | head -1)
SCREENSHOTS_DIR="./screenshots/ios"

# Boot simulator
xcrun simctl boot "${SIMULATOR_UDID}"

# Wait for app launch
sleep 5

# Capture screenshot
xcrun simctl io "${SIMULATOR_UDID}" screenshot "${SCREENSHOTS_DIR}/01_dashboard.png"
```

#### Method 3: Using Open Simulator Window

1. Open Simulator app directly from Applications
2. In menu bar, select: Device > Manage Devices
3. Select iPhone 15 Pro Max and click "Boot"
4. Run your Moneylix app
5. Menu bar: File > New Screen Shot (Cmd+S)
6. Navigate through each screen and repeat step 5

### Screen Capture Specifications

- **Device:** iPhone 15 Pro Max
- **Resolution:** 1440 x 3200 pixels (native resolution)
- **Safe Area:** Accounts for notch and dynamic island
- **Format:** PNG (recommended) or JPG
- **Color Profile:** sRGB

---

## Screen List & Navigation Steps

Capture screenshots in the following order. Each screen demonstrates a key feature of Moneylix.

### Screen 1: Dashboard (01_dashboard.png)

**Purpose:** Overview of financial status and recent activity

**Navigation Steps:**
```
1. Launch Moneylix app
2. App opens to Dashboard by default
3. Ensure 5-7 transactions are visible
4. Verify summary cards are displayed:
   - Total Balance
   - Monthly Spending
   - Income
   - Savings Rate
5. Wait for animations to complete
6. Capture screenshot: Cmd + S → Save as "01_dashboard.png"
```

**What Should Be Visible:**
- Header with "Dashboard" title
- User greeting/welcome message
- Balance card showing total funds
- Recent transactions list
- Income/expense summary
- "Add Transaction" floating action button
- Bottom navigation bar (Dashboard, Transactions, Charts, etc.)

**Tips:**
- Ensure no loading indicators are visible
- Remove any alert banners if present
- Clear any demo/setup dialogs
- Position app so safe area is properly shown

---

### Screen 2: Transactions (02_transactions.png)

**Purpose:** Show transaction history and filtering capabilities

**Navigation Steps:**
```
1. From Dashboard, tap "Transactions" in bottom navigation
2. Wait for transactions list to load
3. Verify at least 10 transactions are visible
4. Scroll to show variety of transaction types:
   - Income (green)
   - Expenses (red)
   - Transfers (blue)
5. Optionally show filter/sort options (optional for this view)
6. Capture screenshot: Cmd + S → Save as "02_transactions.png"
```

**What Should Be Visible:**
- "Transactions" header with current month/date
- List of transactions with:
  - Transaction amount
  - Category (with icon)
  - Description
  - Date/time
  - Transaction type indicator
- Ability to scroll (show some upper items slightly cut off)
- Search/filter bar at top (optional)
- "Add Transaction" button or option

**Tips:**
- Include diverse transactions (food, utilities, transfer, etc.)
- Show transactions from different dates
- Use realistic amounts and descriptions

---

### Screen 3: Analytics/Charts (03_charts.png)

**Purpose:** Visualize spending patterns and financial trends

**Navigation Steps:**
```
1. From Transactions, tap "Charts" in bottom navigation
2. Wait for charts to render
3. Verify pie chart shows expense categories
4. Scroll down to reveal:
   - Pie chart (current month breakdown)
   - Bar chart (trends over 3-6 months)
   - Month selector
5. Ensure animations are complete
6. Capture screenshot: Cmd + S → Save as "03_charts.png"
```

**What Should Be Visible:**
- Charts view header
- Category breakdown pie chart with:
  - Clear color coding per category
  - Percentage labels
  - Legend
- Optional: Bar chart showing trend
- Date range selector
- Top categories list with percentage

**Tips:**
- Arrange chart data to show meaningful breakdown
- Ensure no overlapping labels
- Use colors that are distinct and accessible
- Verify chart loads without errors

---

### Screen 4: Bank Sync (04_bank_sync.png)

**Purpose:** Demonstrate connected bank accounts and automatic sync

**Navigation Steps:**
```
1. From Charts, tap "Settings" or account icon
2. Navigate to "Connected Accounts" or "Bank Sync"
3. Show connected bank accounts:
   - Display 2-3 connected accounts
   - Account names visible
   - Last sync time
   - Sync status (✓ Connected)
4. Show balance for each account
5. Capture screenshot: Cmd + S → Save as "04_bank_sync.png"
```

**What Should Be Visible:**
- Connected accounts section header
- List of connected accounts with:
  - Bank name/logo
  - Account type (Checking, Savings, Credit)
  - Last 4 digits of account number
  - Current balance
  - Connection status (green checkmark)
  - Last sync time (e.g., "Last updated 2 hours ago")
- "Connect New Account" button
- Optional: Sync history or activity log

**Tips:**
- Use realistic bank names and account types
- Ensure logos are clear and recognizable
- Show varied account types
- Verify sync status indicators work

---

### Screen 5: AI Advisor (05_ai_advisor.png)

**Purpose:** Showcase AI-powered financial recommendations

**Navigation Steps:**
```
1. Navigate to AI Advisor section
   - May be in main nav or Settings
2. Wait for AI insights to load
3. Display AI recommendations showing:
   - Spending insights
   - Savings opportunities
   - Budget advice
4. Show 3-4 key recommendations
5. Capture screenshot: Cmd + S → Save as "05_ai_advisor.png"
```

**What Should Be Visible:**
- AI Advisor header with icon
- AI-generated insights cards showing:
  - Recommendation title
  - Icon/illustration
  - Insight description
  - Action button (e.g., "View Details", "Apply")
- Example recommendations:
  - "You could save $200 by reducing dining out"
  - "Your savings rate is 22% - good progress!"
  - "Category overspend detected in Entertainment"
- Trust indicator or "Powered by AI" badge

**Tips:**
- Showcase actionable, specific recommendations
- Use clear, conversational language
- Ensure AI cards are fully visible
- Show visual hierarchy of recommendations

---

### Screen 6: Receivables (06_receivables.png)

**Purpose:** Highlight tracking money owed by others

**Navigation Steps:**
```
1. From AI Advisor, navigate to "Receivables" or "Money Owed"
   - May be in Settings > Receivables
   - Or separate tab in main navigation
2. Display list of receivables with:
   - Friend/contact names
   - Amounts owed
   - Reasons for payment
   - Due dates
3. Show 3-4 receivable items
4. Capture screenshot: Cmd + S → Save as "06_receivables.png"
```

**What Should Be Visible:**
- Receivables header with total amount owed
- List of people who owe money:
  - Contact name/avatar
  - Amount owed
  - Date/reason (e.g., "Lunch on June 5")
  - Status (Pending, Overdue, etc.)
  - Optional: Payment link/reminder button
- Total receivables summary
- "Add Receivable" button
- Optional: Settlement history or reminders sent

**Tips:**
- Use realistic names and amounts
- Show varied statuses (recent, overdue)
- Include profile pictures/avatars where possible
- Show human-friendly reasons

---

### Screen 7: Multi-Business Dashboard (07_multi_business.png)

**Purpose:** Demonstrate multi-business/multi-account management

**Navigation Steps:**
```
1. Navigate to Business/Account Switcher
   - May be at top of Dashboard or in Settings
2. Show list of multiple business/accounts:
   - Business name
   - Account type
   - Balance/summary
3. Demonstrate switching between businesses:
   - Tap different business
   - Dashboard updates to show that business's data
4. Capture screenshot showing business selector with multiple options
   - OR capture Dashboard view for each business separately
5. Capture screenshot: Cmd + S → Save as "07_multi_business.png"
```

**What Should Be Visible:**
- Business/Account switcher UI showing:
  - Current business name prominently displayed
  - Dropdown or card view of available businesses
  - 2-3 business options with:
    - Business name
    - Current balance
    - Optional: Last updated time
    - Selection indicator
- Dashboard content for selected business
- Optional: Business settings button

**Tips:**
- Create realistic business names and balances
- Show different business types (freelance, LLC, e-commerce)
- Ensure switcher is intuitive and discoverable
- Verify dashboard updates correctly when switching

---

## Screenshot Naming Convention

Organize all screenshots with sequential numbering and clear names:

```
01_dashboard.png           # Main dashboard/home screen
02_transactions.png        # Transaction history and list
03_charts.png              # Analytics and charts
04_bank_sync.png           # Connected accounts and sync status
05_ai_advisor.png          # AI financial recommendations
06_receivables.png         # Money owed tracking
07_multi_business.png      # Business account management
```

---

## Android Screenshots - ADB Method

### Prerequisites

- Android Debug Bridge (ADB) installed
- Android device or emulator connected
- USB debugging enabled (for physical device)
- Moneylix app installed on device/emulator

### Setting Up ADB

```bash
# Check if ADB is installed
adb version

# If not installed, install Android SDK Platform Tools
# macOS:
brew install android-platform-tools

# Linux:
sudo apt-get install android-tools-adb

# Windows:
# Download from https://developer.android.com/tools/releases/platform-tools
```

### Connecting Device or Starting Emulator

```bash
# List connected devices
adb devices

# Start Android emulator (example with Pixel 6 Pro)
emulator -avd Pixel_6_Pro

# Enable USB debugging on physical device:
# Settings > Developer Options > Enable USB debugging
```

### Capturing Android Screenshots

#### Method 1: Direct ADB Screenshot Capture

```bash
# Capture a single screenshot
adb shell screencap -p /sdcard/screenshot.png

# Pull screenshot from device
adb pull /sdcard/screenshot.png ./screenshots/android/01_dashboard.png

# One-liner to capture and pull
adb shell screencap -p /sdcard/screenshot.png && \
adb pull /sdcard/screenshot.png ./screenshots/android/01_dashboard.png && \
adb shell rm /sdcard/screenshot.png
```

#### Method 2: Automated Batch Capture Script

```bash
#!/bin/bash
# capture_android_screenshots.sh

SCREENSHOTS_DIR="./screenshots/android"
DEVICE_UDID=$(adb devices | grep -v "List" | head -1 | awk '{print $1}')

mkdir -p "${SCREENSHOTS_DIR}"

echo "Capturing Android screenshots..."

# Capture all 7 screens
SCREEN_NAMES=(
    "01_dashboard"
    "02_transactions"
    "03_charts"
    "04_bank_sync"
    "05_ai_advisor"
    "06_receivables"
    "07_multi_business"
)

for i in "${!SCREEN_NAMES[@]}"; do
    SCREEN="${SCREEN_NAMES[$i]}"
    echo "Capturing ${SCREEN}..."
    
    # Manual wait for user to navigate
    read -p "Navigate to ${SCREEN} screen, then press Enter..."
    
    # Capture screenshot
    adb shell screencap -p /sdcard/${SCREEN}.png
    adb pull /sdcard/${SCREEN}.png "${SCREENSHOTS_DIR}/${SCREEN}.png"
    adb shell rm /sdcard/${SCREEN}.png
    
    echo "✓ Saved ${SCREEN}.png"
done

echo "Android screenshot capture completed!"
```

#### Method 3: Manual Capture via Emulator

1. Run Android Emulator
2. Launch Moneylix app
3. Use keyboard shortcut:
   ```
   Ctrl + S (Windows/Linux)
   Cmd + S (macOS in emulator)
   ```
4. Screenshot saves to `%USERPROFILE%\Pictures\Emulator` (Windows) or `~/Pictures/Emulator` (Mac/Linux)
5. Move files to `screenshots/android/` directory

### Android Screenshot Specifications

- **Device:** Pixel 6 Pro (recommended) or similar 6.7" device
- **Resolution:** 1440 x 3120 pixels (device native)
- **Aspect Ratio:** 9:20 (standard for Google Play)
- **Format:** PNG
- **Safe Area:** Accounts for status bar and navigation bar

---

## Device Frame & Mockup Tools

### Recommended Tools

#### 1. **Previewed.app** (Recommended for Mac & Web)
- Free online tool
- No installation required
- Supports 100+ device templates
- Customizable frames, shadows, and backgrounds
- Easy batch processing

**Usage:**
```
1. Visit https://previewed.app/editor/device-mockup
2. Upload your screenshots
3. Choose device: iPhone 15 Pro Max or Pixel 6 Pro
4. Customize:
   - Frame color
   - Background
   - Shadow effects
   - Angle/perspective
5. Download as PNG or share link
```

#### 2. **screenshots.pro** (Browser-based)
- Clean, modern interface
- Support for multiple devices
- Professional presets
- Batch frame application

**Usage:**
```
1. Visit https://www.screenshots.pro/
2. Upload PNG screenshots
3. Select device template
4. Apply frame
5. Download framed screenshots
```

#### 3. **Figma Device Frames Plugin**
- Integrated in design workflow
- High customization
- Best for design-forward mockups

**Installation:**
```
1. In Figma: Main Menu > Plugins > Browse plugins
2. Search: "Device Frame Previewer" or "Screenshots"
3. Install desired plugin
4. Upload screenshots
5. Apply device frames
6. Export as PNG/PDF
```

#### 4. **CommandLine: Screenshots iOS/Android**

```bash
# Using imagemagick to add borders and info
convert screenshot.png \
  -background white \
  -bordercolor white \
  -border 50x100 \
  -gravity SouthWest \
  -pointsize 12 \
  -fill gray \
  -annotate +10+10 "iPhone 15 Pro Max" \
  framed_screenshot.png

# Using ffmpeg for batch processing
for img in *.png; do
  convert "$img" \
    -bordercolor white \
    -border 30x50 \
    "framed_${img}"
done
```

#### 5. **MavenLink AppFrames** (Design Tool)
- Integrates with Adobe Creative Suite
- Professional mockup templates
- Custom branding options

### Batch Frame Application

```bash
#!/bin/bash
# apply_frames_batch.sh
# Requires imagemagick and previewed-cli or similar

SOURCE_DIR="./screenshots/raw"
OUTPUT_DIR="./screenshots/framed"

mkdir -p "${OUTPUT_DIR}"

for device in ios android; do
    for file in "${SOURCE_DIR}/${device}"/*.png; do
        filename=$(basename "$file")
        
        # Using a simple border approach with imagemagick
        convert "$file" \
          -background black \
          -bordercolor black \
          -border 20x20 \
          "${OUTPUT_DIR}/framed_${filename}"
        
        echo "Framed: ${filename}"
    done
done

echo "Batch frame application completed!"
```

---

## Play Store Feature Graphics

### Overview

The feature graphic (also called "hero image") is the promotional banner displayed prominently in the Google Play Store.

### Specifications

- **Dimensions:** 1024 x 500 pixels (required)
- **Aspect Ratio:** 2.048:1 (approximately 2:1)
- **Format:** PNG or JPG
- **File Size:** Max 512 KB
- **Color Profile:** sRGB
- **Text Overlay:** Include app name and key value proposition

### Design Guidelines

#### Layout Zones

```
┌─────────────────────────────────────────────┐
│  Safe Margin (80px)                         │
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │   APP NAME & TAGLINE                  │  │
│  │   (Left-aligned or centered)          │  │
│  │                                       │  │
│  │   KEY VISUAL / SCREENSHOTS            │  │
│  │   (Device mockups or icons)           │  │
│  │                                       │  │
│  │   TAGLINE / CTA                       │  │
│  │   (Right side)                        │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│  Safe Margin (80px)                         │
└─────────────────────────────────────────────┘
```

#### Design Recommendations

1. **Background:**
   - Use brand colors (consider Moneylix color palette)
   - Gradient effect works well (top to bottom)
   - Ensure sufficient contrast for readability

2. **Typography:**
   - **App Name:** Bold, large (100-150px), color contrasting with background
   - **Tagline:** Secondary font, 40-60px
   - Example: "Smart Financial Management for Everyone"

3. **Visual Elements:**
   - Include 2-3 key screenshots as framed devices
   - Dashboard or key feature prominently displayed
   - Optional: Icons representing key features (AI, charts, sync)
   - Optional: Subtle pattern or texture background

4. **Text Safety:**
   - Keep all important text in center 60% of image
   - Avoid placing text near edges (vulnerable on different screens)
   - Minimum distance: 80px from edges

### Example Design Structure

```
Left Side (30%):         Center (40%):          Right Side (30%):
MONEYLIX LOGO          iPhone Screenshot       Feature Icons
App Name               (Main Feature)          • Dashboard
Smart Finance          Dashboard View          • Analytics
Management                                     • Bank Sync
For Everyone
                       iPhone Screenshot
                       (Secondary Feature)
                       Charts View

Background: Blue to Purple Gradient
Overlay: Semi-transparent dark (alpha 0.3) for text readability
```

### Creation Tools

1. **Canva** (Easiest)
   ```
   1. Visit canva.com
   2. Create new design
   3. Set custom size: 1024 x 500
   4. Choose template or start blank
   5. Add backgrounds, text, screenshots
   6. Download as PNG
   ```

2. **Figma** (Professional)
   ```
   1. Create new file
   2. Frame size: 1024 x 500
   3. Design feature graphic
   4. Export frame as PNG/JPG
   ```

3. **Adobe Express** (Quick)
   ```
   1. Visit express.adobe.com
   2. New document
   3. Custom size: 1024 x 500
   4. Design and export
   ```

4. **ImageMagick** (Command Line)
   ```bash
   convert -size 1024x500 xc:navy \
     -font "Arial-Bold" \
     -pointsize 120 \
     -fill white \
     -gravity North \
     -annotate +0+50 "MONEYLIX" \
     -pointsize 50 \
     -annotate +0+180 "Smart Financial Management" \
     feature_graphic.png
   ```

### Final Checklist

- [ ] Dimensions: 1024 x 500 pixels
- [ ] File format: PNG or JPG
- [ ] File size: Under 512 KB
- [ ] Color profile: sRGB
- [ ] App name clearly visible
- [ ] Key value proposition readable
- [ ] Important elements not in outer margins
- [ ] Text is legible (good contrast)
- [ ] Tested on Play Store preview
- [ ] No logos or trademarks that aren't yours
- [ ] Consistent with app branding

---

## Directory Structure

Organize screenshots in the following structure:

```
moneylix/
├── screenshots/
│   ├── ios/
│   │   ├── raw/
│   │   │   ├── 01_dashboard.png
│   │   │   ├── 02_transactions.png
│   │   │   ├── 03_charts.png
│   │   │   ├── 04_bank_sync.png
│   │   │   ├── 05_ai_advisor.png
│   │   │   ├── 06_receivables.png
│   │   │   └── 07_multi_business.png
│   │   └── framed/
│   │       ├── framed_01_dashboard.png
│   │       ├── framed_02_transactions.png
│   │       └── ... (etc)
│   │
│   ├── android/
│   │   ├── raw/
│   │   │   ├── 01_dashboard.png
│   │   │   ├── 02_transactions.png
│   │   │   └── ... (etc)
│   │   └── framed/
│   │       └── ... (framed versions)
│   │
│   ├── marketing/
│   │   ├── feature_graphic_1024x500.png
│   │   ├── app_icon_512x512.png
│   │   └── promotional_graphic.png
│   │
│   └── scripts/
│       ├── capture_ios_screenshots.sh
│       ├── capture_android_screenshots.sh
│       └── apply_frames_batch.sh
│
└── docs/
    └── screenshot_guide.md
```

---

## Quick Reference Commands

### iOS Simulator

```bash
# List simulators
xcrun simctl list devices

# Boot simulator
xcrun simctl boot "iPhone 15 Pro Max"

# Capture via command line
xcrun simctl io "iPhone 15 Pro Max" screenshot ~/Desktop/screenshot.png

# Take screenshot with keyboard shortcut in app
Cmd + S

# Kill simulator
xcrun simctl shutdown all
```

### Android Device/Emulator

```bash
# List devices
adb devices

# Capture screenshot
adb shell screencap -p /sdcard/screenshot.png

# Pull screenshot
adb pull /sdcard/screenshot.png ~/Desktop/screenshot.png

# Remove from device
adb shell rm /sdcard/screenshot.png

# One command
adb shell screencap -p /sdcard/screenshot.png && adb pull /sdcard/screenshot.png . && adb shell rm /sdcard/screenshot.png
```

### Image Processing

```bash
# Resize all screenshots to 1440x3200 (iOS)
for img in *.png; do
  convert "$img" -resize 1440x3200 "resized_${img}"
done

# Add 50px border with white background
convert screenshot.png -bordercolor white -border 50 framed.png

# Convert to JPG with quality 90
convert screenshot.png -quality 90 screenshot.jpg

# Batch convert PNG to JPG
for img in *.png; do
  convert "$img" "${img%.png}.jpg"
done
```

---

## Troubleshooting

### iOS Screenshots

**Problem:** Simulator not booting
```bash
# Solution: Reset simulator
xcrun simctl erase "iPhone 15 Pro Max"
xcrun simctl boot "iPhone 15 Pro Max"
```

**Problem:** Screenshots not saving
- Check Cmd+S is being registered
- Ensure Moneylix app window is focused
- Try: Simulator > File > New Screen Shot

**Problem:** Wrong device or resolution
- Verify device type: xcrun simctl list devices
- Ensure iPhone 15 Pro Max is selected
- Check simulator window size matches device

### Android Screenshots

**Problem:** Device not recognized
```bash
# Solution: Restart ADB
adb kill-server
adb start-server
adb devices
```

**Problem:** Screenshots too large/wrong resolution
- Verify device: adb shell getprop ro.product.model
- Check resolution: adb shell wm size
- Ensure app is displaying correctly

**Problem:** File permission errors
- Enable USB debugging
- Authorize device when prompted
- Check device is in developer mode

---

## Best Practices

1. **Timing:**
   - Capture screenshots at the same time for consistent lighting/state
   - Avoid animation frames (wait for completion)
   - Ensure no loading indicators or errors visible

2. **Content:**
   - Use realistic but sample data
   - Clean up any test transactions before capture
   - Ensure readable amounts and descriptions

3. **Quality:**
   - Screenshot at native device resolution
   - Don't over-compress when saving
   - Test screenshots on actual Play Store before publishing

4. **Consistency:**
   - Maintain consistent app state across screenshots
   - Use same device frame style for all versions
   - Keep naming convention consistent

5. **Accessibility:**
   - Ensure text is readable at thumbnail size
   - Use high contrast for important elements
   - Consider colorblind-friendly color schemes

---

## Additional Resources

- [Google Play Store Screenshot Requirements](https://support.google.com/googleplay/android-developer/answer/1078870)
- [Apple App Store Screenshots Guide](https://developer.apple.com/app-store/screenshots-and-video-previews/)
- [Xcode Simulator Documentation](https://developer.apple.com/documentation/xcode/running_your_app_in_simulator_or_on_a_device)
- [Android ADB Documentation](https://developer.android.com/studio/command-line/adb)
- [Previewed.app Device Mockups](https://previewed.app/)
- [Screenshots.pro](https://www.screenshots.pro/)

---

**Last Updated:** June 2026
**Version:** 1.0
