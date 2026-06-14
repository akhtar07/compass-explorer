import React, { useMemo, useState } from 'react'
import { Search, X, ArrowLeft, Atom, FlaskConical, Boxes, Gem, Sparkles, SlidersHorizontal, Pin, GitCompare, Check } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'
import PairDetail from './PairDetail'

// ONE-STOP EXPLORER. A single instant-search box understands an element
// ("La" / "lanthanum"), a pair ("Al-La"), a phase behaviour ("immiscible",
// "forms compounds"), a property need ("light and stiff, cheap"), or a compound
// formula ("AlAg2"). Layer that with click-to-toggle phase facets, a "forms
// compounds" filter and live sorting. Results are rich animated cards (verified
// class + MAGPIE probabilities + multi-source DFT badges + thumbnail); click one
// for the full PairDetail. Deterministic parser — no API key required.

const PROP_SYN = {
  density:           { high: ['dense', 'heavy', 'high density'], low: ['light', 'lightweight', 'low density'], lab: 'density' },
  youngs_modulus_GPa:{ high: ['stiff', 'rigid', 'high modulus', 'high stiffness'], low: ['compliant', 'flexible'], lab: 'stiffness' },
  specific_stiffness:{ high: ['specific stiffness', 'stiffness-to-weight', 'light and stiff'], low: [], lab: 'specific stiffness' },
  JARVIS_therm_cond: { high: ['conductive', 'high thermal', 'heat conducting', 'thermally conductive'], low: ['insulating', 'low thermal'], lab: 'thermal cond.' },
  JARVIS_mp:         { high: ['refractory', 'high melting', 'high temperature', 'heat resistant'], low: ['low melting', 'fusible'], lab: 'melting point' },
  UTS_MPa:           { high: ['strong', 'high strength', 'tough'], low: ['weak', 'low strength'], lab: 'strength' },
  Price_USD_kg:      { high: ['expensive', 'precious'], low: ['cheap', 'low cost', 'inexpensive', 'affordable', 'low price'], lab: 'price' },
}
const CLASS_SYN = {
  isomorphous:  ['isomorphous', 'solid solution', 'fully miscible', 'fully soluble', 'complete solubility'],
  partial:      ['partial', 'partially soluble', 'limited solubility'],
  immiscible:   ['immiscible', 'insoluble', 'phase separat', 'does not mix'],
  intermetallic:['intermetallic', 'ordered phase', 'line compound'],
}

function formulaElements(tok, validSyms) {
  const out = []; const re = /([A-Z][a-z]?)(\d*\.?\d*)/g; let m
  while ((m = re.exec(tok)) !== null) {
    if (validSyms.has(m[1]) && !out.includes(m[1])) out.push(m[1])
  }
  return out
}

function parseQuery(text, elements) {
  const t = ' ' + text.toLowerCase() + ' '
  const validSyms = new Set(Object.keys(elements).filter(s => elements[s].has_data))
  const nameToSym = {}
  for (const s of Object.keys(elements)) { const nm = (elements[s].name || '').toLowerCase(); if (nm) nameToSym[nm] = s }

  const classes = CLASSES.filter(c => CLASS_SYN[c].some(s => t.includes(s)))
  const prefs = {}
  for (const [axis, syn] of Object.entries(PROP_SYN)) {
    if (syn.high.some(s => s && t.includes(s))) prefs[axis] = 'high'
    else if (syn.low.some(s => s && t.includes(s))) prefs[axis] = 'low'
  }
  const formsCompounds = /\b(forms? (a )?compound|forms? compounds|stable compound|intermetallic compound|has compounds|compound former)\b/.test(t)

  const rawTokens = text.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const els = []
  for (const tk of rawTokens) {
    const cap = tk.charAt(0).toUpperCase() + tk.slice(1).toLowerCase()
    if (validSyms.has(cap) && !els.includes(cap)) els.push(cap)
  }
  for (const tk of rawTokens) { const sym = nameToSym[tk.toLowerCase()]; if (sym && !els.includes(sym)) els.push(sym) }

  let formula = null, formulaEls = []
  for (const tk of rawTokens) {
    if (els.includes(tk)) continue
    const fe = formulaElements(tk, validSyms)
    if (fe.length >= 2 && /[a-z0-9]/.test(tk)) { formula = tk; formulaEls = fe; break }
  }
  return { classes, prefs, formsCompounds, els, formula, formulaEls, raw: text.trim() }
}

