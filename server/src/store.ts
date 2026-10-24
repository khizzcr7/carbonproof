import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./chain.js";

export interface ProjectMetadata {
  projectName: string;
  projectType: string;
  country: string;
  region: string;
  methodology: string;
  vintage: number;
  description: string;
}

export interface Assessment {
  score: number;
  verdict: string;
  mode: string;
  flags?: string[];
  summary?: string;
}

interface Db {
  credits: Record<string, { metadata: ProjectMetadata; assessment: Assessment | null }>;
  accounts: { index: number; label: string; address: string }[];
}

const DB_PATH = path.join(DATA_DIR, "db.json");

export function loadDb(): Db {
  if (!fs.existsSync(DB_PATH)) return { credits: {}, accounts: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

export function saveDb(db: Db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Canonical metadata string - MUST match contracts/scripts/deploy.js exactly.
export function canonicalMetadata(m: ProjectMetadata): string {
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

export function metadataHash(m: ProjectMetadata): string {
  return "0x" + crypto.createHash("sha256").update(canonicalMetadata(m), "utf8").digest("hex");
}

export function accountLabel(db: Db, address: string): string {
  const a = db.accounts.find((x) => x.address.toLowerCase() === address.toLowerCase());
  return a ? a.label : address;
}

export function accountIndexByAddress(db: Db, address: string): number {
  const a = db.accounts.find((x) => x.address.toLowerCase() === address.toLowerCase());
  return a ? a.index : -1;
}
