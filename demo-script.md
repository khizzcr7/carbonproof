# CarbonProof — Demo Narration Script

Read each numbered section aloud as one take. The sections match the on-screen
segments of demo.mp4 one to one; demo-timings.md gives the exact window for each.
Numbers are spelled out where pronunciation matters.

## Section 1 — Registry dashboard (intro)

This is CarbonProof, an on-chain carbon credit registry built for the I triple E ClimateChain hackathon. Voluntary carbon markets have a trust problem: the same tonne of carbon can be sold twice, project records can be edited after the fact, and weak projects get credits with almost no scrutiny. CarbonProof fixes that by putting the registry itself on a blockchain. It was built solo, end to end: a Solidity smart contract, a TypeScript A P I, and this React dashboard. The dashboard shows live data from the contract: fifty-five thousand, six hundred and fifty tonnes of carbon dioxide equivalent issued across six projects, and three thousand, four hundred tonnes already retired as claimed offsets.

## Section 2 — Credit #2 provenance timeline

Every credit is a unique on-chain record with exactly one owner at a time. This is credit number two, the Thar Wind Corridor in Pakistan. It changed hands after issuance, and its full history is rebuilt from blockchain events: issued, then transferred to the Karachi Climate Fund, with the block number and transaction hash for every step. Nothing in this history can be quietly rewritten.

## Section 3 — Public verify of credit #4 (RETIRED)

Now the public audit. Anyone can check a credit by its I D, with no account and no permission. Credit number four is the Kenya Clean Cookstoves project. The app recomputes the project metadata hash and compares it with the hash anchored on-chain at issuance. It matches: authentic, the record is untampered. And the status proves this offset was already retired, already claimed by a buyer. It can never be sold or claimed a second time.

## Section 4 — Issue a new credit with AI verification

Issuing a new credit starts with a credibility gate. Here is a new solar project in Sindh, with a recognised methodology and a monitoring approach based on metered generation data, satellite imagery and third-party audits. Before anything is minted, the verifier runs an A I credibility check, scoring the claim from zero to one hundred. This project scores eighty-two: likely credible, with no flags raised, and that score is stored with the credit permanently, visible to every future buyer. Then the credit is issued on-chain, and its metadata hash is anchored in the contract in the same transaction.

## Section 5 — Transfer, retire, and the double-claim guarantee

The new credit is live in the registry, owned by its first holder. I transfer it to another account, and ownership moves on-chain for everyone to see. Then I retire it, claiming the offset against a stated footprint. Retirement is permanent. The transfer and retire controls are now gone, because the contract state is final: any further transfer or retirement would be rejected on-chain. In CarbonProof, a tonne can only ever be claimed once. Not by policy. By construction.

## Section 6 — Close

CarbonProof. A Solidity registry, hash-anchored metadata, A I verification before issuance, and a public audit trail for every tonne. Built by Muhammad Khizar for the I triple E ClimateChain Global Hackathon.
