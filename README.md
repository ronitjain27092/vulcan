# Vulcan: unified engineer assessment

**Live URL:** _not deployed yet, see "What is not done"_ &nbsp;·&nbsp; Run locally: `python backend/app.py` then open http://localhost:8000 (after `cd ui && npm install && npm run build`).

## What I built
- **UI** (`ui/`, React + TypeScript, bundled with esbuild): Overview (hand-drawn SVG flow diagram), Incidents list, Incident detail (hand-drawn SVG curves joining three records into one device), and the new **Intelligence** page (SVG traffic chart + "one thing, two records"). Everything on the first three screens is read from `ui_fixture.json` through the API. Light theme plus a dark theme. Shared components exist once: source chips, priority badges, status dots, data table, gauge, shell/sidebar. Keyboard: skip link, visible focus, all rows are real links, controls are buttons, charts have text alternatives and the flag list is a table. Checked at 1280 and 1440 px, no horizontal page scroll.
- **Backend** (`backend/app.py`, Flask + SQLite): `/health`, `/api/overview`, `/api/incident/{id}`, `/api/series/{id}`, `/api/matches`, `POST /api/review`. Precomputed results are loaded at startup; no model runs per request. Review decisions are stored in SQLite and survive a restart (tested). Config by env: `PORT`, `DB_PATH`, `RESULTS_DIR`, `STATIC_DIR`. No secrets. 7 tests: `python -m unittest discover -s tests`.
- **Data science** (`ds/`): reproduce with `pip install -r requirements-ds.txt && python ds/match.py && python ds/run_match.py && python ds/run_anomaly.py`.

## B1. Matching (Abt ↔ Buy)
Method: blocking (top-15 by TF-IDF name similarity plus any shared model code) → 14 pair features (word/char TF-IDF cosine of names, description cosine, shared model codes, partial code match, brand, price ratio, ranks) → gradient-boosted classifier trained on the 766 known pairs → one-to-one assignment (Hungarian) against Buy records not already used by a known pair → isotonic calibration of the probability.
Evaluation: 5-fold CV grouped by Abt id on known pairs only. Test ids were never used for training, tuning or calibration; I did not look up published answers.

| | CV result |
|---|---|
| Blocking: true pair among candidates | 99.7% at ~20 candidates per record (98% fewer pairs than all-pairs) |
| F1 matching every id | 0.941 |
| F1 leaving low-confidence ids unmatched (cutoff 0.35) | **0.945** (precision 0.952, recall 0.939) |
| Auto-accept (confidence ≥ 0.90 and lead ≥ 0.25) | 81% of matches, **99% precise** |
| Sent to human review | 19% of matches, only ~79% correct if left alone |

`outputs/matches.csv` has **303 of the 324** test ids. I left 21 unmatched on purpose: the forced one-to-one assignment pairs those with unrelated products (e.g. a camcorder tape with a TV), and a wrong pair costs precision. The cutoff was picked on CV, but F1 is flat from 0.05 to 0.60, so it is not a sensitive choice. 47 of the 303 submitted pairs are flagged for review. CV is probably a little pessimistic: it has more unused Buy records to confuse with than the real test does (about 480 vs 328).

**Scaling to 100,000 × 100,000.** The code here builds dense 1k×1k similarity matrices and runs a dense Hungarian, which would not survive. What I would change: (1) blocking from an inverted index on model-code tokens and brand, plus sparse top-k TF-IDF via chunked sparse products or an ANN index (HNSW) over embeddings, or MinHash-LSH on name shingles, keeping about 20 candidates per record, so 2M scored pairs instead of 10^10; (2) features computed per candidate pair only; (3) assignment solved per connected component of the candidate graph, or greedy mutual-best, instead of globally; (4) measure blocking recall on the known pairs, as done here.

**Errors** (`outputs/ERROR_ANALYSIS.md`, 20 sampled): mostly records with no model code in one name, then differently written codes (`DSCS750` vs `DSC-750`), then lookalike accessories taking a Buy record. Blocking misses are rare. Fuzzy code comparison is the clear next step.

