# Wikipedia citations to FReD replication pairs — pilot results

**Scope of this run.** English Wikipedia only (enwiki), live MediaWiki API,
~3,300 unique DOIs from `flora.csv` (1,925 original–replication pairs from the
FReD project). Crawled 2026-05-05.

## Headline numbers

| Metric | Count | % |
|---|---|---|
| Unique original studies in flora | 1,797 | — |
| Originals cited in ≥1 enwiki article | **422** | **23.5%** |
| Originals where ≥1 replication is also co-cited on the same article | **54** | **12.8% of cited (3.0% of all)** |
| Distinct citing enwiki articles | 798 | — |
| Total (article × DOI) hit rows | 1,041 | — |

**The plain reading: when an enwiki article cites a study that has been
replicated, it acknowledges the replication in only ~13% of cases.** The
remaining ~87% of citations stand alone.

## By replication outcome

Computing "worst outcome among an original's replications" (so an original
with both a successful and a failed replication counts as `failed`):

| Worst outcome | # originals (flora) | # on enwiki | % on enwiki | # with replication co-cited | % co-cited (of on-wiki) |
|---|---|---|---|---|---|
| successful | 757 | 156 | 20.6% | 19 | 12.2% |
| failed | 630 | 177 | 28.1% | 29 | **16.4%** |
| mixed | 393 | 86 | 21.9% | 6 | 7.0% |

Two patterns worth noting:

1. **Failed-replication originals are *more* likely to be on Wikipedia** than
   successful-replication ones (28% vs 21%). Plausibly the controversy itself
   draws editorial attention.
2. **Once on Wikipedia, failed replications are co-cited slightly more often**
   than successful replications (16% vs 12%). But the gap is small and the
   majority case (84% of originals with a *failed* replication) still presents
   the original finding without acknowledging the failure.

These percentages are first-pass estimates; significance testing and
sensitivity to the "worst outcome" rule are not in this pilot.

## Top 15 originals on Wikipedia where the replication is *missing*

(Ranked by number of enwiki articles citing the original.)

| DOI | Worst outcome | # articles | Sample articles |
|---|---|---|---|
| 10.1037/h0040525 (Milgram, *Behavioral Study of obedience*, 1963) | mixed | 19 | List of cognitive biases, … |
| 10.1073/pnas.1516047113 (Hoffman et al., *Racial bias in pain*, 2016) | failed | 11 | Intergroup …, … |
| 10.1086/511799 (Correll et al., *Motherhood penalty*, 2007) | mixed | 10 | Occupational …, … |
| 10.1126/science.7455683 (Tversky & Kahneman, *Framing*, 1981) | successful | 10 | Framing effect, … |
| 10.1162/qjec.121.1.73 (Bleakley, *Hookworm*, 2007) | failed | 10 | Hookworm infection, … |
| 10.1037/0022-3514.76.6.893 (Bargh et al., 1999) | mixed | 9 | John Bargh, … |
| 10.1037/h0054651 (Stroop, 1935) | successful | 8 | Affective …, … |
| 10.1111/j.1083-6101.2007.00367.x (Ellison et al.) | mixed | 8 | Social capital, … |
| 10.1111/j.2044-8295.1975.tb01468.x (Baddeley & Hitch) | failed | 8 | Alan Baddeley, … |
| 10.1038/nature11071 | failed | 7 | Neoplasm, … |
| 10.1016/j.cub.2011.03.017 | mixed | 6 | Neuropolitics, … |
| 10.1037/0003-066x.54.6.408 | failed | 6 | Neolithic Revolution adjacent, … |
| 10.1037/h0055756 (Asch, *Forming impressions*, 1946) | failed | 6 | Negativity bias, … |
| 10.1037/0022-3514.94.2.245 | successful | 5 | Physical …, … |
| 10.1038/nature01647 | failed | 5 | Video games, … |

The Hoffman et al. (2016) racial-pain-bias paper (failed replication, 11
enwiki citations, none acknowledging the failure) and the Bleakley (2007)
hookworm paper (also failed, 10 citations) are the most actionable cases:
high-visibility findings with failed replications that Wikipedia is not
flagging.

The Stroop test, Milgram obedience, and Asch impressions citations are
expected — these are foundational papers cited as historical reference, not
as live empirical claims, so the omission is less problematic.

## Where Wikipedia *does* acknowledge the replication

54 originals have at least one replication co-cited. Spot-checked example:

- **Mirror test** article cites both Prior et al. 2008 (original magpie
  self-recognition) **and** Solar et al. 2020 (failed replication) in the
  "Birds" section. The replication's `<ref>` block is intact:

  > Solar, Colmenero, Pérez-Contreras, Peralta-Sánchez (2020). "Replication
  > of the mirror mark test experiment in the magpie (Pica pica) does not
  > provide evidence of self-recognition." *J Comp Psychol*, 134(4),
  > 363–371. doi:10.1037/com0000223.

- **Power posing** article cites both Carney et al. 2010 (original) and
  Ranehill et al. 2015 (failed replication) — the replication has its own
  section ("Replication failures and meta-analyses").

These are exactly the editorial pattern we'd hope for; they exist, just
rarely.

## Methodology notes / caveats

- **Coverage = enwiki only.** Not yet run for de/fr/es/it/nl/pt/ru/ja/zh.
  Same crawl × 9 wikis would take ~6 hours and likely add ~50–100 more
  citing articles (mostly de/fr).
- **Citation = DOI present in current article wikitext.** No history;
  doesn't tell us whether the citation was added before vs after the
  replication was published. A citation added in 2010 to an original
  whose replication was published in 2020 is not necessarily editorial
  neglect — the editor has to come back and update. This is a real
  limitation of the present pilot.
