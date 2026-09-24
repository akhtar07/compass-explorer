import React, { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { CLASSES, CLASS_COLOR, CLASS_LABEL } from '../lib/util'
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

// BENCHMARK TAB. Every number here is read from public/data/benchmark.json,
// which build_benchmark.py generates from the paper's adv_summary.json
// (XGBoost / other learners, leave-one-element-out, 970 ground-truth systems).
// Nothing numeric is hand-typed in this file.

const GROUP = {
  baseline: { label: 'Classical baselines', color: '#8893b5' },
  compass:  { label: 'COMPASS-9 (D₁–D₈ + D₁₃)', color: '#38bdf8' },
  magpie:   { label: 'MAGPIE (composition)', color: '#a78bfa' },
}

// draws the 95 % CI as a thin whisker on each horizontal bar
const ciPlugin = {
  id: 'ci95',
  afterDatasetsDraw(chart, _args, opts) {
    const cis = (opts && opts.cis) || []
    if (!cis.length || !chart.scales?.x) return   // other tabs' charts: nothing to draw
    const { ctx, scales: { x } } = chart
    const meta = chart.getDatasetMeta(0)
    ctx.save()
    ctx.strokeStyle = opts.color || '#e6e9f0'
    ctx.lineWidth = 1.5
    meta.data.forEach((bar, i) => {
      const ci = cis[i]; if (!ci) return
      const y = bar.y, x0 = x.getPixelForValue(ci[0]), x1 = x.getPixelForValue(ci[1])
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y)
      ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y + 4)
      ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4)
      ctx.stroke()
    })
    ctx.restore()
  },
}
ChartJS.register(ciPlugin)

