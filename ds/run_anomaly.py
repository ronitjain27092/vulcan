"""Run the online detector on the real series, write outputs/anomalies.csv + results for the API,
and benchmark against a naive baseline on series with INJECTED anomalies (real labels are held back)."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, pandas as pd
from anomaly import *

ROOT = os.path.join(os.path.dirname(__file__), '..')
S = load_series(f'{ROOT}/data/series.csv')

# ---- 1. real series -> deliverable + API results -------------------------------------------
rows, api = [], {}
for k, df in S.items():
    r = run_series(df, OnlineDetector())
    rows += [(k, t.strftime('%Y-%m-%d %H:%M:%S')) for t in r[r.flag].ts]
    api[k] = dict(
        timestamps=[t.strftime('%Y-%m-%dT%H:%M:%S') for t in r.ts],
        values=[float(v) for v in r.value],
        lo=[round(float(v), 3) for v in r.lo], hi=[round(float(v), 3) for v in r.hi],
        expected=[round(float(v), 3) for v in r.expected],
        flagged=[dict(timestamp=t.strftime('%Y-%m-%dT%H:%M:%S'), value=float(v), z=round(float(z), 1))
                 for t, v, z in zip(r[r.flag].ts, r[r.flag].value, r[r.flag].z)],
        warmup_until=r.ts[SLOT - 1].strftime('%Y-%m-%dT%H:%M:%S'))
pd.DataFrame(rows, columns=['series_id', 'timestamp']).to_csv(f'{ROOT}/outputs/anomalies.csv', index=False)
json.dump(api, open(f'{ROOT}/outputs/series_results.json', 'w'))
days = {k: len(v) / SLOT for k, v in S.items()}
real = {k: dict(points=len(S[k]), alerts=len([x for x in rows if x[0] == k]),
                alerts_per_day=round(len([x for x in rows if x[0] == k]) / days[k], 2)) for k in S}

# ---- 2. injected-anomaly benchmark ---------------------------------------------------------
# Real labels are held back, so we measure on the real series with anomalies we insert ourselves.
# Each anomaly is defined against the series' OWN previous 3 days, so it is unprecedented rather than just "bigger":
#   spike : 3 points at 1.5x the 3-day max          dip   : 6 points at 0 (port down) - only where 3-day min > 0
#   surge : 24 points (2h) at 1.5x the 3-day max
# Caveat: this favours a detector that learns a normal range. It says the detector does what it was built to do,
# not that it matches the held-back labels.
def inject(df, rng, n=5):
    v = df.value.values.astype(float).copy(); N = len(v); wins = []; starts = []
    n = 3 if N < 2000 else n
    while len(starts) < n:
        s = int(rng.integers(SLOT * 2 + 48, N - 80))
        if all(abs(s - o) > 100 for o in starts): starts.append(s)
    ref = df.value.values.astype(float)
    for s in sorted(starts):
        prev = ref[max(0, s - 3 * SLOT):s]
        kinds = ['spike', 'surge'] + (['dip'] if prev.min() > 0 else [])
        kind = str(rng.choice(kinds)); L = {'spike': 3, 'dip': 6, 'surge': 24}[kind]
        v[s:s + L] = 0.0 if kind == 'dip' else prev.max() * 1.5 + 1
        wins.append((s, s + 36, kind))          # window = 3h from onset, wide like a real label
    d = df.copy(); d['value'] = v
    return d, wins

def score(flags, wins, N, burn=SLOT):
    caught, delays, used = [], [], np.zeros(N, bool)
    for a, b, kind in wins:
        used[max(a - 12, 0):b + 12] = True
        hit = [i for i in flags if a <= i < b]
        caught.append((kind, bool(hit)))
        if hit: delays.append((hit[0] - a) * 5)
    return caught, delays, len([i for i in flags if not used[i] and i >= burn])

def benchmark(seeds=20):
    DETS = (('mine', OnlineDetector), ('naive_3sigma', NaiveBaseline), ('naive_8sigma', lambda: NaiveBaseline(k=8.0)))
    agg = {n: dict(c=[], d=[], fa=0, days=0.0) for n, _ in DETS}
    for seed in range(seeds):
        rng = np.random.default_rng(seed)
        for k, df in S.items():
            d, wins = inject(df, rng)
            for name, mk in DETS:
                r = run_series(d, mk()); fl = list(np.flatnonzero(r.flag.values))
                c, dl, fa = score(fl, wins, len(d)); R = agg[name]
                R['c'] += c; R['d'] += dl; R['fa'] += fa; R['days'] += (len(d) - SLOT) / SLOT
    out = {}
    for n, R in agg.items():
        hits = sum(h for _, h in R['c'])
        out[n] = dict(windows_caught=f"{hits}/{len(R['c'])}", recall=round(hits / len(R['c']), 3),
                      recall_by_kind={kd: round(sum(h for k2, h in R['c'] if k2 == kd) / max(1, sum(1 for k2, _ in R['c'] if k2 == kd)), 3) for kd in ('spike', 'surge', 'dip')},
                      median_delay_min=float(np.median(R['d'])) if R['d'] else None,
                      false_alarms_per_day=round(R['fa'] / R['days'], 2))
    return out

if __name__ == '__main__':
    bench = benchmark()
    json.dump(dict(real_series=real, injected_benchmark=bench), open(f'{ROOT}/outputs/anomaly_eval.json', 'w'), indent=2)
    print(json.dumps(dict(real_series=real, injected_benchmark=bench), indent=2))
