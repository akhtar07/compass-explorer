import React, { useEffect, useMemo, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
import { BarChart3, Layers, Activity, SlidersHorizontal, Gauge, Grid3x3, ShieldCheck, FlaskConical, Check, AlertTriangle, Info } from 'lucide-react'
import { useApp, useBenchmark, usePredictions, useChartTheme } from '../lib/app'
import { rocCurve, prCurve, f1AtThreshold, confusion, fmt3, signed } from '../lib/metrics'
import { CLASSES, CLASS_COLOR, CLASS_LABEL } from '../lib/util'
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

// BENCHMARK TAB. Every number is read from public/data/benchmark.json (build_benchmark.py,
// from the paper's adv_summary.json + threshold_free.json) or computed in the browser from
// public/data/predictions.json (the stored leave-one-element-out probabilities).
// Nothing numeric is hand-typed in this file.

// method palette of the paper figures: [light-mode colour, dark-mode colour]
const METHOD = {
  'Hume-Rothery (rule)': ['#c3c1bb', '#cfcdc6'],
  'e/a (VEC)':           ['#979a9c', '#b3b6b8'],
  'Miedema':             ['#66737d', '#8e9ba5'],
  'COMPASS-9':           ['#3f8c9d', '#5fb3c6'],
  'MAGPIE':              ['#1f5b6b', '#3d8ea3'],
  'COMPASS-9+hull':      ['#b4698f', '#d38ab0'],
  'MAGPIE+DFT-hull':     ['#6a3566', '#a869a5'],
}
const fsOf = key => key.includes('|') ? key.split('|').pop() : key
const learnerOf = key => key.includes('|') ? key.split('|')[0] : 'xgb'
const isHull = key => /hull/.test(fsOf(key))
const withA = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0')

// 95 % CI whisker plugin for the ladder bars (passed per chart instance, never registered globally)
const ciPlugin = {
  id: 'ci95',
  afterDatasetsDraw(chart, _args, opts) {
    const cis = (opts && opts.cis) || []
    if (!cis.length || !chart.scales?.x) return
    const { ctx, scales: { x } } = chart
    const meta = chart.getDatasetMeta(0)
    ctx.save(); ctx.strokeStyle = opts.color || '#888'; ctx.lineWidth = 1.5
    meta.data.forEach((bar, i) => {
      const ci = cis[i]; if (!ci) return
      const y = bar.y, x0 = x.getPixelForValue(ci[0]), x1 = x.getPixelForValue(ci[1])
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y)
      ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y + 4); ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4); ctx.stroke()
    })
    ctx.restore()
  },
}

const excludesZero = ci => ci && (ci[0] > 0 || ci[1] < 0)
const fmtCI = ci => ci ? `[${signed(ci[0])}, ${signed(ci[1])}]` : ''

function SectionHead({ icon: Icon, title, sub, right }) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <span className="w-7 h-7 rounded-lg chip-grad flex items-center justify-center shrink-0 mt-0.5"><Icon size={15} className="text-[var(--accent)]" /></span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[.08em] font-semibold text-[var(--dim)]">{title}</div>
        {sub && <div className="text-[12px] text-[var(--dim)] leading-relaxed mt-0.5 max-w-3xl">{sub}</div>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  )
}

export default function Benchmark() {
  const b = useBenchmark()
  const pred = usePredictions()
  const { pairs, pairIndex, theme } = useApp()
  const th = useChartTheme()
  const dark = theme !== 'light'
  const mcolor = key => (METHOD[fsOf(key)] || ['#888', '#aaa'])[dark ? 1 : 0]

  // label helpers (from benchmark.json, never typed)
  const fsLabel = useMemo(() => {
    const m = {}
    b?.ladder?.forEach(r => { m[fsOf(r.key)] = r.label })
    b?.feature_sets?.forEach(f => { m[f.key] = f.label })
    return k => m[fsOf(k)] || fsOf(k)
  }, [b])
  const learnerLabel = useMemo(() => {
    const m = { xgb: 'XGBoost' }
    b?.learners?.forEach(l => { m[l.key] = l.label })
    return k => m[learnerOf(k)] || learnerOf(k)
  }, [b])
  const keyLabel = k => `${learnerLabel(k)} · ${fsLabel(k)}`

  // truth matrix + per-set probability matrices, aligned to predictions.json order
  const mats = useMemo(() => {
    if (!pred || !pairIndex) return null
    const keys = Object.keys(pred.pairs)
    const Y = keys.map(k => { const t = pairIndex[k]?.truth || []; return CLASSES.map(c => t.includes(c) ? 1 : 0) })
    const P = pred.sets.map((_, si) => keys.map(k => pred.pairs[k].p[si]))
    return { keys, Y, P }
  }, [pred, pairIndex])

  const nFolds = useMemo(() => pairs ? new Set(pairs.flatMap(p => [p.A, p.B])).size : null, [pairs])

  if (!b) return <div className="flex flex-col gap-4"><div className="skeleton h-40" /><div className="skeleton h-72" /><div className="skeleton h-56" /></div>

  const tf = b.threshold_free || {}
  const bestCell = b.learners.flatMap(l => Object.entries(l.cells).map(([fs, c]) => ({ l, fs, ...c }))).sort((a, z) => z.macro_f1 - a.macro_f1)[0]
  const pairedF1 = Object.fromEntries((b.paired || []).map(p => [p.name, p]))

  return (
    <div className="flex flex-col gap-4 pb-10 fade-up">
      {/* ---------- header + at-a-glance ---------- */}
      <div className="card glow p-5 hero-grad">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={20} className="text-[var(--accent)]" />
          <h2 className="text-xl font-extrabold leading-tight tracking-tight">Benchmark</h2>
        </div>
        <p className="text-sm text-[var(--dim)] max-w-3xl leading-relaxed">{b.protocol}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
          <div className="stat"><div className="v mono">{b.n_pairs.toLocaleString()}</div><div className="k">ground-truth binary systems</div></div>
          <div className="stat"><div className="v mono">{nFolds ?? '—'}</div><div className="k">leave-one-element-out folds</div></div>
          <div className="stat"><div className="v mono">{tf.n_boot ? tf.n_boot.toLocaleString() : '—'}</div><div className="k">element-cluster bootstrap resamples</div></div>
          <div className="stat"><div className="v mono">{bestCell ? bestCell.macro_f1.toFixed(3) : '—'}</div><div className="k">best macro-F1 · {bestCell ? `${bestCell.l.label}, ${fsLabel(bestCell.fs)}` : ''}</div></div>
        </div>
      </div>

      <Ladder b={b} th={th} mcolor={mcolor} />
      <PerClassTable b={b} mcolor={mcolor} pairedF1={pairedF1} />
      <ThresholdFree b={b} tf={tf} th={th} mcolor={mcolor} fsLabel={fsLabel} learnerLabel={learnerLabel} pairedF1={pairedF1} />
      <CurveExplorer pred={pred} mats={mats} tf={tf} th={th} mcolor={mcolor} keyLabel={keyLabel} />
      <OperatingPoint pred={pred} mats={mats} tf={tf} th={th} mcolor={mcolor} keyLabel={keyLabel} />
      <Calibration tf={tf} th={th} keyLabel={keyLabel} />
      <LearnerMatrix b={b} bestCell={bestCell} fsLabel={fsLabel} />
      <Robustness b={b} />

      <div className="text-[10.5px] text-[var(--dim)] leading-relaxed">
        Source: {b.generated.source}{tf.source ? ` + ${tf.source}` : ''} → {b.generated.script} ({b.generated.date}).
        Curves, F1 values and confusion counts in the live panels are recomputed in the browser from the stored out-of-fold probabilities ({pred?.meta?.script || 'predictions.json'}).
        All four classes are scored separately; partial solubility is never merged into another class.
      </div>
    </div>
  )
}

