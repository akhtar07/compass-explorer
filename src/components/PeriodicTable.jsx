import React, { useMemo, useState } from 'react'
import { viridis, textOn, prettyProp, fmt, CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass,
         sgToStructure, STRUCT_COLOR, STRUCT_ORDER } from '../lib/util'
import PairDetail from './PairDetail'

export default function PeriodicTable({ elements, pairs, groups, labels }) {
  const [mode, setMode] = useState('classify')   // 'classify' | 'heatmap'
  const [prop, setProp] = useState('ICOHP')
  const [selA, setSelA] = useState(null)
  const [selB, setSelB] = useState(null)
  const [hover, setHover] = useState(null)

  const cells = useMemo(() => Object.values(elements), [elements])

  // pair lookup
  const pairIdx = useMemo(() => {
    const m = {}
    pairs.forEach(p => { m[`${p.A}|${p.B}`] = p; m[`${p.B}|${p.A}`] = p })
    return m
  }, [pairs])
  const getPair = (a, b) => pairIdx[`${a}|${b}`] || null

  // heatmap normalization
  const { min, max } = useMemo(() => {
    let mn = Infinity, mx = -Infinity
    cells.forEach(e => { const v = e[prop]; if (v != null && !isNaN(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v) } })
    return { min: mn, max: mx }
  }, [cells, prop])
  const norm = v => (v == null || isNaN(v) || max === min) ? null : (v - min) / (max - min)

  function clickCell(sym) {
    if (mode === 'heatmap') { setSelA(sym); return }
    if (!selA) { setSelA(sym); setSelB(null) }
    else if (sym === selA) { setSelA(null); setSelB(null) }
    else { setSelB(sym) }
  }

  // cell background + label color
  function cellStyle(e) {
    const sym = e.symbol
    if (mode === 'heatmap') {
      const t = norm(e[prop]); return { bg: viridis(t), fg: textOn(t) }
    }
    // classify mode
    if (!selA) return { bg: e.has_data ? 'var(--cell-data)' : 'var(--cell)', fg: e.has_data ? 'var(--text)' : 'var(--dim)' }
    if (sym === selA) return { bg: '#0ea5e9', fg: '#04121f', ring: true }
    const pr = getPair(selA, sym)
    if (pr) {
      const labs = CLASSES.filter(c => pr.truth.includes(c))   // ordered iso,partial,immis,inter
      if (labs.length <= 1) return { bg: CLASS_COLOR[labs[0]] || '#39405c', fg: '#0b1020' }
      const n = labs.length
      const stops = labs.map((c, i) => `${CLASS_COLOR[c]} ${(i*100/n).toFixed(1)}% ${((i+1)*100/n).toFixed(1)}%`).join(', ')
      return { bg: `linear-gradient(135deg, ${stops})`, fg: '#0b1020' }
    }
    return { bg: 'var(--cell)', fg: 'var(--dim)' }
  }

  const selPair = (selA && selB) ? getPair(selA, selB) : null
  const detailEl = mode === 'heatmap' ? (selA && elements[selA]) : (hover && elements[hover])

  return (
    <div className="flex flex-col gap-4">
      {/* mode + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
          {['classify', 'heatmap'].map(m => (
            <button key={m} onClick={() => { setMode(m); setSelA(null); setSelB(null) }}
              className={`px-3 py-1.5 text-sm ${mode === m ? 'bg-sky-500/30 text-sky-200' : 'text-[var(--dim)] hover:bg-white/5'}`}>
              {m === 'classify' ? 'Classify by element' : 'Property heatmap'}
            </button>
          ))}
        </div>
        {mode === 'heatmap' ? (
          <>
            <select value={prop} onChange={e => setProp(e.target.value)}
              className="bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500 min-w-[240px]">
              {Object.entries(groups).map(([g, arr]) => (
                <optgroup key={g} label={g}>
                  {arr.map(p => <option key={p} value={p}>{prettyProp(p, labels)}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="flex items-center gap-2 ml-auto text-xs text-[var(--dim)]">
              <span>{Number.isFinite(min) ? fmt(min) : '–'}</span>
              <div className="h-3 w-36 rounded" style={{ background: `linear-gradient(90deg, ${[0,.25,.5,.75,1].map(viridis).join(',')})` }} />
              <span>{Number.isFinite(max) ? fmt(max) : '–'}</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-[var(--text)]">
            {!selA && <>Click an element to colour every other by its <b>binary phase behaviour</b> with it.</>}
            {selA && !selB && <>Showing <b className="text-sky-300">{selA}</b>–X classification — click another element for the <b>{selA}–X phase diagram</b>. <button className="ml-2 underline text-[var(--dim)]" onClick={() => setSelA(null)}>reset</button></>}
            {selA && selB && <><b className="text-sky-300">{selA}–{selB}</b> selected. <button className="ml-2 underline text-[var(--dim)]" onClick={() => { setSelA(null); setSelB(null) }}>reset</button></>}
          </div>
        )}
      </div>

      {/* legend (classify) */}
      {mode === 'classify' && (
        <div className="flex flex-wrap gap-3 text-xs text-[var(--text)]">
          {CLASSES.map(c => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ background: CLASS_COLOR[c] }} /> {CLASS_LABEL[c]}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[var(--dim)]"><span className="w-3 h-3 rounded bg-[var(--cell)]" /> no data</span>
          <span className="flex items-center gap-1.5 text-[var(--dim)]">
            <span className="w-3 h-3 rounded" style={{ background: `linear-gradient(135deg, ${CLASS_COLOR.partial} 0 50%, ${CLASS_COLOR.intermetallic} 50% 100%)` }} />
            split = coexisting behaviours (e.g. partial + intermetallic)
          </span>
        </div>
      )}

      {/* the table */}
      <div className="grid gap-[4px] overflow-x-auto pb-1" style={{ gridTemplateColumns: 'repeat(18, minmax(34px,1fr))' }}>
        {cells.map(e => {
          const st = cellStyle(e)
          const struct = sgToStructure(e['MAGPIE_SpaceGroupNumber'])
          const symColor = struct ? STRUCT_COLOR[struct] : st.fg
          return (
            <div key={e.symbol} className="elem-cell rounded-md p-1 select-none text-center"
              style={{ gridColumn: e.col, gridRow: e.row, background: st.bg,
                       outline: st.ring ? '2px solid #bae6fd' : 'none' }}
              onMouseEnter={() => setHover(e.symbol)} onMouseLeave={() => setHover(null)}
              onClick={() => clickCell(e.symbol)}
              title={`${e.symbol}${struct ? ' · ' + struct : ''}${mode === 'classify' && selA && getPair(selA, e.symbol) ? ` · ${selA}-${e.symbol}: ${getPair(selA, e.symbol).truth.join(', ') || '—'}` : ''}`}>
              <div className="text-[8px] leading-none" style={{ color: st.fg, opacity: .8 }}>{e.Z ?? ''}</div>
              <div className="font-semibold text-[12px] leading-tight"
                   style={{ color: symColor, textShadow: '0 0 2px rgba(0,0,0,.85), 0 1px 1px rgba(0,0,0,.6)' }}>{e.symbol}</div>
              {mode === 'heatmap' && <div className="text-[7px] leading-none" style={{ color: st.fg }}>{fmt(e[prop])}</div>}
            </div>
          )
        })}
        {/* f-block spacer label */}
        <div style={{ gridColumn: 3, gridRow: 6 }} className="rounded-md flex items-center justify-center text-[8px] text-slate-600">57–71</div>
        <div style={{ gridColumn: 3, gridRow: 7 }} className="rounded-md flex items-center justify-center text-[8px] text-slate-600">89–103</div>
      </div>

      {/* structure legend (symbol text colour) */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--dim)]">
        <span className="uppercase tracking-wide">Symbol colour = ground-state structure:</span>
        {STRUCT_ORDER.map(s => (
          <span key={s} className="font-semibold" style={{ color: STRUCT_COLOR[s], textShadow: '0 0 2px rgba(0,0,0,.7)' }}>{s}</span>
        ))}
      </div>

      {/* detail area */}
      {mode === 'classify' && selPair && (
        <div className="mt-2"><PairDetail pair={selPair} allPairs={pairs} /></div>
      )}
      {mode === 'classify' && selA && !selB && (
        <div className="card p-4 text-[var(--dim)] text-sm">
          Coloured cells are elements with a hand-verified <b>{selA}</b>–X phase diagram in the 610-pair set.
          Grey = no diagram for that combination. Click a coloured element to open its phase diagram, descriptors and prediction.
        </div>
      )}
      {mode === 'heatmap' && (
        <div className="card glow p-4 max-w-md">
          {detailEl ? <ElementCard e={detailEl} labels={labels} /> :
            <div className="text-[var(--dim)] text-sm">Hover an element for its properties; the table is coloured by <b>{prettyProp(prop, labels)}</b>.</div>}
        </div>
      )}
    </div>
  )
}

function ElementCard({ e, labels }) {
  const rows = [
    ['Metallic radius (Å)', e.r_metallic], ['Allred–Rochow EN', e.EN_allred_rochow],
    ['|ICOHP| (eV/bond)', e.ICOHP], ['ICOBI', e.ICOBI],
    ['Melting T (K)', e['MAGPIE_MeltingT']], ['1st ionization (eV)', e['JARVIS_first_ion_en']],
    ['Electron affinity (eV)', e['JARVIS_elec_aff']], ['Thermal cond. (W/mK)', e['JARVIS_therm_cond']],
  ]
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold">{e.symbol}</span>
        <span className="text-[var(--dim)] text-sm">Z={e.Z ?? '–'}</span>
        {!e.has_data && <span className="ml-auto text-[10px] text-amber-500/80">no COMPASS descriptors</span>}
      </div>
      <table className="w-full text-xs"><tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-t border-[#222a44]">
            <td className="py-1 text-[var(--dim)]">{k}</td>
            <td className="py-1 text-right font-mono">{fmt(v)}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}
