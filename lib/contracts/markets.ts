import { z } from "zod"

export const marketSchema = z.enum(["us"])

export const currencySchema = z.enum(["USD"])

export type Market = z.infer<typeof marketSchema>

export type Currency = z.infer<typeof currencySchema>

export type MarketConfig = {
  readonly currency: Currency
  readonly ikeaSite: string
}

export const marketConfigs: Readonly<Record<Market, MarketConfig>> = {
  us: { currency: "USD", ikeaSite: "us/en" },
}
