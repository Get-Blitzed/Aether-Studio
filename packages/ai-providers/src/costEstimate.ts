import type { JobUsageEstimate } from "./types.js";

/**
 * A deliberately rough, flat-rate cost estimate ($0.002 per 1,000 tokens
 * combined prompt+completion) -- real per-model pricing varies by provider
 * and changes over time, and this app doesn't maintain a pricing table.
 * This is directional usage/cost surfacing (spec's requirement), not a
 * billing-grade calculation.
 */
const FLAT_RATE_USD_PER_1K_TOKENS = 0.002;

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return ((promptTokens + completionTokens) / 1000) * FLAT_RATE_USD_PER_1K_TOKENS;
}

export function usageFromTokenCounts(promptTokens: number, completionTokens: number): JobUsageEstimate {
  return { promptTokens, completionTokens, estimatedCostUsd: estimateCostUsd(promptTokens, completionTokens) };
}
