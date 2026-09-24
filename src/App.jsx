import React, { useEffect, useState } from 'react'
import { Grid3x3, BookOpen, ScatterChart, UploadCloud, Compass, Sun, Moon, Search, LineChart, BarChart3 } from 'lucide-react'
import PeriodicTable from './components/PeriodicTable'
import Descriptors from './components/Descriptors'
import ClassMap from './components/ClassMap'
import Upload from './components/Upload'
import Selector from './components/Selector'
import AshbyChart from './components/AshbyChart'
import Benchmark from './components/Benchmark'

const TABS = [
  { id: 'select', label: 'Search', icon: Search },
  { id: 'pt', label: 'Periodic Table', icon: Grid3x3 },
  { id: 'map', label: 'Classification Map', icon: ScatterChart },
  { id: 'ashby', label: 'Ashby Chart', icon: LineChart },
  { id: 'desc', label: 'Descriptors', icon: BookOpen },
  { id: 'bench', label: 'Benchmark', icon: BarChart3 },
  { id: 'upload', label: 'Upload', icon: UploadCloud },
]

export default function App() {
  const [tab, setTab] = useState('select')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])
  const [elements, setElements] = useState(null)
  const [groups, setGroups] = useState(null)
  const [labels, setLabels] = useState(null)
  const [pairs, setPairs] = useState(null)
  const [axes, setAxes] = useState(null)
  const [dft, setDft] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('./data/elements.json').then(r => r.json()),
      fetch('./data/property_groups.json').then(r => r.json()),
      fetch('./data/prop_labels.json').then(r => r.json()),
      fetch('./data/pairs.json').then(r => r.json()),
      fetch('./data/property_axes.json').then(r => r.json()),
      fetch('./data/dft_by_system.json').then(r => r.json()).catch(() => ({})),
    ]).then(([e, g, l, p, a, d]) => { setElements(e); setGroups(g); setLabels(l); setPairs(p); setAxes(a); setDft(d || {}) })
      .catch(err => console.error('data load failed', err))
  }, [])

  const ready = elements && groups && pairs && labels && axes
  const nStable = dft ? Object.values(dft).reduce((s, v) => s + (v.n_stable || 0), 0) : 0

  return (
    <div className="min-h-full">
      <header className="border-b border-[var(--border)] bg-[var(--header)] backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-3">
          <Compass className="text-[var(--accent)]" size={28} />
          <div>
            <div className="font-extrabold text-xl leading-tight grad-text">COMPASS</div>
            <div className="text-[11px] text-[var(--dim)] leading-tight">
              One-stop binary-alloy explorer · 970 ground-truth systems · {dft ? `${Object.keys(dft).length} linked to MP / OQMD / JARVIS DFT` : 'multi-source DFT'}
            </div>
          </div>
          <nav className="ml-auto flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                    ${tab === t.id ? 'chip-grad text-[var(--text)] font-medium' : 'text-[var(--dim)] hover:bg-[var(--panel2)]'}`}>
                  <Icon size={16} /> <span className="hidden md:inline">{t.label}</span>
                </button>
              )
            })}
            <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              title="Toggle light / dark mode"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--dim)] hover:bg-[var(--panel2)]">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-5 py-6">
        {!ready ? (
          <div className="text-[var(--dim)] py-20 text-center">Loading data…</div>
        ) : (
          <>
            {tab === 'select' && <Selector pairs={pairs} elements={elements} axes={axes} dft={dft} onTab={setTab} />}
            {tab === 'pt' && <PeriodicTable elements={elements} pairs={pairs} groups={groups} labels={labels} dft={dft} />}
            {tab === 'desc' && <Descriptors />}
            {tab === 'bench' && <Benchmark />}
            {tab === 'map' && <ClassMap pairs={pairs} dft={dft} />}
            {tab === 'ashby' && <AshbyChart elements={elements} axes={axes} pairs={pairs} dft={dft} />}
            {tab === 'upload' && <Upload />}
          </>
        )}
      </main>

      <footer className="max-w-[1400px] mx-auto px-5 py-6 text-xs text-[var(--dim)] border-t border-[var(--border)] mt-8">
        <span className="grad-text font-semibold">COMPASS</span> · 970 ground-truth binary phase classifications
        (isomorphous / partial / immiscible / intermetallic) · orbital/Hume-Rothery descriptors COMPASS-9 (D₁–D₈ + D₁₃), optional
        bonding descriptors D₉–D₁₂ · {nStable.toLocaleString()} DFT-stable compounds linked from Materials Project, OQMD &amp; JARVIS ·
        predictions out-of-fold (XGBoost / MAGPIE) · benchmark numbers from the paper's leave-one-element-out study · Built with React + Vite.
      </footer>
    </div>
  )
}
