# 执行方案：英文验证站 v1（交给 agy）

WORKDIR: /Users/liang/Documents/Codex/2026-11-11/zixu-batch1-fix（分支 `feat/overseas-validation-site`）
写方案和验收：Claude。执行：agy。这一份只做三个文件，其余文件已经备好，不准改。

## 1. 目标（一句话）
新建 `site/en/index.html`、`site/en/privacy.html`、`site/en/styles.css` 三个文件，使第 5 节的验收命令全部通过：一个只有两页的英文静态站（介绍页 + 隐私页），用来收集海外用户的等候名单。

## 2. 背景与已定决策
- 为什么做：姿序准备面向英语国家，先用一个英文介绍页加等候名单看有没有人愿意付费，再决定做不做英文版。这一步不收钱、不收健康信息、不放任何追踪。
- 先读（只读，读完再动手）：
  - `scripts/build-site.mjs`：把 `site/en/` 复制到 `dist/site-en/`，把 `{{BASE_URL}}` 这类占位换成 `site/site.config.json` 里的值。页面里的占位原样保留，不要自己填。
  - `scripts/check-site.mjs`：验收时用它逐页检查（标题长度、描述长度、canonical、只有一个 h1、只允许 JSON-LD 脚本、不准出现“治疗”类词、站内链接要能找到文件、样式表要有颜色变量和深色模式）。你的页面要能通过它。
  - `site/en/robots.txt`、`site/en/sitemap.xml`、`site/en/llms.txt`、`site/en/icon.svg`：已经写好，页面里引用 `/icon.svg` 和 `/styles.css`。
- 已定的设计决定（照做，不要改）：
  - 两个 HTML 文件的内容**逐字照抄**第 A、B 节，包括英文文案、标点、属性、缩进和占位符。文案里看起来像错别字的地方也不要改，写进汇报。
  - 英文里的撇号一律用直撇号 `'`，不要换成弯撇号。
  - `styles.css` 只按第 C 节写：只用 C 节列出的选择器，颜色只用 C 节的变量，不引入任何字体、图片、外部文件，不写动画。
  - 不加 JavaScript（JSON-LD 那段已经在 A 节里，它不是脚本程序）。
- 参照写法：无。

## 3. 范围
```scope
create: site/en/index.html
create: site/en/privacy.html
create: site/en/styles.css
```
- 只读参考：`scripts/build-site.mjs`、`scripts/check-site.mjs`、`site/site.config.json`、`site/en/robots.txt`、`site/en/sitemap.xml`、`site/en/llms.txt`、`site/en/icon.svg`
- scope 以外的文件一律不改；需要改 → BLOCKED。

## 4. 执行步骤
1. 读第 2 节列出的文件 → 预期：知道占位符怎么被替换、检查脚本查什么；不做任何修改。
2. 新建 `site/en/index.html`，内容与第 A 节代码块完全一致 → 预期：两者逐字相同。
3. 新建 `site/en/privacy.html`，内容与第 B 节代码块完全一致 → 预期：两者逐字相同。
4. 新建 `site/en/styles.css`，按第 C 节逐条写出 → 预期：C 节的每一条都能在文件里找到对应规则，文件里没有 C 节以外的选择器。
5. 按第 8 节格式写汇报 → 预期：列出正好三个文件。

不需要运行任何命令，验收由 Claude 来跑。如果你所在的环境允许运行命令，最多只能运行第 5 节里那三条 `node` 命令自查；其他命令（`npm install`、`git commit`、`git push`、`npx wrangler`、`curl` 等）一律不运行。

