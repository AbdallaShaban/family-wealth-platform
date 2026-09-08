import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function keyFrom(secret: string) {
  if (!secret || secret.length < 16) throw new Error("سر تشفير الخزنة غير متاح.");
  return createHash("sha256").update(secret).digest();
}

export function encryptVaultValue(value: string, secret = process.env.JWT_SECRET) {
  const key = keyFrom(secret ?? "");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${payload.toString("base64url")}`;
}

export function decryptVaultValue(token: string, secret = process.env.JWT_SECRET) {
  const [version, ivValue, tagValue, payloadValue] = token.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !payloadValue) throw new Error("بيانات الخزنة المشفرة غير صالحة.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret ?? ""), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payloadValue, "base64url")), decipher.final()]).toString("utf8");
}
