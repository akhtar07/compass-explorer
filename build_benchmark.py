#!/usr/bin/env python3
"""build_benchmark.py -- generate public/data/benchmark.json from the paper's
advanced-ML summary (adv_summary.json). No number on the Benchmark tab is
hand-typed in JSX; everything is read from this file.

Usage:
    python3 build_benchmark.py [path/to/adv_summary.json]

Default source: ../data/processed/ml/adv/adv_summary.json (paper repo layout).
Protocol behind every number: XGBoost (or the named learner) one-vs-rest,
leave-one-element-out (69 folds) over the 970 ground-truth binary systems;
95 % CIs are element-cluster bootstraps.
"""
import json
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / 'data/processed/ml/adv/adv_summary.json'
OUT = HERE / 'public/data/benchmark.json'

adv = json.load(open(SRC))
S = adv['summary']
CLASSES = ['isomorphous', 'partial', 'immiscible', 'intermetallic']


def r3(x):
    return None if x is None else round(float(x), 3)


def row(key, label, group, note=None):
    s = S[key]
    return {
        'key': key,
        'label': label,
        'group': group,
        'n': s.get('n'),
        'macro_f1': r3(s['macro_f1']),
        'ci95': [r3(v) for v in s['ci95']] if s.get('ci95') else None,
        'per_class_f1': {c: r3(s['per_class_f1'][c]) for c in CLASSES},
        'ece': r3(s.get('ece_mean')),
        'note': note,
    }


# ---- headline ladder (XGBoost, LOEO) -------------------------------------
ladder = [
    row('Hume-Rothery (rule)', 'Hume-Rothery rule', 'baseline', 'fixed rule; never predicts partial'),
    row('xgb|e/a (VEC)', 'e/a (VEC)', 'baseline'),
    row('xgb|Miedema', 'Miedema', 'baseline', 'Miedema parameters cover 931 of the 970 pairs'),
    row('xgb|COMPASS-9', 'COMPASS-9', 'compass'),
    row('xgb|MAGPIE', 'MAGPIE', 'magpie'),
    row('xgb|COMPASS-9+hull', 'COMPASS-9 + DFT-hull', 'compass'),
    row('xgb|MAGPIE+DFT-hull', 'MAGPIE + DFT-hull', 'magpie'),
]

# ---- learner x feature-set matrix ----------------------------------------
LEARNERS = [
    ('xgb', 'XGBoost'),
    ('optuna', 'XGBoost, nested Optuna'),
    ('chain', 'Classifier chains (ECC)'),
    ('mlp', 'Joint MLP'),
    ('ebm', 'EBM (GA²M)'),
    ('tabpfn', 'TabPFN v2'),
]
FEATURE_SETS = [
    ('COMPASS-9', 'COMPASS-9'),
    ('COMPASS-9+hull', 'COMPASS-9 + DFT-hull'),
    ('MAGPIE', 'MAGPIE'),
    ('MAGPIE+DFT-hull', 'MAGPIE + DFT-hull'),
]
learners = []
for lk, ll in LEARNERS:
    cells = {}
    for fk, _ in FEATURE_SETS:
        s = S.get(f'{lk}|{fk}')
        if s:
            cells[fk] = {'macro_f1': r3(s['macro_f1']),
                         'ci95': [r3(v) for v in s['ci95']] if s.get('ci95') else None,
                         'ece': r3(s.get('ece_mean'))}
    learners.append({'key': lk, 'label': ll, 'cells': cells})

# best-calibrated learner on MAGPIE+DFT-hull (lowest ECE)
cal = [(l['key'], l['label'], l['cells']['MAGPIE+DFT-hull']['ece'])
       for l in learners if 'MAGPIE+DFT-hull' in l['cells'] and l['cells']['MAGPIE+DFT-hull']['ece'] is not None]
best_cal = min(cal, key=lambda t: t[2]) if cal else None

# ---- paired deltas of interest -------------------------------------------
P = adv.get('paired', {})
PAIRED_KEYS = [
    'COMPASS-9 -> MAGPIE',
    'MAGPIE -> COMPASS-9+hull',
    'COMPASS-9+hull -> MAGPIE+DFT-hull',
    'MAGPIE -> MAGPIE+DFT-hull',
    'COMPASS-9 -> COMPASS-9+hull',
]
paired = []
for k in PAIRED_KEYS:
    if k in P:
        p = P[k]
        paired.append({'name': k, 'delta': r3(p['delta']), 'ci95': [r3(v) for v in p['ci95']],
                       'p_le_0': r3(p.get('p_le_0')), 'n': p.get('n')})

# learner-dependence of the COMPASS-9+hull vs MAGPIE+DFT-hull comparison
tie = []
for lk, ll in LEARNERS:
    a, b = S.get(f'{lk}|COMPASS-9+hull'), S.get(f'{lk}|MAGPIE+DFT-hull')
    if a and b:
        tie.append({'learner': lk, 'label': ll, 'compass_hull': r3(a['macro_f1']),
                    'magpie_hull': r3(b['macro_f1']), 'gap': r3(a['macro_f1'] - b['macro_f1'])})

