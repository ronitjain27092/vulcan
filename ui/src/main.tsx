import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import './styles.css';
import { Shell } from './components';
import { useApi } from './api';
import { Overview } from './pages/Overview';
import { Incidents } from './pages/Incidents';
import { IncidentDetail } from './pages/IncidentDetail';
import { Intelligence } from './pages/Intelligence';
import type { OverviewResponse } from './types';

const route = () => (location.hash.replace(/^#/, '') || '/');

function App() {
  const [r, setR] = useState(route());
  const ov = useApi<OverviewResponse>('/api/overview');
  useEffect(() => { const f = () => { setR(route()); window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const d = ov.state === 'ready' ? ov.data : undefined;
  const critical = d?.incidents.filter(i => i.priority === 'P1').length;
  let page;
  if (r === '/') page = <Overview res={ov} />;
  else if (r === '/incidents') page = <Incidents res={ov} />;
  else if (r.startsWith('/incidents/')) page = <IncidentDetail id={decodeURIComponent(r.slice(11))} list={ov} />;
  else if (r === '/intelligence') page = <Intelligence />;
  else page = <div className="state">Page not found. <a href="#/" style={{ textDecoration: 'underline' }}>Back to the overview</a></div>;
  return <Shell route={r} paged={d?.overview.paged} critical={critical} sources={d?.overview.sources} devices={d?.overview.devices}>{page}</Shell>;
}
createRoot(document.getElementById('root')!).render(<App />);
