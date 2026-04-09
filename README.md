# Ethstar — Star Every Ethereum Repo

One-click tool to star all core Ethereum protocol GitHub repositories. Authenticate with GitHub, click "Star All", and support the open-source ecosystem in seconds.

**[ethstar.dev](https://ethstar.dev)**

## Repositories (32)

### Ethereum Core

Foundational protocol repositories: the EVM specification, EIPs, core protocol libraries, and cross-layer API clients.

| Repository | Description |
|---|---|
| [ethereum/go-ethereum](https://github.com/ethereum/go-ethereum) | Go implementation of the Ethereum protocol |
| [ethereum/solidity](https://github.com/ethereum/solidity) | Solidity, the Smart Contract Programming Language |
| [ethereum/EIPs](https://github.com/ethereum/EIPs) | The Ethereum Improvement Proposal repository |
| [attestantio/go-eth2-client](https://github.com/attestantio/go-eth2-client) | Go client for Ethereum consensus layer APIs |

### Consensus Clients

Beacon chain / consensus layer client implementations.

| Repository | Description |
|---|---|
| [prysmaticlabs/prysm](https://github.com/prysmaticlabs/prysm) | Ethereum consensus client written in Go |
| [sigp/lighthouse](https://github.com/sigp/lighthouse) | Ethereum consensus client written in Rust |
| [ChainSafe/lodestar](https://github.com/ChainSafe/lodestar) | Ethereum consensus client written in TypeScript |
| [status-im/nimbus-eth2](https://github.com/status-im/nimbus-eth2) | Ethereum consensus client written in Nim |
| [ConsenSys/teku](https://github.com/ConsenSys/teku) | Ethereum consensus client written in Java |
| [grandinetech/grandine](https://github.com/grandinetech/grandine) | High performance Ethereum consensus client written in Rust |

### Execution Clients

Execution layer client implementations.

| Repository | Description |
|---|---|
| [NethermindEth/nethermind](https://github.com/NethermindEth/nethermind) | Ethereum execution client written in C#/.NET |
| [erigontech/erigon](https://github.com/erigontech/erigon) | Ethereum execution client written in Go |
| [hyperledger/besu](https://github.com/hyperledger/besu) | Ethereum execution client written in Java |
| [paradigmxyz/reth](https://github.com/paradigmxyz/reth) | Ethereum execution client written in Rust |

### Validator Tooling

Validator clients, remote signers, distributed validator middleware, node setup/management tools, monitoring, and infrastructure utilities for stakers and operators.

| Repository | Description |
|---|---|
| [attestantio/vouch](https://github.com/attestantio/vouch) | Multi-node Ethereum validator client |
| [attestantio/dirk](https://github.com/attestantio/dirk) | Ethereum distributed remote keymanager |
| [ConsenSys/web3signer](https://github.com/ConsenSys/web3signer) | Remote signing service for Ethereum validators |
| [ObolNetwork/charon](https://github.com/ObolNetwork/charon) | Distributed validator middleware for Ethereum |
| [eth-educators/eth-docker](https://github.com/eth-educators/eth-docker) | Docker automation for Ethereum nodes |
| [NethermindEth/sedge](https://github.com/NethermindEth/sedge) | One-click Ethereum node setup tool |
| [dappnode/DAppNode](https://github.com/dappnode/DAppNode) | General purpose node management platform |
| [coincashew/EthPillar](https://github.com/coincashew/EthPillar) | Ethereum staking node setup tool and management TUI |
| [stereum-dev/ethereum-node](https://github.com/stereum-dev/ethereum-node) | Ethereum node setup and manager with GUI |
| [ethpandaops/ethereum-package](https://github.com/ethpandaops/ethereum-package) | Kurtosis package for portable Ethereum devnets |
| [ethpandaops/ethereum-helm-charts](https://github.com/ethpandaops/ethereum-helm-charts) | Helm charts for Ethereum blockchain on Kubernetes |
| [ethpandaops/checkpointz](https://github.com/ethpandaops/checkpointz) | Ethereum beacon chain checkpoint sync provider |
| [ethpandaops/dora](https://github.com/ethpandaops/dora) | Lightweight slot explorer for the Ethereum beacon chain |
| [ethpandaops/ethereum-metrics-exporter](https://github.com/ethpandaops/ethereum-metrics-exporter) | Prometheus exporter for Ethereum clients |
| [lidofinance/ethereum-validators-monitoring](https://github.com/lidofinance/ethereum-validators-monitoring) | Ethereum validators monitoring bot |
| [ssvlabs/ssv](https://github.com/ssvlabs/ssv) | Secret-Shared-Validator for Ethereum staking |
| [serenita-org/vero](https://github.com/serenita-org/vero) | Multi-node validator client for Ethereum |
| [wealdtech/ethdo](https://github.com/wealdtech/ethdo) | CLI for Ethereum staking operations |

## Want to add a repo?

Open a PR! The [PR template](.github/pull_request_template.md) includes a checklist, and the [category descriptions](MAINTAINERS.md#categories) explain where each repo belongs.

## Development

```bash
make install          # Install dependencies
make dev-go           # Go API on :8080 (terminal 1)
make dev-frontend     # Vite on :5173 (terminal 2)
make check            # Lint + typecheck + security
make build            # Production binary
```

See [MAINTAINERS.md](MAINTAINERS.md) for asset regeneration and SEO housekeeping.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