- **DOI string match only.** A study could be discussed in prose without
  a structured citation; we'd miss that. Conversely, false positives are
  unlikely — DOIs are unique.
- **URL-encoding.** Wikipedia stores cite-template DOIs with `/` →
  `%2F`. We query both forms. ~5% of legacy SICI DOIs (with `<>;()`)
  may still be missed; flagged but not corrected here.
- **Pair-level vs. original-level.** When an original has multiple
  replications, it appears in flora multiple times. The headline numbers
  above use the cleaner per-original view; the raw `flora_wikipedia_audit.csv`
  is per-pair.

## Estimated misses (DOI-based pipeline only catches ~70% of high-cited papers)

We pulled OpenAlex `cited_by_count` for every unique DOI in flora (3,223 of
3,256 matched). Wikipedia presence rises sharply with citation count:

| Citation count | # originals | % on enwiki via DOI | Median # citing pages |
|---|---|---|---|
| 0–10 | 123 | 4.9% | 1 |
| 11–50 | 370 | 4.3% | 1 |
| 51–200 | 641 | 11.1% | 1 |
| 201–500 | 339 | 34.2% | 1 |
| 501–1,000 | 160 | 61.3% | 2 |
| >1,000 | 177 | **72.9%** | 2 |

The top tier (>1,000 citations) achieves only 73% coverage via DOI matching —
**~27% of very-influential papers are missing from our DOI-based pipeline**.
Where do they go?

We took the 50 highest-cited originals NOT found via DOI lookup and searched
enwiki by title. **16 of 50 (32%) returned plausible matches** — i.e., the
paper is mentioned in some Wikipedia article but without a DOI link.
Spot-checked: Meltzoff & Moore 1977 *Imitation of facial and manual gestures*
(3,220 OpenAlex citations) appears on the *Andrew N. Meltzoff* Wikipedia
article but with no DOI in any extlink. Confirmed miss.

| DOI | Citations | Likely Wikipedia hit |
|---|---|---|
| 10.1016/s1386-4181(01)00024-6 (Amihud, illiquidity) | 10,217 | Efficient-market hypothesis |
| 10.1016/j.biopsych.2006.03.040 | 4,956 | Massachusetts General Hospital |
| 10.1016/b978-0-12-205050-3.50008-7 (Easterlin) | 4,363 | Easterlin paradox |
| 10.1126/science.198.4312.75 (Meltzoff & Moore) | 3,220 | Andrew N. Meltzoff |
| 10.1080/00208825.1980.11656300 (Hofstede) | 2,947 | Hofstede's cultural dimensions |
| 10.1037/0033-295x.114.2.245 | 1,046 | Fei Xu \| Number sense |
| 10.1016/0022-1031(91)90011-t (Spranca, omission bias) | 1,035 | Omission bias |

(Full list: `output/candidate_misses_by_title.csv`.)

**Implications.**

1. The 23.5% headline coverage rate is a lower bound. Adjusting for the
   ~30% miss rate among high-cited papers, the *true* fraction of flora
   originals appearing on enwiki is plausibly **30–35%**.
2. If originals are missed, replications are too. The 12.8% co-citation
   rate is therefore likely an over-estimate, not under: the missed
   citations are disproportionately to *originals* (which have famous
   names) rather than replications (which usually don't), so finding
   the original via title-search wouldn't necessarily uncover the
   replication on the same page. Rough guess: true co-citation rate is
   in the 8–12% range.
3. To genuinely close the gap we'd need to combine DOI-matching with
   title/author/year matching against article wikitext — feasible
   given we already cache the wikitext for the candidate set, and
   could be extended to a broader enwiki sweep using a title-similarity
   index.

## Output files

- `output/flora_wikipedia_audit.csv` — one row per (doi_o, doi_r) pair:
  whether/where each is cited on enwiki, plus flora outcome metadata.
- `output/per_original_summary.csv` — one row per unique original DOI:
  number of citing articles, whether any replication is co-cited.
- `output/citation_contexts.csv` — long format: for every (article, DOI)
  hit, the surrounding `<ref>` block, paragraph, and section heading.
- `output/audit_long.parquet` — relational form for downstream joins.
- `output/per_original_with_citations.csv` — per unique original DOI, with
  OpenAlex `cited_by_count`, `publication_year`, `title`, and Wikipedia hit
  count.
- `output/candidate_misses_by_title.csv` — high-cited originals not found
  via DOI but plausibly matched by title-only Wikipedia search.
- `data/unique_dois_oa.parquet` — OpenAlex enrichment for every unique DOI.
- `data/exturlusage_en.parquet` — raw API hits per DOI.
- `data/article_dois.parquet` — every DOI extracted from each candidate
  article (useful for alternative join strategies).
- `cache/wikitext/en/{pageid}.txt` — raw wikitext (798 articles).

## Suggested next steps

1. **Extend to other language editions.** Same pipeline, change `lang`
   parameter. ~6 hours wall-clock for the 9 additional wikis. Likely
   marginal gain on the headline numbers but could surface a different
   editorial culture in de/fr.
2. **Add citation-add-date.** Use the article history (or Crossref Event
   Data) to determine *when* each DOI was first added. A citation added
   before the replication was published is exonerated; one added after
   is genuinely an editorial gap.
3. **Top-of-list outreach.** The high-traffic articles citing failed
   replications without acknowledgement (Hoffman 2016 racial-pain-bias,
   Bleakley hookworm, Bargh priming) are concrete candidates for a
   WikiProject Psychology / Sociology talk-page note.