## B2. Anomalies
Detector (`ds/anomaly.py`): log1p transform → EWMA level plus a learned time-of-day correction → robust z-score against an EWMA of residual size → a seasonal envelope (range seen at the same time of day ±30 min on earlier days) so that scheduled spikes, like S4's daily job, are normal → flag when the score beats a threshold; one alert per hour at most; the first day is learning only. The "normal range" drawn on the page is that envelope widened by the threshold.

**How I made sure it is online.** `OnlineDetector.step(t, x)` takes one point, returns its verdict, then updates state. It is never given the array and `run_series` feeds it from a generator. `tests/test_online.py` checks that truncating a series, or multiplying everything after time t by 1000, leaves every verdict up to t bit-identical. Duplicate timestamps in S2 keep the first reading seen.

**Threshold.** Labels are held back, so the threshold cannot be tuned against them. It is the 99.8th percentile of that series' own past scores, floored at 5 and capped at 15 (an uncapped threshold was blinded by S1's genuine 2.4e8 spike), with the one-day burn-in. Target: well under one alert per day per series. Result on the real series: S1 2 alerts, S2 4, S3 0, S4 3 (0.0 to 0.24 per day). These include any real anomalies, so it is an upper bound on false alarms.

**Comparison to a naive baseline** (expanding mean ± k·σ on raw values). Real labels are unavailable, so I injected anomalies into the real series (3-day-unprecedented spikes, 2-hour surges, drops to zero; 20 seeds, 360 windows). This favours a detector that learns a normal range, so read it as "does what it was built to", not as a prediction of the held-out score.

| detector | windows caught | false alarms / day | dips caught |
|---|---|---|---|
| mine | 43% | 0.18 | 43% |
| naive 3σ | 61% | 2.12 | 18% |
| naive 8σ (similar alert volume) | 45% | 0.76 | 9% |

So: at about a quarter of the false alarms of 8σ I catch about the same share, and I catch dips the naive rule cannot. I am **worse than 3σ on recall** and I say so; 3σ would page roughly twice a day per series. Latency: first flag is in the first reading of a window in the injected test (median delay 0 min), but that test uses abrupt onsets. Weak spots: S1 and S2 are bursty, so "unprecedented" is a high bar; S3 is only 4 days so one day of burn-in is a quarter of it and it flags nothing.

## Decisions I made on the UI
- The fixture has no per-source activity series, so I **left out the sparklines** from the reference rather than invent numbers.
- "2 critical" is computed as the count of P1 incidents. The two sentences under the decision gauges are composed from fixture fields; the reference wording is not in the fixture.
- The logo is a simplified stand-in; no asset was supplied. Sidebar items outside this slice are shown disabled, not as dead links.
- Only HUBN-CORE-SW-02 has detail in the fixture; other incident links show their summary and a clear message.

## What is not done (please read)
- **Not deployed.** I built this in a sandbox with no outbound network, so there is no live URL. `Dockerfile` and `render.yaml` are provided; on Render create a Web Service from the repo, no env vars needed. The free tier disk is ephemeral, so review decisions survive a restart of the process but not a redeploy; a persistent disk or hosted Postgres fixes it.
- **TypeScript type-check not run** (`@types/react` was not available offline). The bundle builds and runs without console errors; run `npm run typecheck` once after `npm install`.
- Sources page (optional) and the device screen were not built; Snooze/Acknowledge are visible but disabled.
- No automated UI tests; I checked by screenshot and keyboard reasoning, not with a screen reader.

## With another week
Fuzzy model-code matching and a second-stage text model for the no-code group; per-series seasonal period detection and a proper evaluation on windows once labels are available; persistent storage; a UI test suite and an accessibility audit; the Sources page.

## AI tools used
Claude (Anthropic) wrote the first draft of most of the code and this README in a single working session, and ran the experiments. I directed the approach, then reviewed results and decisions. _(Candidate: edit this paragraph to say exactly what you did and checked yourself, and make sure you can explain every line.)_

Data credits: Numenta Anomaly Benchmark (MIT, Lavin & Ahmad, ICMLA 2015); Abt-Buy benchmark, Database Group Leipzig (CC BY 4.0, Köpcke, Thor, Rahm, PVLDB 2010). See `data/SOURCES.md`.
