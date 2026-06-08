import React, { useMemo, useState } from 'react'
import { viridis, textOn, prettyProp } from '../lib/util'

export default function PeriodicTable({ elements, groups }) {
  const propList = useMemo(() => {
    const out = []
    for (const [grp, arr] of Object.entries(groups)) arr.forEach(p => out.push({ p, grp }))
    return out
  }, [groups])

  const [prop, setProp] = useState('ICOHP')
  const [hover, setHover] = useState(null)
  const [selected, setSelected] = useState(null)

  const { min, max, vals } = useMemo(() => {
    const vals = {}
    let mn = Infinity, mx = -Infinity
    Object.values(elements).forEach(e => {
      const v = e[prop]
      vals[e.symbol] = v
      if (v != null && !isNaN(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v) }
    })
    return { min: mn, max: mx, vals }
  }, [elements, prop])

  const norm = v => (v == null || isNaN(v) || max === min) ? null : (v - min) / (max - min)
  const defined = Object.values(vals).filter(v => v != null && !isNaN(v))
  const mean = defined.length ? defined.reduce((a, b) => a + b, 0) / defined.length : null

  const detail = selected ? elements[selected] : null

  return (
    <div className="flex flex-col gap-4">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">Color elements by</label>
        <select value={prop} onChange={e => setProp(e.target.value)}
          className="bg-[#141b30] border border-[#2a3350] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 min-w-[260px]">
          {Object.entries(groups).map(([grp, arr]) => (
            <optgroup key={grp} label={grp}>
              {arr.map(p => <option key={p} value={p}>{prettyProp(p)}</option>)}
            </optgroup>
          ))}
        </select>
        {/* legend */}
        <div className="flex items-center gap-2 ml-auto text-xs text-slate-400">
          <span>{Number.isFinite(min) ? min.toFixed(2) : '–'}</span>
          <div className="h-3 w-40 rounded" style={{
            background: `linear-gradient(90deg, ${[0,.25,.5,.75,1].map(t=>viridis(t)).join(',')})`
          }} />
          <span>{Number.isFinite(max) ? max.toFixed(2) : '–'}</span>
          {mean != null && <span className="ml-2">μ={mean.toFixed(2)}</span>}
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        {/* the table */}
        <div className="grid gap-[5px] flex-1 min-w-[640px]"
          style={{ gridTemplateColumns: 'repeat(18, minmax(0,1fr))' }}>
          {Object.values(elements).map(e => {
            const t = norm(e[prop])
            const bg = viridis(t)
            return (
              <div key={e.symbol}
                className="elem-cell rounded-md p-1 select-none"
                style={{ gridColumn: e.group, gridRow: e.row, background: bg,
                         outline: selected === e.symbol ? '2px solid #93c5fd' : 'none' }}
                onMouseEnter={() => setHover(e.symbol)} onMouseLeave={() => setHover(null)}
                onClick={() => setSelected(e.symbol)}>
                <div className="text-[9px] leading-none" style={{ color: textOn(t) }}>{e.Z}</div>
                <div className="font-semibold text-[13px] leading-tight" style={{ color: textOn(t) }}>{e.symbol}</div>
                <div className="text-[8px] leading-none" style={{ color: textOn(t) }}>
                  {e[prop] == null ? '–' : (Math.abs(e[prop]) >= 100 ? e[prop].toFixed(0) : e[prop].toFixed(2))}
                </div>
              </div>
            )
          })}
        </div>

        {/* detail card */}
        <div className="card glow p-4 w-[280px] shrink-0">
          {detail ? (
            <ElementDetail e={detail} />
          ) : hover ? (
            <ElementDetail e={elements[hover]} hint />
          ) : (
            <div className="text-slate-400 text-sm">
              Hover an element to preview, click to pin its full property card.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ElementDetail({ e, hint }) {
  const rows = [
    ['Metallic radius (Å)', e.r_metallic],
    ['Harrison r_d (Å)', e.r_d],
    ['Electronegativity (A-R)', e.EN_allred_rochow],
    ['Valence s/p/d', `${e.valence_s}/${e.valence_p}/${e.valence_d}`],
    ['|ICOHP| (eV/bond)', e.ICOHP],
    ['ICOBI', e.ICOBI],
    ['Melting T (K)', e['MAGPIE_MagpieData mean MeltingT']],
    ['GS volume (Å³/at)', e['MAGPIE_MagpieData mean GSvolume_pa']],
    ['Mendeleev #', e['MAGPIE_MagpieData mean MendeleevNumber']],
  ]
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold">{e.symbol}</span>
        <span className="text-slate-400 text-sm">Z={e.Z} · grp {e.group} · period {e.row}</span>
        {hint && <span className="ml-auto text-[10px] text-slate-500">preview</span>}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-[#222a44]">
              <td className="py-1 text-slate-400">{k}</td>
              <td className="py-1 text-right font-mono">
                {v == null ? '–' : (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3)) : v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
