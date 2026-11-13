#!/usr/bin/env node
// Builds the English validation site: copies site/en/ to dist/site-en/ and fills in the values from
// site/site.config.json. Without --preview every value must be set; that is the gate before publishing.
// usage: node scripts/build-site.mjs [--preview]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_DIR = join(ROOT, "site", "en");
export const OUTPUT_DIR = join(ROOT, "dist", "site-en");
const CONFIG_FILE = join(ROOT, "site", "site.config.json");

const TOKENS = {
  baseUrl: "BASE_URL",
  waitlistUrl: "WAITLIST_URL",
  contactEmail: "CONTACT_EMAIL",
  controllerName: "CONTROLLER_NAME",
  formProvider: "FORM_PROVIDER",
  updated: "UPDATED"
};

// Obvious stand-ins so a preview build can be checked before the real values exist.
const PREVIEW = {
  baseUrl: "https://preview.invalid",
  waitlistUrl: "https://preview.invalid/#waitlist-form",
  contactEmail: "hello@preview.invalid",
  controllerName: "[name to be confirmed]",
  formProvider: "Tally (tally.so, based in Belgium)",
  updated: "2026-11-13"
};

const RULES = {
  baseUrl: [/^https:\/\/[a-z0-9.-]+(:\d+)?$/i, "an https origin without a trailing slash"],
  waitlistUrl: [/^https:\/\/\S+$/, "an https link to the waitlist form"],
  contactEmail: [/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, "an email address"],
  controllerName: [/\S/, "the name of whoever runs the site"],
  formProvider: [/\S/, "the form service and where it is based"],
  updated: [/^\d{4}-\d{2}-\d{2}$/, "a date written YYYY-MM-DD"]
};

const TEXT_EXTENSIONS = new Set([".html", ".txt", ".xml", ".css", ".svg", ".json"]);
const ESCAPED_EXTENSIONS = new Set([".html", ".xml", ".svg"]);

/** The values the site is built with; throws with every missing or malformed value listed. */
export function resolveConfig({ preview = false } = {}) {
  if (preview) return { ...PREVIEW };
  const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  const problems = [];
  for (const [key, [pattern, meaning]] of Object.entries(RULES)) {
    const value = typeof config[key] === "string" ? config[key].trim() : "";
    if (!pattern.test(value)) problems.push(`${key} must be ${meaning} (now ${JSON.stringify(config[key] ?? "")})`);
  }
  if (problems.length > 0) {
    throw new Error(`site/site.config.json is not ready to publish:\n- ${problems.join("\n- ")}`);
  }
  return Object.fromEntries(Object.keys(RULES).map((key) => [key, config[key].trim()]));
}

function escapeMarkup(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export function buildSite({ preview = false } = {}) {
  const config = resolveConfig({ preview });
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  for (const source of listFiles(SOURCE_DIR)) {
    const target = join(OUTPUT_DIR, relative(SOURCE_DIR, source));
    mkdirSync(dirname(target), { recursive: true });
    const extension = extname(source).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) {
      copyFileSync(source, target);
      continue;
    }
    let text = readFileSync(source, "utf8");
    for (const [key, token] of Object.entries(TOKENS)) {
      const value = ESCAPED_EXTENSIONS.has(extension) ? escapeMarkup(config[key]) : config[key];
      text = text.split(`{{${token}}}`).join(value);
    }
    const leftover = /\{\{[A-Z_]+\}\}/.exec(text);
    if (leftover) throw new Error(`${relative(ROOT, source)} still contains ${leftover[0]} (not a known value)`);
    writeFileSync(target, text);
  }
  return config;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const preview = process.argv.includes("--preview");
  try {
    const config = buildSite({ preview });
    console.log(`built ${relative(ROOT, OUTPUT_DIR)} for ${config.baseUrl}${preview ? " (preview values)" : ""}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
