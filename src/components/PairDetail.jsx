import React, { useEffect, useMemo, useState } from 'react'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { Lightbulb } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const DL = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13']

// plain-language descriptor glossary (the 9 COMPASS descriptors deep_ml_1 uses)
const DESC_INFO = {
  D1: 'Dominant valence-orbital mismatch (s/p/d/f character).',
  D2: 'Bond-weighted orbital-energy mismatch.',
  D3: 'Mean valence-orbital energy of the pair.',
  D4: 'Valence-electron-count similarity.',
  D5: 'Harrison interatomic coupling strength.',
  D6: 'Orbital bond stabilization.',
  D7: 'Atomic size mismatch (Hume-Rothery).',
  D8: 'Electronegativity difference.',
  D13: 'Periodic-group distance |G_A − G_B|.',
}
const descKey = name => { const m = (name || '').match(/^D(\d+)/); return m ? 'D' + m[1] : null }

// interpretability.json is small + static; cache it across PairDetail opens
let _interp = null
function useInterp() {
  const [x, setX] = useState(_interp)
  useEffect(() => {
    if (_interp) return
    fetch('./data/interpretability.json').then(r => r.json())
      .then(j => { _interp = j; setX(j) }).catch(() => {})
  }, [])
  return x
}

export default function PairDetail({ pair, allPairs, dft }) {
  const [invert, setInvert] = useState(() => !document.documentElement.classList.contains('light'))
  const interp = useInterp()
  const d = dft?.[pair.pair]
  const ranges = useMemo(() => {
    const r = {}
    DL.forEach(d => {
      let mn = Infinity, mx = -Infinity
      allPairs.forEach(p => { const v = p.D[d]; if (v != null) { mn = Math.min(mn, v); mx = Math.max(mx, v) } })
      r[d] = [mn, mx]
    })
    return r
  }, [allPairs])

  const radar = useMemo(() => ({
    labels: DL,
    datasets: [{
      data: DL.map(d => { const v = pair.D[d], [mn, mx] = ranges[d]; return (v == null || mx === mn) ? 0 : (v - mn) / (mx - mn) }),
      backgroundColor: 'rgba(56,189,248,0.18)', borderColor: '#38bdf8',
      pointBackgroundColor: '#38bdf8', borderWidth: 2,
    }],
  }), [pair, ranges])

  return (
    <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* phase diagram */}
      <div className="card glow p-4 lg:col-span-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm uppercase tracking-wide text-[var(--dim)]">{pair.A}–{pair.B} phase diagram</h3>
          <button onClick={() => setInvert(v => !v)}
            className="text-[11px] px-2 py-1 rounded bg-[var(--panel2)] hover:bg-[var(--panel2)] text-[var(--text)]">
            {invert ? 'dark' : 'original'}
          </button>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: invert ? '#0b1020' : '#fff' }}>
          <img src={`./phase/${pair.phase_img}`} alt={`${pair.A}-${pair.B} phase diagram`}
            className="w-full object-contain"
            style={invert ? { filter: 'invert(1) hue-rotate(180deg)', mixBlendMode: 'screen' } : {}} />
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Ground-truth CALPHAD phase diagram (rendered to 25 °C).</div>
      </div>

      {/* prediction */}
      <div className="card glow p-4">
        <h3 className="text-sm uppercase tracking-wide text-[var(--dim)] mb-3">Phase behaviour</h3>
        <Block title="Ground-truth label(s)">
          {pair.truth.length ? pair.truth.map(c => <Chip key={c} c={c} solid />) : <Dash />}
        </Block>
        <Block title="Model prediction (MAGPIE, out-of-fold)">
          {pair.pred.length ? pair.pred.map(c => <Chip key={c} c={c} />) : <span className="text-slate-500 text-sm">none above threshold</span>}
        </Block>
        <div className="text-xs text-slate-500 mb-1 mt-3">Per-class probability</div>
        {CLASSES.map(c => (
          <div key={c} className="flex items-center gap-2 mb-1">
            <span className="w-24 text-[11px]" style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span>
            <div className="flex-1 h-2 rounded bg-[var(--panel2)] overflow-hidden">
              <div className="h-full" style={{ width: `${(pair.prob[c] * 100).toFixed(0)}%`, background: CLASS_COLOR[c] }} />
            </div>
            <span className="w-9 text-right text-xs font-mono">{pair.prob[c].toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* radar */}
      <div className="card glow p-4">
        <h3 className="text-sm uppercase tracking-wide text-[var(--dim)] mb-1">Descriptors D1–D13</h3>
        <div className="text-[10px] text-slate-500 mb-2">
          normalized across the 970-pair set · COMPASS-9 = D1–D8 + D13; D9–D12 optional bonding · see the Descriptors tab
          {pair.D?.D1 != null && pair.D?.D9 == null &&
            <span className="text-amber-500/80"> · D9–D12 (DFT/LOBSTER bonding) not available for this added system</span>}
        </div>
        {pair.D?.D1 == null ? (
          <div className="text-xs text-[var(--dim)] py-8 text-center leading-relaxed">
            COMPASS descriptors pending for this newly added system.<br/>
            Phase classification is ground truth; the prediction shown is the composition (MAGPIE) model.
          </div>
        ) : (
        <Radar data={radar} options={{
          scales: { r: { min: 0, max: 1, grid: { color: '#26304e' }, angleLines: { color: '#26304e' },
            pointLabels: { color: '#9aa3bd', font: { size: 11 } }, ticks: { display: false } } },
          plugins: { legend: { display: false } },
        }} />
        )}
      </div>
    </div>

      {/* interpretability: why this classification (deep_ml_1 rules + TreeSHAP) */}
      <InterpPanel pair={pair} interp={interp} ranges={ranges} />

      {/* DFT properties panel (multi-source, source-tagged, nothing averaged) */}
      {d && (
        <div className="card glow p-4 fadein">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm uppercase tracking-wide text-[var(--dim)]">
              DFT properties <span className="text-[var(--accent)]">· {pair.A}–{pair.B}</span>
            </h3>
            <div className="flex items-center gap-2 text-[10px]">
              {(d.sources || []).map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full chip-grad font-medium">{s}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="Stable compounds" value={d.n_stable} />
            <Stat label="Ground state" value={d.ground_state ? d.ground_state.formula : '—'}
                  sub={d.ground_state ? `${d.ground_state.Ef} eV/atom · ${d.ground_state.source}` : ''} />
            <Stat label="Min hull distance" value={d.min_hull != null ? `${d.min_hull} eV` : '—'} />
            <Stat label="Bulk / Shear modulus"
                  value={d.elastic ? `${d.elastic.bulk_GPa ?? '—'} / ${d.elastic.shear_GPa ?? '—'} GPa` : '—'}
                  sub={d.elastic ? `${d.elastic.source} · ${d.elastic.for}` : 'not computed'} />
          </div>
          {d.compounds?.length > 0 && (
            <>
              <div className="text-[11px] text-[var(--dim)] mb-1">DFT-stable compounds on the convex hull — sorted by formation energy</div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-[11px]">
                  <thead className="text-[var(--dim)] bg-[var(--panel2)]">
                    <tr>
                      <th className="text-left font-medium px-2 py-1.5">Compound</th>
                      <th className="text-right font-medium px-2 py-1.5">E<sub>f</sub> (eV/atom)</th>
                      <th className="text-left font-medium px-2 py-1.5">Space group</th>
                      <th className="text-left font-medium px-2 py-1.5">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...d.compounds].sort((a, b) => (a.Ef ?? 0) - (b.Ef ?? 0)).map((c, i) => (
                      <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--panel2)]/60">
                        <td className="px-2 py-1.5 font-semibold">{c.formula}{i === 0 && <span className="ml-1.5 text-[9px] text-[var(--accent3)]">★ ground state</span>}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{c.Ef}</td>
                        <td className="px-2 py-1.5 text-[var(--dim)]">{c.spacegroup || '—'}</td>
                        <td className="px-2 py-1.5"><span className="text-[var(--accent)]">{c.source}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="text-[10px] text-[var(--dim)] mt-2">
            Computed values from public DFT databases (PBE / PBE+U / OptB88vdW — see source). Multi-source: not averaged.
          </div>
        </div>
      )}
    </div>
  )
}

// "Why this classification" — decision-rule headline + per-class TreeSHAP drivers
// (from deep_ml_1 over 970 systems) + where THIS system sits on each driver.
function InterpPanel({ pair, interp, ranges }) {
  const dom = dominantClass(pair.truth)
  if (!interp || !dom || !interp[dom]) return null
  const info = interp[dom]
  const top = info.shap.slice(0, 6)
  const hasDesc = pair.D?.D1 != null
  const drivers = info.shap.slice(0, 3).map(s => descKey(s.name)).filter(k => k && ranges[k])
  return (
    <div className="card glow p-4 fadein">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Lightbulb size={15} className="text-amber-400" />
        <h3 className="text-sm uppercase tracking-wide text-[var(--dim)]">Why this classification</h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: CLASS_COLOR[dom], color: '#0b1020' }}>{CLASS_LABEL[dom]}</span>
      </div>
      <p className="text-sm leading-relaxed mb-1">{info.rule}</p>
      <p className="text-[11px] text-[var(--dim)] mb-3">
        Primary driver: <b style={{ color: CLASS_COLOR[dom] }}>{info.driver}</b> — {DESC_INFO[descKey(info.driver)] || ''}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SHAP importance for this class */}
        <div>
          <div className="text-[11px] text-[var(--dim)] mb-1.5">Descriptor importance for {CLASS_LABEL[dom].toLowerCase()} (mean |SHAP|, all 970 systems)</div>
          {top.map(s => (
            <div key={s.name} className="flex items-center gap-2 mb-1">
              <span className="w-36 text-[11px] truncate" title={s.name}>{s.name}</span>
              <div className="flex-1 h-2.5 rounded bg-[var(--panel2)] overflow-hidden">
                <div className="h-full rounded" style={{ width: `${s.val * 100}%`, background: CLASS_COLOR[dom] }} />
              </div>
            </div>
          ))}
        </div>
        {/* where this system sits on the top drivers */}
        <div>
          <div className="text-[11px] text-[var(--dim)] mb-1.5">Where {pair.pair} sits on the top drivers</div>
          {!hasDesc ? (
            <div className="text-[11px] text-[var(--dim)] py-4">COMPASS descriptors pending for this newly added system.</div>
          ) : drivers.map(k => {
            const [mn, mx] = ranges[k]; const v = pair.D[k]
            const t = (v == null || mx === mn) ? 0 : (v - mn) / (mx - mn)
            return (
              <div key={k} className="mb-2">
                <div className="flex justify-between text-[10px] text-[var(--dim)]"><span>{k} · {DESC_INFO[k]}</span><span className="font-mono">{v?.toFixed?.(2) ?? v}</span></div>
                <div className="relative h-1.5 rounded-full bg-[var(--panel2)] mt-0.5">
                  <div className="absolute -top-[3px] w-2 h-2 rounded-full" style={{ left: `calc(${(t * 100).toFixed(0)}% - 4px)`, background: CLASS_COLOR[dom] }} />
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

const Stat = ({ label, value, sub }) => (
  <div className="rounded-lg bg-[var(--panel2)] p-2.5">
    <div className="text-[10px] text-[var(--dim)] uppercase tracking-wide">{label}</div>
    <div className="text-base font-semibold leading-tight mt-0.5">{value}</div>
    {sub && <div className="text-[10px] text-[var(--dim)] mt-0.5">{sub}</div>}
  </div>
)

const Block = ({ title, children }) => (
  <div className="mb-3">
    <div className="text-xs text-slate-500 mb-1">{title}</div>
    <div className="flex flex-wrap gap-1">{children}</div>
  </div>
)
const Dash = () => <span className="text-slate-500 text-sm">—</span>
const Chip = ({ c, solid }) => (
  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
    style={solid ? { background: CLASS_COLOR[c], color: '#0b1020' } : { border: `1px solid ${CLASS_COLOR[c]}`, color: CLASS_COLOR[c] }}>
    {CLASS_LABEL[c]}
  </span>
)
