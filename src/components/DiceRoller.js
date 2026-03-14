// src/components/DiceRoller.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { GLView } from 'expo-gl';
import { Asset } from 'expo-asset';
import { loadTextureAsync } from 'expo-three';
import * as THREE from 'three';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { roll as rollDie, getModifierString as formatMod, getAbilityModifier as getAbilityMod } from '../utils/dice';
import { DiceFaceArt } from '../assets';

// ─── Die shape configs ────────────────────────────────────────────────────────
const DIE_CONFIG = {
  4:   { color: '#9B6B9E', label: 'd4',   shape: 'triangle' },
  6:   { color: '#6B8EC9', label: 'd6',   shape: 'square'   },
  8:   { color: '#6BB89E', label: 'd8',   shape: 'diamond'  },
  10:  { color: '#C9986B', label: 'd10',  shape: 'diamond'  },
  12:  { color: '#C96B8E', label: 'd12',  shape: 'pentagon' },
  20:  { color: '#C9A84C', label: 'd20',  shape: 'triangle' },
  100: { color: '#8EA0C9', label: 'd100', shape: 'circle'   },
};

// ─── Skin colour palettes ─────────────────────────────────────────────────────
// null = use per-die colour from DIE_CONFIG (Classic)
const SKIN_PALETTES = {
  default:   null,
  graystone: { accent: '#8A9BAD', glow: '#5C7080', edge: '#99CCEE', num: '#E8EFF5' },
  obsidian:  { accent: '#9B7FBF', glow: '#6A4E9E', edge: '#CC33FF', num: '#D4C8FF' },
  dragon:    { accent: '#C94C4C', glow: '#8E2A2A', edge: '#FF1133', num: '#FFD4D4' },
  crystal:   { accent: '#4CA8C9', glow: '#1A7FA0', edge: '#00EEFF', num: '#D4F0FF' },
};

// ─── Pixel font (5 × 7) — digits 0–9, MSB = leftmost column ─────────────────
const DIGITS_5x7 = [
  [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110], // 0
  [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110], // 1
  [0b01110,0b10001,0b00001,0b00110,0b01000,0b10000,0b11111], // 2
  [0b01110,0b10001,0b00001,0b00110,0b00001,0b10001,0b01110], // 3
  [0b00001,0b00011,0b00101,0b01001,0b11111,0b00001,0b00001], // 4
  [0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110], // 5
  [0b00110,0b01000,0b10000,0b11110,0b10001,0b10001,0b01110], // 6
  [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000], // 7
  [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110], // 8
  [0b01110,0b10001,0b10001,0b01111,0b00001,0b10001,0b01110], // 9
];

function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Creates a 128×128 RGBA Uint8Array with the number rendered using the pixel
// font. glowRgb = [r,g,b] for the neon border; digit is always white for contrast.
// Key: glow radii are FIXED small pixel counts, not scaled by logical px, so they
// don't smear into a blob when adjacent font blocks share glow areas.
function makeNumberTexture(numStr, glowRgb, _numRgb, SIZE = 128) {
  const buf  = new Uint8Array(SIZE * SIZE * 4);
  const px   = Math.floor(SIZE / 11);   // ~11 actual pixels per logical pixel @ 128
  const gap  = Math.max(2, Math.round(px * 0.6));
  const chars = String(numStr).split('').map(c => DIGITS_5x7[parseInt(c)] || DIGITS_5x7[0]);
  const totalW = chars.length * 5 * px + (chars.length - 1) * gap;
  const totalH = 7 * px;
  let cx = (SIZE - totalW) >> 1;
  const cy = (SIZE - totalH) >> 1;
  const [gr, gg, gb] = glowRgb;

  function blend(x, y, r, g, b, a) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    const ea = buf[i + 3] / 255, fa = a / 255;
    const oa = fa + ea * (1 - fa);
    if (oa < 0.001) return;
    buf[i]     = ((r * fa + buf[i]     * ea * (1 - fa)) / oa) | 0;
    buf[i + 1] = ((g * fa + buf[i + 1] * ea * (1 - fa)) / oa) | 0;
    buf[i + 2] = ((b * fa + buf[i + 2] * ea * (1 - fa)) / oa) | 0;
    buf[i + 3] = (oa * 255) | 0;
  }

  for (const bitmap of chars) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!(bitmap[row] & (0b10000 >> col))) continue;
        const bx = cx + col * px;
        const by = cy + row * px;
        // Fixed-pixel glow rings (radii in actual pixels, NOT scaled by px)
        // This prevents the rings from neighbouring blocks merging into a blob
        for (const [rad, alpha] of [[5, 20], [3, 70], [2, 160]]) {
          for (let dy = -rad; dy < px + rad; dy++) {
            for (let dx = -rad; dx < px + rad; dx++) {
              blend(bx + dx, by + dy, gr, gg, gb, alpha);
            }
          }
        }
        // White digit on top — maximum contrast against any die texture
        for (let py = 0; py < px; py++) {
          for (let px2 = 0; px2 < px; px2++) {
            blend(bx + px2, by + py, 255, 255, 255, 255);
          }
        }
      }
    }
    cx += 5 * px + gap;
  }
  return buf;
}

