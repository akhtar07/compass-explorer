import React, { useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, LogarithmicScale, PointElement, Tooltip, Legend } from 'chart.js'
import { ArrowLeft } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'
import PairDetail from './PairDetail'
ChartJS.register(LinearScale, LogarithmicScale, PointElement, Tooltip, Legend)

// Ashby-style materials-selection chart. Two layers:
//  - Elements: the 48 metallic elements (measurable constants / MAGPIE-JARVIS tables).
//  - Binary systems (DFT): every 970 system positioned by its EXTRACTED multi-source
//    DFT properties (elastic moduli, formation energy, hull distance, stable-compound
//    count) and alloy property means, coloured by hand-verified class, click-through.
const SYS_AXES = {
  density:            { label: "Density (mean)", unit: 'g/cc', log: false, get: (p) => p.props?.density?.mean },
  youngs_modulus_GPa: { label: "Young's modulus (alloy mean)", unit: 'GPa', log: false, get: (p) => p.props?.youngs_modulus_GPa?.mean },
  specific_stiffness: { label: 'Specific stiffness (mean)', unit: 'MN·m/kg', log: false, get: (p) => p.props?.specific_stiffness?.mean },
  JARVIS_mp:          { label: 'Melting point (mean)', unit: 'K', log: false, get: (p) => p.props?.JARVIS_mp?.mean },
  JARVIS_therm_cond:  { label: 'Thermal cond. (mean)', unit: 'W/mK', log: false, get: (p) => p.props?.JARVIS_therm_cond?.mean },
  Price_USD_kg:       { label: 'Price (mean)', unit: '$/kg', log: true, get: (p) => p.props?.Price_USD_kg?.mean },
  dft_young:          { label: 'DFT Young modulus', unit: 'GPa', log: false, get: (p, d) => d?.elastic?.young_GPa },
  dft_bulk:           { label: 'DFT bulk modulus', unit: 'GPa', log: false, get: (p, d) => d?.elastic?.bulk_GPa },
  dft_shear:          { label: 'DFT shear modulus', unit: 'GPa', log: false, get: (p, d) => d?.elastic?.shear_GPa },
  dft_Ef:             { label: 'Ground-state formation E', unit: 'eV/atom', log: false, get: (p, d) => d?.ground_state?.Ef },
  dft_hull:           { label: 'Min hull distance', unit: 'eV', log: false, get: (p, d) => d?.min_hull },
  dft_nstable:        { label: 'DFT-stable compounds', unit: '#', log: false, get: (p, d) => d?.n_stable },
}

