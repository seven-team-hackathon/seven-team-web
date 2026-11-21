"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  LayoutDashboardIcon,
  LockIcon,
  RulerIcon,
  SearchXIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { RecommendationResponse } from "@/lib/contracts/recommendation"
import type { RoomType } from "@/lib/contracts/room-type"
import { formatPrice } from "@/lib/format-price"
import { pluralize } from "@/lib/pluralize"
import { CATEGORY_META, FREE_CATEGORY_COUNT, ROOM_TYPE_META } from "@/lib/planner/options"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CategoryResult } from "@/components/planner/category-result"
import { PaywallDialog, type PaywallPlanId } from "@/components/planner/paywall-dialog"

const PURCHASE_MESSAGES: Readonly<Record<PaywallPlanId, string>> = {
  iteration: "Full selection unlocked",
  pro: "Pro subscription activated",
}

function FitSummary({ fit }: { fit: RecommendationResponse["fit"] }) {
  if (fit.allFit) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3.5 text-sm font-semibold text-success">
        <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
        Everything fits your room
      </p>
    )
  }

  return (
    <div role="alert" className="flex flex-col gap-1.5 rounded-xl bg-warning/10 p-3.5 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-warning" />
        Some things need a second look
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-10">
        {fit.issues.map((issue) => (
          <li key={`${issue.code}-${issue.articleNo ?? "all"}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  )
}

type ResultsStepProps = {
  roomType: RoomType
  recommendation: RecommendationResponse
  isUnlocked: boolean
  onUnlock: () => void
  onOpenLayout: () => void
}

export function ResultsStep({ roomType, recommendation, isUnlocked, onUnlock, onOpenLayout }: ResultsStepProps) {
  const [isPaywallOpen, setIsPaywallOpen] = useState(false)
  const { items, totals, fit, meta } = recommendation
  const unmatchedCategories = meta.unmatchedCategories ?? []
  const hasItems = items.length > 0
  const freeItems = isUnlocked ? items : items.slice(0, FREE_CATEGORY_COUNT)
  const lockedItems = isUnlocked ? [] : items.slice(FREE_CATEGORY_COUNT)
  const alternativeCount = items.reduce((sum, item) => sum + item.alternatives.length, 0)

  function handlePurchase(planId: PaywallPlanId) {
    onUnlock()
    setIsPaywallOpen(false)
    toast.success(PURCHASE_MESSAGES[planId])
  }

  function handleUnlockRequest() {
    setIsPaywallOpen(true)
  }

  return (
    <Card className="gap-6 [--card-spacing:--spacing(6)] sm:gap-8 sm:[--card-spacing:--spacing(10)]">
      <CardHeader className="justify-items-center gap-3 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
          Your {ROOM_TYPE_META[roomType].label.toLowerCase()} picks
        </CardTitle>
        <CardDescription className="text-base">
          {formatPrice(totals.price, totals.currency)} of {formatPrice(totals.budget, totals.currency)} budget ·{" "}
          {totals.floorUsagePct}% of the floor
        </CardDescription>
      </CardHeader>
      <CardContent className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {meta.dimensionsBasis === "estimated" && (
          <p className="flex gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm">
            <RulerIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            Room size was estimated from the photo and may be off. Check the item dimensions against your space before
            buying.
          </p>
        )}

        {unmatchedCategories.length > 0 && (
          <p className="flex gap-2.5 rounded-xl bg-secondary p-3.5 text-sm">
            <SearchXIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            Nothing fits this budget and space for{" "}
            {unmatchedCategories.map((category) => CATEGORY_META[category].label.toLowerCase()).join(", ")}. Try a higher
            budget.
          </p>
        )}

        {hasItems && <FitSummary fit={fit} />}

        {hasItems && (
          <Button size="lg" onClick={onOpenLayout} className="w-full sm:w-auto sm:self-center">
            <LayoutDashboardIcon data-icon="inline-start" aria-hidden />
            See it in your room
          </Button>
        )}

        {hasItems && !isUnlocked && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-terracotta/35 bg-terracotta/10 p-4 text-center sm:flex-row sm:text-left">
            <SparklesIcon aria-hidden className="size-5 shrink-0 text-terracotta" />
            <p className="flex-1 text-sm leading-relaxed">
              We found <b className="text-terracotta">{pluralize(items.length, "piece", "pieces")}</b> that fit and{" "}
              <b className="text-terracotta">{pluralize(alternativeCount, "alternative", "alternatives")}</b> to compare.
            </p>
            <Button size="lg" onClick={handleUnlockRequest} className="w-full sm:w-auto">
              Unlock all
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {freeItems.map((item) => (
            <CategoryResult
              key={item.category}
              recommendation={item}
              isUnlocked={isUnlocked}
              onUnlockRequest={handleUnlockRequest}
            />
          ))}
        </div>

        {lockedItems.length > 0 && (
          <div className="relative">
            <div aria-hidden inert className="pointer-events-none grid grid-cols-1 gap-6 blur-sm select-none md:grid-cols-2">
              {lockedItems.map((item) => (
                <CategoryResult key={item.category} recommendation={item} isUnlocked={false} onUnlockRequest={handleUnlockRequest} />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-linear-to-b from-card/20 to-card/90 to-40% p-4 text-center">
              <LockIcon aria-hidden className="mb-1 size-5 text-primary" />
              <p className="font-bold">{pluralize(lockedItems.length, "more piece", "more pieces")} for your room</p>
              <p className="mb-3 text-sm text-muted-foreground">Full selection with alternatives for every piece</p>
              <Button size="lg" onClick={handleUnlockRequest}>
                Unlock all
              </Button>
            </div>
          </div>
        )}

        <p className="flex gap-2 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="size-4 shrink-0" />
          Prices are national. Check stock and delivery for your ZIP code on the IKEA site.
        </p>
      </CardContent>
      <PaywallDialog isOpen={isPaywallOpen} onOpenChange={setIsPaywallOpen} onPurchase={handlePurchase} />
    </Card>
  )
}
