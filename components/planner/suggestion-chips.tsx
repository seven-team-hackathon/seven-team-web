import { CheckIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FurnitureCategory } from "@/lib/contracts/furniture-category"
import { CATEGORY_META } from "@/lib/planner/options"
import { Button } from "@/components/ui/button"

type SuggestionChipsProps = {
  categories: readonly FurnitureCategory[]
  selected: ReadonlySet<string>
  onToggle: (category: FurnitureCategory) => void
}

export function SuggestionChips({ categories, selected, onToggle }: SuggestionChipsProps) {
  return (
    <ul aria-label="Suggestions" className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const isSelected = selected.has(category)
        const Icon = isSelected ? CheckIcon : PlusIcon
        return (
          <li key={category}>
            <Button
              variant="outline"
              size="lg"
              aria-pressed={isSelected}
              onClick={() => onToggle(category)}
              className={cn("rounded-full", isSelected && "border-primary bg-primary/15 text-primary hover:bg-primary/20")}
            >
              <Icon data-icon="inline-start" aria-hidden />
              {CATEGORY_META[category].label}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