/* ================= ladder ================= */
function Ladder({ b, th, mcolor }) {
  const rows = b.ladder
  const chart = useMemo(() => ({
    data: {
      labels: rows.map(r => r.label),
      datasets: [{ data: rows.map(r => r.macro_f1), backgroundColor: rows.map(r => mcolor(r.key)), borderRadius: 4, borderSkipped: 'start', barThickness: 18 }],
    },
    options: {
      indexAxis: 'y', maintainAspectRatio: false, animation: { duration: 300 },
      scales: {
        x: { min: 0, max: 1, grid: { color: th.grid }, ticks: { color: th.dim, stepSize: 0.1, font: { family: th.font } },
             title: { display: true, text: 'Macro-F1 at the 0.5 operating point (leave-one-element-out)', color: th.dim, font: { size: 11, family: th.font } } },
        y: { grid: { display: false }, ticks: { color: th.ink, font: { size: 12, family: th.font } } },
      },
      plugins: {
        legend: { display: false },
        ci95: { cis: rows.map(r => r.ci95), color: th.ink },
        tooltip: { callbacks: { label: ctx => { const r = rows[ctx.dataIndex]; return ` macro-F1 ${r.macro_f1.toFixed(3)}${r.ci95 ? ` (95 % CI ${r.ci95[0].toFixed(3)}–${r.ci95[1].toFixed(3)})` : ''} · n = ${r.n}` } } },
      },
    },
  }), [rows, th, mcolor])
  return (
    <div className="card glow p-4">
      <SectionHead icon={Layers} title="Descriptor ladder" sub="Macro-F1 of XGBoost for each feature set, from the classical rules up to the DFT-hull-augmented sets. Whiskers are element-cluster bootstrap 95 % confidence intervals." />
      <div style={{ height: 300 }}><Bar data={chart.data} options={chart.options} plugins={[ciPlugin]} /></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[var(--dim)]">
        {rows.map(r => <span key={r.key} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: mcolor(r.key) }} />{r.label}{r.note ? ` · ${r.note}` : ''}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2" style={{ borderColor: th.ink }} />95 % CI</span>
      </div>
    </div>
  )
}