export default function AshbyChart({ elements, axes, pairs, dft }) {
  const [mode, setMode] = useState('systems') // 'systems' | 'elements'
  const [open, setOpen] = useState(null)

  if (open) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setOpen(null)} className="self-start flex items-center gap-2 text-sm text-[var(--dim)] hover:text-[var(--text)]">
          <ArrowLeft size={16} /> back to chart
        </button>
        <PairDetail pair={open} allPairs={pairs} dft={dft} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {[['systems', 'Binary systems (DFT)'], ['elements', 'Pure elements']].map(([m, lab]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-sm ${mode === m ? 'chip-grad text-[var(--text)] font-medium' : 'text-[var(--dim)] hover:bg-[var(--panel2)]'}`}>
            {lab}
          </button>
        ))}
      </div>
      {mode === 'systems'
        ? <SystemAshby pairs={pairs} dft={dft} onOpen={setOpen} />
        : <ElementAshby elements={elements} axes={axes} />}
    </div>
  )
}

function SystemAshby({ pairs, dft, onOpen }) {
  const [xK, setXK] = useState('density')
  const [yK, setYK] = useState('dft_young')

  const datasets = useMemo(() => {
    const X = SYS_AXES[xK], Y = SYS_AXES[yK]
    const byClass = Object.fromEntries(CLASSES.map(c => [c, []]))
    pairs.forEach(p => {
      const d = dft?.[p.pair]
      const x = X.get(p, d), y = Y.get(p, d)
      if (x == null || y == null || isNaN(x) || isNaN(y)) return
      const dom = dominantClass(p.truth) || 'isomorphous'
      byClass[dom].push({ x, y, label: p.pair, pair: p })
    })
    return CLASSES.map(c => ({
      label: `${CLASS_LABEL[c]} (${byClass[c].length})`, data: byClass[c],
      backgroundColor: CLASS_COLOR[c] + 'cc', pointRadius: 4, pointHoverRadius: 8,
    }))
  }, [pairs, dft, xK, yK])

  const total = datasets.reduce((s, d) => s + d.data.length, 0)
  const ax = k => ({
    type: SYS_AXES[k].log ? 'logarithmic' : 'linear',
    title: { display: true, text: `${SYS_AXES[k].label} (${SYS_AXES[k].unit})`, color: '#9aa3bd' },
    grid: { color: '#1e2742' }, ticks: { color: '#7c87a8' },
  })

  return (
    <>
      <div className="flex items-end gap-3 flex-wrap">
        <SysSel label="X axis" value={xK} onChange={setXK} />
        <SysSel label="Y axis" value={yK} onChange={setYK} />
        <div className="text-xs text-[var(--dim)] ml-2 max-w-md">
          {total} systems with both values. DFT moduli / formation energy / hull come from MP·OQMD·JARVIS
          (source-tagged, not averaged); property means are alloy rule-of-mixtures. Click a point for its full page.
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 540 }}>
        <Scatter data={{ datasets }} options={{
          maintainAspectRatio: false,
          onClick: (evt, els, chart) => {
            if (!els.length) return
            const e = els[0]; const raw = chart.data.datasets[e.datasetIndex].data[e.index]
            if (raw?.pair) onOpen(raw.pair)
          },
          onHover: (evt, els) => { if (evt.native) evt.native.target.style.cursor = els.length ? 'pointer' : 'default' },
          scales: { x: ax(xK), y: ax(yK) },
          plugins: {
            legend: { labels: { color: '#cdd5ee' } },
            tooltip: { callbacks: {
              label: ctx => `${ctx.raw.label}: ${(+ctx.raw.x).toFixed(2)} ${SYS_AXES[xK].unit}, ${(+ctx.raw.y).toFixed(2)} ${SYS_AXES[yK].unit}`,
            } },
          },
        }} />
      </div>
    </>
  )
}

function ElementAshby({ elements, axes }) {
  const keys = Object.keys(axes)
  const [xK, setXK] = useState('density')
  const [yK, setYK] = useState('youngs_modulus_GPa')
  const pts = useMemo(() => Object.values(elements)
    .filter(e => e.has_data && e[xK] != null && e[yK] != null)
    .map(e => ({ x: e[xK], y: e[yK], label: e.symbol })), [elements, xK, yK])
  const ax = k => ({
    type: axes[k].log ? 'logarithmic' : 'linear',
    title: { display: true, text: `${axes[k].label} (${axes[k].unit})`, color: '#9aa3bd' },
    grid: { color: '#1e2742' }, ticks: { color: '#7c87a8' },
  })
  return (
    <>
      <div className="flex items-end gap-3 flex-wrap">
        <Sel label="X axis" value={xK} onChange={setXK} axes={axes} keys={keys} />
        <Sel label="Y axis" value={yK} onChange={setYK} axes={axes} keys={keys} />
        <div className="text-xs text-[var(--dim)] ml-2 max-w-md">
          Each point is a pure element (48 with data). Alloy values lie between their constituents (rule-of-mixtures bounds).
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 540 }}>
        <Scatter data={{ datasets: [{ label: `${axes[yK].label} vs ${axes[xK].label}`, data: pts,
          backgroundColor: '#38bdf8cc', pointRadius: 5, pointHoverRadius: 8 }] }}
          options={{ maintainAspectRatio: false, scales: { x: ax(xK), y: ax(yK) },
            plugins: { legend: { labels: { color: '#cdd5ee' } },
              tooltip: { callbacks: { label: ctx => `${ctx.raw.label}: ${ctx.raw.x} ${axes[xK].unit}, ${ctx.raw.y} ${axes[yK].unit}` } } } }} />
      </div>
    </>
  )
}

function SysSel({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--dim)]">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
        {Object.entries(SYS_AXES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </div>
  )
}

function Sel({ label, value, onChange, axes, keys }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--dim)]">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
        {keys.map(k => <option key={k} value={k}>{axes[k].label}</option>)}
      </select>
    </div>
  )
}
