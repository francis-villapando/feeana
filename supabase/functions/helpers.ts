import { createHash } from "crypto";

export function hashToken(token: string, salt: string) {
  return createHash("sha256").update(token + salt).digest("hex");
}

export function genToken(): string {
  return cryptoRandom(32);
}

function cryptoRandom(bytes: number) {
  // returns base64url string
  const buf = Buffer.from(Array.from({ length: bytes }, () => Math.floor(Math.random() * 256)));
  return buf.toString("hex");
}
