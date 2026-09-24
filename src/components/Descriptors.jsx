import React, { useMemo } from 'react'
import { BookOpen, Sigma } from 'lucide-react'
import { CLASSES, CLASS_COLOR, CLASS_LABEL, dominantClass } from '../lib/util'

const D = [
  { id:'D1', name:'Dominant-orbital energy mismatch', img:'d1_mismatch.png',
    formula:'D₁ = |ε_l̂A − ε_l̂B|',
    desc:'Energy gap between the dominant (highest-occupied, priority d>p>s) valence orbitals of A and B, from PAW-PBE free-atom eigenvalues.' },
  { id:'D2', name:'Bond-weighted multi-orbital mismatch', img:'d2_weighted.png',
    formula:'D₂ = Σ nₗᴬ nₗ′ᴮ |εₗᴬ − εₗ′ᴮ| / Σ nₗᴬ nₗ′ᴮ',
    desc:'Occupation-weighted average energy mismatch over all occupied valence orbitals — captures the deep filled-d manifolds the single-orbital D₁ misses.' },
  { id:'D3', name:'Mean dominant-orbital energy', img:'d3_mean.png',
    formula:'D₃ = ½(ε_l̂A + ε_l̂B)',
    desc:'Average absolute energy of the two dominant valence orbitals — sets the common energy scale of the pair.' },
  { id:'D4', name:'Valence-character similarity', img:'d4_cosine.png',
    formula:'D₄ = (vᴬ·vᴮ)/(|vᴬ||vᴮ|),  v = [n_s,n_p,n_d]',
    desc:'Cosine similarity of the valence-electron vectors: 1 = identical orbital character (favours solid solution), 0 = orthogonal (favours compounds).' },
  { id:'D5', name:'Harrison coupling', img:'d5_harrison.png',
    formula:'D₅ = |H_AB|',
    desc:'Dominant inter-atomic Harrison hopping magnitude between A and B, from the universal η constants and the bond length d = r_mA + r_mB.' },
  { id:'D6', name:'Bond-stabilization energy', img:'d6_bond.png',
    formula:'D₆ = n_b|H_AB|² / √(D₁² + 4|H_AB|²)',
    desc:'Two-level bonding stabilization (half-filled n_b = 0.5) — correlates with the DFT/LOBSTER |ICOHP| (r = 0.88 for pure metals).' },
  { id:'D7', name:'Size mismatch (Hume–Rothery)', formula:'D₇ = (r_mA − r_mB)/(r_mA + r_mB)',
    desc:'Relative metallic-radius difference — the quantitative form of the classical 15 % solid-solubility rule.' },
  { id:'D8', name:'Electronegativity difference', formula:'D₈ = |χᴬ − χᴮ|  (Allred–Rochow)',
    desc:'Charge-transfer driving force for compound formation — the electronegativity leg of the Hume–Rothery rules.' },
  { id:'D9', name:'Geometric-mean cohesion', formula:'D₉ = √(|ICOHP_A|·|ICOHP_B|)', bonding:true,
    desc:'Geometric mean of the elemental nearest-neighbour bond strengths (DFT/LOBSTER |ICOHP|) — the cohesion scale of the pair.' },
  { id:'D10', name:'Cohesion mismatch', formula:'D₁₀ = ||ICOHP_A| − |ICOHP_B||', bonding:true,
    desc:'Absolute difference in elemental bond strength — large mismatch disfavours a common solid solution.' },
  { id:'D11', name:'Geometric-mean bond order', formula:'D₁₁ = √(ICOBI_A·ICOBI_B)', bonding:true,
    desc:'Geometric mean of the elemental Crystal-Orbital Bond Indices — the electron-sharing (covalency) scale. Top predictor of the immiscible class.' },
  { id:'D12', name:'Bond-order mismatch', formula:'D₁₂ = |ICOBI_A − ICOBI_B|', bonding:true,
    desc:'Absolute difference in elemental bond order between A and B.' },
  { id:'D13', name:'Periodic-group distance', noimg:true,
    formula:'D₁₃ = |G_A − G_B|',
    desc:'Absolute difference in periodic-table group (column) number between A and B — a cheap, DFT-free measure of valence-count separation. Part of COMPASS-9; it is the root split of the immiscible and intermetallic decision rules (see "Why this classification" on any system page).' },
]
const NBINS = 24

// per-class histogram of one descriptor over the ground-truth set (dominant class per pair)
function classHist(pairs, id) {
  const vals = []
  pairs.forEach(p => { const v = p.D?.[id]; if (v == null || isNaN(v)) return; vals.push([v, dominantClass(p.truth)]) })
  if (!vals.length) return null
  let lo = Infinity, hi = -Infinity
  vals.forEach(([v]) => { if (v < lo) lo = v; if (v > hi) hi = v })
  const span = hi - lo || 1
  const bins = Object.fromEntries(CLASSES.map(c => [c, new Array(NBINS).fill(0)]))
  const n = Object.fromEntries(CLASSES.map(c => [c, 0]))
  vals.forEach(([v, c]) => { if (!c) return; const b = Math.min(NBINS - 1, Math.floor((v - lo) / span * NBINS)); bins[c][b]++; n[c]++ })
  // normalise each class to its own peak so shape (not prevalence) is compared
  const rows = CLASSES.map(c => { const mx = Math.max(1, ...bins[c]); return { c, n: n[c], w: bins[c].map(x => x / mx) } })
  return { lo, hi, rows, total: vals.length }
}
const tick = v => Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)

