export interface Business {
  id: number
  name: string
  created_at: string
}

export interface Currency {
  code: string
  name: string
  symbol: string
  rate: number // Exchange rate relative to base currency (USD)
}

export interface Category {
  id: number
  name: string
  icon: string
  color: string
  type: 'credit' | 'debit' | 'both'
  created_at: string
}

export interface Transaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  category_id: number
  category?: Category
  business_id?: number
  currency: string // ISO 4217 currency code (e.g., 'USD', 'EUR')
  date: string
  due_date?: string
  reminder_days?: number
  note: string | null
  method: string | null
  tags: string | null
  created_at: string
  updated_at: string
}

export interface Settings {
  defaultCurrency: string
  updated_at: string
}

export interface DashboardSummary {
  totalBalance: number
  todayCredit: number
  todayDebit: number
  todayNet: number
  weekCredit: number
  weekDebit: number
  weekNet: number
  monthCredit: number
  monthDebit: number
  monthNet: number
  monthIncomeChangePct: number | null
  monthExpenseChangePct: number | null
  savingsRateChangePct: number | null
  totalBalanceChangePct: number | null
}

export interface CategorySpend {
  categoryId: number
  categoryName: string
  categoryColor: string
  categoryIcon: string
  amount: number
  percentage: number
}

export interface DailyCashflow {
  date: string
  credit: number
  debit: number
}

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  type?: 'credit' | 'debit'
  categoryId?: number
  method?: string
  search?: string
  sortBy?: 'date' | 'amount'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface PaginatedTransactions {
  transactions: Transaction[]
  total: number
  page: number
  totalPages: number
}

export interface CurrencyResponse {
  currencies: Currency[]
  defaultCurrency: string
}

// ============================
// Loan & EMI Types
// ============================

export interface Loan {
  id: number
  user_id: number
  business_id: number | null
  lender_name: string
  loan_type: 'personal' | 'home' | 'vehicle' | 'business' | 'education' | 'other'
  principal_amount: number
  interest_rate: number
  tenure_months: number
  emi_amount: number
  start_date: string
  end_date: string | null
  disbursement_date: string | null
  outstanding_balance: number
  total_interest_paid: number
  total_principal_paid: number
  status: 'active' | 'closed' | 'defaulted'
  next_emi_date: string | null
  notes: string | null
  business_name?: string
  created_at: string
  updated_at: string
}

export interface EmiPayment {
  id: number
  loan_id: number
  payment_date: string
  emi_number: number
  principal_component: number
  interest_component: number
  total_amount: number
  status: 'paid' | 'pending' | 'overdue' | 'skipped'
  transaction_id: number | null
  notes: string | null
  created_at: string
}

export interface AmortizationRow {
  month: number
  date: string
  emiAmount: number
  principal: number
  interest: number
  balance: number
}

// ============================
// Inventory Types
// ============================

export interface InventoryItem {
  id: number
  user_id: number
  business_id: number
  name: string
  sku: string | null
  description: string | null
  category: string | null
  unit: string
  cost_price: number
  selling_price: number
  current_stock: number
  low_stock_threshold: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: number
  item_id: number
  user_id: number
  business_id: number
  type: 'purchase' | 'sale' | 'adjustment' | 'return'
  quantity: number
  unit_price: number | null
  total_amount: number | null
  transaction_id: number | null
  reference: string | null
  notes: string | null
  item_name?: string
  item_sku?: string
  created_at: string
}

export interface InventorySummary {
  total_items: number
  stock_value_cost: number
  stock_value_selling: number
  low_stock_count: number
  out_of_stock_count: number
  top_selling: { name: string; total_sold: number }[]
}

// ============================
// Time Tracking Types
// ============================

export interface TimeEntry {
  id: number
  user_id: number
  business_id: number | null
  client_name: string | null
  project_name: string | null
  description: string | null
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  hourly_rate: number | null
  total_amount: number | null
  is_billable: number
  is_invoiced: number
  invoice_id: number | null
  status: 'running' | 'completed' | 'invoiced'
  created_at: string
  updated_at: string
}

export interface TimeProject {
  id: number
  user_id: number
  business_id: number | null
  name: string
  client_name: string | null
  hourly_rate: number | null
  color: string
  status: 'active' | 'completed' | 'archived'
  created_at: string
}

