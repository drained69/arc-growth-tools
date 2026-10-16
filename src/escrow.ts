import { ESCROW_RUNTIME, ESCROW_IMMUTABLE_RANGES } from "./escrow-artifact.js";
export { OUTCOME_ESCROW_ABI } from "./escrow-artifact.js";
/** Check the compiled runtime while ignoring only Solidity's declared immutable slots. */
export function isOutcomeEscrowCode(code: string) {
  const mask = (raw: string) => {
    const chars = raw.replace(/^0x/, "").toLowerCase().split("");
    for (const { start, length } of ESCROW_IMMUTABLE_RANGES) chars.fill("0", start * 2, (start + length) * 2);
    return chars.join("");
  };
  return /^0x[\da-f]+$/i.test(code) && mask(code) === mask(ESCROW_RUNTIME);
}
