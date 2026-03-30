import type { Repository, CategoryMeta, RepoCategory } from "./types";

export const CATEGORIES: CategoryMeta[] = [
  { name: "Ethereum Core", icon: "diamond" },
  { name: "Consensus Clients", icon: "shield-check" },
  { name: "Execution Clients", icon: "server" },
  { name: "Validator Tooling", icon: "wrench" },
];

export const REPOSITORIES: Repository[] = [
  // Ethereum Core
  {
    owner: "ethereum",
    name: "go-ethereum",
    description: "Go implementation of the Ethereum protocol",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/go-ethereum",
  },
  {
    owner: "ethereum",
    name: "solidity",
    description: "Solidity, the Smart Contract Programming Language",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/solidity",
  },

  // Consensus Clients
  {
    owner: "prysmaticlabs",
    name: "prysm",
    description: "Ethereum consensus client written in Go",
    category: "Consensus Clients",
    url: "https://github.com/prysmaticlabs/prysm",
  },
  {
    owner: "sigp",
    name: "lighthouse",
    description: "Ethereum consensus client written in Rust",
    category: "Consensus Clients",
    url: "https://github.com/sigp/lighthouse",
  },
  {
    owner: "ChainSafe",
    name: "lodestar",
    description: "Ethereum consensus client written in TypeScript",
    category: "Consensus Clients",
    url: "https://github.com/ChainSafe/lodestar",
  },
  {
    owner: "status-im",
    name: "nimbus-eth2",
    description: "Ethereum consensus client written in Nim",
    category: "Consensus Clients",
    url: "https://github.com/status-im/nimbus-eth2",
  },
  {
    owner: "ConsenSys",
    name: "teku",
    description: "Ethereum consensus client written in Java",
    category: "Consensus Clients",
    url: "https://github.com/ConsenSys/teku",
  },

  // Execution Clients
  {
    owner: "NethermindEth",
    name: "nethermind",
    description: "Ethereum execution client written in C#/.NET",
    category: "Execution Clients",
    url: "https://github.com/NethermindEth/nethermind",
  },
  {
    owner: "erigontech",
    name: "erigon",
    description: "Ethereum execution client written in Go",
    category: "Execution Clients",
    url: "https://github.com/erigontech/erigon",
  },
  {
    owner: "hyperledger",
    name: "besu",
    description: "Ethereum execution client written in Java",
    category: "Execution Clients",
    url: "https://github.com/hyperledger/besu",
  },
  {
    owner: "paradigmxyz",
    name: "reth",
    description: "Ethereum execution client written in Rust",
    category: "Execution Clients",
    url: "https://github.com/paradigmxyz/reth",
  },

  // Validator Tooling
  {
    owner: "attestantio",
    name: "vouch",
    description: "Multi-node Ethereum validator client",
    category: "Validator Tooling",
    url: "https://github.com/attestantio/vouch",
  },
  {
    owner: "attestantio",
    name: "dirk",
    description: "Ethereum distributed remote keymanager",
    category: "Validator Tooling",
    url: "https://github.com/attestantio/dirk",
  },
  {
    owner: "ConsenSys",
    name: "web3signer",
    description: "Remote signing service for Ethereum validators",
    category: "Validator Tooling",
    url: "https://github.com/ConsenSys/web3signer",
  },
  {
    owner: "ObolNetwork",
    name: "charon",
    description: "Distributed validator middleware for Ethereum",
    category: "Validator Tooling",
    url: "https://github.com/ObolNetwork/charon",
  },
  {
    owner: "eth-educators",
    name: "eth-docker",
    description: "Docker automation for Ethereum nodes",
    category: "Validator Tooling",
    url: "https://github.com/eth-educators/eth-docker",
  },
  {
    owner: "NethermindEth",
    name: "sedge",
    description: "One-click Ethereum node setup tool",
    category: "Validator Tooling",
    url: "https://github.com/NethermindEth/sedge",
  },
];

export const REPOS_BY_CATEGORY: Record<RepoCategory, Repository[]> =
  CATEGORIES.reduce(
    (acc, category) => {
      acc[category.name] = REPOSITORIES.filter(
        (repo) => repo.category === category.name,
      );
      return acc;
    },
    {} as Record<RepoCategory, Repository[]>,
  );
