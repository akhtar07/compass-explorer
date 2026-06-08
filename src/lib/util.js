// Viridis colormap (8-stop interpolation) for heatmap overlays
const VIRIDIS = [
  [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142],
  [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89],
  [180, 222, 44], [253, 231, 37],
]
export function viridis(t) {
  if (t == null || isNaN(t)) return '#39405c'
  t = Math.max(0, Math.min(1, t))
  const x = t * (VIRIDIS.length - 1)
  const i = Math.floor(x), f = x - i
  const a = VIRIDIS[i], b = VIRIDIS[Math.min(i + 1, VIRIDIS.length - 1)]
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export const CLASSES = ['isomorphous', 'partial', 'immiscible', 'intermetallic']
export const CLASS_COLOR = {
  isomorphous: '#2ca02c', partial: '#ff7f0e',
  immiscible: '#d62728', intermetallic: '#1f77b4',
}
export const CLASS_SHORT = {
  isomorphous: 'Iso', partial: 'Partial', immiscible: 'Immis', intermetallic: 'Inter',
}

export function prettyProp(p) {
  return p.replace(/^MAGPIE_MagpieData /, '').replace(/^MAGPIE_/, '')
          .replace(/_/g, ' ').replace('EN allred rochow', 'Electronegativity (A-R)')
          .replace('r metallic', 'Metallic radius').replace('r d', 'Harrison r_d')
          .replace('valence s', 'Valence s').replace('valence p', 'Valence p').replace('valence d', 'Valence d')
}

// readable text color over a colored cell
export function textOn(t) {
  if (t == null || isNaN(t)) return '#9aa3bd'
  return t > 0.55 ? '#10151f' : '#eef2ff'
}
