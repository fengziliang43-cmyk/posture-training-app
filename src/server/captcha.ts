import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export interface AuthCaptchaChallenge {
  id: string;
  imageDataUrl: string;
  expiresAt: string;
}

interface StoredChallenge {
  answerDigest: Buffer;
  expiresAt: number;
}

interface AuthCaptchaServiceOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
  codeFactory?: () => string;
}

const DIGIT_SEGMENTS: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"]
};

const SEGMENT_RECTS: Record<string, { x: number; y: number; width: number; height: number }> = {
  a: { x: 5, y: 0, width: 22, height: 4 },
  b: { x: 27, y: 4, width: 4, height: 22 },
  c: { x: 27, y: 30, width: 4, height: 22 },
  d: { x: 5, y: 52, width: 22, height: 4 },
  e: { x: 1, y: 30, width: 4, height: 22 },
  f: { x: 1, y: 4, width: 4, height: 22 },
  g: { x: 5, y: 26, width: 22, height: 4 }
};

export class AuthCaptchaService {
  private readonly entries = new Map<string, StoredChallenge>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly codeFactory: () => string;

  constructor(options: AuthCaptchaServiceOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.now = options.now ?? Date.now;
    this.codeFactory = options.codeFactory ?? createFourDigitCode;
    if (this.ttlMs < 1 || this.maxEntries < 1) {
      throw new Error("Captcha limits must be positive.");
    }
  }

  issue(): AuthCaptchaChallenge {
    const code = this.codeFactory();
    if (!/^\d{4}$/.test(code)) {
      throw new Error("Captcha code factory must return four digits.");
    }

    const now = this.now();
    this.removeExpired(now);
    while (this.entries.size >= this.maxEntries) {
      const oldestId = this.entries.keys().next().value as string | undefined;
      if (!oldestId) break;
      this.entries.delete(oldestId);
    }

    const id = randomBytes(18).toString("base64url");
    const expiresAt = now + this.ttlMs;
    this.entries.set(id, {
      answerDigest: digestAnswer(id, code),
      expiresAt
    });

    return {
      id,
      imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(renderCaptchaSvg(code)).toString("base64")}`,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  verify(id: string | undefined, answer: string | undefined): boolean {
    if (!id || !answer || !/^\d{4}$/.test(answer.trim())) return false;
    const challenge = this.entries.get(id);
    if (!challenge) return false;

    this.entries.delete(id);
    if (challenge.expiresAt <= this.now()) return false;

    const candidate = digestAnswer(id, answer.trim());
    return candidate.length === challenge.answerDigest.length &&
      timingSafeEqual(candidate, challenge.answerDigest);
  }

  private removeExpired(now: number): void {
    for (const [id, challenge] of this.entries) {
      if (challenge.expiresAt <= now) this.entries.delete(id);
    }
  }
}

function createFourDigitCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

function digestAnswer(id: string, answer: string): Buffer {
  return createHash("sha256").update(id).update("\0").update(answer).digest();
}

function renderCaptchaSvg(code: string): string {
  const digits = [...code].map((digit, index) => {
    const rotation = randomInt(0, 7) - 3;
    const offsetY = randomInt(0, 5) - 2;
    const segments = DIGIT_SEGMENTS[digit]
      .map((segment) => {
        const rect = SEGMENT_RECTS[segment];
        return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="2"/>`;
      })
      .join("");
    return `<g transform="translate(${18 + index * 48} ${13 + offsetY}) rotate(${rotation} 16 28)">${segments}</g>`;
  }).join("");

  const noise = Array.from({ length: 8 }, () => {
    const x1 = randomInt(0, 224);
    const y1 = randomInt(0, 82);
    const x2 = randomInt(0, 224);
    const y2 = randomInt(0, 82);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="224" height="82" viewBox="0 0 224 82">',
    "<title>请输入图中的四位数字</title>",
    '<rect width="224" height="82" rx="16" fill="#f4f1fb"/>',
    `<g stroke="#a9a2c9" stroke-width="1.4" opacity="0.42">${noise}</g>`,
    `<g fill="#302d3a">${digits}</g>`,
    "</svg>"
  ].join("");
}
