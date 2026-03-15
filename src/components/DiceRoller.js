// src/components/DiceRoller.js
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { GLView } from 'expo-gl';
import { Asset } from 'expo-asset';
import { loadAsync } from 'expo-three';
import * as THREE from 'three';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { roll as rollDie, getModifierString as formatMod, getAbilityModifier as getAbilityMod } from '../utils/dice';
import { DiceFaceArt, DiceSetModel } from '../assets';
import { playSfx } from '../utils/sfx';

// ─── Die configs ──────────────────────────────────────────────────────────────
const DIE_CONFIG = {
  4:   { color: '#9B6B9E', label: 'd4'   },
  6:   { color: '#6B8EC9', label: 'd6'   },
  8:   { color: '#6BB89E', label: 'd8'   },
  10:  { color: '#C9986B', label: 'd10'  },
  12:  { color: '#C96B8E', label: 'd12'  },
  20:  { color: '#C9A84C', label: 'd20'  },
  100: { color: '#8EA0C9', label: 'd100' },
};

// ─── Skin colour palettes ─────────────────────────────────────────────────────
const SKIN_PALETTES = {
  default:   null,
  graystone: { accent: '#8A9BAD', glow: '#5C7080', edge: '#99CCEE', num: '#F5F8FF'  },
  obsidian:  { accent: '#9B7FBF', glow: '#6A4E9E', edge: '#CC33FF', num: '#C8A8FF'  },
  dragon:    { accent: '#C94C4C', glow: '#8E2A2A', edge: '#FF1133', num: '#FF7722'  },
  crystal:   { accent: '#4CA8C9', glow: '#1A7FA0', edge: '#00EEFF', num: '#44CCEE'  },
};

// Number inlay colors for the 3D mesh (separate from overlay text — optimised for GL rendering)
const DIE_NUM_COLORS = {
  default:   '#1A1A1A',  // near-black
  graystone: '#F0F6FF',  // snow white
  obsidian:  '#C8A8FF',  // lighter purple
  dragon:    '#FF7722',  // fiery orange-red
  crystal:   '#44CCEE',  // icy blue
};

// ─── Mesh name prefixes per die type ─────────────────────────────────────────
// Each die has two meshes: <prefix>_0 (body) + <prefix>_1 (number inlays).
// Extraction collects all meshes whose name STARTS WITH any prefix in the list.
// Empty array = not in the asset; fall back to procedural geometry.
const DIE_MESH_NAMES = {
  4:   ['Cone', 'cone', 'D4', 'd4'],   // d4 is Cone_0/Cone_1 in this asset
  6:   ['d6',   'D6'],
  8:   ['d8',   'D8'],
  10:  ['d10',  'D10'],
  12:  ['d12',  'D12'],
  20:  ['d20',  'D20'],
  100: [],                              // not in this asset — uses procedural sphere
};

// ─── Module-level GLTF cache — loaded once, shared across all Die3D instances ─
let _diceSetGltf  = null;
let _diceSetLoading = null;

async function getDiceSetGltf() {
  if (_diceSetGltf) return _diceSetGltf;
  if (!DiceSetModel) return null;           // GLB not yet dropped into assets
  if (!_diceSetLoading) {
    _diceSetLoading = loadAsync(DiceSetModel)
      .then(gltf => { _diceSetGltf = gltf; return gltf; })
      .catch(e => { _diceSetLoading = null; throw e; });
  }
  return _diceSetLoading;
}

// Pre-warm: kick off GLB load as soon as this module is imported (not on first roll)
getDiceSetGltf().catch(() => {});

