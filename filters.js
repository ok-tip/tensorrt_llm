function exportCSV() {
    const headers = ["GPU","Model","Precision","PP","TP","ISL","OSL","Requests","Throughput","Version"];
    const visibleRows = Array.from(document.querySelectorAll("#tbody tr")).map(tr => {
      const cells = tr.querySelectorAll("td");
      return [...cells].map(td => `"${td.innerText.replace(/▲\s*/,'').trim()}"`).join(",");
    });

    const csv = [headers.join(","), ...visibleRows].join("\n");

    // Build filename from active filters
    const parts = ["benchmarks"];
    const fGpu = get("f-gpu"), fModel = get("f-model"), fQuant = get("f-quant"), fTp = get("f-tp");
    if (fGpu    !== "all") parts.push(fGpu.replace(/\s+/g,"_"));
    if (fModel  !== "all") parts.push(fModel);
    if (fQuant  !== "all") parts.push(fQuant.replace(/[\s()]+/g,"_"));
    if (fTp     !== "all") parts.push(`TP${fTp}`);
    const filename = parts.join("_") + ".csv";

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportNeuronCSV() {
    const headers = ["GPU","Model","Precision","PP","TP","ISL","OSL","Requests","Throughput","Version"];
    const visibleRows = Array.from(document.querySelectorAll("#ntbody tr")).map(tr => {
      const cells = tr.querySelectorAll("td");
      return [...cells].slice(0, 10).map(td => `"${td.innerText.replace(/▲\s*/,'').trim()}"`).join(",");
    });
    const csv = [headers.join(","), ...visibleRows].join("\n");
    const parts = ["neuron_benchmarks"];
    const fGpu = document.getElementById("nf-gpu").value;
    const fModel = document.getElementById("nf-model").value;
    const fQuant = document.getElementById("nf-quant").value;
    const fTp = document.getElementById("nf-tp").value;
    if (fGpu   !== "all") parts.push(fGpu.replace(/\s+/g,"_"));
    if (fModel !== "all") parts.push(fModel);
    if (fQuant !== "all") parts.push(fQuant.replace(/[\s()]+/g,"_"));
    if (fTp    !== "all") parts.push(`TP${fTp}`);
    const filename = parts.join("_") + ".csv";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function filterChanged(sel) {
    render();
  }

  function toggleLegend(id, btn) {
    const body = document.getElementById(id);
    const open = btn.getAttribute('aria-expanded') === 'true';
    body.style.display = open ? 'none' : 'block';
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    btn.textContent = (open ? '▸' : '▾') + ' Legend';
  }

  function switchTab(name, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    btn.classList.add('active');
    requestAnimationFrame(() => {
      if (name === 'neuron')  syncFiltersToTable('neuron-filters', 'neuron-table');
      if (name === 'results') syncFiltersToTable('ref-filters',    'ref-table');
    });
    // Hide compare panel only on non-data tabs (Release Notes, Methods)
    if (name !== 'neuron' && name !== 'results') {
      document.getElementById('compare-panel').style.display = 'none';
      const wrap = document.querySelector('.page-wrap');
      if (wrap) wrap.style.paddingBottom = '';
    } else {
      updateComparePanel();
    }
  }

  function setRefZoom(val) {
    document.documentElement.style.setProperty('--ref-font', val + 'px');
    document.getElementById('zoom-val').textContent = val + 'px';
  }

  function setNeuronZoom(val) {
    document.documentElement.style.setProperty('--neuron-font', val + 'px');
    document.getElementById('neuron-zoom-val').textContent = val + 'px';
  }

  const FILTER_KEYS = [
    { id: "f-gpu",     key: "gpu"        },
    { id: "f-model",   key: "model"      },
    { id: "f-quant",   key: "precision"  },
    { id: "f-pp",      key: "pp"         },
    { id: "f-tp",      key: "tp"         },
    { id: "f-isl",     key: "isl"          },
    { id: "f-osl",     key: "osl"          },
    { id: "f-numreq",  key: "num_requests" },
  ];

  const GPU_ORDER       = ["V100 PCIE 32GB", "A100 SXM 80GB", "H100 SXM 80GB", "H200 SXM 141GB", "GH200 96GB", "B200 180GB", "GB200 196GB"];
  const NEURON_ARCH_ORDER    = ['V100','A30','A100','A800','H100','H800','H200','GH200','B100','B200','GB200'];
  const NEURON_VARIANT_ORDER = ['pcie','nvlink','sxm','smx','nvl','hgx'];
  const MODEL_ORDER      = ["Llama-3.1-8B-Instruct", "Llama-3.1-70B-Instruct", "Llama-3.1-405B-Instruct", "Llama-3.3-70B-Instruct", "Llama-3.3-405B-Instruct"];
  const PRECISION_ORDER  = ["FP16", "FP8", "NVFP4"];
  const NEURON_FILTER_KEYS = [
    { id: "nf-gpu",     key: "gpu"          },
    { id: "nf-model",   key: "model"        },
    { id: "nf-quant",   key: "precision"    },
    { id: "nf-pp",      key: "pp"           },
    { id: "nf-tp",      key: "tp"           },
    { id: "nf-isl",     key: "isl"          },
    { id: "nf-osl",     key: "osl"          },
    { id: "nf-numreq",  key: "num_requests" },
  ];
  let nSortKey = "throughput", nSortDir = -1;
  // ── Dynamic bar-color functions ─────────────────────────────────────────
  // Colors are interpolated from the GPU's rank in NEURON_ARCH_ORDER so that
  // any future GPU added to that list automatically gets the correct shade.
  // Both functions share the same rank logic; only the color ramp differs.

  function _gpuArchRank(name) {
    const up = name.toUpperCase();
    const idx = NEURON_ARCH_ORDER.findIndex(arch => up.includes(arch));
    return idx === -1 ? 0 : idx;
  }

  function _lerpRGB(r0,g0,b0, r1,g1,b1, t) {
    const r = Math.round(r0 + (r1-r0)*t);
    const g = Math.round(g0 + (g1-g0)*t);
    const b = Math.round(b0 + (b1-b0)*t);
    return `rgb(${r},${g},${b})`;
  }

  // Green ramp: muted green (#277a2a) → bright lime (#a3e635)
  function GPU_BAR_COLOR(gpuName) {
    const t = _gpuArchRank(gpuName) / (NEURON_ARCH_ORDER.length - 1);
    return _lerpRGB(39,122,42, 163,230,53, t);
  }

  // Blue ramp: muted steel (#1a6496) → bright sky (#7dd8fc)
  function NEURON_BAR_COLOR(gpuName) {
    const t = _gpuArchRank(gpuName) / (NEURON_ARCH_ORDER.length - 1);
    return _lerpRGB(26,100,150, 125,216,252, t);
  }

  function gpuSort(a, b) {
    const ai = GPU_ORDER.indexOf(String(a));
    const bi = GPU_ORDER.indexOf(String(b));
    if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }

  // Neuron-tab GPU sort: weak → strong, PCIe before SXM within same architecture.
  // Works for any GPU name, not just ones in GPU_ORDER.

  function neuronGpuSort(a, b) {
    const sa = String(a), sb = String(b);
    // Try explicit list first (both must be in it to use it)
    const ai = GPU_ORDER.indexOf(sa), bi = GPU_ORDER.indexOf(sb);
    if (ai !== -1 && bi !== -1) return ai - bi;

    // Parse architecture generation
    const archOf = name => {
      const up = name.toUpperCase();
      const idx = NEURON_ARCH_ORDER.findIndex(arch => up.includes(arch));
      return idx === -1 ? 999 : idx;
    };
    // Parse interconnect variant (PCIe weakest → SXM/SMX → NVL/HGX)
    const variantOf = name => {
      const lo = name.toLowerCase();
      const idx = NEURON_VARIANT_ORDER.findIndex(v => lo.includes(v));
      return idx === -1 ? 999 : idx;
    };

    const archDiff = archOf(sa) - archOf(sb);
    if (archDiff !== 0) return archDiff;
    const varDiff  = variantOf(sa) - variantOf(sb);
    if (varDiff !== 0) return varDiff;
    return sa.localeCompare(sb);
  }

  function modelSort(a, b) {
    const ai = MODEL_ORDER.indexOf(String(a));
    const bi = MODEL_ORDER.indexOf(String(b));
    if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }

  function precisionSort(a, b) {
    const ai = PRECISION_ORDER.indexOf(String(a));
    const bi = PRECISION_ORDER.indexOf(String(b));
    if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }

  // ── localStorage persistence ────────────────────────────────────────────
  const LS_KEY_DATA   = 'trtllm_DATA';
  const LS_KEY_NEURON = 'trtllm_NEURON_DATA';

  function saveToLocalStorage() {
    try {
      localStorage.setItem(LS_KEY_DATA,   JSON.stringify(DATA));
      localStorage.setItem(LS_KEY_NEURON, JSON.stringify(NEURON_DATA));
      updateLsBadge();
    } catch(e) { console.warn('localStorage save failed:', e); }
  }

  function loadFromLocalStorage() {
    try {
      const d = localStorage.getItem(LS_KEY_DATA);
      const n = localStorage.getItem(LS_KEY_NEURON);
      if (d) { DATA.length = 0; JSON.parse(d).forEach(r => DATA.push(r)); }
      if (n) { NEURON_DATA.length = 0; JSON.parse(n).forEach(r => NEURON_DATA.push(r)); }
      return !!(d || n);
    } catch(e) { console.warn('localStorage load failed:', e); return false; }
  }

  function resetLocalStorage() {
    if (!confirm('Clear all local edits and reload data from nvidia.json / kisti.json?\nThis cannot be undone.')) return;
    localStorage.removeItem(LS_KEY_DATA);
    localStorage.removeItem(LS_KEY_NEURON);
    location.reload();
  }

  function updateLsBadge() {
    const hasLocal = !!(localStorage.getItem(LS_KEY_DATA) || localStorage.getItem(LS_KEY_NEURON));
    const badge  = document.getElementById('ls-badge');
    const resetB = document.getElementById('ls-reset-btn');
    if (badge)  badge.style.display  = hasLocal ? 'inline' : 'none';
    if (resetB) resetB.style.display = hasLocal ? 'inline' : 'none';
  }

  function islxoslSort(a, b) {
    const [ai, ao] = String(a).split(' × ').map(Number);
    const [bi, bo] = String(b).split(' × ').map(Number);
    return ai !== bi ? ai - bi : ao - bo;
  }

  function getFilteredExcluding(excludeKey) {
    return DATA.filter(d =>
      FILTER_KEYS.every(({ id, key }) => {
        if (key === excludeKey) return true;
        const val = document.getElementById(id).value;
        return val === "all" || String(d[key]) === val;
      })
    );
  }

  function refreshDropdowns() {
    FILTER_KEYS.forEach(({ id, key }) => {
      const sel = document.getElementById(id);
      const current = sel.value;
      const available = [...new Set(
        getFilteredExcluding(key).map(d => d[key])
      )].sort(key === "gpu" ? gpuSort : key === "model" ? modelSort : key === "precision" ? precisionSort : key === "islxosl" ? islxoslSort : (a, b) => typeof a === "number" ? a - b : String(a).localeCompare(String(b)));

      sel.innerHTML = `<option value="all">All</option>`;
      available.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        if (String(v) === current) opt.selected = true;
        sel.appendChild(opt);
      });
      // If previous selection no longer valid, reset to All
      if (current !== "all" && !available.map(String).includes(current)) {
        sel.value = "all";
      }
      // Auto-select if only one option available
      if (available.length === 1) {
        sel.value = String(available[0]);
      }
    });
  }

  let sortKey = "throughput", sortDir = -1;

  function sort(key) {
    sortDir = (sortKey === key) ? -sortDir : -1;
    sortKey = key;
    render();
  }

  function resetFilters() {
    FILTER_KEYS.forEach(({ id }) => document.getElementById(id).value = "all");
    render();
  }

  function get(id) { return document.getElementById(id).value; }

  function syncFiltersToTable(filtersId, tableId) {
    const filterBar = document.getElementById(filtersId);
    const tbl = document.getElementById(tableId);
    if (!filterBar || !tbl) return;
    const ths = tbl.querySelectorAll('thead th');
    const groups = filterBar.querySelectorAll('.filter-group');
    groups.forEach((g, i) => {
      const th = ths[i];
      if (th) { g.style.flex = 'none'; g.style.width = th.offsetWidth + 'px'; }
    });
  }

  function render() {
    refreshDropdowns();
    const fGpu    = get("f-gpu"),    fModel    = get("f-model"),
          fQuant  = get("f-quant"),  fPp       = get("f-pp"),
          fTp     = get("f-tp"),     fIsl      = get("f-isl"),
          fOsl    = get("f-osl"),    fNumreq   = get("f-numreq");

    let rows = DATA.filter(d =>
      (fGpu      === "all" || d.gpu             === fGpu)      &&
      (fModel    === "all" || d.model           === fModel)    &&
      (fQuant    === "all" || d.precision       === fQuant)    &&
      (fPp       === "all" || String(d.pp)      === fPp)       &&
      (fTp       === "all" || String(d.tp)      === fTp)       &&
      (fIsl      === "all" || String(d.isl)        === fIsl)      &&
      (fOsl      === "all" || String(d.osl)        === fOsl)      &&
      (fNumreq   === "all" || String(d.num_requests) === fNumreq)
    );

    rows.sort((a, b) => {
      if (sortKey === "throughput") {
        // Always maintain block order; only sort by throughput within each block
        const aKey = `${a.gpu}|${a.model}|${a.precision}|${a.tp}`;
        const bKey = `${b.gpu}|${b.model}|${b.precision}|${b.tp}`;
        if (aKey !== bKey) {
          const gi = GPU_ORDER.indexOf(a.gpu) - GPU_ORDER.indexOf(b.gpu);
          if (gi !== 0) return gi;
          const mi = MODEL_ORDER.indexOf(a.model) - MODEL_ORDER.indexOf(b.model);
          if (mi !== 0) return mi;
          const pi = PRECISION_ORDER.indexOf(a.precision) - PRECISION_ORDER.indexOf(b.precision);
          if (pi !== 0) return pi;
          return a.tp - b.tp;
        }
        return (a.throughput - b.throughput) * sortDir;
      }
      // For all other columns: global sort
      const av = a[sortKey], bv = b[sortKey];
      return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sortDir;
    });

    // Update sort indicators
    document.querySelectorAll("#ref-table th").forEach((th, i) => {
      th.classList.remove("sorted");
      const arrow = th.querySelector(".arrow");
      if (arrow) arrow.textContent = "↕";
    });
    document.querySelectorAll("#ref-table th").forEach(th => {
      if (th.dataset.sortKey === sortKey) {
        th.classList.add("sorted");
        th.querySelector(".arrow").textContent = sortDir === 1 ? "↑" : "↓";
      }
    });

    // Per (gpu, model, precision, tp) block max and count
    const blockMax   = {};
    const blockCount = {};
    rows.forEach(r => {
      const key = `${r.gpu}|${r.model}|${r.precision}|${r.tp}`;
      if (!blockMax[key] || r.throughput > blockMax[key]) blockMax[key] = r.throughput;
      blockCount[key] = (blockCount[key] || 0) + 1;
    });

    // Always show bars — normalized within each (gpu, model, precision, tp) block
    const filterActive = true;

    const nGpus       = new Set(rows.map(r => r.gpu)).size;
    const nModels     = new Set(rows.map(r => r.model)).size;
    const nPrecisions = new Set(rows.map(r => r.precision)).size;
    const nPairs      = new Set(rows.map(r => r.islxosl)).size;
    document.getElementById("count").innerHTML =
      `<div class="count-box count-box-1">${nGpus}<span>GPU${nGpus !== 1 ? 's' : ''}</span></div>` +
      `<span class="count-sep">›</span>` +
      `<div class="count-box count-box-2">${nModels}<span>Model${nModels !== 1 ? 's' : ''}</span></div>` +
      `<span class="count-sep">›</span>` +
      `<div class="count-box count-box-3">${nPrecisions}<span>Precision${nPrecisions !== 1 ? 's' : ''}</span></div>` +
      `<span class="count-sep">›</span>` +
      `<div class="count-box count-box-4">${nPairs}<span>ISL×OSL pair${nPairs !== 1 ? 's' : ''}</span></div>`;

    document.getElementById("tbody").innerHTML = rows.length ? rows.map((r, i) => {
      const rkey     = rowKey(r);
      _refCache[rkey] = r;
      const blockKey   = `${r.gpu}|${r.model}|${r.precision}|${r.tp}`;
      const barWidth   = Math.round(r.throughput / blockMax[blockKey] * 120);
      const isPeak     = r.throughput === blockMax[blockKey];
      const showBar    = blockCount[blockKey] > 1;
      const peakColor  = GPU_BAR_COLOR(r.gpu);
      const showPeak   = isPeak && showBar;
      const prev = rows[i - 1];
      const sepClass = i === 0 ? '' :
        prev.gpu   !== r.gpu   ? 'sep-gpu'   :
        prev.model !== r.model || prev.precision !== r.precision ? 'sep-model' :
        prev.tp    !== r.tp    ? 'sep-tp'    : '';
      return `
      <tr class="${sepClass}${_refSel.has(rkey) ? ' row-selected' : ''}" data-rkey="${rkey}">
        <td>${r.gpu}</td>
        <td><span class="tag">${r.model}</span></td>
        <td><span class="tag">${r.precision}</span></td>
        <td>${r.pp}</td>
        <td>${r.tp}</td>
        <td>${r.isl.toLocaleString()}</td>
        <td>${r.osl.toLocaleString()}</td>
        <td>${typeof r.num_requests === 'number' ? r.num_requests.toLocaleString() : r.num_requests}</td>
        <td>
          <div class="bar-wrap">
            <span class="num"   style="${showPeak ? `color:#e0e0e0; font-weight:600;` : ''}">${Math.round(r.throughput).toLocaleString()}</span>
            ${showBar ? `<div class="bar" style="width:${barWidth}px; background:${GPU_BAR_COLOR(r.gpu)}" title="Best at TP${r.tp}: ${Math.round(blockMax[blockKey]).toLocaleString()}"></div>` : ''}
          </div>
        </td>
        <td><span class="ver">${r.version}</span></td>
        <td class="edit-col"><button class="row-edit-btn" title="Edit this row" onclick="event.stopPropagation();openRowEdit('ref','${rkey}')">✎</button><button class="row-dup-btn" title="Duplicate this row" onclick="event.stopPropagation();duplicateRow('ref','${rkey}')">⧉</button><button class="row-del-btn" title="Delete this row" onclick="event.stopPropagation();deleteRow('ref','${rkey}')">✕</button></td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="11" class="empty">No results match the selected filters.</td></tr>`;

    // Autospan: sync filter-group widths to th widths after DOM update
    requestAnimationFrame(() => syncFiltersToTable('ref-filters', 'ref-table'));
  }

  // ── Neuron (KISTI) tab ──────────────────────────────────────────────────

  function neuronSort(key) {
    nSortDir = (nSortKey === key) ? -nSortDir : -1;
    nSortKey = key;
    renderNeuron();
  }

  function resetNeuronFilters() {
    NEURON_FILTER_KEYS.forEach(({ id }) => document.getElementById(id).value = "all");
    renderNeuron();
  }

  function neuronFilterChanged(sel) {
    renderNeuron();
  }

  function getNeuronFiltered(excludeKey) {
    return NEURON_DATA.filter(d =>
      NEURON_FILTER_KEYS.every(({ id, key }) => {
        if (key === excludeKey) return true;
        const val = document.getElementById(id).value;
        return val === "all" || String(d[key]) === val;
      })
    );
  }

  function refreshNeuronDropdowns() {
    NEURON_FILTER_KEYS.forEach(({ id, key }) => {
      const sel = document.getElementById(id);
      const current = sel.value;
      const available = [...new Set(getNeuronFiltered(key).map(d => d[key]))]
        .sort(key === "gpu" ? neuronGpuSort : key === "model" ? modelSort : key === "precision" ? precisionSort : (a, b) => typeof a === "number" ? a - b : String(a).localeCompare(String(b)));
      sel.innerHTML = `<option value="all">All</option>`;
      available.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v; opt.textContent = v;
        if (String(v) === current) opt.selected = true;
        sel.appendChild(opt);
      });
      if (current !== "all" && !available.map(String).includes(current)) sel.value = "all";
      if (available.length === 1) sel.value = String(available[0]);
    });
  }

  function renderNeuron() {
    refreshNeuronDropdowns();
    const fIsl = document.getElementById("nf-isl").value;
    const fOsl = document.getElementById("nf-osl").value;
    let rows = NEURON_DATA.filter(d =>
      NEURON_FILTER_KEYS.every(({ id, key }) => {
        const val = document.getElementById(id).value;
        return val === "all" || String(d[key]) === val;
      })
    );

    rows.sort((a, b) => {
      if (nSortKey === "throughput") {
        const aKey = `${a.gpu}|${a.model}|${a.precision}|${a.tp}`;
        const bKey = `${b.gpu}|${b.model}|${b.precision}|${b.tp}`;
        if (aKey !== bKey) {
          const gi = neuronGpuSort(a.gpu, b.gpu);
          if (gi !== 0) return gi;
          const mi = MODEL_ORDER.indexOf(a.model) - MODEL_ORDER.indexOf(b.model);
          if (mi !== 0) return mi;
          const pi = PRECISION_ORDER.indexOf(a.precision) - PRECISION_ORDER.indexOf(b.precision);
          if (pi !== 0) return pi;
          return a.tp - b.tp;
        }
        return (a.throughput - b.throughput) * nSortDir;
      }
      if (nSortKey === "gpu") return neuronGpuSort(a.gpu, b.gpu) * nSortDir;
      const av = a[nSortKey], bv = b[nSortKey];
      return (typeof av === "number" ? av - bv : String(av).localeCompare(String(bv))) * nSortDir;
    });

    // Update sort arrows
    document.querySelectorAll("#tab-neuron th").forEach(th => {
      th.classList.remove("sorted");
      const arrow = th.querySelector(".arrow");
      if (arrow) arrow.textContent = "\u2195";
    });
    document.querySelectorAll("#tab-neuron th").forEach(th => {
      if (th.dataset.sortKey === nSortKey) {
        th.classList.add("sorted");
        const arrow = th.querySelector(".arrow");
        if (arrow) arrow.textContent = nSortDir === 1 ? "\u2191" : "\u2193";
      }
    });

    // Count boxes
    const nGpus       = new Set(rows.map(r => r.gpu)).size;
    const nModels     = new Set(rows.map(r => r.model)).size;
    const nPrecisions = new Set(rows.map(r => r.precision)).size;
    const nPairs      = new Set(rows.map(r => r.islxosl)).size;
    document.getElementById("ncount").innerHTML =
      `<div class="count-box count-box-n1">${nGpus}<span>GPU${nGpus !== 1 ? "s" : ""}</span></div>` +
      `<span class="count-sep count-sep-n">\u203a</span>` +
      `<div class="count-box count-box-n2">${nModels}<span>Model${nModels !== 1 ? "s" : ""}</span></div>` +
      `<span class="count-sep count-sep-n">\u203a</span>` +
      `<div class="count-box count-box-n3">${nPrecisions}<span>Precision${nPrecisions !== 1 ? "s" : ""}</span></div>` +
      `<span class="count-sep count-sep-n">\u203a</span>` +
      `<div class="count-box count-box-n4">${nPairs}<span>ISL\u00d7OSL pair${nPairs !== 1 ? "s" : ""}</span></div>`;

    // Per-block max for bars
    const blockMax = {}, blockCount = {};
    rows.forEach(r => {
      const key = `${r.gpu}|${r.model}|${r.precision}|${r.tp}`;
      if (!blockMax[key] || r.throughput > blockMax[key]) blockMax[key] = r.throughput;
      blockCount[key] = (blockCount[key] || 0) + 1;
    });

    document.getElementById("ntbody").innerHTML = rows.length ? rows.map((r, i) => {
      const rkey      = rowKey(r);
      _neuronCache[rkey] = r;
      const blockKey  = `${r.gpu}|${r.model}|${r.precision}|${r.tp}`;
      const barWidth  = Math.round(r.throughput / blockMax[blockKey] * 120);
      const isPeak    = r.throughput === blockMax[blockKey];
      const showBar   = blockCount[blockKey] > 1;
      const peakColor = NEURON_BAR_COLOR(r.gpu);
      const showPeak  = isPeak && showBar;
      const prev = rows[i - 1];
      const sepClass = i === 0 ? "" :
        prev.gpu   !== r.gpu   ? "sep-gpu"   :
        prev.model !== r.model || prev.precision !== r.precision ? "sep-model" :
        prev.tp    !== r.tp    ? "sep-tp"    : "";
      return `
      <tr class="${sepClass}${_neuronSel.has(rkey) ? ' row-selected' : ''}" data-rkey="${rkey}">
        <td>${r.gpu}</td>
        <td><span class="tag">${r.model}</span></td>
        <td><span class="tag">${r.precision}</span></td>
        <td>${r.pp}</td>
        <td>${r.tp}</td>
        <td>${r.isl.toLocaleString()}</td>
        <td>${r.osl.toLocaleString()}</td>
        <td>${typeof r.num_requests === "number" ? r.num_requests.toLocaleString() : r.num_requests}</td>
        <td>
          <div class="bar-wrap">
            <span class="num"   style="${showPeak ? `color:#e0e0e0; font-weight:600;` : ""}">${Math.round(r.throughput).toLocaleString()}</span>
            ${showBar ? `<div class="bar" style="width:${barWidth}px; background:${peakColor}" title="Best at TP${r.tp}: ${Math.round(blockMax[blockKey]).toLocaleString()}"></div>` : ""}
          </div>
        </td>
        <td><span class="ver">${r.version}</span></td>
        <td class="edit-col"><button class="row-edit-btn" title="Edit this row" onclick="event.stopPropagation();openRowEdit('neuron','${rkey}')">✎</button><button class="row-dup-btn" title="Duplicate this row" onclick="event.stopPropagation();duplicateRow('neuron','${rkey}')">⧉</button><button class="row-del-btn" title="Delete this row" onclick="event.stopPropagation();deleteRow('neuron','${rkey}')">✕</button></td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="11" class="empty">No results match the selected filters.</td></tr>`;

    requestAnimationFrame(() => syncFiltersToTable('neuron-filters', 'neuron-table'));
  }

  window.addEventListener('resize', () => {
    syncFiltersToTable('ref-filters', 'ref-table');
    syncFiltersToTable('neuron-filters', 'neuron-table');
    const ctx = activeContext();
    const sel = ctx === 'neuron' ? _neuronSel : _refSel;
    if (sel.size >= 2) drawCompareSVG([...sel.values()]);
  });

// startApp is called by the fetch bootstrap once both JSON files are loaded
function startApp() {
  DATA.forEach(d => { if (!d.islxosl) d.islxosl = d.isl + ' \u00d7 ' + d.osl; });
  NEURON_DATA.forEach(d => { if (!d.islxosl) d.islxosl = d.isl + ' \u00d7 ' + d.osl; });
  loadFromLocalStorage();
  initCompare();
  render();
  renderNeuron();
  updateLsBadge();
}
