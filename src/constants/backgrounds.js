export const BACKGROUNDS = [
  {
    id: 'soldier',
    name: 'Soldier',
    tagline: 'You served in a regiment and know the weight of a blade.',
    skills: ['athletics', 'intimidation'],
    startingGearFlavor: 'Travel-worn armor, a military insignia',
  },
  {
    id: 'criminal',
    name: 'Criminal',
    tagline: 'You worked outside the law. Old habits die hard.',
    skills: ['stealth', 'deception'],
    startingGearFlavor: 'Dark cloak, a set of lockpicks',
  },
  {
    id: 'scholar',
    name: 'Scholar',
    tagline: 'You studied in libraries and academies, chasing forgotten knowledge.',
    skills: ['arcana', 'history'],
    startingGearFlavor: 'Ink-stained satchel, a worn reference tome',
  },
  {
    id: 'folkHero',
    name: 'Folk Hero',
    tagline: 'You stood up for your village when no one else would.',
    skills: ['animalHandling', 'survival'],
    startingGearFlavor: 'Worn tools, a letter of thanks from your village',
  },
  {
    id: 'acolyte',
    name: 'Acolyte',
    tagline: 'You served a temple or faith, learning its secrets and burdens.',
    skills: ['insight', 'religion'],
    startingGearFlavor: 'Holy symbol, prayer beads',
  },
  {
    id: 'outlander',
    name: 'Outlander',
    tagline: 'You lived beyond civilization, reading land and sky like a map.',
    skills: ['perception', 'nature'],
    startingGearFlavor: "Hunter's kit, a hand-drawn territory map",
  },
];

export const getBackgroundById = (id) => BACKGROUNDS.find(b => b.id === id);

// All 18 skills with their governing stat
export const ALL_SKILLS = [
  'athletics', 'acrobatics', 'sleightOfHand', 'stealth',
  'arcana', 'history', 'investigation', 'nature', 'religion',
  'animalHandling', 'insight', 'medicine', 'perception', 'survival',
  'deception', 'intimidation', 'performance', 'persuasion',
];

export const SKILL_DISPLAY_NAMES = {
  athletics: 'Athletics',
  acrobatics: 'Acrobatics',
  sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth',
  arcana: 'Arcana',
  history: 'History',
  investigation: 'Investigation',
  nature: 'Nature',
  religion: 'Religion',
  animalHandling: 'Animal Handling',
  insight: 'Insight',
  medicine: 'Medicine',
  perception: 'Perception',
  survival: 'Survival',
  deception: 'Deception',
  intimidation: 'Intimidation',
  performance: 'Performance',
  persuasion: 'Persuasion',
};

export const SKILL_TO_STAT = {
  athletics: 'STR',
  acrobatics: 'DEX', sleightOfHand: 'DEX', stealth: 'DEX',
  arcana: 'INT', history: 'INT', investigation: 'INT',
  nature: 'INT', religion: 'INT',
  animalHandling: 'WIS', insight: 'WIS', medicine: 'WIS',
  perception: 'WIS', survival: 'WIS',
  deception: 'CHA', intimidation: 'CHA', performance: 'CHA', persuasion: 'CHA',
};

/**
 * Computes the final skills object from class + background + optional expertise choices.
 * Returns { [skillKey]: 0 | 1 | 2 } where 0=none, 1=proficient, 2=expertise.
 */
export function computeSkills(classData, backgroundData, expertiseChoices = []) {
  const proficientSkills = new Set([
    ...(classData.lockedProficiencies || []),
    ...(backgroundData.skills || []),
  ]);

  const skills = {};
  for (const skill of ALL_SKILLS) {
    if (expertiseChoices.includes(skill)) {
      skills[skill] = 2;
    } else if (proficientSkills.has(skill)) {
      skills[skill] = 1;
    } else {
      skills[skill] = 0;
    }
  }
  return skills;
}
