import React, { useEffect, useState } from 'react'
import { Grid3x3, BookOpen, ScatterChart, UploadCloud, Compass, Sun, Moon, Search, LineChart, BarChart3, Github, ArrowLeft, Pin, GitCompare, X, Link2, Check } from 'lucide-react'
import { AppProvider, useApp } from './lib/app'
import PeriodicTable from './components/PeriodicTable'
import Descriptors from './components/Descriptors'
import ClassMap from './components/ClassMap'
import Upload from './components/Upload'
import Selector from './components/Selector'
import AshbyChart from './components/AshbyChart'
import Benchmark from './components/Benchmark'
import PairDetail from './components/PairDetail'
import CompareView from './components/CompareView'
import CommandPalette from './components/CommandPalette'

export const TABS = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'table', label: 'Periodic Table', icon: Grid3x3 },
  { id: 'map', label: 'Classification Map', icon: ScatterChart },
  { id: 'ashby', label: 'Ashby Chart', icon: LineChart },
  { id: 'descriptors', label: 'Descriptors', icon: BookOpen },
  { id: 'benchmark', label: 'Benchmark', icon: BarChart3 },
  { id: 'upload', label: 'Upload', icon: UploadCloud },
]
const REPO = 'https://github.com/akhtar07/compass-explorer'

export default function App() {
  return <AppProvider><Shell /></AppProvider>
}

function Shell() {
  const app = useApp()
  const { ready, error, route, navigate, theme, toggleTheme, elements, groups, labels, pairs, axes, dft, pairIndex, back } = app
  const [palette, setPalette] = useState(false)

  useEffect(() => {
    const onKey = e => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(v => !v) }
      else if (e.key === '/' && !typing) { e.preventDefault(); setPalette(true) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [route.tab, route.pair])

  const nStable = dft ? Object.values(dft).reduce((s, v) => s + (v.n_stable || 0), 0) : 0
  const nPairs = pairs?.length || 0
  const activeTab = ['pair', 'compare'].includes(route.tab) ? null : route.tab
  const pairObj = route.tab === 'pair' ? pairIndex[route.pair] : null

  return (
    <div className="min-h-full flex flex-col">
      <header className="glass border-b border-[var(--border)] sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 md:px-5 py-2.5 flex items-center gap-3">
          <a href="#/" className="flex items-center gap-2.5 shrink-0" onClick={e => { e.preventDefault(); navigate('search') }}>
            <span className="w-9 h-9 rounded-xl chip-grad grad-border flex items-center justify-center"><Compass className="text-[var(--accent)]" size={22} /></span>
            <span>
              <span className="block font-extrabold text-lg leading-tight grad-text tracking-tight">COMPASS</span>
              <span className="hidden sm:block text-[10.5px] text-[var(--dim)] leading-tight">Binary-alloy phase explorer · {nPairs || '…'} ground-truth systems</span>
            </span>
          </a>
          <nav className="ml-auto flex items-center gap-0.5 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => navigate(t.id)} className={`tab ${activeTab === t.id ? 'on' : ''}`}>
                  <Icon size={15} /> <span className="hidden lg:inline">{t.label}</span>
                </button>
              )
            })}
          </nav>
          <button onClick={() => setPalette(true)} title="Quick jump (Ctrl K)"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--dim)] text-xs hover:border-[var(--border-strong)]">
            <Search size={13} /> <span className="whitespace-nowrap">Jump to…</span> <span className="kbd whitespace-nowrap">Ctrl K</span>
          </button>
          <a href={REPO} target="_blank" rel="noreferrer" title="Source on GitHub" className="tab"><Github size={16} /></a>
          <button onClick={toggleTheme} title="Toggle light / dark mode" className="tab">{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 md:px-5 py-5 flex-1">
        {error ? (
          <div className="card p-8 text-center text-sm text-[var(--dim)]">Data failed to load: {error}</div>
        ) : !ready ? (
          <Skeleton />
        ) : (
          <>
            {route.tab === 'search' && <Selector pairs={pairs} elements={elements} axes={axes} dft={dft} initialQuery={route.params.q || ''} />}
            {route.tab === 'table' && <PeriodicTable elements={elements} pairs={pairs} groups={groups} labels={labels} dft={dft} />}
            {route.tab === 'descriptors' && <Descriptors pairs={pairs} />}
            {route.tab === 'benchmark' && <Benchmark />}
            {route.tab === 'map' && <ClassMap pairs={pairs} dft={dft} />}
            {route.tab === 'ashby' && <AshbyChart elements={elements} axes={axes} pairs={pairs} dft={dft} />}
            {route.tab === 'upload' && <Upload />}
            {route.tab === 'pair' && (
              pairObj ? <PairPage pair={pairObj} /> :
              <div className="card p-8 text-center text-sm text-[var(--dim)]">No system “{route.pair}” in the {nPairs}-pair set. <button className="link" onClick={() => navigate('search', route.pair)}>Search for it</button></div>
            )}
            {route.tab === 'compare' && <ComparePage />}
            {!['search', 'table', 'descriptors', 'benchmark', 'map', 'ashby', 'upload', 'pair', 'compare'].includes(route.tab) && (
              <div className="card p-8 text-center text-sm text-[var(--dim)]">Unknown page. <button className="link" onClick={() => navigate('search')}>Go home</button></div>
            )}
          </>
        )}
      </main>

      {ready && <PinTray />}
      <CommandPalette tabs={TABS} open={palette} onClose={() => setPalette(false)} />

      <footer className="max-w-[1400px] w-full mx-auto px-5 py-6 text-[11px] text-[var(--dim)] border-t border-[var(--border)] mt-8 leading-relaxed">
        <span className="grad-text font-semibold">COMPASS</span> · {nPairs} ground-truth binary phase classifications
        (isomorphous / partial / immiscible / intermetallic) · orbital / Hume-Rothery descriptors COMPASS-9 (D₁–D₈ + D₁₃), optional
        bonding descriptors D₉–D₁₂ · {nStable.toLocaleString()} DFT-stable compounds linked from Materials Project, OQMD &amp; JARVIS ·
        every prediction is out-of-fold (leave-one-element-out) · benchmark numbers generated from the paper's result files ·
        <a className="link ml-1" href={REPO} target="_blank" rel="noreferrer">source</a> · press <span className="kbd">/</span> to jump anywhere.
      </footer>
    </div>
  )
}