## 5. 验收（Claude 在 WORKDIR 重跑；每行一条命令，exit 0 = 通过）
```accept
node scripts/check-site.mjs --self-test
node scripts/build-site.mjs --preview
node scripts/check-site.mjs --preview
grep -qF "A steady daily routine for your back, made for adults living with scoliosis" dist/site-en/index.html
grep -qF "Please don't share health details in it." dist/site-en/index.html
grep -qF "We rely on your consent to do this." dist/site-en/privacy.html
grep -qF "counter(step)" site/en/styles.css
grep -qF "clamp(30px, 6vw, 46px)" site/en/styles.css
test "$(git status --porcelain --untracked-files=all | grep -v ' tools/generate-after-shots.mjs$' | sed 's/^...//' | sort | tr '\n' ' ')" = "site/en/index.html site/en/privacy.html site/en/styles.css "
```
- 人工核对项（Claude 截图看）：360、390、1440 三种宽度，浅色和深色都看；没有横向滚动；按钮文字看得清；步骤卡片在宽屏是三列、窄屏是一列；红旗信号那一块有浅橙底色。

## 6. 本任务特有的禁止事项
- 不改第 A、B 节的任何文字，不加页面，不加图片，不加第三方资源（字体、统计、图标库、CDN）。
- 不填占位符（`{{BASE_URL}}`、`{{WAITLIST_URL}}`、`{{FORM_PROVIDER}}`、`{{CONTROLLER_NAME}}`、`{{CONTACT_EMAIL}}`、`{{UPDATED}}`），不写任何真实的姓名、邮箱、网址。
- 不改 `scripts/`、`site/site.config.json`、`site/en/` 里已有的文件，不改仓库里任何其他文件。
- 不 commit、不 push、不部署、不注册任何账号。

## 7. 停止条件（命中任一 → 立即 BLOCKED，并在汇报里写明原因）
- 需要修改 scope 以外的文件。
- 同一步骤尝试 2 次仍做不出来。
- `scripts/check-site.mjs` 或 `scripts/build-site.mjs` 不存在。
- 照抄 A、B 节以后，仍然有检查项明显过不了（例如检查脚本要求的东西 A、B 节里没有）：不要改文案去凑，停下来报告。
- 任何一步需要账号、密码、网络或真实个人信息。

## 8. 汇报格式（做完在对话里按这个格式写）
```
## 汇报
- 状态：DONE / BLOCKED
- 新建的文件：site/en/index.html、site/en/privacy.html、site/en/styles.css（BLOCKED 时写实际建了哪些）
- 和方案不一致的地方：（逐条写；没有就写“无”）
- 发现但没动的问题：（例如文案疑似笔误、检查脚本的疑问；没有就写“无”）
```

---

