import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type ChoiceOption = {
  readonly value: string
  readonly label: string
  readonly hint?: string
  readonly icon?: LucideIcon
  readonly isDisabled?: boolean
}

export const OPTION_CARD_CLASS_NAME =
  "flex cursor-pointer flex-col gap-1 rounded-xl border-[1.5px] border-border bg-background p-3.5 text-sm font-semibold has-checked:border-primary has-checked:bg-primary/15 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50"

export const OPTION_LEGEND_CLASS_NAME = "mb-2.5 text-xs font-bold tracking-wider text-muted-foreground uppercase"

export function OptionContent({ option }: { option: ChoiceOption }) {
  const Icon = option.icon
  return (
    <>
      <span className="flex items-center gap-2">
        {Icon && <Icon aria-hidden className="size-4 text-primary" />}
        {option.label}
      </span>
      {option.hint && <span className="text-xs font-medium text-muted-foreground">{option.hint}</span>}
    </>
  )
}

type ChoiceGroupProps = {
  name: string
  legend: string
  options: readonly ChoiceOption[]
  value: string | null
  onValueChange: (value: string) => void
  columnsClassName?: string
  isLegendHidden?: boolean
}

export function ChoiceGroup({
  name,
  legend,
  options,
  value,
  onValueChange,
  columnsClassName = "sm:grid-cols-3",
  isLegendHidden = false,
}: ChoiceGroupProps) {
  return (
    <fieldset>
      <legend className={cn(OPTION_LEGEND_CLASS_NAME, isLegendHidden && "sr-only")}>{legend}</legend>
      <div className={cn("grid grid-cols-1 gap-2.5", columnsClassName)}>
        {options.map((option) => (
          <label key={option.value} className={OPTION_CARD_CLASS_NAME}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.isDisabled}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            <OptionContent option={option} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
