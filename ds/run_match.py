import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from match import *

oof = pd.read_csv(f'{ROOT}/outputs/cv_predictions.csv')
# calibration: raw prob -> P(correct), fitted on out-of-fold predictions only
iso = IsotonicRegression(out_of_bounds='clip', y_min=0, y_max=1).fit(oof.prob, oof.correct.astype(float))
oof['conf'] = iso.predict(oof.prob)
# abstention: leave an Abt id unmatched when calibrated confidence is below a cutoff chosen to maximise OOF F1
N_ALL = len(oof); OOF_ALL = oof.copy()
def f1_at(c):
    k = OOF_ALL[OOF_ALL.conf >= c]; p = k.correct.mean() if len(k) else 0; r = k.correct.sum() / N_ALL
    return 2 * p * r / (p + r) if p + r else 0
grid = [round(x, 2) for x in np.arange(0, 0.85, 0.05)]
cut = float(max(grid, key=lambda c: (round(f1_at(c), 4), -c)))
print('cutoff grid (F1):', {c: round(f1_at(c), 3) for c in grid}); print('chosen cutoff', cut)
kept = oof[oof.conf >= cut]
# review rule, chosen on OOF: auto-accept if conf >= 0.90 AND margin over runner-up >= 0.25
oof = oof[oof.conf >= cut].copy()
rule = (oof.conf >= 0.90) & (oof.margin >= 0.25)
auto, rev = oof[rule], oof[~rule]
rule_stats = dict(rule='auto-accept if calibrated confidence >= 0.90 and margin >= 0.25, otherwise human review',
                  cv_auto_share=round(float(rule.mean()), 3), cv_auto_precision=round(float(auto.correct.mean()), 3),
                  cv_review_share=round(float((~rule).mean()), 3), cv_review_accuracy_if_unreviewed=round(float(rev.correct.mean()), 3),
                  cv_f1_matching_everything=round(f1_at(0.0), 3), abstain_below_confidence=float(cut),
                  cv_f1_with_abstention=round(float(f1_at(cut)), 3), cv_precision_with_abstention=round(float(kept.correct.mean()), 3), cv_recall_with_abstention=round(float(kept.correct.sum() / N_ALL), 3))
print(rule_stats)

# ---- final model on ALL known pairs, then the test ids ----
kn = np.array(list(truth))
X, meta = pair_table(kn); y = np.array([truth[i] == j for i, j in meta]); model = new_model().fit(X, y)
test_i = [aid2i[a] for a in test_ids if a in aid2i]
Xt, mt = pair_table(test_i); pt = model.predict_proba(Xt)[:, 1]
allowed = set(range(len(buy))) - {truth[i] for i in kn}
res = assign(mt, pt, allowed)
rows = []
for i, (j, p, mg) in res.items():
    conf = float(iso.predict([p])[0]); review = not (conf >= 0.90 and mg >= 0.25)
    rows.append(dict(idAbt=int(abt.id.iloc[i]), idBuy=int(buy.id.iloc[j]), confidence=round(conf, 3), margin=round(float(mg), 3), review=bool(review), i=i, j=j))
M_all = pd.DataFrame(rows).sort_values('idAbt'); M = M_all[M_all.confidence >= cut].copy()
rule_stats['test_ids'] = len(test_ids); rule_stats['test_matched'] = int(len(M)); rule_stats['test_left_unmatched'] = int(len(M_all) - len(M))
M[['idAbt', 'idBuy']].to_csv(f'{ROOT}/outputs/matches.csv', index=False)
print('test ids', len(test_ids), 'matched', len(M), 'unmatched', len(M_all)-len(M), 'review', int(M.review.sum()))

# ---- evidence for the UI: per pair, the agreeing/disagreeing signals ----
def evidence(i, j):
    f = dict(zip(FEATS, features(i, j, 0, 0, 0)))
    ac, bc = abt.codes.iloc[i], buy.codes.iloc[j]
    return [
        dict(field='Model code', value=', '.join(sorted(ac & bc)) or ('none shared (' + (', '.join(sorted(abt.ncodes.iloc[i])) or '-') + ' vs ' + (', '.join(sorted(buy.ncodes.iloc[j])) or '-') + ')'), agree=bool(ac & bc)),
        dict(field='Brand', value=buy.manufacturer.iloc[j] or '(not given)', agree=bool(f['brand_match'])),
        dict(field='Name similarity', value=f"{f['cos_name_word']:.0%} words, {f['cos_name_char']:.0%} characters", agree=bool(f['cos_name_char'] > 0.5)),
        dict(field='Description similarity', value=f"{f['cos_desc']:.0%}", agree=bool(f['cos_desc'] > 0.3)),
        dict(field='Price', value=('not comparable (one side unpriced)' if f['both_priced'] == 0 else f"{abt.p.iloc[i]:.2f} vs {buy.p.iloc[j]:.2f}"), agree=None if f['both_priced'] == 0 else bool(f['abs_log_price_ratio'] < 0.15)),
    ]
out = []
for r in M.itertuples():
    a, b = abt.iloc[r.i], buy.iloc[r.j]
    out.append(dict(idAbt=r.idAbt, idBuy=r.idBuy, confidence=r.confidence, margin=r.margin, review=r.review,
                    abt=dict(name=a['name'], description=a.description[:240], price=None if np.isnan(a.p) else a.p),
                    buy=dict(name=b['name'], description=b.description[:240], manufacturer=b.manufacturer, price=None if np.isnan(b.p) else b.p),
                    evidence=evidence(r.i, r.j)))
json.dump(dict(pairs=out, summary=rule_stats, cv_blocking=json.load(open(f'{ROOT}/outputs/blocking.json'))), open(f'{ROOT}/outputs/matches_results.json', 'w'))

# ---- error analysis on out-of-fold mistakes ----
errs = oof[~oof.correct.astype(bool)].copy()
def cause(r):
    i, j, t = int(r.i), int(r.j), truth[int(r.i)]
    tc = abt.codes.iloc[i] & buy.codes.iloc[t]; pc = abt.codes.iloc[i] & buy.codes.iloc[j]
    if not (t in set(candidates(i))): return 'true match not in candidates (blocking miss)'
    if pc and not tc: return 'wrong item shares a model code (family/accessory with same code)'
    if not abt.ncodes.iloc[i] or not buy.ncodes.iloc[t]: return 'no model code in the name on one side of the true pair'
    if not tc: return 'true pair has differently written model codes'
    return 'one-to-one assignment pushed it elsewhere / near-duplicate listing'
errs['cause'] = errs.apply(cause, axis=1)
sample = errs.sample(min(20, len(errs)), random_state=0)
txt = []
for r in sample.itertuples():
    i, j, t = int(r.i), int(r.j), truth[int(r.i)]
    txt.append(dict(cause=r.cause, abt=abt.name.iloc[i], predicted=buy.name.iloc[j], truth=buy.name.iloc[t], conf=round(float(r.conf), 2)))
json.dump(dict(total_errors=len(errs), cause_counts_all=errs.cause.value_counts().to_dict(), sample=txt), open(f'{ROOT}/outputs/error_analysis.json', 'w'), indent=1)
print(errs.cause.value_counts().to_string())
for t in txt[:20]: print('-', t['cause'][:38], '|', t['abt'][:48], '| PRED', t['predicted'][:44], '| TRUE', t['truth'][:44])
