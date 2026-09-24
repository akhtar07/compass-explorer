import React, { useState } from 'react'
import { ArrowLeft, X, GitCompare, Link2, Check, Trophy } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL } from '../lib/util'

// ---- side-by-side comparison of pinned systems (route #/compare/A-B,C-D) ----
// Numeric rows mark the "best" cell: lowest hull distance / price / density, highest
// modulus / melting point / stable-compound count. Ties are all highlighted.
export default function CompareView({ systems, dft, onBack, onOpen, onRemove }) {
  const [copied, setCopied] = useState(false)
  const rows = [
    { k: 'thumb', label: '' },
    { k: 'truth', label: 'Ground-truth class' },
    { k: 'pred', label: 'MAGPIE prediction (out-of-fold)' },
    ...CLASSES.map(c => ({ k: 'prob:' + c, label: `P(${CLASS_LABEL[c]})`, cls: c })),
    { k: 'n_stable', label: 'DFT-stable compounds', best: 'max' },
    { k: 'ground', label: 'Ground state' },
    { k: 'hull', label: 'Min hull dist (eV)', best: 'min' },
    { k: 'young', label: 'Elastic modulus (GPa)', best: 'max' },
    { k: 'sources', label: 'DFT sources' },
    { k: 'density', label: 'Density range (g/cc)', best: 'min' },
    { k: 'mp', label: 'Melting point range (K)', best: 'max' },
    { k: 'price', label: 'Price range ($/kg)', best: 'min' },
  ]
  // numeric value used for the best-in-row highlight
  const numeric = (p, k) => {
    const d = dft?.[p.pair]
    if (k === 'n_stable') return d?.n_stable ?? null
    if (k === 'hull') return d?.min_hull ?? null
    if (k === 'young') return d?.elastic?.young_GPa ?? null
    if (k === 'density') return p.props?.density?.mean ?? null
    if (k === 'mp') return p.props?.JARVIS_mp?.mean ?? null
    if (k === 'price') return p.props?.Price_USD_kg?.mean ?? null
    return null
  }
  const bestSet = r => {
    if (!r.best) return new Set()
    const vals = systems.map(p => numeric(p, r.k)).filter(v => v != null && !isNaN(v))
    if (vals.length < 2) return new Set()
    const target = r.best === 'max' ? Math.max(...vals) : Math.min(...vals)
    return new Set(systems.filter(p => numeric(p, r.k) === target).map(p => p.pair))
  }
  const cell = (p, k) => {
    const d = dft?.[p.pair]
    const rng = a => p.props?.[a] ? <span className="mono">{p.props[a].min} – {p.props[a].max}</span> : '—'
    if (k === 'thumb') return <img src={`./phase/${p.phase_img}`} className="w-full h-20 object-contain bg-white rounded" loading="lazy" />
    if (k === 'truth') return <div className="flex flex-wrap gap-1 justify-end">{p.truth.map(c => <span key={c} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: CLASS_COLOR[c] + '33', color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span>)}</div>
    if (k === 'pred') return <span className="text-[var(--dim)]">{p.pred?.map(c => CLASS_LABEL[c].split(' ')[0]).join(', ') || '—'}</span>
    if (k.startsWith('prob:')) { const c = k.slice(5); const v = p.prob?.[c] ?? 0; return (
      <div className="flex items-center gap-1.5"><div className="flex-1 h-1.5 rounded bg-[var(--panel2)] overflow-hidden"><div className="h-full" style={{ width: `${v * 100}%`, background: CLASS_COLOR[c] }} /></div><span className="mono text-[10px] w-8 text-right">{v.toFixed(2)}</span></div>) }
    if (k === 'n_stable') return <span className="mono">{d?.n_stable ?? '—'}</span>
    if (k === 'ground') return d?.ground_state ? <>{d.ground_state.formula} <span className="mono text-[var(--dim)]">({d.ground_state.Ef})</span></> : '—'
    if (k === 'hull') return <span className="mono">{d?.min_hull != null ? d.min_hull : '—'}</span>
    if (k === 'young') return <span className="mono">{d?.elastic?.young_GPa != null ? Math.round(d.elastic.young_GPa) : '—'}</span>
    if (k === 'sources') return <span className="text-[var(--dim)]">{d?.sources?.join(', ') || '—'}</span>
    if (k === 'density') return rng('density')
    if (k === 'mp') return rng('JARVIS_mp')
    if (k === 'price') return rng('Price_USD_kg')
    return '—'
  }
  const copyLink = () => navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })

  return (
    <div className="flex flex-col gap-3 fade-up">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--dim)] hover:text-[var(--text)]"><ArrowLeft size={16} /> back to results</button>
        <h1 className="text-xl font-extrabold tracking-tight ml-2 flex items-center gap-2"><GitCompare size={18} className="text-[var(--accent)]" /> Comparing {systems.length} systems</h1>
        <button onClick={copyLink} className="pill ml-auto hover:border-[var(--border-strong)]">{copied ? <Check size={12} /> : <Link2 size={12} />} {copied ? 'Link copied' : 'Copy link'}</button>
      </div>
      <div className="card glow overflow-x-auto">
        <table className="tbl">
          <tbody>
            {rows.map(r => {
              const best = bestSet(r)
              return (
                <tr key={r.k}>
                  <td className="font-medium sticky left-0 min-w-[170px] text-[var(--dim)]" style={{ background: 'var(--panel)', ...(r.cls ? { color: CLASS_COLOR[r.cls] } : {}) }}>
                    {r.label}{r.best && <span className="text-[9px] uppercase tracking-wide text-[var(--faint)] ml-1">{r.best === 'max' ? 'higher better' : 'lower better'}</span>}
                  </td>
                  {systems.map(p => {
                    const isBest = best.has(p.pair)
                    return (
                      <td key={p.pair} className="align-middle min-w-[160px]"
                        style={isBest ? { background: 'color-mix(in srgb, var(--accent3) 12%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent3) 45%, transparent)' } : {}}>
                        {r.k === 'thumb' ? (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <button onClick={() => onOpen(p)} className="font-semibold hover:text-[var(--accent)]">{p.pair}</button>
                              <button onClick={() => onRemove(p.pair)} title="Remove" className="text-[var(--dim)] hover:text-[var(--text)]"><X size={13} /></button>
                            </div>
                            {cell(p, r.k)}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 justify-end w-full">{cell(p, r.k)}{isBest && <Trophy size={11} className="text-[var(--accent3)]" />}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10.5px] text-[var(--dim)]">
        Highlighted cells are the best value in each numeric row (lowest hull distance / price / density, highest modulus / melting point / compound count; ties all marked).
        Property ranges are element bounds across the binary; DFT values are source-tagged, never averaged. Click a system name for its full page.
        This comparison has its own URL — use “Copy link” to share it.
      </div>
    </div>
  )
}
