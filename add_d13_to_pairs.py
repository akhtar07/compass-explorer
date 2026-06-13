#!/usr/bin/env python3
"""add_d13_to_pairs.py -- merge the D13 (periodic-group distance) descriptor into
each pair's D-block in public/data/pairs.json.

The webapp's pairs.json was generated with D1-D12 only, even though the deployed
model (commit 8c8b1fd) was retrained with D13. dataset_4class.csv carries
D13_group = |group(A) - group(B)| per pair, keyed by pair_norm which equals the
'pair' field in pairs.json. This adds pair['D']['D13'] in place (idempotent).
"""
import json
from pathlib import Path
import pandas as pd

HERE = Path(__file__).parent
src = pd.read_csv(HERE.parent / 'dataset_4class.csv')
d13 = dict(zip(src['pair_norm'], src['D13_group'].astype(float)))

pj = HERE / 'public/data/pairs.json'
pairs = json.load(open(pj))

added, missing = 0, []
for p in pairs:
    key = p['pair']
    if key in d13:
        p['D']['D13'] = round(d13[key], 3)
        added += 1
    else:
        missing.append(key)

json.dump(pairs, open(pj, 'w'), separators=(',', ':'))
print(f'added D13 to {added}/{len(pairs)} pairs')
if missing:
    print(f'WARNING: {len(missing)} pairs had no D13 in source: {missing[:10]}')
