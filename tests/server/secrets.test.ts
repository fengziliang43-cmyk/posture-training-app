import { describe, expect, it } from "vitest";
import { createSecretCipher } from "../../src/server/secrets";

describe("server secret encryption", () => {
  it("round-trips a key without embedding plaintext and rejects tampering", () => {
    const cipher = createSecretCipher("test-cookie-secret-with-more-than-32-characters");
    const plaintext = "sk-test-encryption-placeholder";
    const sealed = cipher.seal(plaintext);

    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain(plaintext);
    expect(cipher.open(sealed)).toBe(plaintext);

    const tampered = `${sealed.slice(0, -1)}${sealed.endsWith("A") ? "B" : "A"}`;
    expect(() => cipher.open(tampered)).toThrow();
    expect(() => createSecretCipher("a-different-server-secret").open(sealed)).toThrow();
  });
});
