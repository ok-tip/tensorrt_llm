let _editContext      = 'ref';
  let _editData         = [];
  let _pendingCount     = 0;
  let _isDirectEditMode = false;
  let _directEditRow    = null;

  // Text fields that get datalist suggestions from existing data
  const ADD_TEXT_FIELDS = [
    { id: 'e-gpu',   dl: 'dl-gpu',   key: 'gpu'          },
    { id: 'e-model', dl: 'dl-model', key: 'model'        },
    { id: 'e-prec',  dl: 'dl-prec',  key: 'precision'    },
    { id: 'e-ver',   dl: 'dl-ver',   key: 'version'      },
    { id: 'e-pp',    dl: 'dl-pp',    key: 'pp'           },
    { id: 'e-tp',    dl: 'dl-tp',    key: 'tp'           },
    { id: 'e-isl',   dl: 'dl-isl',   key: 'isl'          },
    { id: 'e-osl',   dl: 'dl-osl',   key: 'osl'          },
    { id: 'e-req',   dl: 'dl-req',   key: 'num_requests' },
  ];
  const ADD_NUM_IDS = ['e-pp','e-tp','e-isl','e-osl','e-req','e-tput'];

  function populateDataLists() {
    ADD_TEXT_FIELDS.forEach(f => {
      const dl = document.getElementById(f.dl);
      if (!dl) return;
      const vals = [...new Set(_editData.map(r => String(r[f.key])))].sort();
      dl.innerHTML = vals.map(v => `<option value="${v}"></option>`).join('');
    });
  }

  function enterDirectEditMode(row) {
    _isDirectEditMode = true;
    document.getElementById('cascade-section').style.display     = 'none';
    document.getElementById('direct-edit-section').style.display = 'block';
    document.getElementById('modal-subtitle').textContent = 'All fields are editable. Apply replaces the original row.';
    document.getElementById('modal-subtitle').style.color = _editContext === 'neuron' ? '#38bdf8' : '#88cc35';
    const banner = document.getElementById('direct-edit-banner');
    if (_editContext === 'neuron') {
      banner.style.background   = '#091e38';
      banner.style.borderColor  = '#1d6fa8';
      banner.style.color        = '#38bdf8';
    } else {
      banner.style.background   = '#1a2e0a';
      banner.style.borderColor  = '#3d7a18';
      banner.style.color        = '#88cc35';
    }
    document.getElementById('modal-error').style.display  = 'none';
    document.getElementById('de-gpu').value   = row.gpu;
    document.getElementById('de-model').value = row.model;
    document.getElementById('de-prec').value  = row.precision;
    document.getElementById('de-pp').value    = row.pp;
    document.getElementById('de-tp').value    = row.tp;
    document.getElementById('de-ver').value   = row.version;
    document.getElementById('de-isl').value   = row.isl;
    document.getElementById('de-osl').value   = row.osl;
    document.getElementById('de-req').value   = row.num_requests;
    document.getElementById('de-tput').value  = row.throughput;
    document.getElementById('de-gpu').focus();
  }

  function exitDirectEditMode() {
    _isDirectEditMode = false;
    _directEditRow    = null;
    document.getElementById('cascade-section').style.display     = 'block';
    document.getElementById('direct-edit-section').style.display = 'none';
    document.getElementById('modal-subtitle').textContent = 'Fill in all fields to add a new row. Text fields suggest existing values.';
    document.getElementById('modal-subtitle').style.color = '#666';
  }

  function openRowEdit(ctx, rkey) {
    const cache = ctx === 'ref' ? _refCache : _neuronCache;
    const row   = cache[rkey];
    if (!row) return;
    _directEditRow = row;
    _editContext   = ctx;
    _editData      = ctx === 'ref' ? DATA : NEURON_DATA;
    document.getElementById('modal-title').textContent =
      ctx === 'ref' ? 'Reference (NVIDIA) — edit row' : 'Neuron (KISTI) — edit row';
    document.getElementById('modal-error').style.display = 'none';
    _setModalAccent(ctx);
    enterDirectEditMode(row);
    document.getElementById('edit-modal').style.display = 'flex';
  }

  function deleteRow(ctx, rkey) {
    if (!confirm('Delete this row?')) return;
    const arr = ctx === 'ref' ? DATA : NEURON_DATA;
    const idx = arr.findIndex(r => rowKey(r) === rkey);
    if (idx < 0) return;
    arr.splice(idx, 1);
    (ctx === 'ref' ? _refSel : _neuronSel).delete(rkey);
    if (ctx === 'ref') render(); else renderNeuron();
    _pendingCount++;
    updateDownloadBtn();
    saveToLocalStorage();
    updateComparePanel();
  }

  function duplicateRow(ctx, rkey) {
    const cache = ctx === 'ref' ? _refCache : _neuronCache;
    const row   = cache[rkey];
    if (!row) return;
    openEditModal(ctx); // opens add modal, clears fields, populates datalists
    // Pre-fill all fields from the source row
    document.getElementById('e-gpu').value   = row.gpu;
    document.getElementById('e-model').value = row.model;
    document.getElementById('e-prec').value  = row.precision;
    document.getElementById('e-ver').value   = row.version;
    document.getElementById('e-pp').value    = row.pp;
    document.getElementById('e-tp').value    = row.tp;
    document.getElementById('e-isl').value   = row.isl;
    document.getElementById('e-osl').value   = row.osl;
    document.getElementById('e-req').value   = row.num_requests;
    document.getElementById('e-tput').value  = row.throughput;
    document.getElementById('modal-subtitle').textContent =
      'Duplicated from an existing row — adjust any field then click Apply.';
    document.getElementById('modal-subtitle').style.color = '#f5c400';
  }

  function applyDirectEdit() {
    const gpu  = document.getElementById('de-gpu').value.trim();
    const model= document.getElementById('de-model').value.trim();
    const prec = document.getElementById('de-prec').value.trim();
    const ver  = document.getElementById('de-ver').value.trim();
    const pp   = Number(document.getElementById('de-pp').value);
    const tp   = Number(document.getElementById('de-tp').value);
    const isl  = Number(document.getElementById('de-isl').value);
    const osl  = Number(document.getElementById('de-osl').value);
    const req  = Number(document.getElementById('de-req').value);
    const tput = parseFloat(document.getElementById('de-tput').value);
    if (!gpu || !model || !prec || !ver) { showError('GPU, Model, Precision and Version cannot be empty.'); return; }
    if ([pp, tp, isl, osl, req].some(v => isNaN(v) || v < 0)) { showError('PP, TP, ISL, OSL and Requests must be valid non-negative numbers.'); return; }
    if (isNaN(tput) || tput <= 0) { showError('Throughput must be a positive number.'); return; }
    document.getElementById('modal-error').style.display = 'none';
    const newRow = { gpu, model, precision: prec, pp, tp, isl, osl, islxosl: `${isl}x${osl}`, num_requests: req, throughput: tput, version: ver };
    const arr = _editContext === 'ref' ? DATA : NEURON_DATA;
    const idx = arr.findIndex(r => rowKey(r) === rowKey(_directEditRow));
    if (idx >= 0) arr[idx] = newRow; else arr.push(newRow);
    if (_editContext === 'ref') render(); else renderNeuron();
    _pendingCount++; updateDownloadBtn(); saveToLocalStorage();
    _directEditRow = newRow;
    const btn = document.getElementById('apply-btn');
    const accent = _editContext === 'neuron' ? '#38bdf8' : '#a3e635';
    btn.textContent = 'Applied ✓'; btn.style.background = accent;
    setTimeout(() => { btn.textContent = 'Apply'; btn.style.background = accent; }, 1200);
  }

  function _setModalAccent(ctx) {
    const color = ctx === 'neuron' ? '#38bdf8' : '#a3e635';
    document.getElementById('apply-btn').style.background = color;
    document.getElementById('edit-modal').style.setProperty('--modal-accent', color);
  }

  function openEditModal(ctx) {
    _editContext = ctx;
    _editData    = ctx === 'ref' ? DATA : NEURON_DATA;
    document.getElementById('modal-title').textContent =
      ctx === 'ref' ? 'Reference (NVIDIA) — add row' : 'Neuron (KISTI) — add row';
    document.getElementById('modal-error').style.display = 'none';
    _setModalAccent(ctx);
    exitDirectEditMode();
    resetModal();
    document.getElementById('edit-modal').style.display = 'flex';
  }

  function resetModal() {
    if (_isDirectEditMode) exitDirectEditMode();
    ADD_TEXT_FIELDS.forEach(f => { document.getElementById(f.id).value = ''; });
    ADD_NUM_IDS.forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('modal-error').style.display = 'none';
    populateDataLists();
  }

  function applyEdit() {
    if (_isDirectEditMode) { applyDirectEdit(); return; }
    const gpu  = document.getElementById('e-gpu').value.trim();
    const model= document.getElementById('e-model').value.trim();
    const prec = document.getElementById('e-prec').value.trim();
    const ver  = document.getElementById('e-ver').value.trim();
    const pp   = Number(document.getElementById('e-pp').value);
    const tp   = Number(document.getElementById('e-tp').value);
    const isl  = Number(document.getElementById('e-isl').value);
    const osl  = Number(document.getElementById('e-osl').value);
    const req  = Number(document.getElementById('e-req').value);
    const tput = parseFloat(document.getElementById('e-tput').value);
    if (!gpu || !model || !prec || !ver) { showError('GPU, Model, Precision and Version cannot be empty.'); return; }
    if ([pp, tp, isl, osl, req].some(v => isNaN(v) || v < 0)) { showError('PP, TP, ISL, OSL and Requests must be valid non-negative numbers.'); return; }
    if (isNaN(tput) || tput <= 0) { showError('Throughput must be a positive number.'); return; }
    document.getElementById('modal-error').style.display = 'none';
    const row = { gpu, model, precision: prec, pp, tp, isl, osl, islxosl: `${isl}x${osl}`, num_requests: req, throughput: tput, version: ver };
    ((_editContext === 'ref') ? DATA : NEURON_DATA).push(row);
    if (_editContext === 'ref') render(); else renderNeuron();
    _pendingCount++; updateDownloadBtn(); saveToLocalStorage();
    // Keep GPU, Model, Precision; clear the rest for the next entry
    ADD_NUM_IDS.forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('e-ver').value = ver; // keep version too
    const btn = document.getElementById('apply-btn');
    const accent = _editContext === 'neuron' ? '#38bdf8' : '#a3e635';
    btn.textContent = 'Added ✓'; btn.style.background = accent;
    setTimeout(() => { btn.textContent = 'Apply'; btn.style.background = accent; }, 1200);
  }

  function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
  }

  function showError(msg) {
    const el = document.getElementById('modal-error');
    el.textContent = msg; el.style.display = 'block';
  }

  function updateDownloadBtn() {
    ['ref','neuron'].forEach(ctx => {
      const btn   = document.getElementById(`dl-${ctx}`);
      const count = document.getElementById(`dl-${ctx}-count`);
      if (_pendingCount > 0) {
        btn.style.color       = '#f5c400';
        btn.style.borderColor = '#f5c400';
        count.textContent     = `(${_pendingCount})`;
      } else {
        btn.style.color       = '#888';
        btn.style.borderColor = '#444';
        count.textContent     = '';
      }
    });
    const modalSave    = document.getElementById('modal-save-btn');
    const modalPending = document.getElementById('modal-pending');
    if (modalSave) modalSave.style.display = _pendingCount > 0 ? 'inline-block' : 'none';
    if (modalPending) {
      if (_pendingCount > 0) {
        modalPending.textContent = `${_pendingCount} unsaved edit${_pendingCount > 1 ? 's' : ''}`;
        modalPending.style.display = 'inline';
      } else {
        modalPending.style.display = 'none';
      }
    }
  }

  function downloadDataJs() {
    function saveFile(filename, data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    saveFile('nvidia.json', DATA);
    saveFile('kisti.json',  NEURON_DATA);
    _pendingCount = 0;
    updateDownloadBtn();
    localStorage.removeItem(LS_KEY_DATA);
    localStorage.removeItem(LS_KEY_NEURON);
    updateLsBadge();
  }

  document.getElementById('edit-modal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
  });
