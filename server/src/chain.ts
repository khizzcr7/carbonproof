import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "..", "data");
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// Hardhat's well-known PUBLIC test accounts (local demo chain only - these
// keys are published in the Hardhat docs and must never hold real funds).
const DEMO_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

export const ABI = [
  "function issue(address to, uint256 amountTonnes, bytes32 metadataHash) returns (uint256)",
  "function transfer(address to, uint256 id)",
  "function retire(uint256 id, string reason)",
  "function getCredit(uint256 id) view returns (tuple(uint256 id, address issuer, address owner, uint256 amountTonnes, bytes32 metadataHash, bool retired, uint256 issuedAt, uint256 retiredAt, string retireReason) credit)",
  "function creditCount() view returns (uint256)",
  "function totalIssuedTonnes() view returns (uint256)",
  "function totalRetiredTonnes() view returns (uint256)",
  "event CreditIssued(uint256 indexed id, address indexed issuer, address indexed owner, uint256 amountTonnes, bytes32 metadataHash)",
  "event CreditTransferred(uint256 indexed id, address indexed from, address indexed to)",
  "event CreditRetired(uint256 indexed id, address indexed owner, string reason)",
];

export function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function getWallet(index: number) {
  return new ethers.Wallet(DEMO_KEYS[index], getProvider());
}

export function getContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const deploymentPath = path.join(DATA_DIR, "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Contract not deployed yet. Start the chain and run the deploy script first.");
  }
  const { address } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  return new ethers.Contract(address, ABI, signerOrProvider || getProvider());
}

export function contractAddress(): string {
  const { address } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "deployment.json"), "utf8"));
  return address;
}