function PairPage({ pair }) {
  const { pairs, dft, back, pinned, togglePin } = useApp()
  const [copied, setCopied] = useState(false)
  const share = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  const isPinned = pinned.has(pair.pair)
  return (
    <div className="flex flex-col gap-3 fade-up">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={back} className="flex items-center gap-2 text-sm text-[var(--dim)] hover:text-[var(--text)]"><ArrowLeft size={16} /> back</button>
        <h1 className="text-2xl font-extrabold tracking-tight ml-2">{pair.A}–{pair.B}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => togglePin(pair.pair)} className="pill hover:border-[var(--border-strong)]"
            style={isPinned ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>
            {isPinned ? <Check size={13} /> : <Pin size={13} />} {isPinned ? 'Pinned' : 'Pin to compare'}
          </button>
          <button onClick={share} className="pill hover:border-[var(--border-strong)]">{copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? 'Link copied' : 'Copy link'}</button>
        </div>
      </div>
      <PairDetail pair={pair} allPairs={pairs} dft={dft} />
    </div>
  )
}

function ComparePage() {
  const { route, pairIndex, dft, navigate, unpin, openPair, pinned } = useApp()
  const keys = route.list?.length ? route.list : [...pinned]
  const systems = keys.map(k => pairIndex[k]).filter(Boolean)
  if (!systems.length) return <div className="card p-8 text-center text-sm text-[var(--dim)]">Nothing to compare yet. Pin systems from any result card or system page. <button className="link" onClick={() => navigate('search')}>Go to search</button></div>
  return <CompareView systems={systems} dft={dft} onBack={() => navigate('search')} onOpen={p => openPair(p.pair)}
           onRemove={key => { unpin(key); const rest = keys.filter(k => k !== key); rest.length ? navigate('compare', rest, true) : navigate('search') }} />
}

function PinTray() {
  const { pinned, pairIndex, unpin, clearPins, navigate, route } = useApp()
  const list = [...pinned].map(k => pairIndex[k]).filter(Boolean)
  if (!list.length || route.tab === 'compare') return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 card glow glass px-3 py-2 flex items-center gap-2 fade-up max-w-[94vw]">
      <Pin size={14} className="text-[var(--accent)] shrink-0" />
      <div className="flex flex-wrap gap-1 max-w-[52vw]">
        {list.map(p => (
          <span key={p.pair} className="badge" style={{ background: 'var(--panel2)', color: 'var(--text)' }}>
            {p.pair}<button onClick={() => unpin(p.pair)} className="text-[var(--dim)] hover:text-[var(--text)]"><X size={11} /></button>
          </span>
        ))}
      </div>
      <button onClick={() => navigate('compare', list.map(p => p.pair))} disabled={list.length < 2}
        className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium chip-grad disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
        <GitCompare size={14} /> Compare {list.length}
      </button>
      <button onClick={clearPins} title="Clear all" className="text-[var(--dim)] hover:text-[var(--text)]"><X size={15} /></button>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton h-40" />
      <div className="skeleton h-12" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32" />)}</div>
    </div>
  )
}
