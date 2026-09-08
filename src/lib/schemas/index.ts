import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
export const positiveNumber = z.number().positive('Must be greater than 0')
export const idParam = z.coerce.number().int().positive()

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const CreateTransactionSchema = z.object({
  type:          z.enum(['credit', 'debit']),
  amount:        positiveNumber,
  category_id:   z.number().int().positive(),
  business_id:   z.number().int().positive().optional(),
  currency:      z.string().length(3).default('INR'),
  date:          isoDate,
  due_date:      isoDate.optional().nullable(),
  reminder_days: z.number().int().min(0).max(365).default(3),
  note:          z.string().max(500).optional().nullable(),
  method:        z.string().max(50).optional().nullable(),
  tags:          z.string().max(200).optional().nullable(),
  status:        z.enum(['completed', 'pending']).default('completed'),
  client_name:   z.string().max(100).optional().nullable(),
})

export const UpdateTransactionSchema = CreateTransactionSchema.partial()

export const TransactionFiltersSchema = z.object({
  businessId: z.coerce.number().int().positive().optional(),
  startDate:  isoDate.optional(),
  endDate:    isoDate.optional(),
  type:       z.enum(['credit', 'debit', 'pending']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  method:     z.string().optional(),
  search:     z.string().max(100).optional(),
  sortBy:     z.enum(['date', 'amount']).default('date'),
  sortOrder:  z.enum(['asc', 'desc']).default('desc'),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(200).default(20),
})

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CreateCategorySchema = z.object({
  name:  z.string().min(1).max(50).trim(),
  icon:  z.string().min(1).max(50).default('package'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  type:  z.enum(['credit', 'debit', 'both']),
})

export const UpdateCategorySchema = CreateCategorySchema.partial()

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------

export const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(100).trim(),
})

export const UpdateBusinessSchema = CreateBusinessSchema.partial()

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const UpdateSettingsSchema = z.object({
  defaultCurrency: z.string().length(3).toUpperCase(),
})

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1),
})

export const RegisterSchema = z.object({
  username: z.string().min(2).max(50).trim(),
  email:    z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

// ---------------------------------------------------------------------------
// AI Recommendations
// ---------------------------------------------------------------------------

export const AIRecommendationsSchema = z.object({
  income:         positiveNumber,
  expenses:       z.number().min(0),
  balance:        z.number().default(0),
  savingsRate:    z.number().min(0).max(100).default(0),
  topCategories:  z.array(z.string()).default([]),
  currency:       z.string().length(3).default('INR'),
})

// ---------------------------------------------------------------------------
// Helper — parse and return 400 on failure
// ---------------------------------------------------------------------------

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T; error: null } | { data: null; error: Response } {
  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      data: null,
      error: Response.json({ error: 'Validation error', details: result.error.flatten() }, { status: 400 }),
    }
  }
  return { data: result.data, error: null }
}

export function parseQuery<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): { data: T; error: null } | { data: null; error: Response } {
  const raw = Object.fromEntries(searchParams.entries())
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      data: null,
      error: Response.json({ error: 'Invalid query params', details: result.error.flatten() }, { status: 400 }),
    }
  }
  return { data: result.data, error: null }
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases (used by existing API routes)
// ---------------------------------------------------------------------------
export const transactionSchema = CreateTransactionSchema
export const categorySchema    = CreateCategorySchema
export const businessSchema    = CreateBusinessSchema
export const settingsSchema    = UpdateSettingsSchema
