import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Atom, FlaskConical, Boxes, Gem, Sparkles, SlidersHorizontal, Pin, Check, Download, Link2, ArrowUpRight, PieChart } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'
import { useApp } from '../lib/app'

// ONE-STOP EXPLORER. A single instant-search box understands an element
// ("La" / "lanthanum"), a pair ("Al-La"), a phase behaviour ("immiscible",
// "forms compounds"), a property need ("light and stiff, cheap"), or a compound
// formula ("AlAg2"). Layer that with click-to-toggle phase facets, a "forms
// compounds" filter and live sorting. Results are rich animated cards (ground-truth
// class + MAGPIE probabilities + multi-source DFT badges + thumbnail); click one
// for the full system page. Deterministic parser — no API key required.

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
      {d.n_stable > 0 && <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent3) 16%, transparent)', color: 'var(--accent3)' }}><Boxes size={11} /> {d.n_stable} stable</span>}
      {d.ground_state?.formula && <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent2) 16%, transparent)', color: 'var(--accent2)' }}><Gem size={11} /> {d.ground_state.formula} <span className="mono">({d.ground_state.Ef} eV)</span></span>}
      {d.elastic?.young_GPa != null && <span className="badge" style={{ background: 'color-mix(in srgb, #f59e0b 16%, transparent)', color: '#d97706' }}>E <span className="mono">{Math.round(d.elastic.young_GPa)}</span> GPa</span>}
      {d.sources?.length > 0 && <span className="badge" style={{ background: 'var(--panel2)', color: 'var(--dim)' }}>{d.sources.join(' · ')}</span>}
    </div>
  )
}

const SORTS = {
  relevance: 'Best match',
  stable:    'Most stable compounds',
  name:      'Name (A→Z)',
  hull:      'Deepest convex hull',
}

// ---- count-up number (eases to target on mount / when target changes) ----
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setV(target); return }
    const t0 = performance.now(); const from = 0
    const step = now => {
      const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3)
      setV(Math.round(from + (target - from) * e))
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, ms])
  return v
}
function StatTile({ value, label, sub, grad }) {
  const v = useCountUp(value)
  return (
    <div className="stat flex-1 min-w-[130px]">
      <div className={`num-big mono ${grad ? 'grad-text' : ''}`}>{v.toLocaleString()}</div>
      <div className="k">{label}</div>
      {sub && <div className="text-[10px] text-[var(--faint)] mt-0.5">{sub}</div>}
    </div>
  )
}

