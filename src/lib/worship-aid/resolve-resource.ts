/**
 * Resource resolver for the Worship Aid Builder.
 * TypeScript port of ~/Desktop/Claude/worship-aid-builder/lib/resolve-resource-v2.js
 *
 * 5-tier ladder:
 *   1. OCP Congregational GIF   ~/Desktop/OCP Fresh Resource Files/Congregational Sheet Music GIF/
 *   2. In-house WA.gif          ~/St Monica Dropbox/Jeff Bonilla/Monica Music Master/_Resources/Music/**  (WA in name)
 *   3. In-house TIFF            same folder, *.tiff / *.tif
 *   4. In-house PDF             same folder, *.pdf
 *   5. Placeholder
 *
 * SERVER-SIDE ONLY — uses fs/path which are unavailable in the browser.
 */

import fs from "node:fs";
import path from "node:path";
import type { ResolvedResource, ResourceTier } from "./types";

// ─── Path constants ────────────────────────────────────────────────────────────

const OCP_GIF_ROOT =
  "/Users/jeffreybonilla/Desktop/OCP Fresh Resource Files/Congregational Sheet Music GIF";

const INHOUSE_ROOT =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/Monica Music Master/_Resources/Music";

// ─── Matching thresholds ───────────────────────────────────────────────────────

const JACCARD_THRESHOLD = 0.6;

// ─── Normalisation helpers ─────────────────────────────────────────────────────

function normalizeTitle(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[""„]/g, '"')
    .replace(/['']/g, "'")
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

// ─── Fuzzy Jaccard scoring ─────────────────────────────────────────────────────

function scoreCandidate(candidateName: string, requestNormalized: string): number {
  const normCandidate = normalizeTitle(candidateName);
  const tokensC = tokenize(normCandidate);
  const tokensR = tokenize(requestNormalized);

  if (tokensC.length === 0 || tokensR.length === 0) return 0;

  // Exact token match
  const exact =
    tokensC.length === tokensR.length &&
    tokensC.every((t, i) => t === tokensR[i])
      ? 1
      : 0;

  // Jaccard similarity
  const setC = new Set(tokensC);
  const setR = new Set(tokensR);
  const union = new Set([...setC, ...setR]);
  const intersectionCount = [...setC].filter((t) => setR.has(t)).length;
  const jaccard = union.size === 0 ? 0 : intersectionCount / union.size;

  // Prefix bonus (first two tokens match)
  let prefix = 0;
  if (tokensC.length >= 2 && tokensR.length >= 2) {
    prefix = tokensC[0] === tokensR[0] && tokensC[1] === tokensR[1] ? 1 : 0;
  } else if (tokensC.length > 0 && tokensR.length > 0) {
    prefix = tokensC[0] === tokensR[0] ? 1 : 0;
  }

  // Number penalty — penalise files that contain digits absent from request
  const requestDigits = new Set((requestNormalized.match(/\d/g) || []));
  const candidateDigits = new Set((normCandidate.match(/\d/g) || []));
  let numberPenalty = 0;
  for (const digit of candidateDigits) {
    if (!requestDigits.has(digit)) {
      numberPenalty = -0.15;
      break;
    }
  }

  return exact * 1.0 + jaccard * 0.6 + prefix * 0.2 + numberPenalty;
}

// ─── Filesystem helpers ─────────────────────────────────────────────────────────

/** Recursively walk a directory and collect files matching an extension filter. */
function walkDir(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, exts));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (exts.includes(ext)) results.push(full);
    }
  }
  return results;
}

/** Find best matching file from a list, using Jaccard scoring. */
function bestMatch(
  files: string[],
  requestNormalized: string,
  threshold: number
): { path: string; score: number } | null {
  let best: { path: string; score: number } | null = null;
  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    const score = scoreCandidate(name, requestNormalized);
    if (score >= threshold && (!best || score > best.score)) {
      best = { path: file, score };
    }
  }
  return best;
}

// ─── WA.gif filter ─────────────────────────────────────────────────────────────

/** True if the basename contains "WA" (case-insensitive) as a word boundary. */
function isWaGif(filePath: string): boolean {
  const name = path.basename(filePath, path.extname(filePath));
  return /\bwa\b/i.test(name);
}

// ─── Main resolver ─────────────────────────────────────────────────────────────

export interface ResolveRequest {
  title: string;
  composer?: string;
  /** Slot type hint — "mass-part" triggers extra search logic */
  slotType?: "mass-part" | "hymn" | "psalm" | string;
}

/**
 * Resolve the best-available music resource for a song request.
 * Searches tiers 1-5 in order and short-circuits on first success.
 */
export async function resolveResource(request: ResolveRequest): Promise<ResolvedResource> {
  const { title } = request;
  const normTitle = normalizeTitle(title);

  if (!normTitle) {
    return placeholder("Empty title after normalisation");
  }

  // ── Tier 1: OCP Congregational GIF ──────────────────────────────────────────
  const ocpFiles = walkDir(OCP_GIF_ROOT, [".gif"]);
  const tier1 = bestMatch(ocpFiles, normTitle, JACCARD_THRESHOLD);
  if (tier1) {
    const confidence = tier1.score >= 0.9 ? "high" : tier1.score >= 0.75 ? "medium" : "low";
    return {
      tier: "ocp-gif",
      path: tier1.path,
      score: tier1.score,
      confidence,
      reason: `OCP GIF match (score ${tier1.score.toFixed(2)})`,
    };
  }

  // ── Tier 2: In-house WA.gif ──────────────────────────────────────────────────
  const allGifs = walkDir(INHOUSE_ROOT, [".gif"]);
  const waGifs = allGifs.filter(isWaGif);
  const tier2 = bestMatch(waGifs, normTitle, JACCARD_THRESHOLD);
  if (tier2) {
    const confidence = tier2.score >= 0.9 ? "high" : tier2.score >= 0.75 ? "medium" : "low";
    return {
      tier: "wa-gif",
      path: tier2.path,
      score: tier2.score,
      confidence,
      reason: `In-house WA.gif match (score ${tier2.score.toFixed(2)})`,
    };
  }

  // ── Tier 3: In-house TIFF ────────────────────────────────────────────────────
  const tiffFiles = walkDir(INHOUSE_ROOT, [".tiff", ".tif"]);
  const tier3 = bestMatch(tiffFiles, normTitle, JACCARD_THRESHOLD);
  if (tier3) {
    const confidence = tier3.score >= 0.9 ? "high" : tier3.score >= 0.75 ? "medium" : "low";
    return {
      tier: "tiff",
      path: tier3.path,
      score: tier3.score,
      confidence,
      reason: `In-house TIFF match (score ${tier3.score.toFixed(2)})`,
    };
  }

  // ── Tier 4: In-house PDF ─────────────────────────────────────────────────────
  const pdfFiles = walkDir(INHOUSE_ROOT, [".pdf"]);
  const tier4 = bestMatch(pdfFiles, normTitle, JACCARD_THRESHOLD);
  if (tier4) {
    const confidence = tier4.score >= 0.9 ? "high" : tier4.score >= 0.75 ? "medium" : "low";
    return {
      tier: "pdf",
      path: tier4.path,
      score: tier4.score,
      confidence,
      reason: `In-house PDF match (score ${tier4.score.toFixed(2)})`,
    };
  }

  // ── Tier 5: Placeholder ──────────────────────────────────────────────────────
  return placeholder(`No asset found for "${title}"`);
}

function placeholder(reason: string): ResolvedResource {
  return {
    tier: "placeholder",
    path: null,
    score: 0,
    confidence: "low",
    reason,
  };
}
