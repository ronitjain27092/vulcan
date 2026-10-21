"""Vulcan API. Small on purpose: precomputed results are loaded at startup (models are NOT run per request).
Config via env: PORT, DB_PATH (SQLite file for review decisions), RESULTS_DIR, STATIC_DIR."""
import json, os, sqlite3, time
from flask import Flask, jsonify, request, send_from_directory, abort

HERE = os.path.dirname(os.path.abspath(__file__))

def create_app(config=None):
    cfg = dict(DB_PATH=os.environ.get('DB_PATH', os.path.join(HERE, 'vulcan.db')),
               RESULTS_DIR=os.environ.get('RESULTS_DIR', os.path.join(HERE, 'results')),
               STATIC_DIR=os.environ.get('STATIC_DIR', os.path.join(HERE, '..', 'ui', 'dist')))
    cfg.update(config or {})
    app = Flask(__name__, static_folder=None); app.config.update(cfg)

    def load(name):
        with open(os.path.join(cfg['RESULTS_DIR'], name)) as f: return json.load(f)
    fixture, series, matches = load('ui_fixture.json'), load('series_results.json'), load('matches_results.json')
    pairs = {(p['idAbt'], p['idBuy']): p for p in matches['pairs']}

    def db():
        c = sqlite3.connect(cfg['DB_PATH']); c.row_factory = sqlite3.Row; return c
    with db() as c:
        c.execute('CREATE TABLE IF NOT EXISTS reviews (idAbt INTEGER, idBuy INTEGER, decision TEXT NOT NULL, '
                  'note TEXT, decided_at REAL NOT NULL, PRIMARY KEY (idAbt, idBuy))')

    @app.get('/health')
    def health(): return jsonify(status='ok', series=len(series), pairs=len(pairs))

    @app.get('/api/overview')
    def overview():
        return jsonify({k: fixture[k] for k in ('overview', 'sources', 'sites', 'incidents')})

    @app.get('/api/incident/<id>')
    def incident(id):
        hero = fixture['hero_incident']
        if id.lower() in ('1', hero['device'].lower()):
            return jsonify(hero)
        abort(404, description='Only the fixture incident HUBN-CORE-SW-02 has detail data.')

    @app.get('/api/series')
    def series_list():
        return jsonify([dict(id=k, points=len(v['values']), flagged=len(v['flagged'])) for k, v in sorted(series.items())])

    @app.get('/api/series/<id>')
    def series_one(id):
        if id not in series: abort(404, description='unknown series')
        return jsonify(series[id])

    @app.get('/api/matches')
    def matches_all():
        with db() as c: decided = {(r['idAbt'], r['idBuy']): dict(decision=r['decision'], note=r['note']) for r in c.execute('SELECT * FROM reviews')}
        out = [dict(p, human=decided.get((p['idAbt'], p['idBuy']))) for p in matches['pairs']]
        return jsonify(pairs=out, summary=matches['summary'], cv_blocking=matches['cv_blocking'])

    @app.post('/api/review')
    def review():
        b = request.get_json(silent=True) or {}
        try: key = (int(b['idAbt']), int(b['idBuy']))
        except (KeyError, TypeError, ValueError): return jsonify(error='idAbt and idBuy (integers) required'), 400
        if b.get('decision') not in ('accept', 'reject'): return jsonify(error="decision must be 'accept' or 'reject'"), 400
        if key not in pairs: return jsonify(error='unknown pair'), 404
        with db() as c:
            c.execute('INSERT INTO reviews VALUES (?,?,?,?,?) ON CONFLICT(idAbt,idBuy) DO UPDATE SET decision=excluded.decision, '
                      'note=excluded.note, decided_at=excluded.decided_at', (*key, b['decision'], (b.get('note') or '')[:500], time.time()))
        return jsonify(idAbt=key[0], idBuy=key[1], decision=b['decision'])

    @app.errorhandler(404)
    def nf(e):
        if request.path.startswith('/api/'): return jsonify(error=getattr(e, 'description', 'not found')), 404
        return e

    # ---- static UI (single-page app; client routes fall back to index.html) ----
    @app.get('/', defaults={'path': ''})
    @app.get('/<path:path>')
    def spa(path):
        d = cfg['STATIC_DIR']
        if path and os.path.isfile(os.path.join(d, path)): return send_from_directory(d, path)
        if os.path.isfile(os.path.join(d, 'index.html')): return send_from_directory(d, 'index.html')
        return jsonify(error='UI not built; run `npm run build` in ui/'), 404
    return app

app = create_app() if os.environ.get('VULCAN_NO_AUTOCREATE') != '1' else None
if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))
