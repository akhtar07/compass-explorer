import React, { useMemo, useState } from 'react'
import { Search, X, ArrowLeft, Atom, FlaskConical, Boxes, Gem } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL } from '../lib/util'
import PairDetail from './PairDetail'

// ONE-STOP SEARCH. Type anything — an element ("La" / "lanthanum"), a pair
// ("Al-La"), a phase behaviour ("immiscible", "forms compounds"), a property
// need ("light and stiff, cheap"), or a compound formula ("AlAg2") — and get
// ranked rich cards (truth class + MAGPIE prediction + multi-source DFT badges
// + phase thumbnail). Click a card for the full PairDetail. The parser is
// deterministic (no API key); it layers every recognised intent additively
// rather than forcing one interpretation.

const PROP_SYN = {
  density:           { high: ['dense', 'heavy', 'high density'], low: ['light', 'lightweight', 'low density'] },
  youngs_modulus_GPa:{ high: ['stiff', 'rigid', 'high modulus', 'high stiffness'], low: ['compliant', 'flexible'] },
  specific_stiffness:{ high: ['specific stiffness', 'stiffness-to-weight', 'light and stiff'], low: [] },
  JARVIS_therm_cond: { high: ['conductive', 'high thermal', 'heat conducting', 'thermally conductive'], low: ['insulating', 'low thermal'] },
  JARVIS_mp:         { high: ['refractory', 'high melting', 'high temperature', 'heat resistant'], low: ['low melting', 'fusible'] },
  UTS_MPa:           { high: ['strong', 'high strength', 'tough'], low: ['weak', 'low strength'] },
  Price_USD_kg:      { high: ['expensive', 'precious'], low: ['cheap', 'low cost', 'inexpensive', 'affordable', 'low price'] },
}
const CLASS_SYN = {
  isomorphous:  ['isomorphous', 'solid solution', 'fully miscible', 'fully soluble', 'complete solubility'],
  partial:      ['partial', 'partially soluble', 'limited solubility'],
  immiscible:   ['immiscible', 'insoluble', 'phase separat', 'does not mix'],
  intermetallic:['intermetallic', 'compound', 'ordered phase', 'line compound', 'forms compound'],
}

// "AlAg2" -> ['Al','Ag'] ; ignores stoichiometric subscripts
function formulaElements(tok, validSyms) {
  const out = []
  const re = /([A-Z][a-z]?)(\d*\.?\d*)/g
  let m
  while ((m = re.exec(tok)) !== null) {
    if (validSyms.has(m[1]) && !out.includes(m[1])) out.push(m[1])
  }
  return out
}

function parseQuery(text, elements, axes, dft) {
  const t = ' ' + text.toLowerCase() + ' '
  const validSyms = new Set(Object.keys(elements).filter(s => elements[s].has_data))
  const nameToSym = {}
  for (const s of Object.keys(elements)) {
    const nm = (elements[s].name || '').toLowerCase()
    if (nm) nameToSym[nm] = s
  }

  // phase classes
  const classes = CLASSES.filter(c => CLASS_SYN[c].some(s => t.includes(s)))

  // property preferences
  const prefs = {}
  for (const [axis, syn] of Object.entries(PROP_SYN)) {
    if (syn.high.some(s => s && t.includes(s))) prefs[axis] = 'high'
    else if (syn.low.some(s => s && t.includes(s))) prefs[axis] = 'low'
  }

  // "forms compounds" intent (DFT-stable compounds exist)
  const formsCompounds = /\b(forms? (a )?compound|forms? compounds|stable compound|intermetallic compound|has compounds)\b/.test(t)

  // explicit elements: symbols as whole tokens, then element names
  const rawTokens = text.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const els = []
  for (const tk of rawTokens) {
    const cap = tk.charAt(0).toUpperCase() + tk.slice(1).toLowerCase()
    if (validSyms.has(cap) && !els.includes(cap)) els.push(cap)
  }
  for (const tk of rawTokens) {
    const sym = nameToSym[tk.toLowerCase()]
    if (sym && !els.includes(sym)) els.push(sym)
  }

  // compound formula: a single CamelCase-with-digits token that decodes to >=2 valid symbols
  let formula = null, formulaEls = []
  for (const tk of rawTokens) {
    if (els.includes(tk)) continue
    const fe = formulaElements(tk, validSyms)
    if (fe.length >= 2 && /[a-z0-9]/.test(tk)) { formula = tk; formulaEls = fe; break }
  }

  return { classes, prefs, formsCompounds, els, formula, formulaEls, raw: text.trim() }
}