// non-class hard filters + soft property score; class filtering happens later
function scoreBase(p, q, dft) {
  const reasons = []
  const setEls = new Set([p.A, p.B])
  const d = dft?.[p.pair]

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
  if (q.formsCompounds) {
    if (!d || !(d.n_stable > 0)) return null
    reasons.push(`${d.n_stable} DFT-stable compound${d.n_stable !== 1 ? 's' : ''}`)
  }
  let score = 0
  for (const [axis, dir] of Object.entries(q.prefs)) {
    const b = p.props?.[axis]; if (!b) continue
    score += dir === 'high' ? b.max : -b.min
    reasons.push(`${dir} ${PROP_SYN[axis].lab}`)
  }
  const constrained = q.els.length || q.formsCompounds || q.formula || Object.keys(q.prefs).length || q.classes.length
  if (!constrained && q.raw) {
    const needle = q.raw.toLowerCase()
    const inPair = p.pair.toLowerCase().includes(needle)
    const inComp = (d?.compounds || []).some(c => c.formula.toLowerCase().includes(needle))
    if (!inPair && !inComp) return null
    if (inComp && !inPair) reasons.push('matches a compound')
  }
  return { score, reasons, hasPref: Object.keys(q.prefs).length > 0, nStable: d?.n_stable || 0 }
}

function ProbBar({ prob }) {
  if (!prob) return null
  const total = CLASSES.reduce((s, c) => s + (prob[c] || 0), 0) || 1
  return (
    <div className="probbar mt-1" title={CLASSES.map(c => `${CLASS_LABEL[c]} ${(prob[c] * 100).toFixed(0)}%`).join('  ·  ')}>
      {CLASSES.map(c => {
        const w = (prob[c] || 0) / total * 100
        return w > 0.5 ? <span key={c} style={{ width: `${w}%`, background: CLASS_COLOR[c] }} /> : null
      })}
    </div>
  )
}

function DftBadges({ d }) {
  if (!d) return <span className="text-[11px] text-[var(--dim)]">no DFT link</span>
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {d.n_stable > 0 && <span className="badge" style={{ background: '#10b98122', color: '#34d399' }}><Boxes size={11} /> {d.n_stable} stable</span>}
      {d.ground_state?.formula && <span className="badge" style={{ background: '#6366f122', color: '#a5b4fc' }}><Gem size={11} /> {d.ground_state.formula} ({d.ground_state.Ef} eV)</span>}
      {d.elastic?.young_GPa != null && <span className="badge" style={{ background: '#f59e0b22', color: '#fbbf24' }}>E {Math.round(d.elastic.young_GPa)} GPa</span>}
      {d.sources?.length > 0 && <span className="badge" style={{ background: '#64748b22', color: '#cbd5e1' }}>{d.sources.join(' · ')}</span>}
    </div>
  )
}

const SORTS = {
  relevance: 'Best match',
  stable:    'Most stable compounds',
  name:      'Name (A→Z)',
  hull:      'Deepest convex hull',
}

