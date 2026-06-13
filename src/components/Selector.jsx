import React, { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL } from '../lib/util'

// Requirement-driven alloy selector. A metallurgist states a need in plain words
// ("immiscible with Fe, light and stiff, cheap"); we parse it into structured
// constraints, filter the 610 systems on their phase class + elemental-bound
// properties, rank by the stated preferences, and explain each hit.
// The parser is deterministic (no API key needed); an LLM explainer can later
// replace `explain()` behind the same signature.

const PROP_SYN = {
  density:           { high: ['dense', 'heavy'], low: ['light', 'lightweight', 'low density'] },
  youngs_modulus_GPa:{ high: ['stiff', 'rigid', 'high modulus', 'high stiffness'], low: ['compliant', 'flexible'] },
  JARVIS_therm_cond: { high: ['conductive', 'high thermal', 'heat conducting'], low: ['insulating', 'low thermal'] },
  JARVIS_mp:         { high: ['refractory', 'high melting', 'high temperature', 'heat resistant'], low: ['low melting', 'fusible'] },
  UTS_MPa:           { high: ['strong', 'high strength', 'tough'], low: ['weak'] },
  Price_USD_kg:      { high: ['expensive', 'precious'], low: ['cheap', 'low cost', 'inexpensive', 'affordable', 'low price'] },
}
const CLASS_SYN = {
  isomorphous:  ['isomorphous', 'solid solution', 'fully miscible', 'fully soluble'],
  partial:      ['partial', 'partially soluble', 'limited solubility'],
  immiscible:   ['immiscible', 'insoluble', 'phase separat'],
  intermetallic:['intermetallic', 'compound', 'ordered phase', 'line compound'],
}

function parseQuery(text, elements, axes) {
  const t = ' ' + text.toLowerCase() + ' '
  const classes = CLASSES.filter(c => CLASS_SYN[c].some(s => t.includes(s)))
  const prefs = {} // axis -> 'high' | 'low'
  for (const [axis, syn] of Object.entries(PROP_SYN)) {
    if (syn.high.some(s => t.includes(s))) prefs[axis] = 'high'
    else if (syn.low.some(s => t.includes(s))) prefs[axis] = 'low'
  }
  // element: match symbol as a whole token (case-insensitive), or full element name
  const tokens = text.split(/[^A-Za-z]+/).filter(Boolean).map(s => s.toLowerCase())
  let element = null
  for (const sym of Object.keys(elements)) {
    if (!elements[sym].has_data) continue
    if (tokens.includes(sym.toLowerCase())) { element = sym; break }
  }
  if (!element) {
    const low = text.toLowerCase()
    for (const sym of Object.keys(elements)) {
      if (!elements[sym].has_data) continue
      const nm = (elements[sym].name || '').toLowerCase()
      if (nm && new RegExp(`\\b${nm}\\b`).test(low)) { element = sym; break }
    }
  }
  return { classes, prefs, element }
}

function scorePair(p, q) {
  // hard filters
  if (q.element && p.A !== q.element && p.B !== q.element) return null
  if (q.classes.length && !q.classes.some(c => p.truth.includes(c))) return null
  // soft score from preferences using elemental bounds
  let score = 0, used = 0
  for (const [axis, dir] of Object.entries(q.prefs)) {
    const b = p.props?.[axis]
    if (!b) continue
    used++
    // best attainable value in the system for that direction
    score += dir === 'high' ? b.max : -b.min
  }
  return { score, used }
}

function explain(p, q, axes) {
  const bits = []
  if (q.element) bits.push(`contains ${q.element}`)
  const matched = q.classes.filter(c => p.truth.includes(c))
  if (matched.length) bits.push(matched.map(c => CLASS_LABEL[c].toLowerCase()).join(' + '))
  for (const [axis, dir] of Object.entries(q.prefs)) {
    const b = p.props?.[axis]; if (!b) continue
    const v = dir === 'high' ? b.max : b.min
    bits.push(`${dir} ${axes[axis].label.toLowerCase()} (${v} ${axes[axis].unit})`)
  }
  return bits.join(' · ')
}

export default function Selector({ pairs, elements, axes }) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState('')

  const q = useMemo(
    () => submitted ? parseQuery(submitted, elements, axes) : null,
    [submitted, elements, axes])

  const results = useMemo(() => {
    if (!q) return null
    const scored = []
    for (const p of pairs) {
      const s = scorePair(p, q)
      if (s) scored.push({ p, ...s })
    }
    const anyPref = Object.keys(q.prefs).length > 0
    scored.sort((a, b) => anyPref ? b.score - a.score : a.p.pair.localeCompare(b.p.pair))
    return scored
  }, [q, pairs])

  const examples = [
    'immiscible with Fe, light and stiff',
    'intermetallic, refractory and strong',
    'cheap isomorphous system',
    'partial solubility with Al, low density',
  ]

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={e => { e.preventDefault(); setSubmitted(text) }}
        className="card glow p-4 flex flex-col gap-3">
        <label className="text-sm text-[var(--dim)]">Describe what you need</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
            <input value={text} onChange={e => setText(e.target.value)}
              placeholder="e.g. immiscible with Fe, lightweight, cheap"
              className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <button type="submit"
            className="px-4 py-2 rounded-lg bg-sky-500/20 text-sky-300 text-sm hover:bg-sky-500/30">
            Search
          </button>
          {submitted && (
            <button type="button" onClick={() => { setText(''); setSubmitted('') }}
              className="px-3 py-2 rounded-lg text-[var(--dim)] hover:bg-white/5 text-sm flex items-center gap-1">
              <X size={14} /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-[var(--dim)]">Try:</span>
          {examples.map(ex => (
            <button key={ex} type="button" onClick={() => { setText(ex); setSubmitted(ex) }}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[var(--dim)]">{ex}</button>
          ))}
        </div>
      </form>

      {q && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--dim)]">Parsed:</span>
          {q.element && <Chip>element = {q.element}</Chip>}
          {q.classes.map(c => <Chip key={c} color={CLASS_COLOR[c]}>{CLASS_LABEL[c]}</Chip>)}
          {Object.entries(q.prefs).map(([a, d]) => <Chip key={a}>{d} {axes[a].label}</Chip>)}
          {!q.element && !q.classes.length && !Object.keys(q.prefs).length &&
            <span className="text-amber-400">nothing recognised — try the examples</span>}
        </div>
      )}

      {results && (
        <div className="text-sm text-[var(--dim)]">{results.length} matching system{results.length !== 1 ? 's' : ''}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results && results.slice(0, 40).map(({ p }) => (
          <div key={p.pair} className="card p-3 flex gap-3">
            <img src={`./phase/${p.phase_img}`} alt={p.pair}
              className="w-28 h-24 object-contain bg-white rounded shrink-0" loading="lazy" />
            <div className="min-w-0">
              <div className="font-semibold">{p.pair}</div>
              <div className="flex flex-wrap gap-1 my-1">
                {p.truth.map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px]"
                    style={{ background: CLASS_COLOR[c] + '33', color: CLASS_COLOR[c] }}>
                    {CLASS_LABEL[c]}
                  </span>
                ))}
              </div>
              <div className="text-xs text-[var(--dim)] leading-snug">{explain(p, q, axes)}</div>
            </div>
          </div>
        ))}
      </div>
      {results && results.length > 40 &&
        <div className="text-xs text-[var(--dim)]">showing top 40 of {results.length}</div>}
    </div>
  )
}

function Chip({ children, color }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px]"
      style={{ background: (color || '#64748b') + '26', color: color || '#cbd5e1' }}>
      {children}
    </span>
  )
}
