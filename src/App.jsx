import React, { useEffect, useState } from 'react'
import { Grid3x3, ArrowLeftRight, ScatterChart, UploadCloud, Compass } from 'lucide-react'
import PeriodicTable from './components/PeriodicTable'
import PairExplorer from './components/PairExplorer'
import ClassMap from './components/ClassMap'
import Upload from './components/Upload'

const TABS = [
  { id: 'pt', label: 'Periodic Table', icon: Grid3x3 },
  { id: 'pair', label: 'Pair Explorer', icon: ArrowLeftRight },
  { id: 'map', label: 'Classification Map', icon: ScatterChart },
  { id: 'upload', label: 'Upload Diagram', icon: UploadCloud },
]

export default function App() {
  const [tab, setTab] = useState('pt')
  const [elements, setElements] = useState(null)
  const [groups, setGroups] = useState(null)
  const [pairs, setPairs] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('./data/elements.json').then(r => r.json()),
      fetch('./data/property_groups.json').then(r => r.json()),
      fetch('./data/pairs.json').then(r => r.json()),
    ]).then(([e, g, p]) => { setElements(e); setGroups(g); setPairs(p) })
      .catch(err => console.error('data load failed', err))
  }, [])

  const ready = elements && groups && pairs

  return (
    <div className="min-h-full">
      <header className="border-b border-[#1c2440] bg-[#0d1326]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-3">
          <Compass className="text-sky-400" size={26} />
          <div>
            <div className="font-semibold text-lg leading-tight">COMPASS</div>
            <div className="text-[11px] text-slate-400 leading-tight">
              Orbital + bonding descriptors for binary-alloy phase behaviour · 48 elements · 610 hand-verified pairs
            </div>
          </div>
          <nav className="ml-auto flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                    ${tab === t.id ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:bg-white/5'}`}>
                  <Icon size={16} /> <span className="hidden sm:inline">{t.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-5 py-6">
        {!ready ? (
          <div className="text-slate-400 py-20 text-center">Loading data…</div>
        ) : (
          <>
            {tab === 'pt' && <PeriodicTable elements={elements} groups={groups} />}
            {tab === 'pair' && <PairExplorer elements={elements} pairs={pairs} />}
            {tab === 'map' && <ClassMap pairs={pairs} />}
            {tab === 'upload' && <Upload />}
          </>
        )}
      </main>

      <footer className="max-w-[1400px] mx-auto px-5 py-6 text-xs text-slate-500 border-t border-[#1c2440] mt-8">
        COMPASS Explorer · descriptors D1–D12 (Harrison tight-binding + DFT/LOBSTER) · predictions are precomputed
        out-of-fold (XGBoost, D1–D12). Built with React + Vite.
      </footer>
    </div>
  )
}
