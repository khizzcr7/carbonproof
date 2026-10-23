# Devpost Submission Draft — IEEE ClimateChain Global Hackathon 2026

**Status: DRAFT — not yet submitted. Demo video still to be recorded (3–5 min, required).**
**Deadline: Sunday 25 October 2026, 10:00 AM ET / 7:00 PM PKT**
**Hackathon: https://ieee-climatechain-hack.devpost.com/**
**Track: Carbon Markets & Emissions Transparency**

---

## Project name

CarbonProof

## Tagline

An on-chain carbon credit registry with AI pre-issuance verification — where a tonne of CO₂e can only ever be claimed once.

## Track alignment (required by the rules)

**Carbon Markets & Emissions Transparency.** The rules name "blockchain-based carbon credit verification", "smart contracts to prevent double counting" and "transparent carbon trading platforms" as target builds for this track. CarbonProof is exactly that: a smart-contract credit registry with cryptographic metadata anchoring and AI-assisted verification.

## Inspiration

Carbon markets only work if a credit means something. Yet the voluntary market keeps getting hit by the same scandals: credits sold twice, offsets claimed by two companies, project descriptions quietly edited after issuance, and "phantom credits" from projects that never delivered the claimed reductions. Today's registries are centralised databases and PDFs — trusting them means trusting whoever runs the spreadsheet. We asked: what if the registry itself made double counting impossible, made every credit's history public, and screened projects with AI before a single credit existed?

## What it does

CarbonProof is a complete carbon credit registry prototype:

- **On-chain issuance, transfer and retirement** through a Solidity smart contract. Each credit has exactly one owner; retirement (claiming the offset) is permanent — retired credits can never be transferred or re-retired, so double claiming is impossible by construction, not by policy.
- **AI pre-issuance verification.** A verifier submits a project and Google Gemini scores its credibility (0–100) — recognised methodology, monitoring approach, volume plausibility, greenwashing flags — before any credit is minted. The score travels with the credit forever.
- **Tamper-evident metadata.** Project details are stored off-chain, but their SHA-256 hash is anchored in the contract at issuance. Edit the record later and the hash check fails publicly.
- **Provenance timeline.** Every credit's full life — issued, transferred between owners, retired, with timestamps and transaction hashes — is reconstructed from blockchain events.
- **Public authenticity check.** Anyone can enter a credit ID and verify: authentic or tampered, still active or already claimed, and who owns it now.
- **Live registry dashboard** with total issued / active / retired tonnage across seeded projects in Pakistan, Indonesia, Kenya and Iceland.

## How we built it

- **Smart contract:** Solidity 0.8.24 on Hardhat — a `CarbonCreditRegistry` contract with verifier-only issuance, single-owner transfer semantics, irreversible retirement, and a full event log. Deploy script seeds six realistic projects, one transfer and one retirement so provenance is visible immediately.
- **Backend:** Node.js + Express + TypeScript API using ethers.js v6. It signs demo transactions, enriches on-chain state with off-chain metadata, recomputes SHA-256 hashes for integrity checks, and calls the Gemini API (`gemini-2.0-flash`) for project scoring — with a transparent, labelled local-heuristic fallback so the demo never depends on an API key.
- **Frontend:** React + TypeScript (Vite) — registry dashboard, credit detail with provenance timeline and transfer/retire actions, an issue flow with the AI score built in, and the public verify page.
- Runs entirely locally with free tooling: local EVM chain, no testnet funds, no paid services.

## Challenges we ran into

- Modelling retirement so it is *provably* final: the contract, the API guards, and the UI all had to agree that a retired credit is dead forever — including blocking edge cases like transferring after retirement.
- Hash anchoring only works if the off-chain metadata is serialised identically everywhere; the deploy script and the API server share an exact canonical JSON format, verified by the integrity check passing on every seeded credit.
- Reading provenance from raw chain events (ethers v6 result objects do not enumerate named arguments) required explicit per-event field extraction.
- Making the AI step honest: when Gemini is unavailable the fallback clearly labels itself as a heuristic instead of pretending to be AI.

## Accomplishments we're proud of

- A genuinely working end-to-end registry, not a mockup: issue → AI score → transfer → retire all execute as real smart-contract transactions, and the anti-double-counting rules are enforced by the contract itself (we tested double-retire and post-retirement transfer — both rejected on-chain).
- Every seeded credit passes its metadata integrity check against the on-chain anchor.
- The whole demo runs from a cold start with four commands and zero paid services.

## What we learned

- Blockchain adds real value to registries only where the rules must be enforced between parties who do not trust each other — single ownership and irreversible retirement are exactly that case; everything else (metadata, UI) is better off-chain with hashes anchoring it.
- AI is most useful in climate markets as a *gatekeeper with receipts*: a score stored next to the credit at issuance, visible to every future buyer, changes issuer behaviour more than a private review would.

## What's next for CarbonProof

- Deploy to a public EVM testnet (Sepolia) with wallet-signed transfers (MetaMask) instead of demo accounts
- Multi-verifier approval and staking for large issuances
- Evidence documents (monitoring reports, satellite imagery) hashed alongside project metadata
- Cross-checks against Verra / Gold Standard serial numbers to stop the same project being registered twice across registries
- Automatic NFT offset certificates issued at retirement for buyers' ESG reporting

## Built with

- Solidity 0.8.24 · Hardhat · ethers.js v6
- Node.js · Express · TypeScript
- React · TypeScript · Vite
- Google Gemini API (gemini-2.0-flash)
- SHA-256 metadata anchoring

## Try it out

Repository contains full run instructions (local chain → deploy & seed → API → frontend). The API server can also serve the built frontend on a single port for judging.

## Team

Muhammad Khizar — solo participant (Software Engineer, Karachi, Pakistan). Category: Independent developer.

## Still needed before final submit

- [ ] Demo video (3–5 minutes) recorded and uploaded (YouTube/Vimeo link) — Khizar's step; walkthrough script is in the README
- [ ] GitHub repo link pasted into the Devpost form
- [ ] Final submit button on Devpost (before 25 Oct, 7:00 PM PKT)
