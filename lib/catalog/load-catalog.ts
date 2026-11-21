import { z } from "zod"

import { buildIkeaUrl } from "@/lib/catalog/build-ikea-url"
import usListingsJson from "@/lib/catalog/listings/us.json"
import { marketListingSchema } from "@/lib/catalog/market-listing"
import type { MarketListing } from "@/lib/catalog/market-listing"
import { productSchema } from "@/lib/catalog/product"
import type { Product } from "@/lib/catalog/product"
import productsJson from "@/lib/catalog/products.json"
import type { Market } from "@/lib/contracts/markets"

export type CatalogItem = Product & {
  readonly price: number
  readonly currency: MarketListing["currency"]
  readonly priceFetchedAt: string
  readonly url: string
}

export type CatalogData = {
  readonly products: readonly Product[]
  readonly listings: readonly MarketListing[]
}

const productsSchema = z.array(productSchema)

const listingsSchema = z.array(marketListingSchema)

const listingsByMarket: Readonly<Record<Market, unknown>> = {
  us: usListingsJson,
}

const catalogCache = new Map<Market, readonly CatalogItem[]>()

export function parseCatalogData(
  productsData: unknown,
  listingsData: unknown
): CatalogData {
  return {
    products: productsSchema.parse(productsData),
    listings: listingsSchema.parse(listingsData),
  }
}

export function buildCatalog(
  data: CatalogData,
  market: Market
): readonly CatalogItem[] {
  const productsByArticleNo = new Map(
    data.products.map((product) => [product.articleNo, product])
  )
  const items: CatalogItem[] = []

  for (const listing of data.listings) {
    if (listing.market !== market || !listing.available) {
      continue
    }

    const product = productsByArticleNo.get(listing.articleNo)

    if (!product) {
      continue
    }

    items.push({
      ...product,
      price: listing.price,
      currency: listing.currency,
      priceFetchedAt: listing.priceFetchedAt,
      url: buildIkeaUrl(market, listing.articleNo),
    })
  }

  return items
}

export function loadCatalog(market: Market): readonly CatalogItem[] {
  const cached = catalogCache.get(market)

  if (cached) {
    return cached
  }

  const data = parseCatalogData(productsJson, listingsByMarket[market])
  const catalog = buildCatalog(data, market)

  catalogCache.set(market, catalog)

  return catalog
}
