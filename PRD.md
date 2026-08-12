# MTG Booster Box Price Tracker — PRD & Technical Guide

**Version:** 1.0 — August 2026
**Author:** Hermes (for Pier)
**Repo:** `~/mtg-dashboard-deploy` → GitHub Pages at `https://pierbex.github.io/mtg-dashboard/`

---

## 1. Product Overview

### What It Is
A mobile-first web dashboard tracking Magic: The Gathering sealed booster box prices from CardMarket.com. Twice-weekly automated crawls fetch English-language listing prices for all mainline MTG sets, stored in SQLite, exported to JSON, deployed as a static site on GitHub Pages.

### What It Tracks
- **Product types:** Play Booster Box, Set Booster Box, Draft Booster Box, Collector Booster Box, Jumpstart Booster Box, Theme Booster Box
- **Scope:** All mainline MTG sets with booster boxes (expansion, core, masters, draft_innovation)
- **Exclusions:** No promo sets, un-sets, starter/portal sets, foreign compilations, non-English products, commander precon decks
- **English only:** CardMarket `?language=1` param filters listings to English; parser does secondary language check on each listing

### Dashboard Tabs
1. **Overview** — Sets grouped newest-to-oldest, expandable cards showing each product with price, stock count, and CardMarket link
2. **Price History** — SVG charts for products with 2+ snapshots (from_price + avg_25_lowest over time)
3. **Stats** — Total sets, products, with-prices, out-of-stock, snapshot count, last crawl info, product type breakdown
4. **Cron Runs** — Last 10 automated crawl diagnostics with color-coded status (ok/partial/error), per-run stats, concise notes

### Key Features
- Mobile-first design (390px iPhone viewport priority)
- Keyrune icon font for official MTG set symbols (426 codes, ~95% coverage)
- Glass-morphism UI with MTG mana-color theming
- Stale data banner (shows if data >4 days old)
- Client-side auth (sessionStorage, SHA256 password hash)
- Cache-busting fetch (no-store + timestamp query param)
- No backend — fully static, served from GitHub Pages

---

## 2. Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Scryfall   │────▶│  fetch_sets  │────▶│  SQLite DB  │     │  CardMarket  │
│  API (free) │     │  .py         │     │ mtg_prices  │     │  (via Decodo)│
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                                                ▲                     │
                                                │                     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ GitHub Pages│◀────│ deploy_dash  │◀────│ export_dash │     │  crawler.py  │
│ (static)    │     │ board.sh     │     │ board.py    │     │ (prices)    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                                                ▲                     │
                                                │                     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  cron_runs  │◀────│ cron_run.py  │────▶│ discover_   │     │ fix_matches  │
│  table      │     │ (orchestrator)│     │ products.py │     │ .py          │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

### Data Flow

```
1. fetch_sets.py      → Scryfall API → mtg_sets table (monthly)
2. discover_products.py → CardMarket category pages → mtg_products table (monthly, set_id=NULL)
3. fix_matches.py     → Manual override table → assigns set_id to products (every run)
4. cleanup_orphans    → Deletes products set_id=NULL >30 days (every run)
5. crawler.py         → CardMarket product pages → price_snapshots table (every run)
6. export_dashboard.py → SQLite → JSON files (overview, history, stats, cron_runs)
7. deploy_dashboard   → git add/commit/push to GitHub Pages
8. cron_runs table    → Diagnostics for dashboard Cron Runs tab
```

### Pipeline Order (cron_run.py)
```
Step 0:  Backup DB (WAL checkpoint + timestamped copy, keeps last 3)
Step 1:  Refresh sets from Scryfall (if >30 days since last refresh)
         → Prune 34 exclusion codes (FK-safe: snapshots → products → sets)
Step 2:  Discover products on CardMarket (if >30 days since last discovery)
         → All products inserted with set_id=NULL
Step 2b: Fix product-to-set matches (always runs)
         → fix_all_matches: SLUG_TO_SET_CODE override table
         → apply_extended_fixes: theme/jumpstart reclassification + who/pip manual sets
Step 2c: Clean up orphan products (set_id=NULL, first_seen >30 days ago)
Step 3:  Crawl all product prices from CardMarket
         → Skips products with set_id=NULL
         → ?language=1 for English listing prioritization
         → Parse: extract English-only prices, calculate from_price + avg_25_lowest
         → Price sanity check (warns <€0.50 or >€50,000, doesn't skip)
         → Parse validation (0 articleRows = parse failure)
         → Mass 0-listing detection (>50% out-of-stock = warning)
         → 404s do NOT mark products dead (could be transient)
         → Retry on 429 (10s backoff) and network errors (5s backoff, 2x)
Step 3.5: Insert cron_runs record (BEFORE export, so current run appears in JSON)
Step 4:  Export dashboard JSON → git push to GitHub Pages
Step 4.5: Update cron_runs record with deploy status
```

