/**
 * Render an array of scored results into the #results div.
 */
export function renderResults(results, detectedStyle = null) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<p>No references found or analyzed.</p>';
    return;
  }

  const summary = buildSummary(results, detectedStyle);
  container.appendChild(summary);

  results.forEach((res, idx) => {
    const card = document.createElement('div');
    card.className = `result-card ${res.label}`;

    const reasonsHtml = res.reasons.map(r => {
      const kind = typeof r === 'string' ? 'neutral' : (r.kind || 'neutral');
      const text = typeof r === 'string' ? r : r.text;
      return `<li class="${kind}">${escapeHTML(text)}</li>`;
    }).join('');

    card.innerHTML = `
      <div class="result-header">
        <span class="ref-num">[${idx + 1}]</span>
        <div class="score">Score: ${res.score}</div>
        <span class="label-badge">${res.label}</span>
      </div>
      <div class="reference-text">${escapeHTML(res.raw)}</div>
      <ul class="reasons-list">${reasonsHtml}</ul>
    `;
    container.appendChild(card);
  });
}

const STYLE_LABELS = {
  APA:       'APA 7th',
  Vancouver: 'Vancouver / ICMJE',
  IEEE:      'IEEE',
  MLA:       'MLA 9th',
  Chicago:   'Chicago 17th',
  Harvard:   'Harvard',
};

function buildSummary(results, detectedStyle) {
  const counts = { valid: 0, warning: 0, invalid: 0 };
  results.forEach(r => { counts[r.label] = (counts[r.label] || 0) + 1; });
  const total = results.length;

  const segments = [
    { key: 'valid',   count: counts.valid   },
    { key: 'warning', count: counts.warning },
    { key: 'invalid', count: counts.invalid },
  ].filter(s => s.count > 0)
   .map(s => `<div class="bar-segment ${s.key}" style="flex:${s.count}"></div>`)
   .join('');

  const labels = [
    { key: 'valid',   name: 'Valid',             count: counts.valid   },
    { key: 'warning', name: 'Needs review',      count: counts.warning },
    { key: 'invalid', name: 'Likely fabricated', count: counts.invalid },
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
