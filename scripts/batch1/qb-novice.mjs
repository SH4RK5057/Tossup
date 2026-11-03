export default function ({ T, B }) {
  // Literature
  T('Literature', 'American Literature', 'In this novel, a pig named Wilbur is saved from the butcher when a spider spins words such as "Some Pig" and "Radiant" into her web. The girl Fern first rescues Wilbur as a runt, and he later wins a special prize at the county fair. For 10 points, name this E. B. White children\'s book named for its spider.', "Charlotte's Web", { alt: ['Charlotte'] });
  T('Literature', 'British Literature', 'The Sorting Hat places students into houses such as Gryffindor and Slytherin at this school, where Hagrid is gamekeeper and Albus Dumbledore is headmaster. Hermione Granger and Ron Weasley are friends of the title character of the series set there. For 10 points, name this British author of the Harry Potter books.', 'J. K. Rowling', { type: 'name', req: 'Rowling' });
  T('Literature', 'British Literature', 'Friar Laurence marries the two title characters in secret, and a feud between the Montagues and the Capulets ends in tragedy when Tybalt kills Mercutio. A famous scene takes place on a balcony, and both lovers die in a tomb. For 10 points, name this play by William Shakespeare set in Verona.', 'Romeo and Juliet', { prompt: ['Romeo', 'Juliet'] });
  T('Literature', 'British Literature', 'In this novella, the ghost of Jacob Marley warns a miser that he will be visited by three spirits. The spirits show him his lonely past, his clerk Bob Cratchit\'s family, and the sickly Tiny Tim. For 10 points, name this Charles Dickens story about Ebenezer Scrooge, set at the holiday it names.', 'A Christmas Carol', { alt: ['Christmas Carol'] });
  T('Literature', 'World Literature', 'In this epic poem, the hero blinds the Cyclops Polyphemus, resists the song of the Sirens, and is delayed for years by the enchantress Circe. After ten years of wandering, he returns to Ithaca and defeats the suitors of his wife Penelope. For 10 points, name this epic attributed to Homer, a sequel of sorts to the Iliad.', 'Odyssey', { alt: ['The Odyssey'] });
  T('Literature', 'American Literature', 'This author, whose real name was Theodor Geisel, wrote "The Lorax" and "Green Eggs and Ham." His rhyming books feature a mischievous cat in a striped hat and a grumpy creature who tries to steal Christmas. For 10 points, name this author of "The Cat in the Hat" who used a pen name.', 'Dr. Seuss', { type: 'name', req: 'Seuss', alt: ['Theodor Geisel', 'Theodor Seuss Geisel'] });
  // History
  T('History', 'American History', 'This man served as the third president and doubled the size of the country with the Louisiana Purchase. He lived at Monticello and founded the University of Virginia. For 10 points, name this man who was the principal author of the Declaration of Independence.', 'Thomas Jefferson', { type: 'name', req: 'Jefferson' });
  T('History', 'Ancient History', 'The archaeologist Howard Carter discovered this ruler\'s nearly intact tomb in the Valley of the Kings in 1922. Found inside were a famous golden funeral mask and a nested set of coffins. For 10 points, name this young Egyptian pharaoh of the 18th dynasty, nicknamed "King ___."', 'Tutankhamun', { type: 'name', alt: ['King Tut', 'Tut', 'Tutankhamen'] });
  T('History', 'American History', 'This 1773 protest was organized by the Sons of Liberty in response to the Tea Act. Men disguised as Mohawks boarded three ships and threw 342 chests of tea into the water. For 10 points, name this event in a Massachusetts harbor that helped lead to the American Revolution.', 'Boston Tea Party', { alt: ['the Boston Tea Party', 'Tea Party'] });
  T('History', 'American History', 'Born Araminta Ross in Maryland, this woman escaped slavery and made about thirteen trips back to the South. She guided enslaved people to freedom along the Underground Railroad and was called "Moses." For 10 points, name this abolitionist.', 'Harriet Tubman', { type: 'name', req: 'Tubman' });
  T('History', 'Ancient History', 'This man crossed the Rubicon in 49 BC, defeated Pompey, and became dictator of Rome. He formed the First Triumvirate with Crassus and Pompey and wrote about his campaigns in Gaul. For 10 points, name this man stabbed by senators including Brutus on the Ides of March in 44 BC.', 'Julius Caesar', { type: 'name', req: 'Caesar' });
  T('History', 'American History', 'This period began with the stock market crash of October 1929. Dust storms ruined farms in the Plains, banks failed, and about a quarter of Americans were out of work. For 10 points, name this decade-long economic downturn that led to the New Deal.', 'Great Depression', { alt: ['the Great Depression'] });
  // Science
  T('Science', 'Earth Science', 'Heat from the Sun drives evaporation in this process, and water vapor then condenses into clouds. It falls as rain or snow and flows back to the oceans through rivers and groundwater. For 10 points, name this cycle that moves water between the sky, land, and sea.', 'water cycle', { alt: ['hydrologic cycle', 'the water cycle'] });
  T('Science', 'Physics', 'This man\'s "Principia" laid out the laws of motion and universal gravitation. He invented calculus independently of Leibniz and showed that white light is made of many colors. For 10 points, name this English scientist who, according to legend, was inspired by a falling apple.', 'Isaac Newton', { type: 'name', req: 'Newton' });
  T('Science', 'Chemistry', 'This Russian chemist arranged the elements by atomic weight and left gaps for undiscovered ones such as gallium and germanium. He published his table in 1869. For 10 points, name this man who created the periodic table.', 'Dmitri Mendeleev', { type: 'name', req: 'Mendeleev', alt: ['Mendeleyev'] });
  T('Science', 'Astronomy', 'Galileo discovered four large moons of this planet: Io, Europa, Ganymede, and Callisto. A storm larger than Earth, called the Great Red Spot, rages in its atmosphere. For 10 points, name this largest planet of the Solar System.', 'Jupiter');
  T('Science', 'Earth Science', 'Alfred Wegener proposed that the continents were once joined in this single landmass, whose name means "all land." It split into Laurasia and Gondwana about 200 million years ago. For 10 points, name this ancient supercontinent.', 'Pangaea', { alt: ['Pangea'] });
  T('Science', 'Biology', 'This bone is the strongest and the longest in the human body. It runs from the hip to the knee and is protected by large muscles including the quadriceps. For 10 points, name this bone of the upper leg, also called the thigh bone.', 'femur', { alt: ['thigh bone', 'thighbone'] });
  T('Science', 'Math', 'Archimedes approximated this number using polygons inscribed in and circumscribed about a circle. It is irrational, so its decimal expansion never ends or repeats. For 10 points, name this number, about 3.14, equal to a circle\'s circumference divided by its diameter.', 'pi', { alt: ['π', '3.14', '3.14159'] });
  // Fine Arts
  T('Fine Arts', 'Visual Arts', 'This artist\'s notebooks include designs for flying machines and a drawing of a man with outstretched arms in a circle and square called the Vitruvian Man. He also painted "The Last Supper." For 10 points, name this Renaissance artist who painted the Mona Lisa.', 'Leonardo da Vinci', { type: 'name', alt: ['da Vinci', 'Leonardo'], partial: true });
  T('Fine Arts', 'Auditory Arts', 'This composer continued to write music after becoming almost completely deaf. His Fifth Symphony opens with four notes that go "da da da DUM," and his Ninth Symphony includes the "Ode to Joy." For 10 points, name this German composer of the "Moonlight Sonata."', 'Ludwig van Beethoven', { type: 'name', req: 'Beethoven' });
  T('Fine Arts', 'Visual Arts', 'This Spanish painter went through a Blue Period and later co-founded Cubism with Georges Braque. His huge anti-war mural shows the bombing of a Basque town. For 10 points, name this artist of "Guernica."', 'Pablo Picasso', { type: 'name', req: 'Picasso' });
  T('Fine Arts', 'Auditory Arts', 'This composer was a child prodigy who toured Europe\'s courts as a boy with his sister Nannerl. He was born in Salzburg and wrote "Eine kleine Nachtmusik" and an unfinished Requiem. For 10 points, name this Austrian composer of "The Magic Flute."', 'Wolfgang Amadeus Mozart', { type: 'name', req: 'Mozart' });
  // Religion and Mythology
  T('Religion', 'Christianity', 'This fisherman was called Simon before Jesus renamed him, and he walked on water briefly before sinking. He denied Jesus three times before the rooster crowed. For 10 points, name this apostle regarded by Catholics as the first pope.', 'Saint Peter', { type: 'name', req: 'Peter', alt: ['Peter', 'Simon Peter'] });
  T('Religion', 'Islam', 'Its followers observe the Five Pillars, including fasting during Ramadan and making a pilgrimage to Mecca known as the hajj. Its holy book is the Quran, which it holds was revealed to the Prophet Muhammad. For 10 points, name this monotheistic religion, whose followers are called Muslims.', 'Islam');
  T('Mythology', 'Norse Mythology', 'This god wields the hammer Mjolnir and drives a chariot pulled by two goats. He fights the world serpent Jormungandr, and the day Thursday is named for him. For 10 points, name this Norse god of thunder, a son of Odin.', 'Thor', { type: 'name' });
  T('Mythology', 'Greco-Roman Mythology', 'According to Hesiod, Hephaestus molded this first woman from clay on the orders of Zeus. She was given a jar, or box, that she opened, releasing evils into the world and leaving only hope inside. For 10 points, name this woman of Greek myth.', 'Pandora', { type: 'name' });
  // Philosophy, Social Science, Geography, Other
  T('Philosophy', 'Ancient Philosophy', 'This man asked probing questions in a method named for him and was the teacher of Plato. He was tried in Athens for corrupting the young and impiety. For 10 points, name this philosopher who was sentenced to die by drinking hemlock.', 'Socrates', { type: 'name' });
  T('Social Science', 'Psychology', 'This Austrian founded psychoanalysis and described the id, the ego, and the superego. He wrote "The Interpretation of Dreams" and developed the practice of free association. For 10 points, name this psychologist from Vienna.', 'Sigmund Freud', { type: 'name', req: 'Freud' });
  T('Geography', 'World Geography', 'Edmund Hillary and Tenzing Norgay first reached the summit of this mountain in 1953. It sits in the Himalayas on the border of Nepal and Tibet. For 10 points, name this tallest mountain above sea level in the world.', 'Mount Everest', { alt: ['Everest'] });
  T('Geography', 'American Geography', 'The Colorado River carved this landform over millions of years, exposing layers of rock up to a mile deep. It is in Arizona and is roughly 277 miles long. For 10 points, name this enormous canyon, a national park and a popular destination for rafters.', 'Grand Canyon', { alt: ['the Grand Canyon'] });
  T('Science', 'Computer Science', 'Computers use this number system because transistors have two states, on and off. A single digit in it is called a bit. For 10 points, name this base-two system that uses only the digits 0 and 1.', 'binary', { alt: ['base two', 'base 2', 'binary system', 'binary numbers'] });
  T('Other Academic', 'General Knowledge', 'Johannes Gutenberg introduced this machine to Europe around 1440. It used movable metal type, and its first major product was a Bible. For 10 points, name this invention that made books much cheaper to produce.', 'printing press', { alt: ['the printing press', 'Gutenberg press', 'Gutenberg printing press'] });

  // ---------------------------------------------------------------- bonuses
  B('Literature', 'American Literature', 'Answer these questions about Dr. Seuss books.', [
    ['easy', 'Which Seuss book features a grumpy green creature who tries to ruin Christmas in Whoville?', 'How the Grinch Stole Christmas', { alt: ['The Grinch', 'Grinch', 'How the Grinch Stole Christmas!'] }],
    ['medium', 'Which Seuss book features the character Sam-I-Am?', 'Green Eggs and Ham'],
    ['hard', 'Which Seuss book features a creature who "speaks for the trees"?', 'The Lorax', { alt: ['Lorax'] }],
  ]);
  B('History', 'American History', 'Answer these questions about the founding era.', [
    ['easy', 'Who wrote the 1776 pamphlet "Common Sense"?', 'Thomas Paine', { type: 'name', req: 'Paine' }],
    ['medium', 'Who was the first Secretary of the Treasury?', 'Alexander Hamilton', { type: 'name', req: 'Hamilton' }],
    ['hard', 'Who wrote the poem that became "The Star-Spangled Banner"?', 'Francis Scott Key', { type: 'name', req: 'Key' }],
  ]);
  B('Science', 'Astronomy', 'Answer these questions about planets.', [
    ['easy', 'Which planet is home to Olympus Mons, the largest volcano in the Solar System?', 'Mars'],
    ['medium', 'Which planet is the hottest, because of its thick atmosphere of carbon dioxide?', 'Venus'],
    ['hard', 'Which planet rotates on its side, with an axial tilt of about 98 degrees?', 'Uranus'],
  ]);
  B('Geography', 'American Geography', 'Answer these questions about U.S. state capitals.', [
    ['easy', 'What is the capital of New York?', 'Albany'],
    ['medium', 'What is the capital of Florida?', 'Tallahassee'],
    ['hard', 'What is the capital of Illinois?', 'Springfield'],
  ]);
  B('Fine Arts', 'Visual Arts', 'Answer these questions about famous paintings.', [
    ['easy', 'Who painted "The Scream"?', 'Edvard Munch', { type: 'name', req: 'Munch' }],
    ['medium', 'Who painted "American Gothic"?', 'Grant Wood', { type: 'name', req: 'Wood' }],
    ['hard', 'Who painted "The Persistence of Memory," with its melting clocks?', 'Salvador Dalí', { type: 'name', req: 'Dali' }],
  ]);
  B('Mythology', 'Greco-Roman Mythology', 'Answer these questions about Greek mythology.', [
    ['easy', 'Which goddess is the Greek goddess of love and beauty?', 'Aphrodite', { type: 'name' }],
    ['medium', 'Which god is the winged messenger of the gods?', 'Hermes', { type: 'name' }],
    ['hard', 'Which winged horse sprang from the blood of Medusa?', 'Pegasus', { type: 'name' }],
  ]);
  B('Science', 'Biology', 'Answer these questions about living things.', [
    ['easy', 'What gas do plants release during photosynthesis?', 'oxygen'],
    ['medium', 'What term describes animals that eat only plants?', 'herbivores', { alt: ['herbivore'] }],
    ['hard', 'What term describes animals that have a backbone?', 'vertebrates', { alt: ['vertebrate'] }],
  ]);
  B('History', 'World History', 'Answer these questions about world history.', [
    ['easy', 'Which Greek city-state was famous for its military training of boys?', 'Sparta'],
    ['medium', 'Which empire was founded by Genghis Khan?', 'Mongol Empire', { alt: ['Mongol', 'Mongols', 'the Mongol Empire'] }],
    ['hard', 'Which Chinese dynasty, which ruled from 1368 to 1644, built much of the Great Wall that survives today?', 'Ming dynasty', { alt: ['Ming'] }],
  ]);
  B('Religion', 'Other Religion', 'Answer these questions about holy books.', [
    ['easy', 'What is the holy book of Islam?', 'Quran', { alt: ["Qur'an", 'Koran'] }],
    ['medium', 'What is the holy book of Judaism, consisting of the first five books of the Hebrew Bible?', 'Torah', { alt: ['the Torah'] }],
    ['hard', 'Which Hindu scripture is a conversation between Arjuna and Krishna?', 'Bhagavad Gita', { alt: ['Gita', 'the Bhagavad Gita'] }],
  ]);
}