## A. `site/en/index.html`（逐字照抄）

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zixu: posture log and daily exercise plan for scoliosis</title>
  <meta name="description" content="Log back discomfort and posture photos, and get a short, conservative exercise routine each day. Zixu stops on red flags and does not diagnose.">
  <link rel="canonical" href="{{BASE_URL}}/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Zixu: a steady daily routine for adults living with scoliosis">
  <meta property="og:description" content="A two-minute check-in turns into a short, conservative exercise routine. Stops on red flags. Open source.">
  <meta property="og:url" content="{{BASE_URL}}/">
  <meta name="theme-color" content="#6a5ce0">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "Zixu",
      "url": "{{BASE_URL}}/",
      "inLanguage": "en"
    },
    {
      "@type": "SoftwareApplication",
      "name": "Zixu",
      "applicationCategory": "LifestyleApplication",
      "operatingSystem": "Web, Android",
      "url": "{{BASE_URL}}/",
      "description": "An open-source posture log and daily exercise planner for adults living with scoliosis. It stops on red flags and does not diagnose or treat.",
      "isAccessibleForFree": true,
      "license": "https://opensource.org/licenses/MIT",
      "sameAs": ["https://github.com/fengziliang43-cmyk/posture-training-app"]
    }
  ]
}
  </script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Zixu home">
      <svg class="brand-mark" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <circle cx="12.5" cy="5" r="2.7" fill="#c8402f"/>
        <path d="M12.5 9.6c-3.6 2.2-3.8 6.6-.9 9.4 1.2 1.2 2.4 1.8 3.6 2.1" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
      </svg>
      <span>Zixu</span>
    </a>
    <nav class="site-nav" aria-label="Sections">
      <a href="#how">How it works</a>
      <a href="#safety">Safety</a>
      <a href="#waitlist">Waitlist</a>
    </nav>
  </header>

  <main>
    <section class="hero" id="top">
      <h1>A steady daily routine for your back, made for adults living with scoliosis</h1>
      <p class="lead">Zixu turns a two-minute check-in (how your back feels, your energy, the time you have) into a short, conservative exercise routine. If you report a warning sign, it tells you to stop for the day and see a doctor instead.</p>
      <p><a class="button" id="waitlist-cta" href="{{WAITLIST_URL}}">Join the waitlist</a></p>
      <p class="note">The English version isn't open yet. Join the list and we'll email you when it is, and nothing else.</p>
    </section>

    <section id="how">
      <h2>How it works</h2>
      <ol class="steps">
        <li>
          <h3>Check in</h3>
          <p>Rate your back discomfort from 0 to 10, and say how much energy you have and how many minutes you can spare.</p>
        </li>
        <li>
          <h3>Get today's routine</h3>
          <p>Zixu picks a few low-load exercises, such as dead bug, bird dog and glute bridge, gives each one clear stop rules, and fits the session to your day.</p>
        </li>
        <li>
          <h3>Keep a record</h3>
          <p>Note how your back feels afterwards, and take posture photos the same way each time so you can compare them side by side.</p>
        </li>
      </ol>
    </section>

    <section id="safety">
      <h2>Safety comes first</h2>
      <p>Zixu won't build a routine on a day you report any of these:</p>
      <ul class="red-flags">
        <li>Numbness or tingling in your legs</li>
        <li>Pain that shoots down a leg</li>
        <li>New weakness in a leg or foot</li>
        <li>Changes in bladder or bowel control</li>
        <li>Sudden, sharp back pain</li>
      </ul>
      <p>These can be signs that something needs a doctor's attention. If your back feels clearly worse after a session, Zixu can make the next one lighter, or turn it into a rest day.</p>
    </section>

    <section id="limits">
      <h2>What Zixu does not do</h2>
      <ul class="plain-list">
        <li>It doesn't diagnose scoliosis or measure your curve.</li>
        <li>It makes no promises about changing your curve.</li>
        <li>It isn't a substitute for your doctor or physiotherapist. If you're under their care, follow their plan first.</li>
        <li>It isn't for children or teenagers. If your child has scoliosis, please follow their specialist's advice.</li>
      </ul>
    </section>

    <section id="who">
      <h2>Who it's for</h2>
      <p>Adults (18 and over) who have been told they have scoliosis and want a gentle, regular way to stay active and keep track of how they feel.</p>
    </section>

    <section id="open-source">
      <h2>Open source</h2>
      <p>Zixu is open source under the MIT licence. You can read every line of the code on <a href="https://github.com/fengziliang43-cmyk/posture-training-app">GitHub</a>.</p>
    </section>

    <section class="waitlist" id="waitlist">
      <h2>Join the waitlist</h2>
      <p>We're preparing the English version. Leave your email and we'll write once, when it opens. The form also asks which country you live in and what you would pay each month, so we can decide whether to build it.</p>
      <p><a class="button" id="waitlist-cta-2" href="{{WAITLIST_URL}}">Join the waitlist</a></p>
      <p class="note">The form is run by {{FORM_PROVIDER}}. Please don't share health details in it. Read our <a href="/privacy">privacy notice</a>.</p>
    </section>
  </main>

  <footer class="site-footer">
    <p>Zixu is a general wellness and exercise-logging app. It is not a medical device and does not diagnose, treat or prevent any condition.</p>
    <p><a href="/privacy">Privacy</a> · <a href="https://github.com/fengziliang43-cmyk/posture-training-app">Source code</a> · © 2026 Zixu</p>
  </footer>
