/**
 * Render an array of scored results into the #results div.
 */
export function renderResults(results) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<p>No references found or analyzed.</p>';
    return;
  }

  const summary = buildSummary(results);
  container.appendChild(summary);

  results.forEach(res => {
    const card = document.createElement('div');
    card.className = `result-card ${res.label}`;

    const reasonsHtml = res.reasons.map(r => {
      const kind = typeof r === 'string' ? 'neutral' : (r.kind || 'neutral');
      const text = typeof r === 'string' ? r : r.text;
      return `<li class="${kind}">${escapeHTML(text)}</li>`;
    }).join('');

    card.innerHTML = `
      <div class="result-header">
        <div class="score">Score: ${res.score}</div>
        <span class="label-badge">${res.label}</span>
      </div>
      <div class="reference-text">${escapeHTML(res.raw)}</div>
      <ul class="reasons-list">${reasonsHtml}</ul>
    `;
    container.appendChild(card);
  });
}

function buildSummary(results) {
  const counts = { valid: 0, warning: 0, invalid: 0 };
  results.forEach(r => { counts[r.label] = (counts[r.label] || 0) + 1; });

  const summary = document.createElement('div');
  summary.className = 'result-card';
  summary.style.borderLeftColor = '#2e6edf';
  summary.innerHTML = `
    <div class="result-header">
      <div class="score">${results.length} reference${results.length === 1 ? '' : 's'} analyzed</div>
    </div>
    <ul class="reasons-list">
      <li class="positive">Likely valid: ${counts.valid}</li>
      <li class="neutral">Needs review: ${counts.warning}</li>
      <li class="negative">Likely fabricated: ${counts.invalid}</li>
    </ul>
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
