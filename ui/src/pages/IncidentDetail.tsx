import { Async, Gauge, PriorityBadge, Section, SourceChip, SourceChips, stateTone } from '../components';
import { SOURCE_COLOR } from '../components';
import { useApi, Remote } from '../api';
import type { Hero, OverviewResponse } from '../types';

function Curves({ h }: { h: Hero }) {
  const n = h.reports.length, rowH = 68, cx = 101, nodeL = 493, nodeR = 700, cxn = (nodeL + nodeR) / 2;
  const kids = Array.from({ length: h.children }, (_, k) => nodeL + (h.children > 1 ? (k * (nodeR - nodeL)) / (h.children - 1) : 0));
  return (
    <div className="diagram" role="group" aria-label={`${n} source records resolve to one device, ${h.device}, which opens one incident`}>
      {h.reports.map((r, i) => (
        <div key={r.source} className="rc" style={{ top: i * rowH, borderColor: SOURCE_COLOR[r.source] }}>
          <div><SourceChip chip={r.source} /> <span className="muted">{({ NNMi: 'OpenText NNMi', CATC: 'Cisco Catalyst Center', ISE: 'Cisco ISE' } as Record<string, string>)[r.source] ?? ''}</span></div>
          <div className="nm">{r.name}</div>
          <div className="a"><span>{r.alarm}</span><span>{r.native} <span style={{ margin: '0 10px', color: 'var(--faint)' }}>to</span> <b className={r.priority === 'P1' ? 'red' : ''}>{r.priority}</b></span></div>
        </div>
      ))}
      <svg className="abs" style={{ left: 0, top: 0 }} width="968" height="240" viewBox="0 0 968 240" aria-hidden="true">
        {h.reports.map((r, i) => { const y0 = i * rowH + 33; return (<g key={r.source}>
          <path d={`M326 ${y0} C${326 + 100} ${y0}, ${nodeL - 100} ${cx}, ${nodeL} ${cx}`} fill="none" stroke={SOURCE_COLOR[r.source]} strokeWidth="1.5" opacity=".75" />
          <circle cx="326" cy={y0} r="2.8" fill={SOURCE_COLOR[r.source]} /></g>); })}
        <text x={nodeL} y="55" fontSize="13" className="m" style={{ fill: 'var(--muted)' }}>resolved to one device</text>
        <text x="727" y="55" fontSize="13" style={{ fill: 'var(--muted)' }}>one incident, one page</text>
        <path d={`M${nodeR} ${cx} H720`} stroke="var(--line-strong)" /><path d="M718 96 l8 5 -8 5z" fill="var(--line-strong)" />
        {kids.map((x, k) => <g key={k}><line x1={cxn} y1="145" x2={x} y2="186" stroke="var(--line-strong)" strokeWidth="1" /><circle cx={x} cy="187" r="1.5" fill="var(--line-strong)" /></g>)}
        <text x={cxn} y="210" textAnchor="middle" fontSize="13.5" style={{ fill: 'var(--muted)' }}>{h.children} downstream alarms held under it, not paged separately</text>
      </svg>
      <div className="node abs" style={{ left: nodeL, top: 65, width: nodeR - nodeL, height: 80 }}>
        <svg width="30" height="30" viewBox="0 0 34 34" style={{ flex: "none" }} aria-hidden="true"><rect x="3" y="8" width="28" height="18" rx="3" fill="none" stroke="var(--text)" strokeWidth="1.5" /><path d="M10 15h13l-3-3M24 19H11l3 3" fill="none" stroke="var(--text)" strokeWidth="1.5" /></svg>
        <div><b>{h.device}</b><small>{h.serial}, {h.management_ip}</small><small>{h.site}</small></div>
      </div>
      <div className="inc-card abs" style={{ left: 727, top: 65, width: 241, height: 80, padding: '12px 16px' }}>
        <PriorityBadge p="P1" /><b style={{ fontSize: 16 }}>{h.title}</b><small className="muted" style={{ display: 'block', marginTop: 6 }}>paged once, to the on-call network lead</small>
      </div>
    </div>
  );
}

export function IncidentDetail({ id, list }: { id: string; list: Remote<OverviewResponse> }) {
  const res = useApi<Hero>(`/api/incident/${encodeURIComponent(id)}`);
  return (
    <Async res={list}>{ov => {
      const row = ov.incidents.find(i => i.device.toLowerCase() === id.toLowerCase());
      return (<>
        <a className="back" href="#/incidents">← Incidents</a>
        {!row && <div className="state" role="alert">No incident called {id}.</div>}
        {row && (<>
          <div className="hd"><div>
            <div><PriorityBadge p={row.priority} /> <span style={{ margin: '0 8px' }}>{row.title}</span> <span className={stateTone(row.state)}>{row.state}</span></div>
            <div className="big">{row.device}</div>
            <div className="muted">{row.site} <SourceChips chips={row.sources} /></div>
          </div>
          <div style={{ textAlign: 'right' }}><div className="muted">Reported by</div><div className="big" style={{ fontSize: 40 }}>{row.sources.length} source{row.sources.length > 1 ? 's' : ''}</div>
            {row.held_under > 0 && <div className="muted">⋖ {row.held_under} downstream alarms held under it</div>}</div></div>
          <div className="facts">
            <div><small>Opened</small>{row.age} ago</div><div><small>Site</small>{row.site}</div><div><small>Children</small>{row.held_under}</div><div><small>State</small>Open</div>
            <div className="sp"><button className="btn" disabled title="Not wired in this slice">Snooze for an hour</button><button className="btn primary" disabled title="Not wired in this slice">Acknowledge</button></div>
          </div>
          <Async res={res} rows={5}>{h => (<>
            <Section title={`Reported by ${h.reports.length} sources`} id="h-rep" aside="three names, three severity scales, one page"><Curves h={h} /></Section>
            <Section title="Decision engine" id="h-dec" aside="Intelligent Decision Engine, rules">
              <p style={{ fontSize: 17, margin: '0 0 8px', borderTop: '1px solid var(--line)', paddingTop: 14 }}>{h.title} at {h.site}, with {h.children} alarms behind it.</p>
              <div className="decide">
                <div><Gauge value={h.decision.confidence} label="Confidence in the classification" /><div><div className="q">What is this?</div><div className="a">{h.decision.what}</div><div className="muted">{h.decision.evidence}</div></div></div>
                <div><Gauge value={h.decision.should_confidence} label="Confidence in the action" /><div><div className="q">What should happen?</div><div className="a">{h.decision.should}</div><div className="muted">{h.title} at {h.site}, {h.children} alarms behind it, state {row.state === 'Down' ? 'open' : row.state}.</div></div></div>
              </div>
            </Section>
            <Section title="What happened" id="h-tl" aside="newest last">
              <ol className="tl">{h.timeline.map(([t, what, detail]) => <li key={t + what}><span className="muted">{t} ago</span><b style={{ fontWeight: 500 }}>{what}</b><span className="m">{detail}</span></li>)}</ol>
            </Section>
          </>)}</Async>
          {res.state === 'error' && null}
        </>)}
      </>);
    }}</Async>
  );
}
