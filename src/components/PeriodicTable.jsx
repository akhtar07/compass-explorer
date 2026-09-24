import React, { useMemo, useState } from 'react'
import { Grid3x3, ArrowUpRight, RotateCcw, Atom } from 'lucide-react'
import { viridis, textOn, prettyProp, fmt, CLASSES, CLASS_COLOR, CLASS_LABEL,
         sgToStructure, STRUCT_COLOR, STRUCT_ORDER } from '../lib/util'
import { useApp } from '../lib/app'
import PairDetail from './PairDetail'

export default function PeriodicTable({ elements, pairs, groups, labels, dft }) {
  const { openPair } = useApp()
  const [mode, setMode] = useState('classify')   // 'classify' | 'heatmap'
  const [prop, setProp] = useState('ICOHP')
  const [selA, setSelA] = useState(null)
  const [selB, setSelB] = useState(null)
  const [hover, setHover] = useState(null)

  const cells = useMemo(() => Object.values(elements), [elements])

  // pair lookup + per-element partner statistics (partner count, class mix)
  const pairIdx = useMemo(() => {
    const m = {}
    pairs.forEach(p => { m[`${p.A}|${p.B}`] = p; m[`${p.B}|${p.A}`] = p })
    return m
  }, [pairs])
  const getPair = (a, b) => pairIdx[`${a}|${b}`] || null
  const elStats = useMemo(() => {
    const m = {}
    const blank = () => ({ n: 0, mix: { isomorphous: 0, partial: 0, immiscible: 0, intermetallic: 0 }, partners: [], nStable: 0 })
    pairs.forEach(p => {
      for (const [me, other] of [[p.A, p.B], [p.B, p.A]]) {
        const s = m[me] || (m[me] = blank())
        s.n++; s.partners.push(other); s.nStable += dft?.[p.pair]?.n_stable || 0
        p.truth.forEach(t => { if (s.mix[t] != null) s.mix[t]++ })
      }
    })
    Object.values(m).forEach(s => s.partners.sort())
    return m
  }, [pairs, dft])

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
    if (!selA) return { bg: e.has_data ? 'var(--cell-data)' : 'var(--cell)', fg: e.has_data ? 'var(--text)' : 'var(--dim)' }
    if (sym === selA) return { bg: 'var(--accent)', fg: '#04121f', ring: true }
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
  const sideSym = mode === 'classify' ? (selA || hover) : null
  const sideEl = sideSym ? elements[sideSym] : null
  const reset = () => { setSelA(null); setSelB(null) }

  return (
    <div className="flex flex-col gap-4">
      {/* mode + controls */}
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[.12em] text-[var(--dim)]"><Grid3x3 size={13} className="text-[var(--accent)]" /> Periodic table · {mode === 'classify' ? 'binary phase behaviour by element' : 'element property heatmap'}</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="seg">
            <button className={mode === 'classify' ? 'on' : ''} onClick={() => { setMode('classify'); reset() }}>Classify by element</button>
            <button className={mode === 'heatmap' ? 'on' : ''} onClick={() => { setMode('heatmap'); reset() }}>Property heatmap</button>
          </div>
          {mode === 'heatmap' ? (
            <>
              <select className="sel min-w-[240px]" value={prop} onChange={e => setProp(e.target.value)}>
                {Object.entries(groups).map(([g, arr]) => (
                  <optgroup key={g} label={g}>
                    {arr.map(p => <option key={p} value={p}>{prettyProp(p, labels)}</option>)}
                  </optgroup>
                ))}
              </select>
              <div className="flex items-center gap-2 ml-auto text-xs text-[var(--dim)] mono">
                <span>{Number.isFinite(min) ? fmt(min) : '–'}</span>
                <div className="h-3 w-36 rounded" style={{ background: `linear-gradient(90deg, ${[0,.25,.5,.75,1].map(viridis).join(',')})` }} />
                <span>{Number.isFinite(max) ? fmt(max) : '–'}</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--text)] flex items-center gap-2 flex-wrap">
              {!selA && <>Click an element to colour every other by its <b>binary phase behaviour</b> with it. Hover for its partner statistics.</>}
              {selA && !selB && <>Showing <b className="text-[var(--accent)]">{selA}</b>–X classification — click another element for the <b>{selA}–X phase diagram</b>.</>}
              {selA && selB && <><b className="text-[var(--accent)]">{selA}–{selB}</b> selected.</>}
              {selA && <button className="pill hover:border-[var(--border-strong)]" onClick={reset}><RotateCcw size={11} /> reset</button>}
            </div>
          )}
        </div>
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
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* the table */}
        <div className="flex-1 min-w-0 w-full">
          <div className="grid gap-[4px] overflow-x-auto pb-1" style={{ gridTemplateColumns: 'repeat(18, minmax(34px,1fr))' }}>
            {cells.map(e => {
              const st = cellStyle(e)
              const struct = sgToStructure(e['MAGPIE_SpaceGroupNumber'])
              const symColor = struct ? STRUCT_COLOR[struct] : st.fg
              return (
                <div key={e.symbol} className="elem-cell rounded-md p-1 select-none text-center"
                  style={{ gridColumn: e.col, gridRow: e.row, background: st.bg,
                           outline: st.ring ? '2px solid var(--text)' : 'none' }}
                  onMouseEnter={() => setHover(e.symbol)} onMouseLeave={() => setHover(null)}
                  onClick={() => clickCell(e.symbol)}
                  title={`${e.symbol}${struct ? ' · ' + struct : ''}${mode === 'classify' && selA && getPair(selA, e.symbol) ? ` · ${selA}-${e.symbol}: ${getPair(selA, e.symbol).truth.join(', ') || '—'}` : ''}`}>
                  <div className="text-[8px] leading-none" style={{ color: st.fg, opacity: .8 }}>{e.Z ?? ''}</div>
                  <div className="font-semibold text-[12px] leading-tight"
                       style={{ color: symColor, textShadow: '0 0 2px rgba(0,0,0,.85), 0 1px 1px rgba(0,0,0,.6)' }}>{e.symbol}</div>
                  {mode === 'heatmap' && <div className="text-[7px] leading-none mono" style={{ color: st.fg }}>{fmt(e[prop])}</div>}
                </div>
              )
            })}
            {/* f-block spacer label */}
            <div style={{ gridColumn: 3, gridRow: 6 }} className="rounded-md flex items-center justify-center text-[8px] text-[var(--faint)]">57–71</div>
            <div style={{ gridColumn: 3, gridRow: 7 }} className="rounded-md flex items-center justify-center text-[8px] text-[var(--faint)]">89–103</div>
          </div>
          {/* structure legend (symbol text colour) */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--dim)] mt-2">
            <span className="uppercase tracking-wide">Symbol colour = ground-state structure:</span>
            {STRUCT_ORDER.map(s => (
              <span key={s} className="font-semibold" style={{ color: STRUCT_COLOR[s], textShadow: '0 0 2px rgba(0,0,0,.7)' }}>{s}</span>
            ))}
          </div>
        </div>

        {/* side card */}
        {mode === 'classify' && (
          <div className="card glow p-4 w-full xl:w-[300px] shrink-0 min-h-[160px]">
            {sideEl ? <ElementStats e={sideEl} stats={elStats[sideEl.symbol]} selected={!!selA} selB={selB} onPick={sym => { if (selA) setSelB(sym) }} />
              : <div className="text-[var(--dim)] text-sm flex items-start gap-2"><Atom size={16} className="shrink-0 mt-0.5 opacity-60" /> Hover an element to see how many ground-truth binaries it appears in and their class mix.</div>}
          </div>
        )}
        {mode === 'heatmap' && (
          <div className="card glow p-4 w-full xl:w-[300px] shrink-0">
            {detailEl ? <ElementCard e={detailEl} labels={labels} /> :
              <div className="text-[var(--dim)] text-sm">Hover or click an element for its properties; the table is coloured by <b>{prettyProp(prop, labels)}</b>.</div>}
          </div>
        )}
      </div>

      {/* detail area */}
      {mode === 'classify' && selPair && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-extrabold tracking-tight">{selPair.A}–{selPair.B}</h3>
            <button onClick={() => openPair(selPair.pair)} className="pill hover:border-[var(--border-strong)]" style={{ color: 'var(--accent)' }}>Open full page <ArrowUpRight size={12} /></button>
          </div>
          <PairDetail pair={selPair} allPairs={pairs} dft={dft} />
        </div>
      )}
      {mode === 'classify' && selA && selB && !selPair && (
        <div className="card p-4 text-[var(--dim)] text-sm">No ground-truth phase diagram for <b>{selA}–{selB}</b> in the 970-pair set. Pick a coloured element instead.</div>
      )}
      {mode === 'classify' && selA && !selB && (
        <div className="card p-4 text-[var(--dim)] text-sm">
          Coloured cells are elements with a ground-truth <b>{selA}</b>–X phase diagram in the 970-pair set.
          Grey = no diagram for that combination. Click a coloured element (or a partner chip in the side card) to open its phase diagram, descriptors and prediction.
        </div>
      )}
    </div>
  )
}

