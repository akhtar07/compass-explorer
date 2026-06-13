#!/usr/bin/env python3
"""add_element_names.py -- add a `name` field to every element in
public/data/elements.json so the Selector can match plain-language queries
("immiscible with iron") and not just chemical symbols. Idempotent.
"""
import json
from pathlib import Path

NAMES = {
 'H':'Hydrogen','He':'Helium','Li':'Lithium','Be':'Beryllium','B':'Boron','C':'Carbon',
 'N':'Nitrogen','O':'Oxygen','F':'Fluorine','Ne':'Neon','Na':'Sodium','Mg':'Magnesium',
 'Al':'Aluminium','Si':'Silicon','P':'Phosphorus','S':'Sulfur','Cl':'Chlorine','Ar':'Argon',
 'K':'Potassium','Ca':'Calcium','Sc':'Scandium','Ti':'Titanium','V':'Vanadium','Cr':'Chromium',
 'Mn':'Manganese','Fe':'Iron','Co':'Cobalt','Ni':'Nickel','Cu':'Copper','Zn':'Zinc',
 'Ga':'Gallium','Ge':'Germanium','As':'Arsenic','Se':'Selenium','Br':'Bromine','Kr':'Krypton',
 'Rb':'Rubidium','Sr':'Strontium','Y':'Yttrium','Zr':'Zirconium','Nb':'Niobium','Mo':'Molybdenum',
 'Tc':'Technetium','Ru':'Ruthenium','Rh':'Rhodium','Pd':'Palladium','Ag':'Silver','Cd':'Cadmium',
 'In':'Indium','Sn':'Tin','Sb':'Antimony','Te':'Tellurium','I':'Iodine','Xe':'Xenon',
 'Cs':'Caesium','Ba':'Barium','La':'Lanthanum','Ce':'Cerium','Pr':'Praseodymium','Nd':'Neodymium',
 'Pm':'Promethium','Sm':'Samarium','Eu':'Europium','Gd':'Gadolinium','Tb':'Terbium','Dy':'Dysprosium',
 'Ho':'Holmium','Er':'Erbium','Tm':'Thulium','Yb':'Ytterbium','Lu':'Lutetium','Hf':'Hafnium',
 'Ta':'Tantalum','W':'Tungsten','Re':'Rhenium','Os':'Osmium','Ir':'Iridium','Pt':'Platinum',
 'Au':'Gold','Hg':'Mercury','Tl':'Thallium','Pb':'Lead','Bi':'Bismuth','Po':'Polonium',
 'At':'Astatine','Rn':'Radon','Fr':'Francium','Ra':'Radium','Ac':'Actinium','Th':'Thorium',
 'Pa':'Protactinium','U':'Uranium','Np':'Neptunium','Pu':'Plutonium','Am':'Americium','Cm':'Curium',
 'Bk':'Berkelium','Cf':'Californium','Es':'Einsteinium','Fm':'Fermium','Md':'Mendelevium','No':'Nobelium',
 'Lr':'Lawrencium','Rf':'Rutherfordium','Db':'Dubnium','Sg':'Seaborgium','Bh':'Bohrium','Hs':'Hassium',
 'Mt':'Meitnerium','Ds':'Darmstadtium','Rg':'Roentgenium','Cn':'Copernicium','Nh':'Nihonium','Fl':'Flerovium',
 'Mc':'Moscovium','Lv':'Livermorium','Ts':'Tennessine','Og':'Oganesson',
}

HERE = Path(__file__).parent
ej = HERE / 'public/data/elements.json'
el = json.load(open(ej))
n = 0
for sym, rec in el.items():
    nm = NAMES.get(rec.get('symbol', sym))
    if nm:
        rec['name'] = nm
        n += 1
json.dump(el, open(ej, 'w'), separators=(',', ':'))
print(f'added name to {n}/{len(el)} elements')
