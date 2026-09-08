'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calculator, X } from 'lucide-react';
import { cn } from '@/lib/utils/format';
import Input from './Input';

interface CalculatorInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefix?: string;
  onValueChange?: (value: number) => void;
}

export default function CalculatorInput({ label, error, prefix, onValueChange, value, onChange, className, ...props }: CalculatorInputProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [display, setDisplay] = useState('');
  const [equation, setEquation] = useState('');
  const calcRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calcRef.current && !calcRef.current.contains(event.target as Node)) {
        setShowCalc(false);
      }
    };
    if (showCalc) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalc]);

  const handleButtonClick = (val: string) => {
    if (val === 'C') {
      setDisplay('');
      setEquation('');
    } else if (val === '=') {
      try {
        // Simple eval-like logic (cleaner for a basic calc)
        // eslint-disable-next-line no-eval
        const result = eval(equation.replace('×', '*').replace('÷', '/').replace('%', '/100*'));
        setDisplay(result.toString());
        setEquation(result.toString());
      } catch (e) {
        setDisplay('Error');
      }
    } else {
      setEquation(prev => prev + val);
      setDisplay(prev => prev + val);
    }
  };

  const applyValue = () => {
    const numericValue = parseFloat(display);
    if (!isNaN(numericValue)) {
      if (onValueChange) onValueChange(numericValue);
      // Trigger a fake event for the original onChange
      if (onChange) {
        const event = {
          target: { value: numericValue.toString() },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    }
    setShowCalc(false);
  };

  const buttons = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '%', '+'],
    ['C', '=', 'Apply'],
  ];

  return (
    <div className="relative w-full" ref={calcRef}>
      <div className="relative">
        <div className="relative group">
          {prefix && (
            <div className="absolute left-4 top-[38px] -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-green)] transition-colors font-mono text-xl">
              {prefix}
            </div>
          )}
          <Input
            {...props}
            label={label}
            error={error}
            value={value}
            onChange={onChange}
            className={cn("pr-12", prefix && "pl-10", className)}
            type="number"
            step="any"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCalc(!showCalc)}
          className="absolute right-3 top-[32px] p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-green)] transition-colors"
        >
          <Calculator size={18} />
        </button>
      </div>

      {showCalc && (
        <div className="absolute z-50 top-full mt-2 right-0 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3 w-64 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Calculator</span>
            <button onClick={() => setShowCalc(false)} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]">
              <X size={14} />
            </button>
          </div>

          <div className="bg-[var(--background)] p-3 rounded-lg mb-3 text-right">
            <div className="text-[10px] text-[var(--text-muted)] h-4 overflow-hidden text-ellipsis">{equation || '0'}</div>
            <div className="text-xl font-bold number-font truncate">{display || '0'}</div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {buttons.map((row, i) => (
              <React.Fragment key={i}>
                {row.map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => btn === 'Apply' ? applyValue() : handleButtonClick(btn)}
                    className={cn(
                      "p-2 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95",
                      btn === 'Apply' ? "col-span-2 bg-[var(--accent-green)] text-white hover:brightness-110" :
                      ['+', '-', '×', '÷', '%', '=', 'C'].includes(btn) ? "bg-[var(--border)] text-[var(--accent-green)]" :
                      "bg-[var(--background)] text-[var(--text-primary)] hover:border-[var(--border)] border border-transparent"
                    )}
                  >
                    {btn}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
