export interface RecipientChallenge { issuer: string; userId: string; invitationId: string; chainId: number; address: string; nonce: string; expiresAt: string }
/** Domain, account, invitation, network and address are all covered by the wallet signature. */
export function recipientMessage(c: RecipientChallenge) {
  if (!/^0x[\da-f]{40}$/i.test(c.address) || !Number.isSafeInteger(c.chainId) || c.chainId <= 0 || !Number.isFinite(Date.parse(c.expiresAt)) || !c.nonce || [c.issuer,c.userId,c.invitationId].some(s => !s || /[\r\n]/.test(s))) throw new Error("Invalid recipient challenge");
  return `Confirm creator payout wallet\nIssuer: ${c.issuer}\nAccount: ${c.userId}\nInvitation: ${c.invitationId}\nNetwork: eip155:${c.chainId}\nAddress: ${c.address.toLowerCase()}\nNonce: ${c.nonce}\nExpires: ${c.expiresAt}\nThis signature binds a payout address; it does not authorize a transfer.`;
}
