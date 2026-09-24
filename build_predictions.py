#!/usr/bin/env python3
"""build_predictions.py -- per-system out-of-fold model outputs for the explorer.

Reads the paper's stored leave-one-element-out probabilities
(data/processed/ml/adv/{base_xgb,models,models_tabpfn}.npz, written by advanced_ml.py)
and the label-noise screen (adv_summary.json), and writes

  public/data/predictions.json
      { "meta": {...},
        "sets": ["xgb|COMPASS-9", ...],                 # column order of every row
        "pairs": { "Ag-Al": { "p": [[p_iso,p_partial,p_immis,p_inter], ...per set],
                              "flags": [ {label, truth, consensus_p} ] } } }

and refreshes the `pred` / `prob` fields of public/data/pairs.json to the canonical
XGBoost-on-MAGPIE LOEO run (the number the paper reports), removing the old
`provisional` flag: every system is now a genuine out-of-fold prediction.

Run with the advml venv:  ../.venv_advml/bin/python build_predictions.py
"""
import json, sys
from datetime import date
from pathlib import Path
import numpy as np

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
import adv_common as C                                  # noqa: E402  (row order == paper)

ADV = C.H / 'data/processed/ml/adv'
CLASSES = C.CLASSES
SETS = [('base_xgb', 'xgb|', ['e/a (VEC)', 'Miedema', 'COMPASS-9', 'MAGPIE', 'COMPASS-9+hull', 'MAGPIE+DFT-hull']),
        ('models_tabpfn', '', ['tabpfn|COMPASS-9+hull', 'tabpfn|MAGPIE+DFT-hull']),
        ('models', '', ['chain|COMPASS-9+hull', 'chain|MAGPIE+DFT-hull'])]

P, order = {}, []
for npz, prefix, names in SETS:
    z = np.load(ADV / f'{npz}.npz', allow_pickle=True)
    have = [str(n) for n in z['names']]
    for n in names:
        key = n if prefix == '' else prefix + n
        src = n if prefix == '' else n
        P[key] = z['P'][have.index(src)]
        order.append(key)

pairs = list(C.df['pair'])
assert len(pairs) == C.N == 970

def r3(v):
    return None if (v is None or np.isnan(v)) else round(float(v), 4)

noise = json.load(open(ADV / 'adv_summary.json'))['label_noise']
flags = {}
for f in noise['flags']:
    flags.setdefault(f['pair'], []).append({'label': f['label'], 'truth': int(f['truth']),
                                            'consensus_p': round(float(f['consensus_p']), 3)})

out = {'meta': {'date': date.today().isoformat(), 'script': 'build_predictions.py',
                'protocol': 'Leave-one-element-out (69 folds) out-of-fold probabilities over the 970 '
                            'ground-truth systems; the paper\'s stored runs, no retraining. '
                            'Hard predictions use the 0.5 operating point.',
                'classes': CLASSES, 'n_pairs': C.N,
                'label_noise': {'members': noise['members'], 'thresholds': noise['thresholds'],
                                'n_flags': len(noise['flags']), 'n_pairs': len(flags)}},
       'sets': order, 'pairs': {}}
for i, pr in enumerate(pairs):
    out['pairs'][pr] = {'p': [[r3(P[k][i, c]) for c in range(4)] for k in order]}
    if pr in flags:
        out['pairs'][pr]['flags'] = flags[pr]
json.dump(out, open(HERE / 'public/data/predictions.json', 'w'), separators=(',', ':'))
print('WROTE predictions.json', len(order), 'sets,', len(flags), 'flagged pairs')

# ---- refresh pairs.json pred/prob (canonical xgb|MAGPIE LOEO) ----
sp = HERE / 'public/data/pairs.json'
site = json.load(open(sp))
idx = {p: i for i, p in enumerate(pairs)}
PM = P['xgb|MAGPIE']
changed = 0
for p in site:
    i = idx[p['pair']]
    prob = {c: r3(PM[i, k]) for k, c in enumerate(CLASSES)}
    pred = [c for k, c in enumerate(CLASSES) if PM[i, k] >= 0.5]
    # truth in the site must equal the paper's label matrix
    assert set(p['truth']) == {c for k, c in enumerate(CLASSES) if C.Y[i, k]}, p['pair']
    if p.get('prob') != prob or p.get('pred') != pred or 'provisional' in p:
        changed += 1
    p['prob'], p['pred'] = prob, pred
    p.pop('provisional', None)
json.dump(site, open(sp, 'w'), separators=(',', ':'))
print(f'pairs.json: {changed} systems refreshed to xgb|MAGPIE LOEO out-of-fold')
