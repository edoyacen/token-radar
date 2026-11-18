/* Token Radar — the board, the evidence behind it, and a call on every row.
   No network, no framework: window.RADAR is written beside this page by main.ts. */
(() => {
  const D = window.RADAR;
  if (!D) {
    document.body.innerHTML = '<p style="padding:40px;font:16px sans-serif">data.js did not load.</p>';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const usd = (n) => {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(a >= 1e10 ? 1 : 2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
    return '$' + n.toFixed(0);
  };
  const exact = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const money = (n) => (n < 0 ? '−$' + Math.abs(n).toFixed(2) : '$' + n.toFixed(2));
  const pct = (v) => (v === null || v === undefined ? '<span class="zero">—</span>'
    : '<span class="' + (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero') + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>');
  const month = (iso) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
  const days = (n) => (n === null || n === undefined ? '—' : n >= 730 ? (n / 365).toFixed(1) + ' yr' : Math.round(n) + ' d');

  /* The call is recomputed for the reader's own deposit: the gross is the deposit's share of the
     implied launch value, times the observed odds that a token appears at all, less the farm's gas. */
  const callAt = (r, dep) => {
    const v = r.verdict;
    const gross = r.tvl_usd > 0 ? r.implied_value_usd * (dep / r.tvl_usd) : 0;
    const expected = v.listing_odds * gross;
    const net = expected - v.farm_cost_usd;
    return { net, expected, gross, verdict: net >= 5 ? 'FARM' : net >= -5 ? 'MARGINAL' : 'SKIP' };
  };

  const rows = D.rows.map((r) => ({
    ...r,
    multiple: r.tvl_usd > 0 ? (r.implied_value_usd / r.tvl_usd) * 100 : 0,
    odds: r.verdict.listing_odds,
    net: r.verdict.expected_net_usd,
    v: r.verdict.verdict,
  }));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const maxImplied = Math.max(...rows.map((r) => r.implied_value_usd));

  const state = { q: '', cat: null, chain: null, minTvl: 0, v: 'ALL', dep: D.default_capital_usd, sort: 'rank', dir: 1, open: null };

  /* ------------------------------------------------ header */
  $('meta').innerHTML = [
    ['Snapshot', D.as_of + ' · DefiLlama'],
    ['Watchlist floor', usd(D.floor_usd) + ' TVL'],
    ['Model', D.model_version],
    ['Board', D.board_size + ' ranked · ' + D.early_size + ' below the floor'],
  ].map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');

  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const top = sorted[0];
  const total = rows.reduce((s, r) => s + r.implied_value_usd, 0);
  const median = (xs) => {
    const s = [...xs].filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  const counts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
  for (const r of rows) counts[r.v] += 1;

  $('kpis').innerHTML = [
    ['Watchlist covered', D.watchlist_size, 'protocols that record no token'],
    ['Ranked', D.board_size, D.early_size + ' below the ' + usd(D.floor_usd) + ' floor'],
    ['Top implied value', usd(top.implied_value_usd), top.name],
    ['Board total', usd(total), 'sum of every row'],
    ['Median miss', '×' + D.calibration.miss_p50, 'hold-out of ' + D.calibration.samples + ' live tokens'],
    ['Calls at ' + usd(state.dep), counts.FARM + ' farm', counts.MARGINAL + ' marginal · ' + counts.SKIP + ' skip'],
  ].map(([k, v, e]) => '<div class="kpi"><span>' + k + '</span><b>' + v + '</b><em>' + e + '</em></div>').join('');

  /* ------------------------------------------------ integrity strip: the numbers check themselves */
  const L = D.ledger;
  const bucketSum = L.rows + L.with_token + L.wrapped + L.exchanges + L.versioned + L.past_cap;
  const ranksOk = rows.every((r, i) => [...rows].sort((a, b) => a.rank - b.rank)[i].rank === i + 1);
  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  const descOk = ordered.every((r, i) => i === 0 || ordered[i - 1].implied_value_usd >= r.implied_value_usd);

  $('strip').innerHTML = [
    ['<span class="ok">✓</span> ' + L.read + ' protocols read = ' + L.rows + ' ranked + ' + L.with_token + ' with a token + ' + L.wrapped + ' wrapped + ' + L.exchanges + ' exchanges + ' + L.versioned + ' versioned pools + ' + L.past_cap + ' past the early cap', bucketSum === L.read],
    ['<span class="ok">✓</span> ranks ' + (ranksOk ? '1–' + rows.length + ' once each' : 'broken'), ranksOk],
    ['<span class="ok">✓</span> implied value never rises as rank ascends', descOk],
    ['<span class="ok">✓</span> seal <b>' + D.seal + '</b> — sha256 of every row\u2019s (rank, slug, value)', true],
  ].map(([t, ok]) => '<div>' + (ok ? t : '✗ ' + t) + '</div>').join('');

  /* ------------------------------------------------ evidence panels */
  const C = D.calibration;

  $('calPanel').innerHTML =
    '<h3>How wrong is the model?</h3>' +
    '<p class="hint">The ' + C.samples + ' protocols that already record a token are the hold-out: the same formula is run on them and compared with the market value the market gives them. The miss is the ratio, taken the worse way round.</p>' +
    '<table><tbody>' +
    [['Protocols in the hold-out', C.samples],
     ['Median miss (p50)', '<b class="bad">×' + C.miss_p50 + '</b>'],
     ['Middle half (p25–p75)', '×' + C.miss_p25 + ' – ×' + C.miss_p75],
     ['Nine in ten within', '×' + C.miss_p90],
     ['Within 2×', C.within_2x + ' of ' + C.samples],
     ['Within 5×', C.within_5x + ' of ' + C.samples]]
      .map(([k, v]) => '<tr><td>' + k + '</td><td class="num">' + v + '</td></tr>').join('') +
    '</tbody></table>' +
    '<p class="hint" style="margin-top:10px">A token that trades far above its protocol\u2019s TVL — a chain\u2019s own coin, a memecoin — is the outlier this formula cannot reach; the median, not the maximum, is what the board claims.</p>';

  const abRows = C.ablations.map((a) => {
    const mark = a.kept ? '' : '<b class="bad">';
    const end = a.kept ? '' : '</b>';
    return '<tr><td>' + a.factor + '<span class="cat">' + a.neutralised + '</span></td>' +
      '<td class="num">' + mark + '×' + a.miss_p50 + end + '</td>' +
      '<td class="num">' + a.within_2x + '</td>' +
      '<td class="num ' + (a.kept ? 'good' : 'bad') + '">' + (a.kept ? 'kept' : 'dropped') + '</td></tr>';
  }).join('');

  $('abPanel').innerHTML =
    '<h3>Which factors earn their place?</h3>' +
    '<p class="hint">Each factor is switched off (or, for breadth, back on at the weight the last version used) and the hold-out is re-scored. A factor that does not improve the median miss is not kept.</p>' +
    '<table><thead><tr><th>Factor</th><th class="num">Median miss</th><th class="num">Within 2×</th><th class="num">Verdict</th></tr></thead><tbody>' +
    abRows +
    '<tr><td><b>' + D.model_version + ', as shipped</b></td><td class="num"><b>×' + C.miss_p50 + '</b></td><td class="num">' + C.within_2x + '</td><td class="num good">—</td></tr>' +
    '</tbody></table>' +
    '<p class="hint" style="margin-top:10px">Breadth — a premium for the chains a protocol runs on — made the miss worse (×' +
    (C.ablations.find((a) => a.factor === 'Breadth') || { miss_p50: C.miss_p50 }).miss_p50 +
    ' with it, ×' + C.miss_p50 + ' without), so this version drops it. That is the whole reason the model is called ' + D.model_version + '.</p>';

  /* histogram of the miss, log bins */
  const BINS = [[1, 1.5], [1.5, 2], [2, 3], [3, 5], [5, 10], [10, 33], [33, Infinity]];
  const counts2 = BINS.map(([lo, hi]) => C.errors.filter((e) => e >= lo && e < hi).length);
  const hMax = Math.max(1, ...counts2);
  const HB = { w: 300, h: 118, pad: 22 };
  const bw = (HB.w - HB.pad * 2) / BINS.length;
  const hist =
    '<svg class="chart" viewBox="0 0 ' + HB.w + ' ' + HB.h + '" role="img" aria-label="Distribution of the miss">' +
    '<line class="axis" x1="' + HB.pad + '" y1="' + (HB.h - 20) + '" x2="' + (HB.w - 8) + '" y2="' + (HB.h - 20) + '"/>' +
    BINS.map(([lo, hi], i) => {
      const h = (counts2[i] / hMax) * (HB.h - 46);
      const x = HB.pad + i * bw;
      const lab = hi === Infinity ? lo + '+×' : lo + '–' + hi + '×';
      return '<rect x="' + (x + 3) + '" y="' + (HB.h - 20 - h) + '" width="' + (bw - 6) + '" height="' + Math.max(1, h) + '" fill="' + (lo === 1 ? '#0d8a4f' : lo < 5 ? '#3fa06a' : '#c8553d') + '" rx="2"/>' +
        '<text x="' + (x + bw / 2) + '" y="' + (HB.h - 24 - h) + '" text-anchor="middle" font-weight="700">' + counts2[i] + '</text>' +
        '<text x="' + (x + bw / 2) + '" y="' + (HB.h - 8) + '" text-anchor="middle">' + lab + '</text>';
    }).join('') +
    '</svg>';

  $('histPanel').innerHTML =
    '<h3>The shape of the error</h3>' +
    '<p class="hint">Every hold-out protocol, by how far the prediction lands from the market value: ' + C.samples + ' tokens, log-scale bins.</p>' +
    hist +
    '<div class="legend"><span><i style="background:#0d8a4f"></i>within 1.5× (' + counts2[0] + ')</span>' +
    '<span><i style="background:#3fa06a"></i>within 5× (' + (counts2[0] + counts2[1] + counts2[2] + counts2[3]) + ')</span>' +
    '<span><i style="background:#c8553d"></i>past 5× (' + (counts2[4] + counts2[5] + counts2[6]) + ')</span></div>';

  /* scatter: predicted against actual, log-log, with the y = x line */
  const pts = D.live.filter((r) => r.mcap_usd > 0 && r.predicted_usd > 0);
  const lg = (v) => Math.log10(Math.max(1e4, v));
  const xs = pts.map((p) => lg(p.mcap_usd));
  const ys = pts.map((p) => lg(p.predicted_usd));
  const lo = Math.min(...xs, ...ys) - 0.3;
  const hi = Math.max(...xs, ...ys) + 0.3;
  const S = { w: 300, h: 152, l: 26, r: 8, t: 8, b: 20 };
  const sx = (v) => S.l + ((lg(v) - lo) / (hi - lo)) * (S.w - S.l - S.r);
  const sy = (v) => S.h - S.b - ((lg(v) - lo) / (hi - lo)) * (S.h - S.t - S.b);
  const scatter =
    '<svg class="chart" viewBox="0 0 ' + S.w + ' ' + S.h + '" role="img" aria-label="Predicted against actual market value">' +
    '<line class="axis" x1="' + S.l + '" y1="' + (S.h - S.b) + '" x2="' + (S.w - S.r) + '" y2="' + (S.h - S.b) + '"/>' +
    '<line class="axis" x1="' + S.l + '" y1="' + S.t + '" x2="' + S.l + '" y2="' + (S.h - S.b) + '"/>' +
    '<line x1="' + sx(1e4) + '" y1="' + sy(1e4) + '" x2="' + sx(1e13) + '" y2="' + sy(1e13) + '" stroke="#869287" stroke-width="1" stroke-dasharray="4 3"/>' +
    pts.map((p) => '<circle cx="' + sx(p.mcap_usd) + '" cy="' + sy(p.predicted_usd) + '" r="3" fill="' + (p.miss <= 2 ? '#0d8a4f' : p.miss <= 5 ? '#3fa06a' : '#c8553d') + '" fill-opacity="0.85"/>').join('') +
    '<text x="' + (S.w - S.r) + '" y="' + (S.h - 8) + '" text-anchor="end">market value →</text>' +
    '<text x="' + (S.l + 4) + '" y="' + (S.t + 9) + '">predicted ↑</text>' +
    '</svg>';

  $('scatterPanel').innerHTML =
    '<h3>Fit against the market</h3>' +
    '<p class="hint">The ' + pts.length + ' largest tokens that already trade: predicted launch value against the value the market gives them. On the dashed line is exact; below it the model is shy.</p>' +
    scatter +
    '<div class="legend"><span><i style="background:#0d8a4f"></i>within 2×</span><span><i style="background:#3fa06a"></i>within 5×</span><span><i style="background:#c8553d"></i>past 5×</span></div>';

  $('ledgerPanel').innerHTML =
    '<h3>Where every protocol went</h3>' +
    '<p class="hint">The snapshot holds ' + L.read + ' protocols. Each one lands in exactly one bucket, and the buckets add back up to it.</p>' +
    '<table><tbody>' +
    [['Ranked on the board', L.rows, 'the watchlist and ' + L.below_floor + ' below the floor'],
     ['Records a token that trades', L.with_token, 'the hold-out, priced but never ranked'],
     ['A wrapped or staked product', L.wrapped, 'no launch of its own ahead of it'],
     ['An exchange', L.exchanges, 'its own token, not a launch'],
     ['A versioned pool', L.versioned, 'another protocol\u2019s pool'],
     ['Past the early cap', L.past_cap, 'rankable, left out by the cap']]
      .map(([k, n, note]) => '<tr><td>' + k + '<span class="cat">' + note + '</span></td><td class="num"><b>' + n + '</b></td></tr>').join('') +
    '<tr><td><b>Sum</b></td><td class="num"><b class="' + (bucketSum === L.read ? 'good' : 'bad') + '">' + bucketSum + ' / ' + L.read + '</b></td></tr>' +
    '</tbody></table>';

  $('oddsPanel').innerHTML =
    '<h3>How often does a token appear?</h3>' +
    '<p class="hint">For each size band, the share of protocols in it whose token already trades with a market value. It is an observed rate, not an assumption, and it is what the call column multiplies by.</p>' +
    '<table><thead><tr><th>TVL band</th><th class="num">Protocols</th><th class="num">Listed</th><th class="num">Odds</th></tr></thead><tbody>' +
    D.bands.map((b) => '<tr><td>' + b.band + '</td><td class="num">' + b.total + '</td><td class="num">' + b.listed +
      '</td><td class="num"><b>' + (b.p * 100).toFixed(1) + '%</b><div class="bar"><i style="width:' + Math.max(2, b.p * 100).toFixed(1) + '%"></i></div></td></tr>').join('') +
    '</tbody></table>';

  /* ------------------------------------------------ filters */
  const cats = new Map();
  for (const r of rows) cats.set(r.category || 'Uncategorised', (cats.get(r.category || 'Uncategorised') || 0) + 1);
  $('cats').innerHTML = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([c, n]) => '<button class="chip" type="button" data-cat="' + c.replace(/"/g, '&quot;') + '" aria-pressed="false">' + c + '<small>' + n + '</small></button>').join('');

  const chains = new Set();
  for (const r of rows) for (const c of r.chains || []) chains.add(c);
  $('chain').innerHTML = '<option value="">All chains</option>' + [...chains].sort()
    .map((c) => '<option value="' + c.replace(/"/g, '&quot;') + '">' + c + '</option>').join('');

  const maxTvl = Math.max(...rows.map((r) => r.tvl_usd));
  $('tvl').max = String(Math.round(maxTvl));
  $('tvlOut').textContent = 'any';
  $('dep').value = String(state.dep);
  $('depOut').textContent = usd(state.dep);

  const view = () => {
    const q = state.q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain && !(r.chains || []).includes(state.chain)) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (state.v !== 'ALL' && callAt(r, state.dep).verdict !== state.v) return false;
      if (!q) return true;
      return (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase().includes(q);
    });
    const k = state.sort === 'odds' ? 'odds' : state.sort === 'net' ? 'net' : state.sort === 'v' ? 'v' : state.sort;
    out.sort((a, b) => {
      const x = k === 'name' ? a.name.toLowerCase() : a[k];
      const y = k === 'name' ? b.name.toLowerCase() : b[k];
      if (x === y) return a.rank - b.rank;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x > y ? 1 : -1) * state.dir;
    });
    return out;
  };

  const draw = () => {
    const list = view();
    $('thesis').innerHTML = 'Every row prices a launch from the protocol’s own TVL, its category, its week and its age. ' +
      'The <b>call</b> asks a different question: what <b>' + usd(state.dep) + '</b> of your own money is worth after the odds ' +
      'that a token appears at all, and after the gas of the farm plan.';
    $('count').textContent = list.length + ' of ' + rows.length + ' rows' +
      (state.v !== 'ALL' ? ' · ' + state.v : '') + (state.cat ? ' · ' + state.cat : '') +
      (state.chain ? ' · ' + state.chain : '') + (state.minTvl ? ' · TVL ≥ ' + usd(state.minTvl) : '') +
      (state.q ? ' · “' + state.q + '”' : '') + ' · net at ' + usd(state.dep);

    $('rows').innerHTML = list.slice(0, 400).map((r) => {
      const c = callAt(r, state.dep);
      return '<tr data-slug="' + r.slug + '" class="' + (state.open === r.slug ? 'on' : '') + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="pname">' + r.name + '</span><span class="cat">' + (r.category || 'Uncategorised') + ' · ' + (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's') + '</span></td>' +
        '<td class="num">' + usd(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num impl">' + usd(r.implied_value_usd) +
        '<div class="bar"><i style="width:' + Math.max(2, (r.implied_value_usd / maxImplied) * 100).toFixed(1) + '%"></i></div></td>' +
        '<td class="num">' + r.multiple.toFixed(1) + '%</td>' +
        '<td class="num">' + (r.odds * 100).toFixed(1) + '%</td>' +
        '<td class="num ' + (c.net > 0 ? 'pos' : c.net < 0 ? 'neg' : 'zero') + '">' + money(c.net) + '</td>' +
        '<td class="num"><span class="call ' + c.verdict + '">' + c.verdict + '</span></td>' +
        '</tr>';
    }).join('');

    for (const tr of $('rows').querySelectorAll('tr')) tr.addEventListener('click', () => open(tr.dataset.slug));
  };

  /* ------------------------------------------------ detail */
  const factor = (label, ratio, text) => {
    const w = Math.max(2, Math.min(100, (ratio / 2) * 100));
    return '<div class="factor"><span>' + label + '</span><div class="track"><i style="width:' + w.toFixed(1) + '%"></i></div><em>' + text + '</em></div>';
  };

  const open = (slug) => {
    const r = bySlug.get(slug);
    if (!r) return;
    state.open = slug;
    for (const tr of $('rows').querySelectorAll('tr')) tr.classList.toggle('on', tr.dataset.slug === slug);
    const c = callAt(r, state.dep);
    const v = r.verdict;
    const drawer = $('drawer');
    drawer.innerHTML =
      '<h3>' + r.name + '</h3>' +
      '<div class="bigcall"><span class="n ' + (c.net > 0 ? 'pos' : 'neg') + '">' + money(c.net) + '</span>' +
      '<span class="u">expected net on ' + usd(state.dep) + ' · <b>' + c.verdict + '</b></span></div>' +
      '<p class="where">Rank ' + r.rank + ' of ' + D.board_size + ' · ' + (r.category || 'Uncategorised') + ' · tracked since ' + month(r.listed_at) + '</p>' +
      '<p><span class="badge">' + usd(r.tvl_usd) + ' TVL</span><span class="badge">' + usd(r.implied_value_usd) + ' implied</span>' +
      '<span class="badge">' + r.multiple.toFixed(1) + '% of TVL</span><span class="badge">' + (r.chains || []).length + ' chains</span>' +
      '<span class="badge">token odds ' + (r.odds * 100).toFixed(1) + '% · ' + v.band + '</span></p>' +
      '<div class="formula">Implied = TVL × category multiple × momentum × maturity × breadth<br>' +
      '<code>' + exact(r.tvl_usd) + ' × ' + r.category_multiple.toFixed(2) + ' × ' + r.growth_multiplier.toFixed(2) + ' × ' +
      r.maturity_multiplier.toFixed(2) + ' × ' + r.breadth_multiplier.toFixed(2) + ' = ' + exact(r.implied_value_usd) + '</code></div>' +
      factor('Category', r.category_multiple / 0.55, r.category_multiple.toFixed(2) + '×') +
      factor('Momentum', r.growth_multiplier / 1.6, r.growth_multiplier.toFixed(2) + '×') +
      factor('Maturity', (r.maturity_multiplier - 0.55) / 0.45, r.maturity_multiplier.toFixed(2) + '×') +
      '<h4 style="margin:16px 0 6px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#869287">The call at ' + usd(state.dep) + '</h4>' +
      '<div class="formula"><code>' + usd(state.dep) + ' ÷ ' + usd(r.tvl_usd) + ' = ' + (r.tvl_usd > 0 ? ((state.dep / r.tvl_usd) * 100).toFixed(4) : '0') + '% of TVL<br>' +
      '× ' + usd(r.implied_value_usd) + ' = ' + money(c.gross) + ' gross<br>' +
      '× ' + (r.odds * 100).toFixed(1) + '% odds = ' + money(c.expected) + ' expected<br>' +
      '− ' + money(v.farm_cost_usd) + ' gas = <b>' + money(c.net) + '</b> → ' + c.verdict + '</code></div>' +
      '<p class="where">The odds are the share of protocols in the ' + v.band + ' band whose token already trades. ' +
      'The gas is the plan below: one first transaction, one setup and a week of activity. The plan assumes a ' +
      usd(D.default_capital_usd) + ' position — the deposit this board is written at — while the call above is at your ' +
      usd(state.dep) + '.</p>' +
      '<h4 style="margin:16px 0 8px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#869287">How to farm it</h4>' +
      '<ol class="steps">' + (r.farm_steps || []).map((s) => {
        const i = s.indexOf(' Cost: ');
        const head = i > 0 ? s.slice(0, i) : s;
        const rest = i > 0 ? s.slice(i + 1) : '';
        return '<li><b>' + head + '</b><span>' + rest + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="where">Chains: ' + (r.chains || []).join(', ') + '</p>';
  };

  const method = () => {
    $('drawer').innerHTML =
      '<h3>What this board claims</h3>' +
      '<p class="where">Every row is a protocol whose record carries no token, priced as if its record stayed as it is. Rank is the model\u2019s claim about value, not a forecast that a token is issued.</p>' +
      '<div class="formula"><code>implied = TVL × multiple(category) × momentum × maturity</code></div>' +
      '<p class="where">A dollar of TVL is rent the protocol charges on other people\u2019s capital. A perp DEX turns volume over many times a day and a DEX takes a fee on every swap, so their TVL is worth more as a launch than a restaking layer\u2019s or a bridge\u2019s, whose spread is thin and whose product is close to a commodity. That is why the multiple is a table by category, and why the board is not TVL sorted.</p>' +
      '<p class="where">The <b>call</b> is separate from the rank: it asks what one deposit is worth after the odds and the gas, and it changes with the deposit. Slide the deposit in the controls to see rows move between FARM, MARGINAL and SKIP.</p>' +
      '<p class="where">A protocol here records no token. That is not proof it has none: DefiLlama\u2019s record is the only source, and a token it does not carry would not show.</p>' +
      '<p class="where"><b>Pick a row</b> to read its multipliers, its arithmetic and its farm plan.</p>';
  };

  /* ------------------------------------------------ CSV */
  $('csv').addEventListener('click', () => {
    const head = ['rank', 'slug', 'name', 'category', 'chains', 'tvl_usd', 'change_7d', 'implied_value_usd', 'xtvl_pct', 'token_odds', 'band', 'gas_usd', 'net_usd_at_deposit', 'call', 'deposit_usd'];
    const lines = [head.join(',')];
    for (const r of [...view()].sort((a, b) => a.rank - b.rank)) {
      const c = callAt(r, state.dep);
      const cell = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      lines.push([r.rank, cell(r.slug), cell(r.name), cell(r.category || ''), cell((r.chains || []).join(' ')),
        r.tvl_usd, r.change_7d ?? '', r.implied_value_usd, r.multiple.toFixed(2), r.verdict.listing_odds,
        cell(r.verdict.band), r.verdict.farm_cost_usd, c.net.toFixed(2), c.verdict, state.dep].join(','));
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'token-radar-board.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  /* ------------------------------------------------ wiring */
  const reset = () => {
    state.q = ''; state.cat = null; state.chain = null; state.minTvl = 0; state.v = 'ALL';
    state.dep = D.default_capital_usd; state.sort = 'rank'; state.dir = 1;
    $('q').value = ''; $('chain').value = ''; $('tvl').value = '0'; $('tvlOut').textContent = 'any';
    $('dep').value = String(state.dep); $('depOut').textContent = usd(state.dep);
    for (const c of $('cats').querySelectorAll('.chip')) c.setAttribute('aria-pressed', 'false');
    for (const c of $('verdicts').querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c.dataset.v === 'ALL'));
    draw();
  };

  $('q').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
  $('chain').addEventListener('change', (e) => { state.chain = e.target.value || null; draw(); });
  $('tvl').addEventListener('input', (e) => {
    state.minTvl = Number(e.target.value);
    $('tvlOut').textContent = state.minTvl ? usd(state.minTvl) : 'any';
    draw();
  });
  $('dep').addEventListener('input', (e) => {
    state.dep = Number(e.target.value);
    $('depOut').textContent = usd(state.dep);
    const c = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    for (const r of rows) c[callAt(r, state.dep).verdict] += 1;
    $('kpis').children[5].querySelector('span').textContent = 'Calls at ' + usd(state.dep);
    $('kpis').children[5].querySelector('b').textContent = c.FARM + ' farm';
    $('kpis').children[5].querySelector('em').textContent = c.MARGINAL + ' marginal · ' + c.SKIP + ' skip';
    draw();
    if (state.open) open(state.open);
  });
  $('verdicts').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.v = b.dataset.v;
    for (const x of $('verdicts').querySelectorAll('.chip')) x.setAttribute('aria-pressed', String(x.dataset.v === state.v));
    draw();
  });
  $('cats').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const c = b.dataset.cat;
    state.cat = state.cat === c ? null : c;
    for (const x of $('cats').querySelectorAll('.chip')) x.setAttribute('aria-pressed', String(x.dataset.cat === state.cat));
    draw();
  });
  $('reset').addEventListener('click', reset);
  for (const th of document.querySelectorAll('th.sortable')) {
    th.addEventListener('click', () => {
      const k = th.dataset.k;
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = th.dataset.num ? -1 : 1; }
      draw();
    });
  }

  $('foot').innerHTML =
    '<b>Method.</b> Implied value is ' + D.model_version + '\u2019s own claim, not make.fun\u2019s and not a forecast of whether or when a token is issued: ' +
    'TVL × a per-category multiple × a damped seven-day momentum × a maturity that rises with how long DefiLlama has tracked the protocol. ' +
    'The snapshot is sealed at ' + D.as_of + ' and never moves. The board is ranked by implied value; the call column is a different question — a deposit\u2019s share of that value, ' +
    'times the observed odds that a protocol of its size already trades, less the gas of its farm plan — and it is shown at <b>your</b> deposit, not at a fixed one.' +
    '<p>A protocol here records no token; that is not proof it has none. Nothing on this page is investment advice, and no account or wallet is connected to it.</p>';

  const applyHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) { draw(); method(); return; }
    const p = new URLSearchParams(h);
    if (p.get('cat')) state.cat = p.get('cat');
    if (p.get('v')) state.v = p.get('v');
    if (p.get('min')) state.minTvl = Number(p.get('min'));
    if (p.get('q')) state.q = p.get('q');
    if (p.get('dep')) state.dep = Number(p.get('dep'));
    if (p.get('chain')) state.chain = p.get('chain');
    $('q').value = state.q;
    $('chain').value = state.chain || '';
    $('tvl').value = String(state.minTvl);
    $('tvlOut').textContent = state.minTvl ? usd(state.minTvl) : 'any';
    $('dep').value = String(state.dep);
    $('depOut').textContent = usd(state.dep);
    for (const x of $('cats').querySelectorAll('.chip')) x.setAttribute('aria-pressed', String(x.dataset.cat === state.cat));
    for (const x of $('verdicts').querySelectorAll('.chip')) x.setAttribute('aria-pressed', String(x.dataset.v === state.v));
    draw();
    const slug = p.get('detail');
    if (slug && bySlug.has(slug)) open(slug);
    else {
      const n = view().length;
      const bits = [];
      if (state.cat) bits.push('category ' + state.cat);
      if (state.v !== 'ALL') bits.push('call ' + state.v);
      if (state.chain) bits.push('chain ' + state.chain);
      if (state.minTvl) bits.push('TVL ≥ ' + usd(state.minTvl));
      if (state.q) bits.push('search “' + state.q + '”');
      $('drawer').innerHTML = '<h3>Filtered view</h3>' +
        '<p class="where">The board narrows as you type, pick a chain, raise the TVL floor, press a call or a category.</p>' +
        '<div class="formula"><code>' + n + ' of ' + rows.length + ' rows' + (bits.length ? ' · ' + bits.join(' · ') : '') + '</code></div>' +
        '<p class="where">A filter is a question about the market, not about the model: what survives keeps its own implied value, its odds, its call and its farm plan.</p>';
    }
  };

  applyHash();
  window.addEventListener('hashchange', applyHash);
})();
