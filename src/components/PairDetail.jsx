import React, { useEffect, useMemo, useState } from 'react'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import {
  Lightbulb, AlertTriangle, Layers, Sparkles, Database, Table2, Radar as RadarIcon,
  ArrowUpRight, CheckCircle2, XCircle, Info,
} from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'
import { useApp, useChartTheme, usePredictions, useInterp } from '../lib/app'
import { nearestSystems } from '../lib/metrics'
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const DL = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13']
const C9 = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D13']

// plain-language descriptor glossary
const DESC_INFO = {
  D1: 'Dominant valence-orbital mismatch (s/p/d/f character).',
  D2: 'Bond-weighted orbital-energy mismatch.',
  D3: 'Mean valence-orbital energy of the pair.',
  D4: 'Valence-electron-count similarity.',
  D5: 'Harrison interatomic coupling strength.',
  D6: 'Orbital bond stabilization.',
  D7: 'Atomic size mismatch (Hume-Rothery).',
  D8: 'Electronegativity difference.',
  D9: 'Bonding descriptor (DFT / LOBSTER).',
  D10: 'Bonding descriptor (DFT / LOBSTER).',
  D11: 'Bonding descriptor (DFT / LOBSTER).',
  D12: 'Bonding descriptor (DFT / LOBSTER).',
  D13: 'Periodic-group distance |G_A − G_B|.',
}
const DESC_SHORT = {
  D1: 'orbital mismatch', D2: 'bond-wtd mismatch', D3: 'mean orbital E', D4: 'valence similarity',
  D5: 'Harrison coupling', D6: 'bond stabilization', D7: 'size mismatch', D8: 'EN difference',
  D9: 'bonding', D10: 'bonding', D11: 'bonding', D12: 'bonding', D13: 'group distance',
}
const descKey = name => { const m = (name || '').match(/^D(\d+)/); return m ? 'D' + m[1] : null }
const LEARNER = { xgb: 'XGBoost', tabpfn: 'TabPFN', chain: 'Classifier chain' }
const splitSet = s => { const [l, f] = s.split('|'); return { learner: LEARNER[l] || l, lkey: l, feats: f } }
const alpha = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x))