export interface TimeSummary {
  total_hours: number
  billable_hours: number
  total_billable_amount: number
  entry_count: number
  today_hours: number
  week_hours: number
  by_project: {
    project_name: string
    total_hours: number
    total_amount: number
    entry_count: number
  }[]
}

// ============================
// Notification Types
// ============================

export interface Notification {
  id: number
  user_id: number
  business_id: number | null
  type: 'low_balance' | 'due_date' | 'unusual_spend' | 'tax_deadline' | 'budget_alert' | 'system'
  title: string
  message: string
  is_read: number
  action_url: string | null
  metadata: string | null
  created_at: string
}

// ============================
// Budget Types
// ============================

export interface Budget {
  id: number
  user_id: number
  business_id: number
  category_id: number | null
  month: string
  amount: number
  created_at: string
  updated_at: string
}

export interface BudgetSummary {
  category_id: number | null
  category_name: string
  budgeted: number
  actual: number
  remaining: number
  percent_used: number
}

// ============================
// Invoice Types
// ============================

export interface InvoiceItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface Invoice {
  id: number
  user_id: number
  business_id: number | null
  invoice_number: string
  client_name: string
  client_email: string | null
  client_address: string | null
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  currency: string
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled'
  due_date: string | null
  paid_date: string | null
  paid_amount: number
  payment_link: string | null
  notes: string | null
  terms: string | null
  share_token: string | null
  created_at: string
  updated_at: string
}

// ============================
// Team Types
// ============================

export interface TeamMember {
  id: number
  business_id: number
  user_id: number | null
  role: 'owner' | 'admin' | 'accountant' | 'staff' | 'viewer'
  invited_email: string | null
  invite_status: 'pending' | 'accepted' | 'declined'
  permissions: string | null
  created_at: string
  updated_at: string
  username?: string
  email?: string
}

// ============================
// Payroll Types
// ============================

export interface StaffMember {
  id: number
  user_id: number
  business_id: number
  name: string
  role_title: string | null
  email: string | null
  phone: string | null
  salary_amount: number | null
  salary_frequency: 'monthly' | 'weekly' | 'biweekly'
  status: 'active' | 'inactive'
  joined_date: string | null
  created_at: string
  updated_at: string
}

export interface PayrollEntry {
  id: number
  user_id: number
  business_id: number
  staff_member_id: number
  period: string
  base_salary: number | null
  allowances: number
  deductions: number
  net_amount: number
  status: 'pending' | 'paid' | 'cancelled'
  paid_date: string | null
  transaction_id: number | null
  notes: string | null
  staff_name?: string
  created_at: string
  updated_at: string
}

// ============================
// Reconciliation Types
// ============================

export interface ReconciliationMatch {
  id: number
  bank_transaction_id: number
  manual_transaction_id: number | null
  match_type: 'auto' | 'manual' | 'suggested'
  confidence: number
  status: 'matched' | 'unmatched' | 'disputed' | 'ignored'
  matched_by: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReconciliationSession {
  id: number
  user_id: number
  business_id: number
  bank_connection_id: number
  period_start: string
  period_end: string
  status: 'in_progress' | 'completed' | 'cancelled'
  total_bank_txns: number
  matched_count: number
  unmatched_count: number
  created_at: string
  updated_at: string
}

// ============================
// GST / Tax Types
// ============================

export interface GstSettings {
  user_id: number
  business_id: number
  gstin: string | null
  gst_registered: number
  state_code: string | null
  default_tax_rate: number
  hsn_sac_code: string | null
}

export interface TaxEntry {
  id: number
  user_id: number
  business_id: number
  financial_year: string
  quarter: string | null
  month: string | null
  type: 'gst_payable' | 'tds_deducted' | 'advance_tax' | 'tds_receivable'
  amount: number
  description: string | null
  status: 'pending' | 'paid' | 'filed'
  due_date: string | null
  paid_date: string | null
  reference_number: string | null
  created_at: string
  updated_at: string
}

// ============================
// Forecast Types
// ============================

export interface ForecastDay {
  date: string
  projected_income: number
  projected_expense: number
  projected_balance: number
  confidence: number
}

export interface ForecastSummary {
  projected_end_balance: number
  total_projected_income: number
  total_projected_expense: number
  lowest_balance_date: string
  lowest_balance_amount: number
}
