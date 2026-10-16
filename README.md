# Arc growth tools

Small TypeScript tools for builders connecting Arc commerce to measured growth and controlled spending. The [standalone source repository](https://github.com/drained69/arc-growth-tools) is public, independently buildable and licensed under [Apache-2.0](LICENSE). It has no runtime dependencies; import a focused subpath such as `@growtendril/arc-growth-tools/commerce`. The root entry also exports Node.js receipt signing helpers and is intended for server runtimes. The package has **not** been published to npm; clone the repository or install it from a reviewed Git commit.

In the standalone toolkit repository, build, test, and run the independent example:

```sh
npm ci
npm test
npm --prefix examples/independent-builder install
npm --prefix examples/independent-builder run demo
```

The [independent example](examples/independent-builder/README.md) imports the package by name without GrowTendril application code. Its default commerce flow uses fixtures and sends no transaction. It also includes a **read-only Arc mainnet ERC-20 USDC transfer verifier** that accepts a real transaction hash and exact expected sender, recipient, and amount; it cannot sign or broadcast. Neither example claims a real merchant sale or real creator payout.

## Compose a flow

1. Your chain adapter verifies the network, successful transaction receipt, canonical block, contract address and decoded event. Supply those facts as `CommerceEvent[]` to `reduceCommerce`. Use `commerceEventKey` as a unique database key and replay the full sorted history whenever a new log arrives. Do not accept event amounts or status from a merchant webhook alone.
2. Use `eligiblePurchase` after a refund hold. Match later refunds through `netPurchases` using both customer and order IDs. Feed the resulting outcome count and review score into `calculateReward`.
3. Build a `SpendIntent` with a globally unique ID, exact recipient and amount. `evaluateSpend` is pure; `reserveSpend` and `executeReservedSpend` require a durable `ReservationStore` whose `locked` operation is a serialized database transaction per scope. The store's totals must include reservations until reconciliation, including across day boundaries. Authenticating the approver and binding the `SpendApproval` to the exact intent is the host's responsibility. An `executing` reservation is ambiguous and must be reconciled from the wallet or chain before any retry.
4. Check the submitted transfer against expected chain, token, sender, recipient and amount with `verifyTransfers`. Create a portable receipt with `createReceipt`; consumers should call `verifyReceipt` using an externally trusted issuer key. An unsigned receipt proves only digest integrity, not issuer identity.

All monetary values in these tools use integer micro-USDC (6 decimal places), the precision of Arc's ERC-20 USDC interface. Arc's native gas balance has 18 decimals and must be converted separately.

`escrow` exports the ABI and deployed-bytecode matcher for the `OutcomeRewardsEscrow` prototype. The standalone repository also includes its Solidity source, tests and deployment manifests under `contracts/`. The original Solidity files retain a historical `UNLICENSED` SPDX header to preserve the exact deployed-source hash; [the copyright holder's Apache-2.0 grant for the public copies](CONTRACT_LICENSE.md) explains this. Contract actions require an explicitly connected wallet. A host must verify the deployment's chain, bytecode, token and hold period before using it. The current mainnet contract is deployed but is not a live payout route; the contract has not had an independent security audit. The included `commerce-abi` reproduces the relevant event definitions from Circle's `AuthCaptureEscrow` reference; its [notice](THIRD_PARTY_NOTICES.md) and [Apache license](LICENSES/Apache-2.0.txt) are included.

## What this adds to Arc references

Circle's [arc-commerce](https://github.com/circlefin/arc-commerce) demonstrates USDC credit purchases, and [arc-p2p-payments](https://github.com/circlefin/arc-p2p-payments) demonstrates wallet-to-wallet transfers. This toolkit adds the **business logic between an observed sale and a controlled reward**: replay-safe capture/refund reduction, a refund-aware eligibility hold, a bounded reward calculation, serializable spend reservations with exact-intent approval, transfer matching, and issuer-authenticated portable receipts. It does not reimplement the Circle wallet, x402, or bridge protocols. Builders can use individual subpaths without adopting GrowTendril's UI or database.

## Package and trust boundaries

| Module | Pure or stateful | Host responsibility |
| --- | --- | --- |
| `commerce`, `outcomes`, `recipient` | Pure | Verify original chain logs and associate an order with a referral using trustworthy merchant data. |
| `policy` | Pure evaluation plus an adapter interface | Implement a durable, per-scope transaction lock and authenticate approvals. Reconcile any ambiguous `executing` state before retry. |
| `evidence` | Pure transfer comparison and Node.js receipt signing | Supply canonical chain evidence and a trusted issuer key registry obtained outside the receipt. |
| `escrow` | ABI and bytecode data | Review the contract, verify its deployment configuration, connect a wallet, and obtain independent security review before production funds. |

All monetary calculations use safe integer micro-USDC. The sample verifier reads only ERC-20 `Transfer` logs; native-value Arc USDC movements need a separate adapter. A payment authorization, a seller response, and a confirmed on-chain transfer are distinct states.
