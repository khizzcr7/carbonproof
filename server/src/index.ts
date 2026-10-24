import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { contractAddress, getContract, getProvider, getWallet } from "./chain.js";
import { verifyProject } from "./ai.js";
import {
  accountIndexByAddress,
  accountLabel,
  loadDb,
  metadataHash,
  saveDb,
  type ProjectMetadata,
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

function serializeCredit(c: any) {
  return {
    id: Number(c.id),
    issuer: c.issuer,
    owner: c.owner,
    amountTonnes: Number(c.amountTonnes),
    metadataHash: c.metadataHash,
    retired: c.retired,
    issuedAt: Number(c.issuedAt) ? new Date(Number(c.issuedAt) * 1000).toISOString() : null,
    retiredAt: Number(c.retiredAt) ? new Date(Number(c.retiredAt) * 1000).toISOString() : null,
    retireReason: c.retireReason || "",
  };
}

async function creditView(id: number) {
  const db = loadDb();
  const registry = getContract();
  const c = serializeCredit(await registry.getCredit(id));
  const entry = db.credits[String(id)];
  const integrityOk = entry ? metadataHash(entry.metadata) === c.metadataHash.toLowerCase() || metadataHash(entry.metadata).toLowerCase() === c.metadataHash.toLowerCase() : false;
  return {
    ...c,
    ownerLabel: accountLabel(db, c.owner),
    issuerLabel: accountLabel(db, c.issuer),
    metadata: entry?.metadata ?? null,
    assessment: entry?.assessment ?? null,
    metadataIntegrity: entry ? integrityOk : false,
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    const provider = getProvider();
    const block = await provider.getBlockNumber();
    res.json({ ok: true, chainConnected: true, blockNumber: block, contract: contractAddress() });
  } catch (e: any) {
    res.json({ ok: true, chainConnected: false, error: String(e.message || e) });
  }
});

app.get("/api/accounts", (_req, res) => {
  res.json(loadDb().accounts);
});

app.get("/api/stats", async (_req, res) => {
  try {
    const registry = getContract();
    const [count, issued, retired] = await Promise.all([
      registry.creditCount(),
      registry.totalIssuedTonnes(),
      registry.totalRetiredTonnes(),
    ]);
    res.json({
      creditCount: Number(count),
      totalIssuedTonnes: Number(issued),
      totalRetiredTonnes: Number(retired),
      activeTonnes: Number(issued) - Number(retired),
      contract: contractAddress(),
    });
  } catch (e: any) {
    res.status(503).json({ error: String(e.message || e) });
  }
});

app.get("/api/credits", async (_req, res) => {
  try {
    const registry = getContract();
    const count = Number(await registry.creditCount());
    const out = [];
    for (let i = 1; i <= count; i++) out.push(await creditView(i));
    res.json(out);
  } catch (e: any) {
    res.status(503).json({ error: String(e.message || e) });
  }
});

