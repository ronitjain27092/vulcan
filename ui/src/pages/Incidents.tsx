import { useState } from 'react';
import { Async, DataTable } from '../components';
import { incidentColumns } from './Overview';
import type { Remote } from '../api';
import type { OverviewResponse } from '../types';

export function Incidents({ res }: { res: Remote<OverviewResponse> }) {
  const [site, setSite] = useState(''); const [src, setSrc] = useState('');
  return (
    <Async res={res}>{({ incidents, sources }) => {
      const shown = incidents.filter(i => (!site || i.site === site) && (!src || i.sources.includes(src)));
      return (<>
        <h1>Incidents</h1>
        <p className="lede">Everything Vulcan has opened across every connected source. Open incidents paged someone. Held ones stayed on the console because another source had already opened the same thing, or because damping had not cleared them yet.</p>
        <div className="tabs-sel" style={{ justifyContent: 'flex-end' }}>
          <label className="sr" htmlFor="f-site">Filter by site</label>
          <select id="f-site" value={site} onChange={e => setSite(e.target.value)}><option value="">All sites</option>{[...new Set(incidents.map(i => i.site))].map(s => <option key={s}>{s}</option>)}</select>
          <label className="sr" htmlFor="f-src">Filter by source</label>
          <select id="f-src" value={src} onChange={e => setSrc(e.target.value)}><option value="">All sources</option>{sources.map(s => <option key={s.key} value={s.chip}>{s.chip}</option>)}</select>
          <span className="muted" role="status">{shown.length} shown</span>
        </div>
        {shown.length ? <DataTable caption="Incidents" columns={incidentColumns} rows={shown} rowKey={i => i.device} linkFor={i => `#/incidents/${encodeURIComponent(i.device)}`} />
          : <div className="state">No incidents match these filters.</div>}
      </>);
    }}</Async>
  );
}
