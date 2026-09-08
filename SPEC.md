# Money Manager Web App - Specification

## Project Overview
- **Project Name**: MoneyFlow - Personal Finance Manager
- **Type**: Full-stack Web Application (Next.js)
- **Core Functionality**: Track credit/debit transactions with clean dashboard, fast input, and comprehensive management features
- **Target Users**: Individual users managing personal finances

## Tech Stack
- **Frontend**: Next.js 14 + React 18 + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite with better-sqlite3 (local storage)
- **Charts**: Recharts
- **Icons**: Lucide React

## UI/UX Specification

### Color Palette
- **Primary**: `#0F172A` (Slate 900 - dark backgrounds)
- **Secondary**: `#1E293B` (Slate 800 - card backgrounds)
- **Accent**: `#10B981` (Emerald 500 - credit/positive)
- **Debit**: `#EF4444` (Red 500 - debit/negative)
- **Warning**: `#F59E0B` (Amber 500)
- **Text Primary**: `#F8FAFC` (Slate 50)
- **Text Secondary**: `#94A3B8` (Slate 400)
- **Border**: `#334155` (Slate 700)
- **Surface**: `#1E293B` (Slate 800)

### Typography
- **Font Family**: "Plus Jakarta Sans" (headings), "JetBrains Mono" (numbers/amounts)
- **Headings**: 
  - H1: 32px, font-weight 700
  - H2: 24px, font-weight 600
  - H3: 18px, font-weight 600
- **Body**: 14px, font-weight 400
- **Small**: 12px, font-weight 400

### Spacing System
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Page Structure

### 1. Login Page (`/login`)
- Centered card with app logo
- Email/password form
- "Demo Mode" button for quick access
- Clean minimal design with gradient background

### 2. Dashboard (`/dashboard`)
- **Header**: Welcome message + Quick Add button
- **Summary Cards Row**:
  - Total Balance (large, prominent)
  - Today's totals (Credit/Debit/Net)
  - This Week totals
  - This Month totals
- **Charts Section**:
  - Spend by Category (Pie/Donut chart)
  - Daily Cashflow (Bar chart - last 7 days)
- **Recent Transactions**: Last 20 transactions with quick actions

### 3. Transactions Page (`/transactions`)
- **Filter Bar**: Date range, Type, Category, Payment Method, Search
- **Transactions Table**:
  - Columns: Date, Description, Category, Method, Amount, Actions
  - Inline edit on click
  - Checkbox for bulk selection
- **Pagination**: 20 items per page
- **Quick Add FAB**: Floating action button on mobile

### 4. Categories Page (`/categories`)
- Grid of category cards
- Each card: Icon + Name + Transaction count + Total amount
- Add/Edit category modal
- Default categories pre-seeded

### 5. Settings Page (`/settings`)
- Export data (CSV/JSON)
- Import data with mapping
- Currency settings
- Theme toggle (dark/light) - default dark

## Components Specification

### Quick Add Modal
- **Trigger**: Floating "+" button (mobile), Keyboard shortcut 'A' (desktop)
- **Fields**:
  - Type toggle (Credit/Debit) - large, easy to tap
  - Amount input - numeric keypad style, auto-focus
  - Category dropdown - with icons
  - Date picker - defaults to today
  - Note input - optional
  - Payment Method dropdown
  - Tags input - comma separated
- **UX**: Auto-focus on amount, Enter to submit, Escape to close

### Transaction Row (Inline Edit)
- Click to expand inline edit form
- Fields become editable inputs
- Save/Cancel buttons appear
- Undo toast on delete (5 second window)

### Charts
- **Category Pie Chart**: Top 5 categories by amount, with "Other" for remainder
- **Daily Cashflow**: Grouped bar chart (Credit vs Debit) for last 7 days

### Toast Notifications
- Position: Bottom-center on mobile, Top-right on desktop
- Types: Success (green), Error (red), Warning (amber), Info (blue)
- Auto-dismiss: 3 seconds (except undo - 5 seconds)

## Data Model

### Categories Table
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT CHECK(type IN ('credit', 'debit', 'both')) DEFAULT 'both',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('credit', 'debit')) NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  method TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### Default Categories
**Debit:**
- 🛒 Shopping
- 🍔 Food & Dining
- 🚗 Transportation
- 🏠 Housing
- ⚡ Utilities
- 🎬 Entertainment
- 💊 Healthcare
- 📚 Education
- 👤 Personal
- 📦 Other

**Credit:**
- 💰 Salary
- 💵 Freelance
- 🎁 Gift
- 📈 Investment
- 🔄 Refund
- 📥 Other Income

**Methods:**
- 💳 Card
- 💵 Cash
- 🏦 Bank Transfer
- 📱 UPI
- 📤 Other

## API Endpoints

### Auth
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/demo` - Quick demo access

### Transactions
- `GET /api/transactions` - List with filters/pagination
- `POST /api/transactions` - Create new
- `PUT /api/transactions/[id]` - Update
- `DELETE /api/transactions/[id]` - Delete
- `POST /api/transactions/bulk-delete` - Bulk delete
- `POST /api/transactions/bulk-update` - Bulk category change

### Categories
- `GET /api/categories` - List all
- `POST /api/categories` - Create
- `PUT /api/categories/[id]` - Update
- `DELETE /api/categories/[id]` - Delete

### Dashboard
- `GET /api/dashboard/summary` - Get summary stats
- `GET /api/dashboard/charts` - Get chart data

### Export/Import
- `GET /api/export/csv` - Export all data as CSV
- `GET /api/export/json` - Export all data as JSON
- `POST /api/import/csv` - Import from CSV

## Keyboard Shortcuts
- `A` - Open Quick Add modal
- `/` - Focus search
- `Esc` - Close modal
- `Enter` - Submit form

## Animations
- Page transitions: Fade in (200ms)
- Modal: Scale up from 95% to 100% + fade (150ms)
- Cards: Subtle hover lift (transform: translateY(-2px))
- Charts: Animate on load (500ms)
- Toasts: Slide in from bottom (mobile) / right (desktop)

## Acceptance Criteria
1. ✅ Dashboard shows correct balance calculation
2. ✅ All CRUD operations work for transactions
3. ✅ Inline edit works without page navigation
4. ✅ Delete shows undo toast
5. ✅ Filters work correctly
6. ✅ Quick Add modal opens via button and keyboard
7. ✅ Charts render with correct data
8. ✅ Responsive on mobile and desktop
9. ✅ Export generates valid CSV
10. ✅ Import parses CSV correctly