// Returns {score, reasons[]} or null if a hard filter rejects the pair.
function scorePair(p, q, dft) {
  const reasons = []
  const setEls = new Set([p.A, p.B])
  const d = dft?.[p.pair]

  // hard: explicit element(s) — 2 means a specific pair, 1 means "contains"
  if (q.formulaEls.length >= 2) {
    if (!q.formulaEls.every(e => setEls.has(e))) return null
    reasons.push(`compound ${q.formula}`)
  } else if (q.els.length >= 2) {
    if (!q.els.slice(0, 2).every(e => setEls.has(e))) return null
    reasons.push(`${q.els[0]}–${q.els[1]} system`)
  } else if (q.els.length === 1) {
    if (!setEls.has(q.els[0])) return null
    reasons.push(`contains ${q.els[0]}`)
  }

  // hard: phase class
  if (q.classes.length) {
    if (!q.classes.some(c => p.truth.includes(c))) return null
    reasons.push(q.classes.filter(c => p.truth.includes(c)).map(c => CLASS_LABEL[c].toLowerCase()).join(' + '))
  }

  // hard: forms DFT-stable compounds
  if (q.formsCompounds) {
    if (!d || !(d.n_stable > 0)) return null
    reasons.push(`${d.n_stable} DFT-stable compound${d.n_stable !== 1 ? 's' : ''}`)
  }

  // soft: property preferences over elemental bounds
  let score = 0
  for (const [axis, dir] of Object.entries(q.prefs)) {
    const b = p.props?.[axis]
    if (!b) continue
    score += dir === 'high' ? b.max : -b.min
    reasons.push(`${dir} ${axis.replace(/_GPa|_MPa|_USD_kg|JARVIS_/g, '').replace(/_/g, ' ')}`)
  }

  // tie-breakers / generic relevance when no constraints given
  const constrained = q.els.length || q.classes.length || q.formsCompounds || q.formula
  if (!constrained) {
    // generic: substring on pair name / compound formulas
    const needle = q.raw.toLowerCase()
    if (needle && needle.length >= 1) {
      const inPair = p.pair.toLowerCase().includes(needle)
      const inComp = (d?.compounds || []).some(c => c.formula.toLowerCase().includes(needle))
      if (!inPair && !inComp) return null
      if (inComp) reasons.push('matches a compound')
    }
  }

  return { score, reasons, hasPref: Object.keys(q.prefs).length > 0, nStable: d?.n_stable || 0 }
}

function DftBadges({ d }) {
  if (!d) return <span className="text-[11px] text-[var(--dim)]">no DFT link</span>
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {d.n_stable > 0 && (
        <span className="badge" style={{ background: '#10b98122', color: '#34d399' }}>
          <Boxes size={11} /> {d.n_stable} stable
        </span>
      )}
      {d.ground_state?.formula && (
        <span className="badge" style={{ background: '#6366f122', color: '#a5b4fc' }}>
          <Gem size={11} /> {d.ground_state.formula} ({d.ground_state.Ef} eV)
        </span>
      )}
      {d.elastic?.young_GPa != null && (
        <span className="badge" style={{ background: '#f59e0b22', color: '#fbbf24' }}>
          E {Math.round(d.elastic.young_GPa)} GPa
        </span>
      )}
      {d.sources?.length > 0 && (
        <span className="badge" style={{ background: '#64748b22', color: '#cbd5e1' }}>
          {d.sources.join(' · ')}
        </span>
      )}
    </div>
  )
}

