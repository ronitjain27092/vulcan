import os, sys, tempfile, unittest
os.environ['VULCAN_NO_AUTOCREATE'] = '1'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import create_app

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.tmp.name, 't.db')
        self.client = create_app(dict(DB_PATH=self.db, STATIC_DIR=self.tmp.name)).test_client()
    def tearDown(self): self.tmp.cleanup()

    def test_health_and_overview(self):
        self.assertEqual(self.client.get('/health').json['status'], 'ok')
        o = self.client.get('/api/overview').json
        self.assertEqual(o['overview']['alarms_open'], 412); self.assertEqual(len(o['sources']), 6)

    def test_incident_and_404(self):
        self.assertEqual(self.client.get('/api/incident/HUBN-CORE-SW-02').json['serial'], 'FOC2418L0QX')
        self.assertEqual(self.client.get('/api/incident/nope').status_code, 404)

    def test_series_shape(self):
        s = self.client.get('/api/series/S4').json
        n = len(s['values']); self.assertEqual(len(s['lo']), n); self.assertEqual(len(s['hi']), n)
        self.assertEqual(self.client.get('/api/series/S9').status_code, 404)

    def test_review_persists_across_restart(self):
        p = self.client.get('/api/matches').json['pairs'][0]
        r = self.client.post('/api/review', json=dict(idAbt=p['idAbt'], idBuy=p['idBuy'], decision='reject', note='different colour'))
        self.assertEqual(r.status_code, 200)
        restarted = create_app(dict(DB_PATH=self.db, STATIC_DIR=self.tmp.name)).test_client()   # new app, same SQLite file
        q = [x for x in restarted.get('/api/matches').json['pairs'] if x['idAbt'] == p['idAbt']][0]
        self.assertEqual(q['human']['decision'], 'reject')

    def test_review_validation(self):
        self.assertEqual(self.client.post('/api/review', json=dict(idAbt=1)).status_code, 400)
        p = self.client.get('/api/matches').json['pairs'][0]
        self.assertEqual(self.client.post('/api/review', json=dict(idAbt=p['idAbt'], idBuy=p['idBuy'], decision='maybe')).status_code, 400)
        self.assertEqual(self.client.post('/api/review', json=dict(idAbt=-1, idBuy=-1, decision='accept')).status_code, 404)

if __name__ == '__main__': unittest.main()
