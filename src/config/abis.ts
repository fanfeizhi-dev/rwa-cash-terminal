export const erc20Abi = [
  {
    "constant": false,
    "inputs": [
      { "name": "_spender", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const balancerVaultAbi = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "poolId", "type": "bytes32" },
      { "internalType": "address", "name": "sender", "type": "address" },
      { "internalType": "address", "name": "recipient", "type": "address" },
      {
        "components": [
          { "internalType": "contract IAsset[]", "name": "assets", "type": "address[]" },
          { "internalType": "uint256[]", "name": "maxAmountsIn", "type": "uint256[]" },
          { "internalType": "bytes", "name": "userData", "type": "bytes" },
          { "internalType": "bool", "name": "fromInternalBalance", "type": "bool" }
        ],
        "internalType": "struct IVault.JoinPoolRequest",
        "name": "request",
        "type": "tuple"
      }
    ],
    "name": "joinPool",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

export const balancerVaultReadAbi = [
  {
    inputs: [{ name: "poolId", type: "bytes32" }],
    name: "getPoolTokens",
    outputs: [
      { name: "tokens", type: "address[]" },
      { name: "balances", type: "uint256[]" },
      { name: "lastChangeBlock", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const eip4626VaultAbi = [
  {
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    name: "deposit",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    name: "withdraw",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    name: "redeem",
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const eip4626VaultReadAbi = [
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assets", type: "uint256" }],
    name: "convertToShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "asset",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "currentAprBps",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const balancerPoolReadAbi = [
  {
    inputs: [],
    name: "getNormalizedWeights",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPoolId",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const whitelistRegistryAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "isWhitelisted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const erc20ReadAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
