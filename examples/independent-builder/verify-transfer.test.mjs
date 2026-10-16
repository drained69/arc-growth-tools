import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const hash = `0x${"a".repeat(64)}`;
const from = `0x${"1".repeat(40)}`;
const to = `0x${"2".repeat(40)}`;

async function run(amount) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--import", new URL("./mock-rpc.test.mjs", import.meta.url).pathname,
      new URL("./verify-transfer.mjs", import.meta.url).pathname,
      hash, from, to, amount,
    ]);
    let stdout = "", stderr = "";
    child.stdout.on("data", part => stdout += part);
    child.stderr.on("data", part => stderr += part);
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

test("read-only verifier accepts a canonical exact transfer and rejects a mismatched amount", async () => {
  const exact = await run("2.00");
  assert.equal(exact.code, 0, exact.stderr);
  assert.equal(JSON.parse(exact.stdout).result.status, "verified");
  const mismatch = await run("3.00");
  assert.equal(mismatch.code, 1, mismatch.stderr);
  assert.equal(JSON.parse(mismatch.stdout).result.status, "mismatch");
});
