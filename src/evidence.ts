import { createHash, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { safeAmount } from "./outcomes.js";

export interface ExpectedTransfer { chainId: number; asset: string; sender: string; recipient: string; amountMicro: number }
export interface ObservedTransfer extends ExpectedTransfer {}
export interface ChainEvidence { status: "pending" | "reverted" | "confirmed"; chainId: number; txHash: string; blockNumber?: string; transfers: ObservedTransfer[] }
export function verifyTransfers(expected: ExpectedTransfer, observed: ChainEvidence) {
  safeAmount(expected.amountMicro);
  if (observed.chainId !== expected.chainId) return { status: "mismatch" as const, receivedMicro: 0, unexpectedMicro: 0 };
  if (observed.status !== "confirmed") return { status: observed.status, receivedMicro: 0, unexpectedMicro: 0 };
  let receivedMicro = 0, unexpectedMicro = 0;
  for (const t of observed.transfers) {
    safeAmount(t.amountMicro);
    if (t.sender.toLowerCase() !== expected.sender.toLowerCase()) continue;
    if (t.recipient.toLowerCase() === expected.recipient.toLowerCase() && t.asset.toLowerCase() === expected.asset.toLowerCase() && t.chainId === expected.chainId) receivedMicro = safeAmount(receivedMicro + t.amountMicro);
    else unexpectedMicro = safeAmount(unexpectedMicro + t.amountMicro);
  }
  return { status: receivedMicro === expected.amountMicro && unexpectedMicro === 0 ? "verified" as const : "mismatch" as const, receivedMicro, unexpectedMicro };
}

export function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  throw new Error("Receipt must contain JSON values only");
}
export interface PortableReceipt { schema: "arc-growth-receipt/v1"; issuer: string; keyId: string; body: Record<string, unknown>; digest: string; signature: string | null }
function payload(r: Pick<PortableReceipt, "schema" | "issuer" | "keyId" | "body">) { return canonical({ schema: r.schema, issuer: r.issuer, keyId: r.keyId, body: r.body }); }
export function createReceipt(body: Record<string, unknown>, issuer: string, keyId: string, privateKey?: string | KeyObject): PortableReceipt {
  const header = { schema: "arc-growth-receipt/v1" as const, issuer, keyId, body };
  const bytes = Buffer.from(payload(header));
  if (privateKey) { const key = createPublicKey(privateKey); if (key.asymmetricKeyType !== "ed25519") throw new Error("Receipt keys must be Ed25519"); }
  return { ...header, digest: createHash("sha256").update(bytes).digest("hex"), signature: privateKey ? sign(null, bytes, privateKey).toString("base64") : null };
}
/** Trusted keys must come from the verifier's configuration, not from the receipt itself. */
export function verifyReceipt(receipt: PortableReceipt, trustedKeys: Record<string, { issuer: string; publicKey: string | KeyObject }>) {
  try {
    if (receipt.schema !== "arc-growth-receipt/v1") return { integrity: false, authenticated: false };
    const bytes = Buffer.from(payload(receipt));
    const integrity = createHash("sha256").update(bytes).digest("hex") === receipt.digest;
    const trusted = trustedKeys[receipt.keyId];
    const authenticated = !!(integrity && receipt.signature && trusted?.issuer === receipt.issuer && verify(null, bytes, trusted.publicKey, Buffer.from(receipt.signature, "base64")));
    return { integrity, authenticated };
  } catch { return { integrity: false, authenticated: false }; }
}
