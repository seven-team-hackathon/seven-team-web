import { cn } from "@/lib/utils"
import {
  OPTION_CARD_CLASS_NAME,
  OPTION_LEGEND_CLASS_NAME,
  OptionContent,
  type ChoiceOption,
} from "@/components/planner/choice-group"

type CheckboxGroupProps = {
  legend: string
  options: readonly ChoiceOption[]
  values: readonly string[]
  onValuesChange: (values: string[]) => void
  columnsClassName?: string
  description?: string
}

export function CheckboxGroup({
  legend,
  options,
  values,
  onValuesChange,
  columnsClassName = "grid-cols-2 sm:grid-cols-3",
  description,
}: CheckboxGroupProps) {
  function handleToggle(value: string, isChecked: boolean) {
    onValuesChange(isChecked ? [...values, value] : values.filter((current) => current !== value))
  }

  return (
    <fieldset>
      <legend className={OPTION_LEGEND_CLASS_NAME}>{legend}</legend>
      {description && <p className="-mt-1.5 mb-2.5 text-sm text-muted-foreground">{description}</p>}
      <div className={cn("grid gap-2.5", columnsClassName)}>
        {options.map((option) => (
          <label key={option.value} className={OPTION_CARD_CLASS_NAME}>
            <input
              type="checkbox"
              value={option.value}
              checked={values.includes(option.value)}
              disabled={option.isDisabled}
              onChange={(event) => handleToggle(option.value, event.target.checked)}
              className="sr-only"
            />
            <OptionContent option={option} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
