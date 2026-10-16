/** SPDX-License-Identifier: Apache-2.0
 * Event ABI from circlefin/arc-ecommerce-payments contracts/artifacts/AuthCaptureEscrow.json.
 * Copyright 2026 Circle Internet Group, Inc. See THIRD_PARTY_NOTICES.md.
 */
export const COMMERCE_ABI = [
  {
    "type": "event",
    "name": "PaymentAuthorized",
    "inputs": [
      {
        "name": "paymentInfoHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "paymentInfo",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct AuthCaptureEscrow.PaymentInfo",
        "components": [
          {
            "name": "operator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "payer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "receiver",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "maxAmount",
            "type": "uint120",
            "internalType": "uint120"
          },
          {
            "name": "preApprovalExpiry",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "authorizationExpiry",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "refundExpiry",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "minFeeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "maxFeeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "feeReceiver",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "salt",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "tokenCollector",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentCaptured",
    "inputs": [
      {
        "name": "paymentInfoHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "feeBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "feeReceiver",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentCharged",
    "inputs": [
      {
        "name": "paymentInfoHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "paymentInfo",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct AuthCaptureEscrow.PaymentInfo",
        "components": [
          {
            "name": "operator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "payer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "receiver",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "maxAmount",
            "type": "uint120",
            "internalType": "uint120"
          },
          {
            "name": "preApprovalExpiry",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "authorizationExpiry",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "refundExpiry",
            "type": "uint48",
            "internalType": "uint48"
          },
          {
            "name": "minFeeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "maxFeeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "feeReceiver",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "salt",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "tokenCollector",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "feeBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "feeReceiver",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentReclaimed",
    "inputs": [
      {
        "name": "paymentInfoHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentRefunded",
    "inputs": [
      {
        "name": "paymentInfoHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "tokenCollector",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentVoided",
    "inputs": [
      {
        "name": "paymentInfoHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
] as const;
