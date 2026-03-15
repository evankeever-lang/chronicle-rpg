// src/utils/combat.js
// Client-side combat resolution.
// The AI is a narrator of outcomes — all dice, HP, and state live here.

import { roll, getAbilityModifier } from './dice';

// ─── Class weapon defaults ────────────────────────────────────────────────────
// Used when the DM initiates combat and we need to auto-resolve player attacks.
const CLASS_COMBAT = {
  Fighter:  { damageDice: '1d8', abilityKey: 'STR' },
  Paladin:  { damageDice: '1d8', abilityKey: 'STR' },
  Ranger:   { damageDice: '1d6', abilityKey: 'DEX' },
  Rogue:    { damageDice: '1d6', abilityKey: 'DEX' },
  Cleric:   { damageDice: '1d6', abilityKey: 'STR' },
  Wizard:   { damageDice: '1d4', abilityKey: 'INT' },
};

export function getPlayerCombatProfile(character) {
  const className = character?.class?.name || character?.class || 'Fighter';
  const profile = CLASS_COMBAT[className] || CLASS_COMBAT.Fighter;
  const abilityMod = getAbilityModifier(character?.abilityScores?.[profile.abilityKey] || 10);
  const profBonus = character?.proficiencyBonus || 2;
  return {
    damageDice: profile.damageDice,
    attackBonus: abilityMod + profBonus,
    damageMod: abilityMod,
  };
}

// ─── Initiative ───────────────────────────────────────────────────────────────
// entities: [{ name, isPlayer, dexMod, initiativeBonus? }]
// Returns array sorted highest-first, ties broken randomly.
export function rollInitiative(entities) {
  return entities
    .map(entity => ({
      ...entity,
      initiative: roll(20) + (entity.initiativeBonus ?? entity.dexMod ?? 0),
      _tie: Math.random(),
    }))
    .sort((a, b) =>
      b.initiative !== a.initiative ? b.initiative - a.initiative : b._tie - a._tie
    )
    .map(({ _tie, ...rest }) => rest);
}

// ─── Attack resolution ────────────────────────────────────────────────────────
// attackBonus: proficiency + ability modifier
// advantage: 'none' | 'advantage' | 'disadvantage'
// Returns { roll, total, hit, isCrit, isFumble }
export function resolveAttack(attackBonus, targetAC, advantage = 'none') {
  const roll1 = roll(20);
  const dieRoll = advantage === 'advantage'
    ? Math.max(roll1, roll(20))
    : advantage === 'disadvantage'
    ? Math.min(roll1, roll(20))
    : roll1;
  const isCrit = dieRoll === 20;
  const isFumble = dieRoll === 1;
  const total = dieRoll + attackBonus;
  const hit = isCrit || (!isFumble && total >= targetAC);
  return { roll: dieRoll, total, hit, isCrit, isFumble };
}

// ─── Damage rolls ─────────────────────────────────────────────────────────────
// diceStr examples: '1d6', '2d8', '1d6+2'
// isCrit: doubles the number of dice (DnD 5e rule)
// Returns { total, rolls, modifier }
export function rollDamage(diceStr, isCrit = false) {
  const match = String(diceStr).match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    const flat = parseInt(diceStr, 10) || 1;
    return { total: flat, rolls: [flat], modifier: 0 };
  }
  let count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  if (isCrit) count *= 2;
  const rolls = Array.from({ length: count }, () => roll(sides));
  const total = Math.max(1, rolls.reduce((s, r) => s + r, 0) + modifier);
  return { total, rolls, modifier };
}

// ─── Death saves ──────────────────────────────────────────────────────────────
// Returns { roll, success, isCritical (nat 20 → 1 HP), isFumble (nat 1 → 2 failures) }
export function rollDeathSave() {
  const dieRoll = roll(20);
  return {
    roll: dieRoll,
    success: dieRoll >= 10,
    isCritical: dieRoll === 20,
    isFumble: dieRoll === 1,
  };
}

// ─── Enemy initialization ─────────────────────────────────────────────────────
// Converts raw DM JSON enemy list into typed GameContext objects.
export function initializeEnemies(enemyList) {
  return (enemyList || []).map((enemy, idx) => ({
    id: `enemy_${idx}_${Date.now()}`,
    name: enemy.name || `Enemy ${idx + 1}`,
    hp: enemy.hp || 10,
    maxHp: enemy.maxHp || enemy.max_hp || enemy.hp || 10,
    ac: enemy.ac || 12,
    attackBonus: enemy.attackBonus || enemy.attack_bonus || 3,
    damageDice: enemy.damageDice || enemy.damage_dice || '1d6',
    initiativeMod: enemy.initiativeMod ?? enemy.initiative_mod ?? 0,
    conditions: [],
  }));
}

// ─── Combat message formatters ────────────────────────────────────────────────
// Build the player-attack message sent to the DM after client resolves dice.
export function formatPlayerAttack({ targetName, attackResult, damage, targetHpAfter }) {
  const outcome = attackResult.isCrit
    ? 'Critical hit!'
    : attackResult.isFumble
    ? 'Fumble — complete miss.'
    : attackResult.hit
    ? 'Hit.'
    : 'Miss.';
  const dmgStr = attackResult.hit ? ` Dealt ${damage} damage.` : '';
  const hpStr = attackResult.hit
    ? ` ${targetName} has ${Math.max(0, targetHpAfter)} HP remaining.`
    : '';
  return `I attack ${targetName}. Roll: ${attackResult.roll} (total ${attackResult.total}). ${outcome}${dmgStr}${hpStr}`;
}

// Build the enemy-turn message sent to the DM after client auto-resolves enemy_action.
export function formatEnemyTurn({ enemyName, attackResult, damage, playerAC, playerHpAfter }) {
  const outcome = attackResult.isCrit
    ? 'Critical hit!'
    : attackResult.hit
    ? 'Hit.'
    : 'Miss.';
  const dmgStr = attackResult.hit ? ` Dealt ${damage} damage.` : '';
  const hpStr = attackResult.hit
    ? ` I have ${Math.max(0, playerHpAfter)} HP remaining.`
    : '';
  return `${enemyName} attacks me (AC ${playerAC}). Roll: ${attackResult.roll} (total ${attackResult.total}). ${outcome}${dmgStr}${hpStr}`;
}

// Build a compact summary injected into the DM context when combat ends.
export function buildCombatSummary({ enemies, rounds, playerHpStart, playerHpEnd }) {
  const defeated = enemies.filter(e => e.hp <= 0).map(e => e.name);
  const survived = enemies.filter(e => e.hp > 0).map(e => e.name);
  const hpLost = playerHpStart - playerHpEnd;
  return [
    `Combat ended after ${rounds} round${rounds !== 1 ? 's' : ''}.`,
    defeated.length ? `Defeated: ${defeated.join(', ')}.` : null,
    survived.length ? `Enemies that fled or survived: ${survived.join(', ')}.` : null,
    hpLost > 0 ? `Player lost ${hpLost} HP in total.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}
