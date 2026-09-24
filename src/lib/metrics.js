// Client-side evaluation utilities operating on the stored out-of-fold probabilities
// (public/data/predictions.json). Implementations follow scikit-learn's definitions so
// the numbers reproduce the paper's tables: roc_auc_score (trapezoid over the ROC),
// average_precision_score (step-wise sum), f1_score with zero_division=0.

export const CLASSES = ['isomorphous', 'partial', 'immiscible', 'intermetallic']

// scores: number[] (may contain null), labels: 0/1[]  -> { points:[{fpr,tpr,thr}], auc }
export function rocCurve(scores, labels) {
  const rows = []
  for (let i = 0; i < scores.length; i++) if (scores[i] != null) rows.push([scores[i], labels[i]])
  rows.sort((a, b) => b[0] - a[0])
  const P = rows.reduce((s, r) => s + r[1], 0), N = rows.length - P
  if (!P || !N) return { points: [], auc: NaN }
  const pts = [{ fpr: 0, tpr: 0, thr: Infinity }]
  let tp = 0, fp = 0, auc = 0
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1]) tp++; else fp++
    if (i === rows.length - 1 || rows[i + 1][0] !== rows[i][0]) {
      const prev = pts[pts.length - 1], p = { fpr: fp / N, tpr: tp / P, thr: rows[i][0] }
      auc += (p.fpr - prev.fpr) * (p.tpr + prev.tpr) / 2
      pts.push(p)
    }
  }
  return { points: pts, auc }
}

// precision-recall curve + average precision (sklearn definition)
export function prCurve(scores, labels) {
  const rows = []
  for (let i = 0; i < scores.length; i++) if (scores[i] != null) rows.push([scores[i], labels[i]])
  rows.sort((a, b) => b[0] - a[0])
  const P = rows.reduce((s, r) => s + r[1], 0)
  if (!P) return { points: [], ap: NaN, prevalence: 0 }
  const pts = []
  let tp = 0, fp = 0, ap = 0, prevR = 0
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1]) tp++; else fp++
    if (i === rows.length - 1 || rows[i + 1][0] !== rows[i][0]) {
      const r = tp / P, pr = tp / (tp + fp)
      ap += (r - prevR) * pr; prevR = r
      pts.push({ recall: r, precision: pr, thr: rows[i][0] })
    }
  }
  pts.push({ recall: 0, precision: 1, thr: Infinity })
  pts.reverse()
  return { points: pts, ap, prevalence: P / rows.length }
}

export function f1(yTrue, yPred) {
  let tp = 0, fp = 0, fn = 0
  for (let i = 0; i < yTrue.length; i++) {
    if (yPred[i] && yTrue[i]) tp++; else if (yPred[i]) fp++; else if (yTrue[i]) fn++
  }
  const d = 2 * tp + fp + fn
  return d ? 2 * tp / d : 0
}

// P: n x 4 probabilities (rows may be null for a missing pair), Y: n x 4 truth,
// thr: number or [4] -> { perClass:[4], macro, n }
export function f1AtThreshold(P, Y, thr) {
  const t = Array.isArray(thr) ? thr : [thr, thr, thr, thr]
  const per = [], keep = []
  for (let i = 0; i < P.length; i++) if (P[i] && P[i].every(v => v != null)) keep.push(i)
  for (let c = 0; c < 4; c++) {
    per.push(f1(keep.map(i => Y[i][c]), keep.map(i => P[i][c] >= t[c] ? 1 : 0)))
  }
  return { perClass: per, macro: per.reduce((a, b) => a + b, 0) / 4, n: keep.length }
}

// confusion counts for one class at a threshold
export function confusion(scores, labels, thr) {
  let tp = 0, fp = 0, fn = 0, tn = 0
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] == null) continue
    const p = scores[i] >= thr ? 1 : 0
    if (p && labels[i]) tp++; else if (p) fp++; else if (labels[i]) fn++; else tn++
  }
  return { tp, fp, fn, tn }
}

// z-scored k-nearest systems in descriptor space
export function nearestSystems(pairs, target, keys, k = 6) {
  const rows = pairs.filter(p => keys.every(d => p.D?.[d] != null))
  if (!keys.every(d => target.D?.[d] != null) || rows.length < 2) return []
  const mu = {}, sd = {}
  keys.forEach(d => {
    const v = rows.map(p => p.D[d]); const m = v.reduce((a, b) => a + b, 0) / v.length
    mu[d] = m; sd[d] = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1
  })
  const z = p => keys.map(d => (p.D[d] - mu[d]) / sd[d])
  const zt = z(target)
  return rows.filter(p => p.pair !== target.pair)
    .map(p => { const zp = z(p); const dist = Math.sqrt(zp.reduce((s, v, i) => s + (v - zt[i]) ** 2, 0)); return { pair: p, dist } })
    .sort((a, b) => a.dist - b.dist).slice(0, k)
}

export const fmt3 = v => (v == null || isNaN(v)) ? '—' : (+v).toFixed(3)
export const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3)
