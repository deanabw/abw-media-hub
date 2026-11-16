# CLAUDE.md — ABW Media Hub

## Project Identity
- **Name:** ABW Media Hub
- **Domain:** media.joinabw.ca
- **Repo:** github.com/deanabw/abw-media-hub
- **What it does:** Central gateway landing page aggregating all ABW media properties. Pulls the latest content from both the Tuesday Memo and Podcast Supabase databases and surfaces them in a single hub, with deep links out to `memo.joinabw.ca` and `podcast.joinabw.ca`.

## Tech Stack
- **Framework:** None — single static HTML page (`index.html.html`) with inline CSS and vanilla JavaScript. No build step, no package manager, no framework.
- **Data:** Two Supabase Postgres instances queried directly via the Supabase REST API (`/rest/v1/...`) using the anon key from the browser.
- **Hosting:** Vercel (static site), connected via GitHub.
- **No dependencies:** no `package.json`, no `node_modules`, no bundler.

## Deploy
- Connected to Vercel via GitHub repo `deanabw/abw-media-hub`.
- Auto-deploys on push to `main`.
- Because it is a static `index.html.html`, Vercel serves it directly — no build command required. (If routing breaks, confirm the file is being served as the root document; the `.html.html` double extension is intentional and should not be renamed without updating Vercel settings.)

## Directory Structure
```
abw-media-hub/
├── CLAUDE.md              # This file — Builder Agent context
└── index.html.html        # The entire site: markup, styles, and JS in one file
```
That is the full tree. There is no `src/`, no `app/`, no config files. All logic lives at the bottom of `index.html.html` inside a single `<script>` block.

## Database
This project is a **read-only consumer** of the ABW engine's two public lists (the memo and the podcast moved into the engine, Nov 2026). No key, no credential: both are signed-out GETs answering published rows only.

### Memo list
- **URL:** `https://memo.joinabw.ca/api/memos` → `{ memos: [{ id, slug, week_of, intro, created_at }] }`
- **Ordering:** by `week_of` desc (then `created_at`), sorted in the page
- **Used by:** `loadMemos()` (3 most recent) and `loadLatestFeed()` (1 most recent)
- **Deep links to:** `https://memo.joinabw.ca/memo/{slug}`

### Podcast list
- **URL:** `https://podcast.joinabw.ca/api/episodes` → `{ episodes: [{ id, episode_number, title, slug, series, description, thumbnail_url, published_at, status, ... }] }`
- **Ordering:** by `episode_number` desc (then `published_at`), sorted in the page
- **Used by:** `loadEpisodes()` (3 most recent)
- **Deep links to:** `https://podcast.joinabw.ca/episode/{slug}` (singular `/episode/`)

Both go through `listQuery(url, key)`, `latestMemos(limit)` and `latestEpisodes(limit)` in `index.html.html`. The engine allows `https://media.joinabw.ca` in both lists' CORS.

## Critical Rules
- **READ-ONLY AGGREGATOR.** This project must never `INSERT`, `UPDATE`, `DELETE`, or otherwise mutate either Supabase database. Only `GET /rest/v1/...` queries are allowed. Authoring of memos and episodes happens in their respective source projects.
- **Do not use service-role keys here.** Only the Supabase `anon` key belongs in this codebase, because the HTML ships to browsers. Row Level Security on the source databases is the real access control.
- **Fallback, don't fail.** Every Supabase query has a fallback ordering (e.g. `week_of` → `created_at`) and a static HTML fallback is rendered first, then replaced when data loads. Preserve this pattern — the page must never look broken if Supabase is slow or down.
- **Keep it a single file, no build step.** Do not introduce a bundler, framework, or `package.json` without an explicit decision. Simplicity (and zero-config Vercel deploys) is the point.
- **External links open in new tabs** (`target="_blank"`) — keep this when adding new links.
- **Do not rename `index.html.html`** without updating the Vercel project config; the double extension is load-bearing for the current deploy.

## Key Integrations
- **Memo Supabase** (`dvcgzxtqegymnsjqfeue.supabase.co`) — source of Tuesday Memo content.
- **Podcast Supabase** (`avdwudfuuhjvnagfnpix.supabase.co`) — source of podcast episode content.
- **memo.joinabw.ca** — outbound deep-link target for individual memos.
- **podcast.joinabw.ca** — outbound deep-link target for individual episodes.
- **Vercel** — static hosting + GitHub auto-deploy.
- **GitHub (`deanabw/abw-media-hub`)** — source of truth; pushing to `main` triggers deploys.

## Pre-Commit Checks
Because there is no toolchain, checks are manual but non-negotiable:
1. Open `index.html.html` in a browser locally (or via `python3 -m http.server`) and confirm:
   - Memo cards render (latest 3).
   - Episode cards render (latest 3).
   - The "Latest" combined feed item renders.
   - No console errors from Supabase (check for `Supabase error <status>`).
2. Confirm no credentials other than the two Supabase **anon** keys have been added.
3. Confirm no write calls (`POST`/`PATCH`/`DELETE` against `/rest/v1/...`) were introduced.
4. Confirm external links still point to `memo.joinabw.ca` and `podcast.joinabw.ca`.
5. View the page on a narrow viewport — it is expected to stay responsive.

## Recent Context
- Git history is a single-file iteration loop: `Add files via upload` followed by a series of `Update index.html.html` commits. No branches, no tags, no PRs in history.
- No `TODO` / `FIXME` markers were found in the code.
- No tests exist; verification is visual.

## Builder Agent Keywords
Trigger on: **media hub**, **abw-media-hub**, **media gateway**, **aggregator**, **media.joinabw.ca**.