export default function Selector({ pairs, elements, axes, dft, onTab }) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [open, setOpen] = useState(null) // selected pair object -> PairDetail

  const q = useMemo(
    () => submitted ? parseQuery(submitted, elements, axes, dft) : null,
    [submitted, elements, axes, dft])

  const results = useMemo(() => {
    if (!q) return null
    const scored = []
    for (const p of pairs) {
      const s = scorePair(p, q, dft)
      if (s) scored.push({ p, ...s })
    }
    scored.sort((a, b) =>
      a.hasPref ? b.score - a.score
      : b.nStable - a.nStable || a.p.pair.localeCompare(b.p.pair))
    return scored
  }, [q, pairs, dft])

  const examples = [
    'Al-La', 'immiscible with Fe', 'forms compounds, refractory and strong',
    'cheap isomorphous system', 'light and stiff', 'AlAg2',
  ]

  // detail view
  if (open) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setOpen(null)}
          className="self-start flex items-center gap-2 text-sm text-[var(--dim)] hover:text-[var(--text)]">
          <ArrowLeft size={16} /> back to results
        </button>
        <PairDetail pair={open} allPairs={pairs} dft={dft} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={e => { e.preventDefault(); setSubmitted(text) }}
        className="card glow p-4 flex flex-col gap-3">
        <label className="text-sm text-[var(--dim)] flex items-center gap-2">
          <Atom size={15} /> Search 970 binary systems — element, pair, phase behaviour, property, or compound formula
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
            <input value={text} onChange={e => setText(e.target.value)}
              placeholder="e.g. Al-La · immiscible with Fe · forms compounds, refractory · AlAg2"
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
          {q.formula && <Chip color="#a5b4fc">compound {q.formula}</Chip>}
          {q.els.map(e => <Chip key={e} color="#38bdf8">element {e}</Chip>)}
          {q.classes.map(c => <Chip key={c} color={CLASS_COLOR[c]}>{CLASS_LABEL[c]}</Chip>)}
          {q.formsCompounds && <Chip color="#34d399">forms DFT-stable compounds</Chip>}
          {Object.entries(q.prefs).map(([a, d]) => <Chip key={a}>{d} {axes[a]?.label || a}</Chip>)}
          {!q.els.length && !q.classes.length && !q.formsCompounds && !q.formula && !Object.keys(q.prefs).length &&
            <span className="text-amber-400">free-text match on pair / compound names</span>}
        </div>
      )}

      {results && (
        <div className="text-sm text-[var(--dim)]">
          {results.length} matching system{results.length !== 1 ? 's' : ''}
          {results.length > 60 && ' · showing top 60'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results && results.slice(0, 60).map(({ p, reasons }) => {
          const d = dft?.[p.pair]
          return (
            <button key={p.pair} onClick={() => setOpen(p)}
              className="card p-3 flex gap-3 text-left hover:ring-1 hover:ring-sky-500/50 transition">
              <img src={`./phase/${p.phase_img}`} alt={p.pair}
                className="w-28 h-24 object-contain bg-white rounded shrink-0" loading="lazy" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold flex items-center gap-2">
                  <FlaskConical size={14} className="text-[var(--dim)]" /> {p.pair}
                </div>
                <div className="flex flex-wrap gap-1 my-1">
                  {p.truth.map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: CLASS_COLOR[c] + '33', color: CLASS_COLOR[c] }}>
                      {CLASS_LABEL[c]}
                    </span>
                  ))}
                  {p.pred?.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] text-[var(--dim)]"
                      style={{ background: '#ffffff10' }}>
                      MAGPIE: {p.pred.map(c => CLASS_LABEL[c].split(' ')[0]).join(', ')}
                    </span>
                  )}
                </div>
                <DftBadges d={d} />
                {reasons?.length > 0 && (
                  <div className="text-[11px] text-[var(--dim)] leading-snug mt-1">{reasons.join(' · ')}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {results && results.length === 0 && (
        <div className="card p-6 text-center text-[var(--dim)] text-sm">
          Nothing matched. Try an element symbol (La), a pair (Al-La), a behaviour
          (immiscible / forms compounds), or a property (light, stiff, cheap).
        </div>
      )}
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
