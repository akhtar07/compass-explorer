import React, { useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, LogarithmicScale, PointElement, Tooltip, Legend } from 'chart.js'
import { LineChart, Tag } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'
import { useApp, useChartTheme } from '../lib/app'
ChartJS.register(LinearScale, LogarithmicScale, PointElement, Tooltip, Legend)

// Ashby-style materials-selection chart. Two layers:
//  - Elements: the pure metallic elements (measurable constants / MAGPIE-JARVIS tables).
//  - Binary systems (DFT): every 970 system positioned by its EXTRACTED multi-source
//    DFT properties (elastic moduli, formation energy, hull distance, stable-compound
//    count) and alloy property means, coloured by ground-truth class, click-through.
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
const LABEL_CAP = 120

// instance-scoped plugin: draws each point's label when the dataset opts in
const labelPlugin = {
  id: 'pointLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts?.enabled) return
    const { ctx } = chart
    ctx.save()
    ctx.font = `10px ${opts.font}`; ctx.fillStyle = opts.color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i); if (meta.hidden) return
      meta.data.forEach((el, j) => {
        const lab = ds.data[j]?.label; if (!lab) return
        ctx.fillText(lab, el.x + 6, el.y)
      })
    })
    ctx.restore()
  },
}

function axisOpts(k, spec, log, ct) {
  return {
    type: log ? 'logarithmic' : 'linear',
    title: { display: true, text: `${spec.label} (${spec.unit})${log ? ' · log' : ''}`, color: ct.dim, font: { family: ct.font } },
    grid: { color: ct.grid }, border: { color: ct.grid },
    ticks: { color: ct.dim, font: { family: ct.font }, maxTicksLimit: 9 },
  }
}
function tooltipOpts(ct, label) {
  return {
    backgroundColor: ct.panel, titleColor: ct.ink, bodyColor: ct.dim, borderColor: ct.grid, borderWidth: 1,
    titleFont: { family: ct.font, weight: '600' }, bodyFont: { family: ct.font },
    callbacks: { title: items => items[0]?.raw?.label || '', label },
  }
}
// log axes cannot show non-positive values
const posOk = (v, log) => !log || v > 0

export default function AshbyChart({ elements, axes, pairs, dft }) {
  const [mode, setMode] = useState('systems') // 'systems' | 'elements'
  const seg = (
    <div className="seg self-end">
      <button className={mode === 'systems' ? 'on' : ''} onClick={() => setMode('systems')}>Binary systems (DFT)</button>
      <button className={mode === 'elements' ? 'on' : ''} onClick={() => setMode('elements')}>Pure elements</button>
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      {mode === 'systems'
        ? <SystemAshby pairs={pairs} dft={dft} seg={seg} />
        : <ElementAshby elements={elements} axes={axes} seg={seg} />}
    </div>
  )
}

function Header() {
  return <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[.12em] text-[var(--dim)]"><LineChart size={13} className="text-[var(--accent)]" /> Ashby chart · property space</div>
}

function AxisPicker({ label, value, onChange, options, log, onLog }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--dim)]">{label}</label>
      <div className="flex items-center gap-1.5">
        <select className="sel" value={value} onChange={e => onChange(e.target.value)}>
          {options.map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}
        </select>
        <button onClick={() => onLog(!log)} className={`px-2 py-1.5 rounded-lg text-[11px] border ${log ? 'font-semibold' : ''}`}
          style={log ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)' } : { borderColor: 'var(--border)', color: 'var(--dim)' }}
          title="Toggle logarithmic axis">log</button>
      </div>
    </div>
  )
}