export default function PairDetail({ pair, allPairs, dft }) {
  const { theme, openPair } = useApp()
  const ct = useChartTheme()
  const interp = useInterp()
  const preds = usePredictions()
  const [invert, setInvert] = useState(theme !== 'light')
  const [descView, setDescView] = useState('radar')
  useEffect(() => { setInvert(theme !== 'light') }, [theme])
  const d = dft?.[pair.pair]
  const hasDesc = pair.D?.D1 != null

  // ranges + percentiles of every descriptor across the whole set
  const stats = useMemo(() => {
    const r = {}
    DL.forEach(k => {
      const v = allPairs.map(p => p.D?.[k]).filter(x => x != null).sort((a, b) => a - b)
      r[k] = { min: v[0], max: v[v.length - 1], sorted: v }
    })
    return r
  }, [allPairs])
  const ranges = useMemo(() => Object.fromEntries(DL.map(k => [k, [stats[k].min, stats[k].max]])), [stats])
  const pct = k => {
    const v = pair.D?.[k]; const s = stats[k].sorted
    if (v == null || !s.length) return null
    let lo = 0, hi = s.length
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] <= v) lo = m + 1; else hi = m }
    return (lo / s.length) * 100
  }
  const norm = k => { const v = pair.D?.[k], [mn, mx] = ranges[k]; return (v == null || mx === mn) ? 0 : (v - mn) / (mx - mn) }

  const radar = useMemo(() => ({
    labels: DL,
    datasets: [{
      data: DL.map(norm),
      backgroundColor: alpha(ct.accent, 0.2), borderColor: ct.accent,
      pointBackgroundColor: ct.accent, pointBorderColor: ct.panel, borderWidth: 2, pointRadius: 3,
    }],
  }), [pair, ranges, ct]) // eslint-disable-line react-hooks/exhaustive-deps
  const radarOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: true,
    scales: { r: { min: 0, max: 1, grid: { color: ct.grid }, angleLines: { color: ct.grid },
      pointLabels: { color: ct.dim, font: { size: 11, family: ct.font } }, ticks: { display: false } } },
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: ct.panel, titleColor: ct.ink, bodyColor: ct.ink, borderColor: ct.grid, borderWidth: 1,
      callbacks: { label: c => { const k = DL[c.dataIndex]; const v = pair.D?.[k]; return ` ${k} = ${v?.toFixed?.(3) ?? v} · ${pct(k)?.toFixed(0)}th pct` } },
    } },
  }), [ct, pair]) // eslint-disable-line react-hooks/exhaustive-deps

  // stored out-of-fold probabilities for this system across every run
  const runs = useMemo(() => {
    const rec = preds?.pairs?.[pair.pair]
    if (!rec || !preds?.sets) return null
    const rows = preds.sets.map((s, i) => {
      const p = rec.p[i]
      const predicted = p ? CLASSES.filter((c, j) => p[j] >= 0.5) : []
      return { key: s, ...splitSet(s), p, predicted, exact: p ? sameSet(predicted, pair.truth) : null }
    })
    const valid = rows.filter(r => r.p)
    const consensus = CLASSES.map((_, j) => valid.length ? valid.reduce((a, r) => a + r.p[j], 0) / valid.length : null)
    const nExact = valid.filter(r => r.exact).length
    return { rows, consensus, nExact, nValid: valid.length, flags: rec.flags || [] }
  }, [preds, pair])

  const similar = useMemo(() => nearestSystems(allPairs, pair, C9, 6), [allPairs, pair])

  return (
    <div className="flex flex-col gap-4">
      {/* label-audit flags (from the paper's label-noise audit) */}
      {runs?.flags?.length > 0 && (
        <div className="card p-3.5 fadein flex gap-3 items-start" style={{ borderColor: alpha('#f59e0b', 0.55), background: alpha('#f59e0b', 0.08) }}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <div className="text-sm leading-relaxed">
            <b>Label-audit flag.</b>{' '}
            {runs.flags.map((f, i) => (
              <span key={i}>
                The {preds.meta.label_noise.members}-model out-of-fold consensus gives{' '}
                <span className="font-mono">{f.consensus_p.toFixed(3)}</span> for <Chip c={f.label} solid /> while the ground-truth label says{' '}
                <b>{f.truth ? 'yes' : 'no'}</b>{i < runs.flags.length - 1 ? '; ' : '.'}
              </span>
            ))}
            <div className="text-[11px] text-[var(--dim)] mt-1">
              One of {preds.meta.label_noise.n_pairs} systems flagged in the paper's label-noise audit (consensus outside
              [{preds.meta.label_noise.thresholds[0]}, {preds.meta.label_noise.thresholds[1]}] against the label). The stored label is kept; the flag marks a system worth re-reading from the source phase diagram.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* phase diagram */}
        <div className="card glow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--dim)] font-semibold">{pair.A}–{pair.B} phase diagram</h3>
            <div className="seg">
              <button className={invert ? 'on' : ''} onClick={() => setInvert(true)}>dark</button>
              <button className={!invert ? 'on' : ''} onClick={() => setInvert(false)}>original</button>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ background: invert ? '#0b1020' : '#fff' }}>
            <img src={`./phase/${pair.phase_img}`} alt={`${pair.A}-${pair.B} phase diagram`} loading="lazy"
              className="w-full object-contain"
              style={invert ? { filter: 'invert(1) hue-rotate(180deg)', mixBlendMode: 'screen' } : {}} />
          </div>
          <div className="text-[10px] text-[var(--dim)] mt-1.5">Ground-truth CALPHAD phase diagram (rendered to 25 °C). Labels are read from this diagram.</div>
        </div>

        {/* phase behaviour */}
        <div className="card glow p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--dim)] font-semibold mb-3">Phase behaviour</h3>
          <Block title="Ground-truth label(s)">
            {pair.truth.length ? pair.truth.map(c => <Chip key={c} c={c} solid />) : <Dash />}
          </Block>
          <Block title="Out-of-fold prediction · XGBoost on MAGPIE (leave-one-element-out, p ≥ 0.5)">
            {pair.pred.length ? pair.pred.map(c => <Chip key={c} c={c} />) : <span className="text-[var(--dim)] text-sm">none above threshold</span>}
            {pair.pred.length > 0 && (sameSet(pair.pred, pair.truth)
              ? <span className="badge" style={{ background: alpha('#22c55e', 0.15), color: '#22c55e' }}><CheckCircle2 size={11} /> exact match</span>
              : <span className="badge" style={{ background: alpha('#f59e0b', 0.15), color: '#f59e0b' }}><XCircle size={11} /> differs from truth</span>)}
          </Block>
          <div className="text-[11px] text-[var(--dim)] mb-1.5 mt-3">Per-class probability</div>
          {CLASSES.map(c => (
            <div key={c} className="flex items-center gap-2 mb-1.5">
              <span className="w-28 text-[11px] font-medium" style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--panel2)] overflow-hidden relative">
                <div className="h-full rounded-full" style={{ width: `${(pair.prob[c] * 100).toFixed(0)}%`, background: CLASS_COLOR[c], transition: 'width .3s ease' }} />
                <div className="absolute top-0 bottom-0 w-px bg-[var(--faint)]" style={{ left: '50%' }} title="0.5 operating point" />
              </div>
              <span className="w-10 text-right text-xs font-mono">{pair.prob[c].toFixed(2)}</span>
            </div>
          ))}
          {runs && (
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between text-[11px] text-[var(--dim)] mb-1.5">
                <span>Consensus over {runs.nValid} stored runs</span>
                <span className="tip" data-tip="runs whose p ≥ 0.5 label set equals the ground truth">
                  <b className="text-[var(--text)]">{runs.nExact}</b> / {runs.nValid} exact
                </span>
              </div>
              <div className="probbar" style={{ height: 8 }}>
                {CLASSES.map((c, j) => <span key={c} style={{ width: `${(runs.consensus[j] || 0) / Math.max(1e-9, runs.consensus.reduce((a, b) => a + (b || 0), 0)) * 100}%`, background: CLASS_COLOR[c] }} title={`${CLASS_LABEL[c]} mean p = ${runs.consensus[j]?.toFixed(3)}`} />)}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10.5px] font-mono text-[var(--dim)]">
                {CLASSES.map((c, j) => <span key={c}><span style={{ color: CLASS_COLOR[c] }}>●</span> {runs.consensus[j]?.toFixed(2)}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* descriptors */}
        <div className="card glow p-4">
          <div className="flex items-center justify-between mb-1 gap-2">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--dim)] font-semibold">Descriptors D1–D13</h3>
            <div className="seg">
              <button className={descView === 'radar' ? 'on' : ''} onClick={() => setDescView('radar')} title="Radar"><RadarIcon size={13} /></button>
              <button className={descView === 'table' ? 'on' : ''} onClick={() => setDescView('table')} title="Percentile table"><Table2 size={13} /></button>
            </div>
          </div>
          <div className="text-[10px] text-[var(--dim)] mb-2">
            normalized across the 970-pair set · COMPASS-9 = D1–D8 + D13; D9–D12 optional bonding · see the Descriptors tab
            {hasDesc && pair.D?.D9 == null &&
              <span className="text-amber-500/80"> · D9–D12 (DFT/LOBSTER bonding) not available for this added system</span>}
          </div>
          {!hasDesc ? (
            <div className="text-xs text-[var(--dim)] py-8 text-center leading-relaxed">
              COMPASS descriptors pending for this newly added system.<br />
              Phase classification is ground truth; the prediction shown is the composition (MAGPIE) model.
            </div>
          ) : descView === 'radar' ? (
            <Radar data={radar} options={radarOpts} />
          ) : (
            <div className="overflow-y-auto max-h-[330px] rounded-lg border border-[var(--border)]">
              <table className="tbl">
                <thead><tr><th>D</th><th>value</th><th style={{ textAlign: 'left' }}>percentile in 970</th></tr></thead>
                <tbody>
                  {DL.map(k => {
                    const v = pair.D?.[k]; const q = pct(k)
                    return (
                      <tr key={k} className={C9.includes(k) ? '' : 'opacity-70'}>
                        <td><span className="font-semibold">{k}</span> <span className="text-[var(--dim)] text-[10.5px]">{DESC_SHORT[k]}</span></td>
                        <td className="num">{v == null ? '—' : Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3)}</td>
                        <td style={{ textAlign: 'left', minWidth: 110 }}>
                          {q == null ? '—' : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-[var(--panel2)] relative">
                                <div className="absolute -top-[2.5px] w-2 h-2 rounded-full" style={{ left: `calc(${q.toFixed(0)}% - 4px)`, background: C9.includes(k) ? ct.accent : ct.accent2 }} />
                              </div>
                              <span className="num text-[10.5px] w-8 text-right">{q.toFixed(0)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* predictions across every stored run */}
      <RunsPanel runs={runs} preds={preds} pair={pair} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3"><InterpPanel pair={pair} interp={interp} ranges={ranges} pct={pct} /></div>
        <div className="xl:col-span-2"><SimilarPanel pair={pair} similar={similar} openPair={openPair} /></div>
      </div>

      {/* DFT properties panel (multi-source, source-tagged, nothing averaged) */}
      {d && <DftPanel pair={pair} d={d} />}
    </div>
  )
}

// ---- out-of-fold probability across the ten stored runs ----
function RunsPanel({ runs, preds, pair }) {
  if (!preds) return <div className="skeleton h-40" />
  if (!runs) return null
  const groups = ['xgb', 'tabpfn', 'chain'].map(l => ({ l, rows: runs.rows.filter(r => r.lkey === l) })).filter(g => g.rows.length)
  return (
    <div className="card glow p-4 fadein">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Layers size={15} className="text-[var(--accent)]" />
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--dim)] font-semibold">Out-of-fold probability across the paper's stored runs</h3>
        <span className="ml-auto text-[11px] text-[var(--dim)]"><b className="text-[var(--text)]">{runs.nExact}</b> of {runs.nValid} runs reproduce the label set exactly</span>
      </div>
      <p className="text-[11px] text-[var(--dim)] mb-3 leading-relaxed">{preds.meta.protocol} Cells show p(class); a filled cell is above the 0.5 operating point.
        Ground truth: {pair.truth.map(c => <Chip key={c} c={c} solid small />)}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="tbl">
          <thead>
            <tr>
              <th>Learner</th><th style={{ textAlign: 'left' }}>Feature set</th>
              {CLASSES.map(c => <th key={c} style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</th>)}
              <th style={{ textAlign: 'left' }}>Predicted (p ≥ 0.5)</th><th>Exact</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => g.rows.map((r, i) => (
              <tr key={r.key}>
                <td className="whitespace-nowrap">{i === 0 ? <span className="font-semibold">{r.learner}</span> : <span className="text-[var(--faint)]">〃</span>}</td>
                <td style={{ textAlign: 'left' }} className="whitespace-nowrap">{r.feats}</td>
                {CLASSES.map((c, j) => {
                  const p = r.p?.[j]; const truth = pair.truth.includes(c)
                  return (
                    <td key={c} className="num" style={{ position: 'relative' }}>
                      {p == null ? '—' : (
                        <span className="inline-block min-w-[52px] px-1.5 py-0.5 rounded-md"
                          style={{ background: alpha(CLASS_COLOR[c], 0.08 + 0.55 * p), color: p >= 0.5 ? '#0b1020' : 'inherit', fontWeight: p >= 0.5 ? 700 : 400,
                            outline: truth ? `1.5px solid ${CLASS_COLOR[c]}` : 'none', outlineOffset: -1 }}>
                          {p.toFixed(3)}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td style={{ textAlign: 'left' }}>
                  <span className="flex flex-wrap gap-1">{r.predicted.length ? r.predicted.map(c => <Chip key={c} c={c} small />) : <span className="text-[var(--dim)] text-[10.5px]">none</span>}</span>
                </td>
                <td>{r.exact == null ? '—' : r.exact ? <CheckCircle2 size={15} className="inline" style={{ color: '#22c55e' }} /> : <XCircle size={15} className="inline" style={{ color: '#f59e0b' }} />}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-[var(--dim)] mt-2 flex items-center gap-1.5 flex-wrap">
        <Info size={11} /> Outlined cells mark the ground-truth classes. Probabilities are the paper's stored out-of-fold values ({preds.meta.date}); nothing is retrained in the browser.
      </div>
    </div>
  )
}

// ---- "Why this classification" — decision-rule headline + per-class TreeSHAP drivers ----
function InterpPanel({ pair, interp, ranges, pct }) {
  const dom = dominantClass(pair.truth)
  if (!interp) return <div className="skeleton h-56" />
  if (!dom || !interp[dom]) return null
  const info = interp[dom]
  const top = info.shap.slice(0, 6)
  const hasDesc = pair.D?.D1 != null
  const drivers = info.shap.slice(0, 4).map(s => descKey(s.name)).filter(k => k && ranges[k])
  return (
    <div className="card glow p-4 fadein h-full">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Lightbulb size={15} className="text-amber-400" />
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--dim)] font-semibold">Why this classification</h3>
        <Chip c={dom} solid />
      </div>
      <p className="text-sm leading-relaxed mb-1">{info.rule}</p>
      <p className="text-[11px] text-[var(--dim)] mb-3">
        Primary driver: <b style={{ color: CLASS_COLOR[dom] }}>{info.driver}</b> — {DESC_INFO[descKey(info.driver)] || ''}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] text-[var(--dim)] mb-1.5">Descriptor importance for {CLASS_LABEL[dom].toLowerCase()} (mean |SHAP|, all 970 systems)</div>
          {top.map(s => (
            <div key={s.name} className="flex items-center gap-2 mb-1">
              <span className="w-36 text-[11px] truncate" title={s.name}>{s.name}</span>
              <div className="flex-1 h-2.5 rounded bg-[var(--panel2)] overflow-hidden">
                <div className="h-full rounded" style={{ width: `${s.val * 100}%`, background: `linear-gradient(90deg, ${alpha(CLASS_COLOR[dom], 0.6)}, ${CLASS_COLOR[dom]})` }} />
              </div>
              <span className="num text-[10px] text-[var(--dim)] w-8 text-right">{s.raw?.toFixed?.(2)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[11px] text-[var(--dim)] mb-1.5">Where {pair.pair} sits on the top drivers (percentile in 970)</div>
          {!hasDesc ? (
            <div className="text-[11px] text-[var(--dim)] py-4">COMPASS descriptors pending for this newly added system.</div>
          ) : drivers.map(k => {
            const v = pair.D[k]; const q = pct(k)
            return (
              <div key={k} className="mb-2">
                <div className="flex justify-between text-[10px] text-[var(--dim)]">
                  <span>{k} · {DESC_INFO[k]}</span>
                  <span className="font-mono">{v?.toFixed?.(3) ?? v} · {q?.toFixed(0)}th</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-[var(--panel2)] mt-1">
                  <div className="absolute -top-[3px] w-2.5 h-2.5 rounded-full border-2 border-[var(--panel)]" style={{ left: `calc(${(q || 0).toFixed(0)}% - 5px)`, background: CLASS_COLOR[dom] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="text-[10px] text-[var(--dim)] mt-3">
        Derived from explicit decision-tree rules + TreeSHAP over 970 ground-truth systems (COMPASS-9 descriptors, no DFT input). Class-level explanation, not a per-system causal claim.
      </div>
    </div>
  )
}

// ---- k-nearest systems in z-scored COMPASS-9 space ----
function SimilarPanel({ pair, similar, openPair }) {
  return (
    <div className="card glow p-4 fadein h-full">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={15} className="text-[var(--accent2)]" />
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--dim)] font-semibold">Nearest systems in COMPASS-9 space</h3>
      </div>
      {!similar.length ? (
        <div className="text-[11px] text-[var(--dim)] py-4">Descriptors pending for this system, so no neighbours can be computed.</div>
      ) : (
        <>
          <div className="text-[10px] text-[var(--dim)] mb-2">Euclidean distance after z-scoring D1–D8 + D13 over the 970-pair set. Neighbours that share an element are marked.</div>
          <div className="flex flex-col gap-1.5">
            {similar.map(({ pair: q, dist }, i) => {
              const shared = [q.A, q.B].filter(e => e === pair.A || e === pair.B)
              const agree = sameSet(q.truth, pair.truth)
              return (
                <button key={q.pair} onClick={() => openPair(q.pair)}
                  className="rcard card text-left px-3 py-2 flex items-center gap-2.5 w-full">
                  <span className="stripe" style={{ background: CLASS_COLOR[dominantClass(q.truth)] || 'var(--border)' }} />
                  <span className="num text-[10px] text-[var(--faint)] w-4">{i + 1}</span>
                  <span className="font-semibold text-sm w-16">{q.pair}</span>
                  <span className="flex flex-wrap gap-1 flex-1">{q.truth.map(c => <Chip key={c} c={c} small />)}</span>
                  {shared.length > 0 && <span className="badge" style={{ background: 'var(--panel2)', color: 'var(--dim)' }}>shares {shared.join(', ')}</span>}
                  <span className="tip num text-[10.5px] text-[var(--dim)]" data-tip={agree ? 'same label set' : 'different label set'}>
                    <span style={{ color: agree ? '#22c55e' : '#f59e0b' }}>●</span> d = {dist.toFixed(2)}
                  </span>
                  <ArrowUpRight size={13} className="text-[var(--faint)]" />
                </button>
              )
            })}
          </div>
          <div className="text-[10px] text-[var(--dim)] mt-2">
            {similar.filter(s => sameSet(s.pair.truth, pair.truth)).length} of {similar.length} neighbours carry the same ground-truth label set.
          </div>
        </>
      )}
    </div>
  )
}

// ---- DFT properties ----
function DftPanel({ pair, d }) {
  const sources = d.per_source ? Object.entries(d.per_source) : []
  return (
    <div className="card glow p-4 fadein">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-[var(--accent)]" />
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--dim)] font-semibold">
            DFT properties <span className="text-[var(--accent)]">· {pair.A}–{pair.B}</span>
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          {(d.sources || []).map(s => <span key={s} className="px-2 py-0.5 rounded-full chip-grad font-medium">{s}</span>)}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="stat"><div className="v">{d.n_stable}</div><div className="k">stable compounds on the hull</div></div>
        <div className="stat"><div className="v">{d.ground_state ? d.ground_state.formula : '—'}</div>
          <div className="k">{d.ground_state ? `ground state · ${d.ground_state.Ef} eV/atom · ${d.ground_state.source}` : 'ground state'}</div></div>
        <div className="stat"><div className="v num">{d.min_hull != null ? d.min_hull : '—'}</div><div className="k">min hull distance (eV/atom)</div></div>
        <div className="stat"><div className="v num text-[18px]">{d.elastic ? `${d.elastic.bulk_GPa ?? '—'} / ${d.elastic.shear_GPa ?? '—'}` : '—'}</div>
          <div className="k">{d.elastic ? `bulk / shear GPa · ${d.elastic.source} · ${d.elastic.for}` : 'bulk / shear modulus · not computed'}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {d.compounds?.length > 0 && (
          <div className="lg:col-span-2">
            <div className="text-[11px] text-[var(--dim)] mb-1">DFT-stable compounds on the convex hull — sorted by formation energy</div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="tbl">
                <thead><tr><th>Compound</th><th>E<sub>f</sub> (eV/atom)</th><th style={{ textAlign: 'left' }}>Space group</th><th style={{ textAlign: 'left' }}>Source</th></tr></thead>
                <tbody>
                  {[...d.compounds].sort((a, b) => (a.Ef ?? 0) - (b.Ef ?? 0)).map((c, i) => (
                    <tr key={i}>
                      <td className="font-semibold">{c.formula}{i === 0 && <span className="ml-1.5 text-[9px] text-[var(--accent3)]">★ ground state</span>}</td>
                      <td className="num">{c.Ef}</td>
                      <td style={{ textAlign: 'left' }} className="text-[var(--dim)]">{c.spacegroup || '—'}</td>
                      <td style={{ textAlign: 'left' }}><span className="text-[var(--accent)]">{c.source}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {sources.length > 0 && (
          <div>
            <div className="text-[11px] text-[var(--dim)] mb-1">Per-source coverage (not averaged)</div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="tbl">
                <thead><tr><th>Source</th><th>entries</th><th>stable</th><th>min E<sub>f</sub></th></tr></thead>
                <tbody>
                  {sources.map(([s, v]) => (
                    <tr key={s}><td className="font-semibold">{s}</td><td className="num">{v.n_entries ?? '—'}</td><td className="num">{v.n_stable ?? '—'}</td><td className="num">{v.min_Ef ?? '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="text-[10px] text-[var(--dim)] mt-2">
        Computed values from public DFT databases (PBE / PBE+U / OptB88vdW — see source). Multi-source: not averaged; each number keeps its provenance.
      </div>
    </div>
  )
}

const Block = ({ title, children }) => (
  <div className="mb-3">
    <div className="text-[11px] text-[var(--dim)] mb-1">{title}</div>
    <div className="flex flex-wrap gap-1 items-center">{children}</div>
  </div>
)
const Dash = () => <span className="text-[var(--dim)] text-sm">—</span>
export const Chip = ({ c, solid, small }) => (
  <span className={`inline-flex items-center rounded-full font-medium ${small ? 'px-1.5 text-[10px] leading-[16px]' : 'px-2 py-0.5 text-xs'}`}
    style={solid ? { background: CLASS_COLOR[c], color: '#0b1020' } : { border: `1px solid ${CLASS_COLOR[c]}`, color: CLASS_COLOR[c] }}>
    {CLASS_LABEL[c]}
  </span>
)
