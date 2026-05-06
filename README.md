# flora-wikipedia

Audit of Wikipedia's coverage of replication studies catalogued in the FReD
project ([forrtproject/FReD-data](https://github.com/forrtproject/FReD-data)).

For each (original study, replication study) DOI pair in `flora.csv`, this
pipeline finds every English Wikipedia article that cites the original and
checks whether the same article also cites the replication.

## Headline finding (pilot, English Wikipedia, 2026-05-05)

- **422 / 1,797** unique original studies (23.5%) are cited on enwiki.
- Of those, only **54 (12.8%)** have a replication co-cited on the same page.
  The remaining 87% present the original finding without acknowledging the
  replication.
- Failed-replication originals are *more* likely to be on Wikipedia (28%) than
  successful ones (21%), and slightly more likely to be co-cited with their
  replication (16% vs 12%) — but absolute rates are low across all outcomes.

Full write-up in [`output/REPORT.md`](output/REPORT.md).

## Pipeline

| Stage | Script | What it does |
|---|---|---|
| 0 | `R/00_config.R` | shared deps, paths, DOI normalisation |
| 1 | `R/01_load_flora.R` | download flora.csv, dedupe DOIs |
| 2 | `R/02_exturlusage.R` + `R/run_stage1.R` | MediaWiki `list=exturlusage` query for every unique DOI on enwiki, both `/` and `%2F`-encoded forms |
| 3 | `R/03_wikitext.R` | fetch wikitext for every candidate page, cache by `(lang, pageid)` |
| 4 | `R/04_extract_dois.R` | regex-extract every DOI present in each cached article |
| 5 | `R/05_audit.R` | join with flora to compute per-pair `r_also_cited`; pull `<ref>` block + section + paragraph for every hit |
| 6 | `R/06_analysis.R` | per-original summary, breakdown by outcome |
| 7 | `R/07_openalex.R` | OpenAlex `cited_by_count` for every unique DOI (batched, ~1 min) |
| 8 | `R/08_estimate_misses.R` | Wikipedia presence by citation tier; title-search the top high-cited DOI-misses to estimate the DOI-pipeline miss rate |

Run end-to-end: `Rscript R/01_load_flora.R && Rscript R/run_stage1.R && Rscript R/run_stages_2_to_6.R && Rscript R/06_analysis.R && Rscript R/07_openalex.R && Rscript R/08_estimate_misses.R`.
Stage 1 takes ~35 min wall-clock at the API's 200 req/min rate limit; the
rest is local.

## Browse the recommendations

A static editor-facing site is auto-deployed to GitHub Pages from `web/`:
**https://lukaswallrich.github.io/flora-wikipedia/**. Each card shows a
Wikipedia article, the original it cites, the missing replication, a
sentence the editor could insert, and a `{{cite journal}}` ref block ready
to paste — plus a one-click link to the article's edit view.

## Outputs

- `output/REPORT.md` — written summary
- `output/flora_wikipedia_audit.csv` — one row per (doi_o, doi_r) pair: citing
  pages, `r_also_cited`, outcome metadata
- `output/per_original_summary.csv` — one row per unique original DOI
- `output/citation_contexts.csv` — for every hit, the `<ref>` block, section
  heading, and surrounding paragraph

## Caveats

- **enwiki only** — the multilingual extension (de/fr/es/it/nl/pt/ru/ja/zh)
  is supported by the same code; just call `run_exturlusage()` with a
  different `lang`. Roughly +6 h wall-clock for all nine.
- **Current revision only** — we don't yet check whether a citation was added
  before or after the replication was published, so we can't separate
  genuine editorial neglect from stale-citation lag.
- **DOI string match** — a paper discussed in prose without a structured cite
  is not detected.

## Source

[`flora.csv`](https://github.com/forrtproject/FReD-data/blob/main/output/flora.csv)
from the FReD project (FORRT Replication Database).