function LabelToggle({ on, setOn, n }) {
  const ok = n <= LABEL_CAP
  return (
    <button onClick={() => ok && setOn(!on)} disabled={!ok} className="pill self-end mb-1.5 disabled:opacity-40"
      style={on && ok ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
      title={ok ? 'Draw pair names next to points' : `Labels available when ≤ ${LABEL_CAP} points are visible (hide classes or pick sparser axes)`}>
      <Tag size={12} /> label points{!ok && <span className="mono text-[10px]"> ({n} &gt; {LABEL_CAP})</span>}
    </button>
  )
}

function SystemAshby({ pairs, dft, seg }) {
  const { openPair, theme } = useApp()
  const ct = useChartTheme()
  const [xK, setXK] = useState('density')
  const [yK, setYK] = useState('dft_young')
  const [xLog, setXLog] = useState(SYS_AXES.density.log)
  const [yLog, setYLog] = useState(SYS_AXES.dft_young.log)
  const [hidden, setHidden] = useState(() => new Set())
  const [labels, setLabels] = useState(false)
  const pickX = k => { setXK(k); setXLog(SYS_AXES[k].log) }
  const pickY = k => { setYK(k); setYLog(SYS_AXES[k].log) }

  const { datasets, counts } = useMemo(() => {
    const X = SYS_AXES[xK], Y = SYS_AXES[yK]
    const byClass = Object.fromEntries(CLASSES.map(c => [c, []]))
    pairs.forEach(p => {
      const d = dft?.[p.pair]
      const x = X.get(p, d), y = Y.get(p, d)
      if (x == null || y == null || isNaN(x) || isNaN(y) || !posOk(x, xLog) || !posOk(y, yLog)) return
      const dom = dominantClass(p.truth) || 'isomorphous'
      byClass[dom].push({ x, y, label: p.pair, pair: p })
    })
    const counts = Object.fromEntries(CLASSES.map(c => [c, byClass[c].length]))
    return { counts, datasets: CLASSES.filter(c => !hidden.has(c)).map(c => ({
      label: CLASS_LABEL[c], cls: c, data: byClass[c],
      backgroundColor: CLASS_COLOR[c] + 'cc', pointRadius: 4, pointHoverRadius: 8,
    })) }
  }, [pairs, dft, xK, yK, xLog, yLog, hidden])

  const visible = datasets.reduce((s, d) => s + d.data.length, 0)
  const all = Object.values(counts).reduce((s, n) => s + n, 0)
  const drawLabels = labels && visible <= LABEL_CAP
  const options = useMemo(() => ({
    maintainAspectRatio: false, animation: { duration: 250 },
    onClick: (evt, els, chart) => {
      if (!els.length) return
      const e = els[0]; const raw = chart.data.datasets[e.datasetIndex].data[e.index]
      if (raw?.pair) openPair(raw.pair.pair)
    },
    onHover: (evt, els) => { if (evt.native) evt.native.target.style.cursor = els.length ? 'pointer' : 'default' },
    scales: { x: axisOpts(xK, SYS_AXES[xK], xLog, ct), y: axisOpts(yK, SYS_AXES[yK], yLog, ct) },
    plugins: {
      legend: { display: false },
      pointLabels: { enabled: drawLabels, color: ct.ink, font: ct.font },
      tooltip: tooltipOpts(ct, ctx => [
        `${SYS_AXES[xK].label}: ${(+ctx.raw.x).toFixed(2)} ${SYS_AXES[xK].unit}`,
        `${SYS_AXES[yK].label}: ${(+ctx.raw.y).toFixed(2)} ${SYS_AXES[yK].unit}`,
        `ground truth: ${ctx.raw.pair.truth.map(c => CLASS_LABEL[c]).join(' + ')}`, 'click to open']),
    },
  }), [xK, yK, xLog, yLog, ct, openPair, drawLabels])

  const sysOpts = Object.entries(SYS_AXES).map(([k, v]) => [k, v.label])
  return (
    <>
      <div className="card p-4 flex flex-col gap-3">
        <Header />
        <div className="flex flex-wrap items-end gap-3">
          {seg}
          <AxisPicker label="X axis" value={xK} onChange={pickX} options={sysOpts} log={xLog} onLog={setXLog} />
          <AxisPicker label="Y axis" value={yK} onChange={pickY} options={sysOpts} log={yLog} onLog={setYLog} />
          <LabelToggle on={labels} setOn={setLabels} n={visible} />
          <div className="text-xs text-[var(--dim)] ml-auto max-w-md leading-relaxed">
            <span className="mono">{all}</span> systems with both values. DFT moduli / formation energy / hull come from MP·OQMD·JARVIS
            (source-tagged, not averaged); property means are alloy rule-of-mixtures. Click a point for its full page.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {CLASSES.map(c => {
          const off = hidden.has(c)
          return (
            <button key={c} onClick={() => setHidden(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })} className="facet"
              style={off ? { opacity: .45, textDecoration: 'line-through' } : { borderColor: CLASS_COLOR[c] + '88', color: CLASS_COLOR[c] }}>
              <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[c] }} /> {CLASS_LABEL[c]} <span className="mono opacity-70">{counts[c]}</span>
            </button>
          )
        })}
          <span className="text-[11px] text-[var(--dim)] ml-auto"><span className="mono">{visible}</span> visible</span>
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 560 }}>
        <Scatter key={theme} data={{ datasets }} options={options} plugins={[labelPlugin]} />
      </div>
    </>
  )
}

