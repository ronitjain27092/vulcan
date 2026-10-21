import type { Source } from './types';
import { SOURCE_COLOR } from './components';

/** Hand-drawn SVG sankey: six sources -> engine -> paged / held. All sizes derive from the data passed in. */
export function Flow({ sources, alarms, paged, held, heldPercent }: { sources: Source[]; alarms: number; paged: number; held: number; heldPercent: number }) {
  const X0 = 225, E0 = 470, E1 = 590, X1 = 780, TOP = 24, KIN = 0.43, KE = 0.323, GAP = 3, ENG_TOP = 69;
  const mid = (a: number, b: number) => (a + b) / 2;
  const band = (xa: number, ya0: number, ya1: number, xb: number, yb0: number, yb1: number) => {
    const m = mid(xa, xb);
    return `M${xa} ${ya0} C${m} ${ya0},${m} ${yb0},${xb} ${yb0} L${xb} ${yb1} C${m} ${yb1},${m} ${ya1},${xa} ${ya1}Z`;
  };
  let ys = TOP + 26, ye = ENG_TOP;
  const rows = sources.map(s => {
    const h = Math.max(s.alarms * KIN, 6), he = s.alarms * KE;
    const r = { s, y0: ys, y1: ys + h, e0: ye, e1: ye + he };
    ys += h + GAP; ye += he; return r;
  });
  // labels follow ribbon centres but keep a minimum spacing so small sources stay readable
  let last = -99;
  const labelY = rows.map(r => { const y = Math.max(mid(r.y0, r.y1), last + 23); last = y; return y; });
  const engBottom = ENG_TOP + alarms * KE;
  const pagedH = paged * KE, heldH = held * KE;
  const outRedY = TOP + 66, outGreyY = outRedY + pagedH + 6;
  const label = `${sources.length} sources send ${alarms} alarms into Vulcan. ${paged} are paged to the on-call lead and ${held} are held, each with its reason.`;
  return (
    <svg className="flow" viewBox="0 0 1000 250" role="img" aria-label={label}>
      <text x="0" y="14" className="m" fontSize="14.5">{sources.length} sources report</text>
      <text x="1000" y="14" className="m" fontSize="14.5" textAnchor="end">{heldPercent}% of it held back</text>
      {rows.map(({ s, y0, y1, e0, e1 }, i) => (
        <g key={s.key}>
          <path d={band(X0, y0, y1, E0, e0, e1)} fill={SOURCE_COLOR[s.chip]} opacity=".42" />
          <rect x="0" y={labelY[i] - 10} width="3" height="20" fill={SOURCE_COLOR[s.chip]} />
          <rect x="10" y={labelY[i] - 9} width={s.chip.length * 7.4 + 12} height="18" rx="3" fill="var(--chip-bg)" />
          <text x={16} y={labelY[i] + 4} fontSize="12" fontWeight="600" fill={SOURCE_COLOR[s.chip]} style={{ fill: SOURCE_COLOR[s.chip] }}>{s.chip}</text>
          <text x={10 + s.chip.length * 7.4 + 20} y={labelY[i] + 5} fontSize="13">{s.name}</text>
          <text x="214" y={labelY[i] + 5} fontSize="13.5" textAnchor="end" className="m">{s.alarms}</text>
        </g>
      ))}
      <text x="530" y="56" textAnchor="middle"><tspan fontSize="30" fontWeight="500">{alarms}</tspan><tspan className="m" fontSize="14" dx="6">alarms in</tspan></text>
      <rect x={E0} y={ENG_TOP} width={E1 - E0} height={engBottom - ENG_TOP} rx="7" fill="var(--panel)" stroke="var(--line)" />
      <g transform={`translate(${(E0 + E1) / 2 - 14} ${ENG_TOP + 28})`}>
        <path d="M0 8c1-6 7-8 14-8s13 2 14 8c-1 9-6 18-14 18S1 17 0 8z" fill="var(--text)" /><ellipse cx="14" cy="9" rx="8" ry="3.6" fill="var(--panel)" /><circle cx="14" cy="9" r="2.2" fill="var(--text)" />
      </g>
      <text x="530" y={ENG_TOP + 78} textAnchor="middle" fontSize="15" fontWeight="500">Vulcan</text>
      <text x="530" y={ENG_TOP + 95} textAnchor="middle" fontSize="11.5" className="m">Intelligent</text>
      <text x="530" y={ENG_TOP + 109} textAnchor="middle" fontSize="11.5" className="m">Decision Engine</text>
      <path d={band(E1, ENG_TOP, ENG_TOP + pagedH, X1, outRedY, outRedY + pagedH)} fill="var(--red)" opacity=".85" />
      <path d={band(E1, ENG_TOP + pagedH, engBottom, X1, outGreyY, outGreyY + heldH)} fill="var(--flow-grey)" />
      <text x="803" y={outRedY + 14} fontSize="38" fontWeight="500" style={{ fill: 'var(--red)' }}>{paged}</text>
      <text x="803" y={outRedY + 38} fontSize="14.5" className="m">paged to the on-call lead</text>
      <text x="803" y={outGreyY + 82} fontSize="38" fontWeight="500">{held}</text>
      <text x="803" y={outGreyY + 106} fontSize="14.5" className="m">held, each with its reason</text>
    </svg>
  );
}
