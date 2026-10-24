// Deploys CarbonCreditRegistry to the local Hardhat node, seeds demo carbon
// credits, performs one transfer and one retirement so the provenance trail
// is visible immediately, and writes the artifacts the API server needs:
//   ../server/data/deployment.json  (contract address)
//   ../server/data/db.json          (off-chain project metadata + demo accounts)
const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Canonical metadata: fixed key order. The API server recomputes this exact
// hash to verify metadata integrity against the on-chain anchor.
function canonicalMetadata(m) {
  return JSON.stringify({
    projectName: m.projectName,
    projectType: m.projectType,
    country: m.country,
    region: m.region,
    methodology: m.methodology,
    vintage: m.vintage,
    description: m.description,
  });
}
function metadataHash(m) {
  return "0x" + crypto.createHash("sha256").update(canonicalMetadata(m), "utf8").digest("hex");
}

const ACCOUNT_LABELS = [
  "CarbonProof Registry (Verifier)",
  "Sindh Green Energy Cooperative",
  "EcoOffset EU GmbH",
  "Karachi Climate Fund",
];

const PROJECTS = [
  {
    ownerIndex: 1,
    amountTonnes: 12500,
    assessment: { score: 92, verdict: "Likely credible", mode: "seed" },
    metadata: {
      projectName: "Sindh Solar Park Phase II",
      projectType: "Solar",
      country: "Pakistan",
      region: "Sindh",
      methodology: "ACM0002 - Grid-connected renewable electricity generation",
      vintage: 2025,
      description:
        "120 MW solar PV plant feeding the national grid in Sindh, displacing coal and gas generation. Metered output is reconciled monthly against grid operator settlement data.",
    },
  },
  {
    ownerIndex: 1,
    amountTonnes: 8200,
    transferToIndex: 3,
    assessment: { score: 89, verdict: "Likely credible", mode: "seed" },
    metadata: {
      projectName: "Thar Wind Corridor",
      projectType: "Wind",
      country: "Pakistan",
      region: "Sindh",
      methodology: "ACM0002 - Grid-connected renewable electricity generation",
      vintage: 2025,
      description:
        "Wind farm cluster in the Thar corridor with SCADA-verified generation data shared quarterly with the registry for independent reconciliation.",
    },
  },
  {
    ownerIndex: 3,
    amountTonnes: 6750,
    assessment: { score: 85, verdict: "Likely credible", mode: "seed" },
    metadata: {
      projectName: "Bali Mangrove Blue Carbon",
      projectType: "Mangrove Restoration",
      country: "Indonesia",
      region: "Bali",
      methodology: "VM0007 - REDD+ Methodology Framework",
      vintage: 2024,
      description:
        "Restoration of 480 hectares of degraded mangrove coastline with community ranger monitoring and satellite-verified canopy cover growth.",
    },
  },
  {
    ownerIndex: 2,
    amountTonnes: 3400,
    retireReason: "Offsetting EcoOffset EU 2025 operations footprint",
    assessment: { score: 88, verdict: "Likely credible", mode: "seed" },
    metadata: {
      projectName: "Kenya Clean Cookstoves",
      projectType: "Household Devices",
      country: "Kenya",
      region: "Nairobi Region",
      methodology: "AMS-II.G - Energy efficiency measures in thermal applications",
      vintage: 2025,
      description:
        "Distribution of 18,000 improved cookstoves reducing charcoal consumption, with usage surveys and stove serial-number tracking for auditability.",
    },
  },
  {
    ownerIndex: 2,
    amountTonnes: 15000,
    assessment: { score: 94, verdict: "Likely credible", mode: "seed" },
    metadata: {
      projectName: "Reykjanes Geothermal Expansion",
      projectType: "Geothermal",
      country: "Iceland",
      region: "Reykjanes",
      methodology: "ACM0002 - Grid-connected renewable electricity generation",
      vintage: 2026,
      description:
        "Expansion of an existing geothermal plant with continuous wellhead metering and third-party verified generation certificates.",
    },
  },
  {
    ownerIndex: 1,
    amountTonnes: 9800,
    assessment: { score: 78, verdict: "Plausible - monitor", mode: "seed" },
    metadata: {
      projectName: "Punjab Agroforestry Initiative",
      projectType: "Agroforestry",
      country: "Pakistan",
      region: "Punjab",
      methodology: "VM0047 - Afforestation, Reforestation, and Revegetation",
      vintage: 2026,
      description:
        "Agroforestry planting across 2,300 smallholder farms with annual survival-rate audits; early-stage project, sequestration ramps over a 20-year crediting period.",
    },
  },
];

async function main() {
  const signers = await hre.ethers.getSigners();
  const [deployer] = signers;

  const Factory = await hre.ethers.getContractFactory("CarbonCreditRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log("CarbonCreditRegistry deployed at:", address);

  const db = { credits: {}, accounts: [] };
  for (let i = 0; i < ACCOUNT_LABELS.length; i++) {
    db.accounts.push({ index: i, label: ACCOUNT_LABELS[i], address: signers[i].address });
  }

  for (const p of PROJECTS) {
    const hash = metadataHash(p.metadata);
    const tx = await registry.issue(signers[p.ownerIndex].address, p.amountTonnes, hash);
    const receipt = await tx.wait();
    // CreditIssued is the first log; read the id from the event.
    const iface = registry.interface;
    let creditId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "CreditIssued") creditId = Number(parsed.args.id);
      } catch (_) {}
    }
    if (creditId === null) throw new Error("Could not read issued credit id");
    db.credits[String(creditId)] = { metadata: p.metadata, assessment: p.assessment };
    console.log(`Issued credit #${creditId}: ${p.metadata.projectName} (${p.amountTonnes} t)`);

    if (p.transferToIndex !== undefined) {
      const t = await registry.connect(signers[p.ownerIndex]).transfer(signers[p.transferToIndex].address, creditId);
      await t.wait();
      console.log(`  transferred #${creditId} to ${ACCOUNT_LABELS[p.transferToIndex]}`);
    }
    if (p.retireReason) {
      const r = await registry.connect(signers[p.ownerIndex]).retire(creditId, p.retireReason);
      await r.wait();
      console.log(`  retired #${creditId}: ${p.retireReason}`);
    }
  }

  const dataDir = path.join(__dirname, "..", "..", "server", "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "deployment.json"),
    JSON.stringify({ address, chainId: 31337, network: "hardhat-local", deployedAt: new Date().toISOString() }, null, 2)
  );
  fs.writeFileSync(path.join(dataDir, "db.json"), JSON.stringify(db, null, 2));
  console.log("Wrote server/data/deployment.json and server/data/db.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
