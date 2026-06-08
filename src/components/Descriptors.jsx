import React from 'react'

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
]

export default function Descriptors() {
  return (
    <div>
      <p className="text-[var(--dim)] text-sm mb-4 max-w-3xl">
        COMPASS uses twelve physically-motivated descriptors per binary pair (A, B). D₁–D₈ are
        orbital/Hume–Rothery descriptors from Harrison tight-binding theory and free-atom data;
        D₉–D₁₂ are first-principles bonding descriptors from DFT + LOBSTER (|ICOHP| and ICOBI).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {D.map(d => (
          <div key={d.id} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold text-sky-300">{d.id}</span>
              <span className="text-sm text-[var(--text)]">{d.name}</span>
              {d.bonding && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">DFT/LOBSTER</span>}
            </div>
            <div className="rounded mt-1 mb-2 flex justify-center">
              <img src={`./descr/${d.id}.png`} alt={`${d.id} schematic`} className="w-full object-contain max-h-32" />
            </div>
            <div className="font-mono text-[12px] text-emerald-300 bg-[var(--panel2)] rounded px-2 py-1 mb-2 overflow-x-auto">{d.formula}</div>
            <p className="text-xs text-[var(--dim)] leading-relaxed">{d.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
