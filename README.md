# CarbonProof — On-Chain Carbon Credit Provenance & Verification Registry

**IEEE ClimateChain Global Hackathon 2026 · Track: Carbon Markets & Emissions Transparency**
**Built by: Muhammad Khizar (solo)**

CarbonProof is a working carbon credit registry where every credit is issued, transferred, and retired through an Ethereum smart contract, project metadata is cryptographically anchored on-chain, and an AI verifier scores project credibility before a single credit can be created.

---

## The problem

Voluntary carbon markets run on trust, and that trust keeps breaking:

- **Double counting / double selling** — the same tonne of CO₂e gets claimed by two buyers because registries are siloed spreadsheets and PDFs.
- **Opaque provenance** — once a credit changes hands, its history (who issued it, who held it, whether it was already used as an offset) is hard or impossible to audit.
- **Greenwashing** — weak projects with vague claims are issued credits with little upfront scrutiny, and metadata can be edited after the fact.

## The solution

CarbonProof moves the registry itself onto a blockchain and adds an AI gatekeeper:

1. **Smart-contract registry (Solidity).** Each credit is a unique on-chain record with exactly one owner at a time. Retiring a credit — claiming it as an offset — is **permanent and irreversible**: a retired credit can never be transferred or retired again. Double claiming is not discouraged by policy; it is impossible by construction.
2. **Hash-anchored metadata.** Project details (name, type, location, methodology, vintage, description) live off-chain, but their SHA-256 hash is written into the contract at issuance. Anyone can later recompute the hash and compare — any tampering with the project record is instantly detectable via the public **Verify** page.
3. **AI pre-issuance verification (Google Gemini).** Before issuance, the project claim is scored 0–100 for credibility: methodology recognition, monitoring approach, volume plausibility, greenwashing flags. The score is stored with the credit and displayed in the registry. Without an API key, a transparent local heuristic produces the same response shape so the demo never breaks.
4. **Full provenance timeline.** Issuance, every transfer, and retirement are reconstructed from on-chain events, giving each credit an auditable life story.
5. **Public authenticity check.** Enter a credit ID and get a straight answer: authentic or not, active or already retired, who owns it, and the hash proof.

## How it works

```
┌────────────────────┐      ┌──────────────────────┐      ┌────────────────────────┐
│  React + Vite UI   │─────▶│  Express + TS API    │─────▶│  Hardhat local EVM     │
│  registry, issue,  │      │  ethers v6, SHA-256  │      │  CarbonCreditRegistry  │
│  verify, timeline  │      │  metadata anchoring, │      │  .sol — issue /        │
└────────────────────┘      │  Gemini AI verifier  │      │  transfer / retire     │
                            └──────────────────────┘      └────────────────────────┘
```

- `contracts/` — Hardhat project. `CarbonCreditRegistry.sol` (issue / transfer / retire, verifier role, event log) plus a deploy script that seeds six realistic demo credits (including one transfer and one retirement so provenance is visible immediately).
- `server/` — Express + TypeScript API. Signs transactions with demo accounts, serves registry data enriched with off-chain metadata, runs the AI verification, and serves the built frontend in production mode.
- `web/` — React + TypeScript (Vite) frontend: registry dashboard with live totals, credit detail with provenance timeline and actions, issue flow with AI scoring, public verify page.

## Tech stack

- **Blockchain:** Solidity 0.8.24, Hardhat, ethers.js v6 (local EVM chain; the contract deploys unchanged to any EVM testnet)
- **Backend:** Node.js, Express, TypeScript
- **Frontend:** React, TypeScript, Vite
- **AI:** Google Gemini API (`gemini-2.0-flash`) with a local-heuristic fallback
- **Integrity:** SHA-256 metadata anchoring

## Quick start

Prerequisites: Node.js 18+. No paid services, no testnet funds needed.

```bash
# 1. Install dependencies
cd contracts && npm install
cd ../server && npm install
cd ../web && npm install && cd ..

# 2. Start the local blockchain (terminal 1)
npm run chain

# 3. Deploy the contract and seed demo credits (terminal 2)
npm run deploy

# 4. Start the API server (terminal 3) — serves the API on :4100
npm run server

# 5. Start the frontend (terminal 4) — http://localhost:5173
npm run web
```

For a single-port demo, build the frontend once (`npm run web:build`) and the API server will serve it at `http://localhost:4100`.

Optional: copy `server/.env.example` to `server/.env` and set `GEMINI_API_KEY` to enable full Gemini AI verification (otherwise the built-in heuristic scorer is used and labelled as such).

## Demo walkthrough (3–5 minutes)

1. **Registry dashboard** — 55,650 tCO₂e issued across 6 projects; 3,400 t already retired. Note credit #4 is RETIRED and credit #2 changed hands — click it to see the provenance timeline built from chain events.
2. **Verify a credit** — check credit #4: metadata hash matches the on-chain anchor (authentic), and its status proves the offset was already claimed and cannot be reused.
3. **Issue flow** — fill in a new project, run **AI verification** (watch it flag a vague project with no monitoring), then issue on-chain. The credit appears in the registry with its hash anchored.
4. **Transfer & retire** — transfer the new credit to another account, then retire it with a reason. Try transferring or retiring it again: the contract rejects both. That rejection is the whole point — a tonne can only ever be claimed once.

## Track & judging fit

- **Climate Impact:** attacks the credibility crisis of carbon markets — double counting and unverifiable claims — which directly undermines real emissions reductions.
- **Innovation:** combines a smart-contract registry, cryptographic metadata anchoring, and AI due-diligence in one flow; the AI gate sits *before* issuance, not after scandal.
- **Technical Execution:** a real Solidity contract with role-based issuance and event-sourced provenance, a TypeScript API, and a complete React frontend — all runnable locally with the commands above.
- **Practical Usefulness:** registries, corporate buyers, and auditors are the natural users; the public verify page mirrors how a buyer would diligence an offset purchase.
- **Presentation:** the demo script above walks the exact story in under five minutes.

## Roadmap

- Deploy to a public EVM testnet (Sepolia) with wallet-signed (MetaMask) transfers instead of demo accounts
- Verifier staking/slashing and multi-verifier approval for large issuances
- Document evidence uploads (monitoring reports) hashed alongside metadata
- Integration with real registry APIs (Verra / Gold Standard) for cross-checking serial numbers
- Buyer-facing offset certificates (NFT receipt) generated automatically at retirement

## Notes

- Demo accounts use Hardhat's **public, well-known test keys** (documented in `server/src/chain.ts`). They are for the local demo chain only and must never hold real funds.
- The chain is a local Hardhat EVM for the hackathon demo; the contract itself is standard Solidity and is testnet-ready.

## License

MIT
