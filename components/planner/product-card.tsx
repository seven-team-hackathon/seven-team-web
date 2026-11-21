import { ExternalLinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecommendedItem } from "@/lib/contracts/recommendation"
import { formatPrice } from "@/lib/format-price"
import { CATEGORY_META, TONE_CLASS_NAMES } from "@/lib/planner/options"
import { buttonVariants } from "@/components/ui/button"

type ProductCardProps = {
  item: RecommendedItem
  isCompact?: boolean
}

export function ProductCard({ item, isCompact = false }: ProductCardProps) {
  const meta = CATEGORY_META[item.category]
  const Icon = meta.icon

  return (
    <article className="flex gap-3 rounded-xl border bg-background p-3">
      <div className={cn("grid size-14 flex-none place-items-center rounded-lg", TONE_CLASS_NAMES[meta.tone].tint, isCompact && "size-10")}>
        <Icon aria-hidden className={cn("size-6", isCompact && "size-5")} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h4 className="text-sm font-bold">{item.name}</h4>
        <p className="text-xs leading-snug text-muted-foreground">
          {item.typeName} · {item.widthCm}×{item.depthCm}×{item.heightCm} cm
        </p>
        {!isCompact && <p className="text-xs leading-snug text-muted-foreground">{item.reason}</p>}
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold">{formatPrice(item.price, item.currency)}</p>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-0 font-bold")}
          >
            View on IKEA
            <ExternalLinkIcon data-icon="inline-end" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  )
}
