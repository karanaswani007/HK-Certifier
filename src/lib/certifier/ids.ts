import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}

function randomCode(length: number): string {
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

/** Public, unique, hard-to-guess certificate identifier. */
export function generateCertificateId(programCode = "GEN"): string {
  const year = new Date().getFullYear();
  const code = programCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "GEN";
  return `HKC-${year}-${code}-${randomCode(8)}`;
}

export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "org";
}

export function uniqueSlug(name: string): string {
  return `${slugify(name)}-${randomCode(4).toLowerCase()}`;
}

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function programCodeFromName(name: string): string {
  const stop = new Set(["days", "day", "of", "the", "for", "a", "an", "in", "and", "to", "on"]);
  const words = name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]/.test(w) && !stop.has(w.toLowerCase()));
  if (words.length === 0) return "GEN";
  const acronym = words.find((w) => w.length <= 4);
  if (acronym) return acronym.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  if (words.length === 1) {
    return words[0]!.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