app.get("/api/credits/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const view = await creditView(id);
    // Provenance timeline from on-chain events.
    const registry = getContract();
    const provider = getProvider();
    const events: any[] = [];
    const FIELDS: Record<string, string[]> = {
      issued: ["id", "issuer", "owner", "amountTonnes"],
      transferred: ["id", "from", "to"],
      retired: ["id", "owner", "reason"],
    };
    const push = async (logs: any[], type: string) => {
      for (const log of logs) {
        const block = await provider.getBlock(log.blockNumber);
        const args: Record<string, string | number> = {};
        if (log.args) {
          for (const f of FIELDS[type]) {
            const v = log.args[f];
            if (v !== undefined) args[f] = typeof v === "bigint" ? Number(v) : String(v);
          }
        }
        events.push({
          type,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          at: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
          args,
        });
      }
    };
    await push(await registry.queryFilter(registry.filters.CreditIssued(id), 0), "issued");
    await push(await registry.queryFilter(registry.filters.CreditTransferred(id), 0), "transferred");
    await push(await registry.queryFilter(registry.filters.CreditRetired(id), 0), "retired");
    events.sort((a, b) => a.blockNumber - b.blockNumber);
    const db = loadDb();
    const timeline = events.map((e) => ({
      ...e,
      fromLabel: e.args.from ? accountLabel(db, e.args.from) : undefined,
      toLabel: e.args.to ? accountLabel(db, e.args.to) : undefined,
      ownerLabel: e.args.owner ? accountLabel(db, e.args.owner) : undefined,
    }));
    res.json({ ...view, timeline });
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

// Public authenticity check: recompute the metadata hash from the registry's
// off-chain record and compare it with the hash anchored on-chain at issuance.
app.get("/api/verify/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const view = await creditView(id);
    res.json({
      creditId: id,
      authentic: view.metadataIntegrity,
      onChainMetadataHash: view.metadataHash,
      recomputedMetadataHash: view.metadata ? metadataHash(view.metadata) : null,
      status: view.retired ? "RETIRED (offset claimed, cannot be reused)" : "ACTIVE",
      owner: view.ownerLabel,
      amountTonnes: view.amountTonnes,
      project: view.metadata?.projectName ?? null,
    });
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/ai/verify", async (req, res) => {
  try {
    const input = req.body;
    if (!input?.projectName || !input?.description) {
      return res.status(400).json({ error: "projectName and description are required" });
    }
    const assessment = await verifyProject({ ...input, amountTonnes: Number(input.amountTonnes) || 0 });
    res.json(assessment);
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/credits/issue", async (req, res) => {
  try {
    const { ownerIndex, amountTonnes, metadata, assessment } = req.body as {
      ownerIndex: number;
      amountTonnes: number;
      metadata: ProjectMetadata;
      assessment?: any;
    };
    if (!metadata?.projectName || !amountTonnes || ownerIndex === undefined) {
      return res.status(400).json({ error: "ownerIndex, amountTonnes and metadata.projectName are required" });
    }
    const db = loadDb();
    const owner = db.accounts.find((a) => a.index === Number(ownerIndex));
    if (!owner) return res.status(400).json({ error: "Unknown owner account" });

    const hash = metadataHash(metadata);
    const registry = getContract(getWallet(0)); // account 0 = verifier
    const tx = await registry.issue(owner.address, Number(amountTonnes), hash);
    const receipt = await tx.wait();
    let creditId: number | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = registry.interface.parseLog(log);
        if (parsed?.name === "CreditIssued") creditId = Number(parsed.args.id);
      } catch (_) {}
    }
    if (creditId === null) throw new Error("Issue transaction mined but credit id not found");

    const fresh = loadDb();
    fresh.credits[String(creditId)] = { metadata, assessment: assessment ?? null };
    saveDb(fresh);
    res.json({ creditId, txHash: receipt.hash, metadataHash: hash });
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/credits/:id/transfer", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { toIndex } = req.body;
    const db = loadDb();
    const registry = getContract();
    const c = await registry.getCredit(id);
    if (c.retired) return res.status(400).json({ error: "Retired credits cannot be transferred" });
    const ownerIndex = accountIndexByAddress(db, c.owner);
    const to = db.accounts.find((a) => a.index === Number(toIndex));
    if (ownerIndex < 0 || !to) return res.status(400).json({ error: "Unknown account" });
    const signed = getContract(getWallet(ownerIndex));
    const tx = await signed.transfer(to.address, id);
    const receipt = await tx.wait();
    res.json({ ok: true, txHash: receipt.hash, from: accountLabel(db, c.owner), to: to.label });
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/credits/:id/retire", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "A retirement reason is required" });
    const db = loadDb();
    const registry = getContract();
    const c = await registry.getCredit(id);
    if (c.retired) return res.status(400).json({ error: "Credit is already retired" });
    const ownerIndex = accountIndexByAddress(db, c.owner);
    if (ownerIndex < 0) return res.status(400).json({ error: "Unknown owner account" });
    const signed = getContract(getWallet(ownerIndex));
    const tx = await signed.retire(id, String(reason));
    const receipt = await tx.wait();
    res.json({ ok: true, txHash: receipt.hash });
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

// Serve the built frontend when present (production/demo mode).
const webDist = path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const PORT = Number(process.env.PORT || 4100);
app.listen(PORT, () => {
  console.log(`CarbonProof API listening on http://localhost:${PORT}`);
});
