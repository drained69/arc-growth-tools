/** Offline JSON-RPC fixture injected only by verify-transfer.test.mjs. */
const from = `0x${"1".repeat(40)}`;
const to = `0x${"2".repeat(40)}`;
const blockHash = `0x${"b".repeat(64)}`;
const usdc = "0x3600000000000000000000000000000000000000";
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

globalThis.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  const result = {
    eth_chainId: "0x13b2",
    eth_getTransactionReceipt: { status: "0x1", blockNumber: "0x10", blockHash, logs: [{ address: usdc, topics: [transferTopic, `0x${from.slice(2).padStart(64, "0")}`, `0x${to.slice(2).padStart(64, "0")}`], data: `0x${(2_000_000).toString(16).padStart(64, "0")}` }] },
    eth_getBlockByNumber: { hash: blockHash },
    eth_blockNumber: "0x17",
  }[body.method];
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200, headers: { "content-type": "application/json" } });
};
