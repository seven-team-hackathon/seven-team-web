import type {
  RecommendRequest,
  RecommendationResponse,
  RecommendedItem,
} from "@/lib/contracts/recommendation"
import type { SpaceDraft } from "@/lib/contracts/space"

const mockProductUrl = "https://www.ikea.com/us/en/"

type MockItemInput = Omit<RecommendedItem, "currency" | "url">

function buildMockItem(input: MockItemInput): RecommendedItem {
  return { ...input, currency: "USD", url: mockProductUrl }
}

export const spaceDraftPlanFixture: SpaceDraft = {
  kind: "plan",
  roomType: "living-room",
  dimensions: {
    widthCm: 420,
    lengthCm: 380,
    ceilingHeightCm: 250,
    source: "plan-labels",
    confidence: 0.9,
  },
  openings: [
    { type: "door", widthCm: 90, wall: "south" },
    { type: "window", widthCm: 150, wall: "north" },
  ],
  styleHints: [],
  needsUserInput: [],
}

export const spaceDraftPhotoFixture: SpaceDraft = {
  kind: "photo",
  roomType: "bedroom",
  dimensions: {
    widthCm: 350,
    lengthCm: 300,
    source: "estimated",
    confidence: 0.3,
  },
  openings: [{ type: "window" }],
  styleHints: ["light walls", "wooden floor"],
  needsUserInput: ["dimensions"],
}

export const recommendRequestFixture: RecommendRequest = {
  space: {
    roomType: "living-room",
    dimensions: { widthCm: 420, lengthCm: 380, ceilingHeightCm: 250 },
    openings: [
      { type: "door", widthCm: 90, wall: "south" },
      { type: "window", widthCm: 150, wall: "north" },
    ],
  },
  preferences: {
    market: "us",
    roomType: "living-room",
    style: "scandinavian",
    household: { hasChildren: false, hasPets: true },
    budget: 1500,
    categories: ["sofa", "coffee-table", "tv-unit"],
    note: "Light colors, we have a cat",
  },
}

export const recommendationFixture: RecommendationResponse = {
  items: [
    {
      category: "sofa",
      primary: buildMockItem({
        articleNo: "mock-sofa-1",
        name: "Sample sofa A (mock)",
        typeName: "3-seat sofa",
        category: "sofa",
        widthCm: 220,
        depthCm: 90,
        heightCm: 85,
        price: 599,
        reason:
          "Light fabric and a compact depth suit a living room of this size, and the cover is easy to clean with a cat.",
      }),
      alternatives: [
        buildMockItem({
          articleNo: "mock-sofa-2",
          name: "Sample sofa B (mock)",
          typeName: "3-seat sofa",
          category: "sofa",
          widthCm: 210,
          depthCm: 88,
          heightCm: 82,
          price: 579,
          reason: "Slightly narrower and cheaper, with a similar light look.",
        }),
        buildMockItem({
          articleNo: "mock-sofa-3",
          name: "Sample sofa C (mock)",
          typeName: "3-seat sofa",
          category: "sofa",
          widthCm: 230,
          depthCm: 95,
          heightCm: 84,
          price: 649,
          reason: "Deeper seat for more comfort, still within the budget.",
        }),
      ],
    },
    {
      category: "coffee-table",
      primary: buildMockItem({
        articleNo: "mock-table-1",
        name: "Sample coffee table A (mock)",
        typeName: "Coffee table",
        category: "coffee-table",
        widthCm: 90,
        depthCm: 55,
        heightCm: 45,
        price: 99,
        reason:
          "Rounded corners and a light wood finish match the Scandinavian style.",
      }),
      alternatives: [
        buildMockItem({
          articleNo: "mock-table-2",
          name: "Sample coffee table B (mock)",
          typeName: "Coffee table",
          category: "coffee-table",
          widthCm: 80,
          depthCm: 50,
          heightCm: 42,
          price: 79,
          reason: "A smaller option that leaves more walking space.",
        }),
      ],
    },
    {
      category: "tv-unit",
      primary: buildMockItem({
        articleNo: "mock-tv-1",
        name: "Sample TV unit A (mock)",
        typeName: "TV unit",
        category: "tv-unit",
        widthCm: 160,
        depthCm: 40,
        heightCm: 50,
        price: 149,
        reason: "Fits the free wall and keeps cables hidden.",
      }),
      alternatives: [
        buildMockItem({
          articleNo: "mock-tv-2",
          name: "Sample TV unit B (mock)",
          typeName: "TV unit",
          category: "tv-unit",
          widthCm: 140,
          depthCm: 38,
          heightCm: 48,
          price: 129,
          reason: "A shorter unit that saves some budget.",
        }),
      ],
    },
  ],
  totals: {
    price: 847,
    currency: "USD",
    budget: 1500,
    floorUsagePct: 19.5,
  },
  fit: { allFit: true, issues: [] },
  usage: { inputTokens: 3200, outputTokens: 650, estimatedCostUsd: 0.012 },
  meta: { rankedBy: "claude" },
}