// ─── 3D Die — true WebGL mesh via expo-gl + three.js ─────────────────────────
function Die3D({ sides, rolling, result, skin = 'default' }) {
  const cfg    = DIE_CONFIG[sides] || DIE_CONFIG[20];
  const palette = SKIN_PALETTES[skin] || null;
  const color   = palette ? palette.accent : cfg.color;

  const displayNumRef = useRef('?');   // drives the in-GL number sprite
  const numCycleRef   = useRef(null);
  const rollingRef    = useRef(rolling);
  const rafRef        = useRef(null);
  const spinRef       = useRef({ x: 0, y: 0, z: 0 });

  // Keep rollingRef current for the GL animation loop
  useEffect(() => { rollingRef.current = rolling; }, [rolling]);

  // Number cycling — independent of GL
  useEffect(() => {
    if (rolling) {
      numCycleRef.current = setInterval(() => {
        displayNumRef.current = String(Math.floor(Math.random() * sides) + 1);
      }, 70);
    } else {
      if (numCycleRef.current) { clearInterval(numCycleRef.current); numCycleRef.current = null; }
      displayNumRef.current = result != null ? String(result) : '?';
    }
    return () => { if (numCycleRef.current) clearInterval(numCycleRef.current); };
  }, [rolling, result, sides]);

  useEffect(() => {
    if (result == null) { displayNumRef.current = '?'; }
  }, [result]);

  // Cancel any running RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const onContextCreate = useCallback(async (gl) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width: W, height: H, style: {},
        addEventListener: () => {}, removeEventListener: () => {},
        clientWidth: W, clientHeight: H,
      },
      context: gl,
    });
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 100);
    camera.position.z = 3.6;

    // ── Lighting — warm candlelit ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xfff0d0, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffe8b0, 1.3);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8090cc, 0.35);
    fillLight.position.set(-3, -1, 2);
    scene.add(fillLight);

    // ── Geometry ──────────────────────────────────────────────────────────────
    let geometry;
    switch (sides) {
      case 4:   geometry = new THREE.TetrahedronGeometry(1.4, 0); break;
      case 6:   geometry = new THREE.BoxGeometry(1.7, 1.7, 1.7); break;
      case 8:   geometry = new THREE.OctahedronGeometry(1.45, 0); break;
      case 12:  geometry = new THREE.DodecahedronGeometry(1.3, 0); break;
      case 100: geometry = new THREE.SphereGeometry(1.2, 14, 14); break;
      default:  geometry = new THREE.IcosahedronGeometry(1.38, 0); // d10, d20
    }

    // ── Material ──────────────────────────────────────────────────────────────
    let material;
    const faceSource = skin !== 'default' ? DiceFaceArt?.[skin] : null;

    if (faceSource) {
      try {
        const asset = Asset.fromModule(faceSource);
        await asset.downloadAsync();
        const texture = await loadTextureAsync({ asset });
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.2 });
      } catch (_) {
        material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5, metalness: 0.2 });
      }
    } else {
      const hex = parseInt(color.replace('#', ''), 16);
      material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45, metalness: 0.3 });
    }

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // ── Per-face edge glow — 4-layer EdgesGeometry for fuzzy neon bloom ────────
    const neonStr  = palette?.edge || color;
    const neonHex  = parseInt(neonStr.replace('#', ''), 16);
    const edgeGeo  = new THREE.EdgesGeometry(geometry, 1);
    // Layers ordered largest→smallest so inner layers overdraw outer
    const glowLayers = [
      { scale: 1.038, opacity: 0.12 },
      { scale: 1.025, opacity: 0.32 },
      { scale: 1.012, opacity: 0.68 },
      { scale: 1.000, opacity: 1.00 },
    ];
    const edgeGroup = new THREE.Group();
    for (const { scale: s, opacity } of glowLayers) {
      const mat   = new THREE.LineBasicMaterial({ color: neonHex, transparent: true, opacity });
      const lines = new THREE.LineSegments(edgeGeo, mat);
      lines.scale.setScalar(s);
      edgeGroup.add(lines);
    }
    scene.add(edgeGroup);

    // ── Number sprite — DataTexture updated each roll, always faces camera ─────
    const TSIZE   = 128;
    const numRgb  = hexToRgb(palette?.num  || '#FFFFFF');
    const glowRgb = hexToRgb(neonStr);
    const initBuf = new Uint8Array(TSIZE * TSIZE * 4); // transparent until first result
    const numTex  = new THREE.DataTexture(initBuf, TSIZE, TSIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    numTex.needsUpdate = true;
    const spriteMat  = new THREE.SpriteMaterial({ map: numTex, transparent: true, depthTest: false });
    const numSprite  = new THREE.Sprite(spriteMat);
    numSprite.scale.set(1.35, 1.35, 1.35);
    numSprite.position.set(0, 0, 1.55);
    numSprite.visible = false;
    scene.add(numSprite);

    // ── Helper: quaternion that rotates the nearest face normal to face camera ─
    function faceUpQuat(currentQuat) {
      const normals = geometry.attributes.normal;
      const camDir  = new THREE.Vector3(0, 0, 1);
      let bestDot = -Infinity;
      const bestN = new THREE.Vector3();
      for (let i = 0; i < normals.count; i += 3) {
        const fn = new THREE.Vector3(
          normals.getX(i), normals.getY(i), normals.getZ(i)
        ).normalize().applyQuaternion(currentQuat);
        const d = fn.dot(camDir);
        if (d > bestDot) { bestDot = d; bestN.copy(fn); }
      }
      const delta = new THREE.Quaternion().setFromUnitVectors(bestN, camDir);
      return delta.multiply(currentQuat);
    }

    // Start with a face squarely facing the camera
    const initQ = faceUpQuat(new THREE.Quaternion());
    mesh.quaternion.copy(initQ);
    edgeGroup.quaternion.copy(initQ);

    // ── Render loop ───────────────────────────────────────────────────────────
    const spin = spinRef.current;
    spin.x = 0; spin.y = 0; spin.z = 0;
    let prevRolling     = false;
    let isSettling      = false;
    let lastRenderedNum = '';
    const targetQuat    = new THREE.Quaternion().copy(initQ);

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const nowRolling = rollingRef.current;

      // ── Detect transitions ─────────────────────────────────────────────────
      if (!prevRolling && nowRolling) {
        isSettling = false;
        numSprite.visible = false;
      }
      if (prevRolling && !nowRolling) {
        spin.x = 0; spin.y = 0; spin.z = 0;
        isSettling = true;
        targetQuat.copy(faceUpQuat(mesh.quaternion));
      }
      prevRolling = nowRolling;

      if (nowRolling) {
        spin.x += (0.052 - spin.x) * 0.13;
        spin.y += (0.082 - spin.y) * 0.13;
        spin.z += (0.030 - spin.z) * 0.13;
        mesh.rotation.x += spin.x;
        mesh.rotation.y += spin.y;
        mesh.rotation.z += spin.z;
        edgeGroup.quaternion.copy(mesh.quaternion);
      } else if (isSettling) {
        mesh.quaternion.slerp(targetQuat, 0.048);
        edgeGroup.quaternion.copy(mesh.quaternion);
        if (mesh.quaternion.angleTo(targetQuat) < 0.008) {
          mesh.quaternion.copy(targetQuat);
          edgeGroup.quaternion.copy(targetQuat);
          isSettling = false;
        }
      }

      // ── Number sprite — show after settle, update texture when number changes
      if (!nowRolling && !isSettling) {
        const cur = displayNumRef.current;
        if (cur !== '?' && cur !== lastRenderedNum) {
          // Bake new number into the DataTexture
          numTex.image = {
            data:   makeNumberTexture(cur, glowRgb, numRgb, TSIZE),
            width:  TSIZE,
            height: TSIZE,
          };
          numTex.needsUpdate = true;
          lastRenderedNum = cur;
        }
        numSprite.visible = cur !== '?';
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  }, [skin, sides]); // re-create GL context when skin or die type changes

  return (
    // Key forces GLView remount when skin/sides change → fresh onContextCreate
    <View style={styles.glDieContainer}>
      <GLView
        key={`${skin}-${sides}`}
        style={styles.glView}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}


