const _refSel = new Map(), _neuronSel = new Map();
  const _refCache = {}, _neuronCache = {};
  function rowKey(r) {
    return [r.gpu, r.model, r.precision, r.pp, r.tp,
            r.isl, r.osl, r.num_requests, r.throughput].join('§');
  }
  function activeContext() {
    return document.getElementById('tab-neuron').classList.contains('active') ? 'neuron' : 'ref';
  }
  function updateComparePanel() {} // stub; real impl loaded below

// ── Row comparison (full implementation) ───────────────────────────────

  function initCompare() {
  // Event delegation — one listener per tbody, no per-row onclick needed
  document.getElementById('tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-rkey]');
    if (!tr) return;
    const key = tr.dataset.rkey;
    if (_refSel.has(key)) { _refSel.delete(key); tr.classList.remove('row-selected'); }
    else if (_refCache[key]) { _refSel.set(key, _refCache[key]); tr.classList.add('row-selected'); }
    updateComparePanel();
  });

  document.getElementById('ntbody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-rkey]');
    if (!tr) return;
    const key = tr.dataset.rkey;
    if (_neuronSel.has(key)) { _neuronSel.delete(key); tr.classList.remove('row-selected'); }
    else if (_neuronCache[key]) { _neuronSel.set(key, _neuronCache[key]); tr.classList.add('row-selected'); }
    updateComparePanel();
  });
  }

  // Clear All — wipes both selection maps and removes highlights from both tables
  function clearCompare() {
    _refSel.clear();
    _neuronSel.clear();
    document.querySelectorAll('#tbody tr.row-selected, #ntbody tr.row-selected')
      .forEach(tr => tr.classList.remove('row-selected'));
    updateComparePanel();
  }

  // ── Unified cross-tab compare panel ────────────────────────────────────
  // Combines _refSel (green) and _neuronSel (blue) into one chart.
  // Panel stays visible regardless of which data tab is active.
  updateComparePanel = function() {
    const panel   = document.getElementById('compare-panel');
    const wrap    = document.querySelector('.page-wrap');
    const waiting = document.getElementById('cmp-waiting');
    const svg     = document.getElementById('cmp-svg');
    const legend  = document.getElementById('cmp-legend');

    const totalSize = _refSel.size + _neuronSel.size;

    if (totalSize === 0) {
      panel.style.display = 'none';
      if (wrap) wrap.style.paddingBottom = '';
      return;
    }

    panel.style.display = 'block';
    document.getElementById('cmp-count').textContent =
      `${totalSize} row${totalSize > 1 ? 's' : ''} selected`;

    // Build legend when rows from both sources are present
    const hasBoth = _refSel.size > 0 && _neuronSel.size > 0;
    if (hasBoth) {
      legend.style.display = 'flex';
      legend.innerHTML =
        `<span style="display:flex;align-items:center;gap:5px;">` +
          `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${GPU_BAR_COLOR('H100 SXM 80GB')};opacity:0.85;"></span>` +
          `<span style="color:#888;">Reference (NVIDIA)</span>` +
        `</span>` +
        `<span style="display:flex;align-items:center;gap:5px;">` +
          `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${NEURON_BAR_COLOR('H100 SXM 80GB')};opacity:0.85;"></span>` +
          `<span style="color:#888;">Neuron (KISTI)</span>` +
        `</span>`;
    } else {
      legend.style.display = 'none';
    }

    if (totalSize === 1) {
      // Waiting state
      svg.style.display     = 'none';
      waiting.style.display = 'block';
      const isNeuron = _neuronSel.size === 1;
      const row      = isNeuron ? [..._neuronSel.values()][0] : [..._refSel.values()][0];
      const model    = row.model.replace('-Instruct', '').trim();
      const color    = isNeuron ? NEURON_BAR_COLOR(row.gpu) : GPU_BAR_COLOR(row.gpu);
      const src      = isNeuron ? '[N]' : '[R]';
      document.getElementById('cmp-waiting-row').textContent =
        `${src}  ${row.gpu}  ·  ${model}  ·  ${row.precision}  ·  TP${row.tp}  ·  ${row.isl}×${row.osl}  ·  ${Math.round(row.throughput).toLocaleString()} tok/s`;
      document.getElementById('cmp-waiting-bar').style.background = color;
    } else {
      waiting.style.display = 'none';
      svg.style.display     = 'block';
      // Tag each row with its source before merging
      const refRows    = [..._refSel.values()].map(r => ({ ...r, _source: 'ref'    }));
      const neuronRows = [..._neuronSel.values()].map(r => ({ ...r, _source: 'neuron' }));
      drawCompareSVG([...refRows, ...neuronRows]);
    }

    requestAnimationFrame(() => {
      if (wrap) wrap.style.paddingBottom = (panel.offsetHeight + 12) + 'px';
    });
  };

  function drawCompareSVG(rows) {
    const svg = document.getElementById('cmp-svg');

    // Option A: group by (gpu, model, precision, tp, isl, osl), rank groups by max
    // throughput desc, neuron before ref within each group.
    const groupKey = r => `${r.gpu}|${r.model}|${r.precision}|${r.tp}|${r.isl}|${r.osl}`;
    const groupMap = {};
    rows.forEach(r => {
      const k = groupKey(r);
      if (!groupMap[k]) groupMap[k] = [];
      groupMap[k].push(r);
    });
    rows = Object.values(groupMap)
      .sort((a, b) => Math.max(...b.map(r => r.throughput)) - Math.max(...a.map(r => r.throughput)))
      .flatMap(members => members.sort((a, b) => a._source === 'neuron' ? -1 : 1));

    const BAR_H   = 26;
    const GAP     = 8;
    const PAD_Y   = 2;
    // Fixed column positions: [N/R badge] [muted label ···] [bold precision] [bar] [value]
    const PREC_X  = 310;  // fixed x for precision tag — always column-aligned
    const BAR_X   = 370;  // bar always starts here regardless of bar length
    const VAL_W   = 100;
    const n       = rows.length;
    const totalH  = PAD_Y * 2 + n * (BAR_H + GAP) - GAP;

    svg.style.height = totalH + 'px';

    requestAnimationFrame(() => {
      const W        = svg.getBoundingClientRect().width || 900;
      const BAR_AREA = Math.max(100, W - BAR_X - VAL_W - 16);
      const maxTput  = rows[0].throughput;

      svg.setAttribute('viewBox', `0 0 ${W} ${totalH}`);
      svg.setAttribute('width',  W);
      svg.setAttribute('height', totalH);

      svg.innerHTML = rows.map((r, i) => {
        const y      = PAD_Y + i * (BAR_H + GAP);
        const cy     = y + BAR_H * 0.5;
        const barW   = Math.max(2, Math.round(r.throughput / maxTput * BAR_AREA));
        const color  = r._source === 'neuron' ? NEURON_BAR_COLOR(r.gpu) : GPU_BAR_COLOR(r.gpu);
        const badge  = r._source === 'neuron' ? 'N' : 'R';
        const pct    = maxTput > 0 ? ((r.throughput / maxTput) * 100).toFixed(1) : '—';
        const model  = r.model.replace('-Instruct', '').trim();
        const label  = `${r.gpu} · ${model} · TP${r.tp} · ${r.isl}×${r.osl}`;

        return `
          <rect x="8" y="${y + 5}" width="16" height="16" rx="3"
            fill="${color}" opacity="0.25"/>
          <text x="16" y="${cy}" text-anchor="middle" dominant-baseline="central"
            fill="${color}" font-size="10" font-weight="700"
            font-family="Helvetica Neue,Arial,sans-serif">${badge}</text>
          <text x="30" y="${cy}" dominant-baseline="central"
            fill="#888" font-size="12"
            font-family="Helvetica Neue,Arial,sans-serif">${label}</text>
          <text x="${PREC_X}" y="${cy}" dominant-baseline="central"
            fill="#e0e0e0" font-size="12" font-weight="700"
            font-family="Helvetica Neue,Arial,sans-serif">${r.precision}</text>
          <rect x="${BAR_X}" y="${y + 2}" width="${barW}" height="${BAR_H - 4}"
            fill="${color}" rx="3" opacity="0.82"/>
          <text x="${BAR_X + barW + 8}" y="${cy}" dominant-baseline="central"
            fill="#e0e0e0" font-size="13" font-weight="600"
            font-family="Helvetica Neue,Arial,sans-serif"
            font-variant-numeric="tabular-nums">${Math.round(r.throughput).toLocaleString()} <tspan fill="#888" font-weight="400">(${pct}%)</tspan></text>`;
      }).join('');
    });
  }