</body>
</html>
```

## B. `site/en/privacy.html`（逐字照抄）

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy notice | Zixu</title>
  <meta name="description" content="How the Zixu website and waitlist handle your information: no cookies, no tracking, and only the details you choose to give in the waitlist form.">
  <link rel="canonical" href="{{BASE_URL}}/privacy">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Privacy notice | Zixu">
  <meta property="og:description" content="No cookies, no tracking, and only the details you choose to give in the waitlist form.">
  <meta property="og:url" content="{{BASE_URL}}/privacy">
  <meta name="theme-color" content="#6a5ce0">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Zixu home">
      <svg class="brand-mark" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <circle cx="12.5" cy="5" r="2.7" fill="#c8402f"/>
        <path d="M12.5 9.6c-3.6 2.2-3.8 6.6-.9 9.4 1.2 1.2 2.4 1.8 3.6 2.1" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
      </svg>
      <span>Zixu</span>
    </a>
    <nav class="site-nav" aria-label="Sections">
      <a href="/#how">How it works</a>
      <a href="/#safety">Safety</a>
      <a href="/#waitlist">Waitlist</a>
    </nav>
  </header>

  <main class="prose">
    <h1>Privacy notice</h1>
    <p class="note">Last updated {{UPDATED}}</p>

    <h2 id="who-we-are">Who we are</h2>
    <p>This website is run by {{CONTROLLER_NAME}}. You can reach us at <a href="mailto:{{CONTACT_EMAIL}}">{{CONTACT_EMAIL}}</a>.</p>

    <h2 id="this-website">This website</h2>
    <p>This website doesn't use cookies, analytics or tracking scripts, and it doesn't ask you for any information. Like any website, our hosting provider processes basic request data, such as your IP address and the page you asked for, to deliver pages and keep them secure. It may do this in other countries, under its own data protection terms.</p>

    <h2 id="the-waitlist">The waitlist</h2>
    <p>If you join the waitlist, our form provider, {{FORM_PROVIDER}}, stores what you enter on our behalf: your email address, your country and the price you would pay. We use it only to email you when the English version of Zixu opens and to decide whether and how to build it. We rely on your consent to do this. We don't sell or share it, and we don't send marketing emails.</p>

    <h2 id="health-information">Please don't send health information</h2>
    <p>The waitlist doesn't need any health details. Please don't include them in the form or in emails to us.</p>

    <h2 id="how-long">How long we keep it</h2>
    <p>We keep your details until the English version opens and we've emailed you, or until you ask us to delete them. If we decide not to build it, we'll delete the list.</p>

    <h2 id="your-rights">Your rights</h2>
    <p>You can ask to see the information we hold about you, have it updated or deleted, or withdraw your consent at any time by emailing <a href="mailto:{{CONTACT_EMAIL}}">{{CONTACT_EMAIL}}</a>. You can also complain to a data protection authority: the ICO in the UK, the OAIC in Australia, or the authority in your EU country.</p>

    <h2 id="children">Children</h2>
    <p>Zixu is for adults. Please don't join the waitlist if you're under 18.</p>

    <h2 id="changes">Changes to this notice</h2>
    <p>If we change this notice, we'll update the date at the top of this page.</p>
  </main>

  <footer class="site-footer">
    <p>Zixu is a general wellness and exercise-logging app. It is not a medical device and does not diagnose, treat or prevent any condition.</p>
    <p><a href="/privacy">Privacy</a> · <a href="https://github.com/fengziliang43-cmyk/posture-training-app">Source code</a> · © 2026 Zixu</p>
  </footer>
</body>
</html>
```

## C. `site/en/styles.css`（按条写，只用这些选择器）