---

## 3. File Inventory

### Pipeline Scripts (`~/.hermes/profiles/collector/data/mtg_tracker/`)

| File | Purpose | Runs When |
|------|---------|-----------|
| `cron_run.py` | Main orchestrator — runs all steps, stores diagnostics, deploys | Cron: Mon+Thu 05:00 |
| `fetch_sets.py` | Fetch MTG set metadata from Scryfall API | Monthly (auto-check) |
| `discover_products.py` | Scrape CardMarket category pages to find product URLs | Monthly (auto-check) |
| `fix_matches.py` | Match products to sets via manual override table | Every cron run |
| `crawler.py` | Fetch prices from CardMarket product pages via Decodo proxy | Every cron run |
| `export_dashboard.py` | Export SQLite data to JSON for static dashboard | Every cron run |
| `deploy_dashboard.sh` | Manual deploy script (git add/commit/push) | Manual only |
| `query.py` | CLI tool for querying the DB | Manual only |
| `mtg_prices.db` | SQLite database | — |
| `backups/` | Timestamped DB backups (last 3 kept) | Auto-created |

### Dashboard Files (`~/mtg-dashboard-deploy/` → GitHub Pages)

| File | Purpose |
|------|---------|
| `index.html` | Single-file dashboard (HTML/CSS/JS) — 4 tabs, auth, rendering |
| `auth.js` | Client-side auth (sessionStorage, SHA256 password hash) |
| `data/overview.json` | All sets × products × latest prices (855KB) |
| `data/history.json` | Full price history timeseries for charts |
| `data/stats.json` | Summary stats (sets, products, with-prices, out-of-stock) |
| `data/cron_runs.json` | Last 10 cron run diagnostics |
| `assets/keyrune/` | Keyrune icon font (woff2, woff, ttf, CSS) |

### Database Schema

```sql
mtg_sets
  id, scryfall_id (UNIQUE), code, name, released_at, set_type,
  block, card_count, digital, icon_svg_uri, scryfall_uri, short_info,
  created_at, updated_at

mtg_products
  id, set_id (FK→mtg_sets, NULL=unmatched), product_type, product_name,
  url_path (UNIQUE), cardmarket_url, first_seen, last_scanned,
  product_exists (0=dead, 1=live)

price_snapshots
  id, product_id (FK→mtg_products), scan_date,
  available_items, from_price, avg_25_lowest
  UNIQUE INDEX (product_id, scan_date) — one snapshot per product per day

crawl_log
  id, job_name, started_at, finished_at, status, products_scanned, details

cron_runs
  id, started_at, finished_at, status, products_scanned,
  products_with_prices, products_out_of_stock, products_failed,
  diagnostics (JSON), errors (JSON)
```

---

## 4. Key Design Decisions

### 4.1 Discovery ≠ Matching ≠ Crawling (Separation of Concerns)
Discovery finds product URLs on CardMarket category pages and inserts them with `set_id=NULL`. Matching is handled solely by `fix_matches.py` via a manual override table. Crawling fetches prices only for matched products. This prevents the old fuzzy matcher from assigning products to wrong sets (Mirrodin→Mirrodin Besieged, Lorwyn→Lorwyn Eclipsed, etc.).

### 4.2 English-Only: Two-Layer Filter
CardMarket's `?language=1` URL param prioritizes English listings on the page (51 EN vs 17 EN without it on a typical product). The parser then does a strict check on each listing's `data-original-title="English"` attribute to exclude any non-English listings that still appear.

### 4.3 Aggregated Stats Only
No individual listings are stored. Each crawl produces one `price_snapshot` per product containing: `from_price` (cheapest EN listing), `avg_25_lowest` (average of 25 cheapest EN listings), `available_items` (EN listing count). This keeps the DB lightweight — 255 products × 2 crawls/week = ~26K snapshots/year.

