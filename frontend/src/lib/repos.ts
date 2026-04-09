// Copyright © 2026 Miguel Tenorio Potrony - AntiD2ta.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { Repository, CategoryMeta, RepoCategory } from "./types";

export const CATEGORIES: CategoryMeta[] = [
  { name: "Ethereum Core", icon: "diamond" },
  { name: "Execution Clients", icon: "cpu" },
  { name: "Consensus Clients", icon: "radio" },
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
  {
    owner: "ethereum",
    name: "EIPs",
    description: "The Ethereum Improvement Proposal repository",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/EIPs",
  },
  {
    owner: "attestantio",
    name: "go-eth2-client",
    description: "Go client for Ethereum consensus layer APIs",
    category: "Ethereum Core",
    url: "https://github.com/attestantio/go-eth2-client",
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
  {
    owner: "grandinetech",
    name: "grandine",
    description: "High performance Ethereum consensus client written in Rust",
    category: "Consensus Clients",
    url: "https://github.com/grandinetech/grandine",
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
  {
    owner: "dappnode",
    name: "DAppNode",
    description: "General purpose node management platform",
    category: "Validator Tooling",
    url: "https://github.com/dappnode/DAppNode",
  },
  {
    owner: "coincashew",
    name: "EthPillar",
    description: "Ethereum staking node setup tool and management TUI",
    category: "Validator Tooling",
    url: "https://github.com/coincashew/EthPillar",
  },
  {
    owner: "stereum-dev",
    name: "ethereum-node",
    description: "Ethereum node setup and manager with GUI",
    category: "Validator Tooling",
    url: "https://github.com/stereum-dev/ethereum-node",
  },
  {
    owner: "ethpandaops",
    name: "ethereum-package",
    description: "Kurtosis package for portable Ethereum devnets",
    category: "Validator Tooling",
    url: "https://github.com/ethpandaops/ethereum-package",
  },
  {
    owner: "ethpandaops",
    name: "ethereum-helm-charts",
    description: "Helm charts for Ethereum blockchain on Kubernetes",
    category: "Validator Tooling",
    url: "https://github.com/ethpandaops/ethereum-helm-charts",
  },
  {
    owner: "ethpandaops",
    name: "checkpointz",
    description: "Ethereum beacon chain checkpoint sync provider",
    category: "Validator Tooling",
    url: "https://github.com/ethpandaops/checkpointz",
  },
  {
    owner: "ethpandaops",
    name: "dora",
    description: "Lightweight slot explorer for the Ethereum beacon chain",
    category: "Validator Tooling",
    url: "https://github.com/ethpandaops/dora",
  },
  {
    owner: "ethpandaops",
    name: "ethereum-metrics-exporter",
    description: "Prometheus exporter for Ethereum clients",
    category: "Validator Tooling",
    url: "https://github.com/ethpandaops/ethereum-metrics-exporter",
  },
  {
    owner: "lidofinance",
    name: "ethereum-validators-monitoring",
    description: "Ethereum validators monitoring bot",
    category: "Validator Tooling",
    url: "https://github.com/lidofinance/ethereum-validators-monitoring",
  },
  {
    owner: "ssvlabs",
    name: "ssv",
    description: "Secret-Shared-Validator for Ethereum staking",
    category: "Validator Tooling",
    url: "https://github.com/ssvlabs/ssv",
  },
  {
    owner: "serenita-org",
    name: "vero",
    description: "Multi-node validator client for Ethereum",
    category: "Validator Tooling",
    url: "https://github.com/serenita-org/vero",
  },
  {
    owner: "wealdtech",
    name: "ethdo",
    description: "CLI for Ethereum staking operations",
    category: "Validator Tooling",
    url: "https://github.com/wealdtech/ethdo",
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
