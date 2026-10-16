'use strict';
// Private review UI: one card per Wikipedia page, one item per database study cited on it.
// Read-only with respect to Wikipedia: the only network call is an optional,
// user-triggered revision-ID lookup (MediaWiki read API).
const LS = 'flora-en-edit-proto:page:';
const WELCOME_KEY = 'flora-en-edit-proto:welcome-hidden';

// Plain-language labels for the model's controlled vocabulary.
const ACTION = {
  no_change: 'No change needed', contextualise: 'Add missing context', narrow_claim: 'Make the claim more precise',
  replace_source: 'Replace the source', upgrade_source: 'Add a better source',
  remove_unsupported_claim: 'Remove an unsupported claim', remove_citation: 'Remove a citation',
  talk_page: 'Discuss on the talk page', defer: 'Needs more checking first'
};
const EDIT_ACTIONS = new Set(['contextualise', 'narrow_claim', 'replace_source', 'upgrade_source',
  'remove_unsupported_claim', 'remove_citation', 'talk_page']);
const SCOPE = {
  paper: 'Article about this study', effect: 'Article about this effect', effect_section: 'Section about this effect',
  broad_topic: 'Broad topic article', biography_history: 'Biography or history', incidental: 'Passing mention',
  list_or_bibliography: 'List or bibliography entry'
};
const USE = {
  current_empirical_support: 'cited as current evidence', historical_attribution: 'cited as history (who found what)',
  example: 'cited as an example', bibliography_listing: 'listed as a publication', unclear: 'use unclear'
};
const LEVEL = {full_text: 'Full text read', abstract: 'Abstract only', metadata_only: 'Title and details only',
  needs_source: 'Source still to find'};
const DECISIONS = {
  edit: 'I will edit the article (in my own words)', talk: 'I will raise it on the talk page',
  no_change: 'No change needed', later: 'Needs more checking first', skip: 'Skip (not my area / no access)'
};
const DECISION_QUEUE = {edit: 'retain', talk: 'retain', no_change: 'drop', later: 'defer', skip: 'defer'};
const KIND = {edit: ['Edit suggested', 'edit'], judgement: ['Judgement call', 'warn'], optional: ['Optional addition', 'info'],
  other: ['No change needed', 'none'], none: ['No change needed', 'none']};
const STRENGTH = {fix: 'Fix: the article says something the source does not support',
  recommended_addition: 'Add missing evidence: a replication that bears on this claim is not mentioned',
  optional_addition: 'Optional: the article is accurate; this would only add to it', none: 'Nothing to change'};

let DATA = null, PAGES = [], ACTIVE = null, SEGMENT = 'repl';
const filters = {};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const doiLink = d => d && !/^needs/i.test(d) ? `<a href="https://doi.org/${esc(d)}" target="_blank" rel="noopener">doi:${esc(d)}</a>` : '';
// What the model read. In lists, full text is the default and stays unmarked; anything less is named.
const lvlBadge = (l, quiet) => quiet && l === 'full_text' ? '' : `<span class="lvl ${l === 'full_text' ? '' : l === 'abstract' ? 'abs' : 'thin'}">${esc(LEVEL[l] || l)}</span>`;


function itemKind(it) { return it.kind || (EDIT_ACTIONS.has(it.suggestion.proposed_action) ? 'edit' : 'none'); }
const KORDER = {edit: 0, judgement: 1, optional: 2, other: 3, none: 4};
function pageKind(p) {
  const ks = p.items.map(itemKind);
  for (const k of ['edit', 'judgement', 'optional']) if (ks.includes(k)) return k;
  if (p.adjacent.length || p.items.some(it => (it.suggestion.alternatives || []).length)) return 'other';  // no change, minor notes
  return 'none';
}
// Our main scope: edits that bring in a replication the page does not yet cite. Whether that edit is
// recommended or optional is already carried by the kind label, so this is a plain yes/no marker.
const pageRepl = p => p.items.some(it => it.adds_replication);
const flags = p => ({blp: p.items.some(i => i.suggestion.flags.blp), medrs: p.items.some(i => i.suggestion.flags.medrs)});

function ledgerGet(id) { try { return JSON.parse(localStorage.getItem(LS + id)) || null; } catch { return null; } }
function ledgerPut(id, rec) { localStorage.setItem(LS + id, JSON.stringify(rec)); }
const reviewed = p => { const r = ledgerGet(p.page_id); return !!r && p.items.every(it => r.items?.[it.card_id]); };

// ---------- list and filters ----------
const SEGMENTS = [
  ['repl', 'Adds a replication', p => !!pageRepl(p)],
  ['worth', 'Worth a look', p => ['edit', 'judgement'].includes(pageKind(p))], ['edit', 'Edit suggested', p => pageKind(p) === 'edit'],
  ['judgement', 'Judgement call', p => pageKind(p) === 'judgement'], ['optional', 'Optional', p => pageKind(p) === 'optional'],
  ['none', 'No change', p => ['other', 'none'].includes(pageKind(p))], ['all', 'All', () => true]];
