import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";

const SECRET_PREFIX = "enc:v1";
const SECRET_CONTEXT = "zixu:deepseek-user-key:v1";

export interface SecretCipher {
  seal: (plaintext: string) => string;
  open: (sealed: string) => string;
  isSealed: (value: string) => boolean;
}

export function createSecretCipher(rootSecret: string): SecretCipher {
  if (!rootSecret) throw new Error("A server secret is required for secret encryption.");
  const key = createHash("sha256")
    .update(SECRET_CONTEXT)
    .update("\0")
    .update(rootSecret)
    .digest();

  return {
    seal(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(SECRET_CONTEXT));
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [
        SECRET_PREFIX,
        iv.toString("base64url"),
        tag.toString("base64url"),
        ciphertext.toString("base64url")
      ].join(":");
    },
    open(sealed) {
      const [marker, version, encodedIv, encodedTag, encodedCiphertext, ...extra] = sealed.split(":");
      if (`${marker}:${version}` !== SECRET_PREFIX || extra.length > 0) {
        throw new Error("Unsupported encrypted secret format.");
      }
      const iv = Buffer.from(encodedIv, "base64url");
      const tag = Buffer.from(encodedTag, "base64url");
      const ciphertext = Buffer.from(encodedCiphertext, "base64url");
      if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
        throw new Error("Invalid encrypted secret payload.");
      }
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(SECRET_CONTEXT));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    },
    isSealed(value) {
      return value.startsWith(`${SECRET_PREFIX}:`);
    }
  };
}
