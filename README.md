<div align="center">
  <a href="https://ethstar.dev">
    <img src="frontend/public/logo-256.png" alt="Ethstar logo" width="128" />
  </a>

  <h1>Ethstar</h1>
  <p>One-click tool to star all core Ethereum protocol GitHub repositories.</p>

  [![CI](https://github.com/AntiD2ta/ethstar/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AntiD2ta/ethstar/actions/workflows/ci.yml)
  [![Go Report Card](https://goreportcard.com/badge/github.com/AntiD2ta/ethstar)](https://goreportcard.com/report/github.com/AntiD2ta/ethstar)
  [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/AntiD2ta/ethstar/badge)](https://scorecard.dev/viewer/?uri=github.com/AntiD2ta/ethstar)
  [![Go](https://img.shields.io/github/go-mod/go-version/AntiD2ta/ethstar)](https://go.dev/)
  [![Snyk](https://snyk.io/test/github/AntiD2ta/ethstar/badge.svg)](https://snyk.io/test/github/AntiD2ta/ethstar)
  [![License](https://img.shields.io/github/license/AntiD2ta/ethstar)](LICENSE)
  [![Website](https://img.shields.io/website?url=https%3A%2F%2Fethstar.dev&label=ethstar.dev)](https://ethstar.dev)
</div>

---

Authenticate with GitHub, click "Star All", and support the open-source ecosystem in seconds.

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

## Token Transparency

Ethstar uses **two separate OAuth flows** with different permission scopes:

| Flow | Type | Scope | Stored? | Purpose |
|---|---|---|---|---|
| **Sign in** | GitHub App | `Starring` (read-only) | localStorage | Check which repos you've already starred |
| **Star All** | Classic OAuth | `public_repo` | Never | Star repos on your behalf, then discard |

### Ephemeral star token lifecycle

When you click "Star All", a **one-time popup OAuth flow** obtains a token that is used immediately and discarded. Here is the exact code path — every step links to the source so you can verify:

1. **Popup opens** — [`use-star-oauth.ts`](frontend/src/hooks/use-star-oauth.ts) calls `window.open("/api/auth/star")`
2. **Server redirects to GitHub** — [`api/auth/star/index.go`](api/auth/star/index.go) generates a CSRF state cookie and redirects to GitHub's OAuth page with `scope=public_repo`
3. **You authorize** — GitHub shows what permissions are requested (starring public repos)
4. **GitHub redirects back** — [`api/auth/star-callback/index.go`](api/auth/star-callback/index.go) exchanges the authorization code for an access token via [`pkg/auth/oauth.go`](pkg/auth/oauth.go), then renders an HTML page that posts the token to the opener window
5. **Token delivered via `postMessage`** — [`pkg/auth/starhtml.go`](pkg/auth/starhtml.go) sends `{type: "ethstar-star-token", access_token}` to the parent window; [`use-star-oauth.ts`](frontend/src/hooks/use-star-oauth.ts) validates the origin and message type
6. **Token used to star repos** — [`use-stars.ts`](frontend/src/hooks/use-stars.ts) passes the token to [`github.ts`](frontend/src/lib/github.ts), which calls `PUT /user/starred/{owner}/{repo}` on GitHub's API for each unstarred repo
7. **Token discarded** — the token is a local JavaScript variable; once `starAll()` returns, it falls out of scope and is garbage collected. It is **never** stored in localStorage, sent to any backend, or logged

### What the token is NOT used for

- **Not stored** — not written to localStorage, cookies, or any persistent storage
- **Not sent to our servers** — all starring API calls go directly from your browser to `api.github.com`
- **Not logged** — no `console.log`, no analytics, no telemetry
- **Not refreshable** — if the token expires mid-operation, the flow fails gracefully (no refresh attempt for ephemeral tokens)

The UI explicitly confirms this: after starring completes, the [`star-modal.tsx`](frontend/src/components/star-modal.tsx) dialog displays "Your GitHub token has been discarded."

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
