import React, { useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, PointElement, Tooltip, Legend } from 'chart.js'
import { ScatterChart, Crosshair, X } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, viridis } from '../lib/util'
import { useApp, useChartTheme } from '../lib/app'
ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

export const D_SHORT = {
  D1: 'dominant-orbital mismatch', D2: 'bond-weighted mismatch', D3: 'mean orbital energy', D4: 'valence similarity',
  D5: 'Harrison coupling', D6: 'bond stabilization', D7: 'size mismatch', D8: 'electronegativity diff.',
  D9: 'mean cohesion', D10: 'cohesion mismatch', D11: 'mean bond order', D12: 'bond-order mismatch', D13: 'group distance',
}
const DOPTS = Object.keys(D_SHORT)
const PRIORITY = ['intermetallic', 'immiscible', 'partial', 'isomorphous']
const dlabel = d => `${d} · ${D_SHORT[d]}`

export default function ClassMap({ pairs, dft }) {
  const { openPair, theme } = useApp()
  const ct = useChartTheme()
  const [xD, setXD] = useState('D2')
  const [yD, setYD] = useState('D7')
  const [colorBy, setColorBy] = useState('class') // 'class' | 'stable'
  const [hl, setHl] = useState('')
  const [hidden, setHidden] = useState(() => new Set())

  const maxStable = useMemo(() =>
    Math.max(1, ...pairs.map(p => dft?.[p.pair]?.n_stable || 0)), [pairs, dft])

  const needle = hl.trim().toLowerCase()
  const isHl = p => needle && p.pair.toLowerCase().includes(needle)

  const { datasets, shown, total, nHl } = useMemo(() => {
    let total = 0, shown = 0, nHl = 0
    const radius = (pts, base) => pts.map(d => d.hl ? base + 5 : (needle ? Math.max(2, base - 1) : base))
    const alpha = (pts, col) => pts.map(d => col + (d.hl ? 'ff' : needle ? '55' : 'cc'))
    if (colorBy === 'stable') {
      const data = []
      pairs.forEach(p => {
        const x = p.D[xD], y = p.D[yD]; if (x == null || y == null) return
        total++; shown++
        const n = dft?.[p.pair]?.n_stable || 0
        const h = isHl(p); if (h) nHl++
        data.push({ x, y, label: p.pair, pair: p, n, hl: h })
      })
      return { total, shown, nHl, datasets: [{
        label: 'DFT-stable compounds', data,
        backgroundColor: data.map(d => viridis(d.n / maxStable)),
        borderColor: data.map(d => d.hl ? ct.ink : 'transparent'), borderWidth: 1.5,
        pointRadius: radius(data, 4), pointHoverRadius: 8,
      }] }
    }
    const byClass = Object.fromEntries(CLASSES.map(c => [c, []]))
    pairs.forEach(p => {
      const x = p.D[xD], y = p.D[yD]; if (x == null || y == null) return
      total++
      const dom = PRIORITY.find(c => p.truth.includes(c)) || 'isomorphous'
      if (hidden.has(dom)) return
      shown++
      const h = isHl(p); if (h) nHl++
      byClass[dom].push({ x, y, label: p.pair, pair: p, hl: h })
    })
    return { total, shown, nHl, datasets: CLASSES.map(c => ({
      label: CLASS_LABEL[c], data: byClass[c], cls: c,
      backgroundColor: alpha(byClass[c], CLASS_COLOR[c]),
      borderColor: byClass[c].map(d => d.hl ? ct.ink : 'transparent'), borderWidth: 1.5,
      pointRadius: radius(byClass[c], 4), pointHoverRadius: 8,
    })) }
  }, [pairs, xD, yD, colorBy, dft, maxStable, needle, hidden, ct])

  const toggleClass = c => setHidden(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })

  const options = useMemo(() => ({
    maintainAspectRatio: false, animation: { duration: 250 },
    onClick: (evt, els, chart) => {
      if (!els.length) return
      const e = els[0]; const raw = chart.data.datasets[e.datasetIndex].data[e.index]
      if (raw?.pair) openPair(raw.pair.pair)
    },
    onHover: (evt, els) => { if (evt.native) evt.native.target.style.cursor = els.length ? 'pointer' : 'default' },
    scales: {
      x: { title: { display: true, text: dlabel(xD), color: ct.dim, font: { family: ct.font } }, grid: { color: ct.grid }, ticks: { color: ct.dim, font: { family: ct.font } }, border: { color: ct.grid } },
      y: { title: { display: true, text: dlabel(yD), color: ct.dim, font: { family: ct.font } }, grid: { color: ct.grid }, ticks: { color: ct.dim, font: { family: ct.font } }, border: { color: ct.grid } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: ct.panel, titleColor: ct.ink, bodyColor: ct.dim, borderColor: ct.grid, borderWidth: 1,
        titleFont: { family: ct.font, weight: '600' }, bodyFont: { family: ct.font },
        callbacks: {
          title: items => items[0]?.raw?.label || '',
          label: ctx => {
            const r = ctx.raw
            const lines = [`${xD} = ${r.x.toFixed(3)}   ${yD} = ${r.y.toFixed(3)}`]
            if (r.pair) lines.push(`ground truth: ${r.pair.truth.map(c => CLASS_LABEL[c]).join(' + ')}`)
            if (r.n != null) lines.push(`${r.n} DFT-stable compound${r.n === 1 ? '' : 's'}`)
            lines.push('click to open')
            return lines
          },
        },
      },
    },
  }), [xD, yD, ct, openPair])

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[.12em] text-[var(--dim)]"><ScatterChart size={13} className="text-[var(--accent)]" /> Classification map · descriptor space</div>
        <div className="flex items-end gap-3 flex-wrap">
          <Sel label="X axis" value={xD} onChange={setXD} />
          <Sel label="Y axis" value={yD} onChange={setYD} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--dim)]">Colour by</label>
            <div className="seg">
              <button className={colorBy === 'class' ? 'on' : ''} onClick={() => setColorBy('class')}>Ground-truth class</button>
              <button className={colorBy === 'stable' ? 'on' : ''} onClick={() => setColorBy('stable')}>DFT-stable count</button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--dim)] flex items-center gap-1"><Crosshair size={11} /> Highlight systems containing</label>
            <div className="relative">
              <input className="inp w-44 pr-7" value={hl} onChange={e => setHl(e.target.value)} placeholder="e.g. Ti, Al-, -Ni" />
              {hl && <button onClick={() => setHl('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--dim)] hover:text-[var(--text)]"><X size={13} /></button>}
            </div>
          </div>
          <div className="text-xs text-[var(--dim)] ml-auto max-w-sm leading-relaxed">
            {colorBy === 'class'
              ? 'Coloured by dominant ground-truth class (inter > immis > partial > iso). Click a legend entry to hide a class; click any point for its full page.'
              : <>Viridis scale: dark = 0, bright = <span className="mono">{maxStable}</span> DFT-stable compounds. Click any point for its full page.</>}
          </div>
        </div>
        {colorBy === 'class' && (
          <div className="flex flex-wrap items-center gap-2">
            {CLASSES.map(c => {
              const off = hidden.has(c); const n = datasets.find(d => d.cls === c)?.data.length ?? 0
              return (
                <button key={c} onClick={() => toggleClass(c)} className="facet" style={off ? { opacity: .45, textDecoration: 'line-through' } : { borderColor: CLASS_COLOR[c] + '88', color: CLASS_COLOR[c] }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[c] }} /> {CLASS_LABEL[c]} <span className="mono opacity-70">{off ? '' : n}</span>
                </button>
              )
            })}
            {hidden.size > 0 && <button className="text-xs link" onClick={() => setHidden(new Set())}>show all</button>}
          </div>
        )}
        <div className="text-[11px] text-[var(--dim)]">
          <span className="mono">{shown}</span> of <span className="mono">{total}</span> systems plotted with both descriptors
          {needle && <> · <span className="mono">{nHl}</span> highlighted for “{hl.trim()}”</>}
          {total < pairs.length && <> · <span className="mono">{pairs.length - total}</span> lack a value (D9–D12 need LOBSTER data for both elements)</>}
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 560 }}>
        <Scatter key={theme + colorBy} data={{ datasets }} options={options} />
      </div>
    </div>
  )
}

function Sel({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--dim)]">{label}</label>
      <select className="sel" value={value} onChange={e => onChange(e.target.value)}>
        {DOPTS.map(d => <option key={d} value={d}>{dlabel(d)}</option>)}
      </select>
    </div>
  )
}
