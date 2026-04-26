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

export function exportPDF(results, detectedStyle) {
  if (!results || results.length === 0) return;

  const validCount  = results.filter(r => r.label === 'valid').length;
  const reviewCount = results.length - validCount;
  const styleLabel  = detectedStyle ? (STYLE_LABELS[detectedStyle] ?? detectedStyle) : null;

  const refsHtml = results.map((r, i) => {
    const reasonsHtml = r.reasons.map(reason => {
      const kind = typeof reason === 'string' ? 'neutral' : (reason.kind || 'neutral');
      const text = typeof reason === 'string' ? reason : reason.text;
      return `<li class="${kind}">${escapeHTML(text)}</li>`;
    }).join('');

    const matchLink = r.matchUrl
      ? `<p class="match-url">Source: <a href="${escapeHTML(r.matchUrl)}">${escapeHTML(r.matchUrl)}</a></p>`
      : '';

    return `
      <div class="ref-entry ${r.label}">
        <div class="ref-header">
          <span class="ref-num">[${i + 1}]</span>
          <span class="ref-label ${r.label}">${r.label === 'valid' ? 'Valid' : 'Needs Review'}</span>
        </div>
        <p class="ref-text">${escapeHTML(r.raw.replace(/\n/g, ' '))}</p>
        <ul class="reasons">${reasonsHtml}</ul>
        ${matchLink}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Reference Validation Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1a1a1a; margin: 40px; line-height: 1.5; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  .summary { background: #f5f7fa; border: 1px solid #d0d5dd; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px; font-size: 13px; }
  .summary strong { font-size: 16px; }
  .valid-count  { color: #2e7d32; }
  .review-count { color: #b45309; }
  .ref-entry { border-left: 4px solid #ccc; padding: 10px 14px; margin-bottom: 14px; page-break-inside: avoid; }
  .ref-entry.valid   { border-left-color: #2e7d32; }
  .ref-entry.warning { border-left-color: #f9a825; }
  .ref-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .ref-num { font-family: monospace; font-size: 12px; color: #666; }
  .ref-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 8px; border-radius: 999px; color: white; }
  .ref-label.valid   { background: #2e7d32; }
  .ref-label.warning { background: #f9a825; color: #333; }
  .ref-text { font-family: Menlo, Consolas, monospace; font-size: 11px; background: #f0f2f5; padding: 6px 8px; border-radius: 3px; margin: 6px 0; white-space: pre-wrap; word-break: break-word; }
  .reasons { list-style: none; padding: 0; margin: 4px 0; }
  .reasons li { padding: 2px 0; font-size: 12px; color: #444; }
  .reasons li.positive::before { content: "✓  "; color: #2e7d32; font-weight: bold; }
  .reasons li.negative::before { content: "✗  "; color: #c62828; font-weight: bold; }
  .reasons li.neutral::before  { content: "•  "; color: #666; }
  .match-url { font-size: 11px; margin-top: 4px; }
  .match-url a { color: #2e6edf; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
  <h1>Reference Validation Report</h1>
  <p class="meta">Generated ${new Date().toLocaleString()}${styleLabel ? ` &nbsp;·&nbsp; Style: <strong>${escapeHTML(styleLabel)}</strong>` : ''}</p>
  <div class="summary">
    <strong>${results.length}</strong> reference${results.length === 1 ? '' : 's'} analyzed &nbsp;·&nbsp;
    <strong class="valid-count">${validCount}</strong> valid &nbsp;·&nbsp;
    <strong class="review-count">${reviewCount}</strong> need${reviewCount === 1 ? 's' : ''} review
  </div>
  ${refsHtml}
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) { alert('Allow pop-ups to export PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => win.print());
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
