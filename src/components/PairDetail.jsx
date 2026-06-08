import React, { useMemo, useState } from 'react'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { CLASSES, CLASS_COLOR, CLASS_LABEL } from '../lib/util'
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const DL = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12']

export default function PairDetail({ pair, allPairs }) {
  const [invert, setInvert] = useState(() => !document.documentElement.classList.contains('light'))
  const ranges = useMemo(() => {
    const r = {}
    DL.forEach(d => {
      let mn = Infinity, mx = -Infinity
      allPairs.forEach(p => { const v = p.D[d]; if (v != null) { mn = Math.min(mn, v); mx = Math.max(mx, v) } })
      r[d] = [mn, mx]
    })
    return r
  }, [allPairs])

  const radar = useMemo(() => ({
    labels: DL,
    datasets: [{
      data: DL.map(d => { const v = pair.D[d], [mn, mx] = ranges[d]; return (v == null || mx === mn) ? 0 : (v - mn) / (mx - mn) }),
      backgroundColor: 'rgba(56,189,248,0.18)', borderColor: '#38bdf8',
      pointBackgroundColor: '#38bdf8', borderWidth: 2,
    }],
  }), [pair, ranges])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* phase diagram */}
      <div className="card glow p-4 lg:col-span-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm uppercase tracking-wide text-[var(--dim)]">{pair.A}–{pair.B} phase diagram</h3>
          <button onClick={() => setInvert(v => !v)}
            className="text-[11px] px-2 py-1 rounded bg-[var(--panel2)] hover:bg-[var(--panel2)] text-[var(--text)]">
            {invert ? 'dark' : 'original'}
          </button>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: invert ? '#0b1020' : '#fff' }}>
          <img src={`./phase/${pair.phase_img}`} alt={`${pair.A}-${pair.B} phase diagram`}
            className="w-full object-contain"
            style={invert ? { filter: 'invert(1) hue-rotate(180deg)', mixBlendMode: 'screen' } : {}} />
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Hand-verified CALPHAD phase diagram (rendered to 25 °C).</div>
      </div>

      {/* prediction */}
      <div className="card glow p-4">
        <h3 className="text-sm uppercase tracking-wide text-[var(--dim)] mb-3">Phase behaviour</h3>
        <Block title="Hand-verified label(s)">
          {pair.truth.length ? pair.truth.map(c => <Chip key={c} c={c} solid />) : <Dash />}
        </Block>
        <Block title="COMPASS-12 prediction">
          {pair.pred.length ? pair.pred.map(c => <Chip key={c} c={c} />) : <span className="text-slate-500 text-sm">none above threshold</span>}
        </Block>
        <div className="text-xs text-slate-500 mb-1 mt-3">Per-class probability</div>
        {CLASSES.map(c => (
          <div key={c} className="flex items-center gap-2 mb-1">
            <span className="w-24 text-[11px]" style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span>
            <div className="flex-1 h-2 rounded bg-[var(--panel2)] overflow-hidden">
              <div className="h-full" style={{ width: `${(pair.prob[c] * 100).toFixed(0)}%`, background: CLASS_COLOR[c] }} />
            </div>
            <span className="w-9 text-right text-xs font-mono">{pair.prob[c].toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* radar */}
      <div className="card glow p-4">
        <h3 className="text-sm uppercase tracking-wide text-[var(--dim)] mb-1">Descriptors D1–D12</h3>
        <div className="text-[10px] text-slate-500 mb-2">normalized across the 610-pair set · see the Descriptors tab for definitions</div>
        <Radar data={radar} options={{
          scales: { r: { min: 0, max: 1, grid: { color: '#26304e' }, angleLines: { color: '#26304e' },
            pointLabels: { color: '#9aa3bd', font: { size: 11 } }, ticks: { display: false } } },
          plugins: { legend: { display: false } },
        }} />
      </div>
    </div>
  )
}

const Block = ({ title, children }) => (
  <div className="mb-3">
    <div className="text-xs text-slate-500 mb-1">{title}</div>
    <div className="flex flex-wrap gap-1">{children}</div>
  </div>
)
const Dash = () => <span className="text-slate-500 text-sm">—</span>
const Chip = ({ c, solid }) => (
  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
    style={solid ? { background: CLASS_COLOR[c], color: '#0b1020' } : { border: `1px solid ${CLASS_COLOR[c]}`, color: CLASS_COLOR[c] }}>
    {CLASS_LABEL[c]}
  </span>
)
