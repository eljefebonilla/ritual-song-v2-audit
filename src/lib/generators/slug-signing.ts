import { createHmac } from "crypto";

const HMAC_SECRET = process.env.WA_SLUG_SECRET || process.env.NEXTAUTH_SECRET || "ritual-song-wa-default-secret";
const TOKEN_LENGTH = 8;

/**
 * Generate a signed slug for a worship aid mobile URL.
 * Format: {parish-slug}-{occasion-code}-{token}
 */
export function generateSignedSlug(
  parishSlug: string,
  occasionCode: string
): string {
  const base = `${parishSlug}-${occasionCode}`;
  const token = computeToken(base);
  return `${base}-${token}`;
}

/**
 * Verify a signed slug and extract the components.
 * Returns null if the signature is invalid.
 */
export function verifySignedSlug(
  slug: string
): { parishSlug: string; occasionCode: string } | null {
  // Token is the last TOKEN_LENGTH chars after the last hyphen
  const lastHyphen = slug.lastIndexOf("-");
  if (lastHyphen === -1 || lastHyphen === slug.length - 1) return null;

  const base = slug.slice(0, lastHyphen);
  const token = slug.slice(lastHyphen + 1);

  if (token.length !== TOKEN_LENGTH) return null;

  const expectedToken = computeToken(base);
  if (token !== expectedToken) return null;

  // Split base into parish slug and occasion code
  // Parish slug is everything before the first digit sequence that looks like an occasion code
  // Occasion codes look like: advent-01-a, lent-05-b, ordinary-23-c
  const parts = base.split("-");
  if (parts.length < 3) return null;

  // Last part before token is the cycle letter (a/b/c) or last segment of occasion
  // Find the split between parish slug and occasion code
  // Convention: parish slug uses only lowercase alpha, occasion codes have numbers
  let splitIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (/\d/.test(parts[i])) {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx === 0) {
    // No numbers found, can't determine occasion code
    // Treat first part as parish, rest as occasion
    return {
      parishSlug: parts[0],
      occasionCode: parts.slice(1).join("-"),
    };
  }

  return {
    parishSlug: parts.slice(0, splitIdx).join("-"),
    occasionCode: parts.slice(splitIdx).join("-"),
  };
}

/**
 * Check if an occasion date is within the allowed time window (7 days).
 */
export function isWithinTimeWindow(
  occasionDate: string,
  windowDays: number = 7
): boolean {
  const occasion = new Date(occasionDate + "T00:00:00");
  const now = new Date();
  const diffMs = now.getTime() - occasion.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Allow 3 days before and windowDays after
  return diffDays >= -3 && diffDays <= windowDays;
}

function computeToken(base: string): string {
  return createHmac("sha256", HMAC_SECRET)
    .update(base)
    .digest("hex")
    .slice(0, TOKEN_LENGTH);
}
