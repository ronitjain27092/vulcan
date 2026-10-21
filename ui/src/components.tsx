import { ReactNode, useEffect, useState } from 'react';
import type { Remote } from './api';
import type { Priority } from './types';

export const SOURCE_COLOR: Record<string, string> = { NNMi: 'var(--c-nnmi)', CATC: 'var(--c-catc)', CVP: 'var(--c-cvp)', FW: 'var(--c-fw)', ISE: 'var(--c-ise)', ZBX: 'var(--c-zbx)', ABT: 'var(--c-abt)', BUY: 'var(--c-buy)' };

export function SourceChip({ chip }: { chip: string }) { return <span className={`chip ${chip.toLowerCase()}`}>{chip}</span>; }
export function SourceChips({ chips }: { chips: string[] }) { return <span className="chips">{chips.map(c => <SourceChip key={c} chip={c} />)}</span>; }
export function PriorityBadge({ p }: { p: Priority }) { return <span className={`pri ${p}`}><span className="sr">Priority </span>{p}</span>; }

const STATE_TONE: Record<string, string> = { Down: 'red', Warning: 'amber', Unusual: 'olive', Unknown: 'grey', Healthy: 'green' };
export function stateTone(state: string) { return STATE_TONE[state] ?? 'grey'; }
export function StatusDot({ tone, label }: { tone: string; label?: string }) {
  return <span className={`dot ${tone}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="sect" aria-labelledby={id}>
      <div className="h2"><h2 id={id}>{title}</h2>{aside !== undefined && <span>{aside}</span>}</div>
      {children}
    </section>
  );
}

export interface Column<T> { key: string; header: string; align?: 'r'; link?: boolean; render: (row: T) => ReactNode; }
export function DataTable<T>({ columns, rows, rowKey, linkFor, caption }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; linkFor?: (r: T) => string; caption: string }) {
  return (
    <div className="t-wrap">
      <table className="t">
        <caption className="sr">{caption}</caption>
        <thead><tr>{columns.map(c => <th key={c.key} scope="col" className={c.align}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} className={linkFor ? 'row' : undefined}>
              {columns.map(c => (
                <td key={c.key} className={c.align}>
                  {linkFor && c.link ? <a className="rowlink" href={linkFor(r)}>{c.render(r)}</a> : c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ring gauge, as in the "What is this?" panel. */
export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg className="gauge" width="52" height="52" viewBox="0 0 52 52" role="img" aria-label={`${label}: ${value}%`}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--line)" strokeWidth="2.5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${c * Math.max(value, 0) / 100} ${c}`} transform="rotate(-90 26 26)" />
      <text x="26" y="31" textAnchor="middle" fontSize="15" fill="var(--text)">{value}</text>
    </svg>
  );
}

export function Async<T>({ res, children, rows = 4 }: { res: Remote<T>; children: (d: T) => ReactNode; rows?: number }) {
  if (res.state === 'loading') return <div aria-busy="true" aria-live="polite">{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ height: 38, marginBottom: 10 }} />)}<span className="sr">Loading</span></div>;
  if (res.state === 'error') return <div className="state" role="alert"><p>Could not load this data. {res.message}</p><button className="btn" onClick={res.retry}>Try again</button></div>;
  return <>{children(res.data)}</>;
}

export function Logo({ size = 28 }: { size?: number }) {
  // Simplified stand-in for the Vulcan mark (the reference shows a helmet emblem; no asset was supplied).
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 12c2-6 8-8 12-8s10 2 12 8c-1 9-6 17-12 17S5 21 4 12z" fill="var(--text)" />
      <ellipse cx="16" cy="14" rx="7" ry="3.4" fill="var(--bg)" /><circle cx="16" cy="14" r="2" fill="var(--text)" />
    </svg>
  );
}

const NAV: { group: string; items: { label: string; href?: string; badge?: number }[] }[] = [
  { group: 'Monitoring', items: [
    { label: 'Overview', href: '#/' }, { label: 'Incidents', href: '#/incidents' }, { label: 'Intelligence', href: '#/intelligence' },
    { label: 'Devices' }, { label: 'Ports' }, { label: 'Sites' }, { label: 'Signal types' }, { label: 'Thresholds' } ] },
  { group: 'Setup', items: [{ label: 'Decision engine' }, { label: 'Delivery' }, { label: 'Sources' }, { label: 'System and logs' }] },
];

export function Shell({ route, children, paged, critical, sources, devices }: { route: string; children: ReactNode; paged?: number; critical?: number; sources?: number; devices?: number }) {
  const [now, setNow] = useState(new Date());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('theme', theme); } catch { /* storage can be blocked */ } }, [theme]);
  const current = (href?: string) => href !== undefined && (href === '#/' ? route === '/' : route.startsWith(href.slice(1)));
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side">
        <div className="brand"><Logo /> Vulcan</div>
        <nav aria-label="Main" className="nav">
          {NAV.map(g => (
            <div className="nav-group" key={g.group}>
              <div className="nav-h">{g.group}</div>
              {g.items.map(it => it.href
                ? <a key={it.label} href={it.href} aria-current={current(it.href) ? 'page' : undefined}>{it.label}{it.label === 'Incidents' && paged !== undefined && <span className="badge-n">{paged}</span>}</a>
                : <span key={it.label} className="off" aria-disabled="true" title="Not part of this slice">{it.label}</span>)}
            </div>
          ))}
        </nav>
        <div className="side-foot"><b><StatusDot tone="green" /> Vulcan healthy</b>{devices !== undefined ? `${devices} devices watched` : ''}</div>
      </aside>
      <div className="main">
        <header className="top">
          <div className="l"><span>Sources<span className="num">{sources ?? ''}</span></span><span className="proto"><StatusDot tone="amber" /> Prototype, emulated sources</span></div>
          <div className="r">
            {critical !== undefined && <span className="crit"><StatusDot tone="red" /> {critical} critical</span>}
            <time dateTime={now.toISOString()}>{now.toLocaleTimeString('en-GB')}</time>
            <button className="btn sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
            <span className="op">operator</span>
          </div>
        </header>
        <main id="main" className="page" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
