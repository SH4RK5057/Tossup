export default function ({ T, B }) {
  // Literature
  T('Literature', 'British Literature', 'In this novel, Winston Smith works at the Ministry of Truth rewriting records and is later tortured in Room 101. The Party uses Newspeak and telescreens, and its leader is the face on posters that say he is watching. For 10 points, name this George Orwell dystopian novel named for a year.', '1984', { alt: ['Nineteen Eighty-Four', 'nineteen eighty four'] });
  T('Literature', 'British Literature', 'Thornfield Hall is the setting for much of this novel, in which a governess is hired to teach a girl named Adèle. She later discovers that her employer, Mr. Rochester, has hidden his first wife Bertha Mason in the attic. For 10 points, name this Charlotte Brontë novel named for its title heroine.', 'Jane Eyre');
  T('Literature', 'American Literature', 'Hester Prynne is forced to wear an embroidered "A" in this novel, and the minister Arthur Dimmesdale is the secret father of her daughter Pearl. Her husband takes the name Roger Chillingworth. For 10 points, name this Nathaniel Hawthorne novel set in Puritan Boston.', 'The Scarlet Letter', { alt: ['Scarlet Letter'] });
  T('Literature', 'British Literature', 'A group of schoolboys is stranded on a deserted island in this novel, where they use a conch to call meetings. The boy Piggy is killed, and the hunter Jack rebels against the elected leader Ralph. For 10 points, name this William Golding novel.', 'Lord of the Flies');
  T('Literature', 'British Literature', 'The explorer Robert Walton relays the story of Victor in this novel, which Mary Shelley began during a ghost-story contest in Geneva. Victor brings a creature to life and then abandons it. For 10 points, name this novel whose title is often wrongly given to the monster.', 'Frankenstein', { alt: ['Frankenstein; or, The Modern Prometheus'] });
  T('Literature', 'American Literature', 'This poet lived in Amherst, Massachusetts, and published very few poems during her life. Her poems use dashes and slant rhyme, as in "Because I could not stop for Death." For 10 points, name this reclusive American poet whose nearly 1,800 poems were found after she died in 1886.', 'Emily Dickinson', { type: 'name', req: 'Dickinson' });
  T('Literature', 'World Literature', 'The wrath of Achilles after his quarrel with Agamemnon is the central subject of this epic. Patroclus is killed wearing Achilles\' armor, and Achilles then kills Hector. For 10 points, name this Homeric epic of the Trojan War.', 'Iliad', { alt: ['The Iliad'] });
  // History
  T('History', 'European History', 'King John was forced to accept this document at Runnymede in 1215 by rebellious barons. It limited royal power and promised that no free man could be imprisoned except by the lawful judgment of his peers. For 10 points, name this English charter.', 'Magna Carta', { alt: ['Great Charter', 'Magna Charta'] });
  T('History', 'European History', 'Crowds searching for gunpowder and prisoners attacked this Paris fortress and prison on July 14, 1789. The governor, Bernard de Launay, was killed. For 10 points, name this building whose storming marks the start of the French Revolution.', 'the Bastille', { alt: ['Bastille', 'storming of the Bastille'] });
  T('History', 'World History', 'This Venetian merchant traveled to China with his father and uncle and served at the court of Kublai Khan. His account of his journeys was dictated to Rustichello da Pisa. For 10 points, name this explorer, author of "The Travels."', 'Marco Polo', { type: 'name', req: 'Polo' });
  T('History', 'American History', 'John F. Kennedy announced a naval quarantine of an island after U-2 planes photographed missile sites there. Nikita Khrushchev eventually agreed to remove the missiles in October 1962. For 10 points, name this Cold War confrontation named for the country where the missiles were placed.', 'Cuban Missile Crisis', { alt: ['the Cuban Missile Crisis'] });
  T('History', 'World History', 'James Watt\'s improvements to the steam engine and the invention of the spinning jenny by James Hargreaves were important in this period. It began in Britain in the late 1700s and moved work from farms and workshops to factories. For 10 points, name this era of mechanization.', 'Industrial Revolution', { alt: ['the Industrial Revolution'] });
  T('History', 'American History', 'Elizabeth Cady Stanton and Lucretia Mott organized this 1848 meeting in New York, where a Declaration of Sentiments called for women\'s right to vote. For 10 points, name this first women\'s rights convention, held in a town in the Finger Lakes region.', 'Seneca Falls Convention', { alt: ['Seneca Falls', 'the Seneca Falls Convention'] });
  T('History', 'Ancient History', 'This man was tutored by Aristotle and succeeded his father Philip II as king of Macedon. He defeated Darius III at Gaugamela and rode a horse named Bucephalus. For 10 points, name this conqueror who died in Babylon in 323 BC after building a huge empire.', 'Alexander the Great', { type: 'name', req: 'Alexander', alt: ['Alexander III of Macedon'] });
  // Science
  T('Science', 'Chemistry', 'Helium, neon, argon, krypton, xenon, and radon are the members of this group. They sit in the far-right column of the periodic table and are chemically unreactive because their outer electron shells are full. For 10 points, name this group of gases such as the one in neon signs.', 'noble gases', { alt: ['inert gases', 'noble gas', 'inert gas', 'group 18'] });
  T('Science', 'Biology', 'The Calvin cycle is the light-independent stage of this process, which takes place in chloroplasts. The light reactions occur in the thylakoid membranes and use chlorophyll. For 10 points, name this process by which plants convert carbon dioxide and water into glucose.', 'photosynthesis');
  T('Science', 'Chemistry', 'This scientist discovered polonium, which she named for her native Poland, and radium. She won the Nobel Prize in Physics in 1903, sharing it with her husband Pierre and Henri Becquerel, and the Nobel Prize in Chemistry in 1911. For 10 points, name this pioneer of radioactivity.', 'Marie Curie', { type: 'name', req: 'Curie', dup: true, prompt: ['Curie'], alt: ['Marie Sklodowska-Curie', 'Madame Curie'] });
  T('Science', 'Astronomy', 'The boundary of this object is called the event horizon, and nothing inside it can escape, not even light. Stephen Hawking predicted that it should slowly lose mass through radiation. For 10 points, name this object, such as Sagittarius A*, with a singularity at its center.', 'black hole', { alt: ['black holes'] });
  T('Science', 'Earth Science', 'The Mid-Atlantic Ridge is a boundary where new crust forms in this theory, and the San Andreas Fault is a boundary where plates slide past each other. Subduction zones surround the Pacific in the so-called Ring of Fire. For 10 points, name this theory that Earth\'s outer shell is broken into moving slabs.', 'plate tectonics', { alt: ['tectonic plates', 'continental drift'] });
  T('Science', 'Biology', 'This English physician noticed that milkmaids who caught cowpox seemed to be protected from smallpox. In 1796 he inoculated a boy named James Phipps. For 10 points, name this man who developed the first vaccine.', 'Edward Jenner', { type: 'name', req: 'Jenner' });
  T('Science', 'Math', 'Leonardo of Pisa introduced this sequence to Europe in his book "Liber Abaci" using a problem about rabbits. Each term is the sum of the two before it, as in 1, 1, 2, 3, 5, 8. For 10 points, name this sequence, whose ratios approach the golden ratio.', 'Fibonacci sequence', { alt: ['Fibonacci numbers', 'Fibonacci', 'the Fibonacci sequence'] });
  T('Science', 'Computer Science', 'This man helped break the Enigma code at Bletchley Park during World War II. He proposed an abstract machine now named for him and a test of whether a machine can imitate a human. For 10 points, name this British mathematician and computer scientist.', 'Alan Turing', { type: 'name', req: 'Turing' });
  // Fine Arts
  T('Fine Arts', 'Auditory Arts', 'This composer, nicknamed "the Red Priest," taught at a Venetian orphanage for girls called the Ospedale della Pietà. He wrote hundreds of concertos, including a set of four violin concertos named for the times of the year. For 10 points, name this Baroque composer of "The Four Seasons."', 'Antonio Vivaldi', { type: 'name', req: 'Vivaldi' });
  T('Fine Arts', 'Visual Arts', 'This Dutch painter\'s "The Night Watch" depicts a militia company, and his "The Anatomy Lesson of Dr. Nicolaes Tulp" shows a dissection. He made many self-portraits and was known for dramatic contrasts of light and dark. For 10 points, name this artist of the Dutch Golden Age.', 'Rembrandt van Rijn', { type: 'name', req: 'Rembrandt', alt: ['Rembrandt'] });
  T('Fine Arts', 'Architecture', 'The Mughal emperor Shah Jahan commissioned this building as a tomb for his wife Mumtaz Mahal. It stands on the banks of the Yamuna River in Agra and is made of white marble with four minarets. For 10 points, name this mausoleum, one of India\'s most famous landmarks.', 'Taj Mahal', { alt: ['the Taj Mahal'] });
  T('Fine Arts', 'Visual Arts', 'This Spanish painter was a leader of Surrealism and sported an upturned mustache. His works include "The Persistence of Memory," which has melting clocks, and "Swans Reflecting Elephants." For 10 points, name this artist.', 'Salvador Dalí', { type: 'name', req: 'Dali' });
  // Mythology, Religion, Philosophy
  T('Mythology', 'World Mythology', 'In Egyptian mythology, his brother Set tricked him into a coffin and later cut his body into pieces, which his wife Isis gathered. He became lord of the underworld, and their son Horus avenged him. For 10 points, name this Egyptian god of the dead.', 'Osiris', { type: 'name' });
  T('Religion', 'Christianity', 'This German monk is said to have nailed his 95 Theses to the door of the Wittenberg church in 1517. He was condemned at the Diet of Worms in 1521 and later translated the Bible into German. For 10 points, name this leader of the Protestant Reformation.', 'Martin Luther', { type: 'name', req: 'Luther' });
  T('Philosophy', 'Ancient Philosophy', 'This man founded a school called the Lyceum and wrote the "Nicomachean Ethics" and the "Poetics." He was a student of Plato and tutor to Alexander the Great. For 10 points, name this Greek philosopher who developed formal logic.', 'Aristotle', { type: 'name' });
  // Social Science and Geography
  T('Social Science', 'Economics', 'Simon Kuznets developed the national accounts that led to this measure. It is computed by adding consumption, investment, government spending, and net exports. For 10 points, name this measure of the value of a country\'s output, abbreviated GDP.', 'gross domestic product', { alt: ['GDP'] });
  T('Social Science', 'Psychology', 'This Swiss psychologist proposed four stages of cognitive development: sensorimotor, preoperational, concrete operational, and formal operational. He studied his own children and developed the idea of object permanence. For 10 points, name this child psychologist.', 'Jean Piaget', { type: 'name', req: 'Piaget' });
  T('Geography', 'World Geography', 'This river begins in the Andes of Peru and flows across Brazil past the city of Manaus. It discharges more water than any other river and is surrounded by the world\'s largest rainforest. For 10 points, name this South American river.', 'Amazon River', { alt: ['Amazon', 'the Amazon'] });
  T('Geography', 'American Geography', 'Lake Itasca in Minnesota is the source of this river. The Missouri and Ohio rivers are its major tributaries, and it empties into the Gulf of Mexico south of New Orleans. For 10 points, name this river that forms the boundary of many states.', 'Mississippi River', { alt: ['Mississippi', 'the Mississippi'] });

  // ---------------------------------------------------------------- bonuses
  B('Literature', 'World Literature', 'Answer these questions about Greek epics.', [
    ['easy', 'Who is the hero of the Odyssey, who tricks the Cyclops by calling himself "Nobody"?', 'Odysseus', { type: 'name', alt: ['Ulysses'] }],
    ['medium', 'Which wooden structure did the Greeks use to enter Troy?', 'Trojan Horse', { alt: ['the Trojan Horse', 'wooden horse'] }],
    ['hard', 'Which sorceress turned Odysseus\'s men into pigs?', 'Circe', { type: 'name' }],
  ]);
  B('History', 'American History', 'Answer these questions about the Civil War.', [
    ['easy', 'Which general commanded the Confederate Army of Northern Virginia?', 'Robert E. Lee', { type: 'name', req: 'Lee' }],
    ['medium', 'Which Pennsylvania battle in July 1863 was the war\'s turning point in the East?', 'Gettysburg', { alt: ['Battle of Gettysburg'] }],
    ['hard', 'Which Union general led the March to the Sea through Georgia?', 'William Tecumseh Sherman', { type: 'name', req: 'Sherman' }],
  ]);
  B('Science', 'Physics', 'Answer these questions about energy.', [
    ['easy', 'What kind of energy does a moving object have?', 'kinetic energy', { alt: ['kinetic'] }],
    ['medium', 'What kind of energy is stored in an object because of its position, such as a book on a shelf?', 'potential energy', { alt: ['potential', 'gravitational potential energy'] }],
    ['hard', 'What law states that energy cannot be created or destroyed, only transformed?', 'conservation of energy', { alt: ['law of conservation of energy', 'first law of thermodynamics'] }],
  ]);
  B('Science', 'Biology', 'Answer these questions about the human body.', [
    ['easy', 'Which organ filters waste from the blood to make urine?', 'kidney', { alt: ['kidneys'] }],
    ['medium', 'Which gland produces insulin?', 'pancreas', { alt: ['the pancreas'] }],
    ['hard', 'Which part of the brain controls balance and coordination?', 'cerebellum', { alt: ['the cerebellum'] }],
  ]);
  B('Fine Arts', 'Auditory Arts', 'Answer these questions about orchestra instruments.', [
    ['easy', 'Which instrument family includes the violin, viola, cello, and double bass?', 'strings', { alt: ['string family', 'string instruments', 'string section'] }],
    ['medium', 'Which brass instrument has a slide that changes its pitch?', 'trombone'],
    ['hard', 'Which woodwind instrument has a double reed and plays the tuning note A for the orchestra?', 'oboe'],
  ]);
  B('Geography', 'World Geography', 'Answer these questions about world capitals.', [
    ['easy', 'What is the capital of Japan?', 'Tokyo'],
    ['medium', 'What is the capital of Brazil?', 'Brasília', { alt: ['Brasilia'] }],
    ['hard', 'What is the capital of Australia?', 'Canberra'],
  ]);
  B('Philosophy', 'Modern Philosophy', 'Answer these questions about Enlightenment thinkers.', [
    ['easy', 'Which English philosopher argued in "Leviathan" that life without government would be "nasty, brutish, and short"?', 'Thomas Hobbes', { type: 'name', req: 'Hobbes' }],
    ['medium', 'Which English philosopher argued that people have natural rights to life, liberty, and property?', 'John Locke', { type: 'name', req: 'Locke' }],
    ['hard', 'Which French thinker wrote "The Social Contract," which begins "Man is born free, and everywhere he is in chains"?', 'Jean-Jacques Rousseau', { type: 'name', req: 'Rousseau' }],
  ]);
  B('Mythology', 'Greco-Roman Mythology', 'Answer these questions about Roman mythology.', [
    ['easy', 'According to legend, which man founded Rome after killing his twin brother?', 'Romulus', { type: 'name' }],
    ['medium', 'Which animal nursed the twin founders of Rome as infants?', 'she-wolf', { alt: ['wolf', 'a she-wolf', 'she wolf'] }],
    ['hard', 'Which Trojan hero fled his burning city and is the hero of Virgil\'s epic?', 'Aeneas', { type: 'name' }],
  ]);
}
