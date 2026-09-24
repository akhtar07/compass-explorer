import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FlaskConical, Atom, LayoutGrid, CornerDownLeft } from 'lucide-react'
import { useApp } from '../lib/app'
import { CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'

// Global quick-jump (Ctrl/⌘-K or "/"): systems, elements, tabs. Enter opens; Esc closes.
export default function CommandPalette({ tabs, open, onClose }) {
  const { pairs, elements, navigate, openPair } = useApp()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inp = useRef(null)
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inp.current?.focus(), 10) } }, [open])

  const items = useMemo(() => {
    const t = q.trim().toLowerCase()
    const out = []
    if (!t) {
      tabs.forEach(x => out.push({ kind: 'tab', id: x.id, label: x.label, icon: x.icon }))
      return out
    }
    tabs.filter(x => x.label.toLowerCase().includes(t)).forEach(x => out.push({ kind: 'tab', id: x.id, label: x.label, icon: x.icon }))
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    const els = Object.values(elements || {}).filter(e => e.has_data && (e.symbol.toLowerCase() === t || (e.name || '').toLowerCase().startsWith(t))).slice(0, 4)
    els.forEach(e => out.push({ kind: 'el', id: e.symbol, label: `${e.symbol} · ${e.name || ''}`, sub: 'all systems with this element' }))
    const norm = t.replace(/[\s_–—]+/g, '-')
    const parts = norm.split('-').filter(Boolean).map(cap)
    const hits = (pairs || []).filter(p => {
      const pl = p.pair.toLowerCase()
      if (pl.includes(norm)) return true
      if (parts.length === 2) return (p.A === parts[0] && p.B === parts[1]) || (p.A === parts[1] && p.B === parts[0])
      return false
    }).slice(0, 8)
    hits.forEach(p => out.push({ kind: 'pair', id: p.pair, label: p.pair, pair: p }))
    if (!hits.length && !els.length) out.push({ kind: 'search', id: q, label: `Search “${q.trim()}”`, sub: 'element · pair · behaviour · property · formula' })
    return out
  }, [q, pairs, elements, tabs])

  useEffect(() => { setSel(0) }, [q])
  const go = it => {
    if (!it) return
    onClose()
    if (it.kind === 'tab') navigate(it.id)
    else if (it.kind === 'pair') openPair(it.id)
    else if (it.kind === 'el') navigate('search', it.id)
    else navigate('search', it.id)
  }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[sel]) }
    else if (e.key === 'Escape') onClose()
  }
  if (!open) return null
  const sections = [['tab', 'Go to'], ['el', 'Elements'], ['pair', 'Systems'], ['search', 'Search']]
  let idx = -1
  return (
    <div className="palette-bg" onMouseDown={onClose}>
      <div className="palette pop" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-[var(--border)]">
          <Search size={17} className="text-[var(--dim)]" />
          <input ref={inp} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Jump to a system (Al-La), an element (Ti), or a tab…" />
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-1">
          {sections.map(([k, title]) => {
            const its = items.filter(i => i.kind === k); if (!its.length) return null
            return (
              <div key={k}>
                <div className="sect">{title}</div>
                {its.map(it => {
                  idx++; const i = idx
                  const Icon = it.icon || (it.kind === 'pair' ? FlaskConical : it.kind === 'el' ? Atom : it.kind === 'tab' ? LayoutGrid : Search)
                  const dom = it.pair ? dominantClass(it.pair.truth) : null
                  return (
                    <div key={k + it.id} className={`row ${sel === i ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
                      <Icon size={15} className="text-[var(--dim)] shrink-0" />
                      <span className="font-medium">{it.label}</span>
                      {it.pair && <span className="flex gap-1 ml-1">{it.pair.truth.map(c => <span key={c} className="badge" style={{ background: CLASS_COLOR[c] + '26', color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</span>)}</span>}
                      {it.sub && <span className="text-[11px] text-[var(--dim)] ml-1">{it.sub}</span>}
                      {sel === i && <CornerDownLeft size={13} className="ml-auto text-[var(--faint)]" />}
                      {dom && <span className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: CLASS_COLOR[dom] }} />}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 px-4 py-2 border-t border-[var(--border)] text-[10.5px] text-[var(--faint)]">
          <span><span className="kbd">↑↓</span> navigate</span><span><span className="kbd">↵</span> open</span><span className="ml-auto">{(pairs || []).length} systems · {Object.values(elements || {}).filter(e => e.has_data).length} elements</span>
        </div>
      </div>
    </div>
  )
}
