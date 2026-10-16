/** Integer micro-USDC. Never accept floating token amounts in reward calculations. */
export function safeAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Amount must be a nonnegative safe integer");
  return value;
}

export interface RewardTerms { baseMicro: number; qualityBonusMicro: number; outcomeBonusMicro: number; outcomeCap: number }
export function calculateReward(terms: RewardTerms, score: number, outcomes: number) {
  [terms.baseMicro, terms.qualityBonusMicro, terms.outcomeBonusMicro, terms.outcomeCap].forEach(safeAmount);
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error("Quality score must be an integer from 0 to 100");
  safeAmount(outcomes);
  const baseMicro = terms.baseMicro;
  const qualityMicro = Number(BigInt(terms.qualityBonusMicro) * BigInt(score) / 100n);
  const eligibleOutcomes = Math.min(outcomes, terms.outcomeCap);
  const outcomeMicro = safeAmount(terms.outcomeBonusMicro * eligibleOutcomes);
  return { baseMicro, qualityMicro, outcomeMicro, eligibleOutcomes, totalMicro: safeAmount(baseMicro + qualityMicro + outcomeMicro) };
}

export interface PurchaseFact {
  id: string; type: string; orderId: string | null; customerId: string | null; valueMicro: number; occurredAt: Date;
}
/** Refunds match an order within the caller's merchant/workspace scope, never by amount. */
export function netPurchases<T extends PurchaseFact>(facts: readonly T[]): { purchases: T[]; refundedMicro: number; unmatchedRefunds: number } {
  const refunds = new Map<string, number>();
  const key = (f:PurchaseFact) => JSON.stringify([f.customerId,f.orderId]);
  const orders = new Set(facts.filter(f => f.type === "purchase" && f.orderId).map(key));
  let unmatchedRefunds = 0;
  for (const f of facts) {
    safeAmount(f.valueMicro);
    if (f.type !== "refund") continue;
    if (!f.orderId || !orders.has(key(f))) { unmatchedRefunds++; continue; }
    refunds.set(key(f), safeAmount((refunds.get(key(f)) ?? 0) + f.valueMicro));
  }
  let refundedMicro = 0;
  const purchases = facts.filter(f => f.type === "purchase").map(f => {
    const refund = f.orderId ? Math.min(f.valueMicro, refunds.get(key(f)) ?? 0) : 0;
    if (f.orderId) refunds.set(key(f), (refunds.get(key(f)) ?? 0) - refund);
    refundedMicro = safeAmount(refundedMicro + refund);
    return { ...f, valueMicro: f.valueMicro - refund };
  });
  return { purchases, refundedMicro, unmatchedRefunds };
}
