import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Try models in order of preference. gemini-2.5-flash/2.0-flash/1.5-flash were
// retired by Google (they now 404 with "no longer available to new users") —
// confirmed current as of 2026-09 via a live ListModels + generateContent check.
const MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { income, expenses, balance, savingsRate, topCategories, currency } = body

    if (!income || expenses === undefined) {
      return NextResponse.json({ error: 'Missing required financial data' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      console.error('[AI] No GEMINI_API_KEY found in environment variables')
      return NextResponse.json({ error: 'AI service not configured. Add GEMINI_API_KEY to .env.local' }, { status: 500 })
    }

    const prompt = `You are a personal finance advisor for Indian markets.
Analyze this financial data and respond with ONLY a valid JSON object:

{
  "savings": ["tip1", "tip2", "tip3", "tip4", "tip5"],
  "investments": {
    "gold": "gold advice with amounts",
    "sip": "SIP/mutual fund advice",
    "fd": "FD advice with rates"
  },
  "summary": "2-3 sentence assessment",
  "riskProfile": "conservative",
  "monthlyInvestmentCapacity": 5000
}

Financial data:
- Monthly Income: ${currency} ${income.toLocaleString()}
- Monthly Expenses: ${currency} ${expenses.toLocaleString()}
- Current Balance: ${currency} ${balance.toLocaleString()}
- Savings Rate: ${savingsRate.toFixed(1)}%

Respond with ONLY the JSON, no markdown, no extra text.`

    // Try each model until one works
    let lastError = ''
    for (const model of MODELS) {
      try {
        const url = `${BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // Gemini 3.x flash models spend part of maxOutputTokens on internal
            // "thinking" before writing the answer — 1024 wasn't leaving enough
            // room for both, truncating the JSON mid-response. thinkingConfig
            // isn't safe here (gemini-3.6-flash 400s if you try to disable
            // thinking, unlike 3.5), so just give every model in the fallback
            // chain enough headroom for thinking + the actual JSON output.
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
          })
        })

        if (!res.ok) {
          const errText = await res.text()
          console.warn(`[AI] ${model} failed (${res.status}):`, errText.slice(0, 200))
          lastError = `${model}: ${res.status}`
          continue // Try next model
        }

        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.warn(`[AI] ${model} returned non-JSON:`, text.slice(0, 200))
          lastError = `${model}: invalid JSON response`
          continue
        }

        const recommendations = JSON.parse(jsonMatch[0])
        console.log(`[AI] Success with ${model}`)
        return NextResponse.json(recommendations)
      } catch (modelErr: any) {
        console.warn(`[AI] ${model} error:`, modelErr.message)
        lastError = `${model}: ${modelErr.message}`
        continue
      }
    }

    // All models failed
    console.error('[AI] All models failed. Last error:', lastError)
    return NextResponse.json({ error: 'AI service unavailable. Check your GEMINI_API_KEY.' }, { status: 500 })
  } catch (error: any) {
    console.error('[AI] Unexpected error:', error?.message || error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
