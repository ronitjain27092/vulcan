import { useId, useMemo } from 'react';
import type { SeriesResult } from './types';

const W = 900, H = 300, L = 58, R = 16, T = 16, B = 30;
const fmt = (v: number) => (v >= 1e9 ? (v / 1e9).toFixed(0) + 'G' : v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'k' : v >= 10 ? v.toFixed(0) : v.toFixed(2));
export const when = (iso: string) => new Date(iso + 'Z').toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** Hand-drawn SVG traffic chart: signal, learned normal range, flagged points. Style follows the reference (grey band, dark line, olive flag). */
export function TrafficChart({ s, scale, selected, id }: { s: SeriesResult; scale: 'log' | 'linear'; selected: number; id: string }) {
  const clip = useId();
  const g = useMemo(() => {
    const t = s.timestamps.map(x => Date.parse(x + 'Z')); const tn = t[0], tx = t[t.length - 1];
    const f = scale === 'log' ? (v: number) => Math.log1p(Math.max(v, 0)) : (v: number) => v;
    const vals = s.values.map(f); let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const X = (ms: number) => L + ((ms - tn) / (tx - tn)) * (W - L - R), Y = (v: number) => T + (1 - (f(v) - lo) / (hi - lo)) * (H - T - B);
    const clamp = (y: number) => Math.min(Math.max(y, T), H - B);
    const line = s.values.map((v, i) => `${i ? 'L' : 'M'}${X(t[i]).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const top = s.hi.map((v, i) => `${i ? 'L' : 'M'}${X(t[i]).toFixed(1)} ${clamp(Y(v)).toFixed(1)}`).join('');
    const bot = s.lo.map((v, i) => `L${X(t[i]).toFixed(1)} ${clamp(Y(v)).toFixed(1)}`).reverse().join('');
    const idx = new Map(s.timestamps.map((x, i) => [x, i]));
    const yticks = Array.from({ length: 5 }, (_, k) => { const fv = lo + ((hi - lo) * k) / 4; return { y: T + (1 - k / 4) * (H - T - B), v: scale === 'log' ? Math.expm1(fv) : fv }; }).filter(k => k.v >= 0);
    const xticks: { x: number; label: string }[] = []; const d0 = new Date(tn); d0.setUTCHours(24, 0, 0, 0);
    const stepDays = Math.max(1, Math.round((tx - tn) / 864e5 / 6));
    for (let ms = d0.getTime(); ms < tx; ms += stepDays * 864e5) xticks.push({ x: X(ms), label: new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) });
    return { X, Y, t, line, band: top + bot + 'Z', idx, yticks, xticks, burnX: X(Date.parse(s.warmup_until + 'Z')) };
  }, [s, scale]);
  const sel = s.flagged[selected];
  const i = sel ? g.idx.get(sel.timestamp) ?? 0 : 0;
  const desc = `Traffic for ${id}: ${s.values.length} readings, ${s.flagged.length} flagged points. The grey band is the normal range the model learned.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
      <defs><clipPath id={clip}><rect x={L} y={T} width={W - L - R} height={H - T - B} /></clipPath></defs>
      {g.yticks.map(k => <g key={k.y}><line x1={L} x2={W - R} y1={k.y} y2={k.y} stroke="var(--line)" /><text x={L - 8} y={k.y + 4} textAnchor="end">{fmt(k.v)}</text></g>)}
      {g.xticks.map(k => <text key={k.x} x={k.x} y={H - 8} textAnchor="middle">{k.label}</text>)}
      <rect x={L} y={T} width={Math.max(g.burnX - L, 0)} height={H - T - B} fill="var(--panel)" /><text x={L + 6} y={T + 14}>learning, no alerts</text>
      <g clipPath={`url(#${clip})`}>
        <path d={g.band} fill="var(--grey-bg)" opacity=".85" />
        <path d={g.line} fill="none" stroke="var(--text)" strokeWidth="1" strokeLinejoin="round" />
        {s.flagged.map(f => { const k = g.idx.get(f.timestamp) ?? 0; const seg = s.values.slice(k, k + 8).map((v, j) => `${j ? 'L' : 'M'}${g.X(g.t[k + j]).toFixed(1)} ${g.Y(v).toFixed(1)}`).join(''); return <path key={f.timestamp} d={seg} fill="none" stroke="var(--olive)" strokeWidth="2" />; })}
      </g>
      {s.flagged.map((f, n) => { const k = g.idx.get(f.timestamp) ?? 0; return <circle key={f.timestamp} cx={g.X(g.t[k])} cy={g.Y(f.value)} r={n === selected ? 6 : 4.2} fill="var(--olive)" stroke="var(--bg)" strokeWidth="1.5" />; })}
      {sel && (() => { const x = g.X(g.t[i]), y = g.Y(sel.value); const right = x > W * 0.55; return <text className="ann" x={right ? x - 10 : x + 10} y={Math.max(y - 10, T + 28)} textAnchor={right ? 'end' : 'start'}>{when(sel.timestamp)}: {fmt(sel.value)} vs normal up to {fmt(s.hi[i])}</text>; })()}
    </svg>
  );
}
