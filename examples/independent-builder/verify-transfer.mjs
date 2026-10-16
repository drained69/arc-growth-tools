/** Read-only Arc mainnet ERC-20 USDC receipt verifier. Never signs or sends a transaction. */
import { verifyTransfers } from "@growtendril/arc-growth-tools/evidence";

const [hash, sender, recipient, amountUsdc] = process.argv.slice(2);
const address = /^0x[\da-f]{40}$/i;
if (!/^0x[\da-f]{64}$/i.test(hash ?? "") || !address.test(sender ?? "") || !address.test(recipient ?? "") || !/^\d+(\.\d{1,6})?$/.test(amountUsdc ?? "")) {
  console.error("Usage: npm run verify-transfer -- <tx-hash> <sender> <recipient> <amount-usdc>");
  process.exit(2);
}

const rpc = process.env.ARC_MAINNET_RPC || "https://rpc.mainnet.arc.io";
let requestId = 0;
async function rpcCall(method, params = []) {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Arc RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`Arc RPC ${method}: ${body.error.message ?? "request failed"}`);
  if (body.result === undefined) throw new Error(`Arc RPC ${method} returned no result`);
  return body.result;
}

const chainId = Number(BigInt(await rpcCall("eth_chainId")));
if (chainId !== 5042) throw new Error(`Expected Arc mainnet (5042), got ${chainId}`);
const receipt = await rpcCall("eth_getTransactionReceipt", [hash]);
if (!receipt?.blockNumber || !receipt.blockHash) throw new Error("Transaction has no mined receipt");
const canonicalBlock = await rpcCall("eth_getBlockByNumber", [receipt.blockNumber, false]);
if (canonicalBlock.hash !== receipt.blockHash) throw new Error("Receipt block is no longer canonical");
const blockNumber = BigInt(receipt.blockNumber);
const latest = BigInt(await rpcCall("eth_blockNumber"));
if (latest - blockNumber < 6n) throw new Error("Wait for at least six later blocks before checking this transfer");

const usdc = "0x3600000000000000000000000000000000000000";
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const transfers = receipt.logs.flatMap((log) => {
  if (log.address.toLowerCase() !== usdc.toLowerCase()) return [];
  if (log.topics?.length !== 3 || log.topics[0].toLowerCase() !== transferTopic || !/^0x[\da-f]{64}$/i.test(log.data)) return [];
  const value = BigInt(log.data);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Transfer exceeds supported amount");
  return [{ chainId, asset: usdc, sender: `0x${log.topics[1].slice(-40)}`, recipient: `0x${log.topics[2].slice(-40)}`, amountMicro: Number(value) }];
});
const [whole, fraction = ""] = amountUsdc.split(".");
const expectedMicro = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
if (expectedMicro > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Expected amount exceeds supported precision");
const result = verifyTransfers(
  { chainId, asset: usdc, sender, recipient, amountMicro: Number(expectedMicro) },
  { status: receipt.status === "0x1" ? "confirmed" : "reverted", chainId, txHash: hash, blockNumber: blockNumber.toString(), transfers },
);
console.log(JSON.stringify({ network: "Arc mainnet", txHash: hash, blockNumber: blockNumber.toString(), confirmations: (latest - blockNumber + 1n).toString(), result }, null, 2));
if (result.status !== "verified") process.exitCode = 1;
