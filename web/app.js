'use strict';

const state = {
  data: [],
  filtered: [],
  search: '',
  outcomes: new Set(['failed', 'mixed', 'successful']),
  sources: new Set(),     // populated after data load (all sources active)
  sourcesAll: [],
  sort: 'score',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const fmtInt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const slugify = (t) => encodeURIComponent(String(t).replace(/ /g, '_'));

/* Light cleanup of wikitext for the context excerpt: strip <ref>...</ref>
   blocks, simplify [[link|text]] to text, drop {{templates}}, collapse
   whitespace. Honest enough to still read as Wikipedia prose. */
function cleanWikitext(s) {
  if (!s) return '';
  let t = String(s)
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    // truncated templates left over from a cut-off excerpt
    .replace(/<ref[^>]*>[\s\S]*$/i, '…')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\{\{[\s\S]*$/g, '…')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    .replace(/'''([^']+)'''/g, '$1')
    .replace(/''([^']+)''/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  // collapse multiple ellipses
  t = t.replace(/(?:…\s*){2,}/g, '… ');
  return t;
}

/* =================== Load =================== */
fetch('data.json', { cache: 'no-store' })
  .then((r) => {
    if (!r.ok) throw new Error('fetch failed: ' + r.status);
    return r.json();
  })
  .then((rows) => {
    state.data = rows;

    // Discover sources from data.
    const srcCounts = new Map();
    for (const r of rows) {
      const s = r.source || '—';
      srcCounts.set(s, (srcCounts.get(s) || 0) + 1);
    }
    state.sourcesAll = Array.from(srcCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    state.sourcesAll.forEach((s) => state.sources.add(s));
    renderSourceChips(srcCounts);

    apply();
  })
  .catch((err) => {
    $('#feed').innerHTML = `<p class="empty">Failed to load data.json. Are you serving the page over http?<br><code style="font-size:12px">${escapeHtml(err.message)}</code></p>`;
  });

/* =================== Source chips =================== */
function renderSourceChips(counts) {
  const wrap = $('#source-filter');
  wrap.innerHTML = '';
  for (const src of state.sourcesAll) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.value = src;
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = `${src} · ${counts.get(src)}`;
    btn.addEventListener('click', () => toggleChip(btn, state.sources, src));
    wrap.appendChild(btn);
  }
}

function toggleChip(btn, set, key) {
  const on = btn.getAttribute('aria-pressed') === 'true';
  btn.setAttribute('aria-pressed', on ? 'false' : 'true');
  if (on) set.delete(key); else set.add(key);
  apply();
}

/* =================== Wire controls =================== */
$('#search').addEventListener('input', (e) => {
  state.search = e.target.value.trim().toLowerCase();
  apply();
});

$$('#outcome-filter .chip').forEach((btn) => {
  btn.addEventListener('click', () => toggleChip(btn, state.outcomes, btn.dataset.value));
});

$('#sort').addEventListener('change', (e) => {
  state.sort = e.target.value;
  apply();
});

/* =================== Filter + sort =================== */
function apply() {
  let rows = state.data.filter((r) => {
    if (!state.outcomes.has(r.outcome)) return false;
    if (!state.sources.has(r.source || '—')) return false;
    if (state.search) {
      const hay = (
        r.page_title + ' ' +
        (r.original?.doi || '') + ' ' +
        (r.replication?.doi || '') + ' ' +
        (r.original?.title || '') + ' ' +
        (r.replication?.title || '') + ' ' +
        (r.original?.short || '') + ' ' +
        (r.replication?.short || '')
      ).toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  });

  rows.sort((a, b) => {
    switch (state.sort) {
      case 'rep_citations':
        return (b.replication?.citations || 0) - (a.replication?.citations || 0);
      case 'orig_citations':
        return (b.original?.citations || 0) - (a.original?.citations || 0);
      case 'article':
        return a.page_title.localeCompare(b.page_title);
      case 'score':
      default:
        return (b.score || 0) - (a.score || 0);
    }
  });

  state.filtered = rows;
  renderFeed(rows);
  renderCounters(rows);
}

function renderCounters(rows) {
  $('#count-shown').textContent = rows.length.toString();
  const counts = { failed: 0, mixed: 0, successful: 0 };
  rows.forEach((r) => { if (counts[r.outcome] !== undefined) counts[r.outcome]++; });
  $('#count-by-outcome').innerHTML =
    `<span style="color:var(--failed)">${counts.failed} failed</span> · ` +
    `<span style="color:var(--mixed)">${counts.mixed} mixed</span> · ` +
    `<span style="color:var(--successful)">${counts.successful} successful</span>`;
}

/* =================== Render feed =================== */
function renderFeed(rows) {
  const feed = $('#feed');
  if (rows.length === 0) {
    feed.innerHTML = '<p class="empty">No recommendations match the current filters.</p>';
    return;
  }

  // Cap stagger to avoid wait time on big lists.
  const html = rows.map((r, i) => cardHtml(r, Math.min(i, 12))).join('');
  feed.innerHTML = html;

  // Wire copy buttons.
  $$('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.target;
      const txt = document.getElementById(targetId)?.dataset.text ||
                  document.getElementById(targetId)?.innerText ||
                  '';
      copyText(txt).then(() => {
        btn.classList.add('copied');
        const orig = btn.dataset.label || btn.textContent;
        if (!btn.dataset.label) btn.dataset.label = orig;
        btn.innerHTML = '✓ Copied';
        showToast('Copied to clipboard');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = btn.dataset.label;
        }, 1600);
      });
    });
  });

  // Wire expand-cite.
  $$('.cite-block').forEach((el) => {
    el.addEventListener('click', () => el.classList.toggle('expanded'));
  });
}

function cardHtml(r, staggerIdx) {
  const o = r.original || {};
  const rep = r.replication || {};
  const sectionHint = r.section_in_article && r.section_in_article.trim()
    ? `<div class="card-section-hint">In section: ${escapeHtml(r.section_in_article)}</div>`
    : '';

  const sentenceId = `sentence-${r.rank}`;
  const refId      = `ref-${r.rank}`;
  const sentence   = r.sentence_suggestion || '';
  const cite       = r.cite_template || '';

  const outcomeLabel = (r.outcome || '').toUpperCase();

  const cleanedExcerpt = cleanWikitext(r.paragraph_excerpt);
  const excerpt = cleanedExcerpt
    ? `<details class="excerpt">
         <summary>Show context paragraph from the article</summary>
         <p class="excerpt-text">${escapeHtml(cleanedExcerpt)}</p>
       </details>`
    : '';

  return `
    <article class="card" data-outcome="${escapeHtml(r.outcome)}" style="animation-delay:${staggerIdx * 40}ms">
      <header class="card-head">
        <div>
          <div class="card-rank">
            <span class="card-rank-num">#${r.rank}</span>
            <span>${escapeHtml((r.lang || 'en').toUpperCase())}.WIKIPEDIA</span>
          </div>
          <h2 class="card-title">
            <a href="${escapeHtml(r.page_url)}" target="_blank" rel="noopener">${escapeHtml(r.page_title)}</a>
          </h2>
          ${sectionHint}
        </div>
        <div class="card-actions">
          <span class="outcome-badge" data-outcome="${escapeHtml(r.outcome)}">${escapeHtml(outcomeLabel)}</span>
          ${r.source ? `<span class="source-badge">${escapeHtml(r.source)}</span>` : ''}
          <a class="btn-edit" href="${escapeHtml(r.edit_url)}" target="_blank" rel="noopener">Edit</a>
        </div>
      </header>

      <div class="card-body">
        <section class="work work-orig">
          <div class="work-label"><span class="work-label-icon"></span>Cited &mdash; original</div>
          <div class="work-byline">
            <strong>${escapeHtml(o.short || '—')}</strong>
            ${o.year ? ` · ${escapeHtml(o.year)}` : ''}
            ${o.journal ? ` · <em>${escapeHtml(o.journal)}</em>` : ''}
          </div>
          <div class="work-title">${escapeHtml(o.title || '—')}</div>
          <div class="work-meta">
            ${o.doi ? `<a href="https://doi.org/${escapeHtml(o.doi)}" target="_blank" rel="noopener">doi:${escapeHtml(o.doi)}</a>` : ''}
            ${o.citations != null ? `<span class="cite-pill"><strong>${fmtInt(o.citations)}</strong> citations</span>` : ''}
          </div>
        </section>

        <section class="work work-rep" data-outcome="${escapeHtml(r.outcome)}">
          <div class="work-label"><span class="work-label-icon"></span>Missing &mdash; replication</div>
          <div class="work-byline">
            <strong>${escapeHtml(rep.short || '—')}</strong>
            ${rep.year ? ` · ${escapeHtml(rep.year)}` : ''}
            ${rep.journal ? ` · <em>${escapeHtml(rep.journal)}</em>` : ''}
          </div>
          <div class="work-title">${escapeHtml(rep.title || '—')}</div>
          <div class="work-meta">
            ${rep.doi ? `<a href="https://doi.org/${escapeHtml(rep.doi)}" target="_blank" rel="noopener">doi:${escapeHtml(rep.doi)}</a>` : ''}
            ${rep.citations != null ? `<span class="cite-pill"><strong>${fmtInt(rep.citations)}</strong> citations</span>` : ''}
          </div>
        </section>
      </div>

      <div class="suggest">
        ${sentence ? `
          <div class="suggest-block">
            <div class="suggest-marker">Sentence</div>
            <div class="suggest-content">
              <p class="suggest-text" id="${sentenceId}" data-text="${escapeHtml(sentence)}">${escapeHtml(sentence)}</p>
              <div class="suggest-buttons">
                <button class="btn btn-copy" data-target="${sentenceId}">Copy sentence</button>
              </div>
            </div>
          </div>
        ` : ''}

        ${cite ? `
          <div class="suggest-block">
            <div class="suggest-marker">Wikitext &lt;ref&gt;</div>
            <div class="suggest-content">
              <pre class="cite-block" id="${refId}" data-text="${escapeHtml(cite)}">${escapeHtml(cite)}</pre>
              <div class="suggest-buttons">
                <button class="btn btn-copy" data-target="${refId}">Copy &lt;ref&gt;</button>
                <a class="btn" href="${escapeHtml(r.edit_url)}" target="_blank" rel="noopener">Open editor ↗</a>
              </div>
            </div>
          </div>
        ` : ''}

        ${excerpt}
      </div>
    </article>
  `;
}

/* =================== Helpers =================== */
function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    resolve();
  });
}

let toastTimer;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 1500);
}

/* Fill in generated date dynamically if present in URL. */
const today = new Date();
$('#generated-date').textContent = today.toLocaleString('en-US', { month: 'long', year: 'numeric' });