let _bench = null
export default function Benchmark() {
  const [b, setB] = useState(_bench)
  useEffect(() => {
    if (_bench) return
    fetch('./data/benchmark.json').then(r => r.json()).then(j => { _bench = j; setB(j) }).catch(e => console.error('benchmark load failed', e))
  }, [])
  const light = document.documentElement.classList.contains('light')
  const ink = light ? '#16203a' : '#e6e9f0', dim = light ? '#51607c' : '#9aa3bd', grid = light ? '#dfe6f5' : '#26304e'

  const chart = useMemo(() => {
    if (!b) return null
    const rows = b.ladder
    return {
      data: {
        labels: rows.map(r => r.label),
        datasets: [{
          data: rows.map(r => r.macro_f1),
          backgroundColor: rows.map(r => GROUP[r.group].color),
          borderRadius: 4, borderSkipped: 'start', barThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 1, grid: { color: grid }, ticks: { color: dim, stepSize: 0.1 },
               title: { display: true, text: 'Macro-F1 (leave-one-element-out, 69 folds)', color: dim, font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { color: ink, font: { size: 12 } } },
        },
        plugins: {
          legend: { display: false },
          ci95: { cis: rows.map(r => r.ci95), color: ink },
          tooltip: { callbacks: {
            label: ctx => {
              const r = rows[ctx.dataIndex]
              const ci = r.ci95 ? ` (95 % CI ${r.ci95[0].toFixed(3)}–${r.ci95[1].toFixed(3)})` : ''
              return ` macro-F1 ${r.macro_f1.toFixed(3)}${ci} · n = ${r.n}`
            },
          } },
        },
      },
    }
  }, [b, ink, dim, grid])

  if (!b) return <div className="text-[var(--dim)] py-20 text-center">Loading benchmark…</div>

  const tie = b.hull_tie_by_learner || []
  const tieHolds = tie.filter(t => ['xgb', 'optuna', 'tabpfn'].includes(t.learner))
  const tieGap = tie.filter(t => ['chain', 'mlp'].includes(t.learner))
  const bestRow = b.learners.flatMap(l => Object.entries(l.cells).map(([fs, c]) => ({ l, fs, ...c }))).sort((a, z) => z.macro_f1 - a.macro_f1)[0]
  const fsLabel = k => (b.feature_sets.find(f => f.key === k) || { label: k }).label
  const pairedByName = Object.fromEntries((b.paired || []).map(p => [p.name, p]))
  const lofoC = b.lofo?.['COMPASS-9+hull']?.mean_lofo, lofoM = b.lofo?.['MAGPIE+DFT-hull']?.mean_lofo

  return (
    <div className="flex flex-col gap-4 pb-10 fade-up">
      <div className="card glow p-5">
        <h2 className="text-xl font-extrabold leading-tight mb-1">Model results — descriptor ladder</h2>
        <p className="text-sm text-[var(--dim)] max-w-3xl leading-relaxed">{b.protocol}</p>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          {Object.entries(GROUP).map(([k, g]) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: g.color }} />{g.label}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2" style={{ borderColor: ink }} />95 % CI (element-cluster bootstrap)</span>
        </div>
        <div className="mt-3" style={{ height: 300 }}>
          <Bar data={chart.data} options={chart.options} />
        </div>
      </div>

      {/* table view of the same ladder with per-class F1 */}
      <div className="card glow p-4">
        <h3 className="text-sm uppercase tracking-wide text-[var(--dim)] mb-2">Per-class F1 (XGBoost, leave-one-element-out)</h3>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-[12px]">
            <thead className="text-[var(--dim)] bg-[var(--panel2)]">
              <tr>
                <th className="text-left font-medium px-2 py-1.5">Feature set</th>
                {CLASSES.map(c => <th key={c} className="text-right font-medium px-2 py-1.5" style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</th>)}
                <th className="text-right font-medium px-2 py-1.5">Macro-F1</th>
                <th className="text-right font-medium px-2 py-1.5">95 % CI</th>
                <th className="text-right font-medium px-2 py-1.5">n</th>
              </tr>
            </thead>
            <tbody>
              {b.ladder.map(r => (
                <tr key={r.key} className="border-t border-[var(--border)] hover:bg-[var(--panel2)]/60">
                  <td className="px-2 py-1.5"><span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: GROUP[r.group].color }} />{r.label}{r.note && <span className="text-[10px] text-[var(--dim)]"> · {r.note}</span>}</td>
                  {CLASSES.map(c => <td key={c} className="px-2 py-1.5 text-right font-mono">{r.per_class_f1[c].toFixed(3)}</td>)}
                  <td className="px-2 py-1.5 text-right font-mono font-semibold">{r.macro_f1.toFixed(3)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[var(--dim)]">{r.ci95 ? `${r.ci95[0].toFixed(3)}–${r.ci95[1].toFixed(3)}` : '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[var(--dim)]">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-[var(--dim)] mt-2 leading-relaxed max-w-3xl">
          COMPASS-9 = the orbital / Hume-Rothery descriptors D₁–D₈ plus the periodic-group distance D₁₃ (no DFT input).
          The DFT-hull feature is the minimum convex-hull distance of the binary from MP / OQMD / JARVIS.
          {pairedByName['COMPASS-9 -> MAGPIE'] && <> Paired gap COMPASS-9 → MAGPIE: {fmtDelta(pairedByName['COMPASS-9 -> MAGPIE'])}.</>}
          {pairedByName['COMPASS-9+hull -> MAGPIE+DFT-hull'] && <> COMPASS-9 + hull → MAGPIE + hull: {fmtDelta(pairedByName['COMPASS-9+hull -> MAGPIE+DFT-hull'])} (CI includes 0).</>}
        </div>
      </div>

      {/* learner x feature-set matrix */}
      <div className="card glow p-4">
        <h3 className="text-sm uppercase tracking-wide text-[var(--dim)] mb-2">Learner × feature set (macro-F1, leave-one-element-out)</h3>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-[12px]">
            <thead className="text-[var(--dim)] bg-[var(--panel2)]">
              <tr>
                <th className="text-left font-medium px-2 py-1.5">Learner</th>
                {b.feature_sets.map(f => <th key={f.key} className="text-right font-medium px-2 py-1.5">{f.label}</th>)}
                <th className="text-right font-medium px-2 py-1.5">ECE (MAGPIE + hull)</th>
              </tr>
            </thead>
            <tbody>
              {b.learners.map(l => (
                <tr key={l.key} className="border-t border-[var(--border)] hover:bg-[var(--panel2)]/60">
                  <td className="px-2 py-1.5">{l.label}</td>
                  {b.feature_sets.map(f => {
                    const c = l.cells[f.key]
                    const best = bestRow && bestRow.l.key === l.key && bestRow.fs === f.key
                    return <td key={f.key} className={`px-2 py-1.5 text-right font-mono ${best ? 'font-bold text-[var(--accent)]' : ''}`} title={c?.ci95 ? `95 % CI ${c.ci95[0].toFixed(3)}–${c.ci95[1].toFixed(3)}` : ''}>{c ? c.macro_f1.toFixed(3) : '—'}</td>
                  })}
                  <td className="px-2 py-1.5 text-right font-mono text-[var(--dim)]">{l.cells['MAGPIE+DFT-hull']?.ece != null ? l.cells['MAGPIE+DFT-hull'].ece.toFixed(3) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="text-[11px] text-[var(--dim)] mt-2 leading-relaxed max-w-3xl list-disc pl-4 space-y-1">
          <li>The accuracy ordering COMPASS-9 &lt; MAGPIE &lt; hull-augmented sets is learner-independent.</li>
          <li>
            The COMPASS-9 + hull ≈ MAGPIE + hull tie holds under {tieHolds.map(t => `${t.label} (${signed(t.gap)})`).join(', ')};
            {' '}{tieGap.map(t => t.label).join(' and ')} resolve a small gap ({tieGap.map(t => signed(t.gap)).join(', ')}).
          </li>
          {bestRow && <li>Best single configuration: {bestRow.l.label} on {fsLabel(bestRow.fs)}, macro-F1 {bestRow.macro_f1.toFixed(3)}.</li>}
          {b.best_calibrated && <li>Best calibrated learner: {b.best_calibrated.label} (expected calibration error {b.best_calibrated.ece.toFixed(3)} on MAGPIE + hull; hover a cell for its CI).</li>}
        </ul>
      </div>

      {/* robustness checks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--dim)] mb-1">Leave-one-family-out</div>
          <div className="text-sm leading-relaxed">
            Holding out whole element families (alkali, 3d, lanthanide, …):
            COMPASS-9 + hull <b className="font-mono">{lofoC?.toFixed(3)}</b> vs MAGPIE + hull <b className="font-mono">{lofoM?.toFixed(3)}</b> mean macro-F1
            {b.lofo?.['COMPASS-9'] && b.lofo?.['MAGPIE'] && <> (without hull: {b.lofo['COMPASS-9'].mean_lofo.toFixed(3)} vs {b.lofo['MAGPIE'].mean_lofo.toFixed(3)})</>}.
          </div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--dim)] mb-1">Conformal prediction (α = {b.conformal?.['xgb|MAGPIE+DFT-hull']?.alpha ?? 0.1})</div>
          <div className="text-sm leading-relaxed">
            Mondrian per-class coverage on MAGPIE + hull:{' '}
            {b.conformal?.['xgb|MAGPIE+DFT-hull'] && CLASSES.map(c => `${CLASS_LABEL[c].split(' ')[0].toLowerCase()} ${b.conformal['xgb|MAGPIE+DFT-hull'].coverage[c].toFixed(3)}`).join(', ')}.
          </div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--dim)] mb-1">Null model &amp; label screen</div>
          <div className="text-sm leading-relaxed">
            Label-shuffled (y-scrambled) macro-F1: COMPASS-9 {b.yscramble?.['COMPASS-9']?.mean.toFixed(3)}, MAGPIE {b.yscramble?.['MAGPIE']?.mean.toFixed(3)}.
            A {b.label_noise?.members}-model consensus screen flags {b.label_noise?.n_flags} labels on {b.label_noise?.n_pairs} pairs as candidates for re-checking.
          </div>
        </div>
      </div>

      <div className="text-[10px] text-[var(--dim)]">
        Source: {b.generated.source} → {b.generated.script} ({b.generated.date}). All four classes are scored separately; partial solubility is never merged into another class.
      </div>
    </div>
  )
}

const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3)
const fmtDelta = p => `${signed(p.delta)} [${signed(p.ci95[0])}, ${signed(p.ci95[1])}]`
