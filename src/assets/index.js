// ─── SPLASH BACKGROUNDS ───────────────────────────────────────────────────────
export const Splashes = {
  mainMenu:      require('./SPLASH_01.png'),
  campaignSelect:require('./SPLASH_02.png'),
  charCreation:  require('./SPLASH_03.png'),
  dmConversation:require('./SPLASH_04.png'),
  diceMenu:      require('./SPLASH_05.png'),
};

// ─── CLASS ILLUSTRATIONS ──────────────────────────────────────────────────────
export const ClassArt = {
  fighter: require('./CLASS_fighter.png'),
  wizard:  require('./CLASS_wizard.png'),
  rogue:   require('./CLASS_rogue.png'),
  cleric:  require('./CLASS_cleric.png'),
  ranger:  require('./CLASS_ranger.png'),
  paladin: require('./CLASS_paladin.png'),
};

// ─── RACE PORTRAITS ───────────────────────────────────────────────────────────
export const RaceArt = {
  human:       require('./RACE_human.png'),
  elf:         require('./RACE_elf.png'),
  'half-elf':  require('./RACE_elf.png'),   // fallback — no dedicated half-elf art yet
  dwarf:       require('./RACE_dwarf.png'),
  halfling:    require('./RACE_halfling.png'),
  orc:         require('./RACE_orc.png'),
  shadowborn:  require('./RACE_shadowborn.png'),
};

// ─── CAMPAIGN BANNERS ─────────────────────────────────────────────────────────
export const CampaignArt = {
  tutorial:      require('./CAMPAIGN_hollow.png'),
  epic_quest:    require('./CAMPAIGN_glass.png'),
  dungeon_crawl: require('./CAMPAIGN_ashen.png'),
  firimbel:      require('./CAMPAIGN_court.png'),
  random:        require('./CAMPAIGN_random.png'),
};

// ─── DICE SKINS (set renders — used as selector preview cards) ────────────────
export const DiceArt = {
  graystone: require('./DICE_graystone.png'),
  obsidian:  require('./DICE_obsidian.png'),
  dragon:    require('./DICE_dragon.png'),
  crystal:   require('./DICE_crystal.png'),
};

// ─── DICE FACE TEXTURES (top-down single-face renders — used on the die in-game) ──
// Uncomment once DICE_*_face.png images are generated and dropped into this folder:
 export const DiceFaceArt = {
   graystone: require('./DICE_graystone_face.png'),
   obsidian:  require('./DICE_obsidian_face.png'),
   dragon:    require('./DICE_dragon_face.png'),
   crystal:   require('./DICE_crystal_face.png'),
 };

// ─── SPAWN POINT ART ──────────────────────────────────────────────────────────
// Drop SPAWN_<id>.png files into this folder, then replace null with require().
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

// ─── UI ICONS ─────────────────────────────────────────────────────────────────
export const Icons = {
  inventory:  require('./ICON_inventory.png'),
  scroll:     require('./ICON_scroll.png'),
  shield:     require('./ICON_shield.png'),
  map:        require('./ICON_map.png'),
  chronicler: require('./ICON_chronicler.png'),
  d20:        require('./ICON_d20.png'),
  skull:      require('./ICON_skull.png'),
  sword:      require('./ICON_sword.png'),
};
