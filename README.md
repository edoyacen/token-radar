# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/edoyacen/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/edoyacen/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An entry for [make.fun](https://make.fun)'s `token-radar-01`
([bounty page](https://make.fun/bounty/token-radar-01)): a dashboard that ranks the
protocols which still record no token by what their launch would be worth, and says how
to farm each one.

## What it does

`main.ts` reads the sealed snapshot at `/input/snapshot.json` — every protocol DefiLlama
tracks at or above $5M of TVL — and writes:

- `board.json`: the ranked board, 200 rows, covering every slug on the watchlist
- `data.js`: the same board as the page's data (`window.RADAR`)
- `dashboard/`: the static page, copied to `/output`
- `screenshots/`: the board, a detail view and a filtered view, copied to `/output`
- `dossier.json`: the summary the judge reads, from `vendor/makefun-board.ts`

## The model (radar-2)

    implied = TVL × multiple(category) × momentum × maturity × breadth

- **multiple(category)** — 0.12× for a farm up to 0.55× for a perp DEX. A dollar of TVL
  is rent the protocol charges on other people's capital, and a market pays more for a
  DEX's or a perp DEX's fee stream than for a restaking layer's or a bridge's thin spread.
- **momentum** — the snapshot's seven-day TVL change, clamped to −60%…+120% and damped by
  0.5, so one good week cannot double a rank and one red week cannot zero it.
- **maturity** — 0.6…1.0×, rising with how long DefiLlama has tracked the protocol.
- **breadth** — 1.00…1.18×, a small premium for chains the protocol runs on: a protocol
  deployed on many chains is harder to displace than one on a single chain.

The watchlist is the floor, never the ceiling: the board adds the 160 largest pre-token
protocols below the snapshot's $50M TVL floor, which is where the radar earns its name.

## The dashboard

Static files, no framework, no network. The board sorts by rank, TVL, momentum, implied
value, ×TVL or age; the filters narrow by search, chain, category chip and a TVL floor;
clicking a row opens its detail view with every multiplier, the arithmetic behind its
implied value, its chains and its farm plan with cost and time per step.

## Run it

    MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

Node 22.18 or later; standard library only.

## Files

- `main.ts` — the program
- `lib/model.ts` — the model, the board and the farm plans
- `dashboard/` — `index.html`, `app.css`, `app.js`
- `screenshots/` — the three views
- `vendor/makefun-board.ts` — the make.fun library, unchanged

Licensed MIT.
