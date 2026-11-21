import { marketConfigs } from "@/lib/contracts/markets"
import type { Market } from "@/lib/contracts/markets"

export function buildIkeaUrl(market: Market, articleNo: string): string {
  return `https://www.ikea.com/${marketConfigs[market].ikeaSite}/p/-${articleNo}/`
}
