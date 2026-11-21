"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type PaywallPlanId = "iteration" | "pro"

type PaywallPlan = {
  readonly id: PaywallPlanId
  readonly title: string
  readonly description: string
  readonly price: string
  readonly isRecommended: boolean
}

const PAYWALL_PLANS: readonly PaywallPlan[] = [
  {
    id: "iteration",
    title: "One-time purchase",
    description: "this room, every piece with alternatives",
    price: "$5.99",
    isRecommended: false,
  },
  {
    id: "pro",
    title: "Monthly",
    description: "unlimited rooms and selections",
    price: "$19.99/mo",
    isRecommended: true,
  },
]

type PaywallDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onPurchase: (planId: PaywallPlanId) => void
}

export function PaywallDialog({ isOpen, onOpenChange, onPurchase }: PaywallDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Unlock the full selection</DialogTitle>
          <DialogDescription>Choose how to continue</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2.5">
          {PAYWALL_PLANS.map((plan) => (
            <li
              key={plan.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border-[1.5px] border-border bg-muted p-3.5 sm:flex-row sm:items-center sm:justify-between",
                plan.isRecommended && "border-primary bg-primary/10",
              )}
            >
              <div className="flex flex-col gap-0.5">
                <p className="flex items-center gap-2 font-bold">
                  {plan.title}
                  {plan.isRecommended && (
                    <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                      best value
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>
              <Button
                variant={plan.isRecommended ? "default" : "outline"}
                size="lg"
                onClick={() => onPurchase(plan.id)}
                className="w-full sm:w-auto"
              >
                {plan.price}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
