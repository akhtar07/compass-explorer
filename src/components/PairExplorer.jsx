import React, { useMemo, useState } from 'react'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { CLASSES, CLASS_COLOR, CLASS_SHORT } from '../lib/util'
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const DLABELS = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12']

export default function PairExplorer({ elements, pairs }) {
  const symbols = useMemo(() => Object.keys(elements).sort(), [elements])
  const [A, setA] = useState('Mg')
  const [B, setB] = useState('Y')
  const [imgIdx, setImgIdx] = useState(0)

  const pair = useMemo(() => {
    return pairs.find(p => (p.A === A && p.B === B) || (p.A === B && p.B === A)) || null
  }, [pairs, A, B])

  // normalize each D across the dataset for radar (0..1)
  const ranges = useMemo(() => {
    const r = {}
    DLABELS.forEach(d => {
      let mn = Infinity, mx = -Infinity
      pairs.forEach(p => { const v = p.D[d]; if (v != null) { mn = Math.min(mn, v); mx = Math.max(mx, v) } })
      r[d] = [mn, mx]
    })
    return r
  }, [pairs])

  const radarData = useMemo(() => {
    if (!pair) return null
    const vals = DLABELS.map(d => {
      const v = pair.D[d]; const [mn, mx] = ranges[d]
      return (v == null || mx === mn) ? 0 : (v - mn) / (mx - mn)
    })
    return {
      labels: DLABELS,
      datasets: [{
        label: `${pair.A}-${pair.B}`, data: vals,
        backgroundColor: 'rgba(56,189,248,0.18)', borderColor: '#38bdf8',
        pointBackgroundColor: '#38bdf8', borderWidth: 2,
      }],
    }
  }, [pair, ranges])

  const imgs = pair?.phase_imgs || []
  const curImg = imgs.length ? imgs[Math.min(imgIdx, imgs.length - 1)] : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4 flex-wrap">
        <Picker label="Element A" value={A} onChange={setA} options={symbols} />
        <span className="text-2xl text-slate-500 pb-1">+</span>
        <Picker label="Element B" value={B} onChange={setB} options={symbols} />
      </div>

      {!pair ? (
        <div className="card p-6 text-slate-400">
          No hand-verified phase diagram for <b>{A}-{B}</b> in the 610-pair benchmark set.
          Try another combination (e.g. Mg-Y, Cu-Zn, Ag-Au, Fe-Cr).
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* prediction + labels */}
          <div className="card glow p-4">
            <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-3">Phase behaviour</h3>
            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-1">Hand-verified label(s)</div>
              <div className="flex flex-wrap gap-1">
                {pair.truth.length ? pair.truth.map(c => <Chip key={c} c={c} solid />) :
                  <span className="text-slate-500 text-sm">—</span>}
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-1">COMPASS-12 prediction</div>
              <div className="flex flex-wrap gap-1">
                {pair.pred.length ? pair.pred.map(c => <Chip key={c} c={c} />) :
                  <span className="text-slate-500 text-sm">none above threshold</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Per-class probability</div>
              {CLASSES.map(c => (
                <div key={c} className="flex items-center gap-2 mb-1">
                  <span className="w-16 text-xs" style={{ color: CLASS_COLOR[c] }}>{CLASS_SHORT[c]}</span>
                  <div className="flex-1 h-2 rounded bg-[#1c2440] overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(pair.prob[c] * 100).toFixed(0)}%`, background: CLASS_COLOR[c] }} />
                  </div>
                  <span className="w-10 text-right text-xs font-mono">{pair.prob[c].toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* radar */}
          <div className="card glow p-4">
            <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-1">Descriptors D1–D12</h3>
            <div className="text-[10px] text-slate-500 mb-2">normalized across the 610-pair set</div>
            {radarData && <Radar data={radarData} options={radarOpts} />}
          </div>

          {/* phase diagram */}
          <div className="card glow p-4">
            <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">Binary phase diagram</h3>
            {curImg ? (
              <>
                <div className="bg-white rounded-lg p-1 flex items-center justify-center">
                  <img src={`./phase/${curImg}`} alt={`${pair.pair} phase diagram`}
                       className="max-h-[300px] w-auto object-contain" />
                </div>
                {imgs.length > 1 && (
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                    <button className="px-2 py-1 rounded bg-[#1c2440] hover:bg-[#26305a]"
                      onClick={() => setImgIdx(i => Math.max(0, i - 1))}>‹ prev</button>
                    <span>{Math.min(imgIdx, imgs.length - 1) + 1} / {imgs.length} · {curImg}</span>
                    <button className="px-2 py-1 rounded bg-[#1c2440] hover:bg-[#26305a]"
                      onClick={() => setImgIdx(i => Math.min(imgs.length - 1, i + 1))}>next ›</button>
                  </div>
                )}
              </>
            ) : <div className="text-slate-500 text-sm">No image available.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

const radarOpts = {
  scales: { r: {
    min: 0, max: 1, grid: { color: '#26304e' }, angleLines: { color: '#26304e' },
    pointLabels: { color: '#9aa3bd', font: { size: 11 } }, ticks: { display: false },
  } },
  plugins: { legend: { display: false } }, maintainAspectRatio: true,
}

function Picker({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-[#141b30] border border-[#2a3350] rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:border-sky-500">
        {options.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}

function Chip({ c, solid }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={solid
        ? { background: CLASS_COLOR[c], color: '#0b1020' }
        : { border: `1px solid ${CLASS_COLOR[c]}`, color: CLASS_COLOR[c] }}>
      {c}
    </span>
  )
}