/* ================= per-class table ================= */
function PerClassTable({ b, mcolor, pairedF1 }) {
  const fmtDelta = p => `${signed(p.delta)} ${fmtCI(p.ci95)}`
  const c9m = pairedF1['COMPASS-9 -> MAGPIE'], hullTie = pairedF1['COMPASS-9+hull -> MAGPIE+DFT-hull']
  return (
    <div className="card glow p-4">
      <SectionHead icon={Grid3x3} title="Per-class F1 · XGBoost, 0.5 operating point" />
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="tbl">
          <thead><tr>
            <th>Feature set</th>
            {CLASSES.map(c => <th key={c} style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</th>)}
            <th>Macro-F1</th><th>95 % CI</th><th>n</th>
          </tr></thead>
          <tbody>
            {b.ladder.map(r => (
              <tr key={r.key}>
                <td><span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: mcolor(r.key) }} />{r.label}{r.note && <span className="text-[10px] text-[var(--dim)]"> · {r.note}</span>}</td>
                {CLASSES.map(c => <td key={c} className="num">{r.per_class_f1[c].toFixed(3)}</td>)}
                <td className="num font-semibold">{r.macro_f1.toFixed(3)}</td>
                <td className="num text-[var(--dim)]">{r.ci95 ? `${r.ci95[0].toFixed(3)}–${r.ci95[1].toFixed(3)}` : '—'}</td>
                <td className="num text-[var(--dim)]">{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-[var(--dim)] mt-2 leading-relaxed max-w-3xl">
        COMPASS-9 = the orbital / Hume-Rothery descriptors D₁–D₈ plus the periodic-group distance D₁₃ (no DFT input).
        The DFT-hull feature is the minimum convex-hull distance of the binary from MP / OQMD / JARVIS.
        {c9m && <> Paired macro-F1 gap COMPASS-9 → MAGPIE: {fmtDelta(c9m)}.</>}
        {hullTie && <> COMPASS-9 + hull → MAGPIE + hull: {fmtDelta(hullTie)} ({excludesZero(hullTie.ci95) ? 'CI excludes 0' : 'CI includes 0'}).</>}
      </div>
    </div>
  )
}

/* ================= threshold-free ranking metrics ================= */
function ThresholdFree({ b, tf, th, mcolor, fsLabel, learnerLabel, pairedF1 }) {
  const [learner, setLearner] = useState('xgb')
  if (!tf.auc) return null
  const auc = tf.auc
  const sets = b.ladder.map(r => fsOf(r.key)).filter(fs => auc[`xgb|${fs}`])
  const learners = [...new Set(Object.keys(auc).map(learnerOf))]
  const rows = sets.map(fs => ({
    fs, label: fsLabel(fs), color: mcolor(fs),
    roc: { v: auc[`xgb|${fs}`].macro_roc, ci: auc[`xgb|${fs}`].macro_roc_ci95, others: learners.filter(l => l !== 'xgb' && auc[`${l}|${fs}`]).map(l => ({ l, v: auc[`${l}|${fs}`].macro_roc })) },
    pr:  { v: auc[`xgb|${fs}`].macro_pr,  ci: auc[`xgb|${fs}`].macro_pr_ci95,  others: learners.filter(l => l !== 'xgb' && auc[`${l}|${fs}`]).map(l => ({ l, v: auc[`${l}|${fs}`].macro_pr })) },
  }))
  const tableKeys = Object.keys(auc).filter(k => learnerOf(k) === learner)

  // paired deltas of interest (sentences generated from the JSON)
  const P = tf.auc_paired || {}
  const pairKey = (a, z) => `xgb|${a} -> xgb|${z}`
  const wanted = [
    { k: pairKey('COMPASS-9+hull', 'MAGPIE+DFT-hull'), metrics: ['roc', 'pr'] },
    { k: pairKey('MAGPIE', 'COMPASS-9+hull'), metrics: ['roc'] },
    { k: pairKey('Miedema', 'COMPASS-9'), metrics: ['roc', 'pr'] },
    { k: pairKey('COMPASS-9', 'MAGPIE'), metrics: ['roc', 'pr'] },
  ].filter(w => P[w.k])
  const nameOf = k => k.split(' -> ').map(s => fsLabel(s)).join(' → ')
  const tie = P[pairKey('COMPASS-9+hull', 'MAGPIE+DFT-hull')]
  const rocEx = tie && excludesZero(tie.roc.ci95), prEx = tie && excludesZero(tie.pr.ci95)
  const f1Tie = pairedF1['COMPASS-9+hull -> MAGPIE+DFT-hull']
  const resolves = rocEx && prEx ? 'resolve it in favour of MAGPIE + DFT-hull: both the ROC-AUC and the PR-AUC paired confidence intervals exclude zero'
    : rocEx || prEx ? `partly resolve it: the ${rocEx ? 'ROC-AUC' : 'PR-AUC'} paired confidence interval excludes zero while the ${rocEx ? 'PR-AUC' : 'ROC-AUC'} interval does not`
    : 'do not resolve it: neither paired confidence interval excludes zero'

  return (
    <div className="card glow p-4">
      <SectionHead icon={Activity} title="Threshold-free ranking metrics"
        sub={`Macro one-vs-rest ROC-AUC and PR-AUC (average precision) of the same out-of-fold probabilities, no operating point involved. Filled dots: XGBoost with ${tf.n_boot ? tf.n_boot.toLocaleString() : ''}-resample element-cluster bootstrap 95 % CI (${tf.n_clusters} clusters); open markers: other learners.`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DotCI title="Macro ROC-AUC" rows={rows.map(r => ({ ...r, m: r.roc }))} th={th} />
        <DotCI title="Macro PR-AUC" rows={rows.map(r => ({ ...r, m: r.pr }))} th={th} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-[var(--dim)]">
        <span className="inline-flex items-center gap-1.5"><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill={th.ink} /></svg>XGBoost · with 95 % CI</span>
        {learners.filter(l => l !== 'xgb').map((l, i) => (
          <span key={l} className="inline-flex items-center gap-1.5"><svg width="12" height="12">{i === 0 ? <circle cx="6" cy="6" r="4" fill="none" stroke={th.ink} strokeWidth="1.6" /> : <rect x="2" y="2" width="8" height="8" fill="none" stroke={th.ink} strokeWidth="1.6" transform="rotate(45 6 6)" />}</svg>{learnerLabel(l)}</span>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">
        <div className="xl:col-span-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[11px] uppercase tracking-[.08em] font-semibold text-[var(--dim)]">Per-class areas</div>
            <div className="seg ml-auto">{learners.map(l => <button key={l} className={learner === l ? 'on' : ''} onClick={() => setLearner(l)}>{learnerLabel(l)}</button>)}</div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="tbl">
              <thead><tr>
                <th rowSpan={2} style={{ verticalAlign: 'bottom' }}>Feature set</th>
                {CLASSES.map(c => <th key={c} colSpan={2} style={{ color: CLASS_COLOR[c], textAlign: 'center' }}>{CLASS_LABEL[c]}</th>)}
                <th colSpan={2} style={{ textAlign: 'center' }}>Macro</th>
              </tr><tr>
                {[...CLASSES, 'macro'].flatMap(c => [<th key={c + 'r'} className="!font-normal text-[10.5px]">ROC</th>, <th key={c + 'p'} className="!font-normal text-[10.5px]">PR</th>])}
              </tr></thead>
              <tbody>
                {tableKeys.map(k => {
                  const a = auc[k]
                  return (
                    <tr key={k}>
                      <td><span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: mcolor(k) }} />{fsLabel(k)}</td>
                      {CLASSES.flatMap(c => [<td key={c + 'r'} className="num">{fmt3(a.per_class[c].roc)}</td>, <td key={c + 'p'} className="num text-[var(--dim)]">{fmt3(a.per_class[c].pr)}</td>])}
                      <td className="num font-semibold">{fmt3(a.macro_roc)}</td><td className="num font-semibold text-[var(--dim)]">{fmt3(a.macro_pr)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[10.5px] text-[var(--dim)] mt-1.5">
            Class prevalence: {CLASSES.map(c => `${CLASS_LABEL[c].toLowerCase()} ${fmt3(auc[tableKeys[0]]?.per_class[c].prevalence)}`).join(' · ')}. PR-AUC of a random ranker equals the prevalence; ROC-AUC of a random ranker is 0.5 by construction.
          </div>
        </div>
        <div className="xl:col-span-2 flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-[.08em] font-semibold text-[var(--dim)]">Paired differences (XGBoost)</div>
          {wanted.map(w => {
            const d = P[w.k]
            return (
              <div key={w.k} className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-[12px] leading-relaxed">
                <div className="font-semibold">{nameOf(w.k)} <span className="text-[var(--dim)] font-normal">· n = {d.n}</span></div>
                {w.metrics.map(m => {
                  const ex = excludesZero(d[m].ci95)
                  return (
                    <div key={m} className="flex items-center gap-2">
                      <span className="text-[var(--dim)] w-14">{m === 'roc' ? 'ROC-AUC' : 'PR-AUC'}</span>
                      <span className="mono">{signed(d[m].delta)} {fmtCI(d[m].ci95)}</span>
                      <span className="badge ml-auto" style={{ background: ex ? withA('#22c55e', 0.16) : 'var(--panel3)', color: ex ? '#16a34a' : 'var(--dim)' }}>{ex ? <Check size={11} /> : <Info size={11} />}{ex ? 'CI excludes 0' : 'CI includes 0'}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {tie && (
            <div className="rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed" style={{ borderColor: withA(th.accent, 0.5), background: withA(th.accent, 0.08) }}>
              <b>Reading the hull tie.</b> The COMPASS-9 + hull ≈ MAGPIE + hull macro-F1 tie{f1Tie ? ` (paired gap ${signed(f1Tie.delta)} ${fmtCI(f1Tie.ci95)}, ${excludesZero(f1Tie.ci95) ? 'CI excludes 0' : 'CI includes 0'})` : ''} is a statement at the 0.5 operating point.
              The threshold-free areas {resolves} (ROC-AUC {signed(tie.roc.delta)} {fmtCI(tie.roc.ci95)}; PR-AUC {signed(tie.pr.delta)} {fmtCI(tie.pr.ci95)}).
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// dot + CI chart (SVG), rows: [{label, color, m:{v, ci, others:[{l,v}]}}]
function DotCI({ title, rows, th }) {
  const W = 520, L = 150, R = 16, rowH = 28, top = 26, H = top + rows.length * rowH + 22
  const vals = rows.flatMap(r => [r.m.v, ...(r.m.ci || []), ...r.m.others.map(o => o.v)]).filter(v => v != null)
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.03) * 20) / 20), hi = 1
  const x = v => L + (v - lo) / (hi - lo) * (W - L - R)
  const ticks = []; for (let t = lo; t <= hi + 1e-9; t += 0.05) ticks.push(+t.toFixed(2))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: th.font }}>
      <text x={L} y={13} fontSize="11" fontWeight="600" fill={th.ink}>{title}</text>
      {ticks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={top} y2={H - 20} stroke={th.grid} strokeWidth="1" /><text x={x(t)} y={H - 7} fontSize="9.5" textAnchor="middle" fill={th.dim}>{t.toFixed(2)}</text></g>)}
      {rows.map((r, i) => {
        const cy = top + i * rowH + rowH / 2
        return (
          <g key={r.fs}>
            <text x={L - 8} y={cy + 3.5} fontSize="11" textAnchor="end" fill={th.ink}>{r.label}</text>
            {r.m.ci && <line x1={x(r.m.ci[0])} x2={x(r.m.ci[1])} y1={cy} y2={cy} stroke={r.color} strokeWidth="2.5" strokeLinecap="round" />}
            {r.m.others.map((o, j) => j === 0
              ? <circle key={o.l} cx={x(o.v)} cy={cy} r="4.5" fill={th.panel} stroke={r.color} strokeWidth="1.8"><title>{o.l}: {fmt3(o.v)}</title></circle>
              : <rect key={o.l} x={x(o.v) - 4} y={cy - 4} width="8" height="8" fill={th.panel} stroke={r.color} strokeWidth="1.8" transform={`rotate(45 ${x(o.v)} ${cy})`}><title>{o.l}: {fmt3(o.v)}</title></rect>)}
            <circle cx={x(r.m.v)} cy={cy} r="5.5" fill={r.color} stroke={th.panel} strokeWidth="1.5"><title>XGBoost: {fmt3(r.m.v)} {r.m.ci ? `[${fmt3(r.m.ci[0])}, ${fmt3(r.m.ci[1])}]` : ''}</title></circle>
            <text x={W - R + 2} y={cy + 3.5} fontSize="10" textAnchor="end" fill={th.dim} fontFamily="JetBrains Mono, monospace">{fmt3(r.m.v)}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ================= live ROC / PR explorer ================= */
const DEFAULT_SETS = ['xgb|COMPASS-9', 'xgb|MAGPIE', 'xgb|COMPASS-9+hull', 'xgb|MAGPIE+DFT-hull']
function CurveExplorer({ pred, mats, tf, th, mcolor, keyLabel }) {
  const [cls, setCls] = useState('partial')
  const [kind, setKind] = useState('roc')
  const [sel, setSel] = useState(DEFAULT_SETS)
  const ci = CLASSES.indexOf(cls)
  const toggle = k => setSel(s => s.includes(k) ? (s.length > 1 ? s.filter(x => x !== k) : s) : [...s, k])

  const curves = useMemo(() => {
    if (!mats || !pred) return null
    const labels = mats.Y.map(y => y[ci])
    return pred.sets.map((k, si) => {
      const scores = mats.P[si].map(r => r ? r[ci] : null)
      const roc = rocCurve(scores, labels), pr = prCurve(scores, labels)
      const paper = tf.auc?.[k]?.per_class?.[cls]
      const okR = paper && Math.abs(roc.auc - paper.roc) <= 0.001, okP = paper && Math.abs(pr.ap - paper.pr) <= 0.001
      if (paper && !(okR && okP)) console.warn('live AUC differs from benchmark.json by more than 0.001 (stored probabilities are rounded to 3 decimals)', k, cls, roc.auc, paper.roc, pr.ap, paper.pr)
      return { key: k, roc, pr, paper, okR, okP }
    })
  }, [mats, pred, ci, cls, tf])

  const chart = useMemo(() => {
    if (!curves) return null
    const prevalence = curves[0]?.pr.prevalence ?? 0
    const ds = curves.filter(c => sel.includes(c.key)).map(c => ({
      label: keyLabel(c.key),
      data: kind === 'roc' ? c.roc.points.map(p => ({ x: p.fpr, y: p.tpr, thr: p.thr })) : c.pr.points.map(p => ({ x: p.recall, y: p.precision, thr: p.thr })),
      borderColor: mcolor(c.key), borderWidth: isHull(c.key) ? 2.4 : 2, borderDash: isHull(c.key) ? [] : [6, 4],
      pointRadius: 0, pointHitRadius: 6, tension: 0,
    }))
    ds.push({
      label: kind === 'roc' ? 'random ranker' : 'prevalence',
      data: kind === 'roc' ? [{ x: 0, y: 0 }, { x: 1, y: 1 }] : [{ x: 0, y: prevalence }, { x: 1, y: prevalence }],
      borderColor: th.faint, borderWidth: 1, borderDash: [3, 3], pointRadius: 0, pointHitRadius: 0,
    })
    const axis = { type: 'linear', min: 0, max: 1, grid: { color: th.grid }, ticks: { color: th.dim, stepSize: 0.2, font: { family: th.font } } }
    return {
      data: { datasets: ds },
      options: {
        maintainAspectRatio: false, animation: { duration: 250 }, parsing: false, normalized: true,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: { ...axis, title: { display: true, text: kind === 'roc' ? 'False-positive rate' : 'Recall', color: th.dim, font: { size: 11, family: th.font } } },
          y: { ...axis, title: { display: true, text: kind === 'roc' ? 'True-positive rate' : 'Precision', color: th.dim, font: { size: 11, family: th.font } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => { const p = c.raw; return ` ${c.dataset.label}: ${kind === 'roc' ? 'FPR' : 'recall'} ${p.x.toFixed(3)}, ${kind === 'roc' ? 'TPR' : 'precision'} ${p.y.toFixed(3)}${p.thr != null && isFinite(p.thr) ? ` · threshold ${p.thr.toFixed(3)}` : ''}` } } },
        },
      },
    }
  }, [curves, sel, kind, th, mcolor, keyLabel])

  return (
    <div className="card glow p-4">
      <SectionHead icon={FlaskConical} title="Live ROC / PR explorer"
        sub="Curves are computed in the browser from the stored leave-one-element-out probabilities for the chosen class; the legend shows the live area next to the value in the paper's result file." />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="seg">{CLASSES.map(c => <button key={c} className={cls === c ? 'on' : ''} style={cls === c ? { color: CLASS_COLOR[c] } : {}} onClick={() => setCls(c)}>{CLASS_LABEL[c]}</button>)}</div>
        <div className="seg ml-auto"><button className={kind === 'roc' ? 'on' : ''} onClick={() => setKind('roc')}>ROC</button><button className={kind === 'pr' ? 'on' : ''} onClick={() => setKind('pr')}>Precision–recall</button></div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(pred?.sets || []).map(k => {
          const on = sel.includes(k)
          return <button key={k} className="facet" style={on ? { borderColor: mcolor(k), background: withA(mcolor(k), 0.16), color: 'var(--text)' } : { color: 'var(--dim)' }} onClick={() => toggle(k)}>
            <span className="w-2 h-2 rounded-full" style={{ background: mcolor(k), opacity: on ? 1 : 0.45 }} />{keyLabel(k)}
          </button>
        })}
      </div>
      {!chart ? <div className="skeleton h-80" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3" style={{ height: 380 }}><Line data={chart.data} options={chart.options} /></div>
          <div className="lg:col-span-2 flex flex-col gap-1.5">
            <div className="text-[11px] uppercase tracking-[.08em] font-semibold text-[var(--dim)]">{kind === 'roc' ? 'ROC-AUC' : 'PR-AUC (average precision)'} · {CLASS_LABEL[cls]}</div>
            {curves.filter(c => sel.includes(c.key)).map(c => {
              const live = kind === 'roc' ? c.roc.auc : c.pr.ap, paper = c.paper ? (kind === 'roc' ? c.paper.roc : c.paper.pr) : null, ok = kind === 'roc' ? c.okR : c.okP
              return (
                <div key={c.key} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-2.5 py-1.5 text-[12px]">
                  <svg width="22" height="10"><line x1="0" x2="22" y1="5" y2="5" stroke={mcolor(c.key)} strokeWidth="2.4" strokeDasharray={isHull(c.key) ? '' : '5 3'} /></svg>
                  <span className="truncate">{keyLabel(c.key)}</span>
                  <span className="mono ml-auto font-semibold">{fmt3(live)}</span>
                  {paper != null && (() => {
                    const near = Math.abs(live - paper) <= 0.005
                    const bg = ok ? withA('#22c55e', 0.16) : near ? 'var(--panel3)' : withA('#f59e0b', 0.18)
                    const fg = ok ? '#16a34a' : near ? 'var(--dim)' : '#b45309'
                    const tipText = ok ? `paper: ${fmt3(paper)}` : near ? `paper: ${fmt3(paper)} · stored probabilities are rounded to 3 decimals; ties shift the area slightly` : `paper: ${fmt3(paper)}`
                    return <span className="tip" data-tip={tipText}>
                      <span className="badge" style={{ background: bg, color: fg }}>{ok ? <Check size={11} /> : near ? <Info size={11} /> : <AlertTriangle size={11} />}{ok ? 'matches paper' : `paper ${fmt3(paper)}`}</span>
                    </span>
                  })()}
                </div>
              )
            })}
            <div className="text-[10.5px] text-[var(--dim)] leading-relaxed mt-1">
              Dashed: descriptor-only sets · solid: DFT-hull-augmented sets. Prevalence of {CLASS_LABEL[cls].toLowerCase()}: {fmt3(curves[0]?.pr.prevalence)}; n = {curves.find(c => sel.includes(c.key))?.roc.points.length ? mats.Y.length : '—'} systems ({mats.keys.length} rows, sets without a stored probability for a system skip that row).
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= operating-point explorer ================= */
const Slider = ({ value, onChange, color }) => (
  <input type="range" min="0.05" max="0.95" step="0.05" value={value} onChange={e => onChange(+e.target.value)} className="w-full" style={{ accentColor: color || 'var(--accent)' }} />
)
function OperatingPoint({ pred, mats, tf, th, mcolor, keyLabel }) {
  const [setKey, setSetKey] = useState('xgb|MAGPIE+DFT-hull')
  const [perClass, setPerClass] = useState(false)
  const [thr, setThr] = useState(0.5)
  const [thrs, setThrs] = useState([0.5, 0.5, 0.5, 0.5])
  useEffect(() => { if (pred && !pred.sets.includes(setKey)) setSetKey(pred.sets[0]) }, [pred, setKey])
  const si = pred ? pred.sets.indexOf(setKey) : -1

  const live = useMemo(() => {
    if (!mats || si < 0) return null
    const P = mats.P[si]
    const t = perClass ? thrs : thr
    const r = f1AtThreshold(P, mats.Y, t)
    const conf = CLASSES.map((_, c) => confusion(P.map(row => row ? row[c] : null), mats.Y.map(y => y[c]), Array.isArray(t) ? t[c] : t))
    return { ...r, conf }
  }, [mats, si, perClass, thr, thrs])

  const sweep = tf.sweep || {}
  const sweepRow = sweep[setKey]
  const paperAtThr = useMemo(() => {
    if (!sweepRow || perClass) return null
    const i = sweepRow.thresholds.findIndex(t => Math.abs(t - thr) < 1e-6)
    return i >= 0 ? sweepRow.macro_f1[i] : null
  }, [sweepRow, thr, perClass])
  const cf = tf.crossfit?.[setKey]

  const sweepChart = useMemo(() => {
    const keys = Object.keys(sweep)
    if (!keys.length) return null
    const ds = keys.map(k => ({
      label: keyLabel(k), data: sweep[k].thresholds.map((t, i) => ({ x: t, y: sweep[k].macro_f1[i] })),
      borderColor: k === setKey ? mcolor(k) : withA(mcolor(k), 0.55), borderWidth: k === setKey ? 3 : 1.5, borderDash: learnerOf(k) === 'xgb' ? [] : [5, 3],
      pointRadius: k === setKey ? 2.5 : 0, pointHitRadius: 6, pointBackgroundColor: mcolor(k), tension: 0.25,
    }))
    if (!perClass) ds.push({ label: 'current threshold', data: [{ x: thr, y: 0 }, { x: thr, y: 1 }], borderColor: th.accent, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, pointHitRadius: 0 })
    return {
      data: { datasets: ds },
      options: {
        maintainAspectRatio: false, animation: { duration: 200 }, parsing: false, interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: { type: 'linear', min: 0, max: 1, grid: { color: th.grid }, ticks: { color: th.dim, stepSize: 0.1, font: { family: th.font } }, title: { display: true, text: 'Global decision threshold', color: th.dim, font: { size: 11, family: th.font } } },
          y: { type: 'linear', min: 0, max: 1, grid: { color: th.grid }, ticks: { color: th.dim, stepSize: 0.2, font: { family: th.font } }, title: { display: true, text: 'Macro-F1', color: th.dim, font: { size: 11, family: th.font } } },
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label === 'current threshold' ? null : ` ${c.dataset.label}: macro-F1 ${c.raw.y.toFixed(3)} at ${c.raw.x.toFixed(2)}` } } },
      },
    }
  }, [sweep, setKey, thr, perClass, th, mcolor, keyLabel])

  return (
    <div className="card glow p-4">
      <SectionHead icon={SlidersHorizontal} title="Operating-point explorer"
        sub="Move the decision threshold and watch per-class F1, macro-F1 and the confusion counts recompute from the stored out-of-fold probabilities. The paper reports the fixed 0.5 operating point; the sweep on the right shows how each feature set responds to the threshold."
        right={<select className="sel text-[12px] rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1.5" value={setKey} onChange={e => setSetKey(e.target.value)}>{(pred?.sets || []).map(k => <option key={k} value={k}>{keyLabel(k)}</option>)}</select>} />
      {!live ? <div className="skeleton h-72" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="seg"><button className={!perClass ? 'on' : ''} onClick={() => setPerClass(false)}>Global threshold</button><button className={perClass ? 'on' : ''} onClick={() => setPerClass(true)}>Per class</button></div>
              <button className="pill ml-auto hover:border-[var(--border-strong)]" onClick={() => { setThr(0.5); setThrs([0.5, 0.5, 0.5, 0.5]) }}>reset to 0.5</button>
            </div>
            {!perClass ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-3">
                <div className="flex items-baseline justify-between text-[12px]"><span className="text-[var(--dim)]">threshold</span><span className="mono font-semibold">{thr.toFixed(2)}</span></div>
                <Slider value={thr} onChange={setThr} />
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-3 flex flex-col gap-2">
                {CLASSES.map((c, i) => (
                  <div key={c}>
                    <div className="flex items-baseline justify-between text-[12px]"><span style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span><span className="mono font-semibold">{thrs[i].toFixed(2)}</span></div>
                    <Slider value={thrs[i]} color={CLASS_COLOR[c]} onChange={v => setThrs(t => t.map((x, j) => j === i ? v : x))} />
                  </div>
                ))}
                {cf && <button className="pill self-start hover:border-[var(--border-strong)]" onClick={() => setThrs(cf.median_thresholds)}>use element-disjoint cross-fitted thresholds</button>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="stat"><div className="v mono">{live.macro.toFixed(3)}</div><div className="k">live macro-F1 · n = {live.n}</div></div>
              <div className="stat">
                <div className="v mono">{paperAtThr != null ? paperAtThr.toFixed(3) : '—'}</div>
                <div className="k">{paperAtThr != null ? `paper sweep at ${thr.toFixed(2)}${Math.abs(paperAtThr - live.macro) <= 0.0015 ? ' · matches' : ''}` : perClass ? 'paper sweep is global-threshold only' : 'no sweep stored for this set'}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {CLASSES.map((c, i) => {
                const k = live.conf[i], tot = k.tp + k.fp + k.fn + k.tn || 1
                return (
                  <div key={c} className="text-[11.5px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[c] }} /><span>{CLASS_LABEL[c]}</span>
                      <span className="mono ml-auto font-semibold">F1 {live.perClass[i].toFixed(3)}</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden gap-px" title={`TP ${k.tp} · FP ${k.fp} · FN ${k.fn} · TN ${k.tn}`}>
                      <span style={{ width: `${k.tp / tot * 100}%`, background: CLASS_COLOR[c] }} />
                      <span style={{ width: `${k.fp / tot * 100}%`, background: withA(CLASS_COLOR[c], 0.45) }} />
                      <span style={{ width: `${k.fn / tot * 100}%`, background: th.faint }} />
                      <span style={{ width: `${k.tn / tot * 100}%`, background: th.grid }} />
                    </div>
                    <div className="flex gap-3 text-[10px] text-[var(--dim)] mono mt-0.5"><span>TP {k.tp}</span><span>FP {k.fp}</span><span>FN {k.fn}</span><span>TN {k.tn}</span></div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="lg:col-span-3 flex flex-col gap-3">
            {sweepChart ? <div style={{ height: 260 }}><Line data={sweepChart.data} options={sweepChart.options} /></div> : <div className="text-[12px] text-[var(--dim)]">No threshold sweep stored.</div>}
            {sweepChart && <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-[var(--dim)]">
              {Object.keys(sweep).map(k => <span key={k} className={`inline-flex items-center gap-1 ${k === setKey ? 'font-semibold text-[var(--text)]' : ''}`}><svg width="16" height="8"><line x1="0" x2="16" y1="4" y2="4" stroke={mcolor(k)} strokeWidth="2" strokeDasharray={learnerOf(k) === 'xgb' ? '' : '4 2'} /></svg>{keyLabel(k)}</span>)}
            </div>}
            {cf ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-3 text-[12px] leading-relaxed">
                <div className="text-[11px] uppercase tracking-[.08em] font-semibold text-[var(--dim)] mb-1.5">Threshold tuning · {keyLabel(setKey)}</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="stat"><div className="v mono text-[18px]">{cf.f1_fixed.toFixed(3)}</div><div className="k">fixed 0.5 threshold</div></div>
                  <div className="stat"><div className="v mono text-[18px]">{cf.f1_crossfit.toFixed(3)}</div><div className="k">element-disjoint cross-fitted · Δ {signed(cf.delta)} {fmtCI(cf.delta_ci95)}</div></div>
                  <div className="stat"><div className="v mono text-[18px]">{cf.f1_insample_opt.toFixed(3)}</div><div className="k">in-sample optimum (upper bound)</div></div>
                </div>
                Cross-fitted thresholds are chosen on element-disjoint folds and applied to held-out elements (median per class: {CLASSES.map((c, i) => `${CLASS_LABEL[c].toLowerCase()} ${cf.median_thresholds[i].toFixed(2)}`).join(', ')}).
                {' '}The in-sample optimum tunes the thresholds on the same systems it is scored on, so it is an upper bound, not an honest estimate; the cross-fitted gain over the fixed threshold {excludesZero(cf.delta_ci95) ? 'has a confidence interval that excludes zero' : 'has a confidence interval that includes zero'}.
              </div>
            ) : <div className="text-[11px] text-[var(--dim)]">No cross-fitted threshold analysis stored for this set.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= calibration ================= */
function Calibration({ tf, th, keyLabel }) {
  const rel = tf.reliability || {}
  const keys = Object.keys(rel)
  const [key, setKey] = useState(keys.includes('xgb|MAGPIE+DFT-hull') ? 'xgb|MAGPIE+DFT-hull' : keys[0])
  const MIN = 10
  if (!keys.length) return null
  const r = rel[key]
  const mk = c => {
    const d = r.classes[c]
    const pts = d.mean_pred.map((x, i) => ({ x, y: d.obs_freq[i], n: d.count[i] }))
    const big = pts.filter(p => p.n >= MIN), small = pts.filter(p => p.n < MIN)
    return {
      data: { datasets: [
        { label: 'bins with ≥ ' + MIN + ' systems', data: big, borderColor: CLASS_COLOR[c], backgroundColor: CLASS_COLOR[c], borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0, showLine: true },
        { label: 'sparse bins', data: small, borderColor: CLASS_COLOR[c], backgroundColor: th.panel, borderWidth: 1.5, pointRadius: 3.5, pointHoverRadius: 5, showLine: false },
        { label: 'perfect calibration', data: [{ x: 0, y: 0 }, { x: 1, y: 1 }], borderColor: th.faint, borderWidth: 1, borderDash: [3, 3], pointRadius: 0, pointHitRadius: 0 },
      ] },
      options: {
        maintainAspectRatio: false, animation: { duration: 200 }, parsing: false, interaction: { mode: 'nearest', intersect: true },
        scales: {
          x: { type: 'linear', min: 0, max: 1, grid: { color: th.grid }, ticks: { color: th.dim, stepSize: 0.25, font: { size: 10, family: th.font } }, title: { display: true, text: 'mean predicted probability', color: th.dim, font: { size: 10, family: th.font } } },
          y: { type: 'linear', min: 0, max: 1, grid: { color: th.grid }, ticks: { color: th.dim, stepSize: 0.25, font: { size: 10, family: th.font } }, title: { display: true, text: 'observed frequency', color: th.dim, font: { size: 10, family: th.font } } },
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw.n == null ? null : ` predicted ${c.raw.x.toFixed(3)} · observed ${c.raw.y.toFixed(3)} · ${c.raw.n} systems` } } },
      },
    }
  }
  return (
    <div className="card glow p-4">
      <SectionHead icon={Gauge} title="Calibration"
        sub={`Reliability diagrams of the out-of-fold probabilities in ten equal-width bins; bins holding at least ${MIN} systems are joined, sparser bins are drawn as open markers. ECE = expected calibration error (count-weighted).`}
        right={<select className="sel text-[12px] rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1.5" value={key} onChange={e => setKey(e.target.value)}>{keys.map(k => <option key={k} value={k}>{keyLabel(k)}</option>)}</select>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {CLASSES.map(c => {
          const ch = mk(c)
          return (
            <div key={c} className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-2.5">
              <div className="flex items-center justify-between text-[11.5px] mb-1"><span className="font-semibold" style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span><span className="mono text-[var(--dim)]">ECE {fmt3(r.classes[c].ece)}</span></div>
              <div style={{ height: 190 }}><Line data={ch.data} options={ch.options} /></div>
            </div>
          )
        })}
      </div>
      <div className="text-[11px] text-[var(--dim)] mt-2">Mean ECE over the four classes for {keyLabel(key)}: <span className="mono font-semibold text-[var(--text)]">{fmt3(r.ece_mean)}</span>. Points above the diagonal are under-confident, points below are over-confident.</div>
    </div>
  )
}

/* ================= learner × feature-set matrix ================= */
function LearnerMatrix({ b, bestCell, fsLabel }) {
  const tie = b.hull_tie_by_learner || []
  const tieHolds = tie.filter(t => ['xgb', 'optuna', 'tabpfn'].includes(t.learner))
  const tieGap = tie.filter(t => ['chain', 'mlp'].includes(t.learner))
  return (
    <div className="card glow p-4">
      <SectionHead icon={Grid3x3} title="Learner × feature set · macro-F1, 0.5 operating point" sub="Hover a cell for its bootstrap 95 % CI. The best single configuration is highlighted." />
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="tbl">
          <thead><tr><th>Learner</th>{b.feature_sets.map(f => <th key={f.key}>{f.label}</th>)}<th>ECE (MAGPIE + hull)</th></tr></thead>
          <tbody>
            {b.learners.map(l => (
              <tr key={l.key}>
                <td>{l.label}</td>
                {b.feature_sets.map(f => {
                  const c = l.cells[f.key]
                  const best = bestCell && bestCell.l.key === l.key && bestCell.fs === f.key
                  return <td key={f.key} className={`num ${best ? 'font-bold text-[var(--accent)]' : ''}`} title={c?.ci95 ? `95 % CI ${c.ci95[0].toFixed(3)}–${c.ci95[1].toFixed(3)}` : ''}>{c ? c.macro_f1.toFixed(3) : '—'}</td>
                })}
                <td className="num text-[var(--dim)]">{l.cells['MAGPIE+DFT-hull']?.ece != null ? l.cells['MAGPIE+DFT-hull'].ece.toFixed(3) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="text-[11px] text-[var(--dim)] mt-2 leading-relaxed max-w-3xl list-disc pl-4 space-y-1">
        <li>The accuracy ordering COMPASS-9 &lt; MAGPIE &lt; hull-augmented sets is learner-independent.</li>
        {tie.length > 0 && <li>
          At the 0.5 operating point the COMPASS-9 + hull ≈ MAGPIE + hull tie holds under {tieHolds.map(t => `${t.label} (${signed(t.gap)})`).join(', ')};
          {' '}{tieGap.map(t => t.label).join(' and ')} resolve a small gap ({tieGap.map(t => signed(t.gap)).join(', ')}). The threshold-free panel above is the operating-point-free view of the same comparison.
        </li>}
        {bestCell && <li>Best single configuration: {bestCell.l.label} on {fsLabel(bestCell.fs)}, macro-F1 {bestCell.macro_f1.toFixed(3)}.</li>}
        {b.best_calibrated && <li>Best calibrated learner: {b.best_calibrated.label} (expected calibration error {b.best_calibrated.ece.toFixed(3)} on MAGPIE + hull).</li>}
      </ul>
    </div>
  )
}

/* ================= robustness tiles ================= */
function Robustness({ b }) {
  const lofoC = b.lofo?.['COMPASS-9+hull']?.mean_lofo, lofoM = b.lofo?.['MAGPIE+DFT-hull']?.mean_lofo
  const conf = b.conformal?.['xgb|MAGPIE+DFT-hull']
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card p-4">
        <SectionHead icon={ShieldCheck} title="Leave-one-family-out" />
        <div className="text-sm leading-relaxed">
          Holding out whole element families (alkali, 3d, lanthanide, …):
          COMPASS-9 + hull <b className="mono">{fmt3(lofoC)}</b> vs MAGPIE + hull <b className="mono">{fmt3(lofoM)}</b> mean macro-F1
          {b.lofo?.['COMPASS-9'] && b.lofo?.['MAGPIE'] && <> (without hull: {fmt3(b.lofo['COMPASS-9'].mean_lofo)} vs {fmt3(b.lofo['MAGPIE'].mean_lofo)})</>}.
        </div>
      </div>
      <div className="card p-4">
        <SectionHead icon={ShieldCheck} title={`Conformal prediction${conf ? ` · α = ${conf.alpha}` : ''}`} />
        <div className="text-sm leading-relaxed">
          Mondrian per-class coverage on MAGPIE + hull:{' '}
          {conf && CLASSES.map(c => `${CLASS_LABEL[c].toLowerCase()} ${fmt3(conf.coverage[c])}`).join(', ')}
          {conf?.joint_all4_covered != null && <>; all four classes covered jointly in {fmt3(conf.joint_all4_covered)} of systems</>}.
        </div>
      </div>
      <div className="card p-4">
        <SectionHead icon={ShieldCheck} title="Null model & label screen" />
        <div className="text-sm leading-relaxed">
          Label-shuffled (y-scrambled) macro-F1: COMPASS-9 {fmt3(b.yscramble?.['COMPASS-9']?.mean)}, MAGPIE {fmt3(b.yscramble?.['MAGPIE']?.mean)}.
          A {b.label_noise?.members}-model consensus screen flags {b.label_noise?.n_flags} labels on {b.label_noise?.n_pairs} systems as candidates for re-checking against the ground truth; each flagged system carries a banner on its page.
        </div>
      </div>
    </div>
  )
}
