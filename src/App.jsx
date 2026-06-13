import React, { useEffect, useState } from 'react'
import { Grid3x3, BookOpen, ScatterChart, UploadCloud, Compass, Sun, Moon } from 'lucide-react'
import PeriodicTable from './components/PeriodicTable'
import Descriptors from './components/Descriptors'
import ClassMap from './components/ClassMap'
import Upload from './components/Upload'

const TABS = [
  { id: 'pt', label: 'Periodic Table', icon: Grid3x3 },
  { id: 'desc', label: 'Descriptors', icon: BookOpen },
  { id: 'map', label: 'Classification Map', icon: ScatterChart },
  { id: 'upload', label: 'Upload Diagram', icon: UploadCloud },
]

export default function App() {
  const [tab, setTab] = useState('pt')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])
  const [elements, setElements] = useState(null)
  const [groups, setGroups] = useState(null)
  const [labels, setLabels] = useState(null)
  const [pairs, setPairs] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('./data/elements.json').then(r => r.json()),
      fetch('./data/property_groups.json').then(r => r.json()),
      fetch('./data/prop_labels.json').then(r => r.json()),
      fetch('./data/pairs.json').then(r => r.json()),
    ]).then(([e, g, l, p]) => { setElements(e); setGroups(g); setLabels(l); setPairs(p) })
      .catch(err => console.error('data load failed', err))
  }, [])

  const ready = elements && groups && pairs && labels

  return (
    <div className="min-h-full">
      <header className="border-b border-[var(--border)] bg-[var(--header)] backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-3">
          <Compass className="text-sky-400" size={26} />
          <div>
            <div className="font-semibold text-lg leading-tight">COMPASS</div>
            <div className="text-[11px] text-[var(--dim)] leading-tight">
              Computational Orbital-Mechanics Predictive Alloy Screening System · 610 hand-verified pairs
            </div>
          </div>
          <nav className="ml-auto flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                    ${tab === t.id ? 'bg-sky-500/20 text-sky-300' : 'text-[var(--dim)] hover:bg-white/5'}`}>
                  <Icon size={16} /> <span className="hidden sm:inline">{t.label}</span>
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
            {tab === 'pt' && <PeriodicTable elements={elements} pairs={pairs} groups={groups} labels={labels} />}
            {tab === 'desc' && <Descriptors />}
            {tab === 'map' && <ClassMap pairs={pairs} />}
            {tab === 'upload' && <Upload />}
          </>
        )}
      </main>

      <footer className="max-w-[1400px] mx-auto px-5 py-6 text-xs text-slate-500 border-t border-[var(--panel2)] mt-8">
        COMPASS · <span className="italic">Computational Orbital-Mechanics Predictive Alloy Screening System</span> ·
        Layer 1: pre-DFT orbital descriptors from free-atom data (Harrison tight-binding) ·
        Layer 2: DFT+LOBSTER mixing enthalpies &amp; ICOHP bonding maps ·
        610 hand-verified pairs · predictions precomputed out-of-fold (XGBoost) · Built with React + Vite.
      </footer>
    </div>
  )
}