1. `:root`：定义 8 个颜色变量（浅色）：`--bg: #f6f5fa;` `--surface: #ffffff;` `--text: #1f1e24;` `--muted: #5d5a68;` `--accent: #6a5ce0;` `--accent-ink: #ffffff;` `--line: rgba(31, 30, 36, 0.12);` `--warn-soft: #fbeedb;`，另加 `color-scheme: light dark;`。
2. `@media (prefers-color-scheme: dark)` 里的 `:root`：同 8 个变量换成深色：`--bg: #131217;` `--surface: #1c1b22;` `--text: #ecebf0;` `--muted: #a8a5b4;` `--accent: #aaa0ff;` `--accent-ink: #131217;` `--line: rgba(236, 235, 240, 0.15);` `--warn-soft: #3a2b14;`。
3. `*, *::before, *::after`：`box-sizing: border-box;`。
4. `body`：`margin: 0; background: var(--bg); color: var(--text); font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`。
5. `.site-header, main, .site-footer`：`max-width: 760px; margin: 0 auto; padding-left: 20px; padding-right: 20px;`。
6. `.site-header`：`display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 18px; padding-bottom: 18px;`。
7. `.brand`：`display: inline-flex; align-items: center; gap: 8px; color: var(--text); font-size: 20px; font-weight: 800; text-decoration: none;`。
8. `.brand-mark`：`color: var(--text); flex: none;`。
9. `.site-nav`：`display: flex; flex-wrap: wrap; gap: 16px; font-size: 15px;`；`.site-nav a`：`color: var(--muted); text-decoration: none;`；`.site-nav a:hover`：`text-decoration: underline;`。
10. `main > section`：`padding-top: 40px; padding-bottom: 40px; border-top: 1px solid var(--line);`；`main > section.hero`：`border-top: none; padding-top: 28px;`。
11. `h1`：`margin: 0 0 16px; font-size: clamp(30px, 6vw, 46px); line-height: 1.15; font-weight: 800; letter-spacing: -0.01em; text-wrap: balance;`。
12. `h2`：`margin: 0 0 14px; font-size: 26px; line-height: 1.25; font-weight: 800;`；`h3`：`margin: 0 0 6px; font-size: 18px; line-height: 1.35; font-weight: 700;`。
13. `p`：`margin: 0 0 14px; max-width: 64ch;`；`.lead`：`font-size: 19px;`；`.note`：`font-size: 15px; color: var(--muted);`。
14. `a`：`color: var(--accent); text-underline-offset: 3px;`。
15. `.button`：`display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 24px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-weight: 700; text-decoration: none;`；`.button:hover`：`filter: brightness(1.06);`；`.button:focus-visible`：`outline: 3px solid var(--accent); outline-offset: 3px;`。
16. `.steps`：`list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; counter-reset: step;`；`.steps li`：`background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 18px;`；`.steps li::before`：`counter-increment: step; content: counter(step); display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; margin-bottom: 10px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-weight: 800; font-size: 15px;`；`.steps p`：`margin: 0;`。
17. `@media (min-width: 760px)` 里的 `.steps`：`grid-template-columns: repeat(3, minmax(0, 1fr));`。
18. `.red-flags`：`list-style: none; margin: 0 0 14px; padding: 16px 18px; display: grid; gap: 8px; background: var(--warn-soft); border-radius: 16px;`；`.red-flags li`：`position: relative; padding-left: 20px;`；`.red-flags li::before`：`content: ""; position: absolute; left: 2px; top: 0.7em; width: 8px; height: 8px; border-radius: 50%; background: #c8402f;`。
19. `.plain-list`：`margin: 0; padding-left: 1.2em; display: grid; gap: 8px;`。
20. `main > section.waitlist`：`margin-top: 16px; margin-bottom: 40px; padding: 28px; background: var(--surface); border: 1px solid var(--line); border-radius: 22px;`。
21. `.prose`：`padding-top: 28px; padding-bottom: 48px;`；`.prose h2`：`margin-top: 32px;`。
22. `.site-footer`：`padding-top: 24px; padding-bottom: 40px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px;`；`.site-footer a`：`color: var(--muted);`。
23. `@media (max-width: 480px)`：`body { font-size: 16px; }`、`.site-header { padding-top: 14px; padding-bottom: 14px; }`、`main > section.waitlist { padding: 20px; }`。
