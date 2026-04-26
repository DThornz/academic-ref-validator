const DISPLAY_LABELS = { valid: 'Valid', warning: 'Needs Review' };

const STYLE_LABELS = {
  APA:       'APA 7th',
  Vancouver: 'Vancouver / ICMJE',
  IEEE:      'IEEE',
  MLA:       'MLA 9th',
  Chicago:   'Chicago 17th',
  Harvard:   'Harvard',
};

export function renderResults(results, detectedStyle = null) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<p>No references found or analyzed.</p>';
    return;
  }

  container.appendChild(buildSummary(results, detectedStyle));

  const indexed = results.map((r, i) => ({ ...r, origIdx: i }));
  const validItems  = indexed.filter(r => r.label === 'valid');
  const reviewItems = indexed.filter(r => r.label !== 'valid');

  const columns = document.createElement('div');
  columns.className = 'results-columns';
  columns.appendChild(buildColumn('valid',   'Valid',        validItems));
  columns.appendChild(buildColumn('warning', 'Needs Review', reviewItems));
  container.appendChild(columns);
}

function buildColumn(cls, title, items) {
  const col = document.createElement('div');
  col.className = 'results-column';
  col.id = `col-${cls}`;

  const header = document.createElement('div');
  header.className = `column-header ${cls}`;
  header.textContent = `${title} (${items.length})`;
  col.appendChild(header);

  const cards = document.createElement('div');
  cards.className = 'column-cards';

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'column-empty';
    empty.textContent = 'None';
    cards.appendChild(empty);
  } else {
    items.forEach(res => cards.appendChild(buildCard(res)));
  }

  col.appendChild(cards);
  return col;
}

function buildCard(res) {
  const card = document.createElement('div');
  card.className = `result-card ${res.label}`;

  const reasonsHtml = res.reasons.map(r => {
    const kind = typeof r === 'string' ? 'neutral' : (r.kind || 'neutral');
    const text = typeof r === 'string' ? r : r.text;
    return `<li class="${kind}">${escapeHTML(text)}</li>`;
  }).join('');

  const verifyLink = res.matchUrl
    ? `<a href="${escapeHTML(res.matchUrl)}" target="_blank" rel="noopener noreferrer" class="match-link">Verify source ↗</a>`
    : '';

  const overrideTarget  = res.label === 'valid' ? 'warning' : 'valid';
  const overrideBtnText = res.label === 'valid' ? 'Flag for Review' : 'Mark as Verified';

  card.innerHTML = `
    <div class="result-header">
      <span class="ref-num">[${res.origIdx + 1}]</span>
      <span class="label-badge">${DISPLAY_LABELS[res.label] ?? res.label}</span>
    </div>
    <div class="reference-text">${escapeHTML(res.raw)}</div>
    <ul class="reasons-list">${reasonsHtml}</ul>
    ${verifyLink}
    <button class="override-btn" data-from="${res.label}" data-to="${overrideTarget}">${overrideBtnText}</button>
  `;

  card.querySelector('.override-btn').addEventListener('click', function () {
    moveCard(card, this.dataset.from, this.dataset.to);
  });

  return card;
}

function moveCard(card, fromLabel, toLabel) {
  const toCol      = document.getElementById(`col-${toLabel}`);
  const toCards    = toCol.querySelector('.column-cards');
  const fromCards  = card.closest('.column-cards');

  // Remove "None" placeholder in target if present
  const emptyMsg = toCards.querySelector('.column-empty');
  if (emptyMsg) emptyMsg.remove();

  // Move the card
  toCards.appendChild(card);

  // Update card styling and badge
  card.classList.replace(fromLabel, toLabel);
  card.querySelector('.label-badge').textContent = DISPLAY_LABELS[toLabel] ?? toLabel;

  // Flip the override button for the next toggle
  const btn = card.querySelector('.override-btn');
  btn.dataset.from = toLabel;
  btn.dataset.to   = fromLabel;
  btn.textContent  = toLabel === 'valid' ? 'Flag for Review' : 'Mark as Verified';

  // Show "None" in source column if now empty
  if (!fromCards.querySelector('.result-card')) {
    const empty = document.createElement('p');
    empty.className = 'column-empty';
    empty.textContent = 'None';
    fromCards.appendChild(empty);
  }

  updateColumnCounts();
  updateSummary();
}

function updateColumnCounts() {
  [['valid', 'Valid'], ['warning', 'Needs Review']].forEach(([cls, title]) => {
    const col = document.getElementById(`col-${cls}`);
    if (!col) return;
    const count = col.querySelectorAll('.result-card').length;
    col.querySelector('.column-header').textContent = `${title} (${count})`;
  });
}

function updateSummary() {
  const validCount  = document.querySelectorAll('#col-valid .result-card').length;
  const reviewCount = document.querySelectorAll('#col-warning .result-card').length;
  const summaryCard = document.querySelector('.summary-card');
  if (!summaryCard) return;

  summaryCard.querySelectorAll('.summary-label').forEach(el => {
    if (el.classList.contains('valid'))   el.querySelector('.label-count').textContent = validCount;
    if (el.classList.contains('warning')) el.querySelector('.label-count').textContent = reviewCount;
  });

  summaryCard.querySelector('.summary-bar').innerHTML = [
    { key: 'valid',   count: validCount  },
    { key: 'warning', count: reviewCount }
  ].filter(s => s.count > 0)
   .map(s => `<div class="bar-segment ${s.key}" style="flex:${s.count}"></div>`)
   .join('');
}

function buildSummary(results, detectedStyle) {
  const validCount  = results.filter(r => r.label === 'valid').length;
  const reviewCount = results.length - validCount;
  const total       = results.length;

  const segments = [
    { key: 'valid',   count: validCount  },
    { key: 'warning', count: reviewCount },
  ].filter(s => s.count > 0)
   .map(s => `<div class="bar-segment ${s.key}" style="flex:${s.count}"></div>`)
   .join('');

  const labels = [
    { key: 'valid',   name: 'Valid',        count: validCount  },
    { key: 'warning', name: 'Needs Review', count: reviewCount },
  ].map(s => `
    <div class="summary-label ${s.key}">
      <span class="label-count">${s.count}</span>
      <span class="label-name">${s.name}</span>
    </div>
  `).join('');

  const styleLine = detectedStyle
    ? `<span class="style-badge">${escapeHTML(STYLE_LABELS[detectedStyle] ?? detectedStyle)}</span>`
    : '<span class="style-badge unknown">Style not recognised</span>';

  const summary = document.createElement('div');
  summary.className = 'summary-card';
  summary.innerHTML = `
    <div class="summary-header">
      <span class="summary-title">${total} reference${total === 1 ? '' : 's'} analyzed</span>
      ${styleLine}
    </div>
    <div class="summary-bar">${segments}</div>
    <div class="summary-labels">${labels}</div>
  `;
  return summary;
}

export function exportCSV(results) {
  if (!results || results.length === 0) return;
  const header = ['#', 'Label', 'Match URL', 'Reference', 'Reasons'];
  const rows = results.map((r, i) => {
    const reasons = r.reasons
      .map(r => (typeof r === 'string' ? r : r.text))
      .join(' | ');
    return [
      i + 1,
      r.label,
      r.matchUrl || '',
      `"${r.raw.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${reasons.replace(/"/g, '""')}"`
    ].join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'references.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

export function setStatus(message, busy = false) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.classList.toggle('active', busy);
}

export function clearStatus() {
  const el = document.getElementById('status');
  el.textContent = '';
  el.classList.remove('active');
}