export default function Selector({ pairs, elements, axes, dft, onTab }) {
  const [text, setText] = useState('')
  const [facets, setFacets] = useState(() => new Set()) // class facet toggles
  const [formsOnly, setFormsOnly] = useState(false)
  const [sort, setSort] = useState('relevance')
  const [open, setOpen] = useState(null)
  const [pinned, setPinned] = useState(() => new Set())
  const [comparing, setComparing] = useState(false)

  const togglePin = (e, key) => {
    e.stopPropagation()
    setPinned(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : (n.size < 6 && n.add(key)); return n })
  }
  const pinnedPairs = useMemo(() => pairs.filter(p => pinned.has(p.pair)), [pairs, pinned])

  const q = useMemo(() => parseQuery(text, elements), [text, elements])

  // stage 1: non-class filter + score
  const base = useMemo(() => {
    const out = []
    for (const p of pairs) {
      const eff = { ...q, formsCompounds: q.formsCompounds || formsOnly }
      const s = scoreBase(p, eff, dft)
      if (s) out.push({ p, ...s })
    }
    return out
  }, [pairs, q, dft, formsOnly])

  // live class counts over the base (pre-class-facet) set
  const classCounts = useMemo(() => {
    const c = { isomorphous: 0, partial: 0, immiscible: 0, intermetallic: 0 }
    base.forEach(({ p }) => p.truth.forEach(t => { if (c[t] != null) c[t]++ }))
    return c
  }, [base])

  // stage 2: apply class facets (parsed classes + toggled facets), then sort
  const results = useMemo(() => {
    const eff = new Set([...facets, ...q.classes])
    let r = eff.size ? base.filter(({ p }) => p.truth.some(t => eff.has(t))) : base.slice()
    const hull = pr => dft?.[pr.pair]?.min_hull
    r.sort((a, b) => {
      if (sort === 'name') return a.p.pair.localeCompare(b.p.pair)
      if (sort === 'stable') return b.nStable - a.nStable || a.p.pair.localeCompare(b.p.pair)
      if (sort === 'hull') return (hull(a.p) ?? 1) - (hull(b.p) ?? 1) || a.p.pair.localeCompare(b.p.pair)
      // relevance: property score if any, else stable-rich then name
      return a.hasPref ? b.score - a.score : (b.nStable - a.nStable || a.p.pair.localeCompare(b.p.pair))
    })
    return r
  }, [base, facets, q.classes, sort, dft])

  const totalStable = useMemo(() => results.reduce((s, r) => s + r.nStable, 0), [results])
  const resClassDist = useMemo(() => {
    const c = { isomorphous: 0, partial: 0, immiscible: 0, intermetallic: 0 }
    results.forEach(({ p }) => p.truth.forEach(t => { if (c[t] != null) c[t]++ }))
    return c
  }, [results])

  const exampleGroups = [
    { label: 'Element',   items: ['Ti', 'lanthanum', 'uranium', 'Nb'] },
    { label: 'Pair',      items: ['Al-La', 'Mg-Zn', 'Cu-Ni', 'W-Re'] },
    { label: 'Behaviour', items: ['immiscible with Fe', 'isomorphous and conductive', 'intermetallic with Ni', 'partial solubility with Cu'] },
    { label: 'Compounds', items: ['forms compounds, refractory', 'high melting, forms compounds'] },
    { label: 'Property',  items: ['light and stiff, cheap', 'strong and low density', 'refractory and conductive', 'cheap and lightweight'] },
    { label: 'Formula',   items: ['AlAg2', 'Fe2Nb', 'Ni3Al', 'Mg2Cu'] },
  ]

  const toggleFacet = c => setFacets(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })
  const activeClasses = new Set([...facets, ...q.classes])
  const anyFilter = text || facets.size || formsOnly

  if (open) {
    return (
      <div className="flex flex-col gap-3 fade-up">
        <button onClick={() => setOpen(null)} className="self-start flex items-center gap-2 text-sm text-[var(--dim)] hover:text-[var(--text)]">
          <ArrowLeft size={16} /> back to results
        </button>
        <PairDetail pair={open} allPairs={pairs} dft={dft} />
      </div>
    )
  }

  if (comparing && pinnedPairs.length) {
    return <CompareView systems={pinnedPairs} dft={dft} onBack={() => setComparing(false)}
             onOpen={p => { setComparing(false); setOpen(p) }}
             onRemove={key => setPinned(prev => { const n = new Set(prev); n.delete(key); return n })} />
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      {/* hero */}
      <div className="card glow hero-grad p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[var(--dim)] text-sm">
          <Sparkles size={15} className="text-[var(--accent)]" /> One-stop binary-alloy explorer
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold leading-tight">
          Search <span className="grad-text">970</span> verified systems — get <span className="grad-text">everything</span> in one place
        </h2>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder="Element (La / lanthanum) · pair (Al-La) · behaviour (immiscible, forms compounds) · property (light, stiff, cheap) · formula (AlAg2)"
            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl pl-11 pr-10 py-3 text-base focus:outline-none focus:border-sky-500 shadow-sm" />
          {text && (
            <button onClick={() => setText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dim)] hover:text-[var(--text)]">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          <span className="text-[var(--dim)]">Try any of these — every query type the one-stop search understands:</span>
          {exampleGroups.map(g => (
            <div key={g.label} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-[var(--dim)]/70">{g.label}</span>
              {g.items.map(ex => (
                <button key={ex} onClick={() => setText(ex)}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[var(--dim)] hover:text-[var(--text)] border border-[var(--border)] transition">{ex}</button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* facet + sort bar */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-[var(--dim)] mr-1"><SlidersHorizontal size={14} /> Phase</span>
        {CLASSES.map(c => {
          const on = activeClasses.has(c)
          return (
            <button key={c} onClick={() => toggleFacet(c)} className="facet"
              style={on ? { background: CLASS_COLOR[c] + '26', borderColor: CLASS_COLOR[c], color: CLASS_COLOR[c] } : {}}>
              <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[c] }} />
              {CLASS_LABEL[c]} <span className="opacity-70">{classCounts[c]}</span>
            </button>
          )
        })}
        <button onClick={() => setFormsOnly(v => !v)} className="facet"
          style={formsOnly ? { background: '#34d39926', borderColor: '#34d399', color: '#34d399' } : {}}>
          <Boxes size={12} /> Forms compounds
        </button>
        <div className="ml-auto flex items-center gap-2">
          {anyFilter && (
            <button onClick={() => { setText(''); setFacets(new Set()); setFormsOnly(false) }}
              className="text-xs text-[var(--dim)] hover:text-[var(--text)] flex items-center gap-1"><X size={13} /> Reset</button>
          )}
          <label className="text-xs text-[var(--dim)]">Sort</label>
          <select className="sel" value={sort} onChange={e => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* stats */}
      <div className="flex flex-wrap gap-3">
        <div className="stat"><div className="v grad-text">{results.length}</div><div className="k">systems matched</div></div>
        <div className="stat"><div className="v">{totalStable.toLocaleString()}</div><div className="k">DFT-stable compounds</div></div>
        <div className="stat flex-1 min-w-[220px]">
          <div className="k mb-1.5">phase-class mix of results</div>
          <div className="flex h-3 rounded-full overflow-hidden bg-[var(--cell)]">
            {CLASSES.map(c => {
              const tot = CLASSES.reduce((s, k) => s + resClassDist[k], 0) || 1
              const w = resClassDist[c] / tot * 100
              return w > 0 ? <span key={c} title={`${CLASS_LABEL[c]}: ${resClassDist[c]}`} style={{ width: `${w}%`, background: CLASS_COLOR[c] }} /> : null
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px]">
            {CLASSES.map(c => <span key={c} style={{ color: CLASS_COLOR[c] }}>● {CLASS_LABEL[c]} {resClassDist[c]}</span>)}
          </div>
        </div>
      </div>

      {q.formula || q.els.length || q.formsCompounds || formsOnly || Object.keys(q.prefs).length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--dim)]">Reading your query as:</span>
          {q.formula && <Chip color="#a5b4fc">compound {q.formula}</Chip>}
          {q.els.map(e => <Chip key={e} color="#38bdf8">element {e}</Chip>)}
          {(q.formsCompounds || formsOnly) && <Chip color="#34d399">forms DFT-stable compounds</Chip>}
          {Object.entries(q.prefs).map(([a, d]) => <Chip key={a}>{d} {PROP_SYN[a].lab}</Chip>)}
        </div>
      ) : null}

      {/* results */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {results.slice(0, 90).map(({ p, reasons }, i) => {
          const d = dft?.[p.pair]
          const dom = dominantClass(p.truth) || 'partial'
          const isPinned = pinned.has(p.pair)
          return (
            <div key={p.pair} onClick={() => setOpen(p)} role="button"
              className="rcard card p-3 pl-4 flex gap-3 text-left fade-up cursor-pointer"
              style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}>
              <span className="stripe" style={{ background: CLASS_COLOR[dom] }} />
              <button onClick={e => togglePin(e, p.pair)} title={isPinned ? 'Unpin' : 'Pin to compare'}
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition"
                style={isPinned ? { background: 'var(--accent)', color: '#0b1020' } : { background: 'var(--panel2)', color: 'var(--dim)' }}>
                {isPinned ? <Check size={13} /> : <Pin size={12} />}
              </button>
              <img src={`./phase/${p.phase_img}`} alt={p.pair} loading="lazy"
                className="w-24 h-24 object-contain bg-white rounded shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold flex items-center gap-1.5"><FlaskConical size={14} className="text-[var(--dim)]" /> {p.pair}</div>
                <div className="flex flex-wrap gap-1 my-1">
                  {p.truth.map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: CLASS_COLOR[c] + '33', color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span>
                  ))}
                </div>
                <ProbBar prob={p.prob} />
                {p.pred?.length > 0 && <div className="text-[10px] text-[var(--dim)] mt-1">MAGPIE → {p.pred.map(c => CLASS_LABEL[c].split(' ')[0]).join(', ')}</div>}
                <DftBadges d={d} />
                {reasons?.length > 0 && <div className="text-[11px] text-[var(--dim)] leading-snug mt-1">{reasons.join(' · ')}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {results.length > 90 && <div className="text-xs text-[var(--dim)] text-center">showing first 90 of {results.length} — refine with the search box or facets above</div>}
      {results.length === 0 && (
        <div className="card p-8 text-center text-[var(--dim)] text-sm">
          <Atom className="mx-auto mb-2 opacity-50" /> Nothing matched.
          Try an element (La), a pair (Al-La), a behaviour (immiscible / forms compounds), or a property (light, stiff, cheap).
        </div>
      )}

      {/* sticky compare tray */}
      {pinnedPairs.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 card glow px-3 py-2 flex items-center gap-2 fade-up"
          style={{ background: 'var(--panel)' }}>
          <Pin size={14} className="text-[var(--accent)]" />
          <div className="flex flex-wrap gap-1 max-w-[46vw]">
            {pinnedPairs.map(p => (
              <span key={p.pair} className="badge" style={{ background: 'var(--panel2)', color: 'var(--text)' }}>
                {p.pair}
                <button onClick={() => setPinned(prev => { const n = new Set(prev); n.delete(p.pair); return n })} className="text-[var(--dim)] hover:text-[var(--text)]"><X size={11} /></button>
              </span>
            ))}
          </div>
          <button onClick={() => setComparing(true)} disabled={pinnedPairs.length < 2}
            className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium chip-grad disabled:opacity-40 flex items-center gap-1.5">
            <GitCompare size={14} /> Compare {pinnedPairs.length}
          </button>
          <button onClick={() => setPinned(new Set())} title="Clear all" className="text-[var(--dim)] hover:text-[var(--text)]"><X size={15} /></button>
        </div>
      )}
    </div>
  )
}

// ---- side-by-side comparison of pinned systems ----
function CompareView({ systems, dft, onBack, onOpen, onRemove }) {
  const rows = [
    { k: 'thumb', label: '' },
    { k: 'truth', label: 'Verified class' },
    { k: 'pred', label: 'MAGPIE prediction' },
    ...CLASSES.map(c => ({ k: 'prob:' + c, label: `P(${CLASS_LABEL[c]})`, cls: c })),
    { k: 'n_stable', label: 'DFT-stable compounds' },
    { k: 'ground', label: 'Ground state' },
    { k: 'hull', label: 'Min hull dist (eV)' },
    { k: 'young', label: 'Elastic modulus (GPa)' },
    { k: 'sources', label: 'DFT sources' },
    { k: 'density', label: 'Density range (g/cc)' },
    { k: 'mp', label: 'Melting point range (K)' },
    { k: 'price', label: 'Price range ($/kg)' },
  ]
  const cell = (p, k) => {
    const d = dft?.[p.pair]
    const rng = a => p.props?.[a] ? `${p.props[a].min} – ${p.props[a].max}` : '—'
    if (k === 'thumb') return <img src={`./phase/${p.phase_img}`} className="w-full h-20 object-contain bg-white rounded" loading="lazy" />
    if (k === 'truth') return <div className="flex flex-wrap gap-1">{p.truth.map(c => <span key={c} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: CLASS_COLOR[c] + '33', color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span>)}</div>
    if (k === 'pred') return <span className="text-[var(--dim)]">{p.pred?.map(c => CLASS_LABEL[c].split(' ')[0]).join(', ') || '—'}</span>
    if (k.startsWith('prob:')) { const c = k.slice(5); const v = p.prob?.[c] ?? 0; return (
      <div className="flex items-center gap-1.5"><div className="flex-1 h-1.5 rounded bg-[var(--panel2)] overflow-hidden"><div className="h-full" style={{ width: `${v * 100}%`, background: CLASS_COLOR[c] }} /></div><span className="font-mono text-[10px] w-7 text-right">{v.toFixed(2)}</span></div>) }
    if (k === 'n_stable') return d?.n_stable ?? '—'
    if (k === 'ground') return d?.ground_state ? `${d.ground_state.formula} (${d.ground_state.Ef})` : '—'
    if (k === 'hull') return d?.min_hull != null ? d.min_hull : '—'
    if (k === 'young') return d?.elastic?.young_GPa != null ? Math.round(d.elastic.young_GPa) : '—'
    if (k === 'sources') return d?.sources?.join(', ') || '—'
    if (k === 'density') return rng('density')
    if (k === 'mp') return rng('JARVIS_mp')
    if (k === 'price') return rng('Price_USD_kg')
    return '—'
  }
  return (
    <div className="flex flex-col gap-3 fade-up">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--dim)] hover:text-[var(--text)]"><ArrowLeft size={16} /> back to results</button>
        <span className="text-sm text-[var(--dim)]">Comparing {systems.length} systems</span>
      </div>
      <div className="card glow overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <tbody>
            {rows.map(r => (
              <tr key={r.k} className="border-b border-[var(--border)]">
                <td className="px-3 py-2 text-[var(--dim)] font-medium sticky left-0 bg-[var(--panel)] min-w-[150px]" style={r.cls ? { color: CLASS_COLOR[r.cls] } : {}}>{r.label}</td>
                {systems.map(p => (
                  <td key={p.pair} className="px-3 py-2 align-middle min-w-[150px]">
                    {r.k === 'thumb' ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <button onClick={() => onOpen(p)} className="font-semibold hover:text-[var(--accent)]">{p.pair}</button>
                          <button onClick={() => onRemove(p.pair)} className="text-[var(--dim)] hover:text-[var(--text)]"><X size={13} /></button>
                        </div>
                        {cell(p, r.k)}
                      </div>
                    ) : cell(p, r.k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-[var(--dim)]">Property ranges are element bounds across the binary; DFT values are source-tagged, never averaged. Click a system name for its full page.</div>
    </div>
  )
}

function Chip({ children, color }) {
  return <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: (color || '#64748b') + '26', color: color || '#cbd5e1' }}>{children}</span>
}
