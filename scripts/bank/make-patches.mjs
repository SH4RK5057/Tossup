// Builds scripts/bank/patches.json from review decisions (cold-answer mismatches). Run once after verify-compare.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const bank = {};
for (const f of readdirSync(new URL('../../batches/', import.meta.url)).filter((n) => /^bank-.*\.json$/.test(n))) {
  bank[f.replace(/^bank-|\.json$/g, '')] = JSON.parse(readFileSync(new URL(`../../batches/${f}`, import.meta.url), 'utf8'));
}
const A = (id, ...alts) => ({ id, addAlt: alts });
const D = (id) => ({ id, drop: true });
const S = (id, answer, ...alts) => ({ id, setAnswer: answer, addAlt: alts });
const fed = (n) => [`Federalist No. ${n}`, `Federalist ${n}`, `Federalist Paper ${n}`, `Federalist Paper No. ${n}`];

const decisions = [
  A('ncal-jv:446', 'Oliver Wendell Holmes Sr.', 'Oliver Wendell Holmes Senior'),
  A('ncal-jv:838', 'Gettysburg'),
  A('ncal-jv:878', "John Brown's raid", 'Harpers Ferry'),
  A('ncal-jv:914.1', 'the Republic of Korea'),
  A('ncal-jv:1156', 'mal à la tête', 'un mal de tête', 'mal de tête'),
  A('ncal-jv:1218.0', 'the dishes', 'wash the dishes', 'washing dishes'),
  D('ncal-jv:1220.2'),
  A('ncal-jv:1224.0', 'le tableau', 'peinture', 'tableau'),
  A('ncal-jv:1353.1', 'Bacteria, Archaea, Eukarya'),
  D('ncal-jv:1359'),
  A('ncal-jv:1368.1', 'quiescent', 'quiescence', 'G zero'),
  A('ncal-jv:1555.1', 'glass'),
  A('ncal-novice:348.2', 'linear perspective'),
  A('ncal-novice:353.2', 'relief', 'low relief'),
  A('ncal-novice:375', 'number of beats per measure', 'how many beats in a measure'),
  A('ncal-novice:432.1', 'allegro'),
  A('ncal-novice:447', 'Ninth'),
  A('ncal-novice:507', 'Sixth'),
  D('ncal-novice:616.2'),
  A('ncal-novice:622.0', 'simple past', 'simple past tense', 'past'),
  A('ncal-novice:779.0', 'Northeast'),
  A('ncal-novice:787.2', 'Arizona, Colorado, New Mexico, Utah', 'Utah, Colorado, Arizona, New Mexico'),
  A('ncal-novice:922', 'el salón de clases', 'el aula'),
  A('ncal-novice:1282', '4.5 billion years', '4.5 billion', '4.54 billion years'),
  A('ncal-novice:1295.1', 'chemical'),
  A('ncal-novice:1295.3', 'dissolution', 'karst topography'),
  A('ncal-novice:1317', 'homogeneous', 'homogeneous mixture'),
  A('ncal-novice:1388.1', 'elastic potential'),
  A('ncal-novice:1394.1', 'magnetic', 'ferromagnetic materials'),
  A('ncal-novice:1553', 'meter'),
  A('ncal-varsity:345', 'Schechter Poultry Corp. v. United States', 'Schechter Poultry', 'Schechter'),
  A('ncal-varsity:350', ...fed(10)),
  A('ncal-varsity:351', ...fed(51)),
  A('ncal-varsity:352', ...fed(78)),
  A('ncal-varsity:372.0', 'exclusive powers', 'enumerated powers', 'expressed powers'),
  A('ncal-varsity:436', 'constitutional monarchy', 'parliamentary monarchy'),
  A('ncal-varsity:555', 'Dr. John Watson', 'John Watson', 'Watson'),
  A('ncal-varsity:850', 'ectoderm, mesoderm, endoderm'),
  A('ncal-varsity:863.0', 'allopatric'),
  A('ncal-varsity:863.1', 'sympatric'),
  A('ncal-varsity:871.0', 'vestigial', 'vestigial organs'),
  A('ncal-varsity:871.1', 'analogous'),
  A('ncal-varsity:1314.0', 'more food', 'food', 'porridge'),
  A('ncal-varsity:1336', 'blue, white, red'),
  A('ncal-varsity:1384', "Gare d'Orsay", 'Orsay'),
  A('ncal-varsity:1439.1', 'acute'),
  A('ncal-varsity:1587.2', 'one-fourth', '1/4', 'one quarter'),
  A('ncal-varsity:1698', 'Smoot-Hawley Tariff', 'Smoot-Hawley', 'Hawley-Smoot Tariff Act'),
  A('ncal-varsity:1726.2', 'stock index'),
  A('ncal-varsity:1729.2', 'pegged exchange rate', 'peg', 'currency peg', 'pegged'),
  D('quizbowl-jv:181.0'),
  A('quizbowl-jv:375.2', 'tropical rainforest', 'tropical climate'),
  D('quizbowl-jv:751.2'),
  A('quizbowl-jv:825.1', 'Prince Henry the Navigator', 'Prince Henry'),
  S('quizbowl-jv:1132.0', 'Fionn mac Cumhaill', 'Finn McCool', 'Fionn', 'Finn mac Cumhaill'),
  A('quizbowl-jv:1132.2', 'fairies', 'the fair folk', 'sidhe', 'aos sí'),
  A('quizbowl-jv:1382', 'Seventh-day Adventist Church', 'Adventists', 'Seventh-day Adventists'),
  D('quizbowl-jv:1438.1'),
  A('quizbowl-jv:1471', 'cryptographic hash function', 'hash', 'hashing'),
  S('quizbowl-jv:1552.1', 'intragenerational mobility', 'social mobility'),
  A('quizbowl-jv:1555.2', 'capital'),
  A('quizbowl-jv:1590.2', 'cloture rule', 'Rule XXII', 'Senate Rule 22'),
  A('quizbowl-jv:1629', 'hunter-gatherer societies', 'hunter-gatherers', 'foragers'),
  A('quizbowl-jv:1671.0', 'Egyptian hieroglyphs', 'hieroglyphics'),
  A('quizbowl-novice:448', 'Ancient Olympic Games', 'Olympics', 'the Olympics'),
  A('quizbowl-novice:1139', 'atomic mass', 'relative atomic mass', 'atomic weight'),
  S('quizbowl-novice:1224.2', 'two-pan balance', 'equal-arm balance', 'beam balance', 'pan balance', 'balance'),
  A('quizbowl-novice:1370.1', 'at symbol', 'at sign'),
  A('quizbowl-novice:1605.0', 'pictographic', 'pictographs', 'pictograms', 'hieroglyphs'),
  D('quizbowl-novice:1683.2'),
  A('quizbowl-varsity:77', "Beethoven's Symphony No. 9", 'Ninth Symphony', 'Choral Symphony', "Beethoven's Ninth", 'Ninth'),
  A('quizbowl-varsity:1051', 'Mezquita of Cordoba', 'Mosque-Cathedral of Cordoba', 'Great Mosque of Cordoba'),
  A('quizbowl-varsity:1098.2', 'Immortals'),
  A('quizbowl-varsity:1140.0', 'mediumship', 'spiritualism', 'seances'),
  A('quizbowl-varsity:1152', 'cAMP', 'cyclic AMP'),
  A('quizbowl-varsity:1214.1', 'valence shell electron pair repulsion', 'VSEPR', 'VSEPR theory'),
  A('quizbowl-varsity:1291.0', 'gravitational force', 'tidal force', 'gravitation'),
  D('quizbowl-varsity:1364.1'),
  A('quizbowl-varsity:1374', 'A star', 'A star search', 'A*'),
  A('quizbowl-varsity:1463', 'Smoot-Hawley Tariff', 'Smoot-Hawley', 'Hawley-Smoot Tariff Act'),
  A('quizbowl-varsity:1485.0', 'stock market crash of 1929', 'crash of 1929', 'Black Tuesday', 'the crash'),
  D('quizbowl-varsity:1531'),
];

const patches = [];
for (const d of decisions) {
  const [id, part] = d.id.split('.');
  const [key, idx] = id.split(':');
  const r = bank[key][Number(idx)];
  const j = part === undefined ? 0 : Number(part);
  const snippet = (r.type === 'tossup' ? r.text : r.parts[j].text).slice(0, 90);
  const p = { match: snippet };
  if (r.type === 'bonus') p.part = j;
  if (d.drop) p.drop = true;
  if (d.setAnswer) p.setAnswer = d.setAnswer;
  if (d.addAlt?.length) p.addAlt = d.addAlt;
  patches.push(p);
}
writeFileSync(new URL('./patches.json', import.meta.url), JSON.stringify(patches, null, 1) + '\n');
console.log(`${patches.length} patches (${patches.filter((p) => p.drop).length} drops)`);
