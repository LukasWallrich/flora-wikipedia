"""Generate the method, coverage and route-comparison page from recorded products."""
import collections
import csv
import json

from common import RUN, load_json

STRATUM = {'central_effect': 'Central effect/paper page', 'broad_topic': 'Broad topic page', 'biography': 'Biography',
           'biomedical': 'Biomedical (gene/drug/protein)', 'history_list': 'History, timeline or list page',
           'list_or_bibliography': 'Bibliography or list entry only', 'co_cited': 'Original and replication both cited'}


def table(header, rows):
    out = ['| ' + ' | '.join(header) + ' |', '|' + '---|' * len(header)]
    out += ['| ' + ' | '.join(str(x) for x in r) + ' |' for r in rows]
    return '\n'.join(out)


def about_md(data):
    c = data['counts']
    sel = load_json(RUN / 'selection.json')
    rc = load_json(RUN / 'route_comparison.json')
    ledger = load_json(RUN / 'cost-ledger.json', {})
    manual = load_json(RUN / 'manual-inspection.json', {})
    feats = list(csv.DictReader((RUN / 'packet_features.csv').open()))
    pages_by_kind = collections.Counter()
    seen = set()
    for f in feats:
        if f['pageid'] not in seen:
            seen.add(f['pageid'])
            pages_by_kind[f['page_kind']] += 1
    inline_pages = len({f['pageid'] for f in feats if f['context_kind'] == 'inline'})
    cards = data['cards']
    src_levels = collections.Counter()
    for card in cards:
        src_levels['original: ' + card['original']['evidence_level']] += 1
        for r in card['replications']:
            src_levels['replication: ' + r['evidence_level']] += 1
    n = c['cards']
    nochange = c['proposed_action'].get('no_change', 0)
    defer = c['proposed_action'].get('defer', 0)
    edits = n - nochange - defer - c['proposed_action'].get('talk_page', 0)
    L = []
    L += ['## Status',
          f"This page describes build `{data['build_id']}` ({data['built_at']}). It contains {n} model-drafted "
          f"suggestion cards for {c['distinct_pages']} distinct English Wikipedia pages. They are private research "
          'and review material: model review, not independent human adjudication, and not for publication. '
          'Nothing in this prototype edits Wikipedia or Wikidata, posts messages, or copies text into an editor.', '',
          f"Of the {n} cards, {edits} propose an article change (contextualise, narrow, replace or upgrade a source, "
          f"or remove an unsupported claim or citation), {c['proposed_action'].get('talk_page', 0)} propose talk-page "
          f"discussion, {defer} defer, and {nochange} recommend no change. We report the no-change and defer cards "
          'deliberately: in most of them the citation is accurate in context, and dropping a card from the queue '
          'never removes article content or an audit observation.', '',
          f"Cards are grouped by article: the {c['distinct_pages']} pages carry {c['items']} studies from the database "
          f"({c['pages_with_several_studies']} pages cite more than one), drafted together so that suggestions for the "
          f"same page do not repeat or contradict each other. {c['pages_with_edit']} pages have at least one suggested "
          f"edit; {c['pages_with_adjacent']} pages also list other problems the reviewing model verified in the article "
          '(for example mismatched DOIs, a garbled citation title, a sentence contradicted by the article\'s own table).', '',
          'Since brief v5 (10 October 2026) each suggestion has a strength assigned by rule: a fix (the article says '
          'something its cited source contradicts or does not support, or a citation sits on the wrong claim); a '
          'recommended addition (the article uses the study as evidence, a replication or reanalysis directly tested '
          'that claim and failed, found a clearly smaller effect or materially qualified it, and the article does not '
          'say so); an optional addition (the article is accurate and the sentence would only confirm or enrich it); '
          'or none. Additions are not proposed on biographies, lists, timelines or passing mentions. Every page was '
          f"drafted twice by independent runs of the same route. Of {c['two_runs']} studies drafted twice, the runs "
          f"reached the same class (edit, optional, none) for {c['two_runs_agree']}; the other "
          f"{c['two_runs'] - c['two_runs_agree']} are shown as judgement calls with both readings. Where runs differ "
          'the card shows the run that proposes more.', '',
          'Since brief v4 the pipeline also does the source work: agents searched for legitimate free copies '
          '(author and lab pages, university repositories, preprint and working-paper servers) of every paper we '
          'had only as an abstract, and the drafting model verified each factual claim it relies on, or that the '
          'article makes about the study, against the papers. Each card lists these checks with verdicts and the '
          'quoted passage, matched word for word; contributors are not asked to re-check facts. Papers we could not '
          'obtain are listed in the downloads (papers-not-obtained.csv).', '',
          'Since 9 October 2026 (brief v3) the pipeline does the review search itself: for each replication it fetched '
          'the most likely review articles (works citing both the original and the replication, then reviews of the '
          'original), searched them for the replication, and passed the results to the drafting model. Suggestions only '
          'cite sources that were actually read, contain no placeholder citations, and list concrete checks (a named '
          'sentence, source and fact) rather than open-ended tasks such as "find a review". Where no review covers a '
          'replication, the suggestion relies on what exists: narrowing the claim to the cited study, an attributed '
          'sentence citing the replication where the article is about that effect, or no change.', '',
          table(['Proposed action', 'Cards'], sorted(c['proposed_action'].items())), '',
          table(['Model queue recommendation', 'Cards'], sorted(c['queue_recommendation'].items())), '',
          table(['Draft status', 'Cards'], sorted(c['draft_status'].items())), '']
    L += ['## Inputs and freshness',
          'The cards reuse the complete English audit `runs/english-full-gh/en` (FLoRA file commit '
          '`717fbaf0a35dc662e276d5860dba7faaf7142f93`, SHA-256 `28748e8c…`) and its claim-review packets. In that '
          'audit, 586 of the 2,567 FLoRA originals in scope had a detected DOI on at least one English page '
          '(979 pages, 1,193 page–original combinations). These are counts of DOI strings, not of substantive '
          'citations or acknowledgement.', '',
          'On 6 October 2026 we pinned the current upstream FLoRA file under a new name '
          '(`runs/inputs/flora-latest-20261006.csv`, commit `19012dfaabd54432955d2b1d39cd43da6c76f7c3`). It differs '
          'from the audited snapshot in a single metadata cell (`journal_r` for one pair changed from "OSF" to NA); '
          'pairs, DOIs and outcome fields are identical, so no new inventory was run.', '',
          f"Article text comes from the frozen revisions in the audit cache. On {cards[0]['live_check']['checked_at'][:10]} "
          f"we re-queried the current revision IDs of all selected pages: {c['revised_since_frozen']} page(s) had changed "
          'since the reviewed revision. For those, the card records whether the original DOI and the focal paragraph '
          'still appear in the live text. Every card links to the reviewed revision, the live article and the diff.', '']
    L += ['## How pages were selected',
          'Selection is outcome-blind. Each English page–original packet received screening features from the '
          'frozen wikitext: page kind (heuristic), whether the original DOI sits in visible prose, a list or '
          'bibliography, or a comment, and flags for living people and health terms. One focal packet per page was '
          'chosen (visible prose preferred), and strata were filled in a fixed SHA-256 order of '
          f"`{sel['salt']}` + packet ID. FLoRA outcome codes were never a ranking or filtering key; a test checks "
          'that swapping failed and successful labels leaves the selection unchanged.', '',
          table(['Stratum', 'Quota', 'Selected', 'Pages of this kind in audit'],
                [(STRATUM[k], q, c['stratum'].get(k, 0),
                  pages_by_kind.get(k, '–') if k in pages_by_kind else ('n/a (context-based)'))
                 for k, q in sel['quotas'].items()]), '',
          f"{inline_pages} of the 979 audited pages cite an original in visible prose. Page kinds are heuristics "
          '(for example, "central effect" requires the page title to appear in a study title); the drafting model '
          'reclassified scope and citation function for each card, and those classifications are what the filters '
          'show. Coverage limits: the sample is small and stratified, so the action counts above describe this '
          'sample, not English Wikipedia as a whole. Pages with several FLoRA originals have one card each; the '
          'other originals are listed on the card but not reviewed. DOI-free citations and claims are outside the '
          'audit and therefore outside this sample.', '']
    L += ['## Evidence available to the drafters',
          'For each card we cached Crossref metadata, Europe PMC and OpenAlex records, abstracts, and open-access '
          'full text where it was available (Europe PMC XML or an open PDF), each with its retrieval time. Requests '
          'were serial and paced per host. OpenAlex leads (reviews citing the original, and works citing both the '
          'original and the replication) are listed on each card as uninspected leads, not verified sources.', '',
          table(['Source role and best evidence level', 'Count'], sorted(src_levels.items())), '',
          'Most originals were available only as abstracts. A card that relies on abstract-only evidence says so, '
          'and its required checks ask a human to read the full text before acting. Source excerpts shown on '
          'cards were checked to occur verbatim in the cached abstract or full text.', '']
    ft = load_json(RUN / 'ft-skill' / 'summary.json')
    if ft:
        r = ft['results']
        L += ['## Full-text retrieval experiment',
              f"After the first build we tried the download-paper skill on every source the drafters had seen only as an "
              f"abstract or metadata ({ft['targets']} DOIs), using free routes only. It returned usable text for "
              f"{ft['usable_text']} ({ft['usable_by_role']['original']} originals, {ft['usable_by_role']['replication']} "
              f"replications) in {ft['wall_clock_seconds'] // 60} minutes. Almost all failures were paywalled APA, SAGE, "
              'Elsevier and Wiley papers; the skill\'s institutional-browser step only runs on macOS. Four of the '
              'retrieved files were supplementary material rather than the article, and several were working papers '
              'or author manuscripts; the identity check accepted them because titles matched.', '',
              f"Before any full text was read, gpt-6.1-sol predicted from abstracts which cards full text would change. "
              f"Then {ft['cards_gaining_full_text']} cards were re-drafted twice by the same route: with the full text "
              'and, as a control, without it. A gpt-6.1-sol judge compared each pair against the full-text files, and '
              'the orchestrator verified four verdicts in the files.', '',
              f"Full text produced a meaningful change on {r['meaningful_change_attributable_to_full_text']} of "
              f"{ft['cards_gaining_full_text']} cards. Most changes resolved or sharpened checks (for example, the C-Raf "
              'structure citation turned out to be supported by the paper\'s supplement). One card changed action and '
              'queue decision (Door-in-the-face: the replication tested a different study from the one the article '
              'describes), and one draft no longer needed to be conditional (Facial feedback). '
              f"{r['rerun_noise_note']} {ft['triage']['note']}", '',
              '**Implication.** ' + ft['recommendation'], '']
    routes = rc['routes']
    L += ['## Drafting routes: pilot comparison and decision',
          f"We gave three routes the identical prompt and evidence for the same five pilot pages, chosen to span "
          f"roles: {'; '.join(rc['pilot_cards'].values())}. {rc['scale']}", '',
          table(['Route', 'Model and settings', 'Billing route', 'Mean seconds per card', 'First-pass valid',
                 'Score (of 50)'],
                [(r, v['model'], v['billing'], v['mean_seconds'], v['first_pass_schema_and_grounding_valid'],
                  v['total']) for r, v in routes.items()]), '',
          table(['Pilot page'] + list(routes),
                [(rc['pilot_cards'][cid].split(' (')[0],
                  *[f"{routes[r]['scores'][cid]['total']}: {routes[r]['scores'][cid]['note']}" for r in routes])
                 for cid in rc['pilot_cards']]), '',
          '**Decision.** ' + rc['decision'], '',
          'In the first full run (brief v2, one card per study) the Codex route drafted all 52 focal studies '
          'independently as a second opinion; that comparison is summarised below and kept in the downloads. The '
          'current page-level drafts (brief v3) were produced by the Claude route alone.', '',
          (f"Grouping actions as edit, no change or defer, the routes agreed on {rc['full_run']['same_category_edit_nochange_defer']} "
           f"of {rc['full_run']['cards']} cards. {rc['full_run']['note']} Codex took {rc['full_run']['codex_mean_seconds']} seconds "
           'per card on average. The orchestrator adjudicated the substantive disagreements in its review notes.'
           if rc.get('full_run') else ''), '']
    if manual:
        L += ['## Orchestrator review and manual inspection',
              manual.get('summary', ''), '',
              table(['Page', 'Role checked', 'What was verified', 'Outcome'],
                    [(m['page'], m['role'], m['orchestrator_reading'] + ' Live: ' + m['claim_quotes_in_live'] + ' claim quotes present; DOI cited: ' + str(m['original_doi_in_live']) + '.', m['outcome']) for m in manual.get('inspected', [])]), '']
    L += ['## Policy basis for handling the drafts',
          'English Wikipedia prohibits using LLMs to generate or rewrite article content, except for copyediting '
          "one's own writing and translation ([WP:NOLLM](https://en.wikipedia.org/wiki/Wikipedia:Writing_articles_with_large_language_models), "
          'revision 1378473005 of 4 October 2026, checked 6 October 2026). Obviously generated talk-page comments '
          'may be collapsed (Talk page guidelines, revision 1378840295). The model wording on these cards is therefore '
          'an illustration of what the sources might support, for private review. Contributors write their own '
          'text from sources they have read, using the [contributor workflow](guide.html). This is stricter than '
          'asking a human to click "save": a human click does not make generated text the editor\'s own, and '
          'repetitive list-driven editing can be treated as bot-like (Bot policy, revision 1372438517). Ordinary '
          'source-led editing prompted by a review queue is not bot editing.', '']
    if ledger:
        L += ['## Cost',
              f"Cumulative incremental metered API spend for this task: **US${ledger['cumulative_task_metered_api_cost_usd']:.2f}** "
              f"(cap US${ledger['cap_usd']:.2f}). {ledger.get('summary', '')}", '']
    L += ['## Reproduce',
          '```sh', 'bash prototype/build.sh            # offline rebuild from caches and drafts',
          'bash prototype/build.sh --refresh-live   # also re-query current revision IDs (Wikipedia read API)',
          'python3 tests/test_edit_prototype.py', '```', '',
          'Drafting is restartable: `prototype/run_route.py` skips cards whose draft already parses; Claude '
          'sub-agent drafts were produced from the same rendered prompts (`drafts/claude/*.prompt.txt`).', '']
    L += ['## What still needs humans',
          '- Read each article, its talk page and the full text of the sources before acting; most cards rely on abstracts.',
          '- Find and read secondary sources for any statement about the state of the evidence.',
          '- Confirm specific-study matches, especially where the replication abstract does not name the original.',
          '- Apply WP:BLP and WP:MEDRS judgements on flagged cards.',
          '- Independent human adjudication (two reviewers) of the retain/drop/defer decisions before any backlog '
          'is shared with participants; this prototype provides model review only.',
          '- Recheck policies and current revisions close to any event.']
    return '\n'.join(L) + '\n'
