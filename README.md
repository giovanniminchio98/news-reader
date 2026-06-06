# EuroPress — European News Reader

A single-file (`index.html`), dependency-free news reader that fetches live RSS
feeds from major European journals in the browser via CORS proxies.

## Features

- **Interface in 3 languages** — 🇮🇹 Italiano (default), 🇬🇧 English, 🇫🇮 Suomi.
  Pick one from the header selector; the whole UI **and** the news content are
  shown in that language. The choice is remembered (localStorage).
- **Three ways to browse**
  - **Latest** — every journal merged into one feed, newest first (each card shows its journal).
  - **By Category** — pick a topic (World, Europe, Politics, Business, Tech, Science, Culture, Sports) and see it aggregated across all journals.
  - **By Journal** — read a single title with its own category tabs. Opening a
    journal **prefetches its other categories in the background**, so switching
    tabs is instant.
- **10 journals**:
  - Native English: The Guardian, BBC News, Deutsche Welle, France 24, Euronews.
  - Native Italian: la Repubblica, Corriere della Sera.
  - Other languages: Le Monde (FR), El País (ES), Der Spiegel (DE).
- **Auto-translation** — any journal not in the selected interface language has
  its titles, summaries and full text translated on the fly. Cards show a
  `XX→YY` badge; the reader shows *"Translated from …"* plus the original headline.
  Translations are cached per language.
- **Smart card actions**
  - If the feed carries the full article text, the card opens an **in-app reader**.
  - Otherwise it asks **"Open external link?"** — confirm to open the original in a new tab, cancel to stay.
- **Search**, live **Refresh**, and the original dark UI — unchanged look and feel.
- **Social icons** in the header (X, GitHub, LinkedIn).

## Usage

Open `index.html` in any modern browser. No build step, no server required.

### Install to your phone's home screen

The app ships a web manifest (`manifest.webmanifest`) and icons
(`icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`), so it
installs as a standalone PWA:

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** menu → *Install app* / *Add to Home screen*.

The icons must sit next to `index.html` when served (e.g. GitHub Pages).

## Configuration

- **Social links:** edit the `href="…"` placeholders in the header (`#social-x`,
  `#social-github`, `#social-linkedin`).
- **Add a journal:** add an entry to the `JOURNALS` array. Set `lang` (the
  source language code of the feed) and a `feeds` map of `Category → RSS URL`.
- **Add an interface language:** add an entry to the `I18N` object (UI strings,
  category labels, language names) and an `<option>` to the header `#langSelect`.

> Feeds are fetched through public CORS proxies (allorigins / corsproxy) with a
> fallback chain; translation uses Google's free `gtx` endpoint. Both are
> best-effort and may rate-limit under heavy use.
