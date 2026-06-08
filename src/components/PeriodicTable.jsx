import React, { useMemo, useState } from 'react'
import { viridis, textOn, prettyProp, fmt, CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'
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
    if (!selA) return { bg: e.has_data ? '#27314f' : '#161d33', fg: e.has_data ? '#dbe2f7' : '#5b6684' }
    if (sym === selA) return { bg: '#0ea5e9', fg: '#04121f', ring: true }
    const pr = getPair(selA, sym)
    if (pr) { const c = dominantClass(pr.truth); return { bg: CLASS_COLOR[c] || '#39405c', fg: '#0b1020' } }
    return { bg: '#141a2e', fg: '#3c4663' }
  }

  const selPair = (selA && selB) ? getPair(selA, selB) : null
  const detailEl = mode === 'heatmap' ? (selA && elements[selA]) : (hover && elements[hover])

  return (
    <div className="flex flex-col gap-4">
      {/* mode + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-[#2a3350]">
          {['classify', 'heatmap'].map(m => (
            <button key={m} onClick={() => { setMode(m); setSelA(null); setSelB(null) }}
              className={`px-3 py-1.5 text-sm ${mode === m ? 'bg-sky-500/30 text-sky-200' : 'text-slate-400 hover:bg-white/5'}`}>
              {m === 'classify' ? 'Classify by element' : 'Property heatmap'}
            </button>
          ))}
        </div>
        {mode === 'heatmap' ? (
          <>
            <select value={prop} onChange={e => setProp(e.target.value)}
              className="bg-[#141b30] border border-[#2a3350] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500 min-w-[240px]">
              {Object.entries(groups).map(([g, arr]) => (
                <optgroup key={g} label={g}>
                  {arr.map(p => <option key={p} value={p}>{prettyProp(p, labels)}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="flex items-center gap-2 ml-auto text-xs text-slate-400">
              <span>{Number.isFinite(min) ? fmt(min) : '–'}</span>
              <div className="h-3 w-36 rounded" style={{ background: `linear-gradient(90deg, ${[0,.25,.5,.75,1].map(viridis).join(',')})` }} />
              <span>{Number.isFinite(max) ? fmt(max) : '–'}</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-300">
            {!selA && <>Click an element to colour every other by its <b>binary phase behaviour</b> with it.</>}
            {selA && !selB && <>Showing <b className="text-sky-300">{selA}</b>–X classification — click another element for the <b>{selA}–X phase diagram</b>. <button className="ml-2 underline text-slate-400" onClick={() => setSelA(null)}>reset</button></>}
            {selA && selB && <><b className="text-sky-300">{selA}–{selB}</b> selected. <button className="ml-2 underline text-slate-400" onClick={() => { setSelA(null); setSelB(null) }}>reset</button></>}
          </div>
        )}
      </div>

      {/* legend (classify) */}
      {mode === 'classify' && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          {CLASSES.map(c => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ background: CLASS_COLOR[c] }} /> {CLASS_LABEL[c]}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-slate-500"><span className="w-3 h-3 rounded bg-[#141a2e]" /> no data</span>
        </div>
      )}

      {/* the table */}
      <div className="grid gap-[4px] overflow-x-auto pb-1" style={{ gridTemplateColumns: 'repeat(18, minmax(34px,1fr))' }}>
        {cells.map(e => {
          const st = cellStyle(e)
          return (
            <div key={e.symbol} className="elem-cell rounded-md p-1 select-none text-center"
              style={{ gridColumn: e.col, gridRow: e.row, background: st.bg,
                       outline: st.ring ? '2px solid #bae6fd' : 'none' }}
              onMouseEnter={() => setHover(e.symbol)} onMouseLeave={() => setHover(null)}
              onClick={() => clickCell(e.symbol)}
              title={mode === 'classify' && selA && getPair(selA, e.symbol)
                ? `${selA}-${e.symbol}: ${getPair(selA, e.symbol).truth.join(', ') || '—'}` : e.symbol}>
              <div className="text-[8px] leading-none" style={{ color: st.fg, opacity: .8 }}>{e.Z ?? ''}</div>
              <div className="font-semibold text-[12px] leading-tight" style={{ color: st.fg }}>{e.symbol}</div>
              {mode === 'heatmap' && <div className="text-[7px] leading-none" style={{ color: st.fg }}>{fmt(e[prop])}</div>}
            </div>
          )
        })}
        {/* f-block spacer label */}
        <div style={{ gridColumn: 3, gridRow: 6 }} className="rounded-md flex items-center justify-center text-[8px] text-slate-600">57–71</div>
        <div style={{ gridColumn: 3, gridRow: 7 }} className="rounded-md flex items-center justify-center text-[8px] text-slate-600">89–103</div>
      </div>

      {/* detail area */}
      {mode === 'classify' && selPair && (
        <div className="mt-2"><PairDetail pair={selPair} allPairs={pairs} /></div>
      )}
      {mode === 'classify' && selA && !selB && (
        <div className="card p-4 text-slate-400 text-sm">
          Coloured cells are elements with a hand-verified <b>{selA}</b>–X phase diagram in the 610-pair set.
          Grey = no diagram for that combination. Click a coloured element to open its phase diagram, descriptors and prediction.
        </div>
      )}
      {mode === 'heatmap' && (
        <div className="card glow p-4 max-w-md">
          {detailEl ? <ElementCard e={detailEl} labels={labels} /> :
            <div className="text-slate-400 text-sm">Hover an element for its properties; the table is coloured by <b>{prettyProp(prop, labels)}</b>.</div>}
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
        <span className="text-slate-400 text-sm">Z={e.Z ?? '–'}</span>
        {!e.has_data && <span className="ml-auto text-[10px] text-amber-500/80">no COMPASS descriptors</span>}
      </div>
      <table className="w-full text-xs"><tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-t border-[#222a44]">
            <td className="py-1 text-slate-400">{k}</td>
            <td className="py-1 text-right font-mono">{fmt(v)}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}
