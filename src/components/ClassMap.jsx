import React, { useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, PointElement, Tooltip, Legend } from 'chart.js'
import { ArrowLeft } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, viridis } from '../lib/util'
import PairDetail from './PairDetail'
ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

const DOPTS = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13']
const PRIORITY = ['intermetallic', 'immiscible', 'partial', 'isomorphous']

export default function ClassMap({ pairs, dft }) {
  const [xD, setXD] = useState('D2')
  const [yD, setYD] = useState('D7')
  const [colorBy, setColorBy] = useState('class') // 'class' | 'stable'
  const [open, setOpen] = useState(null)

  const maxStable = useMemo(() =>
    Math.max(1, ...pairs.map(p => dft?.[p.pair]?.n_stable || 0)), [pairs, dft])

  const datasets = useMemo(() => {
    if (colorBy === 'stable') {
      const data = []
      pairs.forEach(p => {
        const x = p.D[xD], y = p.D[yD]; if (x == null || y == null) return
        const n = dft?.[p.pair]?.n_stable || 0
        data.push({ x, y, label: p.pair, pair: p, n })
      })
      return [{
        label: 'DFT-stable compounds',
        data,
        backgroundColor: data.map(d => viridis(d.n / maxStable)),
        pointRadius: 4, pointHoverRadius: 8,
      }]
    }
    const byClass = Object.fromEntries(CLASSES.map(c => [c, []]))
    pairs.forEach(p => {
      const x = p.D[xD], y = p.D[yD]; if (x == null || y == null) return
      const dom = PRIORITY.find(c => p.truth.includes(c)) || 'isomorphous'
      byClass[dom].push({ x, y, label: p.pair, pair: p })
    })
    return CLASSES.map(c => ({
      label: CLASS_LABEL[c], data: byClass[c],
      backgroundColor: CLASS_COLOR[c] + 'cc', pointRadius: 4, pointHoverRadius: 8,
    }))
  }, [pairs, xD, yD, colorBy, dft, maxStable])

  if (open) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setOpen(null)} className="self-start flex items-center gap-2 text-sm text-[var(--dim)] hover:text-[var(--text)]">
          <ArrowLeft size={16} /> back to map
        </button>
        <PairDetail pair={open} allPairs={pairs} dft={dft} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3 flex-wrap">
        <Sel label="X axis" value={xD} onChange={setXD} />
        <Sel label="Y axis" value={yD} onChange={setYD} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--dim)]">Colour by</label>
          <select value={colorBy} onChange={e => setColorBy(e.target.value)}
            className="bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
            <option value="class">Ground-truth class</option>
            <option value="stable">DFT-stable compound count</option>
          </select>
        </div>
        <div className="text-xs text-[var(--dim)] ml-2 max-w-xs">
          {colorBy === 'class'
            ? 'Coloured by dominant class (Inter > Immis > Partial > Iso). Click any point for its full page.'
            : `Viridis scale: dark = 0, bright = ${maxStable} DFT-stable compounds. Click any point for its full page.`}
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 540 }}>
        <Scatter data={{ datasets }} options={{
          maintainAspectRatio: false,
          onClick: (evt, els, chart) => {
            if (!els.length) return
            const e = els[0]; const raw = chart.data.datasets[e.datasetIndex].data[e.index]
            if (raw?.pair) setOpen(raw.pair)
          },
          onHover: (evt, els) => { if (evt.native) evt.native.target.style.cursor = els.length ? 'pointer' : 'default' },
          scales: {
            x: { title: { display: true, text: xD, color: '#9aa3bd' }, grid: { color: '#1e2742' }, ticks: { color: '#7c87a8' } },
            y: { title: { display: true, text: yD, color: '#9aa3bd' }, grid: { color: '#1e2742' }, ticks: { color: '#7c87a8' } },
          },
          plugins: {
            legend: { labels: { color: '#cdd5ee' } },
            tooltip: { callbacks: { label: ctx => {
              const r = ctx.raw
              const base = `${r.label}: (${r.x.toFixed(2)}, ${r.y.toFixed(2)})`
              return r.n != null ? `${base} · ${r.n} stable` : base
            } } },
          },
        }} />
      </div>
    </div>
  )
}

function Sel({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--dim)]">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
        {DOPTS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  )
}