function StripChart({ h }) {
  if (!h) return <div className="text-[10.5px] text-[var(--faint)] mt-2">no values in the 970-pair set</div>
  const W = 240, rowH = 9, gap = 2, left = 0, H = CLASSES.length * (rowH + gap) + 14
  const bw = W / NBINS
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--dim)] mb-1">
        <span>distribution by ground-truth class</span>
        <span className="mono">n = {h.total}</span>
      </div>
      <svg viewBox={`0 0 ${W + 70} ${H}`} className="w-full" style={{ maxHeight: 70 }} role="img" aria-label="per-class histogram">
        {h.rows.map((r, i) => {
          const y = i * (rowH + gap)
          return (
            <g key={r.c}>
              <rect x={left} y={y} width={W} height={rowH} fill="var(--cell)" rx="2" />
              {r.w.map((v, b) => v > 0 && <rect key={b} x={left + b * bw} y={y} width={Math.max(bw - 0.4, 0.6)} height={rowH} fill={CLASS_COLOR[r.c]} opacity={0.2 + 0.8 * v} />)}
              <text x={W + 5} y={y + rowH - 1.5} fontSize="7.5" fill={CLASS_COLOR[r.c]} fontFamily="Inter, sans-serif">{CLASS_LABEL[r.c].split(' ')[0]}</text>
              <text x={W + 68} y={y + rowH - 1.5} fontSize="7" fill="var(--faint)" textAnchor="end" fontFamily="JetBrains Mono, monospace">{r.n}</text>
            </g>
          )
        })}
        <text x={left} y={H - 2} fontSize="7.5" fill="var(--dim)" fontFamily="JetBrains Mono, monospace">{tick(h.lo)}</text>
        <text x={W} y={H - 2} fontSize="7.5" fill="var(--dim)" textAnchor="end" fontFamily="JetBrains Mono, monospace">{tick(h.hi)}</text>
      </svg>
    </div>
  )
}

export default function Descriptors({ pairs = [] }) {
  const hists = useMemo(() => Object.fromEntries(D.map(d => [d.id, classHist(pairs, d.id)])), [pairs])
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[.12em] text-[var(--dim)]"><BookOpen size={13} className="text-[var(--accent)]" /> Descriptor definitions</div>
        <p className="text-[var(--dim)] text-sm max-w-3xl leading-relaxed">
          COMPASS describes each binary pair (A, B) with physically-motivated descriptors. The benchmarked
          set is <b className="text-[var(--text)]">COMPASS-9</b> = D₁–D₈ + D₁₃: D₁–D₈ are orbital/Hume–Rothery descriptors from Harrison
          tight-binding theory and free-atom data, and D₁₃ is a cheap periodic-group descriptor; none needs DFT.
          D₉–D₁₂ are optional first-principles bonding descriptors from DFT + LOBSTER (|ICOHP| and ICOBI),
          available for the subset of systems whose elements have LOBSTER data. See the Benchmark tab for
          how COMPASS-9 compares with MAGPIE and the classical rules on the 970 ground-truth systems.
          Each card ends with the descriptor's distribution over the ground-truth set, one strip per dominant class
          (each strip scaled to its own peak so the shapes compare, counts at right).
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {D.map(d => (
          <div key={d.id} className="card p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-extrabold grad-text mono">{d.id}</span>
              <span className="text-sm text-[var(--text)]">{d.name}</span>
              <span className="ml-auto badge" style={d.bonding
                ? { background: 'color-mix(in srgb, #f59e0b 16%, transparent)', color: '#d97706' }
                : { background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)' }}>{d.bonding ? 'DFT/LOBSTER' : 'COMPASS-9'}</span>
            </div>
            {!d.noimg && (
              <div className="rounded-lg mt-1 mb-2 flex justify-center bg-white/95 p-1">
                <img src={`./descr/${d.id}.png`} alt={`${d.id} schematic`} className="w-full object-contain max-h-32" />
              </div>
            )}
            <div className="mono text-[12px] rounded-lg px-2 py-1 mb-2 overflow-x-auto flex items-center gap-2" style={{ background: 'var(--panel2)', color: 'var(--accent3)' }}><Sigma size={12} className="shrink-0 opacity-70" /> {d.formula}</div>
            <p className="text-xs text-[var(--dim)] leading-relaxed">{d.desc}</p>
            <div className="mt-auto"><StripChart h={hists[d.id]} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
