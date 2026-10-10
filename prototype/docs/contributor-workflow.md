## What these cards are

Each card describes one English Wikipedia article and every study on it that is
listed in FLoRA (the FORRT Library of Replication Attempts). A language model
read the article passage and the sources we could retrieve, then proposed what,
if anything, a careful editor might change. The cards are private research
material. They are model review, not human adjudication, and they are not
instructions to edit.

A FLoRA match is a screening signal. The absence of a replication DOI on a page
does not show that the article ignores replication evidence, and a failed
replication does not by itself make a claim wrong. Many cards therefore
recommend no change, and we report those as useful outcomes.

## The rule on generated text

English Wikipedia prohibits using large language models to generate or rewrite
article content, apart from copyediting your own writing and translation
([WP:NOLLM](https://en.wikipedia.org/wiki/Wikipedia:Writing_articles_with_large_language_models),
revision 1378473005, checked 6 October 2026). Persistent use outside those
exceptions is treated as disruptive. Talk-page comments that are obviously
generated can be collapsed
([WP:AITALK](https://en.wikipedia.org/wiki/Wikipedia:Talk_page_guidelines#LLM-generated),
revision 1378840295).

The model wording on each card therefore shows what the sources might support
and where a change would go. Do not paste it into an article, an edit summary or
a talk page, and do not lightly reword it. Use it to check your own reading,
then write your own text from the sources you have read. If you find yourself
unable to write the change without the model text, the change is not ready.

Clicking "save" yourself does not turn a generated suggestion into your own
work, and making many similar edits from a list can be treated as bot-like
editing ([WP:MEATBOT](https://en.wikipedia.org/wiki/Wikipedia:Bot_policy#Bot-like_editing "Bot policy revision 1372438517, section Bot-like editing")).
The prototype has no edit, submit or copy-to-Wikipedia function by design.

## Working through a card

1. **Open the reviewed revision and the live article.** Use "Changes since
   review" to see whether the passage has changed. If it has, re-read the current
   text; the card describes the older revision only.
2. **Read the whole section and the talk page**, including archives, for earlier
   discussion of the study or its replications. Existing consensus takes
   precedence over our queue.
3. **Identify the claim.** Which sentence does the citation support, and is it
   presented as current empirical fact, as history ("X first proposed…"), as an
   example, or only as a bibliography entry? Historical wording that is used to
   support a present-day claim counts as current support.
4. **Use "What we checked".** Before you see a card, the pipeline obtained the
   papers it could (open-access copies, author and repository versions) and the
   model checked the facts the suggestion relies on against them. Each check shows
   its verdict and the quoted passage, matched word for word. You do not need to
   repeat these checks; if a quote looks wrong or out of context, say so in your
   notes. Each check is labelled with what was read. A clear abstract is used for
   what it plainly states (what was tested, in whom, the main result); details
   beyond the abstract are only stated where the full paper was read. If neither
   could be obtained, the card says so in one line.
5. **Weigh the evidence.** A single replication is a primary source: it can
   support a short, attributed, descriptive sentence in an article about that
   effect, but not a conclusion about "the evidence". Review articles the pipeline
   found that discuss the replication are listed on the card. Do not ask other
   Wikipedia editors to check sources for you.
6. **Decide on the smallest change that makes the claim accurate.** The options
   are: no change; add context; narrow the wording; replace or upgrade the
   source; remove an unsupported claim or citation (only where the source does
   not support it, never merely because a replication failed); or open a
   talk-page discussion. Deferring is a good choice when you lack source access
   or subject expertise.
   Each suggestion carries a strength. A **fix** means the article says
   something its cited source contradicts or does not support. A **recommended
   addition** means the article relies on the study and leaves out a replication
   that tested the same claim and failed or clearly qualified it. An **optional
   addition** means the article is accurate and the extra sentence is your
   choice. Each page was drafted twice; where the two runs disagreed the card is
   marked **judgement call** and shows both readings.
7. **Write in your own words**, matching the article's variety of English, tone
   and citation style. Attribute primary findings in text ("A 2016 preregistered
   replication by … found …"), avoid weasel words, and keep due weight: a
   tangential mention usually needs at most a narrower claim, not a new paragraph
   on replication.
8. **Record your decision** for each study on the card (edit, talk page, no
   change, needs more checking, or skip; give a reason when you disagree with
   the suggestion) and export it. The record notes which article version you
   reviewed.

## Extra care

- **Living people (WP:BLP).** Replication outcomes concern findings, not people.
  Do not imply misconduct or incompetence unless high-quality sources say so
  directly, and do not add replication material to a biography unless it is
  about that person's work and has secondary coverage.
- **Health and biomedical content (WP:MEDRS).** Use recent systematic reviews,
  meta-analyses and major textbooks. Primary studies and single replications,
  including Reproducibility Project: Cancer Biology papers, are generally not
  adequate sources for biomedical claims.
- **Conflicts of interest.** If you are an author of a study on the card, or the
  edit would promote FORRT/FLoRA or your own papers, do not review that card;
  disclose the connection and use an edit request on the talk page rather than
  editing directly. Disclose paid or funded editing as the Wikimedia Terms of Use
  require
  ([WP:COI](https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest)).
  Do not cite FLoRA itself as a source.
- **Disagreement.** If an edit is reverted or challenged, discuss it on the talk
  page; do not organise others to restore it.

## What is not checked by the pipeline

The pipeline checks that quoted article text and source excerpts occur verbatim
in the cached revision and source texts, that cited DOIs come from the evidence
packet or the article, and that the claimed evidence level matches what was
retrieved. It does not check whether the model understood the sources, whether a
secondary literature exists, or whether the suggestion is what an experienced
editor would do. Those are your checks.
