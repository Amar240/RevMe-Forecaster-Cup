'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface ValidatedNumberFieldProps {
  id: string
  label: React.ReactNode
  value: string
  onChange: (value: string) => void
  /** Returns a specific error message for the raw input, or null when it is acceptable. */
  validate: (raw: string) => string | null
  disabled?: boolean
  placeholder?: string
  /** Leading affix rendered inside the field, e.g. "$". */
  prefix?: string
  /** Optional normalization applied when the field loses focus, e.g. "189.5" → "189.50". */
  formatOnBlur?: (raw: string) => string
  labelClassName?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}

/**
 * A number input following the house validation standard: quiet while first typing, validates on
 * blur, then re-validates live so the error clears the instant the value becomes correct. Success is
 * silent (no green spray). Fully aria-wired for screen readers.
 */
export function ValidatedNumberField({
  id,
  label,
  value,
  onChange,
  validate,
  disabled,
  placeholder,
  prefix,
  formatOnBlur,
  labelClassName,
  inputMode = 'decimal',
}: ValidatedNumberFieldProps) {
  const [touched, setTouched] = React.useState(false)
  const error = validate(value)
  const showError = touched && error !== null
  const errorId = `${id}-error`

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelClassName}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{prefix}</span>
        ) : null}
        <Input
          id={id}
          type="text"
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            setTouched(true)
            if (formatOnBlur && value.trim() !== '') {
              const formatted = formatOnBlur(value)
              if (formatted !== value) onChange(formatted)
            }
          }}
          className={cn(prefix && 'pl-7', showError && 'border-error focus-visible:border-error focus-visible:ring-error/40')}
        />
      </div>
      {showError ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
