"use client"

import { ArmchairIcon, LampFloorIcon, SofaIcon, SproutIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"

const HOPPING_FURNITURE = [
  { id: "sofa", icon: SofaIcon },
  { id: "armchair", icon: ArmchairIcon },
  { id: "lamp", icon: LampFloorIcon },
  { id: "plant", icon: SproutIcon },
] as const
const HOP_DELAY_MS = 200
const MESSAGE_INTERVAL_MS = 1800
const DEFAULT_TITLE = "Finding furniture for your room"
const DEFAULT_MESSAGES = [
  "Searching the IKEA catalog…",
  "Checking sizes against your room…",
  "Matching your style…",
  "Comparing prices with your budget…",
  "Writing why each piece fits…",
]

type RecommendLoaderProps = {
  title?: string
  messages?: readonly string[]
}

export function RecommendLoader({ title = DEFAULT_TITLE, messages = DEFAULT_MESSAGES }: RecommendLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((index) => (index + 1) % messages.length)
    }, MESSAGE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [messages.length])

  return (
    <Card className="[--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(10)]">
      <CardContent role="status" className="flex flex-1 flex-col items-center justify-center gap-8 py-14 text-center">
        <div aria-hidden className="flex items-end gap-3 sm:gap-4">
          {HOPPING_FURNITURE.map(({ id, icon: Icon }, index) => (
            <div
              key={id}
              style={{ animationDelay: `${index * HOP_DELAY_MS}ms` }}
              className="grid size-14 animate-furniture-hop place-items-center rounded-2xl border border-border bg-muted text-primary motion-reduce:animate-none sm:size-16"
            >
              <Icon className="size-7 sm:size-8" />
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          <p key={messageIndex} className="min-h-6 animate-message-in text-muted-foreground motion-reduce:animate-none">
            {messages[messageIndex]}
          </p>
        </div>

        <div aria-hidden className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/5 animate-loader-sweep rounded-full bg-primary motion-reduce:w-full motion-reduce:animate-none" />
        </div>
      </CardContent>
    </Card>
  )
}
