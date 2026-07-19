# EuroPress — European News Reader

A dark, mobile-friendly reader for major European journals. A scheduled job
fetches and **pre-translates** all the news every 30 minutes into a static
snapshot; the browser app just reads that snapshot — so it loads instantly,
puts no per-user load on any live service, and works the same for everyone.

## How it works (architecture)

```
GitHub Action (every 30 min)                 GitHub Pages                Browser
──────────────────────────────               ────────────               ─────────
scripts/build-snapshot.mjs                    data/snapshot.it.json      index.html
  • fetch every RSS feed          ──build──▶  data/snapshot.en.json  ──▶  reads the
  • parse + sort newest-first                 data/snapshot.fi.json       snapshot,
  • translate → it / en / fi                                              shows a
  • write per-language JSON                                               countdown
```

- **The app never fetches feeds or calls a translator at runtime.** It only
  loads the pre-built `data/snapshot.<lang>.json`. That's what makes it fast and
  what keeps it from hammering the free proxy/translate services as users grow.
- A **countdown** in the header shows time to the next scheduled update. When the
  time passes, the app quietly re-checks the static JSON and picks up the new
  snapshot — users don't (and can't) trigger fetches manually.
- Translations are cached across runs (`data/.tcache.json`, kept warm by the
  Action cache), so each cycle only translates genuinely new articles.

## Features

- **3 interface languages** — 🇮🇹 Italiano (default), 🇬🇧 English, 🇫🇮 Suomi.
  Both the UI **and** the news content are shown in the chosen language
  (remembered via localStorage).
- **Three ways to browse** — **Latest** (all journals merged, newest first),
  **By Category** (one topic aggregated across journals), **By Journal**.
- **10 journals** — Guardian, BBC, Deutsche Welle, France 24, Euronews (English);
  la Repubblica, Corriere della Sera (Italian); Le Monde (FR), El País (ES),
  Der Spiegel (DE). Non-native papers are auto-translated, with a `XX→YY` badge
  and the original headline shown in the reader.
- **In-app reader** — shows the full article text when the feed provides it
  (already translated in the snapshot); otherwise the translated summary plus an
  *Open original* link.
- **Installable PWA** — icons + manifest for "Add to Home Screen" on iOS/Android.
- Social icons (X, GitHub, LinkedIn) in the header.

## One-time setup (GitHub Pages + the updater)

1. **Enable Pages via Actions:** repo **Settings → Pages → Build and deployment →
   Source: GitHub Actions**.
2. Merge this branch to `main`. The workflow `.github/workflows/update-news.yml`
   then runs on a `*/30 * * * *` schedule (and on every push to `main`), builds
   the snapshot, and deploys the site to Pages.
3. First data appears after the first workflow run — trigger it immediately with
   **Actions → “Update news snapshot & deploy” → Run workflow**.

> Note: scheduled GitHub Actions only run from the **default branch**, so the
> 30-minute updates start once this is on `main`. GitHub may delay scheduled runs
> under load, so the real cadence is "about every 30 min".

## Local development

```bash
npm install
npm run build:snapshot     # writes data/snapshot.<lang>.json (needs network)
python3 -m http.server     # then open http://localhost:8000
```

Open the app over `http://` (not `file://`) so it can `fetch()` the snapshots.

## Configuration

- **Feeds / journals:** edit `scripts/journals.mjs` (feed URLs, source `lang`).
  Keep the journal `id`/`lang` in sync with the `JOURNALS` metadata in
  `index.html` (names, colours, flags).
- **Interface language:** add an entry to `I18N` in `index.html`, a matching
  `<option>` in `#langSelect`, and the language code to `UI_LANGS` in
  `scripts/journals.mjs`.
- **Social links:** edit the `href="…"` placeholders in the header.
- **Update interval:** the `*/30` cron in the workflow and `intervalMin` written
  by the builder (drives the countdown).

> The builder fetches feeds directly (with a browser-like User-Agent) and falls
> back to public CORS proxies; translation uses Google's free `gtx` endpoint.
> Both are best-effort — a feed that fails one cycle simply reappears the next.
