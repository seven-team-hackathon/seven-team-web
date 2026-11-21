import { z } from "zod"

import { articleNoSchema } from "@/lib/catalog/product"
import { currencySchema, marketSchema } from "@/lib/contracts/markets"

export const marketListingSchema = z.object({
  articleNo: articleNoSchema,
  market: marketSchema,
  available: z.boolean(),
  price: z.number().nonnegative(),
  currency: currencySchema,
  priceFetchedAt: z.iso.datetime(),
})

export type MarketListing = z.infer<typeof marketListingSchema>