function ElementAshby({ elements, axes, seg }) {
  const { navigate, theme } = useApp()
  const ct = useChartTheme()
  const keys = Object.keys(axes)
  const [xK, setXK] = useState('density')
  const [yK, setYK] = useState('youngs_modulus_GPa')
  const [xLog, setXLog] = useState(!!axes.density?.log)
  const [yLog, setYLog] = useState(!!axes.youngs_modulus_GPa?.log)
  const [labels, setLabels] = useState(true)
  const pickX = k => { setXK(k); setXLog(!!axes[k].log) }
  const pickY = k => { setYK(k); setYLog(!!axes[k].log) }

  const pts = useMemo(() => Object.values(elements)
    .filter(e => e.has_data && e[xK] != null && e[yK] != null && posOk(e[xK], xLog) && posOk(e[yK], yLog))
    .map(e => ({ x: e[xK], y: e[yK], label: e.symbol, name: e.name })), [elements, xK, yK, xLog, yLog])
  const drawLabels = labels && pts.length <= LABEL_CAP
  const options = useMemo(() => ({
    maintainAspectRatio: false, animation: { duration: 250 },
    onClick: (evt, els, chart) => { if (els.length) { const r = chart.data.datasets[0].data[els[0].index]; if (r?.label) navigate('search', r.label) } },
    onHover: (evt, els) => { if (evt.native) evt.native.target.style.cursor = els.length ? 'pointer' : 'default' },
    scales: { x: axisOpts(xK, axes[xK], xLog, ct), y: axisOpts(yK, axes[yK], yLog, ct) },
    plugins: {
      legend: { display: false },
      pointLabels: { enabled: drawLabels, color: ct.ink, font: ct.font },
      tooltip: tooltipOpts(ct, ctx => [`${ctx.raw.name || ''}`, `${axes[xK].label}: ${ctx.raw.x} ${axes[xK].unit}`, `${axes[yK].label}: ${ctx.raw.y} ${axes[yK].unit}`, 'click to list its systems']),
    },
  }), [xK, yK, xLog, yLog, ct, axes, navigate, drawLabels])

  const elOpts = keys.map(k => [k, axes[k].label])
  return (
    <>
      <div className="card p-4 flex flex-col gap-3">
        <Header />
        <div className="flex flex-wrap items-end gap-3">
          {seg}
          <AxisPicker label="X axis" value={xK} onChange={pickX} options={elOpts} log={xLog} onLog={setXLog} />
          <AxisPicker label="Y axis" value={yK} onChange={pickY} options={elOpts} log={yLog} onLog={setYLog} />
          <LabelToggle on={labels} setOn={setLabels} n={pts.length} />
          <div className="text-xs text-[var(--dim)] ml-auto max-w-md leading-relaxed">
            Each point is a pure element (<span className="mono">{pts.length}</span> with both values). Alloy values lie between their constituents (rule-of-mixtures bounds). Click an element to list its systems.
          </div>
        </div>
      </div>
      <div className="card glow p-4" style={{ height: 560 }}>
        <Scatter key={theme} data={{ datasets: [{ label: `${axes[yK].label} vs ${axes[xK].label}`, data: pts,
          backgroundColor: ct.accent + 'cc', pointRadius: 5, pointHoverRadius: 8 }] }}
          options={options} plugins={[labelPlugin]} />
      </div>
    </>
  )
}
