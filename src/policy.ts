import { safeAmount } from "./outcomes.js";

export interface SpendIntent { id: string; scope: string; recipient: string; asset: string; chainId: number; amountMicro: number; category: string; expiresAt: number }
export interface SpendPolicy { frozen: boolean; allowedChains: number[]; allowedAssets: string[]; allowedRecipients: string[]; allowedCategories: string[]; hardLimitMicro: number; budgetMicro: number; dailyLimitMicro: number; approvalAboveMicro: number; alwaysReviewCategories: string[] }
export interface SpendState { committedMicro: number; spentTodayMicro: number }
export interface SpendApproval { intent: SpendIntent; approver: string; approvedAt: number }
export type SpendVerdict = "ALLOW" | "APPROVAL_REQUIRED" | "DENY";
export function sameIntent(a: SpendIntent, b: SpendIntent) {
  return a.id === b.id && a.scope === b.scope && a.recipient.toLowerCase() === b.recipient.toLowerCase() && a.asset === b.asset && a.chainId === b.chainId && a.amountMicro === b.amountMicro && a.category === b.category && a.expiresAt === b.expiresAt;
}
/** Pure evaluation. Approval authentication and atomic reservations belong to the host. */
export function evaluateSpend(intent: SpendIntent, policy: SpendPolicy, state: SpendState, now: number, approval?: SpendApproval): { verdict: SpendVerdict; reasons: string[] } {
  [intent.amountMicro, policy.hardLimitMicro, policy.budgetMicro, policy.dailyLimitMicro, policy.approvalAboveMicro, state.committedMicro, state.spentTodayMicro].forEach(safeAmount);
  const reasons: string[] = [];
  if (!intent.id || !intent.scope || !Number.isSafeInteger(intent.chainId) || !Number.isFinite(intent.expiresAt) || !Number.isFinite(now) || intent.amountMicro <= 0) reasons.push("Invalid intent");
  if (policy.frozen) reasons.push("Spending is frozen");
  if (now >= intent.expiresAt) reasons.push("Intent expired");
  if (!policy.allowedChains.includes(intent.chainId) || !policy.allowedAssets.includes(intent.asset)) reasons.push("Network or asset not permitted");
  if (!policy.allowedRecipients.some(r => r.toLowerCase() === intent.recipient.toLowerCase())) reasons.push("Recipient not permitted");
  if (!policy.allowedCategories.includes(intent.category)) reasons.push("Category not permitted");
  if (intent.amountMicro > policy.hardLimitMicro) reasons.push("Hard payment limit exceeded");
  if (BigInt(state.committedMicro) + BigInt(intent.amountMicro) > BigInt(policy.budgetMicro)) reasons.push("Budget exceeded");
  if (BigInt(state.spentTodayMicro) + BigInt(intent.amountMicro) > BigInt(policy.dailyLimitMicro)) reasons.push("Daily limit exceeded");
  if (approval && (!sameIntent(intent, approval.intent) || !approval.approver || !Number.isFinite(approval.approvedAt) || approval.approvedAt > now || approval.approvedAt >= intent.expiresAt)) reasons.push("Approval does not bind this valid intent");
  if (reasons.length) return { verdict: "DENY", reasons };
  const review = intent.amountMicro > policy.approvalAboveMicro || policy.alwaysReviewCategories.includes(intent.category);
  return { verdict: review && !approval ? "APPROVAL_REQUIRED" : "ALLOW", reasons: review && !approval ? ["Human approval required"] : [] };
}

export interface ReservationStore {
  /** Must execute work under a database transaction + lock for scope, including the wallet call's claim. */
  locked<T>(scope: string, work: () => Promise<T>): Promise<T>;
  get(id: string): Promise<{ intent: SpendIntent; state: "reserved" | "executing" | "submitted"; txHash?: string } | null>;
  state(scope: string): Promise<SpendState>;
  put(intent: SpendIntent, state: "reserved" | "executing" | "submitted", txHash?: string): Promise<void>;
}
/** Reserve an exact intent once. This function never sends money. */
export async function reserveSpend(store: ReservationStore, intent: SpendIntent, policy: SpendPolicy, now: number, approval?: SpendApproval) {
  return store.locked(intent.scope, async () => {
    const existing = await store.get(intent.id);
    if (existing) { if (!sameIntent(existing.intent, intent)) throw new Error("Idempotency key reused for a different intent"); return { duplicate: true, state: existing.state, verdict: "ALLOW" as SpendVerdict }; }
    const result = evaluateSpend(intent, policy, await store.state(intent.scope), now, approval);
    if (result.verdict === "ALLOW") await store.put(intent, "reserved");
    return { duplicate: false, state: result.verdict === "ALLOW" ? "reserved" : null, ...result };
  });
}

export interface SpendWallet { send(intent: SpendIntent, idempotencyKey: string): Promise<{ txHash: string }> }
/** Claim under lock, send outside the transaction, persist the submission. Ambiguous failures stay executing for reconciliation. */
export async function executeReservedSpend(store: ReservationStore, intent: SpendIntent, policy: () => Promise<SpendPolicy>, now: () => number, wallet: SpendWallet, approval?: SpendApproval) {
  const claim = await store.locked(intent.scope, async () => {
    const entry = await store.get(intent.id);
    if (!entry || !sameIntent(entry.intent, intent)) throw new Error("No matching reservation");
    if (entry.state !== "reserved") return { claimed: false, state: entry.state, txHash: entry.txHash };
    const state = await store.state(intent.scope);
    // Store totals include this reservation; count it exactly once during re-evaluation.
    const withoutCurrent = { committedMicro: safeAmount(state.committedMicro - intent.amountMicro), spentTodayMicro: safeAmount(state.spentTodayMicro - intent.amountMicro) };
    const result = evaluateSpend(intent, await policy(), withoutCurrent, now(), approval);
    if (result.verdict !== "ALLOW") throw new Error(result.reasons.join("; "));
    await store.put(intent, "executing");
    return { claimed: true, state: "executing" as const, txHash: undefined as string | undefined };
  });
  if (!claim.claimed) return claim;
  const sent = await wallet.send(intent, `${intent.scope}:${intent.id}`);
  if (!/^0x[\da-f]{64}$/i.test(sent.txHash)) throw new Error("Wallet returned no valid transaction hash; reconcile this execution before retrying");
  await store.locked(intent.scope, async () => { await store.put(intent, "submitted", sent.txHash); });
  return { claimed: true, state: "submitted" as const, txHash: sent.txHash };
}
