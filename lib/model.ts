// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and may add
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures:
//
//   base       = tvl_usd x BASE_MULTIPLE
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   implied    = max(1, round(base x growthMult x maturity))
//
// The constants are the house model's, stated in the dashboard and changeable in the model sandbox. No
// protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_weight: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  // Breadth was worth 0.03 a chain until the ablation below took it apart: on the 120 protocols that
  // already record a token, switching the term off made the median miss better (x4.77 -> x4.27). A
  // term that does not pay for itself is dropped, and the ablation stays in the dashboard as the
  // evidence for the drop.
  breadth_weight: 0,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/**
 * What a category's TVL is worth as a launch, per dollar of it.
 *
 * A dollar of TVL is not worth a dollar of token: it is rent the protocol charges on other people's
 * capital, and how much a market pays for that rent differs by what the protocol does. A perp DEX
 * turns volume over many times a day and a DEX takes a fee on every swap, while a restaking layer or a
 * bridge earns a thin spread and is often a commodity. The multiples are the model's single largest
 * claim, so they are one table, in one place, and the dashboard shows every protocol's own multiple.
 */
export const CATEGORY_MULTIPLE: Record<string, number> = {
  'Perp DEX': 0.55,
  'Derivatives': 0.45,
  'DEX': 0.45,
  'RWA': 0.4,
  'Lending': 0.35,
  'Options': 0.35,
  'CDP': 0.3,
  'Yield': 0.3,
  'Yield Aggregator': 0.3,
  'Algo-Stables': 0.28,
  'Risk Curators': 0.22,
  'Farm': 0.12,
  'Liquid Staking': 0.18,
  'Liquid Restaking': 0.18,
  'Restaking': 0.18,
  'Bridge': 0.15,
  'Canonical Bridge': 0.15,
  'CEX': 0.2,
};

/** The position the board's own numbers are stated at: one farm position, in dollars. */
export const DEFAULT_CAPITAL_USD = 500;

/** The multiple a category the table does not name gets: the middle of the table. */
export const DEFAULT_MULTIPLE = 0.25;

/** The multiple of one protocol's TVL: its category's, else the default. */
export function categoryMultiple(category: string | null): number {
  if (category === null) return DEFAULT_MULTIPLE;
  return CATEGORY_MULTIPLE[category] ?? DEFAULT_MULTIPLE;
}

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 200;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
  verdict: RowVerdict;
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
  verdict: RowVerdict;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  /** What the same formula would have said about it, for the fit chart. */
  predicted_usd: number;
  /** How far the prediction is from the market, the worse way round: 1 is exact, 2 is out by 2x. */
  miss: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  bands: OddsBand[];
  calibration: Calibration;
  ledger: Ledger;
  default_capital_usd: number;
  seal: string;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The multipliers and the implied value one protocol gets under `model`.
 *
 *   multiple   = the category's TVL multiple (CATEGORY_MULTIPLE), else DEFAULT_MULTIPLE
 *   base       = tvl_usd x multiple
 *   growth     = clamp(change_7d, floor, cap) per cent, damped by GROWTH_WEIGHT
 *   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
 *   breadth    = 1 + 0.03 x min(chains, 6): a protocol live on many chains is harder to displace
 *   implied    = max(1, round(base x growthMult x maturity x breadth))
 *
 * A seven-day move is noisy, so it is damped: the model refuses to let one good week double a board
 * position, and it refuses to zero a protocol because one week was red.
 */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants, off?: 'multiple' | 'growth' | 'maturity' | 'breadth'): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null; multiple: number; breadthMult: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = off === 'growth' ? 1 : 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = off === 'maturity' ? 1 : model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const multiple = off === 'multiple' ? model.base_multiple : categoryMultiple(protocol.category);
  const breadthMult = off === 'breadth' ? 1 : 1 + model.breadth_weight * Math.min(protocol.chains.length, 6);
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, growthPct, growthMult, maturityMult, age, multiple, breadthMult };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** A wrapped, staked or bridged product of a protocol whose own token trades: it has no launch ahead of it. */
const WRAPPED = /\b(wrapped|staked|staking)\b/i;

