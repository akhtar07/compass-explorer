import React, { useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, LogarithmicScale, PointElement, Tooltip, Legend } from 'chart.js'
ChartJS.register(LinearScale, LogarithmicScale, PointElement, Tooltip, Legend)

// Ashby-style materials-selection chart over the 48 metallic elements.
// Axes come from property_axes.json; per-pair alloy bounds live in pairs.json,
// but the element scatter is the honest, measurable layer.
export default function AshbyChart({ elements, axes }) {
  const keys = Object.keys(axes)
  const [xK, setXK] = useState('density')
  const [yK, setYK] = useState('youngs_modulus_GPa')

  const pts = useMemo(() => {
    return Object.values(elements)
      .filter(e => e.has_data && e[xK] != null && e[yK] != null)
      .map(e => ({ x: e[xK], y: e[yK], label: e.symbol }))
  }, [elements, xK, yK])

  const ax = (k) => ({
    type: axes[k].log ? 'logarithmic' : 'linear',
    title: { display: true, text: `${axes[k].label} (${axes[k].unit})`, color: '#9aa3bd' },
    grid: { color: '#1e2742' }, ticks: { color: '#7c87a8' },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3 flex-wrap">
        <Sel label="X axis" value={xK} onChange={setXK} axes={axes} keys={keys} />
        <Sel label="Y axis" value={yK} onChange={setYK} axes={axes} keys={keys} />
        <div className="text-xs text-[var(--dim)] ml-2 max-w-md">
          Each point is a pure element (48 with data). Density &amp; Young's modulus are public-domain
          constants; thermal conductivity, melting point, UTS and price come from MAGPIE/JARVIS tables.
          Alloy values lie between their constituents (rule-of-mixtures bounds).
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 540 }}>
        <Scatter
          data={{ datasets: [{
            label: `${axes[yK].label} vs ${axes[xK].label}`,
            data: pts,
            backgroundColor: '#38bdf8cc', pointRadius: 5, pointHoverRadius: 8,
          }] }}
          options={{
            maintainAspectRatio: false,
            scales: { x: ax(xK), y: ax(yK) },
            plugins: {
              legend: { labels: { color: '#cdd5ee' } },
              tooltip: { callbacks: {
                label: ctx => `${ctx.raw.label}: ${ctx.raw.x} ${axes[xK].unit}, ${ctx.raw.y} ${axes[yK].unit}`,
              } },
            },
          }}
        />
      </div>
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
