# Security Policy

## Supported Versions

Only the latest release on the `main` branch is supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Use [GitHub Security Advisories](https://github.com/AntiD2ta/ethstar/security/advisories/new) to report the vulnerability privately.
3. Include:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You should receive an acknowledgement within 72 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

This policy covers:
- The Ethstar web application (frontend and backend)
- GitHub Actions workflows in this repository
- OAuth token handling and authentication flows

Out of scope:
- Third-party services (GitHub API, Vercel infrastructure)
- Social engineering attacks
- Denial of service attacks against GitHub's API

## Security Practices

- Dependencies are monitored by Dependabot and CodeQL
- Go code is scanned with gosec (OWASP-style checks)
- GitHub Actions are pinned to commit SHAs to prevent supply-chain attacks
- OAuth tokens use minimal scopes and short-lived expiry