### 4.4 Latest-Snapshot Pattern for Stats
Stats page counts products with/out prices using `ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY scan_date DESC)` to count only the latest snapshot per product. A naive `COUNT(*)` would double-count after multiple crawls, causing `products_with_prices` to exceed `total_products` and `products_out_of_stock` to go negative.

### 4.5 Cron Runs Record: Insert Before Export, Update After Deploy
The cron_runs record is inserted into the DB BEFORE `export_dashboard.py` runs, so the current run's diagnostics appear in `cron_runs.json` immediately. After deploy, the record is updated with final deploy status. This ensures the dashboard always shows the latest run's diagnostics — not the previous run's.

### 4.6 Transient 404s Don't Kill Products
When CardMarket returns a 404 for a product page, the crawler skips it but does NOT mark `product_exists=0`. A 404 could be a transient server issue or maintenance. If the product is truly gone, the next monthly discovery won't find it on the category pages, and it stays uncrawled naturally. This prevents price history gaps from transient errors.

### 4.7 DB Backup with WAL Checkpoint
Before every cron run, the DB is backed up with `PRAGMA wal_checkpoint(TRUNCATE)` to flush WAL data into the main `.db` file, then `shutil.copy2` creates a timestamped copy. Only the last 3 backups are kept. This protects against corruption from bad writes or partial transactions.

### 4.8 Orphan Product Cleanup
Products discovered but never matched (`set_id=NULL`) that are older than 30 days are automatically deleted. If `fix_matches.py` can't match a product in 30 days, it's probably junk (non-standard product, URL change, etc.). Prevents unmanaged accumulation.

### 4.9 Commander Sets: Manual Insert Only
`commander` set_type is NOT in `BOOSTER_SET_TYPES` because 43 of 45 Scryfall commander sets are precon decks, not booster boxes. Only `who` (Doctor Who) and `pip` (Fallout) have actual booster boxes on CardMarket — they're manually inserted in `apply_extended_fixes()`.

### 4.10 Background Execution for Long-Running Cron
The crawl takes ~70 minutes for 255 products. The cron prompt instructs the agent to run `cron_run.py` in background mode with `notify_on_complete=true`. A foreground terminal call would time out at 10 minutes and kill the process mid-crawl.

---

## 5. Configuration

### 5.1 Cron Job
- **Schedule:** `0 5 * * 1,4` (Monday + Thursday at 05:00)
- **Delivery:** `local` (silent — no Discord notification)
- **Toolsets:** `terminal` only
- **Workdir:** `~/.hermes/profiles/collector/data/mtg_tracker`
- **Job ID:** `7d4b1386d394`

### 5.2 Prune Codes (34 total)
Sets excluded from tracking — deleted after every Scryfall refresh:
- Starter/Portal: w17, w16, s00, s99, p02, por, ptk, itp
- Clash Packs: cp3, cp2, cp1
- Un-sets: unf, ust, unh, ugl
- Timeshifted: tsb, h2r, h1r
- Supplementary: plst, slx, dbl
- Foreign: rin, ren, bchr, 4bb, fbb
- Misprint/Novelty: sum, 30a, chr
- Mystery Booster: mbc, mb2
- Bonus sheet/Standalone: big, clu
- Foundations Jumpstart: j25 (cards ship in FDN boxes, no separate CM product)

### 5.3 Booster Set Types (fetched from Scryfall)
`{"expansion", "core", "masters", "draft_innovation"}`
- NO `commander` (43 precon deck sets would pollute DB)
- NO `starter` (caused endless fetch/prune cycle with Portal sets)

### 5.4 Decodo Proxy
- Endpoint: `https://scraper-api.decodo.com/v2/scrape`
- Pool: premium (IP rotation per request)
- Geo: Germany
- Token: shared from `~/.hermes/profiles/collector/data/cardmarket_crawler/proxy_config.json`
- Rate limit: 1s between requests (Decodo rotates IPs)
- Retries: 2x with 5s backoff (network errors), 10s backoff (429)

### 5.5 Dashboard Auth
- Username: `aquarius`
- Password: stored as SHA256 hash in `auth.js`
- Mechanism: client-side sessionStorage check (no server-side validation — GitHub Pages is static)

---

## 6. Manual Operations

### Run a crawl manually (background, ~70 min)
```bash
cd ~/.hermes/profiles/collector/data/mtg_tracker
python3 cron_run.py
```

