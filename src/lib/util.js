// Viridis colormap (10-stop) for property heatmap overlays
const VIRIDIS = [
  [68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],
  [31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37],
]
export function viridis(t) {
  if (t == null || isNaN(t)) return '#2a3350'
  t = Math.max(0, Math.min(1, t))
  const x = t * (VIRIDIS.length - 1), i = Math.floor(x), f = x - i
  const a = VIRIDIS[i], b = VIRIDIS[Math.min(i + 1, VIRIDIS.length - 1)]
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export const CLASSES = ['isomorphous', 'partial', 'immiscible', 'intermetallic']
export const CLASS_COLOR = {
  isomorphous: '#22c55e', partial: '#f59e0b', immiscible: '#ef4444', intermetallic: '#3b82f6',
}
export const CLASS_LABEL = {
  isomorphous: 'Isomorphous', partial: 'Partial solubility',
  immiscible: 'Immiscible', intermetallic: 'Intermetallic',
}
const PRIORITY = ['intermetallic', 'immiscible', 'partial', 'isomorphous']
export function dominantClass(labels) {
  if (!labels || !labels.length) return null
  return PRIORITY.find(c => labels.includes(c)) || null
}

export function prettyProp(p, labels) {
  if (labels && labels[p]) return labels[p]
  return p.replace(/^MAGPIE_/, '').replace(/^JARVIS_/, '').replace(/_/g, ' ')
}

export function textOn(t) {
  if (t == null || isNaN(t)) return '#8893b5'
  return t > 0.55 ? '#0b1020' : '#eef2ff'
}

export function fmt(v) {
  if (v == null || (typeof v === 'number' && isNaN(v))) return '–'
  if (typeof v !== 'number') return v
  return Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(3)
}

// ground-state crystal structure from space-group number (text-colour encoding)
export function sgToStructure(sg) {
  if (sg == null || isNaN(sg)) return null
  const m = {
    225: 'FCC', 229: 'BCC', 194: 'HCP', 227: 'Diamond', 166: 'Rhombohedral',
    139: 'Tetragonal', 141: 'Tetragonal', 136: 'Tetragonal', 64: 'Orthorhombic',
    63: 'Orthorhombic', 152: 'Trigonal', 154: 'Trigonal', 217: 'α-Mn',
    221: 'Simple cubic', 191: 'Hexagonal', 12: 'Monoclinic', 70: 'Orthorhombic',
  }
  return m[Math.round(sg)] || 'Other'
}
// text colours chosen distinct from the four phase-box hues (green/orange/red/blue)
export const STRUCT_COLOR = {
  FCC: '#e879f9', BCC: '#22d3ee', HCP: '#fde047', Diamond: '#f8fafc',
  Rhombohedral: '#c084fc', Tetragonal: '#5eead4', Orthorhombic: '#fb7185',
  Trigonal: '#a5f3fc', 'α-Mn': '#bef264', 'Simple cubic': '#fca5a5',
  Hexagonal: '#fde047', Monoclinic: '#fdba74', Other: '#cbd5e1',
}
export const STRUCT_ORDER = ['FCC','BCC','HCP','Diamond','Rhombohedral','Tetragonal','Orthorhombic','Trigonal','Other']
