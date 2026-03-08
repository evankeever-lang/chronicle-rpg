// DnD 5e dice utilities

export const roll = (sides) => Math.floor(Math.random() * sides) + 1;

export const rollMultiple = (count, sides) =>
  Array.from({ length: count }, () => roll(sides));

export const getAbilityModifier = (score) => Math.floor((score - 10) / 2);

export const getModifierString = (mod) => (mod >= 0 ? `+${mod}` : `${mod}`);

export const getProficiencyBonus = (level) => Math.ceil(level / 4) + 1;

export const calculateMaxHP = (classHitDie, level, conScore) => {
  const conMod = getAbilityModifier(conScore);
  return classHitDie + conMod + (level - 1) * (Math.floor(classHitDie / 2) + 1 + conMod);
};

export const calculateAC = (dexScore, hasArmor = false, armorBase = 10) => {
  const dexMod = getAbilityModifier(dexScore);
  return hasArmor ? armorBase + Math.min(dexMod, 2) : 10 + dexMod;
};

// Point-buy: 27 pts, scores 8-15 before racial bonuses
// Cost: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9
const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const getPointBuyCost = (score) => POINT_BUY_COSTS[score] ?? 0;
export const getTotalPointsSpent = (scores) =>
  Object.values(scores).reduce((sum, s) => sum + getPointBuyCost(s), 0);

export const SKILL_ABILITY_MAP = {
  Acrobatics: 'DEX', 'Animal Handling': 'WIS', Arcana: 'INT',
  Athletics: 'STR', Deception: 'CHA', History: 'INT',
  Insight: 'WIS', Intimidation: 'CHA', Investigation: 'INT',
  Medicine: 'WIS', Nature: 'INT', Perception: 'WIS',
  Performance: 'CHA', Persuasion: 'CHA', Religion: 'INT',
  'Sleight of Hand': 'DEX', Stealth: 'DEX', Survival: 'WIS',
};

export const getSkillModifier = (skill, abilityScores, proficiencyBonus, proficientSkills) => {
  const ability = SKILL_ABILITY_MAP[skill];
  const abilityMod = getAbilityModifier(abilityScores[ability]);
  const profBonus = proficientSkills.includes(skill) ? proficiencyBonus : 0;
  return abilityMod + profBonus;
};

// Roll result classification
export const classifyRoll = (roll, sides) => {
  if (sides === 20) {
    if (roll === 20) return 'crit';
    if (roll === 1) return 'fumble';
    if (roll >= 15) return 'success';
    if (roll >= 8) return 'partial';
    return 'fail';
  }
  return 'normal';
};

export const DC_LABELS = { 10: 'Easy', 15: 'Medium', 20: 'Hard', 25: 'Very Hard', 30: 'Nearly Impossible' };