const FACETS = [
  ['mine', 'My progress', p => reviewed(p) ? 'Reviewed' : 'Not reviewed yet', true],
  ['scope', 'Kind of article', p => SCOPE[p.items[0].suggestion.article_scope] || p.items[0].suggestion.article_scope, true],
  ['many', 'Studies on the page', p => p.items.length > 1 ? 'Several' : 'One', true],
  ['care', 'Extra care', p => [flags(p).blp && 'Living person (BLP)', flags(p).medrs && 'Health / medical (MEDRS)',
    p.live_check.changed_since_frozen && 'Article edited since'].filter(Boolean), true],
  ['evidence', 'What the model read', p => [...new Set(p.items.map(i => LEVEL[i.best_evidence]))], false],
];
const facetVals = (p, f) => { const v = f[2](p); return Array.isArray(v) ? v : [v]; };

function buildFilters() {
  const group = f => {
    const counts = {};
    PAGES.forEach(p => facetVals(p, f).forEach(v => counts[v] = (counts[v] || 0) + 1));
    return `<fieldset class="fgroup"><legend>${esc(f[1])}</legend>` + Object.keys(counts).sort().map(v =>
      `<label><input type="checkbox" data-f="${f[0]}" value="${esc(v)}" ${filters[f[0]]?.has(v) ? 'checked' : ''}> <span>${esc(v)}</span><span class="n">${counts[v]}</span></label>`).join('') + '</fieldset>';
  };
  document.getElementById('filter-groups').innerHTML = FACETS.filter(f => f[3]).map(group).join('') +
    `<details class="more"><summary>More filters</summary>${FACETS.filter(f => !f[3]).map(group).join('')}</details>`;
  document.querySelectorAll('#filter-groups input').forEach(i => i.addEventListener('change', () => {
    const s = filters[i.dataset.f] ||= new Set();
    i.checked ? s.add(i.value) : s.delete(i.value);
    renderList();
  }));
}
function buildSegments() {
  document.getElementById('segments').innerHTML = SEGMENTS.map(([k, label, f]) =>
    `<button type="button" data-seg="${k}" aria-pressed="${SEGMENT === k}">${esc(label)} <span class="n">${PAGES.filter(f).length}</span></button>`).join('');
  document.querySelectorAll('#segments button').forEach(b => b.onclick = () => { SEGMENT = b.dataset.seg; buildSegments(); renderList(); });
}
function visible() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const seg = SEGMENTS.find(s => s[0] === SEGMENT)[2];
  return PAGES.filter(p => seg(p) && FACETS.every(f => !filters[f[0]]?.size || facetVals(p, f).some(v => filters[f[0]].has(v)))
    && (!q || p.search.includes(q)));
}
function renderList() {
  const list = visible();
  document.getElementById('summary').textContent = `${list.length} of ${PAGES.length} articles shown`;
  document.getElementById('cards').innerHTML = list.map(p => {
    const [label, cls] = KIND[pageKind(p)], fl = flags(p);
    const studies = p.items.length > 1 ? `${p.items.length} studies: ${p.items.map(i => i.original.short.split(':')[0]).join('; ')}` : p.items[0].original.short;
    return `<li><button type="button" class="card-btn${ACTIVE === p.page_id ? ' active' : ''}" data-id="${p.page_id}" aria-current="${ACTIVE === p.page_id}">
      <span class="t">${esc(p.page.title)}</span>
      <span class="m">${esc(studies)}</span>
      <span class="badges"><span class="badge ${cls}">${label}</span>
      ${pageRepl(p) ? '<span class="badge repl">Adds a replication</span>' : ''}${pageKind(p) === 'other' ? '<span class="badge">Minor notes</span>' : ''}
      ${fl.blp ? '<span class="badge care">Living person</span>' : ''}${fl.medrs ? '<span class="badge care">Health</span>' : ''}
      ${p.live_check.changed_since_frozen ? '<span class="badge warn">Edited since</span>' : ''}
      ${reviewed(p) ? '<span class="badge done">✓ reviewed</span>' : ''}</span></button></li>`;
  }).join('') || '<li class="small">No articles match. Try "All" or clear some filters.</li>';
  document.querySelectorAll('.card-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.id, true)));
  updateLedgerCount();
}

// ---------- item blocks ----------
function markRefs(text) {
  return esc(text).replace(/\[FOCAL REF:([^\]]*)\]/g, (m, x) => `<mark class="focal" title="Citation of the study discussed here">[this study:${x}]</mark>`)
    .replace(/\[PAIRED REF:([^\]]*)\]/g, (m, x) => `<mark class="paired" title="Citation of a replication">[replication:${x}]</mark>`)
    .replace(/\[ref:([^\]]*)\]/g, '<span class="ref">[ref:$1]</span>');
}
// Compact citation markers for the sentence at issue; the full reference is in the tooltip.
const MARKER = /\[(FOCAL REF|PAIRED REF|ref):([^\]]*)\]/g;
function compactRefs(text) {
  let out = '', last = 0;
  for (const m of text.matchAll(MARKER)) {
    const full = m[2].trim(), yr = full.match(/\((\d{4})\)/)?.[1];
    const [cls, label] = m[1] === 'FOCAL REF' ? ['focal', 'this study'] : m[1] === 'PAIRED REF' ? ['paired', 'replication']
      : ['other', yr ? `other source, ${yr}` : 'other source'];
    out += esc(text.slice(last, m.index)) + `<span class="cite ${cls}" title="${esc(full)}">[${label}]</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
// Find a quoted sentence in the article passages and return it with the citations it carries,
// including those right after it, so readers can see which source backs which part.
function withRefs(quote, occs) {
  const ws = c => /\s/.test(c), q = quote.replace(/\s+/g, ' ').trim();
  for (const o of occs) {
    const raw = o.paragraph_plain, at = [];
    let plain = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '[') { const m = raw.slice(i).match(/^\[(FOCAL REF|PAIRED REF|ref):[^\]]*\]/); if (m) { i += m[0].length - 1; continue; } }
      if (ws(raw[i])) { if (!plain.length || plain.endsWith(' ')) continue; plain += ' '; } else plain += raw[i];
      at.push(i);
    }
    const k = plain.indexOf(q);
    if (k < 0) continue;
    let end = at[k + q.length - 1] + 1;
    for (let m; (m = raw.slice(end).match(/^\s*\[(FOCAL REF|PAIRED REF|ref):[^\]]*\]/));) end += m[0].length;
    return compactRefs(raw.slice(at[k], end));
  }
  return esc(quote);
}
function highlight(text, quotes) {
  let h = markRefs(text);
  for (const q of quotes) {
    const e = esc(q.trim());
    if (e.length >= 40 && h.includes(e)) h = h.replace(e, `<mark class="claim">${e}</mark>`);
  }
  return h;
}
const normT = t => t.toLowerCase().replace(/\s+/g, ' ').trim();

function issueBlock(it) {
  const s = it.suggestion, d = s.draft;
  const target = d.target_text && ['replace', 'modify', 'remove', 'insert_after'].includes(d.operation) ? d.target_text : '';
  const claims = s.claim_sites.filter(x => x.is_visible_claim).map(x => x.visible_claim_quote);
  const lead = target || claims[0] || '';
  const others = claims.filter(q => !normT(lead).includes(normT(q)) && !normT(q).includes(normT(lead)));
  const label = target ? (d.operation === 'insert_after' ? 'The suggestion adds something after this sentence' : 'The sentence at issue')
    : claims.length ? 'Where the article relies on the study' : 'The study is not used for a visible claim';
  return `<h4>${esc(label)}</h4>
    ${lead ? `<blockquote class="target">${withRefs(lead, it.occurrences)}</blockquote>` : `<p>${esc(s.claim_sites[0]?.note || 'It only appears in a list or reference section.')}</p>`}
    ${others.length ? `<p class="small">Also cited for: ${others.map(q => `“${esc(q.length > 160 ? q.slice(0, 157) + '…' : q)}”`).join(' · ')}</p>` : ''}`;
}

const RESULT = {confirmed: ['', ''], contradicted: ['✗ Contradicted', 'bad'], not_in_source: ['✗ Not in the source', 'bad'],
  source_unavailable: ['? Source not obtained', 'warn']};
function checksBlock(it, rec) {
  const v = it.suggestion.verifications || [], s = it.suggestion;
  const judge = s.required_checks || [];
  const done = new Set(rec.checks_done?.[it.card_id] || []);
  const off = v.filter(x => x.result !== 'confirmed').length;
  return `${v.length ? `<h4>What we checked</h4>
    <p class="small">${off ? `The source supports each point unless it is marked (${off} marked).` : 'The source supports each point.'}
      Read in full unless marked “abstract only”. Quotes match the paper word for word, which shows the words are there, not that the model read them correctly: do check anything your edit will rely on.</p>
    <ul class="verifs">${v.map(x => `<li>${RESULT[x.result][0] ? `<span class="badge ${RESULT[x.result][1]}">${RESULT[x.result][0]}</span> ` : ''}${esc(x.claim)}
      <span class="small">· ${doiLink(x.source.replace(/^doi:/i, ''))} ${lvlBadge(x.evidence_level, true)}</span>
      ${x.quote ? `<blockquote class="excerpt">“${esc(x.quote)}”</blockquote>` : ''}</li>`).join('')}</ul>` : ''}
    ${judge.length ? `<h4>Your call</h4><ul class="checklist">${judge.map((x, i) => `<li><label><input type="checkbox" data-item="${it.card_id}" data-check="${i}" ${done.has(i) ? 'checked' : ''}> ${esc(x)}</label></li>`).join('')}</ul>` : ''}
    ${s.uncertainties.length ? `<details><summary>What remains uncertain (${s.uncertainties.length})</summary><ul class="tight">${s.uncertainties.map(u => `<li>${esc(u)}</li>`).join('')}</ul></details>` : ''}`;
}

function evidenceBlock(it) {
  const used = it.suggestion.evidence_used;
  const excerpts = doi => used.filter(e => e.doi.toLowerCase() === doi.toLowerCase() && e.excerpt);
  const row = (role, s, extra) => {
    const ex = excerpts(s.doi);
    return `<tr><th scope="row">${role}</th><td>${esc(s.citation)}<br>${doiLink(s.doi)}${extra || ''}
      ${ex.length ? `<details><summary>Quoted passages (${ex.length})</summary>${ex.map(e => `<blockquote class="excerpt">“${esc(e.excerpt)}”<br><span class="small">${esc(e.what_it_supports)}</span></blockquote>`).join('')}</details>` : ''}</td>
      <td>${lvlBadge(s.evidence_level)}</td></tr>`;
  };
  const known = [it.original.doi, ...it.replications.map(r => r.doi)].map(x => x.toLowerCase());
  const extra = used.filter(e => !known.includes(e.doi.toLowerCase()));
  const revs = it.reviews_checked || [];
  const found = revs.filter(r => r.mentions);
  return `<h4>The studies</h4>
    <table class="evidence"><thead><tr><th>Role</th><th>Study</th><th>What the model read</th></tr></thead><tbody>
    ${row('This study', it.original)}
    ${it.replications.map(r => row('Replication', r, `<br><span class="small">Database label: ${esc(r.flora_outcome)} (screening label, not citable)${r.doi_detected_on_page ? ' · already cited in the article' : ''}</span>`)).join('')}
    </tbody></table>
    ${extra.length ? `<details><summary>Other sources the model used (${extra.length})</summary><ul class="tight">${extra.map(e => `<li>${doiLink(e.doi)} ${lvlBadge(e.evidence_level, true)} ${esc(e.what_it_supports)}${e.excerpt ? `<blockquote class="excerpt">“${esc(e.excerpt)}”</blockquote>` : ''}</li>`).join('')}</ul></details>` : ''}
    ${revs.length ? `<details><summary>Review articles we checked for the replication: ${found.length} of ${revs.length} cite or mention it</summary><ul class="tight">${revs.map(r => `<li>${esc(r.title)} (${esc(r.year)}) ${doiLink(r.doi)} ${lvlBadge(r.evidence_level, true)} · ${r.mentions ? '<strong>mentions it</strong>' : 'no mention found'}${r.snippets?.[0] ? `<blockquote class="excerpt">…${esc(r.snippets[0].slice(0, 400))}…</blockquote>` : ''}</li>`).join('')}</ul></details>` : ''}`;
}

function wordingHtml(d, used) {
  // [cite: DOI] markers become numbered references listed under the example.
  const refs = [];
  const body = esc(d.wording).replace(/\[cite:\s*([^\]]+)\]/g, (m, doi) => {
    doi = doi.trim();
    if (/^needs/i.test(doi)) return '';
    let n = refs.indexOf(doi);
    if (n < 0) { refs.push(doi); n = refs.length - 1; }
    return `<sup>[${n + 1}]</sup>`;
  });
  return `<div class="wording">${body}</div>${refs.length ? `<ol class="refs small">${refs.map(r => `<li>${doiLink(r)}</li>`).join('')}</ol>` : ''}`;
}

function draftBlock(it) {
  const d = it.suggestion.draft;
  if (!['provided', 'conditional'].includes(d.status) || !d.wording.trim()) return '';
  return `<div class="draft"><h4>Example wording <span class="small">(written by a model; do not copy)</span></h4>
    <p class="small">Where: ${esc(d.location)}</p>${wordingHtml(d, it.suggestion.evidence_used)}
    <p class="small warntext">English Wikipedia does not allow AI-written article text: use this to see what the sources support, then write your own.${d.status === 'conditional' ? ' It depends on one of the checks below.' : ''}</p></div>`;
}

function writingBlock(it) {
  const s = it.suggestion, d = s.draft;
  const points = s.content_points.filter(x => !/^needs/i.test(x.source));
  if (!points.length && !s.alternatives.length) return '';
  const unread = points.some(x => x.evidence_level !== 'full_text');
  return `<h4>${EDIT_ACTIONS.has(s.proposed_action) ? 'Suggested points to cover' : 'Points worth knowing'}</h4>
    ${unread ? '<p class="small">Points marked “Abstract only” or “Title and details only” come from summaries: check them against the full paper.</p>' : ''}
    ${points.length ? `<ul class="tight">${points.map(x => `<li>${esc(x.point)} · ${doiLink(x.source)} ${lvlBadge(x.evidence_level, true)}</li>`).join('')}</ul>` : ''}
    ${s.alternatives.length ? `<details ${itemKind(it) === 'none' ? 'open' : ''}><summary>Other problems found and alternative fixes (${s.alternatives.length})</summary><ul class="tight">${s.alternatives.map(a => `<li><strong>${esc(a.action)}</strong>: ${esc(a.when)}</li>`).join('')}</ul></details>` : ''}`;
}

function contextBlock(it) {
  const quotes = it.suggestion.claim_sites.map(x => x.visible_claim_quote);
  return `<details><summary>Where this study appears in the article (${it.occurrences.length})</summary>
    <p class="small"><mark class="focal">[this study]</mark> marks its citation, <mark class="paired">[replication]</mark> a replication's; <mark class="claim">underlined</mark> text is what the citation supports. Rendering is approximate; check the live page.</p>
    ${it.occurrences.map(o => `<h5>Section “${esc(o.section)}”${o.in_comment ? ' (hidden comment, not visible to readers)' : ''}</h5>
      <div class="passage">${highlight(o.paragraph_plain, quotes)}</div>
      <details><summary>Whole section</summary><div class="passage">${highlight(o.section_plain, quotes)}</div></details>`).join('')}</details>`;
}

function provenanceBlock(it) {
  const p = it.provenance, v = it.validation;
  return `<details class="provenance"><summary>How this suggestion was made</summary><dl class="kv">
    <dt>Written by</dt><dd>${esc(p.route_label)} (${esc(p.model)})${p.finished_at ? ', ' + esc(p.finished_at.slice(0, 10)) : ''}</dd>
    <dt>Model's assessment</dt><dd>${esc(it.suggestion.assessment)}</dd>
    <dt>Does the replication test this claim?</dt><dd>${esc(it.suggestion.specific_study_match.status)}: ${esc(it.suggestion.specific_study_match.note)}</dd>
    <dt>Does the article already cover it?</dt><dd>${esc(it.suggestion.existing_acknowledgement.status)}: ${esc(it.suggestion.existing_acknowledgement.note)}</dd>
    ${p.fulltext_update ? `<dt>Full-text update</dt><dd>${esc(p.fulltext_update)}</dd>` : ''}
    ${p.orchestrator.notes ? `<dt>Reviewing model's note</dt><dd>${esc(p.orchestrator.notes)}</dd>` : ''}
    <dt>Automatic checks</dt><dd>${v.errors.length ? `<span class="bad">${esc(v.errors.join('; '))}</span>` : 'Quotes, sources and numbers matched the texts the model read.'}</dd>
    <dt>Status</dt><dd>Reviewed by AI models only; not yet checked by people.</dd></dl></details>`;
}

function itemSection(it, i, n, rec) {
  const s = it.suggestion, k = itemKind(it), [label, cls] = KIND[k];
  const head = `${n > 1 ? `Study ${i + 1} of ${n}: ` : ''}${it.original.short}`;
  const body = `${issueBlock(it)}
    <div class="proposal ${cls}"><p class="verdict"><strong>${esc(ACTION[s.proposed_action])}</strong></p>
      ${s.edit_strength ? `<p class="small">${esc(STRENGTH[s.edit_strength])}</p>` : ''}
      ${it.adds_replication ? '<p class="small">Adds a replication: the suggested edit cites a replication that this article does not cite yet.</p>' : ''}
      <p>${esc(s.rationale)}</p>
      ${it.two_run ? (it.two_run.agree ? '<p class="small ok">Two independent drafting runs reached the same verdict.</p>'
        : `<p class="twoRun"><strong>Two drafting runs disagreed, so this is your call.</strong> The one shown suggests “${esc(ACTION[it.two_run.shown.action])}”; the other concluded “${esc(ACTION[it.two_run.other.action])}”: ${esc(it.two_run.other.rationale)}</p>`) : ''}<p class="small">${esc(SCOPE[s.article_scope] || s.article_scope)}, ${esc(USE[s.citation_function] || s.citation_function)}</p></div>
    ${draftBlock(it)}${checksBlock(it, rec)}${evidenceBlock(it)}${writingBlock(it)}${contextBlock(it)}${provenanceBlock(it)}`;
  return `<section class="item" id="item-${it.card_id}">
    <details ${k !== 'none' || n === 1 || s.alternatives.length ? 'open' : ''}><summary class="item-head"><span class="badge ${cls}">${label}</span> ${esc(head)}</summary>${body}</details></section>`;
}

function overview(p) {
  if (p.items.length < 2) return '';
  return `<section class="overview"><h3>${p.items.length} studies from the database are cited on this page</h3>
    <ol>${p.items.map(it => `<li><a href="#item-${it.card_id}" data-jump="${it.card_id}">${esc(it.original.short)}</a> · ${esc(ACTION[it.suggestion.proposed_action])}</li>`).join('')}</ol></section>`;
}

function otherFixesBlock(p) {
  if (!p.adjacent.length) return '';
  return `<section class="other-fixes"><h3>Other problems spotted on this page</h3>
    <p class="small">Unrelated to the replication question; each was checked against the article text by the reviewing model.</p>
    <ul class="tight">${p.adjacent.map(x => `<li><blockquote class="target small-q">${esc(x.sentence)}</blockquote>${esc(x.issue)} <strong>Suggested:</strong> ${esc(x.suggested_action)}</li>`).join('')}</ul></section>`;
}

function decisionBlock(p, rec) {
  return `<section class="ledger"><h3>Record your review <span class="small">(stays in this browser)</span></h3>
    <p class="small">Make any edit on Wikipedia itself (<a href="${esc(p.page.live_url)}" target="_blank" rel="noopener">open the article ↗</a>), then record here what you did.</p>
    ${p.items.map((it, i) => `<fieldset><legend>${p.items.length > 1 ? `Study ${i + 1}: ` : 'Your decision: '}${esc(it.original.short.split(':')[0])} <span class="small">(suggested: ${esc(ACTION[it.suggestion.proposed_action])})</span></legend>
      ${Object.entries(DECISIONS).map(([k, v]) => `<label class="radio"><input type="radio" name="dec-${it.card_id}" value="${k}" ${rec.items?.[it.card_id] === k ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</fieldset>`).join('')}
    ${p.adjacent.length ? `<label class="radio"><input type="checkbox" id="l-other" ${rec.other_fix_done ? 'checked' : ''}> I dealt with the other problem(s) spotted on this page</label>` : ''}
    <label for="l-useful">Was this card useful?</label>
    <select id="l-useful"><option value="">–</option>${['useful', 'partly useful', 'not useful', 'misleading'].map(v => `<option ${rec.draft_usefulness === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <label for="l-notes">Notes (reasons, sources you checked, what you plan to write)</label>
    <textarea id="l-notes">${esc(rec.notes || '')}</textarea>
    <p id="l-hint" class="small warntext" hidden>You disagreed with a suggestion: please add a short reason in the notes.</p>
    <div class="row"><button type="button" id="l-save" class="primary">Save review</button>
    <span id="l-status" class="small" role="status">${rec.updated_at ? `Saved ${esc(rec.updated_at.slice(0, 16).replace('T', ' '))}` : 'Not saved yet'}</span></div></section>`;
}

const baseRec = p => ({page_id: p.page_id, page_title: p.page.title, reviewed_revision_id: p.page.frozen_revid, items: {}, checks_done: {}});

function show(id, focus) {
  ACTIVE = id;
  const p = PAGES.find(x => x.page_id === id), pg = p.page, lc = p.live_check, rec = ledgerGet(id) || baseRec(p), fl = flags(p);
  history.replaceState(null, '', '#' + id);
  document.getElementById('layout').classList.add('has-card');
  document.getElementById('detail').innerHTML = `
    <button type="button" class="back" id="back">← Back to list</button>
    <h2 id="card-title" tabindex="-1">${esc(pg.title)}</h2>
    <div class="links"><a href="${esc(pg.live_url)}" target="_blank" rel="noopener">Open article</a>
      <a href="${esc(pg.talk_url)}" target="_blank" rel="noopener">Talk page</a>
      <a href="${esc(pg.diff_url)}" target="_blank" rel="noopener">Changes since this snapshot</a>
      <a href="${esc(pg.frozen_url)}" target="_blank" rel="noopener">Snapshot version</a></div>
    <div class="revbar ${lc.changed_since_frozen ? 'warn' : ''}" id="revbar">
      <span id="rev-msg">${lc.changed_since_frozen ? `⚠ The article has been edited since this snapshot (${esc(pg.frozen_timestamp.slice(0, 10))}). Check the changes before acting.`
        : `Snapshot from ${esc(pg.frozen_timestamp.slice(0, 10))}; unchanged when last checked (${esc((lc.checked_at || '').slice(0, 10))}).`}</span>
      <button type="button" id="l-check">Check now</button></div>
    ${fl.blp ? '<p class="care-note">Living person: findings are about studies, not people. Follow WP:BLP and do not imply misconduct.</p>' : ''}
    ${fl.medrs ? '<p class="care-note">Health or medical content: single studies and replications are usually not enough (WP:MEDRS).</p>' : ''}
    ${overview(p)}${p.items.map((it, i) => itemSection(it, i, p.items.length, rec)).join('')}${otherFixesBlock(p)}${decisionBlock(p, rec)}`;

  document.getElementById('back').onclick = () => { document.getElementById('layout').classList.remove('has-card'); document.querySelector(`.card-btn[data-id="${id}"]`)?.focus(); };
  document.querySelectorAll('[data-jump]').forEach(a => a.onclick = e => {
    e.preventDefault();
    const sec = document.getElementById('item-' + a.dataset.jump);
    sec.querySelector('details').open = true;
    sec.scrollIntoView({behavior: 'smooth', block: 'start'});
  });
  document.querySelectorAll('[data-check]').forEach(cb => cb.onchange = () => {
    const r = ledgerGet(id) || baseRec(p);
    r.checks_done = r.checks_done || {};
    r.checks_done[cb.dataset.item] = [...document.querySelectorAll(`[data-item="${cb.dataset.item}"]:checked`)].map(x => +x.dataset.check);
    ledgerPut(id, r);
  });
  document.getElementById('l-save').onclick = () => {
    const notes = document.getElementById('l-notes').value;
    const decisions = Object.fromEntries(p.items.map(it => [it.card_id, document.querySelector(`input[name="dec-${it.card_id}"]:checked`)?.value || '']));
    // A reason is required only when a decision departs from that study's suggestion.
    const disagrees = p.items.some(it => {
      const d = decisions[it.card_id], k = itemKind(it);
      if (k === 'judgement' || k === 'optional') return false;  // either answer is fine without a reason
      const expected = k === 'edit' ? ['edit', 'talk'] : ['no_change'];
      return d && d !== 'skip' && !expected.includes(d);
    });
    const hint = document.getElementById('l-hint');
    hint.hidden = !(disagrees && !notes.trim());
    if (!hint.hidden) { document.getElementById('l-notes').focus(); return; }
    const r = {...(ledgerGet(id) || baseRec(p)), items: Object.fromEntries(Object.entries(decisions).filter(([, v]) => v)),
      other_fix_done: document.getElementById('l-other')?.checked || false,
      draft_usefulness: document.getElementById('l-useful').value, notes,
      reviewer: document.getElementById('reviewer').value, updated_at: new Date().toISOString()};
    ledgerPut(id, r);
    document.getElementById('l-status').textContent = 'Saved';
    renderList();
  };
  document.getElementById('l-check').onclick = async () => {
    const msg = document.getElementById('rev-msg');
    msg.textContent = 'Checking Wikipedia…';
    try {
      const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=revisions&pageids=${pg.pageid}&rvprop=ids|timestamp&format=json&formatversion=2&origin=*`);
      const rev = (await resp.json()).query.pages[0].revisions[0];
      const same = String(rev.revid) === String(pg.frozen_revid);
      ledgerPut(id, {...(ledgerGet(id) || baseRec(p)), live_revision_checked: rev.revid, live_checked_at: new Date().toISOString()});
      document.getElementById('revbar').className = 'revbar ' + (same ? 'okbar' : 'warn');
      msg.textContent = same ? '✓ Unchanged: the live article is the version this card describes.'
        : `⚠ Edited on ${rev.timestamp.slice(0, 10)}. Open "Changes since this snapshot" to see whether the issue is still there.`;
    } catch (e) { msg.textContent = 'Could not reach Wikipedia: ' + e; }
  };
  renderList();
  if (focus) document.getElementById('card-title').focus();
}

// ---------- ledger export ----------
function updateLedgerCount() {
  document.getElementById('ledger-count').textContent = `${PAGES.filter(reviewed).length}/${PAGES.length} reviewed`;
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name; a.click();
}
function ledgerRows() {
  const rows = [];
  for (const p of PAGES) {
    const r = ledgerGet(p.page_id);
    if (!r?.items) continue;
    for (const it of p.items) {
      const d = r.items[it.card_id];
      if (!d) continue;
      rows.push({page_id: p.page_id, page_title: p.page.title, card_id: it.card_id, study: it.original.short,
        reviewed_revision_id: r.reviewed_revision_id, live_revision_checked: r.live_revision_checked || '',
        stale_revision: r.live_revision_checked ? String(r.live_revision_checked) !== String(p.page.frozen_revid) : 'unchecked',
        decision: d, decision_label: DECISIONS[d], queue_decision: DECISION_QUEUE[d],
        checks_done: (r.checks_done?.[it.card_id] || []).length + '/' + it.suggestion.required_checks.length,
        other_fix_done: r.other_fix_done || false, draft_usefulness: r.draft_usefulness || '', reviewer: r.reviewer || '',
        updated_at: r.updated_at, model_proposed_action: it.suggestion.proposed_action, notes: r.notes || ''});
    }
  }
  return rows;
}

// ---------- welcome ----------
let STEP = 0;
function showStep(i) {
  const steps = [...document.querySelectorAll('#welcome .step')], last = steps.length - 1;
  STEP = Math.max(0, Math.min(i, last));
  steps.forEach((s, k) => s.hidden = k !== STEP);
  document.getElementById('step-count').textContent = `Step ${STEP + 1} of ${steps.length}`;
  document.getElementById('step-back').hidden = STEP === 0;
  document.getElementById('step-next').textContent = STEP === last ? 'Start reviewing' : 'Next';
  document.getElementById('welcome-close').hidden = STEP === last;
  document.querySelector('#welcome .modal-box').scrollTop = 0;
}
function openHelp() {
  const m = document.getElementById('welcome');
  document.getElementById('welcome-hide').checked = localStorage.getItem(WELCOME_KEY) === '1';
  m.hidden = false;
  showStep(0);
  document.getElementById('step-next').focus({preventScroll: true});
}
function closeHelp() {
  localStorage.setItem(WELCOME_KEY, document.getElementById('welcome-hide').checked ? '1' : '0');
  document.getElementById('welcome').hidden = true;
  document.getElementById('open-help').focus();
}

async function init() {
  DATA = await (await fetch('data/suggestions.json')).json();
  PAGES = DATA.pages;
  PAGES.sort((a, b) => (pageRepl(a) && KORDER[pageKind(a)] < 2 ? 0 : 1) - (pageRepl(b) && KORDER[pageKind(b)] < 2 ? 0 : 1) || KORDER[pageKind(a)] - KORDER[pageKind(b)] || a.page.title.localeCompare(b.page.title));
  PAGES.forEach(p => p.search = [p.page.title, ...p.items.flatMap(it => [it.original.short, it.original.citation,
    it.suggestion.rationale, ...it.occurrences.map(o => o.paragraph_plain)])].join(' ').toLowerCase());
  const rv = document.getElementById('reviewer');
  rv.value = localStorage.getItem('flora-en-edit-proto:reviewer') || '';
  rv.onchange = e => localStorage.setItem('flora-en-edit-proto:reviewer', e.target.value);
  document.getElementById('q').addEventListener('input', renderList);
  document.getElementById('toggle-filters').onclick = e => {
    const on = document.getElementById('layout').classList.toggle('show-filters');
    e.target.setAttribute('aria-expanded', on);
  };
  document.getElementById('open-help').onclick = openHelp;
  document.querySelectorAll('[data-open-help]').forEach(b => b.onclick = openHelp);
  document.getElementById('welcome-close').onclick = closeHelp;
  document.getElementById('step-back').onclick = () => showStep(STEP - 1);
  document.getElementById('step-next').onclick = () => STEP === document.querySelectorAll('#welcome .step').length - 1 ? closeHelp() : showStep(STEP + 1);
  document.getElementById('welcome').addEventListener('keydown', e => { if (e.key === 'Escape') closeHelp(); });
  document.getElementById('export-json').onclick = () => download('flora-en-ledger.json', JSON.stringify({exported_at: new Date().toISOString(), build: DATA.build_id,
    pages: PAGES.map(p => ledgerGet(p.page_id)).filter(Boolean)}, null, 2), 'application/json');
  document.getElementById('export-csv').onclick = () => {
    const rows = ledgerRows();
    const cols = ['page_id', 'page_title', 'card_id', 'study', 'reviewed_revision_id', 'live_revision_checked', 'stale_revision', 'decision', 'decision_label', 'queue_decision', 'checks_done', 'other_fix_done', 'draft_usefulness', 'reviewer', 'updated_at', 'model_proposed_action', 'notes'];
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    download('flora-en-ledger.csv', [cols.join(',')].concat(rows.map(r => cols.map(k => q(r[k])).join(','))).join('\n'), 'text/csv');
  };
  document.getElementById('import-json').onchange = async e => {
    const obj = JSON.parse(await e.target.files[0].text());
    let n = 0, skipped = 0;
    for (const r of obj.pages || []) {
      const p = PAGES.find(x => x.page_id === r.page_id);
      if (!p || String(r.reviewed_revision_id) !== String(p.page.frozen_revid)) { skipped++; continue; }
      ledgerPut(r.page_id, r); n++;
    }
    document.getElementById('summary').textContent = `Imported ${n} page reviews; skipped ${skipped} for unknown pages or a different article version.`;
    renderList();
  };
  buildSegments(); buildFilters(); renderList();
  const h = location.hash.slice(1);
  if (h && PAGES.some(p => p.page_id === h)) { SEGMENT = 'all'; buildSegments(); show(h, false); }
  // ?welcome=0 suppresses the first-visit screen (used for automated screenshots).
  if (localStorage.getItem(WELCOME_KEY) !== '1' && new URLSearchParams(location.search).get('welcome') !== '0') openHelp();
}
init();
