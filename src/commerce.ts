import { safeAmount } from "./outcomes.js";

export const COMMERCE_OPERATIONS = ["Authorized", "Captured", "Charged", "Voided", "Reclaimed", "Refunded"] as const;
export type CommerceOperation = typeof COMMERCE_OPERATIONS[number];
export interface CommerceEvent {
  chainId: number; contract: string; paymentId: string; txHash: string; logIndex: number; blockNumber: string;
  operation: CommerceOperation; amountMicro: number; occurredAt: string;
}
export interface CommerceOrder {
  authorizedMicro: number; capturedMicro: number; refundedMicro: number;
  status: "reserved" | "partially_captured" | "paid" | "partially_refunded" | "refunded" | "voided" | "expired";
}
export function commerceEventKey(e: CommerceEvent) { return `${e.chainId}:${e.contract.toLowerCase()}:${e.txHash.toLowerCase()}:${e.logIndex}`; }

/** Replay in chain order. Callers verify receipts and deduplicate atomically before storage. */
export function reduceCommerce(events: readonly CommerceEvent[]): CommerceOrder {
  const state: CommerceOrder = { authorizedMicro: 0, capturedMicro: 0, refundedMicro: 0, status: "reserved" };
  const seen = new Map<string, string>();
  let identity: string | undefined;
  const sorted = [...events].sort((a,b) => BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : BigInt(a.blockNumber) > BigInt(b.blockNumber) ? 1 : a.logIndex - b.logIndex);
  for (const e of sorted) {
    safeAmount(e.amountMicro);
    if (!Number.isSafeInteger(e.chainId) || e.chainId <= 0 || !Number.isSafeInteger(e.logIndex) || e.logIndex < 0 || !/^\d+$/.test(e.blockNumber) || !Number.isFinite(Date.parse(e.occurredAt))) throw new Error("Invalid chain event identity");
    if (!/^0x[\da-f]{40}$/i.test(e.contract) || !/^0x[\da-f]{64}$/i.test(e.txHash) || !e.paymentId) throw new Error("Invalid payment identity");
    const owner = `${e.chainId}:${e.contract.toLowerCase()}:${e.paymentId}`;
    identity ??= owner;
    if (owner !== identity) throw new Error("Mixed payment identities");
    const key = commerceEventKey(e), content = JSON.stringify({ ...e, contract: e.contract.toLowerCase(), txHash: e.txHash.toLowerCase() });
    if (seen.has(key)) { if (seen.get(key) !== content) throw new Error("Conflicting replay"); continue; }
    seen.set(key, content);
    switch(e.operation) {
      case "Authorized":
        if (state.authorizedMicro || state.capturedMicro) throw new Error("Payment already authorized");
        state.authorizedMicro = e.amountMicro; break;
      case "Charged":
        if (state.authorizedMicro || state.capturedMicro) throw new Error("Payment already authorized");
        state.authorizedMicro = e.amountMicro; state.capturedMicro = e.amountMicro; break;
      case "Captured":
        if (["voided", "expired"].includes(state.status)) throw new Error("Authorization is closed");
        state.capturedMicro = safeAmount(state.capturedMicro + e.amountMicro);
        if (state.capturedMicro > state.authorizedMicro) throw new Error("Capture exceeds authorization");
        break;
      case "Refunded":
        state.refundedMicro = safeAmount(state.refundedMicro + e.amountMicro);
        if (state.refundedMicro > state.capturedMicro) throw new Error("Refund exceeds captured payment");
        break;
      case "Voided": state.status = "voided"; break;
      case "Reclaimed": state.status = "expired"; break;
      default: throw new Error("Unsupported commerce operation");
    }
    if (!["voided", "expired"].includes(state.status)) state.status = state.refundedMicro > 0 ? (state.refundedMicro === state.capturedMicro ? "refunded" : "partially_refunded") : state.capturedMicro > 0 ? (state.capturedMicro === state.authorizedMicro ? "paid" : "partially_captured") : "reserved";
  }
  return state;
}

export function eligiblePurchase(order: CommerceOrder, capturedAt: number, now: number, holdMs: number, minimumMicro = 1) {
  safeAmount(holdMs); safeAmount(minimumMicro);
  return ["paid", "partially_refunded"].includes(order.status) && order.capturedMicro - order.refundedMicro >= minimumMicro && now >= capturedAt + holdMs;
}
