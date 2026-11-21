import { LockIcon } from "lucide-react"
import type { CategoryRecommendation } from "@/lib/contracts/recommendation"
import { pluralize } from "@/lib/pluralize"
import { CATEGORY_META } from "@/lib/planner/options"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/planner/product-card"

type CategoryResultProps = {
  recommendation: CategoryRecommendation
  isUnlocked: boolean
  onUnlockRequest: () => void
}

export function CategoryResult({ recommendation, isUnlocked, onUnlockRequest }: CategoryResultProps) {
  const meta = CATEGORY_META[recommendation.category]
  const Icon = meta.icon
  const alternativeCount = recommendation.alternatives.length

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 font-bold">
        <Icon aria-hidden className="size-4 text-primary" />
        {meta.label}
      </h3>
      <ProductCard item={recommendation.primary} />
      {alternativeCount > 0 && isUnlocked && (
        <div className="flex flex-col gap-2 pl-3">
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Alternatives</p>
          {recommendation.alternatives.map((item) => (
            <ProductCard key={item.articleNo} item={item} isCompact />
          ))}
        </div>
      )}
      {alternativeCount > 0 && !isUnlocked && (
        <Button variant="ghost" size="lg" onClick={onUnlockRequest} className="justify-start text-muted-foreground">
          <LockIcon data-icon="inline-start" aria-hidden />
          {pluralize(alternativeCount, "alternative", "alternatives")}
        </Button>
      )}
    </section>
  )
}
