import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { reduceCommerce, eligiblePurchase } from "../dist/commerce.js";
import { calculateReward } from "../dist/outcomes.js";
import { evaluateSpend, reserveSpend, executeReservedSpend } from "../dist/policy.js";
import { verifyTransfers, createReceipt, verifyReceipt } from "../dist/evidence.js";

const address = `0x${"1".repeat(40)}`;
const hash = `0x${"2".repeat(64)}`;
const event = (operation, amountMicro, logIndex) => ({ chainId: 5042, contract: address, paymentId: "order-1", txHash: hash, logIndex, blockNumber: "1", occurredAt: "2026-10-16T00:00:00Z", operation, amountMicro });

test("replay and refund preserve one net purchase", () => {
  const capture = event("Charged", 10_000_000, 0);
  const refund = event("Refunded", 4_000_000, 1);
  const order = reduceCommerce([refund, capture, capture]);
  assert.equal(order.capturedMicro, 10_000_000);
  assert.equal(order.refundedMicro, 4_000_000);
  assert.equal(order.status, "partially_refunded");
  assert.equal(eligiblePurchase(order, 0, 72 * 3_600_000, 72 * 3_600_000), true);
  assert.throws(() => reduceCommerce([capture, { ...capture, amountMicro: 9_000_000 }]), /Conflicting/);
  assert.equal(calculateReward({ baseMicro: 1_000_000, qualityBonusMicro: 500_000, outcomeBonusMicro: 250_000, outcomeCap: 1 }, 100, 1).totalMicro, 1_750_000);
});

test("approval cannot override a hard policy rule", () => {
  const intent = { id: "reward", scope: "campaign", recipient: address, asset: "USDC", chainId: 5042, amountMicro: 5, category: "creator", expiresAt: 100 };
  const policy = { frozen: false, allowedChains: [5042], allowedAssets: ["USDC"], allowedRecipients: [address], allowedCategories: ["creator"], hardLimitMicro: 10, budgetMicro: 10, dailyLimitMicro: 10, approvalAboveMicro: 0, alwaysReviewCategories: ["creator"] };
  const approval = { intent, approver: "owner", approvedAt: 1 };
  assert.equal(evaluateSpend(intent, policy, { committedMicro: 0, spentTodayMicro: 0 }, 2).verdict, "APPROVAL_REQUIRED");
  assert.equal(evaluateSpend(intent, policy, { committedMicro: 0, spentTodayMicro: 0 }, 2, approval).verdict, "ALLOW");
  assert.equal(evaluateSpend(intent, { ...policy, frozen: true }, { committedMicro: 0, spentTodayMicro: 0 }, 2, approval).verdict, "DENY");
  assert.equal(evaluateSpend({ ...intent, amountMicro: 11 }, policy, { committedMicro: 0, spentTodayMicro: 0 }, 2, approval).verdict, "DENY");
});

test("reservation and execution call an injected wallet once", async () => {
  const intent = { id: "reward", scope: "campaign", recipient: address, asset: "USDC", chainId: 5042, amountMicro: 5, category: "creator", expiresAt: 100 };
  const policy = { frozen: false, allowedChains: [5042], allowedAssets: ["USDC"], allowedRecipients: [address], allowedCategories: ["creator"], hardLimitMicro: 10, budgetMicro: 10, dailyLimitMicro: 10, approvalAboveMicro: 10, alwaysReviewCategories: [] };
  const entries = new Map();
  let lock = Promise.resolve();
  const store = {
    async locked(_scope, work) { const previous = lock; let release; lock = new Promise(r => { release = r; }); await previous; try { return await work(); } finally { release(); } },
    async get(id) { return entries.get(id) ?? null; },
    async state() { const total = [...entries.values()].reduce((n, item) => n + item.intent.amountMicro, 0); return { committedMicro: total, spentTodayMicro: total }; },
    async put(i, state, txHash) { entries.set(i.id, { intent: i, state, txHash }); },
  };
  assert.equal((await reserveSpend(store, intent, policy, 1)).verdict, "ALLOW");
  let sends = 0;
  const wallet = { async send() { sends++; return { txHash: hash }; } };
  await Promise.all([executeReservedSpend(store, intent, async () => policy, () => 2, wallet), executeReservedSpend(store, intent, async () => policy, () => 2, wallet)]);
  assert.equal(sends, 1);
  assert.equal(entries.get(intent.id).state, "submitted");
});

test("payment evidence and receipt require exact transfer and trusted key", () => {
  const expected = { chainId: 5042, asset: "USDC", sender: address, recipient: `0x${"3".repeat(40)}`, amountMicro: 5 };
  const observed = { status: "confirmed", chainId: 5042, txHash: hash, transfers: [expected] };
  assert.equal(verifyTransfers(expected, observed).status, "verified");
  assert.equal(verifyTransfers(expected, { ...observed, transfers: [...observed.transfers, { ...expected, recipient: address, amountMicro: 1 }] }).status, "mismatch");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const receipt = createReceipt({ txHash: hash }, "merchant", "key-1", privateKey);
  assert.deepEqual(verifyReceipt(receipt, { "key-1": { issuer: "merchant", publicKey } }), { integrity: true, authenticated: true });
  assert.deepEqual(verifyReceipt(receipt, {}), { integrity: true, authenticated: false });
});
