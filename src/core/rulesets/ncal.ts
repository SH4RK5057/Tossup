import type { Ruleset } from './types';

// Source for the subject tree: NCAL Addendum 1 – Question Subjects.
// Level assignments below follow the addendum's listing order (roughly novice -> varsity).
// TODO(rulebook): confirm the level of every subject against the addendum's columns.
export const ncal: Ruleset = {
  id: 'ncal',
  name: 'North County Academic League',
  shortName: 'NCAL',
  tossupValue: 3,
  wrongTossupPoints: -1,
  // TODO(rulebook): confirm the tossup answer time.
  tossupSeconds: 10,
  bonus: {
    minParts: 3,
    maxParts: 5,
    timing: 'together',
    defaultSeconds: 20,
    // TODO(rulebook): bonus may be worth 5 points total rather than 5 per correct part.
    pointsPerPart: 5,
  },
  // TODO(rulebook): the game clock minutes per level are placeholders.
  match: { kind: 'clock', minutes: { novice: 15, jv: 15, varsity: 15 }, maxTossups: 40 },
  currentEvents: { novice: 3, jv: 3, varsity: 4 },
  // TODO(rulebook): number of tossups in a real match, used to scale current events for short sessions.
  currentEventsReferenceLength: 20,
  checker: 'strict',
  // TODO(rulebook): placeholder 25% of JV/varsity questions come from lower-level subjects.
  lowerLevelShare: 0.25,
  // TODO(rulebook): the real subject distribution per level; equal weights are a placeholder.
  distribution: { English: 1, 'Fine Arts': 1, Math: 1, Science: 1, 'Social Science': 1 },
  subjects: [
    {
      name: 'English',
      subjects: [
        { name: 'English Grammar', level: 'novice' },
        { name: 'English Vocabulary', level: 'novice' },
        { name: 'Literary Terms', level: 'novice' },
        { name: 'Freshman Literature', level: 'novice' },
        { name: 'Greek and Roman Mythology', level: 'novice' },
        { name: 'American Literature', level: 'jv' },
        { name: 'Mythology 2', level: 'jv' },
        { name: 'English Literature', level: 'varsity' },
        { name: 'World Literature', level: 'varsity' },
      ],
    },
    {
      name: 'Fine Arts',
      subjects: [
        { name: 'Art Terms', level: 'novice' },
        { name: 'Music Theory and Terms', level: 'novice' },
        { name: 'Composers and Works', level: 'novice' },
        { name: 'Spanish 1', level: 'novice' },
        { name: 'French 1', level: 'novice' },
        { name: 'Art History', level: 'jv' },
        { name: 'Spanish 2', level: 'jv' },
        { name: 'French 2', level: 'jv' },
        { name: 'Architecture', level: 'varsity' },
        { name: 'Operas and Musicals', level: 'varsity' },
        { name: 'Spanish 3+', level: 'varsity' },
        { name: 'French 3+', level: 'varsity' },
      ],
    },
    {
      name: 'Math',
      subjects: [
        { name: 'Arithmetic', level: 'novice' },
        { name: 'Algebra 1', level: 'novice' },
        { name: 'Geometry', level: 'novice' },
        { name: 'Algebra 2', level: 'jv' },
        { name: 'Trigonometry', level: 'jv' },
        { name: 'Pre-Calculus', level: 'varsity' },
        { name: 'Calculus', level: 'varsity' },
      ],
    },
    {
      name: 'Science',
      subjects: [
        { name: 'Astronomy', level: 'novice' },
        { name: 'Earth Science', level: 'novice' },
        { name: 'Life Science', level: 'novice' },
        { name: 'Physical Science', level: 'novice' },
        { name: 'Biology 1', level: 'jv' },
        { name: 'Chemistry', level: 'jv' },
        { name: 'Biology 2', level: 'varsity' },
        { name: 'Physics', level: 'varsity' },
      ],
    },
    {
      name: 'Social Science',
      subjects: [
        { name: 'General', level: 'novice' },
        { name: 'U.S. Geography', level: 'novice' },
        { name: 'World Cultures', level: 'novice' },
        { name: 'World Geography', level: 'jv' },
        { name: 'U.S. History', level: 'jv' },
        { name: 'World History', level: 'jv' },
        { name: 'U.S. Government', level: 'varsity' },
        { name: 'World Governments', level: 'varsity' },
        { name: 'Economics', level: 'varsity' },
      ],
    },
    { name: 'Current Events', subjects: [{ name: 'Current Events' }] },
  ],
};