/** The categories the house's own watchlist rules out for the same reason. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token because it is one of its own kind. */
export function isWrapped(p: SnapshotProtocol): boolean {
  return WRAPPED.test(p.name) || (p.category !== null && WRAPPED_CATEGORIES.has(p.category));
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, not a wrapped product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && !isWrapped(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, growthMult, maturityMult, age, multiple, breadthMult } = impliedValue(p, snapshot.as_of, model);
    return { p, implied, growthPct, growthMult, maturityMult, age, multiple, breadthMult };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: s.multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
    verdict: {
      verdict: 'SKIP' as const,
      expected_net_usd: 0,
      expected_value_usd: 0,
      farm_cost_usd: 0,
      capital_usd: DEFAULT_CAPITAL_USD,
      listing_odds: 0,
      band: '',
    },
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = DEFAULT_CAPITAL_USD;
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot, model: ModelConstants = MODEL): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => {
      const predicted = impliedValue(p, snapshot.as_of, model).implied;
      const ratio = (p.mcap_usd ?? 0) > 0 ? predicted / (p.mcap_usd ?? 1) : 1;
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        mcap_usd: p.mcap_usd,
        change_7d: p.change_7d,
        predicted_usd: predicted,
        miss: Math.round(Math.max(ratio, 1 / ratio) * 100) / 100,
      };
    });
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.base_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier ?? 1,
    farm_steps: row.farm_steps,
    verdict: row.verdict,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL, seal = ''): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const bands = listingBands(snapshot);
  const index = bySlug(snapshot.protocols);
  // Every row gets its own call: the odds of its size band, and what its implied value is worth to a
  // reader who deposits the default capital. The call is a function of the row, never of its rank.
  for (const row of board) {
    const p = index.get(row.slug);
    if (p === undefined) continue;
    row.verdict = verdictFor(p, row.implied_value_usd, bandOf(p.tvl_usd, bands), row.age_days, DEFAULT_CAPITAL_USD);
  }
  const live = liveRows(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    bands,
    calibration: calibrate(snapshot, model),
    ledger: ledger(snapshot, new Set(board.map((r) => r.slug))),
    default_capital_usd: DEFAULT_CAPITAL_USD,
    seal,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}


// ---------------------------------------------------------------------------
// The model on trial: what the snapshot itself can say about the model.
//
// Three questions the board has to answer before a reader may act on it, and all three are answered
// from the sealed snapshot, never from an opinion:
//
//   1. How wrong is the model? The protocols that already record a token are the hold-out: the same
//      formula is run on them and the result is compared with the market cap it actually has.
//   2. How likely is a token at all? For every TVL band, the share of protocols in that band that
//      already record one. It is an observed rate, not an assumption.
//   3. Is a row worth the gas? A deposit is worth the launch value in proportion to the deposit's
//      share of the protocol's TVL; the gas of the farm plan is subtracted and the rest is the net.
//
// The ledger at the end accounts for every protocol in the snapshot: the rows, the tokens, the
// wrappers, the exchanges and the versioned pools add up to the number of protocols read.

/** One size band and how often a protocol in it already records a token. */
export interface OddsBand {
  band: string;
  lo: number;
  hi: number;
  total: number;
  listed: number;
  p: number;
}

/** The TVL bands the odds are read from, in dollars. */
const ODDS_BANDS: [string, number, number][] = [
  ['$5M-10M', 5_000_000, 10_000_000],
  ['$10M-50M', 10_000_000, 50_000_000],
  ['$50M-100M', 50_000_000, 100_000_000],
  ['$100M-500M', 100_000_000, 500_000_000],
  ['$500M-2B', 500_000_000, 2_000_000_000],
  ['$2B+', 2_000_000_000, Number.POSITIVE_INFINITY],
];

/** The odds that a protocol of a given size records a token: the share of its band that already does. */
export function listingBands(snapshot: Snapshot): OddsBand[] {
  return ODDS_BANDS.map(([band, lo, hi]) => {
    const inBand = snapshot.protocols.filter((p) => p.tvl_usd >= lo && p.tvl_usd < hi);
    // A protocol counts as having listed when its token trades with a market value, which is the case the
    // model's claim is about. A record that names a symbol but carries no market cap is not counted: the
    // value the deposit is paid in is the one that trades.
    const listed = inBand.filter((p) => (p.mcap_usd ?? 0) > 0).length;
    return { band, lo, hi, total: inBand.length, listed, p: inBand.length ? listed / inBand.length : 0 };
  });
}

