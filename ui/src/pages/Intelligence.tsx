import { useEffect, useMemo, useState } from 'react';
import { Async, DataTable, Gauge, Section, SourceChip, Column } from '../components';
import { TrafficChart, when } from '../chart';
import { postJSON, useApi } from '../api';
import type { MatchesResponse, Pair, SeriesResult } from '../types';

const money = (p: number | null) => (p === null ? 'no price' : `$${p.toFixed(2)}`);

function Traffic() {
  const list = useApi<{ id: string; points: number; flagged: number }[]>('/api/series');
  const [id, setId] = useState('S4'); const [scale, setScale] = useState<'log' | 'linear'>('log'); const [sel, setSel] = useState(0);
  const res = useApi<SeriesResult>(`/api/series/${id}`);
  useEffect(() => setSel(0), [id]);
  // default scale: log only for series whose peaks dwarf their typical value (S1 to S3 are bursty, S4 is a flat CPU series)
  useEffect(() => { if (res.state === 'ready') { const v = res.data.values, med = [...v].sort((a, b) => a - b)[v.length >> 1]; setScale(Math.max(...v) / Math.max(med, 1e-9) > 1000 ? 'log' : 'linear'); } }, [id, res.state]); // eslint-disable-line
  return (
    <Section title="Traffic against its learned normal" id="h-traffic" aside="online detector, a point is judged only on data before it">
      <div className="tabs-sel">
        <div className="seg" role="group" aria-label="Series">{(list.state === 'ready' ? list.data : [{ id: 'S1', flagged: 0 }, { id: 'S2', flagged: 0 }, { id: 'S3', flagged: 0 }, { id: 'S4', flagged: 0 }]).map(s => <button key={s.id} aria-pressed={id === s.id} onClick={() => setId(s.id)}>{s.id}{list.state === 'ready' ? ` · ${s.flagged} flagged` : ''}</button>)}</div>
        <div className="seg" role="group" aria-label="Vertical scale" style={{ marginLeft: 'auto' }}>{(['log', 'linear'] as const).map(k => <button key={k} aria-pressed={scale === k} onClick={() => setScale(k)}>{k === 'log' ? 'Log scale' : 'Linear scale'}</button>)}</div>
      </div>
      <Async res={res} rows={6}>{s => (<>
        <div className="chart-box chart"><TrafficChart s={s} scale={scale} selected={sel} id={id} />
          <div className="legend"><span><i style={{ background: 'var(--text)' }} />signal</span><span><i className="band" />normal range the model learned</span><span><i style={{ background: 'var(--olive)' }} />flagged</span></div></div>
        <p className="muted" style={{ margin: '10px 0' }}>{s.flagged.length === 0 ? 'The detector flagged nothing in this series. That is a result, not a gap: after one day of learning, no point left its normal range by enough to alert. It also means anything subtler than that was missed.' : `${s.flagged.length} points flagged. At most one alert per hour; the first day is learning only. Select a row to mark it on the chart.`}</p>
        {s.flagged.length > 0 && <FlagTable s={s} sel={sel} setSel={setSel} />}
      </>)}</Async>
    </Section>
  );
}

function FlagTable({ s, sel, setSel }: { s: SeriesResult; sel: number; setSel: (n: number) => void }) {
  const idx = useMemo(() => new Map(s.timestamps.map((t, i) => [t, i])), [s]);
  const cols: Column<SeriesResult['flagged'][number]>[] = [
    { key: 't', header: 'Time (UTC)', render: f => <button className="btn sm" aria-pressed={s.flagged[sel] === f} onClick={() => setSel(s.flagged.indexOf(f))}>{when(f.timestamp)}</button> },
    { key: 'v', header: 'Value', align: 'r', render: f => f.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) },
    { key: 'n', header: 'Normal range then', align: 'r', render: f => { const i = idx.get(f.timestamp) ?? 0; return `${s.lo[i].toLocaleString('en-US', { maximumFractionDigits: 2 })} to ${s.hi[i].toLocaleString('en-US', { maximumFractionDigits: 2 })}`; } },
    { key: 'd', header: 'Direction', render: f => { const i = idx.get(f.timestamp) ?? 0; return f.value > s.hi[i] ? <span className="olive">above normal</span> : <span className="olive">below normal</span>; } },
  ];
  return <DataTable caption="Flagged points" columns={cols} rows={s.flagged} rowKey={f => f.timestamp} />;
}

function PairPanel() {
  const res = useApi<MatchesResponse>('/api/matches');
  return <Section title="One thing, two records" id="h-pair" aside="as each catalogue holds it"><Async res={res} rows={6}>{d => <PairBody data={d} />}</Async></Section>;
}