// ---- conic-gradient donut of the ground-truth class mix (multi-label: every label counted) ----
function ClassDonut({ counts }) {
  const tot = CLASSES.reduce((s, c) => s + counts[c], 0) || 1
  let acc = 0
  const stops = CLASSES.map(c => { const a = acc; acc += counts[c] / tot * 100; return `${CLASS_COLOR[c]} ${a.toFixed(2)}% ${acc.toFixed(2)}%` }).join(', ')
  return (
    <div className="stat flex items-center gap-3 min-w-[260px]">
      <div className="relative w-[74px] h-[74px] rounded-full shrink-0" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-[13px] rounded-full flex flex-col items-center justify-center" style={{ background: 'var(--panel2)' }}>
          <PieChart size={13} className="text-[var(--dim)]" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="k mb-0.5" style={{ marginTop: 0 }}>ground-truth labels (multi-label)</div>
        {CLASSES.map(c => (
          <div key={c} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[c] }} />
            <span className="text-[var(--text)]">{CLASS_LABEL[c]}</span>
            <span className="mono text-[var(--dim)] ml-auto pl-2">{counts[c]}</span>
            <span className="mono text-[var(--faint)] w-9 text-right">{(counts[c] / tot * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function Selector({ pairs, elements, axes, dft, initialQuery = '' }) {
  const { navigate, openPair, pinned, togglePin } = useApp()
  const [text, setText] = useState(initialQuery)
  const [facets, setFacets] = useState(() => new Set()) // class facet toggles
  const [formsOnly, setFormsOnly] = useState(false)
  const [sort, setSort] = useState('relevance')
  const [copied, setCopied] = useState(false)

  // keep in sync with the URL (#/search?q=...) and mirror typing back into it (debounced, replace)
  useEffect(() => { setText(t => (t.trim() === initialQuery ? t : initialQuery)) }, [initialQuery])
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const id = setTimeout(() => navigate('search', text.trim(), true), 250)
    return () => clearTimeout(id)
  }, [text, navigate])

  const q = useMemo(() => parseQuery(text, elements), [text, elements])

  // hero stats (whole dataset)
  const hero = useMemo(() => {
    const nEl = Object.values(elements).filter(e => e.has_data).length
    const nStable = Object.values(dft || {}).reduce((s, v) => s + (v.n_stable || 0), 0)
    const c = { isomorphous: 0, partial: 0, immiscible: 0, intermetallic: 0 }
    pairs.forEach(p => p.truth.forEach(t => { if (c[t] != null) c[t]++ }))
    return { nEl, nStable, counts: c }
  }, [pairs, elements, dft])

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
    { label: 'Try', items: ['Ti', 'lanthanum', 'Al-La', 'Cu-Ni', 'immiscible with Fe', 'intermetallic with Ni', 'partial solubility with Cu'] },
    { label: 'More', items: ['forms compounds, refractory', 'light and stiff, cheap', 'strong and low density', 'isomorphous and conductive', 'AlAg2', 'Ni3Al'] },
  ]

  const toggleFacet = c => setFacets(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })
  const activeClasses = new Set([...facets, ...q.classes])
  const anyFilter = text || facets.size || formsOnly

  const exportCsv = () => {
    const head = ['pair', 'A', 'B', 'truth', 'pred', ...CLASSES.map(c => 'p_' + c), 'n_stable', 'ground_state', 'min_hull']
    const lines = [head.join(',')]
    results.forEach(({ p }) => {
      const d = dft?.[p.pair]
      lines.push([p.pair, p.A, p.B, p.truth.join('|'), (p.pred || []).join('|'),
        ...CLASSES.map(c => p.prob?.[c] ?? ''), d?.n_stable ?? '', d?.ground_state?.formula ?? '', d?.min_hull ?? ''].map(csvEscape).join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `compass_${(text.trim() || 'all').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500)
  }
  const copyLink = () => {
    const h = text.trim() ? `#/search?q=${encodeURIComponent(text.trim())}` : '#/'
    const url = `${window.location.origin}${window.location.pathname}${h}`
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      {/* hero */}
      <div className="card glow hero-grad p-5 md:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[var(--dim)] text-xs uppercase tracking-[.12em]">
          <Sparkles size={14} className="text-[var(--accent)]" /> One-stop binary-alloy explorer
        </div>
        <h2 className="text-2xl md:text-[34px] font-extrabold leading-[1.1] tracking-tight max-w-4xl">
          Search <span className="grad-text">{pairs.length}</span> ground-truth binary systems —
          phase diagram, descriptors, out-of-fold prediction and DFT in one place
        </h2>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder="Element (La / lanthanum) · pair (Al-La) · behaviour (immiscible, forms compounds) · property (light, stiff, cheap) · formula (AlAg2)"
            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl pl-11 pr-10 py-3 text-base focus:outline-none focus:border-[var(--accent)] shadow-sm" />
          {text && (
            <button onClick={() => setText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dim)] hover:text-[var(--text)]">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          {exampleGroups.map(g => (
            <div key={g.label} className="flex flex-wrap items-center gap-1.5">
              <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-[var(--faint)]">{g.label}</span>
              {g.items.map(ex => (
                <button key={ex} onClick={() => setText(ex)}
                  className="px-2.5 py-1 rounded-full bg-[var(--panel)] hover:bg-[var(--panel2)] text-[var(--dim)] hover:text-[var(--text)] border border-[var(--border)] transition">{ex}</button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <StatTile value={pairs.length} label="ground-truth systems" sub="4-class multi-label" grad />
          <StatTile value={hero.nEl} label="elements with descriptors" />
          <StatTile value={hero.nStable} label="DFT-stable compounds" sub="MP · OQMD · JARVIS" />
          <StatTile value={CLASSES.length} label="phase classes" sub="iso · partial · immis · inter" />
          <ClassDonut counts={hero.counts} />
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
              {CLASS_LABEL[c]} <span className="opacity-70 mono">{classCounts[c]}</span>
            </button>
          )
        })}
        <button onClick={() => setFormsOnly(v => !v)} className="facet"
          style={formsOnly ? { background: 'color-mix(in srgb, var(--accent3) 16%, transparent)', borderColor: 'var(--accent3)', color: 'var(--accent3)' } : {}}>
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
          <button onClick={exportCsv} disabled={!results.length} className="pill hover:border-[var(--border-strong)] disabled:opacity-40" title="Download the current results as CSV">
            <Download size={12} /> CSV
          </button>
          <button onClick={copyLink} className="pill hover:border-[var(--border-strong)]" title="Copy a link to this search">
            {copied ? <Check size={12} /> : <Link2 size={12} />} {copied ? 'Copied' : 'Link'}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="flex flex-wrap gap-3">
        <div className="stat"><div className="v grad-text mono">{results.length}</div><div className="k">systems matched</div></div>
        <div className="stat"><div className="v mono">{totalStable.toLocaleString()}</div><div className="k">DFT-stable compounds</div></div>
        <div className="stat flex-1 min-w-[220px]">
          <div className="k mb-1.5" style={{ marginTop: 0 }}>phase-class mix of results</div>
          <div className="flex h-3 rounded-full overflow-hidden bg-[var(--cell)]">
            {CLASSES.map(c => {
              const tot = CLASSES.reduce((s, k) => s + resClassDist[k], 0) || 1
              const w = resClassDist[c] / tot * 100
              return w > 0 ? <span key={c} title={`${CLASS_LABEL[c]}: ${resClassDist[c]}`} style={{ width: `${w}%`, background: CLASS_COLOR[c] }} /> : null
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px]">
            {CLASSES.map(c => <span key={c} style={{ color: CLASS_COLOR[c] }}>● {CLASS_LABEL[c]} <span className="mono">{resClassDist[c]}</span></span>)}
          </div>
        </div>
      </div>

      {q.formula || q.els.length || q.formsCompounds || formsOnly || Object.keys(q.prefs).length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--dim)]">Reading your query as:</span>
          {q.formula && <Chip color="var(--accent2)">compound {q.formula}</Chip>}
          {q.els.map(e => <Chip key={e} color="var(--accent)">element {e}</Chip>)}
          {(q.formsCompounds || formsOnly) && <Chip color="var(--accent3)">forms DFT-stable compounds</Chip>}
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
            <div key={p.pair} onClick={() => openPair(p.pair)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') openPair(p.pair) }}
              className="rcard card p-3 pl-4 flex gap-3 text-left fade-up cursor-pointer group"
              style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}>
              <span className="stripe" style={{ background: CLASS_COLOR[dom] }} />
              <button onClick={e => { e.stopPropagation(); togglePin(p.pair) }} title={isPinned ? 'Unpin' : 'Pin to compare'}
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition"
                style={isPinned ? { background: 'var(--accent)', color: '#0b1020' } : { background: 'var(--panel2)', color: 'var(--dim)' }}>
                {isPinned ? <Check size={13} /> : <Pin size={12} />}
              </button>
              <span className="absolute bottom-2 right-2 text-[10px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">open <ArrowUpRight size={11} /></span>
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
                {p.pred?.length > 0 && <div className="text-[10px] text-[var(--dim)] mt-1">MAGPIE (out-of-fold) → {p.pred.map(c => CLASS_LABEL[c].split(' ')[0]).join(', ')}</div>}
                <DftBadges d={d} />
                {reasons?.length > 0 && <div className="text-[11px] text-[var(--dim)] leading-snug mt-1">{reasons.join(' · ')}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {results.length > 90 && <div className="text-xs text-[var(--dim)] text-center">showing first 90 of {results.length} — refine with the search box or facets above, or export all as CSV</div>}
      {results.length === 0 && (
        <div className="card p-8 text-center text-[var(--dim)] text-sm">
          <Atom className="mx-auto mb-2 opacity-50" /> Nothing matched.
          Try an element (La), a pair (Al-La), a behaviour (immiscible / forms compounds), or a property (light, stiff, cheap).
        </div>
      )}
    </div>
  )
}

function Chip({ children, color }) {
  const c = color || 'var(--dim)'
  return <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: `color-mix(in srgb, ${c} 15%, transparent)`, color: c }}>{children}</span>
}
