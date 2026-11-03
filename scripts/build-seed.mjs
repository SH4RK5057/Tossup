// Builds seed/questions.json from the compact definitions below.
// Run with: npm run seed
import { writeFileSync } from 'node:fs';
import { tagDifficulty } from './difficulty.mjs';

const NOW = '2026-11-02T00:00:00.000Z';
let rngState = 20261102;
function rand() { // mulberry32, so the seed file is reproducible
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const counters = {};
function nextId(rs, level, kind) {
  const key = `${rs}-${level}-${kind}`;
  counters[key] = (counters[key] ?? 0) + 1;
  return `seed-${rs}-${level}-${kind}${String(counters[key]).padStart(2, '0')}`;
}

const spec = (answer, o = {}) => ({
  answer,
  required: o.req ?? null,
  alternates: o.alt ?? [],
  prompt_on: o.prompt ?? [],
  answer_type: o.type ?? 'general',
  duplicate_name: o.dup ?? false,
  accepts_partial_name: o.partial ?? false,
});

const out = [];
function shared(rs, level, category, subcategory, kind, expires = null) {
  return {
    id: nextId(rs, level, kind === 'tossup' ? 't' : 'b'),
    type: kind,
    rulesets: [rs],
    level,
    category,
    subcategory,
    status: 'active',
    source: 'seed',
    random: Math.round(rand() * 1e6) / 1e6,
    expires_at: expires,
    report_count: 0,
    created_at: NOW,
    updated_at: NOW,
  };
}
const T = (rs, level, cat, sub, text, answer, o = {}) =>
  out.push({ ...shared(rs, level, cat, sub, 'tossup', o.exp ?? null), text, ...spec(answer, o) });
// parts: [difficulty, text, answer, opts]
const B = (rs, level, cat, sub, leadin, parts) =>
  out.push({
    ...shared(rs, level, cat, sub, 'bonus'),
    leadin,
    parts: parts.map(([part_difficulty, text, answer, o = {}]) => ({ text, part_difficulty, ...spec(answer, o) })),
  });

// ---------------------------------------------------------------- NCAL novice
const N = (...a) => T('ncal', 'novice', ...a);
N('English', 'English Grammar', 'What part of speech describes a noun, such as the word "red" in "red ball"?', 'adjective');
N('English', 'Literary Terms', 'What figure of speech compares two things using the word "like" or "as"?', 'simile');
N('English', 'Greek and Roman Mythology', 'Name the Greek king of the gods who wielded a thunderbolt.', 'Zeus');
N('Math', 'Arithmetic', 'Simplify the fraction six-twelfths to lowest terms.', '1/2', { type: 'math' });
N('Math', 'Geometry', 'How many degrees are in the sum of the interior angles of any triangle?', '180', { type: 'math', alt: ['180 degrees'] });
N('Science', 'Astronomy', 'Which planet, sixth from the Sun, is famous for its prominent rings?', 'Saturn');
N('Social Science', 'U.S. Geography', 'Sacramento is the capital of which U.S. state?', 'California');
N('Fine Arts', 'Spanish 1', 'Give the Spanish phrase, including its article, for "the house."', 'la casa', { type: 'foreign_language' });
N('English', 'English Vocabulary', 'What term names a word that has the opposite meaning of another word?', 'antonym', { alt: ['antonyms'] });
N('Current Events', 'Current Events', 'The 2026 Winter Olympics were co-hosted by Milan and which other Italian city?', "Cortina d'Ampezzo", { req: 'Cortina', alt: ['Cortina'], exp: '2027-03-01T00:00:00.000Z' });

B('ncal', 'novice', 'English', 'Literary Terms', 'Answer these questions about figures of speech.', [
  ['easy', 'What term names an extreme exaggeration used for effect?', 'hyperbole'],
  ['medium', 'What term names a comparison made without using "like" or "as"?', 'metaphor'],
  ['hard', 'What term names the giving of human traits to non-human things?', 'personification'],
]);
B('ncal', 'novice', 'Math', 'Geometry', 'Answer these questions about triangles.', [
  ['easy', 'How many sides does a triangle have?', '3', { type: 'math' }],
  ['easy', 'What is the area of a triangle with base 6 and height 4?', '12', { type: 'math' }],
  ['medium', 'What kind of triangle has three equal sides?', 'equilateral triangle', { alt: ['equilateral'] }],
  ['hard', 'In a right triangle with legs of length 3 and 4, what is the length of the hypotenuse?', '5', { type: 'math' }],
]);
B('ncal', 'novice', 'Science', 'Astronomy', 'Answer these questions about the planets.', [
  ['easy', 'Which planet is closest to the Sun?', 'Mercury'],
  ['medium', 'Which planet is known as the Red Planet?', 'Mars'],
  ['hard', 'Which is the largest planet in the Solar System?', 'Jupiter'],
]);

// ------------------------------------------------------------------- NCAL JV
const J = (...a) => T('ncal', 'jv', ...a);
J('English', 'American Literature', 'Which author wrote the novel "The Great Gatsby"?', 'F. Scott Fitzgerald', { type: 'name', req: 'Fitzgerald' });
J('English', 'Mythology 2', 'In Norse mythology, what is the name of Odin\'s eight-legged horse?', 'Sleipnir');
J('Fine Arts', 'Art History', 'Which Italian Renaissance artist painted the "Mona Lisa"?', 'Leonardo da Vinci', { type: 'name', alt: ['da Vinci', 'Leonardo'], partial: true });
J('Math', 'Algebra 2', 'What is the base-2 logarithm of 32?', '5', { type: 'math' });
J('Math', 'Trigonometry', 'What is the exact value of the sine of thirty degrees?', '1/2', { type: 'math', alt: ['0.5'] });
J('Science', 'Chemistry', 'What is the chemical symbol for the element sodium?', 'Na');
J('Science', 'Biology 1', 'Which organelle is known as the "powerhouse of the cell"?', 'mitochondria', { alt: ['mitochondrion'] });
J('Social Science', 'U.S. History', 'Which U.S. president issued the Emancipation Proclamation?', 'Abraham Lincoln', { type: 'name', req: 'Lincoln' });
J('Social Science', 'U.S. History', 'Which president won the 1906 Nobel Peace Prize for mediating the end of the Russo-Japanese War? Give his full name.', 'Theodore Roosevelt', { type: 'name', req: 'Roosevelt', dup: true, alt: ['Teddy Roosevelt'], prompt: ['Roosevelt'] });
J('Current Events', 'Current Events', 'The final of the 2026 FIFA World Cup was scheduled to be played at MetLife Stadium in which U.S. state?', 'New Jersey', { exp: '2027-01-01T00:00:00.000Z' });

B('ncal', 'jv', 'Social Science', 'U.S. History', 'Answer these questions about the American Revolution.', [
  ['easy', 'Which document, adopted in 1776, declared the colonies independent from Britain?', 'Declaration of Independence'],
  ['medium', 'Who commanded the Continental Army?', 'George Washington', { type: 'name', req: 'Washington' }],
  ['hard', 'At which 1781 battle in Virginia did British General Cornwallis surrender?', 'Yorktown', { alt: ['Battle of Yorktown', 'Siege of Yorktown'] }],
]);
B('ncal', 'jv', 'Science', 'Chemistry', 'Answer these questions about the periodic table.', [
  ['easy', 'What is the chemical symbol for gold?', 'Au'],
  ['easy', 'What is the lightest element?', 'hydrogen'],
  ['medium', 'Which noble gas has atomic number 10?', 'neon'],
  ['hard', 'Which element has the chemical symbol Fe?', 'iron'],
]);
B('ncal', 'jv', 'Math', 'Algebra 2', 'Answer these math problems.', [
  ['easy', 'What is the square root of 144?', '12', { type: 'math' }],
  ['medium', 'What is 2 raised to the fifth power?', '32', { type: 'math' }],
  ['hard', 'Solve for x: 3x + 5 = 20.', '5', { type: 'math', alt: ['x=5', 'x = 5'] }],
]);

// -------------------------------------------------------------- NCAL varsity
const V = (...a) => T('ncal', 'varsity', ...a);
V('English', 'World Literature', 'Which Russian author wrote "Crime and Punishment"?', 'Fyodor Dostoevsky', { type: 'name', req: 'Dostoevsky', alt: ['Dostoyevsky', 'Fyodor Dostoyevsky'] });
V('English', 'English Literature', 'Which English playwright wrote "Hamlet"?', 'William Shakespeare', { type: 'name', req: 'Shakespeare' });
V('Fine Arts', 'Architecture', 'Which architect designed the Guggenheim Museum in Bilbao, Spain?', 'Frank Gehry', { type: 'name', req: 'Gehry' });
V('Fine Arts', 'Operas and Musicals', 'Which composer wrote the opera "The Magic Flute"?', 'Wolfgang Amadeus Mozart', { type: 'name', req: 'Mozart' });
V('Math', 'Pre-Calculus', 'What is the sum of the infinite geometric series 1 + 1/2 + 1/4 + 1/8, and so on?', '2', { type: 'math' });
V('Math', 'Calculus', 'What is the derivative of x squared with respect to x?', '2x', { type: 'math', alt: ['2*x'] });
V('Science', 'Physics', 'What is the SI unit of force?', 'newton', { alt: ['newtons'] });
V('Science', 'Biology 2', 'Which type of RNA carries amino acids to the ribosome during translation?', 'transfer RNA', { alt: ['tRNA'], prompt: ['RNA', 'ribonucleic acid'] });
V('Social Science', 'World Governments', 'What term describes a government in which religious leaders rule in the name of a deity?', 'theocracy');
V('Current Events', 'Current Events', 'Pope Leo XIV, elected in 2025, is the first pope born in which country?', 'United States', { alt: ['United States of America', 'USA', 'US', 'America'], exp: '2027-05-01T00:00:00.000Z' });

B('ncal', 'varsity', 'Fine Arts', 'Composers and Works', 'Answer these questions about Ludwig van Beethoven.', [
  ['easy', 'In which German city was Beethoven born?', 'Bonn'],
  ['medium', 'Which Beethoven symphony ends with the "Ode to Joy"?', 'Ninth Symphony', { alt: ['Symphony No. 9', 'Choral Symphony', 'Symphony 9', '9th'] }],
  ['hard', 'What is the title of Beethoven\'s only opera?', 'Fidelio'],
]);
B('ncal', 'varsity', 'Social Science', 'World History', 'Answer these questions about ancient Rome.', [
  ['easy', 'Who was the first Roman emperor?', 'Augustus', { type: 'name', alt: ['Octavian', 'Caesar Augustus'] }],
  ['medium', 'Which Carthaginian general crossed the Alps with elephants to attack Rome?', 'Hannibal', { type: 'name', alt: ['Hannibal Barca'] }],
  ['hard', 'The deposition of which emperor in 476 AD is traditionally dated as the fall of the Western Roman Empire?', 'Romulus Augustulus', { type: 'name', req: 'Augustulus', alt: ['Romulus Augustus'], partial: true }],
]);
B('ncal', 'varsity', 'Science', 'Physics', 'Answer these questions about physics.', [
  ['easy', 'What is the SI unit of frequency?', 'hertz', { alt: ['Hz'] }],
  ['medium', 'Which subatomic particle carries a negative electric charge?', 'electron'],
  ['hard', 'Which scientist\'s equation E equals m c squared relates mass and energy?', 'Albert Einstein', { type: 'name', req: 'Einstein' }],
]);

// ------------------------------------------------------------- Quizbowl novice
const QN = (...a) => T('quizbowl', 'novice', ...a);
QN('Literature', 'American Literature', 'In one novel by this author, a boy tricks his friends into whitewashing a fence in St. Petersburg, Missouri. A sequel narrated by that boy\'s friend Huckleberry Finn follows a journey down the Mississippi River with the escaped slave Jim. For 10 points, name this American author of "The Adventures of Tom Sawyer," who wrote under a pen name.', 'Mark Twain', { type: 'name', req: 'Twain', alt: ['Samuel Clemens', 'Samuel Langhorne Clemens'] });
QN('History', 'American History', 'This man\'s first inaugural address declared that "the only thing we have to fear is fear itself." He created programs like the Civilian Conservation Corps and Social Security as part of the New Deal. Elected four times, he led the United States for most of World War II. For 10 points, name this president, nicknamed "FDR."', 'Franklin D. Roosevelt', { type: 'name', req: 'Roosevelt', dup: true, alt: ['Franklin Roosevelt', 'Franklin Delano Roosevelt', 'FDR'], prompt: ['Roosevelt'] });
QN('Science', 'Biology', 'This organelle contains folds called cristae and an inner space called the matrix. Its own circular DNA is cited as evidence for the endosymbiotic theory. Most of a cell\'s ATP is produced here through oxidative phosphorylation. For 10 points, name this "powerhouse of the cell."', 'mitochondria', { alt: ['mitochondrion'] });
QN('Science', 'Chemistry', 'Allotropes of this element include graphite, diamond, and buckminsterfullerene. Its isotope with mass number 14 is used in radiometric dating. With atomic number 6, it forms four covalent bonds and is the basis of organic chemistry. For 10 points, name this element with chemical symbol C.', 'carbon');
QN('Fine Arts', 'Visual Arts', 'This painter\'s "Irises" and "Café Terrace at Night" were completed in the final years of his life. After an argument with Paul Gauguin in Arles, he cut off part of his own ear. His works include a series of sunflowers and "The Starry Night." For 10 points, name this Dutch Post-Impressionist.', 'Vincent van Gogh', { type: 'name', req: 'Gogh', alt: ['van Gogh'] });
QN('Geography', 'World Geography', 'This country\'s Great Barrier Reef lies off its northeastern coast, and its red center contains the monolith Uluru. Its capital is Canberra, though its largest city is Sydney. Kangaroos and koalas are native to this country. For 10 points, name this island country and continent in the Southern Hemisphere.', 'Australia', { alt: ['Commonwealth of Australia'] });
QN('Mythology', 'Greco-Roman Mythology', 'This hero was driven mad by Hera and killed his own family, then performed penance for King Eurystheus. His tasks included cleaning the Augean stables, capturing Cerberus, and slaying the Nemean lion. For 10 points, name this Greek hero, the son of Zeus and Alcmene, called Hercules by the Romans.', 'Heracles', { type: 'name', alt: ['Hercules'] });
QN('Religion', 'Judaism', 'According to the Book of Exodus, this man was hidden as a baby in a basket among the reeds of the Nile. He confronted a burning bush and called down ten plagues upon Egypt. He later received the Ten Commandments on Mount Sinai. For 10 points, name this prophet who led the Israelites out of Egypt.', 'Moses', { type: 'name' });
QN('Science', 'Math', 'Euclid proved that there are infinitely many examples of this type of number. His argument multiplies any finite list of them together and adds one. A number of this type has exactly two positive divisors, one and itself. For 10 points, name this type of number, examples of which are 2, 3, 5, and 7.', 'prime number', { alt: ['prime', 'primes', 'prime numbers'] });
QN('Science', 'Math', 'In binary, this number is written as 10, and it is the base of that number system. It is the only even prime number, and the square root of this number is irrational. It is the smallest prime, and a pair of anything has this many members. For 10 points, give this number, the successor of one.', '2', { type: 'math', alt: ['two'] });

B('quizbowl', 'novice', 'History', 'American History', 'Answer these questions about American presidents.', [
  ['easy', 'Who was the first president of the United States?', 'George Washington', { type: 'name', req: 'Washington' }],
  ['medium', 'Which president appears on the five-dollar bill?', 'Abraham Lincoln', { type: 'name', req: 'Lincoln' }],
  ['hard', 'Which president completed the Louisiana Purchase in 1803?', 'Thomas Jefferson', { type: 'name', req: 'Jefferson' }],
]);
B('quizbowl', 'novice', 'Science', 'Other Science', 'Answer these questions about changes of state.', [
  ['easy', 'What is the process by which a solid turns into a liquid?', 'melting', { alt: ['melt', 'fusion'] }],
  ['medium', 'What is the process by which a liquid turns into a gas?', 'vaporization', { alt: ['evaporation', 'boiling'] }],
  ['hard', 'What is the process by which a gas turns directly into a solid?', 'deposition'],
]);
B('quizbowl', 'novice', 'Geography', 'World Geography', 'Answer these questions about the continents.', [
  ['easy', 'Which is the largest continent by area?', 'Asia'],
  ['medium', 'Which continent contains the Sahara Desert?', 'Africa'],
  ['hard', 'Which is the smallest continent by area?', 'Australia', { alt: ['Oceania', 'Australia/Oceania'] }],
]);

// ---------------------------------------------------------------- Quizbowl JV
const QJ = (...a) => T('quizbowl', 'jv', ...a);
QJ('Literature', 'British Literature', 'The lawyer Mr. Jaggers and the convict Magwitch appear in one novel by this author, which features Pip and the jilted Miss Havisham. Another of his novels features Sydney Carton, who sacrifices himself during the French Revolution, and opens with "It was the best of times, it was the worst of times." For 10 points, name this Victorian author of "Oliver Twist" and "A Tale of Two Cities."', 'Charles Dickens', { type: 'name', req: 'Dickens' });
QJ('History', 'European History', 'This man took power in the coup of 18 Brumaire in 1799 and promulgated a civil code that bears his name. He crowned himself emperor at Notre-Dame in 1804 and was defeated at the Battle of Leipzig and, after returning from Elba, at Waterloo. He died in exile on Saint Helena. For 10 points, name this French emperor.', 'Napoleon Bonaparte', { type: 'name', req: 'Bonaparte', alt: ['Napoleon', 'Napoleon I'], partial: true });
QJ('Science', 'Chemistry', 'Johann Loschmidt estimated a related constant for the number of molecules per volume of gas. This quantity is named for an Italian scientist who proposed in 1811 that equal volumes of gases contain equal numbers of particles. For 10 points, name this number, approximately 6.022 times ten to the twenty-third, the number of particles in one mole.', 'Avogadro\'s number', { alt: ['Avogadro constant', 'Avogadro', 'Avogadros number'] });
QJ('Science', 'Biology', 'Rosalind Franklin\'s Photo 51 provided crucial X-ray diffraction evidence for the structure of this molecule. Erwin Chargaff showed that its adenine and thymine, and its guanine and cytosine, occur in equal amounts. James Watson and Francis Crick described its double helix in 1953. For 10 points, name this nucleic acid that stores genetic information.', 'DNA', { alt: ['deoxyribonucleic acid'] });
QJ('Fine Arts', 'Auditory Arts', 'This composer wrote six concertos dedicated to the Margrave of Brandenburg and a set of preludes and fugues titled "The Well-Tempered Clavier." He served as Kantor of the Thomaskirche in Leipzig and wrote the Mass in B minor and the Goldberg Variations. For 10 points, name this Baroque German composer of the "Toccata and Fugue in D minor."', 'Johann Sebastian Bach', { type: 'name', req: 'Bach', dup: true, alt: ['J.S. Bach', 'JS Bach'], prompt: ['Bach'] });
QJ('Geography', 'World Geography', 'The Aswan High Dam on this river created Lake Nasser. Its two main tributaries are the White and Blue branches, which meet at Khartoum. It flows north through Sudan and Egypt and empties into the Mediterranean through a large delta. For 10 points, name this longest river of Africa, whose valley hosted ancient Egyptian civilization.', 'Nile River', { alt: ['Nile'] });
QJ('Religion', 'Eastern Religions', 'This man was born in Lumbini as a prince, and left his palace after seeing an old man, a sick man, and a corpse. He practiced extreme asceticism before achieving enlightenment under a Bodhi tree at Bodh Gaya. His first sermon at Sarnath set out the Four Noble Truths. For 10 points, name this founder of Buddhism.', 'Siddhartha Gautama', { type: 'name', req: 'Gautama', alt: ['Buddha', 'Gautama Buddha', 'the Buddha'], partial: true });
QJ('Philosophy', 'Modern Philosophy', 'This thinker wrote that an evil demon might deceive him about everything, and he doubted all he could in order to find a foundation for knowledge. His "Meditations on First Philosophy" and "Discourse on Method" argue for mind-body dualism. For 10 points, name this French philosopher who wrote "I think, therefore I am."', 'René Descartes', { type: 'name', req: 'Descartes' });
QJ('Social Science', 'Economics', 'This economist described a division of labor in a pin factory, using it to explain how specialization improves productivity. He argued that individuals pursuing their own interest are led as if by an "invisible hand" to benefit society. For 10 points, name this Scottish economist who wrote "The Wealth of Nations" in 1776.', 'Adam Smith', { type: 'name', req: 'Smith' });
QJ('Science', 'Physics', 'This scientist explained the photoelectric effect by proposing that light comes in quanta, work for which he won the 1921 Nobel Prize. He explained Brownian motion in his annus mirabilis of 1905, the year he published his special theory of relativity. His general theory of relativity describes gravity as the curvature of spacetime. For 10 points, name this physicist who wrote "E equals m c squared."', 'Albert Einstein', { type: 'name', req: 'Einstein' });

B('quizbowl', 'jv', 'Literature', 'British Literature', 'Answer these questions about plays by William Shakespeare.', [
  ['easy', 'Which play features the feuding Montagues and Capulets?', 'Romeo and Juliet', { prompt: ['Romeo', 'Juliet'] }],
  ['medium', 'In which play does the sorcerer Prospero live on an island with his daughter Miranda?', 'The Tempest', { alt: ['Tempest'] }],
  ['hard', 'In which play does Iago manipulate the Moorish general whose wife is Desdemona?', 'Othello', { alt: ['Othello, the Moor of Venice'] }],
]);
B('quizbowl', 'jv', 'Science', 'Chemistry', 'Answer these questions about gases.', [
  ['easy', 'Which gas makes up about 78 percent of Earth\'s atmosphere?', 'nitrogen'],
  ['medium', 'Which gas do plants absorb from the air during photosynthesis?', 'carbon dioxide', { alt: ['CO2'] }],
  ['hard', 'Which noble gas, the second-lightest element, is used to fill balloons and airships?', 'helium', { alt: ['He'] }],
]);
B('quizbowl', 'jv', 'History', 'World History', 'Answer these questions about World War II.', [
  ['easy', 'Which Hawaiian naval base did Japan attack on December 7, 1941?', 'Pearl Harbor'],
  ['medium', 'The Allied D-Day landings in 1944 took place on the beaches of which region of France?', 'Normandy'],
  ['hard', 'Which Japanese city was the target of the first atomic bomb used in warfare, on August 6, 1945?', 'Hiroshima'],
]);

// ----------------------------------------------------------- Quizbowl varsity
const QV = (...a) => T('quizbowl', 'varsity', ...a);
QV('Literature', 'European Literature', 'This author\'s epic includes a character who tells of Francesca da Rimini and Paolo being blown about by a whirlwind, and another who describes Count Ugolino gnawing on a skull. In it, the Roman poet Virgil guides the narrator through nine circles, while Beatrice leads him through Paradise. For 10 points, name this Florentine author of the "Divine Comedy."', 'Dante Alighieri', { type: 'name', alt: ['Dante', 'Alighieri'], req: 'Dante', partial: true });
QV('Literature', 'World Literature', 'In this author\'s best-known novel, the patriarch José Arcadio Buendía founds the village of Macondo, and a plague of insomnia strikes the town. The story ends when the last Buendía deciphers Melquíades\'s parchments. A pioneer of magical realism, he won the 1982 Nobel Prize. For 10 points, name this Colombian author of "One Hundred Years of Solitude."', 'Gabriel García Márquez', { type: 'name', req: 'Marquez', alt: ['Gabo'] });
QV('History', 'Ancient History', 'A traitor named Ephialtes revealed a mountain path that let the Persians outflank the defenders in this battle. King Leonidas stayed behind with 300 Spartans and a force of Thespians and Thebans. Xerxes\'s invasion forces overwhelmed the defenders at this 480 BC pass in Greece. For 10 points, name this battle, a famous last stand.', 'Battle of Thermopylae', { req: 'Thermopylae', alt: ['Thermopylae'] });
QV('History', 'American History', 'The Judiciary Act of 1789 and William Marbury\'s undelivered commission as a justice of the peace were at issue in this case. In it, Chief Justice John Marshall wrote that a law contrary to the Constitution is void. For 10 points, name this 1803 Supreme Court case that established judicial review.', 'Marbury v. Madison', { req: 'Marbury', alt: ['Marbury v Madison', 'Marbury vs Madison', 'Marbury versus Madison', 'Marbury'] });
QV('Science', 'Physics', 'Ludwig Boltzmann\'s tombstone is inscribed with an equation defining this quantity as a constant times the logarithm of the number of microstates. Rudolf Clausius coined its name. The second law of thermodynamics states that this quantity in an isolated system never decreases. For 10 points, name this measure of disorder, symbolized S.', 'entropy');
QV('Science', 'Math', 'This mathematician scribbled a note in the margin of a copy of Diophantus\'s "Arithmetica" claiming a marvelous proof that was too large for the margin. His little theorem states that a to the p, minus a, is divisible by prime p. For 10 points, name this French mathematician whose "last theorem" was proved by Andrew Wiles in the 1990s.', 'Pierre de Fermat', { type: 'name', req: 'Fermat' });
QV('Fine Arts', 'Architecture', 'This architect designed the Casa Batlló and Casa Milà, and the undulating bench of Park Güell. His unfinished masterpiece in Barcelona has towers with Nativity, Passion, and Glory facades. For 10 points, name this Catalan architect of the Sagrada Família.', 'Antoni Gaudí', { type: 'name', req: 'Gaudi', alt: ['Antonio Gaudi', 'Antoni Gaudi'] });
QV('Mythology', 'Norse Mythology', 'This god sacrificed an eye at Mímir\'s well in exchange for wisdom, and he hung for nine nights on Yggdrasil to learn the runes. His ravens Huginn and Muninn gather news for him, and his eight-legged horse is Sleipnir. For 10 points, name this one-eyed leader of the Aesir who is killed by the wolf Fenrir at Ragnarok.', 'Odin', { type: 'name', alt: ['Woden', 'Wotan', 'Wodan'] });
QV('Geography', 'World Geography', 'The Serengeti plains and the volcano Kilimanjaro lie in this country, which includes the island of Zanzibar. Its largest city is Dar es Salaam, though its official capital was moved to Dodoma. For 10 points, name this East African country, formed by the union of Tanganyika and Zanzibar, whose neighbors include Kenya.', 'Tanzania', { alt: ['United Republic of Tanzania'] });
QV('Social Science', 'Psychology', 'A metronome and later a bell were sounded before food was delivered in experiments by this researcher, who measured the salivation of dogs. His work on classical conditioning revealed that a neutral stimulus can evoke a conditioned response. For 10 points, name this Russian physiologist who won the 1904 Nobel Prize in Physiology or Medicine.', 'Ivan Pavlov', { type: 'name', req: 'Pavlov' });

B('quizbowl', 'varsity', 'Fine Arts', 'Auditory Arts', 'Answer these questions about opera composers.', [
  ['easy', 'Which Italian composer wrote "The Barber of Seville"?', 'Gioachino Rossini', { type: 'name', req: 'Rossini' }],
  ['medium', 'Which Italian composer wrote "La Traviata" and "Aida"?', 'Giuseppe Verdi', { type: 'name', req: 'Verdi' }],
  ['hard', 'Which Italian composer wrote "Tosca" and "Madama Butterfly"?', 'Giacomo Puccini', { type: 'name', req: 'Puccini' }],
]);
B('quizbowl', 'varsity', 'Philosophy', 'Ancient Philosophy', 'Answer these questions about Greek philosophers.', [
  ['easy', 'Which philosopher wrote the "Republic"?', 'Plato', { type: 'name' }],
  ['medium', 'Which student of Plato tutored Alexander the Great?', 'Aristotle', { type: 'name' }],
  ['hard', 'Which teacher of Plato was sentenced to death by drinking hemlock?', 'Socrates', { type: 'name' }],
]);
B('quizbowl', 'varsity', 'Science', 'Math', 'Answer these questions about mathematical constants.', [
  ['easy', 'What constant, approximately 3.14159, is the ratio of a circle\'s circumference to its diameter?', 'pi', { alt: ['π', '3.14159', '3.14'] }],
  ['medium', 'What constant, approximately 2.718, is the base of the natural logarithm?', 'e', { alt: ['Euler\'s number', 'Eulers number', '2.718'] }],
  ['hard', 'What ratio, approximately 1.618, is denoted by the Greek letter phi?', 'golden ratio', { alt: ['phi', 'golden mean', 'golden section'] }],
]);

// Indices per ruleset-level set that are easy or hard (rest medium).
tagDifficulty(out, {
  'ncal-novice': { easy: [0, 1, 2, 5, 6, 8], hard: [], bonusEasy: [2], bonusHard: [0] },
  'ncal-jv': { easy: [5, 6, 7], hard: [1, 2, 8], bonusEasy: [0], bonusHard: [1] },
  'ncal-varsity': { easy: [1, 4, 6], hard: [0, 5, 7], bonusEasy: [1], bonusHard: [2] },
  'quizbowl-novice': { easy: [0, 2, 4, 5, 9], hard: [6, 8], bonusEasy: [0, 2], bonusHard: [1] },
  'quizbowl-jv': { easy: [0, 5, 8, 9], hard: [2, 4, 6], bonusEasy: [1], bonusHard: [0] },
  'quizbowl-varsity': { easy: [7, 8], hard: [0, 3, 5, 6], bonusEasy: [1], bonusHard: [2] },
});
writeFileSync(new URL('../seed/questions.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
const tossups = out.filter((q) => q.type === 'tossup').length;
console.log(`wrote ${out.length} questions (${tossups} tossups, ${out.length - tossups} bonuses)`);
