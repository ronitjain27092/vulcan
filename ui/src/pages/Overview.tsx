import { Async, DataTable, PriorityBadge, Section, SourceChip, SourceChips, StatusDot, stateTone, Column } from '../components';
import { Flow } from '../flow';
import type { Incident, OverviewResponse } from '../types';
import { SOURCE_COLOR } from '../components';
import type { Remote } from '../api';

export const incidentColumns: Column<Incident>[] = [
  { key: 'dot', header: '', render: i => <StatusDot tone={stateTone(i.state)} label={i.state} /> },
  { key: 'sev', header: 'Sev', render: i => <PriorityBadge p={i.priority} /> },
  { key: 'dev', header: 'Device and incident', link: true, render: i => <><b style={{ fontWeight: 500 }}>{i.device}</b> <span className={stateTone(i.state) === 'grey' ? 'muted' : stateTone(i.state)}>{i.state}</span><span className="sub">{i.title}</span></> },
  { key: 'src', header: 'Sources', render: i => <SourceChips chips={i.sources} /> },
  { key: 'site', header: 'Site', render: i => i.site },
  { key: 'held', header: 'Held under', align: 'r', render: i => (i.held_under ? <span className="muted">⋖ <span style={{ color: 'var(--text)' }}>{i.held_under}</span></span> : '') },
  { key: 'age', header: 'Age', align: 'r', render: i => i.age },
];

export function Overview({ res }: { res: Remote<OverviewResponse> }) {
  return (
    <Async res={res} rows={8}>{({ overview: o, sources, sites, incidents }) => {
      const maxSite = Math.max(...sites.map(s => s.alarms)), maxSrc = Math.max(...sources.map(s => s.alarms));
      const silent = sources.find(s => s.health === 'silent');
      return (<>
        <h1 className="sr">Overview</h1>
        <div className="flow-wrap"><Flow sources={sources} alarms={o.alarms_open} paged={o.paged} held={o.held} heldPercent={o.held_percent} /></div>
        <div className="triplet">
          <div><span aria-hidden="true">⇝</span><div><b>{o.records.toLocaleString('en-US')} records resolved to {o.devices} devices</b><span className="m">{o.multi_source_devices} devices are seen by two or more tools</span></div></div>
          <div><span aria-hidden="true">◎</span><div><b>{o.duplicates_merged} duplicate alarms merged across sources</b><span className="m">each folded into an incident another tool had already opened</span></div></div>
          {silent && <div><span className="red" aria-hidden="true">- -</span><div className="red"><b>{o.silent_sources} source silent, raised as P1</b><span className="m">{silent.name} has sent nothing for {silent.last_event.replace('m', ' minutes')}</span></div></div>}
        </div>
        <div className="twocol sect">
          <section aria-labelledby="h-sites">
            <div className="h2"><h2 id="h-sites">Where it's breaking</h2><span>all {sites.length} sites, worst first</span></div>
            <ul className="tiles" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sites.map(s => <li key={s.name} className="tile" style={{ background: `rgba(var(--hot), ${0.08 + 0.55 * s.alarms / maxSite})` }}><small>{s.name}</small><b>{s.alarms}</b></li>)}
            </ul>
          </section>
          <section aria-labelledby="h-src">
            <div className="h2"><h2 id="h-src">By source</h2><span>{o.alarms_open} alarms open</span></div>
            {sources.map(s => (
              <div key={s.key} className="src-row">
                <div className="line"><SourceChip chip={s.chip} /><span className="grow">{s.name} <span className="muted">{s.cls}</span></span>
                  {s.health === 'silent' && <span className="red">silent {s.last_event}</span>}<span className="n">{s.alarms}</span></div>
                <div className="bar" role="presentation"><i style={{ width: `${100 * s.alarms / maxSrc}%`, background: SOURCE_COLOR[s.chip] }} /></div>
              </div>))}
          </section>
        </div>
        <Section title="Paged incidents" id="h-paged" aside={<a href="#/incidents">All {o.paged} incidents</a>}>
          <DataTable caption="Paged incidents" columns={incidentColumns} rows={incidents.slice(0, 5)} rowKey={i => i.device} linkFor={i => `#/incidents/${encodeURIComponent(i.device)}`} />
        </Section>
      </>);
    }}</Async>
  );
}
