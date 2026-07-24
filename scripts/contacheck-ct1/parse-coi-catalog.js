// Parser COI (ancho fijo) -> CSV seed catálogo SAT
const fs = require('fs');
const SRC = process.argv[2];
const OUT = process.argv[3];

const txt = fs.readFileSync(SRC).toString('latin1'); // Windows-1252
const lines = txt.split(/\r?\n/).filter(l => l.startsWith('C '));

const TYPE_BY_DIGIT = {
  '1':'Activo','2':'Pasivo','3':'Capital','4':'Ingresos',
  '5':'Costos','6':'Gastos','7':'Resultados','8':'Orden','9':'Orden',
};

const rows = [];
let skippedPersonal = 0;
for (const s of lines) {
  const code    = s.slice(3, 11).trim();
  const nameEs  = s.slice(34, 84).trim();
  const nameEn  = s.slice(84, 136).trim();
  const parent  = s.slice(136, 144).trim();
  const flags   = s.slice(144);
  // Filtro: solo catálogo GENÉRICO (importación template CONTPAQ 2020-02-14).
  // Las subcuentas personales de la contabilidad de Juan tienen otra fecha de alta.
  const dm = flags.match(/\b(20\d{6})\b/);
  const date = dm ? dm[1] : '';
  if (date !== '20200214') { skippedPersonal++; continue; }
  const natureM = flags.match(/\S/);
  const nature  = natureM ? natureM[0] : '';
  const tokens  = s.trim().split(/\s+/);
  let sat = tokens[tokens.length - 1];
  if (!/^\d/.test(sat)) sat = ''; // último token no numérico -> sin código
  if (sat === '0') sat = '';
  if (!code || !nameEs) continue;
  rows.push({ code, nameEs, nameEn, parent: parent === '00000000' ? '' : parent, nature,
              account_type: TYPE_BY_DIGIT[code[0]] || 'Otros', sat });
}

// jerarquía: hijos por padre -> postable = hoja
const childrenOf = new Set(rows.map(r => r.parent).filter(Boolean));
const byCode = new Map(rows.map(r => [r.code, r]));
function depth(code) {
  let d = 0, cur = byCode.get(code);
  const seen = new Set();
  while (cur && cur.parent && !seen.has(cur.code)) { seen.add(cur.code); d++; cur = byCode.get(cur.parent); }
  return d;
}

const csvEsc = v => {
  v = String(v ?? '');
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

const header = 'code,name,name_en,parent_code,account_type,nature,level,sat_grouping_code,is_postable';
const out = [header];
let withSat = 0, postable = 0;
for (const r of rows) {
  const isPostable = !childrenOf.has(r.code);
  if (isPostable) postable++;
  if (r.sat) withSat++;
  out.push([
    r.code, csvEsc(r.nameEs), csvEsc(r.nameEn), r.parent, r.account_type,
    r.nature, depth(r.code), r.sat, isPostable,
  ].join(','));
}
fs.writeFileSync(OUT, out.join('\n') + '\n', 'utf8');

console.log('cuentas GENERICAS:', rows.length);
console.log('personales omitidas:', skippedPersonal);
console.log('con codigo SAT:', withSat);
console.log('afectables (hoja):', postable);
console.log('por tipo:');
const byType = {};
for (const r of rows) byType[r.account_type] = (byType[r.account_type] || 0) + 1;
console.log(byType);
console.log('\nmuestras:');
for (const c of ['10201000','10101000','20101000','20701000','60185000']) {
  const r = rows.find(x => x.code === c);
  if (r) console.log(`  ${r.code} | ${r.nameEs} | padre ${r.parent||'-'} | ${r.account_type} | SAT ${r.sat||'-'} | postable ${!childrenOf.has(r.code)}`);
}