# ---- leave-one-family-out ------------------------------------------------
L = adv.get('lofo', {})
lofo = {k: {'mean_lofo': r3(v['mean_lofo']), 'mean_loeo_same_pairs': r3(v['mean_loeo_same_pairs'])}
        for k, v in L.items()}

# ---- y-scramble null, label-noise screen, conformal ----------------------
ys = adv.get('yscramble_agg', {})
yscramble = {k: {'mean': r3(v['mean']), 'max': r3(v['max'])} for k, v in ys.items()}
ln = adv.get('label_noise', {})
flags = ln.get('flags', [])
label_noise = {'n_flags': len(flags), 'n_pairs': len({f['pair'] for f in flags}),
               'members': ln.get('members'), 'thresholds': ln.get('thresholds')}
C = adv.get('conformal', {})
conformal = {k: {'alpha': v.get('alpha'),
                 'coverage': {c: r3(v[c]['coverage']) for c in CLASSES if c in v},
                 'joint_all4_covered': r3(v.get('joint_all4_covered'))}
             for k, v in C.items()}

# ---- threshold-free metrics (adv_threshold_free.py -> threshold_free.json) ----
TF_SRC = SRC.parent / 'threshold_free.json'
tf = json.load(open(TF_SRC)) if TF_SRC.exists() else None
threshold_free = None
if tf:
    auc = {}
    for k, v in tf['auc'].items():
        auc[k] = {'macro_roc': r3(v['macro']['roc_auc']), 'macro_roc_ci95': [r3(x) for x in v['macro']['roc_ci95']],
                  'macro_pr': r3(v['macro']['pr_auc']), 'macro_pr_ci95': [r3(x) for x in v['macro']['pr_ci95']],
                  'per_class': {c: {'roc': r3(v[c]['roc_auc']), 'pr': r3(v[c]['pr_auc']),
                                    'prevalence': r3(v[c]['prevalence'])} for c in CLASSES}}
    auc_paired = {k: {'n': v['n'],
                      'roc': {'delta': r3(v['roc']['delta']), 'ci95': [r3(x) for x in v['roc']['ci95']]},
                      'pr': {'delta': r3(v['pr']['delta']), 'ci95': [r3(x) for x in v['pr']['ci95']]}}
                  for k, v in tf['auc_paired'].items()}
    sweep = {k: {'thresholds': v['thresholds'], 'macro_f1': [r3(x) for x in v['macro_f1']]}
             for k, v in tf['sweep'].items()}
    crossfit = {k: {'n': v['n'], 'f1_fixed': r3(v['macro_f1_fixed_0.5']), 'f1_crossfit': r3(v['macro_f1_crossfit']),
                    'delta': r3(v['delta_crossfit_minus_fixed']), 'delta_ci95': [r3(x) for x in v['delta_ci95']],
                    'median_thresholds': v['median_thresholds'], 'f1_insample_opt': r3(v['macro_f1_insample_optimum']),
                    'insample_thresholds': v['insample_thresholds']} for k, v in tf['crossfit'].items()}
    reliability = {k: {'ece_mean': r3(v['ece_mean']),
                       'classes': {c: {'mean_pred': [r3(x) if x is not None else None for x in v[c]['mean_pred']],
                                       'obs_freq': [r3(x) if x is not None else None for x in v[c]['obs_freq']],
                                       'count': v[c]['count'], 'ece': r3(v[c]['ece'])} for c in CLASSES}}
                   for k, v in tf['reliability'].items()}
    threshold_free = {'source': 'data/processed/ml/adv/threshold_free.json', 'n_boot': tf['n_boot'],
                      'n_clusters': tf['n_clusters'], 'auc': auc, 'auc_paired': auc_paired, 'sweep': sweep,
                      'crossfit': crossfit, 'reliability': reliability}

out = {
    'generated': {'date': date.today().isoformat(), 'script': 'build_benchmark.py',
                  'source': 'data/processed/ml/adv/adv_summary.json'},
    'threshold_free': threshold_free,
    'protocol': ('One-vs-rest multi-label classification over the 970 ground-truth binary systems; '
                 'leave-one-element-out cross-validation (69 folds); macro-F1 over the four classes '
                 'isomorphous / partial / immiscible / intermetallic; 95 % CI = element-cluster bootstrap.'),
    'classes': CLASSES,
    'n_pairs': S['xgb|COMPASS-9']['n'],
    'ladder': ladder,
    'feature_sets': [{'key': k, 'label': l} for k, l in FEATURE_SETS],
    'learners': learners,
    'best_calibrated': {'learner': best_cal[0], 'label': best_cal[1], 'ece': best_cal[2]} if best_cal else None,
    'paired': paired,
    'hull_tie_by_learner': tie,
    'lofo': lofo,
    'yscramble': yscramble,
    'label_noise': label_noise,
    'conformal': conformal,
}
json.dump(out, open(OUT, 'w'), indent=1)
print(f'wrote {OUT}: ladder={len(ladder)} rows, learners={len(learners)}, paired={len(paired)}')
for r in ladder:
    print(f"  {r['label']:24s} {r['macro_f1']:.3f}  n={r['n']}")
