import React, { useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, PointElement, Tooltip, Legend } from 'chart.js'
import { CLASSES, CLASS_COLOR } from '../lib/util'
ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

const DOPTS = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12']
const PRIORITY = ['intermetallic', 'immiscible', 'partial', 'isomorphous']

export default function ClassMap({ pairs }) {
  const [xD, setXD] = useState('D2')
  const [yD, setYD] = useState('D7')

  const datasets = useMemo(() => {
    const byClass = Object.fromEntries(CLASSES.map(c => [c, []]))
    pairs.forEach(p => {
      const x = p.D[xD], y = p.D[yD]
      if (x == null || y == null) return
      const dom = PRIORITY.find(c => p.truth.includes(c)) || 'isomorphous'
      byClass[dom].push({ x, y, label: p.pair })
    })
    return CLASSES.map(c => ({
      label: c, data: byClass[c],
      backgroundColor: CLASS_COLOR[c] + 'cc', pointRadius: 4, pointHoverRadius: 7,
    }))
  }, [pairs, xD, yD])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3 flex-wrap">
        <Sel label="X axis" value={xD} onChange={setXD} />
        <Sel label="Y axis" value={yD} onChange={setYD} />
        <div className="text-xs text-slate-400 ml-2">
          Points coloured by dominant hand-verified class (priority Inter &gt; Immis &gt; Partial &gt; Iso).
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 520 }}>
        <Scatter data={{ datasets }} options={{
          maintainAspectRatio: false,
          scales: {
            x: { title: { display: true, text: xD, color: '#9aa3bd' }, grid: { color: '#1e2742' }, ticks: { color: '#7c87a8' } },
            y: { title: { display: true, text: yD, color: '#9aa3bd' }, grid: { color: '#1e2742' }, ticks: { color: '#7c87a8' } },
          },
          plugins: {
            legend: { labels: { color: '#cdd5ee' } },
            tooltip: { callbacks: { label: ctx => `${ctx.raw.label}: (${ctx.raw.x.toFixed(2)}, ${ctx.raw.y.toFixed(2)})` } },
          },
        }} />
      </div>
    </div>
  )
}

function Sel({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-[#141b30] border border-[#2a3350] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
        {DOPTS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  )
}
