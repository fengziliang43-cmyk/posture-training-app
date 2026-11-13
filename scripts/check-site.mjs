#!/usr/bin/env node
// Checks the built English validation site before it is published. Plain Node, no dependencies.
// usage: node scripts/check-site.mjs [--preview]     (checks dist/site-en against site/site.config.json)
//        node scripts/check-site.mjs --self-test     (proves the checks catch what they are meant to)
// Exit code 0 means every check passed.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OUTPUT_DIR, resolveConfig } from "./build-site.mjs";

/** The only pages the site has, and the path each one is served at. */
export const PAGES = { "index.html": "/", "privacy.html": "/privacy" };
const REQUIRED_FILES = ["index.html", "privacy.html", "styles.css", "icon.svg", "robots.txt", "sitemap.xml", "llms.txt"];
const CSS_TOKENS = ["--bg", "--surface", "--text", "--muted", "--accent", "--accent-ink", "--line", "--warn-soft"];
const MAX_HTML_BYTES = 60_000;
const MAX_CSS_BYTES = 30_000;

// Words that would present Zixu as a treatment. "does not diagnose, treat or prevent" stays allowed
// because "treat" itself is not on the list, and "physiotherapist" has no word break before "therap".
export const CLAIM_WORDS =
  /\b(cure[sd]?|curing|heal(?:s|ed|ing)?|straighten(?:s|ed|ing)?|revers(?:e|es|ed|ing)|correct(?:s|ed|ing|ion|ive)?|treatment|therapy|therapies|therapeutic|clinically|proven|guarantee[sd]?|doctor[- ]approved|medical[- ]grade)\b/i;

export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return match ? match[1] : null;
}

function metaContent(html, key, value) {
  const tag = (html.match(/<meta\b[^>]*>/gi) ?? []).find((candidate) => (attr(candidate, key) ?? "").toLowerCase() === value);
  return tag ? attr(tag, "content") : null;
}

/** Problems found in one page; an empty list means the page passes. */
export function checkPage(html, { path, baseUrl, isIndex = false }) {
  const problems = [];
  const expectedUrl = baseUrl.replace(/\/$/, "") + path;

  if (!/^<!doctype html>/i.test(html.trimStart())) problems.push("must start with <!doctype html>");
  if (!/<html\b[^>]*\blang="en"/i.test(html)) problems.push('missing <html lang="en">');
  if (!/<meta\s+charset="utf-8"\s*\/?>/i.test(html)) problems.push('missing <meta charset="utf-8">');
  if (metaContent(html, "name", "viewport") !== "width=device-width, initial-scale=1") problems.push("missing viewport meta");

  const title = (/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "").trim();
  if (title.length < 10 || title.length > 60) problems.push(`title must be 10-60 characters (is ${title.length})`);
  const description = (metaContent(html, "name", "description") ?? "").trim();
  if (description.length < 50 || description.length > 160) problems.push(`meta description must be 50-160 characters (is ${description.length})`);

  const canonical = (html.match(/<link\b[^>]*\brel="canonical"[^>]*>/i) ?? [])[0];
  if (!canonical || attr(canonical, "href") !== expectedUrl) problems.push(`canonical must be ${expectedUrl}`);
  for (const property of ["og:type", "og:title", "og:description", "og:url"]) {
    if (!metaContent(html, "property", property)) problems.push(`missing ${property}`);
  }
  if (metaContent(html, "property", "og:url") !== expectedUrl) problems.push(`og:url must be ${expectedUrl}`);

  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count !== 1) problems.push(`exactly one <h1> required (found ${h1Count})`);

  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (attr(tag, "src")) problems.push(`no external scripts: ${tag}`);
    if (attr(tag, "type") !== "application/ld+json") problems.push(`only JSON-LD scripts are allowed: ${tag}`);
  }
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(block[1]);
    } catch {
      problems.push("JSON-LD is not valid JSON");
    }
  }
  if (isIndex && !/"@type"\s*:\s*"SoftwareApplication"/.test(html)) problems.push("index needs SoftwareApplication JSON-LD");
  if (/<iframe\b/i.test(html)) problems.push("no iframes");
  if (/document\.cookie|localStorage|sessionStorage|googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic/i.test(html)) {
    problems.push("no cookies, browser storage, analytics or web fonts");
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/^(https?:)?\/\//i.test(attr(tag, "href") ?? "") && attr(tag, "rel") !== "canonical") {
      problems.push(`no stylesheets or icons from other sites: ${tag}`);
    }
  }

  const claim = CLAIM_WORDS.exec(visibleText(html));
  if (claim) problems.push(`treatment claim word "${claim[0]}" in visible text`);
  if (!/<footer\b[\s\S]*href="\/privacy"[\s\S]*<\/footer>/i.test(html)) problems.push("footer must link to /privacy");

  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]));
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(match[0], "href");
    if (href === null || href === "") {
      problems.push(`link without href: ${match[0]}`);
    } else if (/^http:/i.test(href)) {
      problems.push(`links must use https: ${href}`);
    } else if (href.startsWith("#") && !ids.has(href.slice(1))) {
      problems.push(`link to a missing section: ${href}`);
    }
  }
  return problems;
}