### Run a crawl manually (foreground, for debugging)
```bash
cd ~/.hermes/profiles/collector/data/mtg_tracker
python3 crawler.py crawl-all --force --verbose
```

### Export and deploy without crawling
```bash
cd ~/.hermes/profiles/collector/data/mtg_tracker
python3 export_dashboard.py
cd ~/mtg-dashboard-deploy
git add data/ && git commit -m "Manual data update" && git push origin main
```

### Check DB stats
```bash
cd ~/.hermes/profiles/collector/data/mtg_tracker
python3 crawler.py stats
```

### Audit product-to-set matches
```bash
cd ~/.hermes/profiles/collector/data/mtg_tracker
python3 fix_matches.py audit
```

### Restore DB from backup
```bash
cd ~/.hermes/profiles/collector/data/mtg_tracker
cp backups/mtg_prices_YYYYMMDD_HHMMSS.db mtg_prices.db
```

---

## 7. Bug History (7 Critique Rounds)

### Bugs Fixed
1. **TDZ crash** — `let dashboardInitialized` in IIFE scope caused temporal dead zone crash. Fixed: `let` → `var`.
2. **Sort order** — Sets sorted by `year` (4-char) not `released_at` (full ISO date). Fixed.
3. **3-column grid** — Product rows had 4 children in 3-col grid. Fixed: 4-col grid.
4. **Mobile sizing** — Desktop font sizes on 390px viewport. Fixed: mobile-first sizes + desktop media queries.
5. **Stats double-counting** — `COUNT(*)` on all snapshots inflated `with_prices` after multiple crawls, causing negative `out_of_stock`. Fixed: latest-snapshot-per-product pattern.
6. **Cron runs not showing** — Record stored in `finally` block AFTER export. Fixed: insert before export, update after deploy.
7. **Products_scanned wrong** — `crawl_log` stored `total_with_prices` not total crawled. Fixed: sum all categories.
8. **Transient 404 kills products** — Single 404 marked `product_exists=0`, excluding product from crawls for up to 30 days. Fixed: skip, don't kill.
9. **Deploy status invisible** — Cron runs tab didn't show deploy failures. Fixed: deploy failure added to notes.
10. **WAL backup incomplete** — `shutil.copy2` missed WAL-committed data. Fixed: `PRAGMA wal_checkpoint(TRUNCATE)` before copy.
11. **CWD leak** — `deploy_dashboard()` changed working directory and didn't restore. Fixed: try/finally save/restore.
12. **Commander pollution** — Adding `commander` to set types fetched 43 precon deck sets. Fixed: reverted, who/pip manual only.
13. **429 not retried** — CardMarket rate limits via Decodo weren't retried. Fixed: 10s backoff retry.
14. **Unmatched products crawled** — Products with `set_id=NULL` were crawled but invisible in dashboard. Fixed: `WHERE set_id IS NOT NULL`.
15. **Stale deploy path** — `deploy_dashboard.sh` copied from wrong directory. Fixed: export writes directly to git repo.
16. **listings_added crash** — `cron_run.py` referenced nonexistent DB column. Fixed: removed.
17. **Dead auth code** — `export_dashboard.py` had unused auth imports. Fixed: removed.
18. **Fuzzy matching** — Old discovery pipeline used fuzzy matching causing dozens of wrong assignments. Fixed: manual override table, no fuzzy matching.
19. **Dead products not revived** — Products marked dead were never checked again. Fixed: discovery revives `product_exists 0→1`.
20. **Stale SLUG_TO_SET_CODE entries** — 14 entries pointed to pruned sets, 8 None-valued entries duplicated DELETE_SLUGS. Fixed: removed dead code.

### Lessons Learned
- **Test with empirical data, not assumptions** — The `?language=1` "doesn't filter listings" claim was wrong. Empirical test proved it filters/sorts by language. Always verify with actual API responses.
- **Don't force findings** — Some "bugs" are cosmetic dead code with zero impact. Distinguish between real bugs and hygiene issues.
- **Sequence matters** — Store diagnostics BEFORE export, not after. The export captures a snapshot of the DB at that moment.
- **WAL mode needs checkpointing** — SQLite WAL mode keeps committed writes in a separate file. Backups without checkpointing may miss recent data.
- **Background mode for long processes** — 70-minute crawls can't run in foreground (10-min timeout). Use background + notify_on_complete.