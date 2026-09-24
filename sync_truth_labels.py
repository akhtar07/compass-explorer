#!/usr/bin/env python3
"""sync_truth_labels.py -- make each pair's ground-truth label list in
public/data/pairs.json match the canonical 970-pair label table
(phase_labels_970.csv: columns el_A, el_B, y_isomorphous, y_partial,
y_immiscible, y_intermetallic).

Usage:
    python3 sync_truth_labels.py [path/to/phase_labels_970.csv]

Idempotent; prints which pairs changed. Predictions / probabilities are left
untouched (they are out-of-fold model outputs, regenerated separately).
"""
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / 'data/processed/labels/phase_labels_970.csv'
PJ = HERE / 'public/data/pairs.json'
CLASSES = ['isomorphous', 'partial', 'immiscible', 'intermetallic']

rows = {}
for r in csv.DictReader(open(SRC)):
    labels = [c for c in CLASSES if r['y_' + c] == '1']
    rows[f"{r['el_A']}-{r['el_B']}"] = labels
    rows[f"{r['el_B']}-{r['el_A']}"] = labels

pairs = json.load(open(PJ))
changed, missing = [], []
for p in pairs:
    key = f"{p['A']}-{p['B']}"
    if key not in rows:
        missing.append(key)
        continue
    new = [c for c in CLASSES if c in rows[key]]  # canonical order
    if sorted(new) != sorted(p['truth']):
        changed.append((key, list(p['truth']), new))
        p['truth'] = new

json.dump(pairs, open(PJ, 'w'), separators=(',', ':'))
print(f'{len(pairs)} pairs; {len(changed)} truth lists updated; {len(missing)} pairs missing from CSV')
for k, old, new in changed:
    print(f'  {k:8s} {"+".join(old):40s} -> {"+".join(new)}')
if missing:
    print('missing:', missing)