function PairBody({ data }: { data: MatchesResponse }) {
  const [filter, setFilter] = useState<'review' | 'auto' | 'all'>('review'); const [n, setN] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, 'accept' | 'reject'>>(() => Object.fromEntries(data.pairs.filter(p => p.human).map(p => [p.idAbt, p.human!.decision])));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const list = useMemo(() => data.pairs.filter(p => filter === 'all' || (filter === 'review') === p.review).sort((a, b) => (filter === 'all' ? a.idAbt - b.idAbt : a.confidence - b.confidence)), [data, filter]);
  useEffect(() => setN(0), [filter]);
  const p: Pair | undefined = list[n];
  const decide = async (d: 'accept' | 'reject') => {
    if (!p) return; setBusy(true); setErr('');
    try { await postJSON('/api/review', { idAbt: p.idAbt, idBuy: p.idBuy, decision: d }); setDecisions(x => ({ ...x, [p.idAbt]: d })); }
    catch (e) { setErr('Your decision was not saved. ' + String((e as Error).message)); } finally { setBusy(false); }
  };
  const sm = data.summary; const done = p ? decisions[p.idAbt] : undefined;
  return (<>
    <div className="tabs-sel">
      <div className="seg" role="group" aria-label="Which pairs">{([['review', 'Needs review'], ['auto', 'Auto-accepted'], ['all', 'All']] as const).map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} {k === 'all' ? data.pairs.length : data.pairs.filter(x => (k === 'review') === x.review).length}</button>)}</div>
      <span style={{ marginLeft: 'auto' }} className="muted" role="status">{list.length ? `${n + 1} of ${list.length}` : '0 pairs'}</span>
      <button className="btn sm" disabled={n === 0} onClick={() => setN(n - 1)} aria-label="Previous pair">←</button>
      <button className="btn sm" disabled={n >= list.length - 1} onClick={() => setN(n + 1)} aria-label="Next pair">→</button>
    </div>
    {!p ? <div className="state">No pairs in this group.</div> : (<>
      <div className="pair-grid">
        {([['ABT', 'Abt catalogue', p.idAbt, p.abt.name, money(p.abt.price), p.abt.description], ['BUY', 'Buy catalogue', p.idBuy, p.buy.name, money(p.buy.price), p.buy.description]] as const).map(([chip, label, id, name, price, desc]) => (
          <div className="rec" key={chip}><SourceChip chip={chip} /> <span className="muted">{label} · id {id} · {price}</span><div className="nm">{name}</div><p>{desc || 'No description.'}</p>{chip === 'BUY' && <p>Manufacturer: {p.buy.manufacturer || 'not given'}</p>}</div>))}
      </div>
      <div className={`verdict${p.review ? ' review' : ''}`}>
        <Gauge value={Math.round(p.confidence * 100)} label="Match confidence" />
        <div><b style={{ fontWeight: 500 }}>{p.review ? 'Sent for human review' : 'Auto-accepted'}</b>
          <div className="muted">Calibrated confidence {Math.round(p.confidence * 100)}%, {p.margin >= 0 ? ` ${Math.round(p.margin * 100)} points ahead of the next best Buy record.` : ' Another Buy record scored higher but was taken by a better-matching Abt record.'}{p.review && ` Rule: review when confidence is under 90% or the lead is under 25 points.`}</div></div>
        <div className="sp">{done && <span role="status" className={done === 'accept' ? 'ok' : 'no'}>You {done === 'accept' ? 'accepted' : 'rejected'} this pair</span>}
          <button className="btn" disabled={busy} onClick={() => decide('reject')}>Reject</button><button className="btn primary" disabled={busy} onClick={() => decide('accept')}>Accept</button></div>
      </div>
      {err && <div className="state no" role="alert">{err}</div>}
      <DataTable caption="Evidence for the match" columns={[
        { key: 'f', header: 'Matching on', render: e => e.field }, { key: 'v', header: 'Value', render: e => e.value },
        { key: 'a', header: 'Agreement', align: 'r', render: e => e.agree === null ? <span className="na">not comparable</span> : e.agree ? <span className="ok">✓ agrees</span> : <span className="no">✗ disagrees</span> }]}
        rows={p.evidence} rowKey={e => e.field} />
    </>)}
    <p className="muted" style={{ marginTop: 14 }}>How much to trust this: on pairs held out of training, auto-accepted matches were {Math.round(Number(sm.cv_auto_precision) * 100)}% correct and made up {Math.round(Number(sm.cv_auto_share) * 100)}% of matches. The other {Math.round(Number(sm.cv_review_share) * 100)}% were right only {Math.round(Number(sm.cv_review_accuracy_if_unreviewed) * 100)}% of the time, which is why a person should look at them. {Number(sm.test_left_unmatched)} of {Number(sm.test_ids)} Abt ids were left unmatched because no Buy record reached {Math.round(Number(sm.abstain_below_confidence) * 100)}% confidence; a wrong pair costs more than a missing one.</p>
  </>);
}

export function Intelligence() {
  return (<>
    <h1>Intelligence</h1>
    <p className="lede">Two jobs Vulcan has to do well: notice when traffic leaves its normal pattern, and recognise the same thing under two different names. Both are computed from public data and show where they are unsure.</p>
    <Traffic /><PairPanel />
  </>);
}
