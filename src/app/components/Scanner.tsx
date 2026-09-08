'use client'

import React, { useState, useRef } from 'react'
import { createWorker } from 'tesseract.js'
import { Camera, Upload, Loader2, Check, X, AlertCircle } from 'lucide-react'

interface ScannerProps {
  onScanComplete: (data: { amount: string; date: string; note: string; category?: string }) => void
  onClose: () => void
}

export function Scanner({ onScanComplete, onClose }: ScannerProps) {
  const [image, setImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
    setError(null)
  }

  const parseReceiptText = (text: string) => {
    // Basic regex for amounts (looking for lines with 'total', 'grand total', 'amount')
    const amountRegex = /(?:TOTAL|TOTAL AMOUNT|AMOUNT|GRAND TOTAL|NET)[:\s]*₹?\s*(\d+[.,]\d{2})/gi
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g
    
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    let detectedAmount = ''
    let detectedDate = ''
    
    // Search for amount
    for (const line of lines) {
      const match = amountRegex.exec(line)
      if (match && match[1]) {
        detectedAmount = match[1].replace(',', '.')
        break
      }
    }

    // fallback: find the largest number that looks like an amount
    if (!detectedAmount) {
      const numbers = text.match(/\d+[.,]\d{2}/g)
      if (numbers) {
        const sortedNumbers = numbers.map(n => parseFloat(n.replace(',', '.'))).sort((a, b) => b - a)
        if (sortedNumbers.length > 0) detectedAmount = sortedNumbers[0].toString()
      }
    }

    // Search for date
    const dateMatch = text.match(dateRegex)
    if (dateMatch) {
      detectedDate = dateMatch[0]
      try {
        const d = new Date(detectedDate)
        if (!isNaN(d.getTime())) detectedDate = d.toISOString().split('T')[0]
      } catch (e) {}
    } else {
      detectedDate = new Date().toISOString().split('T')[0]
    }

    // Attempt to find a merchant name (top of receipt usually)
    const merchantLines = lines.filter(l => l.length > 3 && !/\d{5,}/.test(l) && !/total|date|items|tax|cash|change|receipt/i.test(l))
    const detectedMerchant = merchantLines[0] || 'Scanned Bill'

    // Simple category keyword matching
    const categoryKeywords: Record<string, string[]> = {
      'Food & Dining': ['restaurant', 'cafe', 'food', 'hotel', 'dining', 'kitchen', 'pizza', 'burger', 'coffee', 'starbucks', 'mcdonald'],
      'Shopping': ['amazon', 'flipkart', 'walmart', 'mall', 'store', 'supermarket', 'grocery', 'mart', 'retail'],
      'Transportation': ['uber', 'ola', 'petrol', 'fuel', 'garage', 'transport', 'auto', 'taxi', 'parking'],
      'Utilities': ['bill', 'electricity', 'water', 'power', 'internet', 'mobile', 'recharge'],
      'Healthcare': ['pharmacy', 'medical', 'hospital', 'doctor', 'clinic', 'medicine'],
    }

    let suggestedCategory = 'Other'
    const fullText = text.toLowerCase()
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => fullText.includes(k))) {
        suggestedCategory = cat
        break
      }
    }

    return { amount: detectedAmount, date: detectedDate, note: detectedMerchant, category: suggestedCategory }
  }

  const processImage = async () => {
    if (!image) return
    setIsProcessing(true)
    setProgress(0)
    
    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        }
      })
      
      const { data: { text } } = await worker.recognize(image)
      await worker.terminate()

      console.log('Scanned Text:', text)
      const scannedData = parseReceiptText(text)
      onScanComplete(scannedData)
    } catch (err) {
      console.error(err)
      setError('Failed to scan image. Please try again with a clearer photo.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!image ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/10 rounded-2xl bg-white/5 aspect-[4/3] flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <Camera className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white">Upload Bill Image</p>
            <p className="text-xs text-slate-500 mt-1">Tap/Click to scan receipt</p>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" capture="environment" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
              <img src={image} alt="Receipt" className="max-h-full object-contain" />
              <button 
                onClick={() => setImage(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {!isProcessing ? (
              <button 
                onClick={processImage}
                className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition"
              >
                <Upload className="w-4 h-4" /> Analyze Receipt
              </button>
            ) : (
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex flex-col items-center text-center">
                  <div className="relative w-16 h-16 mb-4">
                    <Loader2 className="w-16 h-16 text-emerald-500 animate-spin opacity-20" />
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      {progress}%
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white mb-1">Scanning Receipt</p>
                  <p className="text-xs text-slate-400">Extracting amount and date using AI OCR...</p>
                  
                  <div className="w-full h-1 bg-white/5 rounded-full mt-6 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-white/10 flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition text-xs font-medium">
          Cancel
        </button>
      </div>
    </div>
  )
}