// ─── 3D Die — WebGL mesh via expo-gl + three.js ───────────────────────────────
function Die3D({ sides, rolling, skin = 'default', result = null, onReady }) {
  const cfg     = DIE_CONFIG[sides] || DIE_CONFIG[20];
  const palette = SKIN_PALETTES[skin] || null;
  const color   = palette ? palette.accent : cfg.color;

  const rollingRef    = useRef(rolling);
  const rafRef        = useRef(null);
  const spinRef       = useRef({ x: 0, y: 0, z: 0 });
  const onSettledRef  = useRef(null);
  const revealAnim    = useRef(new Animated.Value(0)).current;

  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => { rollingRef.current = rolling; }, [rolling]);

  // Reset reveal when rolling starts
  useEffect(() => {
    if (rolling) revealAnim.setValue(0);
  }, [rolling]);

  // Reset reveal whenever the die type or skin changes (e.g. attack → damage roll transition)
  useEffect(() => {
    revealAnim.setValue(0);
  }, [sides, skin]);

  // Register settle callback — triggers crossfade to face image
  onSettledRef.current = () => {
    Animated.timing(revealAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  // Cancel any running RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const skinRoughness = () => {
    if (skin === 'obsidian') return 0.1;
    if (skin === 'crystal')  return 0.05;
    if (skin === 'dragon')   return 0.55;
    return 0.45;
  };
  const skinMetalness = () => {
    if (skin === 'obsidian') return 0.6;
    if (skin === 'crystal')  return 0.4;
    if (skin === 'dragon')   return 0.3;
    return 0.15;
  };

  const onContextCreate = useCallback(async (gl) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    // ── Renderer ────────────────────────────────────────────────────────────
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

    // ── Scene & Camera ───────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 100);
    camera.position.z = 3.6;

    // ── Lighting — warm candlelit ────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xfff0d0, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffe8b0, 1.3);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8090cc, 0.35);
    fillLight.position.set(-3, -1, 2);
    scene.add(fillLight);

    // ── Load GLTF dice set, extract the matching die mesh ────────────────────
    let mesh;
    let geometry;

    try {
      const gltf = await getDiceSetGltf();
      if (gltf) {
        const prefixes = DIE_MESH_NAMES[sides];

        if (prefixes && prefixes.length > 0) {
          // Collect ALL meshes whose name starts with a known prefix
          // (_0 = body, _1 = number inlays — both must be included)
          const dieGroup = new THREE.Group();
          let bodyMesh   = null; // _0 mesh — used for geometry/faceUpQuat

          gltf.scene.traverse(child => {
            if (!child.isMesh) return;
            if (prefixes.some(p => child.name.startsWith(p))) {
              const cloned = child.clone();
              dieGroup.add(cloned);
              // The body mesh ends with _0; grab its geometry for physics/glow
              if (!bodyMesh && child.name.endsWith('_0')) bodyMesh = cloned;
            }
          });

          if (dieGroup.children.length > 0) {
            mesh     = dieGroup;
            geometry = (bodyMesh || dieGroup.children[0]).geometry;

            // Auto-centre and scale to fill the 180×180 GLView
            const box    = new THREE.Box3().setFromObject(dieGroup);
            const size   = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale  = 2.6 / maxDim;
            const centre = box.getCenter(new THREE.Vector3());
            dieGroup.scale.setScalar(scale);
            dieGroup.position.set(
              -centre.x * scale,
              -centre.y * scale,
              -centre.z * scale,
            );
            scene.add(dieGroup);
          }
        }
      }
    } catch (e) {
      console.warn('[DiceRoller] GLB load failed, using procedural fallback:', e?.message);
    }

    // ── Procedural fallback (no GLB or mesh not found) ───────────────────────
    if (!mesh) {
      let geo;
      switch (sides) {
        case 4:   geo = new THREE.TetrahedronGeometry(1.4, 0); break;
        case 6:   geo = new THREE.BoxGeometry(1.7, 1.7, 1.7); break;
        case 8:   geo = new THREE.OctahedronGeometry(1.45, 0); break;
        case 12:  geo = new THREE.DodecahedronGeometry(1.3, 0); break;
        case 100: geo = new THREE.SphereGeometry(1.2, 14, 14); break;
        default:  geo = new THREE.IcosahedronGeometry(1.38, 0);
      }
      geometry = geo;
      mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: parseInt(color.replace('#', ''), 16),
        roughness: skinRoughness(), metalness: skinMetalness(),
      }));
      scene.add(mesh);
    }

    // ── Apply skin material ──────────────────────────────────────────────────
    // Body meshes (_0) get the skin color/texture.
    // Number inlay meshes (_1) keep the GLB's original material so numbers stay visible.
    if (mesh) {
      let bodyMat = null;
      const faceArtKey = skin === 'default' ? 'classic' : skin;
      const faceSource = DiceFaceArt?.[faceArtKey];
      if (faceSource) {
        try {
          const asset = Asset.fromModule(faceSource);
          await asset.downloadAsync();
          const loaded = await loadAsync(asset.localUri);
          if (loaded?.isTexture) {
            bodyMat = new THREE.MeshStandardMaterial({
              map: loaded, roughness: skinRoughness(), metalness: skinMetalness(),
            });
          }
        } catch (_) {}
      }
      const isGlass = skin === 'obsidian' || skin === 'crystal';
      if (!bodyMat) {
        bodyMat = new THREE.MeshStandardMaterial({
          color: parseInt(color.replace('#', ''), 16),
          roughness: skinRoughness(), metalness: skinMetalness(),
          transparent: isGlass,
          opacity: skin === 'obsidian' ? 0.72 : skin === 'crystal' ? 0.60 : 1.0,
        });
      }

      // Number inlay meshes (_1) — per-skin color
      const numColorStr = DIE_NUM_COLORS[skin] || DIE_NUM_COLORS.default;
      const numHex = parseInt(numColorStr.replace('#', ''), 16);
      const numMat = new THREE.MeshStandardMaterial({
        color: numHex,
        emissive: numHex,
        emissiveIntensity: skin === 'default' ? 0 : 0.55,
        roughness: 0.2,
        metalness: skin === 'default' ? 0 : 0.1,
      });

      const applyMaterial = (obj) => {
        if (obj.isMesh) {
          obj.material = obj.name.endsWith('_1') ? numMat : bodyMat;
        }
        obj.children?.forEach(applyMaterial);
      };
      applyMaterial(mesh);
    }

    // ── Per-face edge glow — 4-layer neon bloom ──────────────────────────────
    const neonHex  = parseInt((palette?.edge || color).replace('#', ''), 16);
    const edgeGeo  = geometry ? new THREE.EdgesGeometry(geometry, 1) : null;
    const edgeGroup = new THREE.Group();
    if (edgeGeo) {
      for (const { scale: s, opacity } of [
        { scale: 1.038, opacity: 0.12 },
        { scale: 1.025, opacity: 0.32 },
        { scale: 1.012, opacity: 0.68 },
        { scale: 1.000, opacity: 1.00 },
      ]) {
        const lines = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: neonHex, transparent: true, opacity }),
        );
        lines.scale.setScalar(s);
        edgeGroup.add(lines);
      }
    }
    scene.add(edgeGroup);

    // ── Helper: rotate nearest face to face camera AND orient it right-side-up ─
    function faceUpQuat(currentQuat) {
      if (!geometry?.attributes?.normal) return currentQuat;
      const normals   = geometry.attributes.normal;
      const positions = geometry.attributes.position;
      const camDir    = new THREE.Vector3(0, 0, 1);

      // Step 1: find the face whose normal is most aligned with the camera
      let bestDot = -Infinity;
      let bestFaceIdx = 0;
      const bestN = new THREE.Vector3();
      for (let i = 0; i < normals.count; i += 3) {
        const fn = new THREE.Vector3(
          normals.getX(i), normals.getY(i), normals.getZ(i),
        ).normalize().applyQuaternion(currentQuat);
        const d = fn.dot(camDir);
        if (d > bestDot) { bestDot = d; bestN.copy(fn); bestFaceIdx = i; }
      }

      // Step 2: rotate that face's normal to point straight at camera
      const q1 = new THREE.Quaternion().setFromUnitVectors(bestN, camDir)
        .multiply(currentQuat);

      // Step 3: find the "up" of this face — whichever of the 3 triangle
      // vertices is highest in Y after q1 is applied, defines the face-up edge
      let topY = -Infinity;
      let faceUpDir = new THREE.Vector3(0, 1, 0);
      const faceCentre = new THREE.Vector3();
      for (let k = 0; k < 3; k++) {
        const v = new THREE.Vector3(
          positions.getX(bestFaceIdx + k),
          positions.getY(bestFaceIdx + k),
          positions.getZ(bestFaceIdx + k),
        ).applyQuaternion(q1);
        faceCentre.add(v);
        if (v.y > topY) { topY = v.y; faceUpDir.copy(v); }
      }
      faceCentre.divideScalar(3);
      // Direction from face centre to its topmost vertex, projected onto XY
      faceUpDir.sub(faceCentre);
      faceUpDir.z = 0;
      if (faceUpDir.lengthSq() > 0.0001) {
        faceUpDir.normalize();
        // Step 4: rotate around Z to align faceUpDir with world up (0,1,0)
        const q2 = new THREE.Quaternion().setFromUnitVectors(
          faceUpDir, new THREE.Vector3(0, 1, 0),
        );
        return q2.multiply(q1);
      }
      return q1;
    }

    // Start face-forward
    const initQ = faceUpQuat(new THREE.Quaternion());
    mesh.quaternion.copy(initQ);
    edgeGroup.quaternion.copy(initQ);

    // ── Render loop ──────────────────────────────────────────────────────────
    const spin = spinRef.current;
    spin.x = 0; spin.y = 0; spin.z = 0;
    let prevRolling  = false;
    let isSettling   = false;
    const targetQuat = new THREE.Quaternion().copy(initQ);

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const nowRolling = rollingRef.current;

      if (!prevRolling && nowRolling) {
        isSettling = false;
        // Kick off with a fast throw — velocity decays each frame
        spin.x = 0.18; spin.y = 0.26; spin.z = 0.09;
      }
      if (prevRolling && !nowRolling) {
        spin.x = 0; spin.y = 0; spin.z = 0;
        isSettling = true;
        targetQuat.copy(faceUpQuat(mesh.quaternion));
        onSettledRef.current?.(); // fire reveal immediately as die stops — crossfade covers the brief settle
      }
      prevRolling = nowRolling;

      if (nowRolling) {
        // Exponential decay: starts fast, smoothly decelerates to near-stop
        spin.x *= 0.974;
        spin.y *= 0.974;
        spin.z *= 0.974;
        const dq = new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(spin.x, spin.y, spin.z));
        mesh.quaternion.multiplyQuaternions(dq, mesh.quaternion);
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

      renderer.render(scene, camera);
      gl.endFrameEXP();
      // Signal ready after the very first rendered frame
      if (onReadyRef.current) { onReadyRef.current(); onReadyRef.current = null; }
    };
    animate();
  }, [skin, sides]); // re-create GL context when skin or die type changes

  const faceArtKey = skin === 'default' ? 'classic' : skin;
  const faceSource = DiceFaceArt?.[faceArtKey];
  const numColor   = palette?.num || '#FFFFFF';
  const edgeColor  = palette?.edge || color;

  return (
    <View style={styles.glDieContainer}>
      {/* 3D die — always rendering so GPU never suspends it */}
      <GLView
        key={`${skin}-${sides}`}
        style={styles.glView}
        onContextCreate={onContextCreate}
      />

      {/* Face image reveal — fades in over the die on settle */}
      <Animated.View style={[styles.revealOverlay, { opacity: revealAnim }]} pointerEvents="none">
        {faceSource ? (
          <Image source={faceSource} style={styles.faceImage} resizeMode="cover" />
        ) : (
          <View style={[styles.faceCircle, { backgroundColor: color + '33', borderColor: color }]} />
        )}
        {result?.die != null && (
          <Text style={[
            styles.revealNum,
            { color: numColor, textShadowColor: edgeColor },
            skin === 'crystal' && { textShadowColor: '#003355', textShadowRadius: 4 },
          ]}>
            {result.die}
          </Text>
        )}
      </Animated.View>
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
  const [rerollsLeft, setRerollsLeft] = useState(2);

  const resultAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim  = useRef(new Animated.Value(0)).current;
  const [glReady, setGlReady] = useState(false);

  // Sheet slides in only once Die3D signals its first frame is rendered
  useEffect(() => {
    if (!visible) {
      setGlReady(false);
      Animated.spring(sheetAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && glReady) {
      Animated.spring(sheetAnim, { toValue: 1, tension: 60, friction: 12, useNativeDriver: true }).start();
    }
  }, [visible, glReady]);

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
    if (!requiredRoll) return 0;
    // If modifier was pre-computed (from action chip skill check), use it directly
    if (requiredRoll.modifier != null) return requiredRoll.modifier;
    if (!character) return 0;
    const abilityScore = character.abilityScores?.[requiredRoll.ability] || 10;
    const baseMod = getAbilityMod(abilityScore);
    const isProficient = character.proficientSkills?.includes(requiredRoll.skill);
    return baseMod + (isProficient ? (character.proficiencyBonus || 2) : 0);
  }, [character, requiredRoll]);

  const performRoll = useCallback((isReroll = false) => {
    if (isRolling) return;
    if (isReroll && rerollsLeft <= 0) return;
    if (isReroll) setRerollsLeft(n => n - 1);
    setIsRolling(true);
    setResult(null);
    resultAnim.setValue(0);
    playSfx('dice_roll');

    setTimeout(() => {
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
      const total    = finalDie + modifier;
      const dc       = requiredRoll?.dc;
      const success  = dc != null ? total >= dc : null;
      const isAttackRoll = !!(rollContext && /attack|spell/i.test(rollContext));
      const isSkillCheck = !!requiredRoll;
      const isInitiativeOrDamage = !!(rollContext && /initiative|damage/i.test(rollContext));
      const isCrit   = sides === 20 && finalDie === 20 && isAttackRoll;
      const isFumble = sides === 20 && finalDie === 1  && (isAttackRoll || isSkillCheck) && !isInitiativeOrDamage;

      const rollResult = { die: finalDie, die1, die2, modifier, total, dc, success, isCrit, isFumble, sides };
      setResult(rollResult);
      setIsRolling(false);

      // Play pass/fail variant for skill checks and attack/spell rolls only.
      // Initiative and damage rolls get the success sound as neutral feedback.
      const isApplicable = isSkillCheck || isAttackRoll;
      if (isApplicable && (isFumble || success === false)) {
        playSfx('dice_land_fail');
      } else {
        playSfx('dice_land_success');
      }

      Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    }, 1200);
  }, [isRolling, sides, advantage, disadvantage, requiredRoll, getModifier]);

  const handleConfirm = useCallback(() => {
    if (result) onRollComplete?.(result);
    setResult(null);
  }, [result, onRollComplete]);

  const getResultColor = () => {
    if (!result) return COLORS.textPrimary;
    if (result.isCrit)           return COLORS.diceCrit;
    if (result.isFumble)         return COLORS.diceFumble;
    if (result.success === true)  return COLORS.success;
    if (result.success === false) return COLORS.hpLow;
    return COLORS.primaryLight;
  };

  const getResultBadge = () => {
    if (!result) return null;
    if (result.isCrit)           return { label: 'CRITICAL HIT',  color: COLORS.diceCrit };
    if (result.isFumble)         return { label: 'CRITICAL FAIL', color: COLORS.diceFumble };
    if (result.success === true)  return { label: 'SUCCESS',       color: COLORS.success };
    if (result.success === false) return { label: 'FAILURE',       color: COLORS.hpLow };
    return null;
  };

  const slideY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const badge  = getResultBadge();
  const mod    = getModifier();

  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      {/* Peek bar — visible only when peeking */}
      {isPeeking && (
        <Animated.View style={[styles.peekBar, { transform: [{ translateY: slideY }] }]}>
          <TouchableOpacity style={styles.peekBarInner} onPress={onPeekToggle}>
            <Text style={styles.peekBarText}>
              {requiredRoll ? `${requiredRoll.skill} Check · DC ${requiredRoll.dc}` : (rollContext || 'Roll')} — tap to roll
            </Text>
            <Text style={styles.peekArrow}>↑</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Full sheet — hidden via pointer-events + opacity when peeking, but Die3D stays mounted */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }], opacity: isPeeking ? 0 : 1 }]}
        pointerEvents={isPeeking ? 'none' : 'auto'}>

        {/* Handle */}
        <View style={styles.handle} />

        {/* Top bar: title left, collapse button right */}
        <View style={styles.topBar}>
          <View style={styles.topBarTitle}>
            {rollContext && !requiredRoll && (
              <Text style={styles.checkType}>{rollContext}</Text>
            )}
            {requiredRoll && (
              <>
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
              </>
            )}
          </View>
          <TouchableOpacity style={styles.peekButton} onPress={onPeekToggle}>
            <Text style={styles.peekButtonText}>⌄</Text>
          </TouchableOpacity>
        </View>

        {/* 3D Die */}
        <View style={styles.dieContainer}>
          <Die3D sides={sides} rolling={isRolling} skin={selectedSkin} result={result} onReady={() => setGlReady(true)} />
        </View>

        {/* Advantage / Disadvantage — only shown when a condition grants one */}
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

        {/* Result row — equation centered, reroll right — fixed height */}
        <View style={styles.resultRow}>
          <Animated.View style={[styles.resultArea, { opacity: result ? resultAnim : 0, transform: [{ scale: result ? resultAnim : 1 }] }]}>
            {result?.die2 != null && (
              <Text style={styles.rollPairText}>Rolled {result.die1} & {result.die2} → kept {result.die}</Text>
            )}
            {/* Equation: base roll, optional modifier parts, then total */}
            <View style={styles.equationRow}>
              {result && mod !== 0 ? (
                <>
                  <Text style={[styles.eqBase, { color: getResultColor() }]}>{result.die}</Text>
                  <Text style={styles.eqMod}>{formatMod(mod)}</Text>
                  <Text style={[styles.eqTotal, { color: getResultColor() }]}>= {result.total}</Text>
                </>
              ) : (
                <Text style={[styles.eqTotal, { color: getResultColor() }]}>{result?.die ?? ' '}</Text>
              )}
            </View>
            {badge && (
              <View style={[styles.badgePill, { borderColor: badge.color, backgroundColor: badge.color + '22' }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            )}

          </Animated.View>

          {/* Reroll — right side of result row */}
          <TouchableOpacity
            style={[styles.rerollBtn, { opacity: result && !isRolling ? (rerollsLeft > 0 ? 1 : 0.35) : 0 }]}
            onPress={() => performRoll(true)}
            disabled={!result || isRolling || rerollsLeft <= 0}
          >
            <Text style={styles.rerollText}>↻</Text>
            <View style={styles.rerollBadge}>
              <Text style={styles.rerollBadgeText}>×{rerollsLeft}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <View style={styles.ctaRow}>
          {!result ? (
            <TouchableOpacity style={styles.rollBtn} onPress={performRoll} disabled={isRolling}>
              <Text style={styles.rollBtnText}>{isRolling ? 'Rolling...' : `Roll ${DIE_CONFIG[sides]?.label || 'd20'}`}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Continue →</Text>
            </TouchableOpacity>
          )}
        </View>

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

  topBar: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: SPACING.sm,
  },
  topBarTitle: { flex: 1, paddingRight: SPACING.sm },

  peekButton: {
    width: 32, height: 32,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  peekButtonText: { color: COLORS.textSecondary, fontSize: 18, lineHeight: 20, marginTop: -2 },

  handle: {
    width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2,
    alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md,
  },

  header: { alignItems: 'center', marginBottom: SPACING.md },
  checkType: { color: COLORS.primary, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  headerMeta: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs, flexWrap: 'wrap', justifyContent: 'center' },
  metaPill: {
    backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.pill,
    paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center',
  },
  profPill: { borderWidth: 1, borderColor: COLORS.success + '55' },
  metaLabel: { color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },

  dieContainer: { alignItems: 'center', justifyContent: 'center', height: 240, marginTop: 4, marginBottom: 0 },

  glDieContainer: { width: 225, height: 225, alignItems: 'center', justifyContent: 'center' },
  glView: { width: 225, height: 225 },

  revealOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  faceImage: {
    width: 225, height: 225, borderRadius: 113,
  },
  faceCircle: {
    width: 225, height: 225, borderRadius: 113,
    borderWidth: 2,
  },
  revealNum: {
    position: 'absolute',
    fontSize: 72, fontWeight: '900', letterSpacing: -2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },

  advRow: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', marginBottom: SPACING.md },
  advBtn: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
  advBtnGreen: { borderColor: COLORS.success, backgroundColor: COLORS.success + '22' },
  advBtnRed:   { borderColor: COLORS.diceFumble, backgroundColor: COLORS.diceFumble + '22' },
  advText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  resultRow: {
    minHeight: 80, marginBottom: SPACING.md,
    justifyContent: 'center', alignItems: 'center',
  },
  resultArea: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  rollPairText: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 2 },
  totalText: { fontSize: 56, fontWeight: '900', lineHeight: 64 },

  equationRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  eqBase:  { fontSize: 44, fontWeight: '900', lineHeight: 52 },
  eqMod:   { fontSize: 26, fontWeight: '700', color: COLORS.textSecondary, lineHeight: 52 },
  eqTotal: { fontSize: 44, fontWeight: '900', lineHeight: 52 },
  badgePill: { borderWidth: 1.5, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 5, marginTop: SPACING.xs },
  badgeText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  dcText: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },

  ctaRow: { marginBottom: SPACING.xs },
  rollBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  rollBtnText: { color: COLORS.background, fontSize: 17, fontWeight: '800' },
  confirmBtn: {
    backgroundColor: COLORS.success + '33', borderRadius: RADIUS.md,
    paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.success,
  },
  confirmBtnText: { color: COLORS.success, fontSize: 17, fontWeight: '700' },
  rerollBtn: { position: 'absolute', right: 0, alignSelf: 'center' },
  rerollText: { color: COLORS.primary, fontSize: 48, lineHeight: 52 },
  rerollBadge: {
    position: 'absolute', bottom: -2, right: -6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rerollBadgeText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  successLabel: {
    position: 'absolute', color: COLORS.success,
    fontSize: 22, fontWeight: '900', letterSpacing: 0.5,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  failureLabel: {
    position: 'absolute', color: COLORS.hpLow,
    fontSize: 22, fontWeight: '900', letterSpacing: 0.5,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },

  // Peek bar
  peekBar: { position: 'absolute', bottom: 52, left: 16, right: 16, borderRadius: 14, overflow: 'hidden' },
  peekBarInner: {
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderColor: COLORS.primary + '66',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
  },
  peekBarText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  peekArrow: { color: COLORS.primary, fontSize: 16 },
});
