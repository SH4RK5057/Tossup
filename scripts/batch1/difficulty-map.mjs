// Tossup indices (within each ruleset-level set, in file order) that are easy or hard; the rest are medium.
export default {
  'ncal-novice': {
    easy: [1, 2, 4, 5, 9, 10, 20, 23, 24, 25, 26, 27, 32, 41, 45, 50, 51, 52, 55, 56],
    hard: [8, 12, 14, 22, 31, 33, 36, 37, 48, 53, 57],
    bonusEasy: [1, 3, 4, 6, 10], bonusHard: [0, 2, 8],
  },
  'ncal-jv': {
    easy: [1, 4, 5, 7, 10, 14, 15, 16, 19, 20, 22, 23, 26, 29, 31, 34, 35, 37, 38, 40, 44, 45, 49, 50, 51, 52, 53, 55, 56],
    hard: [2, 3, 8, 11, 12, 17, 21, 24, 25, 27, 28, 30, 33, 42, 48, 54, 58],
    bonusEasy: [0, 5, 9], bonusHard: [3, 6, 8],
  },
  'ncal-varsity': {
    easy: [1, 6, 7, 9, 15, 16, 18, 32, 47, 50, 52, 53, 54, 56, 57, 60, 63],
    hard: [4, 11, 12, 17, 23, 26, 29, 33, 36, 40, 51, 58],
    bonusEasy: [0, 2, 8, 11], bonusHard: [4, 5, 6, 9],
  },
  'quizbowl-novice': { easy: [0, 1, 2, 3, 4, 5, 6, 7, 15, 17, 24, 25, 27, 29, 30], hard: [14, 16, 23, 26], bonusEasy: [0, 2, 3, 4, 6], bonusHard: [1, 7] },
  'quizbowl-jv': { easy: [0, 1, 2, 3, 4, 6, 7, 8, 15, 18, 24, 25, 28, 31, 32], hard: [5, 9, 12, 14, 20, 23, 26, 30], bonusEasy: [1, 2, 5], bonusHard: [6, 7] },
  'quizbowl-varsity': { easy: [1, 3, 6, 7, 13, 24, 30, 31, 33, 34], hard: [0, 2, 10, 12, 14, 15, 17, 19, 25, 27], bonusEasy: [1, 4, 7], bonusHard: [2, 5, 8] },
};
