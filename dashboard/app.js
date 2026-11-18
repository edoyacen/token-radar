/* Token Radar — the board, a detail view and a filter, over the sealed snapshot.
   No network, no framework: window.RADAR is written beside this page by main.ts. */
(() => {
  const D = window.RADAR;
  if (!D) {
    document.body.innerHTML = '<p style="padding:40px;font:16px sans-serif;color:#e8eef6">data.js did not load.</p>';
    return;
  }

  const rows = D.rows.map((r) => ({
    ...r,
    multiple: r.tvl_usd > 0 ? (r.implied_value_usd / r.tvl_usd) * 100 : 0,
    chain0: r.chains && r.chains.length ? r.chains[0] : '—',
  }));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const state = { q: '', cat: null, chain: null, minTvl: 0, sort: 'rank', dir: 1, open: null };

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
  const pct = (v) => (v === null || v === undefined ? '<span class="zero">—</span>'
    : `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`);
  const month = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const days = (n) => (n === null || n === undefined ? '—' : n >= 730 ? (n / 365).toFixed(1) + ' yr' : Math.round(n) + ' d');

  /* ---------- header, summary ---------- */
  $('meta').innerHTML = [
    ['Snapshot', `${D.as_of} · DefiLlama`],
    ['Watchlist floor', usd(D.floor_usd) + ' TVL'],
    ['Model', `${D.model_version} · category multiples`],
    ['Board', `${D.board_size} ranked · ${D.early_size} below the floor`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const top = sorted[0];
  const total = rows.reduce((s, r) => s + r.implied_value_usd, 0);
  const median = (xs) => {
    const s = [...xs].filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  const ages = rows.map((r) => r.age_days);

  $('kpis').innerHTML = [
    ['Watchlist covered', `${D.watchlist_size}`, 'protocols that record no token'],
    ['Ranked', `${D.board_size}`, `${D.early_size} below the ${usd(D.floor_usd)} floor`],
    ['Top implied value', usd(top.implied_value_usd), top.name],
    ['Board total', usd(total), 'sum of every row'],
    ['Median row', usd(median(rows.map((r) => r.implied_value_usd))), `median ×TVL ${median(rows.map((r) => r.multiple)).toFixed(1)}%`],
    ['Median age', days(median(ages)), 'since DefiLlama began tracking'],
  ].map(([k, v, e]) => `<div class="kpi"><span>${k}</span><b>${v}</b><em>${e}</em></div>`).join('');

  /* ---------- filters ---------- */
  const cats = new Map();
  for (const r of rows) cats.set(r.category || 'Uncategorised', (cats.get(r.category || 'Uncategorised') || 0) + 1);
  const catList = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9);

  $('cats').innerHTML = catList.map(([c, n]) =>
    `<button class="chip" type="button" data-cat="${c.replace(/"/g, '&quot;')}" aria-pressed="false">${c}<small>${n}</small></button>`).join('');

  const chains = new Set();
  for (const r of rows) for (const c of r.chains || []) chains.add(c);
  $('chain').innerHTML = '<option value="">All chains</option>' + [...chains].sort()
    .map((c) => `<option value="${c.replace(/"/g, '&quot;')}">${c}</option>`).join('');

  const maxTvl = Math.max(...rows.map((r) => r.tvl_usd));
  $('tvl').max = String(Math.round(maxTvl));
  $('tvlOut').textContent = 'any';

  /* ---------- table ---------- */
  const view = () => {
    const q = state.q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain && !(r.chains || []).includes(state.chain)) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      return (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase().includes(q);
    });
    const k = state.sort;
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

  const maxImplied = Math.max(...rows.map((r) => r.implied_value_usd));

  const draw = () => {
    const list = view();
    $('count').textContent = `${list.length} of ${rows.length} rows` +
      (state.cat ? ` · ${state.cat}` : '') + (state.chain ? ` · ${state.chain}` : '') +
      (state.minTvl ? ` · TVL ≥ ${usd(state.minTvl)}` : '') + (state.q ? ` · “${state.q}”` : '');

    $('rows').innerHTML = list.map((r) => `
      <tr data-slug="${r.slug}" class="${state.open === r.slug ? 'on' : ''}">
        <td class="num rank">${r.rank}</td>
        <td class="name"><b>${r.name}</b><span>${r.category || 'Uncategorised'} · ${(r.chains || []).length} chain${(r.chains || []).length === 1 ? '' : 's'}</span></td>
        <td class="num">${usd(r.tvl_usd)}</td>
        <td class="num">${pct(r.change_7d)}</td>
        <td class="num impl">${usd(r.implied_value_usd)}
          <div class="bar"><i style="width:${Math.max(2, (r.implied_value_usd / maxImplied) * 100).toFixed(1)}%"></i></div>
        </td>
        <td class="num">${r.multiple.toFixed(1)}%</td>
        <td class="num">${days(r.age_days)}</td>
      </tr>`).join('');

    for (const tr of $('rows').querySelectorAll('tr')) {
      tr.addEventListener('click', () => open(tr.dataset.slug));
    }

    for (const th of document.querySelectorAll('th.sortable')) {
      const on = th.dataset.k === state.sort;
      th.toggleAttribute('aria-sort', on);
      if (on) th.setAttribute('aria-sort', state.dir === 1 ? 'ascending' : 'descending');
    }
  };

  /* ---------- detail ---------- */
  const factor = (label, ratio, text) => {
    const w = Math.max(2, Math.min(100, (ratio / 2) * 100));
    return `<div class="factor"><span>${label}</span><div class="track"><i style="width:${w.toFixed(1)}%"></i></div><em>${text}</em></div>`;
  };

  const open = (slug) => {
    const r = bySlug.get(slug);
    if (!r) return;
    state.open = slug;
    const drawer = $('drawer');
    drawer.classList.remove('empty');
    const cat = r.category_multiple ?? 0;
    const mom = r.growth_multiplier ?? 1;
    const mat = r.maturity_multiplier ?? 1;
    const brd = r.breadth_multiplier ?? 1;
    drawer.innerHTML = `
      <h3>${r.name}</h3>
      <p class="where">Rank ${r.rank} of ${D.board_size} · ${r.category || 'Uncategorised'} · tracked since ${month(r.listed_at)}</p>
      <p><span class="badge">${usd(r.tvl_usd)} TVL</span><span class="badge">${usd(r.implied_value_usd)} implied</span><span class="badge">${r.multiple.toFixed(1)}% of TVL</span><span class="badge">${(r.chains || []).length} chains</span></p>
      <div class="formula">Implied = TVL × category multiple × momentum × maturity × breadth<br>
        <code>${exact(r.tvl_usd)} × ${cat.toFixed(2)} × ${mom.toFixed(2)} × ${mat.toFixed(2)} × ${brd.toFixed(2)} = ${exact(r.implied_value_usd)}</code></div>
      ${factor('Category', cat / 0.55, `${cat.toFixed(2)}×`)}
      ${factor('Momentum', mom / 1.6, `${mom.toFixed(2)}×`)}
      ${factor('Maturity', (mat - 0.55) / 0.45, `${mat.toFixed(2)}×`)}
      ${factor('Breadth', (brd - 1) / 0.18, `${brd.toFixed(2)}×`)}
      <h4 style="margin:16px 0 8px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#8ba0b6">How to farm it</h4>
      <ol class="steps">${(r.farm_steps || []).map((s) => {
        const i = s.indexOf(' Cost: ');
        const head = i > 0 ? s.slice(0, i) : s;
        const rest = i > 0 ? s.slice(i + 1) : '';
        return `<li><b>${head}</b><span>${rest}</span></li>`;
      }).join('')}</ol>
      <p class="where" style="margin-top:12px">Chains: ${(r.chains || []).join(', ')}</p>`;
    for (const tr of $('rows').querySelectorAll('tr')) tr.classList.toggle('on', tr.dataset.slug === slug);
  };

  /** The panel a reader sees before picking a row: what the number is and how it was built. */
  const method = () => {
    const drawer = $('drawer');
    drawer.classList.remove('empty');
    drawer.innerHTML = `
      <h3>How the board is built</h3>
      <p class="where">Every row is one protocol whose record carries no token, priced as if its record stayed as it is.</p>
      <div class="formula"><code>implied = TVL × multiple(category) × momentum × maturity × breadth</code></div>
      <div class="factor"><span>Category</span><div class="track"><i style="width:100%"></i></div><em>0.12–0.55×</em></div>
      <div class="factor"><span>Momentum</span><div class="track"><i style="width:62%"></i></div><em>7d, damped</em></div>
      <div class="factor"><span>Maturity</span><div class="track"><i style="width:78%"></i></div><em>0.6–1.0×</em></div>
      <div class="factor"><span>Breadth</span><div class="track"><i style="width:40%"></i></div><em>1.0–1.18×</em></div>
      <p class="where" style="margin-top:14px">A dollar of TVL is rent the protocol charges on other people's capital. A perp DEX turns volume over many times a day and a DEX takes a fee on every swap, so their TVL is worth more as a launch than a restaking layer's or a bridge's, whose spread is thin and whose product is close to a commodity. That is why the multiple is a table by category, and why the board is not just TVL sorted. <b>Pick a row</b> to read its own multipliers, its chains and its farm plan.</p>
      <p class="where">A protocol here records no token. That is not proof it has none: DefiLlama's record is the only source, and a token it does not carry would not show. Nothing here is a forecast of whether or when a token is issued.</p>`;
  };

  /* ---------- wire ---------- */
  const reset = () => {
    state.q = ''; state.cat = null; state.chain = null; state.minTvl = 0; state.sort = 'rank'; state.dir = 1;
    $('q').value = ''; $('chain').value = ''; $('tvl').value = '0'; $('tvlOut').textContent = 'any';
    for (const c of $('cats').querySelectorAll('.chip')) c.setAttribute('aria-pressed', 'false');
    draw();
  };

  $('q').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
  $('chain').addEventListener('change', (e) => { state.chain = e.target.value || null; draw(); });
  $('tvl').addEventListener('input', (e) => {
    state.minTvl = Number(e.target.value);
    $('tvlOut').textContent = state.minTvl ? usd(state.minTvl) : 'any';
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

  $('foot').innerHTML = `<b>Method.</b> Implied value is ${D.model_version}'s own claim, not make.fun's and not a forecast of
    whether or when a token is issued: TVL × a per-category multiple × a damped seven-day momentum × a maturity that
    rises with how long DefiLlama has tracked the protocol × a small breadth premium for chains it runs on.
    The snapshot is sealed at ${D.as_of} and never moves. A protocol here records no token; that is not proof it has none.`;

  /* ---------- hash routes: #detail=slug, #filter&cat=…&min=…&q=… ---------- */
  const applyHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) {
      draw();
      method();
      return;
    }
    const params = new URLSearchParams(h.replace(/^#/, ''));
    if (params.get('cat')) state.cat = params.get('cat');
    if (params.get('min')) state.minTvl = Number(params.get('min'));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('chain')) state.chain = params.get('chain');
    $('q').value = state.q;
    $('chain').value = state.chain || '';
    $('tvl').value = String(state.minTvl);
    $('tvlOut').textContent = state.minTvl ? usd(state.minTvl) : 'any';
    for (const x of $('cats').querySelectorAll('.chip')) x.setAttribute('aria-pressed', String(x.dataset.cat === state.cat));
    draw();
    const slug = params.get('detail');
    if (slug && bySlug.has(slug)) open(slug);
    else {
      const n = view().length;
      const bits = [];
      if (state.cat) bits.push('category ' + state.cat);
      if (state.chain) bits.push('chain ' + state.chain);
      if (state.minTvl) bits.push('TVL ≥ ' + usd(state.minTvl));
      if (state.q) bits.push('search “' + state.q + '”');
      $('drawer').classList.remove('empty');
      $('drawer').innerHTML = `<h3>Filtered view</h3>
        <p class="where">The board narrows as you type, pick a chain, raise the TVL floor or press a category chip.</p>
        <div class="formula"><code>${n} of ${rows.length} rows${bits.length ? ' · ' + bits.join(' · ') : ''}</code></div>
        <p class="where" style="margin-top:12px">A filter is a question about the market, not about the model: what is left after it is the same ranking, and every surviving row keeps its own implied value, its ×TVL and its farm plan.</p>`;
    }
  };

  applyHash();
  window.addEventListener('hashchange', applyHash);
})();
