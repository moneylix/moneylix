import { NextRequest, NextResponse } from 'next/server'
import dbQuery from '@/lib/db.async'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
// gemini-2.5-flash was retired by Google (404s with "no longer available to
// new users") — confirmed current as of 2026-09 via a live API check.
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`

/**
 * POST /api/bank/categorise
 * 
 * AI auto-categorises uncategorised bank transactions using Gemini.
 * Processes in batches of up to 50 transactions at a time.
 * 
 * Body: { connectionId?: number } (optional — defaults to all uncategorised)
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await dbQuery.get<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    )
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user_id

    // Categories are global (no business_id/user_id column on the table — same
    // list every user sees, confirmed via the categories schema and /api/categories).
    const categories = await dbQuery.all<{ id: number; name: string; type: string }>(
      `SELECT id, name, type FROM categories`
    )

    if (categories.length === 0) {
      return NextResponse.json({ error: 'No categories found. Add categories first.' }, { status: 400 })
    }

    // Get uncategorised transactions (batch of 50)
    const uncategorised = await dbQuery.all<{ id: number; narration: string; amount: number; type: string; date: string }>(
      `SELECT id, narration, amount, type, date FROM bank_transactions
       WHERE user_id = ? AND is_categorised = 0 AND narration IS NOT NULL AND narration != ''
       ORDER BY date DESC LIMIT 50`,
      [userId]
    )

    if (uncategorised.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All transactions are already categorised!',
        categorised: 0,
      })
    }

    // Build the prompt
    const categoryList = categories.map(c => `${c.name} (${c.type})`).join(', ')
    const txnList = uncategorised.map((t, i) =>
      `${i + 1}. "${t.narration}" — ₹${t.amount} ${t.type} on ${t.date}`
    ).join('\n')

    const prompt = `You are a financial transaction categoriser for an Indian personal finance app.

Available categories: ${categoryList}

For each transaction below, suggest the best matching category name from the list above.
Respond with ONLY a valid JSON array. Each element: { "index": number, "category": "category name", "confidence": 0.0-1.0 }

Transactions:
${txnList}

Rules:
- Match based on narration keywords (e.g., "SWIGGY" → Food, "AMAZON" → Shopping, "UPI/salary" → Income)
- If unsure, use confidence < 0.5
- category must be an EXACT match from the list above
- Return ONLY the JSON array, no markdown or explanation`

    // Call Gemini
    const aiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    })

    if (!aiRes.ok) {
      console.error('[bank/categorise] Gemini API error:', aiRes.status)
      return NextResponse.json({ error: 'AI service unavailable. Try again later.' }, { status: 502 })
    }

    const aiData = await aiRes.json()
    const responseText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse JSON response (handle potential markdown wrapping)
    let suggestions: Array<{ index: number; category: string; confidence: number }>
    try {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim()
      suggestions = JSON.parse(cleaned)
    } catch {
      console.error('[bank/categorise] Failed to parse AI response:', responseText.slice(0, 200))
      return NextResponse.json({ error: 'AI returned invalid response. Try again.' }, { status: 502 })
    }

    // Apply categorisations
    let categorised = 0
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))

    for (const suggestion of suggestions) {
      const txn = uncategorised[suggestion.index - 1]
      if (!txn) continue

      const categoryId = categoryMap.get(suggestion.category.toLowerCase())
      if (!categoryId) continue

      // Only auto-accept if confidence >= 0.7, otherwise just store suggestion
      const isHighConfidence = suggestion.confidence >= 0.7

      await dbQuery.run(
        `UPDATE bank_transactions 
         SET category_id = ?, ai_category_suggestion = ?, ai_confidence = ?, 
             is_categorised = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          isHighConfidence ? categoryId : null,
          suggestion.category,
          suggestion.confidence,
          isHighConfidence ? 1 : 0,
          txn.id,
        ]
      )
      if (isHighConfidence) categorised++
    }

    return NextResponse.json({
      success: true,
      message: `Categorised ${categorised} of ${uncategorised.length} transactions. ${uncategorised.length - categorised} need manual review.`,
      categorised,
      total: uncategorised.length,
      needsReview: uncategorised.length - categorised,
    })
  } catch (err) {
    console.error('[bank/categorise] Error:', err)
    return NextResponse.json({ error: 'Categorisation failed' }, { status: 500 })
  }
}
