"""Look-ahead test: the verdict at time t must not change if everything after t is removed or altered."""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ds'))
from anomaly import OnlineDetector, load_series, run_series

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'series.csv')

class OnlineTests(unittest.TestCase):
    def test_truncation_and_future_tampering_do_not_change_past_verdicts(self):
        df = load_series(DATA)['S4']; cut = 2500
        full = run_series(df, OnlineDetector())
        trunc = run_series(df.iloc[:cut], OnlineDetector())
        tampered = df.copy(); tampered.loc[cut:, 'value'] = tampered.loc[cut:, 'value'] * 1000 + 7
        tamp = run_series(tampered, OnlineDetector())
        for col in ('flag', 'z', 'lo', 'hi', 'expected'):
            self.assertTrue((full[col][:cut].values == trunc[col].values).all(), col)
            self.assertTrue((full[col][:cut].values == tamp[col][:cut].values).all(), col)

    def test_no_flags_during_burn_in(self):
        r = run_series(load_series(DATA)['S1'], OnlineDetector())
        self.assertFalse(r.flag[:288].any())

if __name__ == '__main__': unittest.main()
