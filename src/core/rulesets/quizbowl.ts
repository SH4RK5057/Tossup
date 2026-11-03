import type { Ruleset } from './types';

const names = (list: string[]) => list.map((name) => ({ name }));

export const quizbowl: Ruleset = {
  id: 'quizbowl',
  name: 'Quizbowl',
  shortName: 'Quizbowl',
  tossupValue: 10,
  // No negs: without a buzzer there is no interrupt.
  wrongTossupPoints: 0,
  tossupSeconds: 10,
  bonus: { minParts: 3, maxParts: 3, timing: 'sequential', defaultSeconds: 10, pointsPerPart: 10 },
  match: { kind: 'count', tossups: 20 },
  currentEvents: null,
  currentEventsReferenceLength: 20,
  checker: 'lenient',
  lowerLevelShare: null,
  // Approximates a standard 20-tossup distribution.
  distribution: {
    Literature: 4, History: 4, Science: 4, 'Fine Arts': 2, Religion: 1, Mythology: 1,
    Philosophy: 1, 'Social Science': 1, Geography: 1, 'Other Academic': 1,
  },
  subjects: [
    { name: 'Literature', subjects: names(['American Literature', 'British Literature', 'European Literature', 'World Literature', 'Other Literature']) },
    { name: 'History', subjects: names(['American History', 'European History', 'Ancient History', 'World History', 'Other History']) },
    { name: 'Science', subjects: names(['Biology', 'Chemistry', 'Physics', 'Earth Science', 'Astronomy', 'Math', 'Computer Science', 'Other Science']) },
    { name: 'Fine Arts', subjects: names(['Visual Arts', 'Auditory Arts', 'Audiovisual Arts', 'Architecture', 'Other Fine Arts']) },
    { name: 'Religion', subjects: names(['Christianity', 'Judaism', 'Islam', 'Eastern Religions', 'Other Religion']) },
    { name: 'Mythology', subjects: names(['Greco-Roman Mythology', 'Norse Mythology', 'World Mythology']) },
    { name: 'Philosophy', subjects: names(['Ancient Philosophy', 'Modern Philosophy', 'Other Philosophy']) },
    { name: 'Social Science', subjects: names(['Economics', 'Psychology', 'Sociology', 'Political Science', 'Anthropology', 'Linguistics']) },
    { name: 'Geography', subjects: names(['American Geography', 'World Geography']) },
    { name: 'Current Events', subjects: names(['Current Events']) },
    { name: 'Other Academic', subjects: names(['General Knowledge', 'Other Academic']) },
  ],
};
