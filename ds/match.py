"""Abt <-> Buy entity matching. Blocking -> pair features -> classifier -> one-to-one assignment.
Test pairs are never touched: tuning/validation uses known_matches.csv only (grouped CV by Abt id)."""
import re, os, json, sys
import numpy as np, pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import GroupKFold
from sklearn.isotonic import IsotonicRegression
from scipy.optimize import linear_sum_assignment

ROOT = os.path.join(os.path.dirname(__file__), '..')
abt = pd.read_csv(f'{ROOT}/data/abt.csv'); buy = pd.read_csv(f'{ROOT}/data/buy.csv')
known = pd.read_csv(f'{ROOT}/data/known_matches.csv'); test_ids = pd.read_csv(f'{ROOT}/data/test_abt_ids.csv').idAbt.tolist()
for d in (abt, buy):
    d['name'] = d.name.fillna(''); d['description'] = d.description.fillna('')
def price(x):
    try: return float(re.sub(r'[^0-9.]', '', str(x))) if pd.notna(x) else np.nan
    except ValueError: return np.nan
abt['p'] = abt.price.map(price); buy['p'] = buy.price.map(price)
buy['manufacturer'] = buy.manufacturer.fillna('')

CODE = re.compile(r'[A-Za-z0-9][A-Za-z0-9\-/]{2,}[A-Za-z0-9]')
def codes(text):
    """Model-number-like tokens: contain a digit and are >= 4 chars once separators are stripped."""
    out = set()
    for t in CODE.findall(text):
        c = re.sub(r'[^A-Za-z0-9]', '', t).upper()
        if len(c) >= 4 and re.search(r'\d', c) and re.search(r'[A-Z]', c): out.add(c)
    return out
abt['codes'] = (abt.name + ' ' + abt.description).map(codes)
buy['codes'] = (buy.name + ' ' + buy.description).map(codes)
abt['ncodes'] = abt.name.map(codes); buy['ncodes'] = buy.name.map(codes)

# ---- vectorisers fitted on the union of both catalogues (no labels used) ----
w_name = TfidfVectorizer(lowercase=True, token_pattern=r'[A-Za-z0-9]+', sublinear_tf=True).fit(pd.concat([abt.name, buy.name]))
c_name = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), lowercase=True, sublinear_tf=True).fit(pd.concat([abt.name, buy.name]))
w_desc = TfidfVectorizer(lowercase=True, token_pattern=r'[A-Za-z0-9]+', sublinear_tf=True, stop_words='english').fit(pd.concat([abt.description, buy.description]))
Wa, Wb = w_name.transform(abt.name), w_name.transform(buy.name)
Ca, Cb = c_name.transform(abt.name), c_name.transform(buy.name)
Da, Db = w_desc.transform(abt.description), w_desc.transform(buy.description)
S_w, S_c, S_d = (Wa @ Wb.T).toarray(), (Ca @ Cb.T).toarray(), (Da @ Db.T).toarray()

# ---- blocking: union of top-K by name similarity and any shared model code ----
code_index = {}
for j, cs in enumerate(buy.codes):
    for c in cs: code_index.setdefault(c, set()).add(j)
def candidates(i, K=15):
    sim = S_w[i] + S_c[i]
    cand = set(np.argsort(-sim)[:K])
    for c in abt.codes.iloc[i]:
        cand |= code_index.get(c, set())
    return sorted(cand)

def brand(i, j):
    a = re.findall(r'[a-z0-9]+', abt.name.iloc[i].lower())[:1]
    m = buy.manufacturer.iloc[j].lower(); n = buy.name.iloc[j].lower()
    return float(bool(a) and (a[0] in m or a[0] in n))

def features(i, j, rank_w, gap_w, rank_c):
    ac, bc, an, bn = abt.codes.iloc[i], buy.codes.iloc[j], abt.ncodes.iloc[i], buy.ncodes.iloc[j]
    exact = len(ac & bc); nexact = len(an & bn)
    partial = float(any((x in y or y in x) for x in an for y in bn if x != y and min(len(x), len(y)) >= 5))
    pa, pb = abt.p.iloc[i], buy.p.iloc[j]
    both = not (np.isnan(pa) or np.isnan(pb))
    return [S_w[i, j], S_c[i, j], S_d[i, j], exact, nexact, partial,
            exact / max(1, len(an | bn)), float(len(an) > 0 and len(bn) > 0 and nexact == 0),
            brand(i, j), abs(np.log((pa + 1) / (pb + 1))) if both else -1.0, float(both),
            rank_w, gap_w, rank_c]

