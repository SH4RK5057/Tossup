export default function ({ T, B }) {
  // English Literature
  T('English', 'English Literature', 'Which English poet wrote the epic "Paradise Lost"?', 'John Milton', { type: 'name', req: 'Milton' });
  T('English', 'English Literature', 'Which author wrote the novel "Pride and Prejudice"?', 'Jane Austen', { type: 'name', req: 'Austen' });
  T('English', 'English Literature', 'Which Charles Dickens novel follows the orphan Pip and the eccentric Miss Havisham?', 'Great Expectations');
  T('English', 'English Literature', 'Which medieval English poet wrote "The Canterbury Tales"?', 'Geoffrey Chaucer', { type: 'name', req: 'Chaucer' });
  T('English', 'English Literature', 'Which Brontë sister wrote the novel "Wuthering Heights"? Give her full name.', 'Emily Brontë', { type: 'name', req: 'Bronte', dup: true, prompt: ['Bronte', 'Brontë'], alt: ['Emily Bronte'] });
  T('English', 'English Literature', 'In Shakespeare\'s "Macbeth," what group of characters makes prophecies to Macbeth on the heath?', 'the witches', { alt: ['witches', 'three witches', 'the three witches', 'weird sisters', 'the weird sisters'] });
  T('English', 'English Literature', 'Which Shakespearean tragedy features the villain Iago?', 'Othello');
  T('English', 'English Literature', 'Which author created the fictional detective Sherlock Holmes?', 'Arthur Conan Doyle', { type: 'name', req: 'Doyle', alt: ['Conan Doyle'] });
  // World Literature
  T('English', 'World Literature', 'Which Spanish author wrote "Don Quixote"?', 'Miguel de Cervantes', { type: 'name', req: 'Cervantes' });
  T('English', 'World Literature', 'Which Russian author wrote "War and Peace"?', 'Leo Tolstoy', { type: 'name', req: 'Tolstoy', alt: ['Lev Tolstoy'] });
  T('English', 'World Literature', 'Which French author wrote the novel "The Stranger"?', 'Albert Camus', { type: 'name', req: 'Camus' });
  T('English', 'World Literature', 'Which Nigerian author wrote the novel "Things Fall Apart"?', 'Chinua Achebe', { type: 'name', req: 'Achebe' });
  T('English', 'World Literature', 'Which Japanese court lady wrote "The Tale of Genji," often called the world\'s first novel?', 'Murasaki Shikibu', { alt: ['Murasaki', 'Lady Murasaki'] });
  T('English', 'World Literature', 'Which Italian poet wrote "The Divine Comedy"?', 'Dante Alighieri', { type: 'name', req: 'Dante', alt: ['Alighieri'], partial: true });
  // Fine Arts
  T('Fine Arts', 'Architecture', 'Which American architect designed Fallingwater, a house built over a waterfall in Pennsylvania?', 'Frank Lloyd Wright', { type: 'name', req: 'Wright' });
  T('Fine Arts', 'Architecture', 'Which ancient Greek temple dedicated to Athena stands on the Acropolis in Athens?', 'Parthenon', { alt: ['the Parthenon'] });
  T('Fine Arts', 'Architecture', 'Which iron tower in Paris was built for the 1889 World\'s Fair?', 'Eiffel Tower', { alt: ['Eiffel', 'the Eiffel Tower'] });
  T('Fine Arts', 'Architecture', 'Which Gothic cathedral on the Île de la Cité in Paris is known for its flying buttresses and gargoyles?', 'Notre-Dame', { alt: ['Notre Dame de Paris', 'Notre-Dame de Paris', 'Notre Dame'] });
  T('Fine Arts', 'Architecture', 'What architectural term names a curved structure that spans an opening, as in Roman aqueducts?', 'arch');
  T('Fine Arts', 'Operas and Musicals', 'Which French composer wrote the opera "Carmen"?', 'Georges Bizet', { type: 'name', req: 'Bizet' });
  T('Fine Arts', 'Operas and Musicals', 'Which composer wrote the opera "The Marriage of Figaro"?', 'Wolfgang Amadeus Mozart', { type: 'name', req: 'Mozart' });
  T('Fine Arts', 'Operas and Musicals', 'Which Italian composer wrote the opera "La bohème"?', 'Giacomo Puccini', { type: 'name', req: 'Puccini' });
  T('Fine Arts', 'Operas and Musicals', 'Which composer wrote the music for the musical "West Side Story"?', 'Leonard Bernstein', { type: 'name', req: 'Bernstein' });
  T('Fine Arts', 'Operas and Musicals', 'Which German composer wrote the four-opera cycle "The Ring of the Nibelung"?', 'Richard Wagner', { type: 'name', req: 'Wagner' });
  T('Fine Arts', 'Operas and Musicals', 'Which Lerner and Loewe musical is based on George Bernard Shaw\'s play "Pygmalion"?', 'My Fair Lady');
  T('Fine Arts', 'Spanish 3+', 'What is the Spanish word for "although"?', 'aunque', { type: 'foreign_language' });
  T('Fine Arts', 'Spanish 3+', 'What Spanish phrase means "nevertheless"?', 'sin embargo', { type: 'foreign_language' });
  T('Fine Arts', 'Spanish 3+', 'Give the Spanish phrase, including its article, for "the hand."', 'la mano', { type: 'foreign_language' });
  T('Fine Arts', 'French 3+', 'What is the French word for "always"?', 'toujours', { type: 'foreign_language' });
  T('Fine Arts', 'French 3+', 'Give the French phrase, including its article, for "the problem."', 'le problème', { type: 'foreign_language' });
  // Math
  T('Math', 'Pre-Calculus', 'What is the period of the function y equals sine of x, in radians? Answer in terms of pi.', '2pi', { type: 'math', alt: ['2π'] });
  T('Math', 'Pre-Calculus', 'What is the value of i squared, where i is the imaginary unit?', '-1', { type: 'math' });
  T('Math', 'Pre-Calculus', 'What is the sum of the first ten positive integers?', '55', { type: 'math' });
  T('Math', 'Pre-Calculus', 'What is the tenth term of the arithmetic sequence 3, 7, 11, and so on?', '39', { type: 'math' });
  T('Math', 'Pre-Calculus', 'How many different orderings are there of 5 distinct objects?', '120', { type: 'math' });
  T('Math', 'Calculus', 'What is the derivative of the sine of x with respect to x?', 'cos(x)', { type: 'math', alt: ['cos x', 'cosx'] });
  T('Math', 'Calculus', 'What is the antiderivative of 2x with respect to x, written with the constant of integration?', 'x^2+C', { type: 'math', alt: ['x²+C', 'x^2 + C', 'x^2+c'] });
  T('Math', 'Calculus', 'What is the derivative of e to the x with respect to x?', 'e^x', { type: 'math', alt: ['e**x'] });
  T('Math', 'Calculus', 'What is the limit of 1 over x as x approaches infinity?', '0', { type: 'math' });
  T('Math', 'Calculus', 'What is the derivative of x cubed with respect to x?', '3x^2', { type: 'math', alt: ['3x²', '3*x^2'] });
  // Science
  T('Science', 'Biology 2', 'What enzyme unwinds the DNA double helix during replication?', 'helicase', { alt: ['DNA helicase'] });
  T('Science', 'Biology 2', 'What molecule is the main energy currency of the cell?', 'ATP', { alt: ['adenosine triphosphate'] });
  T('Science', 'Biology 2', 'What type of cell division produces gametes with half the usual number of chromosomes?', 'meiosis');
  T('Science', 'Biology 2', 'Which scientist proposed the theory of natural selection in "On the Origin of Species"?', 'Charles Darwin', { type: 'name', req: 'Darwin' });
  T('Science', 'Biology 2', 'In DNA, which nitrogenous base pairs with guanine?', 'cytosine');
  T('Science', 'Physics', 'What is the SI unit of electric current?', 'ampere', { alt: ['amp', 'amperes', 'amps'] });
  T('Science', 'Physics', 'Which of Newton\'s laws states that every action has an equal and opposite reaction?', 'third law', { alt: ['Newton\'s third law', 'third law of motion', 'Newton\'s third law of motion'] });
  T('Science', 'Physics', 'What is the SI unit of energy?', 'joule', { alt: ['joules'] });
  T('Science', 'Physics', 'What term names the rate at which velocity changes?', 'acceleration');
  T('Science', 'Physics', 'What is the SI unit of electrical resistance?', 'ohm', { alt: ['ohms'] });
  // Social Science
  T('Social Science', 'U.S. Government', 'How many justices serve on the U.S. Supreme Court?', '9', { type: 'math' });
  T('Social Science', 'U.S. Government', 'Which article of the U.S. Constitution establishes the legislative branch?', 'Article 1', { alt: ['Article I', 'Article One'] });
  T('Social Science', 'U.S. Government', 'What term names the president\'s power to reject a bill passed by Congress?', 'veto');
  T('Social Science', 'U.S. Government', 'What is the minimum age required to serve as President of the United States?', '35', { type: 'math' });
  T('Social Science', 'U.S. Government', 'How many senators does each state elect to the U.S. Senate?', '2', { type: 'math' });
  T('Social Science', 'World Governments', 'What term names a government led by a monarch whose powers are limited by a constitution?', 'constitutional monarchy');
  T('Social Science', 'World Governments', 'What is the name of the lower house of the United Kingdom\'s Parliament?', 'House of Commons', { alt: ['Commons', 'the House of Commons'] });
  T('Social Science', 'World Governments', 'What term names rule by a small group of powerful people?', 'oligarchy');
  T('Social Science', 'World Governments', 'What title is given to the head of government of Germany?', 'chancellor', { alt: ['Federal Chancellor'] });
  T('Social Science', 'Economics', 'What term names the total value of all goods and services produced in a country in a year?', 'gross domestic product', { alt: ['GDP'] });
  T('Social Science', 'Economics', 'What term names a general rise in prices over time?', 'inflation');
  T('Social Science', 'Economics', 'Which British economist wrote "The General Theory of Employment, Interest and Money"?', 'John Maynard Keynes', { type: 'name', req: 'Keynes' });
  T('Social Science', 'Economics', 'According to the law of demand, when the price of a good rises, what happens to the quantity demanded?', 'it falls', { alt: ['falls', 'decreases', 'goes down', 'declines', 'it decreases', 'it goes down', 'it declines'] });
  T('Social Science', 'Economics', 'What term names a market with only one seller?', 'monopoly');

  // ---------------------------------------------------------------- bonuses
  B('English', 'English Literature', 'Answer these questions about Shakespearean tragedies.', [
    ['easy', 'Which play centers on the Prince of Denmark who sees his father\'s ghost?', 'Hamlet'],
    ['medium', 'Which play features an aging king who divides his kingdom among his three daughters?', 'King Lear', { alt: ['Lear'] }],
    ['hard', 'In which play does the ghost of Banquo appear at a banquet?', 'Macbeth'],
  ]);
  B('English', 'World Literature', 'Answer these questions about Russian literature.', [
    ['easy', 'Who wrote "Anna Karenina"?', 'Leo Tolstoy', { type: 'name', req: 'Tolstoy', alt: ['Lev Tolstoy'] }],
    ['medium', 'Who wrote the play "The Cherry Orchard"?', 'Anton Chekhov', { type: 'name', req: 'Chekhov', alt: ['Anton Chekov'] }],
    ['medium', 'Who wrote the novel "Doctor Zhivago"?', 'Boris Pasternak', { type: 'name', req: 'Pasternak' }],
    ['hard', 'Who wrote the satirical novel "Dead Souls"?', 'Nikolai Gogol', { type: 'name', req: 'Gogol' }],
  ]);
  B('Fine Arts', 'Architecture', 'Answer these questions about Greek column styles.', [
    ['easy', 'Which is the simplest of the three Greek orders, with plain, sturdy capitals?', 'Doric'],
    ['medium', 'Which order is recognized by the scroll-like volutes on its capitals?', 'Ionic'],
    ['hard', 'Which is the most ornate Greek order, with capitals decorated with acanthus leaves?', 'Corinthian'],
  ]);
  B('Fine Arts', 'Operas and Musicals', 'Answer these questions about the people behind musicals.', [
    ['easy', 'Which British composer wrote "The Phantom of the Opera"?', 'Andrew Lloyd Webber', { type: 'name', req: 'Webber', alt: ['Lloyd Webber'] }],
    ['medium', 'Which composer teamed with Oscar Hammerstein II on "Oklahoma!"?', 'Richard Rodgers', { type: 'name', req: 'Rodgers' }],
    ['hard', 'Which composer and lyricist wrote the lyrics for "West Side Story" and the music for "Sweeney Todd"?', 'Stephen Sondheim', { type: 'name', req: 'Sondheim' }],
  ]);
  B('Math', 'Pre-Calculus', 'Answer these questions about logarithms.', [
    ['easy', 'What is the base-2 logarithm of 64?', '6', { type: 'math' }],
    ['medium', 'What is the natural logarithm of e?', '1', { type: 'math' }],
    ['hard', 'What is the base-5 logarithm of one-fifth?', '-1', { type: 'math' }],
  ]);
  B('Math', 'Calculus', 'Answer these questions about derivatives.', [
    ['easy', 'What is the derivative of x to the fourth power?', '4x^3', { type: 'math', alt: ['4x³', '4*x^3'] }],
    ['medium', 'What is the derivative of the natural logarithm of x?', '1/x', { type: 'math' }],
    ['hard', 'What is the derivative of the cosine of x?', '-sin(x)', { type: 'math', alt: ['-sin x', '-sinx'] }],
  ]);
  B('Science', 'Biology 2', 'Answer these questions about genetics.', [
    ['easy', 'What name is given to the different versions of a gene?', 'alleles', { alt: ['allele'] }],
    ['medium', 'What term describes an individual whose two copies of a gene differ?', 'heterozygous', { alt: ['heterozygote'] }],
    ['hard', 'In a cross of two hybrid parents (Aa times Aa), what fraction of offspring show the recessive trait?', '1/4', { type: 'math' }],
  ]);
  B('Science', 'Physics', 'Answer these questions about Newton\'s laws.', [
    ['easy', 'Which of Newton\'s laws is also called the law of inertia?', 'first law', { alt: ['Newton\'s first law', 'first law of motion', 'Newton\'s first law of motion'] }],
    ['medium', 'Which of Newton\'s laws is expressed by the equation F equals m a?', 'second law', { alt: ['Newton\'s second law', 'second law of motion', 'Newton\'s second law of motion'] }],
    ['hard', 'What is the SI unit of force?', 'newton', { alt: ['newtons'] }],
  ]);
  B('Social Science', 'U.S. Government', 'Answer these questions about the federal government.', [
    ['easy', 'Which branch of government enforces the laws?', 'executive branch', { alt: ['executive'] }],
    ['medium', 'Which branch of government interprets the laws?', 'judicial branch', { alt: ['judicial', 'judiciary'] }],
    ['hard', 'Which chamber of Congress has 435 voting members?', 'House of Representatives', { alt: ['the House', 'House'] }],
  ]);
  B('Social Science', 'Economics', 'Answer these questions about economic concepts.', [
    ['easy', 'What term names the price at which the quantity supplied equals the quantity demanded?', 'equilibrium price', { alt: ['equilibrium', 'market equilibrium'] }],
    ['medium', 'What term names the value of the next best alternative that is given up when making a choice?', 'opportunity cost'],
    ['hard', 'What kind of tax takes a larger percentage of income from people with higher incomes?', 'progressive tax', { alt: ['progressive'] }],
  ]);
  B('Fine Arts', 'Spanish 3+', 'Answer these questions about Spanish connecting words.', [
    ['easy', 'What is the Spanish word for "but"?', 'pero', { type: 'foreign_language' }],
    ['easy', 'What is the Spanish word for "because"?', 'porque', { type: 'foreign_language' }],
    ['medium', 'What is the Spanish word for "then" or "so"?', 'entonces', { type: 'foreign_language' }],
    ['hard', 'What is the Spanish word for "always"?', 'siempre', { type: 'foreign_language' }],
  ]);
  B('Fine Arts', 'French 3+', 'Answer these questions about French adverbs.', [
    ['easy', 'What is the French word for "never"?', 'jamais', { type: 'foreign_language' }],
    ['medium', 'What is the French word for "often"?', 'souvent', { type: 'foreign_language' }],
    ['hard', 'What is the French word for "sometimes"?', 'parfois', { type: 'foreign_language', alt: ['quelquefois'] }],
  ]);
}
