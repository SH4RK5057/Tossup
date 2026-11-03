export default function ({ T, B }) {
  // English Grammar
  T('English', 'English Grammar', 'What part of speech is the word "quickly" in the sentence "She ran quickly"?', 'adverb');
  T('English', 'English Grammar', 'What punctuation mark ends a declarative sentence?', 'period', { alt: ['full stop'] });
  T('English', 'English Grammar', 'What part of speech takes the place of a noun, such as "she" or "they"?', 'pronoun');
  T('English', 'English Grammar', 'What part of speech is the word "and" in the phrase "salt and pepper"?', 'conjunction');
  T('English', 'English Grammar', 'What is the plural of the word "child"?', 'children');
  T('English', 'English Grammar', 'What part of speech is the word "run" in the sentence "Birds run from cats"?', 'verb');
  // English Vocabulary
  T('English', 'English Vocabulary', 'What word names a word that has the same meaning as another word?', 'synonym');
  T('English', 'English Vocabulary', 'What word names two words that sound alike but differ in meaning and spelling, like "there" and "their"?', 'homophone');
  T('English', 'English Vocabulary', 'What is the root word of the word "unhappiness"?', 'happy');
  // Literary Terms
  T('English', 'Literary Terms', 'What term names the main character of a story?', 'protagonist');
  T('English', 'Literary Terms', 'What term names the time and place in which a story happens?', 'setting');
  T('English', 'Literary Terms', 'What term names a fourteen-line poem?', 'sonnet');
  T('English', 'Literary Terms', 'What term names the repetition of beginning consonant sounds, as in "Peter Piper picked a peck"?', 'alliteration');
  T('English', 'Literary Terms', 'What term names the turning point or moment of highest tension in a story?', 'climax');
  T('English', 'Literary Terms', 'What term names a story told by a narrator who uses the pronoun "I"?', 'first-person narration', { alt: ['first person', 'first-person point of view', 'first person point of view'] });
  // Freshman Literature
  T('English', 'Freshman Literature', 'Which Shakespeare play features the star-crossed lovers of Verona?', 'Romeo and Juliet', { prompt: ['Romeo', 'Juliet'] });
  T('English', 'Freshman Literature', 'Which author wrote the novel "Of Mice and Men"?', 'John Steinbeck', { type: 'name', req: 'Steinbeck' });
  T('English', 'Freshman Literature', 'Which author wrote the novel "To Kill a Mockingbird"?', 'Harper Lee', { type: 'name', req: 'Lee' });
  T('English', 'Freshman Literature', 'In Homer\'s "Odyssey," what is the name of the hero\'s faithful wife who waits for him in Ithaca?', 'Penelope', { type: 'name' });
  // Greek and Roman Mythology
  T('English', 'Greek and Roman Mythology', 'Which Greek goddess of wisdom was born from the head of Zeus?', 'Athena', { type: 'name', alt: ['Athene'] });
  T('English', 'Greek and Roman Mythology', 'Which Greek god ruled the sea?', 'Poseidon', { type: 'name' });
  T('English', 'Greek and Roman Mythology', 'What is the Roman name for the Greek god of war, Ares?', 'Mars', { type: 'name' });
  T('English', 'Greek and Roman Mythology', 'Which Greek hero killed the Minotaur in the Labyrinth?', 'Theseus', { type: 'name' });
  // Fine Arts
  T('Fine Arts', 'Art Terms', 'What term names a painting or drawing of a person\'s face?', 'portrait');
  T('Fine Arts', 'Art Terms', 'The primary colors in paint are red, yellow, and which other color?', 'blue');
  T('Fine Arts', 'Art Terms', 'What term names a three-dimensional artwork, such as one carved from marble?', 'sculpture');
  T('Fine Arts', 'Music Theory and Terms', 'What Italian musical term means to play loudly?', 'forte');
  T('Fine Arts', 'Music Theory and Terms', 'What Italian musical term means to play softly?', 'piano');
  T('Fine Arts', 'Composers and Works', 'Which Italian Baroque composer wrote "The Four Seasons"?', 'Antonio Vivaldi', { type: 'name', req: 'Vivaldi' });
  T('Fine Arts', 'Composers and Works', 'Which German composer wrote the "Moonlight Sonata"?', 'Ludwig van Beethoven', { type: 'name', req: 'Beethoven' });
  T('Fine Arts', 'Spanish 1', 'What is the Spanish word for the color "red"?', 'rojo', { type: 'foreign_language' });
  T('Fine Arts', 'Spanish 1', 'Give the Spanish phrase, including its article, for "the book."', 'el libro', { type: 'foreign_language' });
  T('Fine Arts', 'French 1', 'What is the French word for "thank you"?', 'merci', { type: 'foreign_language' });
  T('Fine Arts', 'French 1', 'Give the French phrase, including its article, for "the cat."', 'le chat', { type: 'foreign_language' });
  // Math
  T('Math', 'Arithmetic', 'What is 15 percent of 200?', '30', { type: 'math' });
  T('Math', 'Arithmetic', 'What is the least common multiple of 4 and 6?', '12', { type: 'math' });
  T('Math', 'Arithmetic', 'Express the decimal 0.25 as a fraction in lowest terms.', '1/4', { type: 'math' });
  T('Math', 'Arithmetic', 'What is the greatest common factor of 18 and 24?', '6', { type: 'math' });
  T('Math', 'Algebra 1', 'Solve for x: x plus 7 equals 19.', '12', { type: 'math', alt: ['x=12', 'x = 12'] });
  T('Math', 'Algebra 1', 'What is the slope of the line y equals 3x plus 2?', '3', { type: 'math' });
  T('Math', 'Algebra 1', 'Solve for x: 4x equals 36.', '9', { type: 'math', alt: ['x=9', 'x = 9'] });
  T('Math', 'Geometry', 'How many sides does a hexagon have?', '6', { type: 'math' });
  T('Math', 'Geometry', 'What is the area of a rectangle with length 8 and width 5?', '40', { type: 'math' });
  T('Math', 'Geometry', 'What is the perimeter of a square whose sides each have length 7?', '28', { type: 'math' });
  // Science
  T('Science', 'Astronomy', 'What is the name of the galaxy that contains our Solar System?', 'Milky Way', { alt: ['the Milky Way galaxy', 'Milky Way galaxy'] });
  T('Science', 'Astronomy', 'What is the name of Earth\'s only natural satellite?', 'the Moon', { alt: ['Moon', 'Luna'] });
  T('Science', 'Astronomy', 'Which planet is farthest from the Sun?', 'Neptune');
  T('Science', 'Earth Science', 'What type of rock forms when magma or lava cools and hardens?', 'igneous rock', { alt: ['igneous'] });
  T('Science', 'Earth Science', 'What scale, ranging from 1 to 10, is used to measure the hardness of minerals?', 'Mohs scale', { alt: ['Mohs', 'Mohs hardness scale'] });
  T('Science', 'Life Science', 'What process do plants use to make food from sunlight, water, and carbon dioxide?', 'photosynthesis');
  T('Science', 'Life Science', 'What is the basic unit of life?', 'cell', { alt: ['the cell'] });
  T('Science', 'Physical Science', 'What force pulls objects toward the center of the Earth?', 'gravity');
  T('Science', 'Physical Science', 'What is the chemical formula for water?', 'H2O');
  // Social Science
  T('Social Science', 'General', 'What do we call the trading of goods or services without using money?', 'barter');
  T('Social Science', 'U.S. Geography', 'Austin is the capital of which U.S. state?', 'Texas');
  T('Social Science', 'U.S. Geography', 'Which is the largest U.S. state by area?', 'Alaska');
  T('Social Science', 'U.S. Geography', 'Which ocean lies off the east coast of the United States?', 'Atlantic Ocean', { alt: ['Atlantic'] });
  T('Social Science', 'World Cultures', 'What Hindu festival of lights is celebrated in autumn?', 'Diwali', { alt: ['Deepavali'] });

  // ---------------------------------------------------------------- bonuses
  B('English', 'Greek and Roman Mythology', 'Answer these questions about the Roman names of Greek gods.', [
    ['easy', 'What is the Roman name for Zeus?', 'Jupiter', { type: 'name', alt: ['Jove'] }],
    ['easy', 'What is the Roman name for Hera?', 'Juno', { type: 'name' }],
    ['medium', 'What is the Roman name for Aphrodite?', 'Venus', { type: 'name' }],
    ['hard', 'What is the Roman name for Poseidon?', 'Neptune', { type: 'name' }],
  ]);
  B('English', 'English Grammar', 'Answer these questions about punctuation.', [
    ['easy', 'What punctuation mark ends a question?', 'question mark'],
    ['easy', 'What punctuation mark separates items in a list?', 'comma'],
    ['medium', 'What punctuation mark shows possession, as in "Maria\'s book"?', 'apostrophe'],
    ['hard', 'What punctuation marks surround the exact words a person says?', 'quotation marks', { alt: ['quotes', 'quotation mark'] }],
  ]);
  B('Math', 'Arithmetic', 'Answer these questions about fractions.', [
    ['easy', 'Simplify the fraction six-eighths.', '3/4', { type: 'math' }],
    ['medium', 'What is one-half plus one-third? Give a fraction.', '5/6', { type: 'math' }],
    ['hard', 'Express three-fifths as a percent.', '60', { type: 'math', alt: ['60%'] }],
  ]);
  B('Math', 'Geometry', 'Answer these questions about polygons.', [
    ['easy', 'How many sides does a pentagon have?', '5', { type: 'math' }],
    ['easy', 'How many sides does an octagon have?', '8', { type: 'math' }],
    ['medium', 'What is the sum of the interior angles of a quadrilateral, in degrees?', '360', { type: 'math' }],
    ['hard', 'What kind of triangle has exactly two equal sides?', 'isosceles triangle', { alt: ['isosceles'] }],
  ]);
  B('Science', 'Astronomy', 'Answer these questions about space.', [
    ['easy', 'Which star is at the center of our Solar System?', 'the Sun', { alt: ['Sun'] }],
    ['medium', 'What is the path a planet takes around the Sun called?', 'orbit', { alt: ['an orbit'] }],
    ['hard', 'What name is given to a huge collection of stars, gas, and dust held together by gravity?', 'galaxy'],
  ]);
  B('Science', 'Earth Science', 'Answer these questions about the three types of rock.', [
    ['easy', 'Which type of rock forms from cooled magma?', 'igneous'],
    ['medium', 'Limestone is an example of which type of rock, formed from compressed sediment?', 'sedimentary'],
    ['hard', 'Marble forms when limestone is changed by heat and pressure. What type of rock is marble?', 'metamorphic'],
  ]);
  B('Science', 'Life Science', 'Answer these questions about the human body.', [
    ['easy', 'Which organ pumps blood through the body?', 'heart'],
    ['easy', 'Which organs do we use to breathe?', 'lungs', { alt: ['lung'] }],
    ['medium', 'What is the largest organ of the human body?', 'skin'],
    ['hard', 'How many bones are in the adult human body?', '206', { type: 'math' }],
  ]);
  B('Social Science', 'U.S. Geography', 'Answer these questions about U.S. geography.', [
    ['easy', 'Which river forms much of the border between Texas and Mexico?', 'Rio Grande', { alt: ['the Rio Grande', 'Rio Grande River'] }],
    ['medium', 'Which mountain range runs along much of the eastern United States?', 'Appalachian Mountains', { alt: ['Appalachians', 'Appalachian'] }],
    ['hard', 'Which is the only Great Lake located entirely within the United States?', 'Lake Michigan', { alt: ['Michigan'] }],
  ]);
  B('Social Science', 'World Cultures', 'Answer these questions about world celebrations.', [
    ['easy', 'In which country is the Day of the Dead widely celebrated?', 'Mexico'],
    ['medium', 'Ramadan is a holy month observed by followers of which religion?', 'Islam'],
    ['hard', 'Which holiday, also called the Spring Festival, marks the start of the lunar year in China?', 'Chinese New Year', { alt: ['Lunar New Year', 'Spring Festival'] }],
  ]);
  B('Fine Arts', 'Spanish 1', 'Answer these questions about Spanish words.', [
    ['easy', 'What is the Spanish word for the color "blue"?', 'azul', { type: 'foreign_language' }],
    ['easy', 'What is the Spanish word for the color "green"?', 'verde', { type: 'foreign_language' }],
    ['medium', 'What is the Spanish word for the number "one"?', 'uno', { type: 'foreign_language' }],
    ['hard', 'What does the Spanish word "perro" mean in English?', 'dog'],
  ]);
  B('Fine Arts', 'French 1', 'Answer these questions about French words.', [
    ['easy', 'What is the French word for "hello" or "good day"?', 'bonjour', { type: 'foreign_language' }],
    ['easy', 'What is the French word for "yes"?', 'oui', { type: 'foreign_language' }],
    ['medium', 'What does the French word "chien" mean in English?', 'dog'],
    ['hard', 'What does the French word "pomme" mean in English?', 'apple'],
  ]);
  B('English', 'Literary Terms', 'Answer these questions about fables.', [
    ['easy', 'Which ancient Greek storyteller is credited with fables such as "The Boy Who Cried Wolf"?', 'Aesop', { type: 'name' }],
    ['medium', 'In his fable about a race, which animal takes a nap along the way?', 'the hare', { alt: ['hare', 'rabbit', 'the rabbit'] }],
    ['hard', 'What term names the lesson that a fable teaches?', 'moral'],
  ]);
}
