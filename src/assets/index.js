// ─── SPLASH BACKGROUNDS ───────────────────────────────────────────────────────
export const Splashes = {
  mainMenu:      require('./splash/SPLASH_01.png'),
  campaignSelect:require('./splash/SPLASH_02.png'),
  charCreation:  require('./splash/SPLASH_03.png'),
  dmConversation:require('./splash/SPLASH_04.png'),
  diceMenu:      require('./splash/SPLASH_05.png'),
};

// ─── CLASS ILLUSTRATIONS ──────────────────────────────────────────────────────
export const ClassArt = {
  fighter: require('./classes/CLASS_fighter.png'),
  wizard:  require('./classes/CLASS_wizard.png'),
  rogue:   require('./classes/CLASS_rogue.png'),
  cleric:  require('./classes/CLASS_cleric.png'),
  ranger:  require('./classes/CLASS_ranger.png'),
  paladin: require('./classes/CLASS_paladin.png'),
};

// ─── RACE PORTRAITS ───────────────────────────────────────────────────────────
export const RaceArt = {
  human:       require('./races/RACE_human.png'),
  elf:         require('./races/RACE_elf.png'),
  'half-elf':  require('./races/RACE_elf.png'),   // fallback — no dedicated half-elf art yet
  dwarf:       require('./races/RACE_dwarf.png'),
  halfling:    require('./races/RACE_halfling.png'),
  orc:         require('./races/RACE_orc.png'),
  shadowborn:  require('./races/RACE_shadowborn.png'),
};

// ─── CAMPAIGN BANNERS ─────────────────────────────────────────────────────────
export const CampaignArt = {
  tutorial:      require('./campaigns/CAMPAIGN_hollow.png'),
  epic_quest:    require('./campaigns/CAMPAIGN_glass.png'),
  dungeon_crawl: require('./campaigns/CAMPAIGN_ashen.png'),
  firimbel:      require('./campaigns/CAMPAIGN_court.png'),
  random:        require('./campaigns/CAMPAIGN_random.png'),
};

// ─── DICE FACE TEXTURES (top-down single-face renders — used on the die in-game) ──
// Uncomment once DICE_*_face.png images are generated and dropped into this folder:
 export const DiceFaceArt = {
   classic:   require('./dice/DICE_classic_face.png'),
   graystone: require('./dice/DICE_graystone_face.png'),
   obsidian:  require('./dice/DICE_obsidian_face.png'),
   dragon:    require('./dice/DICE_dragon_face.png'),
   crystal:   require('./dice/DICE_crystal_face.png'),
 };

// ─── SPAWN POINT ART ──────────────────────────────────────────────────────────
// Drop SPAWN_<id>.png files into campaigns/, then replace null with require('./campaigns/SPAWN_...').
// Naming convention: SPAWN_aldenmere.png, SPAWN_crestmere.png, etc.
export const SpawnArt = {
  spawn_aldenmere:    null, // require('./SPAWN_aldenmere.png')
  spawn_crestmere:    null, // require('./SPAWN_crestmere.png')
  spawn_ironhold:     null, // require('./SPAWN_ironhold.png')
  spawn_millford:     null, // require('./SPAWN_millford.png')
  spawn_deepwell:     null, // require('./SPAWN_deepwell.png')
  spawn_waystone:     null, // require('./SPAWN_waystone.png')
  spawn_hunters_rest: null, // require('./SPAWN_hunters_rest.png')
  spawn_black_moor:   null, // require('./SPAWN_black_moor.png')
  spawn_embers_end:   null, // require('./SPAWN_embers_end.png')
  spawn_random:       null, // require('./SPAWN_random.png')
};

// ─── 3D DICE SET MODEL ────────────────────────────────────────────────────────
// Drop DiceSet.glb (single file, all 7 dice) into this folder.
// Until the file exists this stays null — Die3D falls back to procedural geometry.
let DiceSetModel = null;
try { DiceSetModel = require('./dice/DiceSet.glb'); } catch (_) {}
export { DiceSetModel };

// ─── UI ICONS ─────────────────────────────────────────────────────────────────
export const Icons = {
  inventory:  require('./icons/ICON_inventory.png'),
  scroll:     require('./icons/ICON_scroll.png'),
  shield:     require('./icons/ICON_shield.png'),
  map:        require('./icons/ICON_map.png'),
  chronicler: require('./icons/ICON_chronicler.png'),
  d20:        require('./icons/ICON_d20.png'),
  skull:      require('./icons/ICON_skull.png'),
  sword:      require('./icons/ICON_sword.png'),
};
