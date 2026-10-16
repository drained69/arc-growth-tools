# Escrow source licensing and deployed-source identity

The copyright holder of GrowTendril's original `OutcomeRewardsEscrow.sol` source and its Foundry test grants permission to use, modify and redistribute the copies in this standalone Arc Growth Tools repository under the [Apache License, Version 2.0](LICENSE).

The first line of those two Solidity files still reads `SPDX-License-Identifier: UNLICENSED`. That header is retained **only to keep the mainnet deployment's exact published source bytes and source hash reproducible**. It reflects the status when the contract was deployed, before this separate open-source release. For these repository copies, the explicit Apache-2.0 grant above is the current permission statement. The mainnet deployment manifest preserves the original SHA-256 and [Sourcify's exact-match record](https://repo.sourcify.dev/5042/0x2964E74d30413DE186f5F4936Eb133Ab815845D3).

Changing the SPDX header and recompiling would change Solidity metadata and no longer reproduce the deployed bytecode exactly. This grant does not change the deployed contract or imply that it has received an independent security audit.
