import Anthropic from "@anthropic-ai/sdk"

export const DEFAULT_VISION_MODEL = "claude-sonnet-5-5"

export const DEFAULT_RANKING_MODEL = "claude-haiku-5-5"

export type TokenUsage = {
  readonly inputTokens: number
  readonly outputTokens: number
}

type ModelPrice = {
  readonly input: number
  readonly output: number
}

const MODEL_PRICES_USD_PER_MILLION: Readonly<Record<string, ModelPrice>> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
}

let sharedClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  sharedClient ??= new Anthropic()

  return sharedClient
}

export function getVisionModel(): string {
  const configured = process.env.ANTHROPIC_VISION_MODEL?.trim()

  return configured ? configured : DEFAULT_VISION_MODEL
}

export function getRankingModel(): string {
  const configured = process.env.ANTHROPIC_RANKING_MODEL?.trim()

  return configured ? configured : DEFAULT_RANKING_MODEL
}

export function estimateCostUsd(
  model: string,
  usage: TokenUsage
): number | null {
  const price = MODEL_PRICES_USD_PER_MILLION[model]

  if (!price) {
    return null
  }

  return (
    (usage.inputTokens * price.input + usage.outputTokens * price.output) /
    1_000_000
  )
}
