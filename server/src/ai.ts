import type { Assessment, ProjectMetadata } from "./store.js";

export interface VerifyInput extends ProjectMetadata {
  amountTonnes: number;
}

/**
 * AI pre-verification of a carbon project before its credits are issued.
 * When GEMINI_API_KEY is set, Google Gemini scores the claim. Without a key
 * (or if the API call fails) a transparent local heuristic produces the same
 * response shape, and the result is labelled with the mode that produced it.
 */
export async function verifyProject(input: VerifyInput): Promise<Assessment> {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      return await geminiVerify(input, key);
    } catch (e) {
      const h = heuristicVerify(input);
      return { ...h, mode: "local-heuristic (Gemini call failed, fallback used)" };
    }
  }
  return heuristicVerify(input);
}

async function geminiVerify(input: VerifyInput, apiKey: string): Promise<Assessment> {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = `You are a carbon-market due-diligence analyst. Assess this carbon credit project claim for credibility and greenwashing risk.

Project: ${input.projectName}
Type: ${input.projectType}
Location: ${input.region}, ${input.country}
Methodology: ${input.methodology}
Vintage: ${input.vintage}
Claimed amount: ${input.amountTonnes} tonnes CO2e
Description: ${input.description}

Respond with ONLY a JSON object:
{"score": <0-100 integer credibility score>, "verdict": "<short verdict>", "flags": ["<risk flag>", ...], "summary": "<2 sentence summary>"}
Score high for recognised methodologies, specific measurable monitoring, plausible scale for the project type and vintage. Score low for vague claims, implausible volumes, missing monitoring, or methodologies that do not match the project type.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  const parsed = JSON.parse(text);
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    verdict: String(parsed.verdict || "Assessed"),
    flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : [],
    summary: String(parsed.summary || ""),
    mode: `gemini (${model})`,
  };
}

const KNOWN_METHODOLOGIES = ["acm", "ams", "vm0", "gold standard", "verra", "vcs", "art trees", "puff"];
const MONITORING_TERMS = ["meter", "monitor", "satellite", "audit", "verif", "scada", "survey", "sensor", "reconcil"];

function heuristicVerify(input: VerifyInput): Assessment {
  let score = 55;
  const flags: string[] = [];
  const meth = (input.methodology || "").toLowerCase();
  const desc = (input.description || "").toLowerCase();

  if (KNOWN_METHODOLOGIES.some((k) => meth.includes(k))) {
    score += 15;
  } else {
    score -= 15;
    flags.push("Methodology is not a recognised registry methodology (Verra ACM/AMS/VM, Gold Standard).");
  }
  const monitoringHits = MONITORING_TERMS.filter((t) => desc.includes(t)).length;
  if (monitoringHits >= 2) score += 12;
  else if (monitoringHits === 1) score += 5;
  else {
    score -= 10;
    flags.push("No monitoring, metering or verification approach described.");
  }
  if (input.description.trim().length < 120) {
    score -= 8;
    flags.push("Project description is very brief; additionality and baseline are unclear.");
  }
  if (input.amountTonnes > 500000) {
    score -= 12;
    flags.push("Claimed volume is very large for a single project issuance; check for over-crediting.");
  }
  if (input.vintage > new Date().getFullYear()) {
    score -= 5;
    flags.push("Future vintage: credits are forward-looking and not yet ex-post verified.");
  }
  score = Math.max(5, Math.min(97, score));
  const verdict = score >= 80 ? "Likely credible" : score >= 60 ? "Plausible - monitor" : "High risk - scrutinise";
  return {
    score,
    verdict,
    flags,
    summary:
      "Local heuristic assessment (set GEMINI_API_KEY for full AI analysis). Score reflects methodology recognition, described monitoring, claim plausibility and description specificity.",
    mode: "local-heuristic",
  };
}