/** Problems found in the whole built site; an empty list means it is ready to publish. */
export function checkSite(dir, config) {
  const problems = [];
  const base = config.baseUrl.replace(/\/$/, "");
  for (const name of REQUIRED_FILES) {
    if (!existsSync(join(dir, name))) problems.push(`missing ${name}`);
  }
  if (problems.length > 0) return problems;

  const htmlFiles = readdirSync(dir).filter((name) => name.endsWith(".html"));
  for (const name of htmlFiles) {
    if (!(name in PAGES)) problems.push(`unexpected page ${name}: the site has only ${Object.keys(PAGES).join(" and ")}`);
  }

  for (const [name, path] of Object.entries(PAGES)) {
    const file = join(dir, name);
    const html = readFileSync(file, "utf8");
    if (statSync(file).size > MAX_HTML_BYTES) problems.push(`${name} is larger than ${MAX_HTML_BYTES} bytes`);
    for (const problem of checkPage(html, { path, baseUrl: base, isIndex: name === "index.html" })) {
      problems.push(`${name}: ${problem}`);
    }
    for (const match of html.matchAll(/\b(?:href|src)="(\/[^"#?]*)/gi)) {
      const target = match[1] === "/" ? "index.html" : match[1] === "/privacy" ? "privacy.html" : match[1].slice(1);
      if (!existsSync(join(dir, target))) problems.push(`${name}: link to ${match[1]} has no file behind it`);
    }
  }

  const index = readFileSync(join(dir, "index.html"), "utf8");
  for (const id of ["waitlist-cta", "waitlist-cta-2"]) {
    const tag = (index.match(new RegExp(`<a\\b[^>]*\\bid="${id}"[^>]*>`, "i")) ?? [])[0];
    const href = tag ? attr(tag, "href")?.replace(/&amp;/g, "&") : null;
    if (href !== config.waitlistUrl) problems.push(`index.html: #${id} must link to the waitlist form (${config.waitlistUrl})`);
  }

  const cssFile = join(dir, "styles.css");
  const css = readFileSync(cssFile, "utf8");
  if (statSync(cssFile).size > MAX_CSS_BYTES) problems.push(`styles.css is larger than ${MAX_CSS_BYTES} bytes`);
  if (/@import|url\(\s*["']?(https?:)?\/\//i.test(css)) problems.push("styles.css must not load anything from other sites");
  if (!/@media\s*\(prefers-color-scheme:\s*dark\)/i.test(css)) problems.push("styles.css needs a prefers-color-scheme: dark block");
  for (const token of CSS_TOKENS) {
    if (!new RegExp(`${token}\\s*:`).test(css)) problems.push(`styles.css must define ${token}`);
  }

  const robots = readFileSync(join(dir, "robots.txt"), "utf8");
  if (!robots.includes(`Sitemap: ${base}/sitemap.xml`)) problems.push("robots.txt must point to the sitemap");
  const sitemap = readFileSync(join(dir, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  const expectedLocs = Object.values(PAGES).map((path) => base + path).sort();
  if (JSON.stringify(locs) !== JSON.stringify(expectedLocs)) problems.push(`sitemap.xml must list exactly ${expectedLocs.join(", ")}`);
  const llms = readFileSync(join(dir, "llms.txt"), "utf8");
  if (!llms.startsWith("# Zixu\n") || !llms.includes("\n> ")) problems.push("llms.txt must start with '# Zixu' and a '> ' summary line");

  for (const name of ["index.html", "privacy.html", "robots.txt", "sitemap.xml", "llms.txt", "styles.css"]) {
    if (/\{\{[A-Z_]+\}\}/.test(readFileSync(join(dir, name), "utf8"))) problems.push(`${name} still has an unfilled {{...}} value`);
  }
  return problems;
}

function selfTest() {
  const base = "https://example.org";
  const good = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zixu test page title</title>
<meta name="description" content="A description that is long enough to pass the fifty character minimum.">
<link rel="canonical" href="${base}/"><meta property="og:type" content="website"><meta property="og:title" content="t">
<meta property="og:description" content="d"><meta property="og:url" content="${base}/">
<script type="application/ld+json">{"@type":"SoftwareApplication"}</script></head>
<body><h1 id="top">Hello</h1><p>It does not diagnose, treat or prevent any condition. Ask your physiotherapist.</p>
<a href="#top">Top</a><footer><a href="/privacy">Privacy</a></footer></body></html>`;
  const cases = [
    ["passes a clean page", good, null],
    ["missing canonical", good.replace(/<link rel="canonical"[^>]*>/, ""), "canonical must be"],
    ["two h1", good.replace("<h1 id=\"top\">Hello</h1>", "<h1 id=\"top\">A</h1><h1>B</h1>"), "exactly one <h1>"],
    ["claim word", good.replace("Hello", "Cure your back"), 'claim word "Cure"'],
    ["straighten", good.replace("Hello", "Straighten your spine"), 'claim word "Straighten"'],
    ["external script", good.replace("</head>", '<script src="https://x.example/a.js"></script></head>'), "no external scripts"],
    ["web font", good.replace("</head>", '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=X"></head>'), "web fonts"],
    ["http link", good.replace('href="#top"', 'href="http://example.org"'), "must use https"],
    ["missing section", good.replace('href="#top"', 'href="#nowhere"'), "missing section"],
    ["short description", good.replace(/content="A description[^"]*"/, 'content="Too short"'), "meta description must be"],
    ["footer without privacy link", good.replace('<footer><a href="/privacy">Privacy</a></footer>', "<footer></footer>"), "footer must link"]
  ];
  let failed = 0;
  for (const [label, html, expected] of cases) {
    const problems = checkPage(html, { path: "/", baseUrl: base, isIndex: true });
    const ok = expected === null ? problems.length === 0 : problems.some((problem) => problem.includes(expected));
    if (!ok) {
      failed += 1;
      console.error(`self-test failed: ${label}\n  got: ${JSON.stringify(problems)}`);
    }
  }
  if (failed > 0) process.exit(1);
  console.log(`self-test passed (${cases.length} cases)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--self-test")) {
    selfTest();
  } else {
    const preview = process.argv.includes("--preview");
    let config;
    try {
      config = resolveConfig({ preview });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
    const problems = checkSite(OUTPUT_DIR, config);
    if (problems.length > 0) {
      console.error(`site check failed (${problems.length}):\n- ${problems.join("\n- ")}`);
      process.exit(1);
    }
    console.log(`site check passed for ${config.baseUrl}${preview ? " (preview values)" : ""}`);
  }
}
