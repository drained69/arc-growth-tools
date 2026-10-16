/** A separate application importing the toolkit by its package name. No GrowTendril app code. */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { reduceCommerce, eligiblePurchase } from "@growtendril/arc-growth-tools/commerce";
import { calculateReward } from "@growtendril/arc-growth-tools/outcomes";
import { evaluateSpend } from "@growtendril/arc-growth-tools/policy";
import { createReceipt, verifyReceipt } from "@growtendril/arc-growth-tools/evidence";

const now = Date.now();
const capture = {
  chainId: 5042,
  contract: `0x${"1".repeat(40)}`,
  paymentId: "example-order-1",
  txHash: `0x${"2".repeat(64)}`,
  logIndex: 0,
  blockNumber: "1",
  operation: "Charged",
  amountMicro: 50_000_000,
  occurredAt: new Date(now - 4 * 86_400_000).toISOString(),
};

// This event is a fixture. In production, verify its chain receipt and decoded contract log first.
const order = reduceCommerce([capture, capture]);
assert.equal(order.capturedMicro, 50_000_000); // A replay does not double-count.
const eligible = eligiblePurchase(order, Date.parse(capture.occurredAt), now, 72 * 3_600_000);
const reward = calculateReward(
  { baseMicro: 2_000_000, qualityBonusMicro: 1_000_000, outcomeBonusMicro: 500_000, outcomeCap: 2 },
  100,
  eligible ? 1 : 0,
);
const recipient = `0x${"3".repeat(40)}`;
const intent = { id: "reward-1", scope: "example-campaign", recipient, asset: "USDC", chainId: 5042, amountMicro: reward.totalMicro, category: "creator", expiresAt: now + 60_000 };
const policy = { frozen: false, allowedChains: [5042], allowedAssets: ["USDC"], allowedRecipients: [recipient], allowedCategories: ["creator"], hardLimitMicro: 10_000_000, budgetMicro: 20_000_000, dailyLimitMicro: 10_000_000, approvalAboveMicro: 0, alwaysReviewCategories: ["creator"] };
const decision = evaluateSpend(intent, policy, { committedMicro: 0, spentTodayMicro: 0 }, now);
assert.equal(decision.verdict, "APPROVAL_REQUIRED");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const receipt = createReceipt({ example: true, order, reward, policy: decision.verdict }, "example-merchant", "key-1", privateKey);
const checked = verifyReceipt(receipt, { "key-1": { issuer: "example-merchant", publicKey } });
assert.equal(checked.authenticated, true);

console.log(JSON.stringify({ mode: "FIXTURE — no chain read or payment", eligible, rewardMicro: reward.totalMicro, decision: decision.verdict, receiptAuthenticated: checked.authenticated }, null, 2));
