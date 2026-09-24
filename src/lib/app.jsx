// Application-wide context: theme, hash router, core datasets, lazy datasets
// (predictions / interpretability / benchmark) and the global pin-to-compare set.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

// ---------------- hash router ----------------
// Routes:  #/            search (home)      #/search?q=Al-La
//          #/table  #/map  #/ashby  #/descriptors  #/benchmark  #/upload
//          #/pair/Ag-Al   #/compare/Ag-Al,Al-Ti
export function parseHash(h) {
  const s = (h || '').replace(/^#\/?/, '')
  const [pathPart, query = ''] = s.split('?')
  const seg = pathPart.split('/').filter(Boolean)
  const params = Object.fromEntries(new URLSearchParams(query))
  if (!seg.length) return { tab: 'search', params }
  if (seg[0] === 'pair' && seg[1]) return { tab: 'pair', pair: decodeURIComponent(seg[1]), params }
  if (seg[0] === 'compare') return { tab: 'compare', list: (seg[1] || '').split(',').filter(Boolean).map(decodeURIComponent), params }
  return { tab: seg[0], params }
}
export function toHash(tab, extra) {
  if (tab === 'pair') return `#/pair/${encodeURIComponent(extra)}`
  if (tab === 'compare') return `#/compare/${extra.map(encodeURIComponent).join(',')}`
  if (tab === 'search') return extra ? `#/search?q=${encodeURIComponent(extra)}` : '#/'
  return `#/${tab}`
}

export function AppProvider({ children }) {
  // theme
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'dark' } catch { return 'dark' } })
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

  // route
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on)
  }, [])
  const navigate = useCallback((tab, extra, replace = false) => {
    const h = toHash(tab, extra)
    if (window.location.hash === h) return
    if (replace) { history.replaceState(null, '', h); setRoute(parseHash(h)); return }
    window.location.hash = h
  }, [])
  const openPair = useCallback(key => navigate('pair', key), [navigate])
  const back = useCallback(() => { if (history.length > 1) history.back(); else navigate('search') }, [navigate])

  // core data
  const [core, setCore] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    Promise.all([
      fetch('./data/elements.json').then(r => r.json()),
      fetch('./data/property_groups.json').then(r => r.json()),
      fetch('./data/prop_labels.json').then(r => r.json()),
      fetch('./data/pairs.json').then(r => r.json()),
      fetch('./data/property_axes.json').then(r => r.json()),
      fetch('./data/dft_by_system.json').then(r => r.json()).catch(() => ({})),
    ]).then(([elements, groups, labels, pairs, axes, dft]) => setCore({ elements, groups, labels, pairs, axes, dft: dft || {} }))
      .catch(e => { console.error('data load failed', e); setErr(String(e)) })
  }, [])
  const pairIndex = useMemo(() => {
    const m = {}
    core?.pairs.forEach(p => { m[p.pair] = p; m[`${p.B}-${p.A}`] = p })
    return m
  }, [core])

  // lazy datasets
  const [lazy, setLazy] = useState({})
  const load = useCallback(name => {
    setLazy(prev => {
      if (prev[name]) return prev
      fetch(`./data/${name}.json`).then(r => r.json()).then(j => setLazy(p => ({ ...p, [name]: j })))
        .catch(e => console.error(name, e))
      return { ...prev, [name]: 'loading' }
    })
  }, [])
  const useLazy = name => { useEffect(() => { load(name) }, [name]); const v = lazy[name]; return v === 'loading' ? null : v || null }

  // pins (global, persisted)
  const [pinned, setPinned] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('pins') || '[]')) } catch { return new Set() } })
  useEffect(() => { try { localStorage.setItem('pins', JSON.stringify([...pinned])) } catch {} }, [pinned])
  const togglePin = useCallback(key => setPinned(prev => {
    const n = new Set(prev); if (n.has(key)) n.delete(key); else if (n.size < 6) n.add(key); return n
  }), [])
  const unpin = useCallback(key => setPinned(prev => { const n = new Set(prev); n.delete(key); return n }), [])
  const clearPins = useCallback(() => setPinned(new Set()), [])

  const value = useMemo(() => ({
    theme, setTheme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
    route, navigate, openPair, back,
    ...(core || {}), ready: !!core, error: err, pairIndex,
    useLazy, pinned, togglePin, unpin, clearPins,
  }), [theme, route, navigate, openPair, back, core, err, pairIndex, lazy, pinned, togglePin, unpin, clearPins])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

// ---------------- chart theme (Chart.js colours that follow light / dark) ----------------
export function useChartTheme() {
  const { theme } = useApp()
  return useMemo(() => theme === 'light'
    ? { ink: '#16203a', dim: '#51607c', grid: '#dfe6f5', panel: '#ffffff', faint: '#94a3b8', accent: '#0ea5e9', accent2: '#7c3aed', font: 'Inter, system-ui, sans-serif' }
    : { ink: '#e6e9f0', dim: '#9aa3bd', grid: '#26304e', panel: '#141b30', faint: '#5b6785', accent: '#38bdf8', accent2: '#a78bfa', font: 'Inter, system-ui, sans-serif' },
  [theme])
}

// convenience hooks for the lazily loaded files
export const usePredictions = () => useApp().useLazy('predictions')
export const useInterp = () => useApp().useLazy('interpretability')
export const useBenchmark = () => useApp().useLazy('benchmark')
