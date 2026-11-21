"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type NumberFieldProps = {
  label: string
  unit: string
  value: string
  onValueChange: (value: string) => void
  min?: number
  max?: number
  isRequired?: boolean
  isInvalid?: boolean
}

export function NumberField({
  label,
  unit,
  value,
  onValueChange,
  min,
  max,
  isRequired = false,
  isInvalid = false,
}: NumberFieldProps) {
  const id = useId()

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          required={isRequired}
          aria-invalid={isInvalid}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="h-11 pr-14"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
        >
          {unit}
        </span>
      </div>
    </div>
  )
}