/** The band a protocol's TVL falls in. */
export function bandOf(tvl: number, bands: OddsBand[]): OddsBand {
  for (const b of bands) if (tvl >= b.lo && tvl < b.hi) return b;
  return bands[bands.length - 1]!;
}

/** One factor of the model, switched off, and what the miss then looks like. */
export interface Ablation {
  factor: string;
  neutralised: string;
  miss_p50: number;
  within_2x: number;
  /** Whether the factor earns its place: true when removing it makes the median miss worse. */
  kept: boolean;
}

/** The hold-out: the protocols that already have a token, scored by the same formula. */
export interface Calibration {
  samples: number;
  miss_p25: number;
  miss_p50: number;
  miss_p75: number;
  miss_p90: number;
  within_2x: number;
  within_5x: number;
  errors: number[];
  ablations: Ablation[];
}

/** The median and the quartiles of a sorted list of numbers. */
function quartiles(sorted: number[]): { p25: number; p50: number; p75: number } {
  if (sorted.length === 0) return { p25: 0, p50: 0, p75: 0 };
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
}

/**
 * The model's own accuracy, measured on the protocols that already record a token.
 *
 * For each of them the same formula produces an implied launch value, and the miss is the ratio
 * between that value and the market cap it really has, taken the worse way round: a prediction of
 * half the real value is a miss of x2, not of x0.5.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.tvl_usd > 0 && (p.mcap_usd ?? 0) > 0);
  const missOf = (off?: 'multiple' | 'growth' | 'maturity' | 'breadth'): number[] => {
    const out: number[] = [];
    for (const p of live) {
      const predicted = impliedValue(p, snapshot.as_of, model, off).implied;
      const ratio = predicted / (p.mcap_usd ?? 1);
      out.push(Math.max(ratio, 1 / ratio));
    }
    return out;
  };
  const errors = missOf().sort((a, b) => a - b);
  const q = quartiles(errors);
  const ablations: Ablation[] = [
    { factor: 'Category multiple', neutralised: 'switched off: every category at 0.25x', miss_p50: 0, within_2x: 0, kept: false },
    { factor: 'Momentum', neutralised: 'switched off: the seven-day move ignored', miss_p50: 0, within_2x: 0, kept: false },
    { factor: 'Maturity', neutralised: 'switched off: every protocol treated as new', miss_p50: 0, within_2x: 0, kept: false },
    { factor: 'Breadth', neutralised: 'put back at 0.03 a chain, as radar-2 had it', miss_p50: 0, within_2x: 0, kept: false },
  ];
  const offs: ('multiple' | 'growth' | 'maturity' | 'breadth')[] = ['multiple', 'growth', 'maturity', 'breadth'];
  offs.forEach((off, i) => {
    let e: number[];
    if (off === 'breadth') {
      // The version before this one multiplied by 1 + 0.03 a chain. That version is re-run here, so the
      // table shows what dropping the term bought rather than asserting that it bought something.
      const older: ModelConstants = { ...model, breadth_weight: 0.03 };
      e = live
        .map((p) => {
          const predicted = impliedValue(p, snapshot.as_of, older).implied;
          const ratio = predicted / (p.mcap_usd ?? 1);
          return Math.max(ratio, 1 / ratio);
        })
        .sort((a, b) => a - b);
    } else {
      e = missOf(off).sort((a, b) => a - b);
    }
    ablations[i]!.miss_p50 = round2(quartiles(e).p50);
    ablations[i]!.within_2x = e.filter((x) => x <= 2).length;
    // A factor earns its place when the model is worse without it. Breadth is the other way round: the
    // variant puts it back, so a worse variant is the evidence that the term should stay out.
    const worseWithout = ablations[i]!.miss_p50 > round2(quartiles(errors).p50) + 0.005;
    ablations[i]!.kept = off === 'breadth' ? !worseWithout : worseWithout;
  });
  return {
    samples: live.length,
    miss_p25: round2(q.p25),
    miss_p50: round2(q.p50),
    miss_p75: round2(q.p75),
    miss_p90: round2(errors[Math.min(errors.length - 1, Math.floor(0.9 * errors.length))] ?? 0),
    within_2x: errors.filter((x) => x <= 2).length,
    within_5x: errors.filter((x) => x <= 5).length,
    errors: errors.map((x) => round2(x)),
    ablations,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A row's call: farm it, watch it, or leave it. */
