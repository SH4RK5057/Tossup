export default function ({ T, B }) {
  // American Literature
  T('English', 'American Literature', 'Which author wrote the novel "The Scarlet Letter"?', 'Nathaniel Hawthorne', { type: 'name', req: 'Hawthorne' });
  T('English', 'American Literature', 'Which American author wrote the poem "The Raven"?', 'Edgar Allan Poe', { type: 'name', req: 'Poe' });
  T('English', 'American Literature', 'Which author wrote the novel "The Catcher in the Rye"?', 'J. D. Salinger', { type: 'name', req: 'Salinger' });
  T('English', 'American Literature', 'In "The Great Gatsby," what is the name of the narrator who lives next door to Gatsby?', 'Nick Carraway', { type: 'name', req: 'Carraway', partial: true });
  T('English', 'American Literature', 'Which author wrote the novel "Moby-Dick"?', 'Herman Melville', { type: 'name', req: 'Melville' });
  T('English', 'American Literature', 'Which American poet wrote "The Road Not Taken"?', 'Robert Frost', { type: 'name', req: 'Frost' });
  T('English', 'American Literature', 'In "To Kill a Mockingbird," what is the name of the lawyer who is the father of Scout and Jem?', 'Atticus Finch', { type: 'name', req: 'Finch', partial: true });
  // Mythology 2
  T('English', 'Mythology 2', 'Which Norse god wields the hammer Mjolnir?', 'Thor', { type: 'name' });
  T('English', 'Mythology 2', 'What is the name of the enormous tree that connects the nine worlds in Norse mythology?', 'Yggdrasil');
  T('English', 'Mythology 2', 'Which Greek hero was dipped in the River Styx as a baby, leaving only his heel vulnerable?', 'Achilles', { type: 'name' });
  T('English', 'Mythology 2', 'Which Gorgon, with snakes for hair, turned those who looked at her to stone?', 'Medusa', { type: 'name' });
  T('English', 'Mythology 2', 'Which Greek goddess of the harvest was the mother of Persephone?', 'Demeter', { type: 'name' });
  T('English', 'Mythology 2', 'Which jackal-headed Egyptian god guided the dead to the afterlife?', 'Anubis', { type: 'name' });
  // Art History
  T('Fine Arts', 'Art History', 'Which Dutch painter created "Girl with a Pearl Earring"?', 'Johannes Vermeer', { type: 'name', req: 'Vermeer' });
  T('Fine Arts', 'Art History', 'Which Spanish artist painted "Guernica"?', 'Pablo Picasso', { type: 'name', req: 'Picasso' });
  T('Fine Arts', 'Art History', 'Which Renaissance artist painted the ceiling of the Sistine Chapel?', 'Michelangelo', { type: 'name', alt: ['Michelangelo Buonarroti'] });
  T('Fine Arts', 'Art History', 'Which French Impressionist painted a series called "Water Lilies"?', 'Claude Monet', { type: 'name', req: 'Monet' });
  T('Fine Arts', 'Art History', 'Which Italian Renaissance artist painted "The Birth of Venus"?', 'Sandro Botticelli', { type: 'name', req: 'Botticelli' });
  T('Fine Arts', 'Art History', 'Which art movement takes its name from Monet\'s painting "Impression, Sunrise"?', 'Impressionism', { alt: ['Impressionist'] });
  T('Fine Arts', 'Spanish 2', 'What is the Spanish verb meaning "to eat"?', 'comer', { type: 'foreign_language' });
  T('Fine Arts', 'Spanish 2', 'What is the Spanish word for "tomorrow"?', 'mañana', { type: 'foreign_language' });
  T('Fine Arts', 'Spanish 2', 'Give the Spanish phrase, including its article, for "the street."', 'la calle', { type: 'foreign_language' });
  T('Fine Arts', 'French 2', 'What is the French verb meaning "to have"?', 'avoir', { type: 'foreign_language' });
  T('Fine Arts', 'French 2', 'What is the French word for "tomorrow"?', 'demain', { type: 'foreign_language' });
  T('Fine Arts', 'French 2', 'Give the French phrase, including its article, for "the school."', "l'école", { type: 'foreign_language' });
  // Math
  T('Math', 'Algebra 2', 'What is the sum of the roots of the equation x squared minus 5x plus 6 equals 0?', '5', { type: 'math' });
  T('Math', 'Algebra 2', 'What is 3 raised to the fourth power?', '81', { type: 'math' });
  T('Math', 'Algebra 2', 'What is the product of x plus 2 and x minus 2?', 'x^2-4', { type: 'math', alt: ['x²-4', 'x^2 - 4'] });
  T('Math', 'Algebra 2', 'What is the x-coordinate of the vertex of the parabola y equals x squared minus 6x plus 5?', '3', { type: 'math' });
  T('Math', 'Algebra 2', 'What is the absolute value of negative 17?', '17', { type: 'math' });
  T('Math', 'Trigonometry', 'What is the exact value of the cosine of 60 degrees?', '1/2', { type: 'math', alt: ['0.5'] });
  T('Math', 'Trigonometry', 'What is the tangent of 45 degrees?', '1', { type: 'math' });
  T('Math', 'Trigonometry', 'In a right triangle, the sine of an angle equals the opposite side divided by which side?', 'hypotenuse');
  T('Math', 'Trigonometry', 'How many radians are in 180 degrees? Answer in terms of pi.', 'pi', { type: 'math', alt: ['π'] });
  // Science
  T('Science', 'Chemistry', 'What is the chemical symbol for potassium?', 'K');
  T('Science', 'Chemistry', 'What is the pH of a neutral solution at room temperature?', '7', { type: 'math' });
  T('Science', 'Chemistry', 'What type of chemical bond forms when two atoms share electrons?', 'covalent bond', { alt: ['covalent'] });
  T('Science', 'Chemistry', 'Which element has the atomic number 1?', 'hydrogen');
  T('Science', 'Chemistry', 'What is the most abundant gas in Earth\'s atmosphere?', 'nitrogen');
  T('Science', 'Biology 1', 'What molecule carries genetic information in cells and has the shape of a double helix?', 'DNA', { alt: ['deoxyribonucleic acid'] });
  T('Science', 'Biology 1', 'What is the process of cell division that produces two identical daughter cells?', 'mitosis');
  T('Science', 'Biology 1', 'Which blood cells carry oxygen to the body\'s tissues?', 'red blood cells', { alt: ['red blood cell', 'erythrocytes', 'erythrocyte'] });
  T('Science', 'Biology 1', 'Which monk, known as the father of genetics, experimented with pea plants?', 'Gregor Mendel', { type: 'name', req: 'Mendel' });
  T('Science', 'Biology 1', 'What green pigment in plants absorbs light for photosynthesis?', 'chlorophyll');
  // Social Science
  T('Social Science', 'U.S. History', 'Which president delivered the Gettysburg Address?', 'Abraham Lincoln', { type: 'name', req: 'Lincoln' });
  T('Social Science', 'U.S. History', 'Which 1803 purchase from France roughly doubled the size of the United States?', 'Louisiana Purchase', { alt: ['the Louisiana Purchase'] });
  T('Social Science', 'U.S. History', 'Which amendment to the U.S. Constitution abolished slavery?', 'Thirteenth Amendment', { alt: ['13th Amendment'] });
  T('Social Science', 'U.S. History', 'Which war ended with the 1865 surrender of Robert E. Lee at Appomattox Court House?', 'Civil War', { alt: ['American Civil War', 'the Civil War'] });
  T('Social Science', 'U.S. History', 'Which president was the first to live in the White House?', 'John Adams', { type: 'name', req: 'Adams', dup: true, prompt: ['Adams'] });
  T('Social Science', 'U.S. History', 'What was the name of the ship that carried the Pilgrims to Plymouth in 1620?', 'Mayflower', { alt: ['the Mayflower'] });
  T('Social Science', 'World Geography', 'Which hot desert in northern Africa is the largest in the world?', 'Sahara Desert', { alt: ['Sahara', 'the Sahara'] });
  T('Social Science', 'World Geography', 'Which river flows through the city of Paris?', 'Seine River', { alt: ['Seine', 'the Seine'] });
  T('Social Science', 'World Geography', 'What is the capital city of Canada?', 'Ottawa');
  T('Social Science', 'World Geography', 'Which mountain has the highest peak above sea level in the world?', 'Mount Everest', { alt: ['Everest'] });
  T('Social Science', 'World Geography', 'Which strait separates Spain from Morocco at the entrance to the Mediterranean Sea?', 'Strait of Gibraltar', { alt: ['Gibraltar', 'Straits of Gibraltar'] });
  T('Social Science', 'World History', 'Which ancient civilization built the pyramids at Giza?', 'ancient Egypt', { alt: ['Egypt', 'Egyptians', 'ancient Egyptians'] });
  T('Social Science', 'World History', 'Which Chinese structure was built over centuries to protect against invasions from the north?', 'Great Wall of China', { alt: ['Great Wall', 'the Great Wall'] });
  T('Social Science', 'World History', 'Which 1066 battle did William the Conqueror win to take the English throne?', 'Battle of Hastings', { alt: ['Hastings'] });
  T('Social Science', 'World History', 'Which empire, with its capital at Constantinople, continued the eastern half of the Roman Empire?', 'Byzantine Empire', { alt: ['Byzantine', 'Byzantines'] });
  T('Social Science', 'World History', 'In what year did World War I begin?', '1914', { type: 'math' });

  // ---------------------------------------------------------------- bonuses
  B('English', 'American Literature', 'Answer these questions about American authors.', [
    ['easy', 'Who wrote "The Tell-Tale Heart"?', 'Edgar Allan Poe', { type: 'name', req: 'Poe' }],
    ['easy', 'Who wrote "The Adventures of Huckleberry Finn"?', 'Mark Twain', { type: 'name', req: 'Twain', alt: ['Samuel Clemens'] }],
    ['medium', 'Who wrote "The Call of the Wild"?', 'Jack London', { type: 'name', req: 'London' }],
    ['hard', 'Who wrote "Little Women"?', 'Louisa May Alcott', { type: 'name', req: 'Alcott' }],
  ]);
  B('English', 'Mythology 2', 'Answer these questions about Norse mythology.', [
    ['easy', 'Which thunder god carries the hammer Mjolnir?', 'Thor', { type: 'name' }],
    ['medium', 'What is the name of the realm where the Norse gods live?', 'Asgard'],
    ['medium', 'Which trickster god is the blood brother of Odin?', 'Loki', { type: 'name' }],
    ['hard', 'What is the name of the final battle that destroys the world in Norse myth?', 'Ragnarok', { alt: ['Ragnarök'] }],
  ]);
  B('Fine Arts', 'Art History', 'Answer these questions about the Italian Renaissance.', [
    ['easy', 'Who painted "The Last Supper"?', 'Leonardo da Vinci', { type: 'name', alt: ['da Vinci', 'Leonardo'], partial: true }],
    ['medium', 'Who sculpted the marble statue of "David" that is displayed in the Accademia?', 'Michelangelo', { type: 'name' }],
    ['medium', 'Who painted the fresco "The School of Athens"?', 'Raphael', { type: 'name', alt: ['Raffaello Sanzio'] }],
    ['hard', 'Which Italian city is considered the birthplace of the Renaissance?', 'Florence', { alt: ['Firenze'] }],
  ]);
  B('Math', 'Algebra 2', 'Answer these questions about exponents and logarithms.', [
    ['easy', 'What is the base-10 logarithm of 1000?', '3', { type: 'math' }],
    ['medium', 'What is 2 raised to the negative third power?', '1/8', { type: 'math' }],
    ['hard', 'What is the square root of 3 times the square root of 12?', '6', { type: 'math' }],
  ]);
  B('Math', 'Trigonometry', 'Answer these questions about trigonometric values.', [
    ['easy', 'What is the sine of 90 degrees?', '1', { type: 'math' }],
    ['medium', 'What is the cosine of 180 degrees?', '-1', { type: 'math' }],
    ['hard', 'What is the sine of 0 degrees?', '0', { type: 'math' }],
  ]);
  B('Science', 'Chemistry', 'Answer these questions about element symbols.', [
    ['easy', 'Which element has the symbol Pb?', 'lead'],
    ['medium', 'Which element has the symbol Ag?', 'silver'],
    ['hard', 'Which element has the symbol Hg?', 'mercury'],
    ['hard', 'Which element has the symbol W?', 'tungsten', { alt: ['wolfram'] }],
  ]);
  B('Science', 'Biology 1', 'Answer these questions about cells.', [
    ['easy', 'Which organelle contains a cell\'s DNA in eukaryotes?', 'nucleus', { alt: ['the nucleus'] }],
    ['medium', 'Which organelle is the site of protein synthesis?', 'ribosome', { alt: ['ribosomes'] }],
    ['medium', 'Which organelle in plant cells contains chlorophyll?', 'chloroplast', { alt: ['chloroplasts'] }],
    ['hard', 'What carbohydrate makes up the cell walls of plants?', 'cellulose'],
  ]);
  B('Social Science', 'U.S. History', 'Answer these questions about the U.S. Constitution.', [
    ['easy', 'What name is given to the first ten amendments to the Constitution?', 'Bill of Rights', { alt: ['the Bill of Rights'] }],
    ['medium', 'Which amendment protects freedom of speech, religion, and the press?', 'First Amendment', { alt: ['1st Amendment'] }],
    ['hard', 'Which man is known as the "Father of the Constitution"?', 'James Madison', { type: 'name', req: 'Madison' }],
  ]);
  B('Social Science', 'U.S. History', 'Answer these questions about the civil rights movement.', [
    ['easy', 'Who refused to give up her bus seat in Montgomery, Alabama, in 1955?', 'Rosa Parks', { type: 'name', req: 'Parks' }],
    ['medium', 'Who delivered the "I Have a Dream" speech in 1963?', 'Martin Luther King Jr.', { type: 'name', req: 'King' }],
    ['hard', 'Which 1954 Supreme Court case ruled that segregated public schools were unconstitutional?', 'Brown v. Board of Education', { alt: ['Brown v Board of Education', 'Brown vs Board of Education', 'Brown versus Board of Education', 'Brown v. Board'] }],
  ]);
  B('Social Science', 'World Geography', 'Answer these questions about rivers.', [
    ['easy', 'Which river flows through London?', 'Thames River', { alt: ['Thames', 'the Thames'] }],
    ['medium', 'Which river is the largest in South America by volume?', 'Amazon River', { alt: ['Amazon', 'the Amazon'] }],
    ['hard', 'Which river, along with the Euphrates, bounds ancient Mesopotamia and flows through Baghdad?', 'Tigris River', { alt: ['Tigris', 'the Tigris'] }],
  ]);
  B('Social Science', 'World History', 'Answer these questions about the Reformation and exploration.', [
    ['easy', 'Which Italian explorer sailed for Spain and reached the Americas in 1492?', 'Christopher Columbus', { type: 'name', req: 'Columbus' }],
    ['medium', 'Which German monk is said to have posted the 95 Theses in 1517?', 'Martin Luther', { type: 'name', req: 'Luther' }],
    ['hard', 'Which German printer introduced movable-type printing to Europe with his press?', 'Johannes Gutenberg', { type: 'name', req: 'Gutenberg' }],
  ]);
}
