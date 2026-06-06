# EuroPress — European News Reader

A single-file (`index.html`), dependency-free news reader that fetches live RSS
feeds from major European journals in the browser via CORS proxies.

## Features

- **Three ways to browse**
  - **Latest** — every journal merged into one feed, newest first (each card shows its journal).
  - **By Category** — pick a topic (World, Europe, Politics, Business, Tech, Science, Culture, Sports) and see it aggregated across all journals.
  - **By Journal** — read a single title with its own category tabs.
- **9 journals**, English-native and others:
  - English: The Guardian, BBC News, Deutsche Welle, France 24, Euronews.
  - Auto-translated to English: Le Monde (FR), El País (ES), Der Spiegel (DE), la Repubblica (IT).
- **Auto-translation** — non-English titles, summaries and full text are translated
  to English on the fly. Cards show a `XX→EN` badge; the reader shows
  *"Translated from …"* plus the original headline.
- **Smart card actions**
  - If the feed carries the full article text, the card opens an **in-app reader**.
  - Otherwise it asks **"Open external link?"** — confirm to open the original in a new tab, cancel to stay.
- **Search**, live **Refresh**, and the original dark UI — unchanged look and feel.
- **Social icons** in the header (X, GitHub, LinkedIn).

## Usage

Open `index.html` in any modern browser. No build step, no server required.

## Configuration

- **Social links:** edit the `href="…"` placeholders in the header (`#social-x`,
  `#social-github`, `#social-linkedin`).
- **Add a journal:** add an entry to the `JOURNALS` array. Set `lang` (`'en'`
  for native English, otherwise the source language code) and a `feeds` map of
  `Category → RSS URL`.

> Feeds are fetched through public CORS proxies (allorigins / corsproxy) with a
> fallback chain; translation uses Google's free `gtx` endpoint. Both are
> best-effort and may rate-limit under heavy use.