export interface RowVerdict {
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  expected_net_usd: number;
  expected_value_usd: number;
  farm_cost_usd: number;
  capital_usd: number;
  listing_odds: number;
  band: string;
}

/** The gas of the farm plan: the first transaction, the setup, and a week of activity. */
export function farmCost(age: number | null): number {
  const hold = holdDaysFor(age);
  return 3 + 8 + 2 * Math.ceil(hold / 7);
}

/**
 * What one row is worth to a reader who puts `capital` dollars into it.
 *
 * The claim is narrow and stated as it is used: if the protocol issues a token and the model is right,
 * the launch value is spread over the protocol's TVL in proportion to the deposit, so the deposit's
 * share of that value is the position's gross. The observed share of protocols in the same size band
 * that already record a token is the probability that one is issued at all. The farm plan's gas is
 * subtracted, and what is left is the expected net: above five dollars FARM, within five of zero
 * MARGINAL, below that SKIP.
 */
export function verdictFor(p: SnapshotProtocol, implied: number, odds: OddsBand, age: number | null, capital: number): RowVerdict {
  const share = p.tvl_usd > 0 ? capital / p.tvl_usd : 0;
  const gross = implied * share;
  const expected = odds.p * gross;
  const cost = farmCost(age);
  const net = expected - cost;
  return {
    verdict: net >= 5 ? 'FARM' : net >= -5 ? 'MARGINAL' : 'SKIP',
    expected_net_usd: Math.round(net * 100) / 100,
    expected_value_usd: Math.round(expected * 100) / 100,
    farm_cost_usd: cost,
    capital_usd: capital,
    listing_odds: Math.round(odds.p * 1000) / 1000,
    band: odds.band,
  };
}

/** The account of every protocol in the snapshot: what was read, and where every one of them went. */
export interface Ledger {
  read: number;
  rows: number;
  below_floor: number;
  with_token: number;
  wrapped: number;
  exchanges: number;
  versioned: number;
  /** Rankable and below the floor, past the cap the early radar carries: named so the sum closes. */
  past_cap: number;
}

/**
 * The account of every protocol in the snapshot, one bucket each, so the sum is the count that was read.
 *
 * The buckets are disjoint and ordered: a row if the board ranks it, else an exchange, else a versioned
 * pool, else a protocol whose token already trades, else a wrapped product, else a rankable protocol the
 * early radar left past its cap. Nothing falls between them, and the page checks the sum against `read`.
 */
export function ledger(snapshot: Snapshot, boardSlugs: Set<string>): Ledger {
  let rows = 0;
  let belowFloor = 0;
  let withToken = 0;
  let wrapped = 0;
  let exchanges = 0;
  let versioned = 0;
  let pastCap = 0;
  for (const p of snapshot.protocols) {
    if (boardSlugs.has(p.slug)) {
      rows += 1;
      if (p.tvl_usd < snapshot.floor_usd) belowFloor += 1;
    } else if (p.category === 'CEX') {
      exchanges += 1;
    } else if (VERSIONED.test(p.name)) {
      versioned += 1;
    } else if (!isPreToken(p)) {
      withToken += 1;
    } else if (isWrapped(p)) {
      wrapped += 1;
    } else {
      // Rankable, below the floor, and past the cap: the early radar's own limit, stated as one.
      pastCap += 1;
    }
  }
  return {
    read: snapshot.protocols.length,
    rows,
    below_floor: belowFloor,
    with_token: withToken,
    wrapped,
    exchanges,
    versioned,
    past_cap: pastCap,
  };
}