FEATS = ['cos_name_word', 'cos_name_char', 'cos_desc', 'shared_codes', 'shared_name_codes', 'partial_code',
         'code_jaccard', 'codes_present_but_differ', 'brand_match', 'abs_log_price_ratio', 'both_priced',
         'rank_word', 'gap_to_best_word', 'rank_char']

def pair_table(abt_idx):
    rows, meta = [], []
    for i in abt_idx:
        cand = candidates(i)
        sw = S_w[i, cand]; sc = S_c[i, cand]
        rw = (-sw).argsort().argsort(); rc = (-sc).argsort().argsort()
        for k, j in enumerate(cand):
            rows.append(features(i, j, rw[k], sw.max() - sw[k], rc[k])); meta.append((i, j))
    return np.array(rows), meta

aid2i = {a: i for i, a in enumerate(abt.id)}; bid2j = {b: j for j, b in enumerate(buy.id)}
truth = {aid2i[a]: bid2j[b] for a, b in zip(known.idAbt, known.idBuy) if a in aid2i and b in bid2j}

def new_model():
    return HistGradientBoostingClassifier(max_iter=200, learning_rate=0.08, max_depth=4, l2_regularization=1.0, random_state=0)

def assign(meta, prob, allowed_b):
    """One-to-one assignment (Hungarian) of Abt rows to unused Buy rows; returns {i: (j, prob, margin)}."""
    ai = sorted({i for i, _ in meta}); bj = sorted({j for _, j in meta if j in allowed_b})
    ia, jb = {a: n for n, a in enumerate(ai)}, {b: n for n, b in enumerate(bj)}
    P = np.zeros((len(ai), len(bj)))
    for (i, j), p in zip(meta, prob):
        if j in jb: P[ia[i], jb[j]] = max(P[ia[i], jb[j]], p)
    r, c = linear_sum_assignment(-np.log(P + 1e-6))
    out = {}
    for a, b in zip(r, c):
        srt = np.sort(P[a])[::-1]
        out[ai[a]] = (bj[b], P[a, b], P[a, b] - (srt[1] if srt[0] == P[a, b] else srt[0]))
    return out

if __name__ == '__main__':
    # blocking quality on known pairs
    kn = list(truth)
    hit = [truth[i] in set(candidates(i)) for i in kn]
    avg_c = np.mean([len(candidates(i)) for i in kn])
    block = dict(candidate_recall=round(float(np.mean(hit)), 4), avg_candidates_per_abt=round(float(avg_c), 1),
                 reduction_ratio=round(1 - avg_c / len(buy), 4))
    print('blocking', block)
    # ---- grouped 5-fold CV on known pairs (never touches test ids) ----
    oof = []   # (i, j, prob, is_true) for the assigned pair of every held-out abt id
    kn_arr = np.array(kn)
    for tr, va in GroupKFold(5).split(kn_arr, groups=kn_arr):
        tr_i, va_i = kn_arr[tr], kn_arr[va]
        X, meta = pair_table(tr_i); y = np.array([truth[i] == j for i, j in meta])
        m = new_model().fit(X, y)
        Xv, metav = pair_table(va_i); pv = m.predict_proba(Xv)[:, 1]
        used = {truth[i] for i in tr_i}
        allowed = set(range(len(buy))) - used
        res = assign(metav, pv, allowed)
        for i, (j, p, mg) in res.items(): oof.append((i, j, p, mg, truth[i] == j))
    oof = pd.DataFrame(oof, columns=['i', 'j', 'prob', 'margin', 'correct'])
    oof.to_csv(f'{ROOT}/outputs/cv_predictions.csv', index=False)
    for t in (0.0, 0.2, 0.3, 0.5, 0.7, 0.9):
        s = oof[oof.prob >= t]; p = s.correct.mean(); r = s.correct.sum() / len(oof)
        print(f'thr {t}: n={len(s)} precision={p:.3f} recall={r:.3f} F1={2*p*r/(p+r):.3f}')
    json.dump(block, open(f'{ROOT}/outputs/blocking.json', 'w'))
