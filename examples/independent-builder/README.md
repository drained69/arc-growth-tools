# Independent Arc builder example

This small project is a separate consumer of `@growtendril/arc-growth-tools`. It imports the package by name and uses none of GrowTendril's Next.js application, database, authentication, or server aliases.

From the standalone toolkit repository root:

```sh
npm run build
npm --prefix examples/independent-builder install
npm --prefix examples/independent-builder run demo
```

The demo uses **fixture commerce events and sends no transaction**. It shows idempotent event reduction, a 72-hour eligibility hold, reward calculation, a human-review decision, and a signed receipt with an independently supplied verification key. A real application must validate merchant contract logs and authenticated approval before accepting them as evidence.

For a **real, read-only Arc mainnet check**, supply the transaction hash and expected sender, recipient, and USDC amount of an ERC-20 `Transfer` that you are permitted to disclose:

```sh
npm --prefix examples/independent-builder run verify-transfer -- 0xTRANSACTION_HASH 0xSENDER 0xRECIPIENT 2.00
```

The verifier checks chain ID 5042, a canonical successful transaction receipt, six later blocks, USDC contract logs, and the exact expected transfer. It exits nonzero for pending, reverted, mismatched, or unsupported evidence. This example handles **ERC-20 USDC `Transfer` logs only**; Arc native-value USDC transfers require an additional system-log adapter. It never signs, broadcasts, or spends funds.

The verified transfer is a payment-evidence demonstration, **not** proof that a creator reward arose from a real merchant sale. For a production outcome-to-payout flow, supply a chain-verified merchant capture/refund adapter, a durable reservation store, an authenticated approver, a wallet adapter with idempotency and reconciliation, and a trusted receipt key registry. See the [toolkit integration guide](../../README.md).