function ElementStats({ e, stats, selected, selB, onPick }) {
  const s = stats || { n: 0, mix: { isomorphous: 0, partial: 0, immiscible: 0, intermetallic: 0 }, partners: [], nStable: 0 }
  const tot = CLASSES.reduce((a, c) => a + s.mix[c], 0) || 1
  return (
    <div className="fade-up">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-extrabold">{e.symbol}</span>
        <span className="text-[var(--dim)] text-sm">{e.name || ''} · Z=<span className="mono">{e.Z ?? '–'}</span></span>
      </div>
      <div className="flex gap-3 mt-2">
        <div className="stat flex-1 py-2"><div className="v mono">{s.n}</div><div className="k">ground-truth partners</div></div>
        <div className="stat flex-1 py-2"><div className="v mono">{s.nStable}</div><div className="k">DFT-stable compounds</div></div>
      </div>
      {s.n > 0 ? (
        <>
          <div className="k text-[11px] text-[var(--dim)] mt-3 mb-1">class mix of its systems (multi-label)</div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--cell)]">
            {CLASSES.map(c => s.mix[c] > 0 && <span key={c} title={`${CLASS_LABEL[c]}: ${s.mix[c]}`} style={{ width: `${s.mix[c] / tot * 100}%`, background: CLASS_COLOR[c] }} />)}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[10.5px]">
            {CLASSES.map(c => <span key={c} style={{ color: CLASS_COLOR[c] }}>● {CLASS_LABEL[c]} <span className="mono">{s.mix[c]}</span></span>)}
          </div>
          <div className="k text-[11px] text-[var(--dim)] mt-3 mb-1">{selected ? 'partners — click to open the pair' : 'partners'}</div>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
            {s.partners.map(p => (
              <button key={p} onClick={() => onPick(p)} disabled={!selected}
                className="badge mono hover:border-[var(--accent)]"
                style={{ background: p === selB ? 'var(--accent)' : 'var(--panel2)', color: p === selB ? '#0b1020' : 'var(--text)', border: '1px solid var(--border)', cursor: selected ? 'pointer' : 'default' }}>{p}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[var(--dim)] text-xs mt-3">{e.has_data ? 'No ground-truth binaries in the 970-pair set.' : 'No COMPASS descriptors for this element.'}</div>
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
    <div className="fade-up">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-extrabold">{e.symbol}</span>
        <span className="text-[var(--dim)] text-sm">{e.name || ''} · Z=<span className="mono">{e.Z ?? '–'}</span></span>
        {!e.has_data && <span className="ml-auto text-[10px]" style={{ color: '#d97706' }}>no COMPASS descriptors</span>}
      </div>
      <table className="tbl"><tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="text-[var(--dim)]">{k}</td>
            <td className="num">{fmt(v)}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}
