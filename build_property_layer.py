#!/usr/bin/env python3
"""build_property_layer.py
Enrich the COMPASS web data with a property layer for (a) Ashby-style charts and
(b) the requirement-driven Selector.

Adds to each has_data element:  density (g/cm3), youngs_modulus_GPa.
(therm_cond, melting point, UTS, price already present from MAGPIE/JARVIS.)
Adds to each pair:  props = {axis: {min,max,mean}} over its two elements ("elemental bounds").
Writes property_axes.json describing the selectable axes.

Sources: density & Young's modulus are public-domain elemental physical constants
(CRC / standard references). Per-compound elastic data from Materials Project can
later override these via the same `props` structure once an MP_API_KEY is supplied.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent / 'public' / 'data'

# public-domain elemental constants: density g/cm3, Young's modulus GPa
DENS = {
 'Li':0.534,'Na':0.971,'Mg':1.738,'Al':2.70,'Si':2.329,'K':0.862,'Ca':1.55,
 'Sc':2.985,'Ti':4.506,'V':6.11,'Cr':7.15,'Mn':7.21,'Fe':7.874,'Co':8.90,
 'Ni':8.908,'Cu':8.96,'Zn':7.14,'Ga':5.91,'Ge':5.323,'As':5.727,'Rb':1.532,
 'Sr':2.64,'Y':4.472,'Zr':6.52,'Nb':8.57,'Mo':10.28,'Ru':12.45,'Rh':12.41,
 'Pd':12.02,'Ag':10.49,'Cd':8.65,'In':7.31,'Sn':7.287,'Sb':6.697,'Te':6.24,
 'Cs':1.93,'Ba':3.51,'Hf':13.31,'Ta':16.69,'W':19.25,'Re':21.02,'Os':22.59,
 'Ir':22.56,'Pt':21.45,'Au':19.30,'Tl':11.85,'Pb':11.34,'Bi':9.78,
}
YOUNG = {
 'Li':4.9,'Na':10,'Mg':45,'Al':70,'Si':150,'K':3.5,'Ca':20,'Sc':74,'Ti':116,
 'V':128,'Cr':279,'Mn':198,'Fe':211,'Co':209,'Ni':200,'Cu':130,'Zn':108,
 'Ga':9.8,'Ge':103,'As':22,'Rb':2.4,'Sr':15.7,'Y':64,'Zr':88,'Nb':105,
 'Mo':329,'Ru':447,'Rh':275,'Pd':121,'Ag':83,'Cd':50,'In':11,'Sn':50,
 'Sb':55,'Te':43,'Cs':1.7,'Ba':13,'Hf':78,'Ta':186,'W':411,'Re':463,
 'Os':559,'Ir':528,'Pt':168,'Au':78,'Tl':8,'Pb':16,'Bi':32,
}

# axis key in element record -> (label, unit, log-scale?)
AXES = {
 'density':          ('Density',              'g/cm³',  False),
 'youngs_modulus_GPa':('Young’s modulus','GPa',    True),
 'specific_stiffness':('Specific stiffness E/ρ','GPa·cm³/g', True),
 'JARVIS_therm_cond':('Thermal conductivity', 'W/m·K',  True),
 'JARVIS_mp':        ('Melting point',         'K',      False),
 'UTS_MPa':          ('Tensile strength (UTS)','MPa',    True),
 'Price_USD_kg':     ('Price',                 'USD/kg', True),
}

el = json.load(open(HERE/'elements.json'))

# inject density / modulus / derived specific stiffness
for sym, rec in el.items():
    if not rec.get('has_data'):
        continue
    rec['density'] = DENS.get(sym)
    rec['youngs_modulus_GPa'] = YOUNG.get(sym)
    if rec.get('density') and rec.get('youngs_modulus_GPa'):
        rec['specific_stiffness'] = round(rec['youngs_modulus_GPa']/rec['density'], 2)

json.dump(el, open(HERE/'elements.json','w'), indent=0)

# per-pair elemental-bound property aggregates
pairs = json.load(open(HERE/'pairs.json'))
def val(sym, axis):
    r = el.get(sym, {})
    v = r.get(axis)
    return v if isinstance(v,(int,float)) else None

for p in pairs:
    a, b = p['A'], p['B']
    props = {}
    for axis in AXES:
        va, vb = val(a,axis), val(b,axis)
        if va is None or vb is None:
            continue
        props[axis] = {'min':round(min(va,vb),3),'max':round(max(va,vb),3),
                       'mean':round((va+vb)/2,3)}
    p['props'] = props

json.dump(pairs, open(HERE/'pairs.json','w'), indent=0)

# axes descriptor for the UI
axes_out = {k:{'label':v[0],'unit':v[1],'log':v[2]} for k,v in AXES.items()}
json.dump(axes_out, open(HERE/'property_axes.json','w'), indent=2)

ncov = sum(1 for s in el if el[s].get('density'))
print(f'elements with property data: {ncov}')
print(f'pairs with >=1 property axis: {sum(1 for p in pairs if p["props"])}/{len(pairs)}')
print('wrote elements.json, pairs.json, property_axes.json')