// ─── Main DiceRoller Component ────────────────────────────────────────────────
export default function DiceRoller({
  visible,
  onRollComplete,
  requiredRoll,     // { skill, dc, ability } — set for skill checks
  character,
  isPeeking,        // whether the user has minimised to peek at DM text
  onPeekToggle,     // toggle peek mode
  rollContext,        // plain label for combat rolls ("Roll for Initiative", "Attack Roll", etc.)
  requiredSides,      // override die sides (e.g. 8 for d8 damage roll); defaults to requiredRoll?.sides or 20
  hasAdvantage = false,    // show Advantage button (only when a condition/ability grants it)
  hasDisadvantage = false, // show Disadvantage button (only when a condition/ability grants it)
  selectedSkin = 'default',
}) {
  const [result, setResult] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);

  const resultAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Animate sheet in/out
  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: visible ? 1 : 0,
      tension: 60, friction: 12, useNativeDriver: true,
    }).start();
  }, [visible]);

  // Reset when shown or when rollContext changes (e.g. attack → damage phase)
  useEffect(() => {
    if (visible) {
      setResult(null);
      setAdvantage(false);
      setDisadvantage(false);
      resultAnim.setValue(0);
    }
  }, [visible, rollContext]);

  const sides = requiredSides || requiredRoll?.sides || 20;

  const getModifier = useCallback(() => {
    if (!character || !requiredRoll) return 0;
    const abilityScore = character.abilityScores?.[requiredRoll.ability] || 10;
    const baseMod = getAbilityMod(abilityScore);
    const isProficient = character.proficientSkills?.includes(requiredRoll.skill);
    return baseMod + (isProficient ? (character.proficiencyBonus || 2) : 0);
  }, [character, requiredRoll]);

  const performRoll = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);
    setResult(null);
    resultAnim.setValue(0);

    setTimeout(() => { // roll duration — matches Die3D spin window
      let die1, die2, finalDie;

      if (advantage && !disadvantage) {
        die1 = rollDie(sides); die2 = rollDie(sides);
        finalDie = Math.max(die1, die2);
      } else if (disadvantage && !advantage) {
        die1 = rollDie(sides); die2 = rollDie(sides);
        finalDie = Math.min(die1, die2);
      } else {
        finalDie = rollDie(sides);
        die1 = finalDie; die2 = null;
      }

      const modifier = getModifier();
      const total = finalDie + modifier;
      const dc = requiredRoll?.dc;
      const success = dc != null ? total >= dc : null;
      const isCrit = sides === 20 && finalDie === 20;
      const isFumble = sides === 20 && finalDie === 1;

      const rollResult = { die: finalDie, die1, die2, modifier, total, dc, success, isCrit, isFumble, sides };
      setResult(rollResult);
      setIsRolling(false);

      Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    }, 1200);
  }, [isRolling, sides, advantage, disadvantage, requiredRoll, getModifier]);

  const handleConfirm = useCallback(() => {
    if (result) onRollComplete?.(result);
    setResult(null);
  }, [result, onRollComplete]);

  const getResultColor = () => {
    if (!result) return COLORS.textPrimary;
    if (result.isCrit) return COLORS.diceCrit;
    if (result.isFumble) return COLORS.diceFumble;
    if (result.success === true) return COLORS.success;
    if (result.success === false) return COLORS.hpLow;
    return COLORS.primaryLight;
  };

  const getResultBadge = () => {
    if (!result) return null;
    if (result.isCrit) return { label: 'CRITICAL HIT', color: COLORS.diceCrit };
    if (result.isFumble) return { label: 'CRITICAL FAIL', color: COLORS.diceFumble };
    if (result.success === true) return { label: 'SUCCESS', color: COLORS.success };
    if (result.success === false) return { label: 'FAILURE', color: COLORS.hpLow };
    return null;
  };

  const slideY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const badge = getResultBadge();
  const mod = getModifier();

  if (!visible) return null;

  // ── Peek mode: thin bar so player can read DM text ─────────────────────────
  if (isPeeking) {
    return (
      <Animated.View style={[styles.peekBar, { transform: [{ translateY: slideY }] }]}>
        <TouchableOpacity style={styles.peekBarInner} onPress={onPeekToggle}>
          <Text style={styles.peekBarText}>
            🎲 {requiredRoll ? `${requiredRoll.skill} Check · DC ${requiredRoll.dc}` : (rollContext || 'Roll')} — tap to roll
          </Text>
          <Text style={styles.peekArrow}>↑</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    // Backdrop is NOT tappable — player must roll
    <View style={styles.backdrop}>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>

        {/* Handle */}
        <View style={styles.handle} />

        {/* Peek button — collapse to see DM text */}
        <TouchableOpacity style={styles.peekButton} onPress={onPeekToggle}>
          <Text style={styles.peekButtonText}>Read prompt ↓</Text>
        </TouchableOpacity>

        {/* Header — context label for combat rolls */}
        {rollContext && !requiredRoll && (
          <View style={styles.header}>
            <Text style={styles.checkType}>{rollContext}</Text>
          </View>
        )}

        {/* Header — skill check info */}
        {requiredRoll && (
          <View style={styles.header}>
            <Text style={styles.checkType}>{requiredRoll.skill} Check</Text>
            <View style={styles.headerMeta}>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>DC</Text>
                <Text style={styles.metaValue}>{requiredRoll.dc}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>{requiredRoll.ability}</Text>
                <Text style={styles.metaValue}>{formatMod(mod)}</Text>
              </View>
              {character?.proficientSkills?.includes(requiredRoll.skill) && (
                <View style={[styles.metaPill, styles.profPill]}>
                  <Text style={[styles.metaLabel, { color: COLORS.success }]}>Proficient</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 3D Die */}
        <View style={styles.dieContainer}>
          <Die3D sides={sides} rolling={isRolling} result={result?.die} skin={selectedSkin} />
        </View>

        {/* Advantage / Disadvantage — only shown when a condition or ability grants one */}
        {(hasAdvantage || hasDisadvantage) && (
          <View style={styles.advRow}>
            {hasAdvantage && (
              <TouchableOpacity
                style={[styles.advBtn, advantage && styles.advBtnGreen]}
                onPress={() => { setAdvantage(a => !a); setDisadvantage(false); setResult(null); }}
              >
                <Text style={[styles.advText, advantage && { color: COLORS.success }]}>Advantage</Text>
              </TouchableOpacity>
            )}
            {hasDisadvantage && (
              <TouchableOpacity
                style={[styles.advBtn, disadvantage && styles.advBtnRed]}
                onPress={() => { setDisadvantage(d => !d); setAdvantage(false); setResult(null); }}
              >
                <Text style={[styles.advText, disadvantage && { color: COLORS.diceFumble }]}>Disadvantage</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Result area */}
        {result && (
          <Animated.View style={[styles.resultArea, { opacity: resultAnim, transform: [{ scale: resultAnim }] }]}>
            {result.die2 != null && (
              <Text style={styles.rollPairText}>Rolled {result.die1} & {result.die2} → kept {result.die}</Text>
            )}
            <Text style={[styles.totalText, { color: getResultColor() }]}>
              {result.die}{mod !== 0 ? ` ${formatMod(mod)} = ${result.total}` : ''}
            </Text>
            {badge && (
              <View style={[styles.badgePill, { borderColor: badge.color, backgroundColor: badge.color + '22' }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            )}
            {result.dc != null && (
              <Text style={styles.dcText}>vs DC {result.dc}</Text>
            )}
          </Animated.View>
        )}

        {/* CTA */}
        <View style={styles.ctaRow}>
          {!result ? (
            <TouchableOpacity style={styles.rollBtn} onPress={performRoll} disabled={isRolling}>
              <Text style={styles.rollBtnText}>{isRolling ? 'Rolling...' : `Roll ${DIE_CONFIG[sides]?.label || 'd20'}`}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm & Continue →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reroll option */}
        {result && (
          <TouchableOpacity style={styles.rerollBtn} onPress={performRoll} disabled={isRolling}>
            <Text style={styles.rerollText}>Reroll</Text>
          </TouchableOpacity>
        )}

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 40, paddingHorizontal: SPACING.lg,
    borderTopWidth: 1, borderColor: COLORS.border,
  },

  peekButton: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  peekButtonText: { color: COLORS.textSecondary, fontSize: 12 },

  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md },

  header: { alignItems: 'center', marginBottom: SPACING.md },
  checkType: { color: COLORS.primary, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  headerMeta: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs, flexWrap: 'wrap', justifyContent: 'center' },
  metaPill: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center' },
  profPill: { borderWidth: 1, borderColor: COLORS.success + '55' },
  metaLabel: { color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },

  dieContainer: { alignItems: 'center', justifyContent: 'center', height: 200, marginVertical: SPACING.sm },

  glDieContainer: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  glView: { width: 180, height: 180 },
  dieNumberOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center', top: 0, bottom: 0, left: 0, right: 0 },
  dieNumber: { fontSize: 48, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },

  advRow: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', marginBottom: SPACING.md },
  advBtn: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
  advBtnGreen: { borderColor: COLORS.success, backgroundColor: COLORS.success + '22' },
  advBtnRed: { borderColor: COLORS.diceFumble, backgroundColor: COLORS.diceFumble + '22' },
  advText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  resultArea: { alignItems: 'center', marginBottom: SPACING.md },
  rollPairText: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 2 },
  totalText: { fontSize: 56, fontWeight: '900', lineHeight: 64 },
  badgePill: { borderWidth: 1.5, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 5, marginTop: SPACING.xs },
  badgeText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  dcText: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },

  ctaRow: { marginBottom: SPACING.xs },
  rollBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  rollBtnText: { color: COLORS.background, fontSize: 17, fontWeight: '800' },
  confirmBtn: { backgroundColor: COLORS.success + '33', borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.success },
  confirmBtnText: { color: COLORS.success, fontSize: 17, fontWeight: '700' },
  rerollBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  rerollText: { color: COLORS.textMuted, fontSize: 13 },

  // Peek bar
  peekBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  peekBarInner: { backgroundColor: COLORS.surface, borderTopWidth: 1, borderColor: COLORS.primary + '66', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 14 },
  peekBarText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  peekArrow: { color: COLORS.primary, fontSize: 16 },
});
