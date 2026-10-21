"""Online anomaly detector for 5-minute traffic series.

ONLINE GUARANTEE: `OnlineDetector.step(t, x)` gets ONE point, returns the verdict for it,
and only then updates its state. It is never handed the array, and `run_series` feeds it
from a generator. tests/test_online.py also checks that truncating a series after t leaves
every verdict at or before t unchanged (a direct look-ahead test).
"""
import math, bisect
import numpy as np, pandas as pd

SLOT = 288  # 5-minute slots per day

class OnlineDetector:
    """log1p -> EWMA level + learned time-of-day correction -> robust z -> self-calibrated threshold."""
    def __init__(self, alpha=0.08, warmup=SLOT, calib=SLOT, q=0.998, floor=5.0, cap=15.0, refractory=12, clip=3.0, days_kept=7, season_w=6):
        self.alpha, self.warmup, self.calib, self.q, self.floor, self.cap = alpha, warmup, calib, q, floor, cap
        self.refractory, self.clip, self.days_kept, self.season_w = refractory, clip, days_kept, season_w
        self.level = None; self.scale = None; self.n = 0
        self.xs = {}         # slot -> recent log values (for the seasonal envelope)
        self.dev = {}        # slot -> recent (x - level) deviations: the daily shape the EWMA lags behind
        self.scores = []     # sorted past |z|, for the self-calibrating threshold
        self.last_flag = -10**9

    def _envelope(self, slot):
        """Range of values seen at this time of day (+-SEASON_W slots) on previous days. Needs >= 2 days."""
        if len(self.dev.get(slot, [])) < 2:
            return None
        vals = []
        for k in range(slot - self.season_w, slot + self.season_w + 1):
            vals.extend(self.xs.get(k % SLOT, []))
        return (min(vals), max(vals)) if vals else None

    def step(self, ts, value):
        x = math.log1p(max(value, 0.0))
        slot = (ts.hour * 60 + ts.minute) // 5
        if self.level is None:
            self.level, self.scale = x, 0.05
        d = self.dev.get(slot, [])
        base = self.level + (float(np.median(d)) if len(d) >= 2 else 0.0)
        env = self._envelope(slot)
        hi_ref, lo_ref = (max(base, env[1]), min(base, env[0])) if env else (base, base)
        up, down = (x - hi_ref) / self.scale, (x - lo_ref) / self.scale
        z = up if up > 0 else (down if down < 0 else 0.0)   # 0 = inside the learned normal range
        resid = x - base
        thr = self.floor
        if len(self.scores) >= self.calib:   # threshold = high quantile of this series' OWN past scores
            thr = min(self.cap, max(self.floor, self.scores[int(self.q * (len(self.scores) - 1))]))  # cap: heavy-tailed history must not blind us
        over = self.n >= self.warmup and abs(z) > thr
        flag = bool(over and self.n - self.last_flag > self.refractory)
        if flag: self.last_flag = self.n
        out = dict(ts=ts, value=value, expected=math.expm1(base),
                   lo=max(math.expm1(lo_ref - thr * self.scale), 0.0), hi=math.expm1(hi_ref + thr * self.scale),
                   z=z, flag=flag)
        # ---- state update AFTER the verdict; winsorised so an anomaly cannot teach the model it is normal ----
        step = float(np.clip(resid, -self.clip * self.scale, self.clip * self.scale))
        self.dev.setdefault(slot, []).append(x - self.level); self.dev[slot] = self.dev[slot][-self.days_kept:]
        self.xs.setdefault(slot, []).append(x if not over else base + step); self.xs[slot] = self.xs[slot][-self.days_kept:]
        self.level += self.alpha * ((base + step) - self.level)
        self.scale += self.alpha * (max(abs(step), 0.01) - self.scale)
        bisect.insort(self.scores, abs(z))
        self.n += 1
        return out

class NaiveBaseline:
    """Expanding global mean/std of the raw value, flag |z| > 3 (classic 3-sigma rule)."""
    def __init__(self, k=3.0, warmup=SLOT):
        self.k, self.warmup, self.n, self.mean, self.m2 = k, warmup, 0, 0.0, 0.0
    def step(self, ts, value):
        sd = math.sqrt(self.m2 / self.n) if self.n > 1 else 0.0
        z = (value - self.mean) / sd if sd > 0 else 0.0
        out = dict(ts=ts, value=value, expected=self.mean, lo=self.mean - self.k * sd,
                   hi=self.mean + self.k * sd, z=z, flag=bool(self.n >= self.warmup and abs(z) > self.k))
        self.n += 1; dd = value - self.mean; self.mean += dd / self.n; self.m2 += dd * (value - self.mean)
        return out

def load_series(path):
    s = pd.read_csv(path, parse_dates=['timestamp'])
    out = {}
    for k, g in s.groupby('series_id'):
        # S2 repeats some timestamps: keep the first reading seen (a live system can't know a later one is better)
        out[k] = g.sort_values('timestamp', kind='stable').drop_duplicates('timestamp', keep='first').reset_index(drop=True)
    return out

def stream(df):
    for t, v in zip(df.timestamp, df.value):
        yield t, v

def run_series(df, detector):
    return pd.DataFrame([detector.step(t, v) for t, v in stream(df)])
