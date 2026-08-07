import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { EnemyDefinition, EnemyPresentation, GameSettings, ScreenId } from '../game/types';

type MaterialTier = 'bronze' | 'iron' | 'steel' | 'none';
type ArmorTier = MaterialTier | 'mixed';

interface ThreeSceneProps {
  screen: ScreenId;
  settings: GameSettings;
  theme?: string;
  enemyTheme?: EnemyDefinition['theme'];
  enemyPresentation?: EnemyPresentation;
  combatActive?: boolean;
  playerWeaponTier?: MaterialTier;
  playerShieldTier?: MaterialTier;
  playerArmorTier?: ArmorTier;
  playerHasHelmet?: boolean;
  playerHasBodyArmor?: boolean;
  playerHasLegArmor?: boolean;
  playerHasShield?: boolean;
  miningTheme?: string;
  miningStage?: number;
}

const material = (color: string, roughness = 0.72, metalness = 0.12): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const tierColor = (tier: MaterialTier): string =>
  tier === 'steel'
    ? '#d9e3df'
    : tier === 'iron'
      ? '#aebbb7'
      : tier === 'bronze'
        ? '#c08a55'
        : '#3c4a4d';

const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose());
    else child.material.dispose();
  });
};

const addCombatEnvironment = (group: THREE.Group, accent: string): void => {
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.5, 0.22, 10),
    material('#182025', 0.95),
  );
  ground.position.y = -1.5;
  group.add(ground);
  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.025, 2.35),
    material('#8c7652', 0.62, 0.2),
  );
  centerLine.position.set(0, -1.36, 0.12);
  group.add(centerLine);
  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.045, 1.45),
      material(side < 0 ? '#263b3c' : '#3c2d2d', 0.92),
    );
    pad.position.set(side * 1.25, -1.37, 0.12);
    group.add(pad);
    const mark = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.022, 5, 20),
      material(side < 0 ? '#527d72' : accent, 0.75, 0.25),
    );
    mark.rotation.x = Math.PI / 2;
    mark.position.set(side * 1.25, -1.33, 0.12);
    group.add(mark);
  }
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.045, 6, 36),
    material(accent, 0.7, 0.35),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -1.36;
  group.add(rim);
  const accentMaterial = material(accent, 0.56, 0.3);
  if (accent === '#b58b53') {
    for (const x of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.18), material('#4a3027'));
      post.position.set(x, -0.82, -0.35);
      group.add(post);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), accentMaterial);
      cap.position.set(x, -0.28, -0.35);
      group.add(cap);
    }
  } else if (accent === '#c67b53') {
    for (const x of [-2.2, 2.25]) {
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.25, 5), accentMaterial);
      crystal.position.set(x, -0.78, -0.25);
      crystal.rotation.z = x < 0 ? -0.18 : 0.15;
      group.add(crystal);
    }
  } else {
    for (const x of [-2.25, 2.2]) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, 1.6, 5),
        material('#293032'),
      );
      trunk.position.set(x, -0.65, -0.42);
      trunk.rotation.z = x < 0 ? -0.2 : 0.2;
      group.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), material('#334749'));
      crown.position.set(x + (x < 0 ? 0.22 : -0.18), 0.2, -0.42);
      group.add(crown);
    }
  }
};

interface MiningPalette {
  rock: string;
  inner: string;
  accent: string;
  glow: string;
}

const getMiningPalette = (theme: string): MiningPalette => {
  if (theme === 'iron')
    return { rock: '#3c4143', inner: '#8d5a42', accent: '#b0734e', glow: '#9b6145' };
  if (theme === 'coal')
    return { rock: '#282d31', inner: '#687477', accent: '#9ba5a0', glow: '#657478' };
  return { rock: '#697477', inner: '#a8b0ad', accent: '#b99a69', glow: '#819092' };
};

const addMiningScene = (group: THREE.Group, theme: string, stage: number): string => {
  const palette = getMiningPalette(theme);
  const depth = Math.max(0, Math.min(4, Math.floor(stage))) / 4;
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.9, 0.26, 8),
    material('#1c252a', 0.9),
  );
  ground.position.y = -1.45;
  group.add(ground);

  const shell = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.22, 1),
    material(palette.rock, 0.93, 0.04),
  );
  shell.position.y = 0.25;
  shell.rotation.set(0.1, 0.2, -0.08);
  group.add(shell);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.62 + depth * 0.16, 1),
    material(palette.inner, 0.58, theme === 'coal' ? 0.24 : 0.2),
  );
  core.position.set(0, 0.27, 0.2);
  core.scale.setScalar(0.55 + depth * 0.35);
  group.add(core);

  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2 + 0.35;
    const vein = new THREE.Mesh(
      new THREE.ConeGeometry(0.12 + depth * 0.04, 0.56 + depth * 0.2, 5),
      material(palette.accent, 0.52, theme === 'coal' ? 0.35 : 0.28),
    );
    vein.position.set(Math.cos(angle) * 0.56, -0.03 + depth * 0.1, Math.sin(angle) * 0.56);
    vein.rotation.set(0.25, angle, -0.2);
    group.add(vein);
  }
  return palette.glow;
};

interface PlayerVisualOptions {
  weaponTier: MaterialTier;
  shieldTier: MaterialTier;
  armorTier: ArmorTier;
  hasHelmet: boolean;
  hasBodyArmor: boolean;
  hasLegArmor: boolean;
}

const addWeapon = (equipment: THREE.Group, tier: MaterialTier): void => {
  if (tier === 'none') return;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.92, 0.1),
    material(tierColor(tier), 0.3, 0.7),
  );
  blade.position.set(0.58, -0.16, 0.12);
  blade.rotation.z = -0.55;
  equipment.add(blade);
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.055, 0.12),
    material('#5c4636', 0.55, 0.45),
  );
  guard.position.set(0.38, -0.56, 0.12);
  guard.rotation.z = -0.55;
  equipment.add(guard);
};

const addShield = (equipment: THREE.Group, tier: MaterialTier): void => {
  if (tier === 'none') return;
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8),
    material(tierColor(tier), 0.55, 0.35),
  );
  shield.rotation.x = Math.PI / 2;
  shield.position.set(-0.52, -0.22, 0.18);
  equipment.add(shield);
};

const addArmor = (equipment: THREE.Group, options: PlayerVisualOptions): void => {
  const tier = options.armorTier === 'mixed' ? 'iron' : options.armorTier;
  const armor = tier === 'none' ? '#526165' : tierColor(tier);
  if (options.hasBodyArmor) {
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.65, 0.48),
      material(armor, 0.58, 0.4),
    );
    chest.position.set(0, -0.23, 0);
    equipment.add(chest);
  }
  if (options.hasHelmet) {
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.42),
      material(armor, 0.48, 0.48),
    );
    helmet.position.set(0, 0.52, 0);
    equipment.add(helmet);
  }
  if (options.hasLegArmor) {
    for (const x of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.7, 0.2),
        material(armor, 0.62, 0.35),
      );
      leg.position.set(x, -0.98, 0);
      equipment.add(leg);
    }
  }
};

const updatePlayerEquipment = (player: THREE.Group, options: PlayerVisualOptions): void => {
  const previous = player.getObjectByName('equipment-visuals');
  if (previous) {
    player.remove(previous);
    disposeObject(previous);
  }
  const equipment = new THREE.Group();
  equipment.name = 'equipment-visuals';
  addArmor(equipment, options);
  addWeapon(equipment, options.weaponTier);
  addShield(equipment, options.shieldTier);
  player.add(equipment);
};

const addPlayer = (group: THREE.Group, options: PlayerVisualOptions): THREE.Group => {
  const player = new THREE.Group();
  player.name = 'combat-player';
  player.position.set(-1.35, 0, 0.15);
  const skin = material('#b88d72', 0.85);
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 0.82, 6),
    material('#41565b', 0.76, 0.12),
  );
  torso.position.y = -0.25;
  player.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 0.38;
  player.add(head);
  player.userData.idleAnimation = 'player';
  updatePlayerEquipment(player, options);
  group.add(player);
  return player;
};

const addRat = (
  enemy: THREE.Group,
  bodyMaterial: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
): void => {
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), bodyMaterial);
  body.scale.set(1.35, 0.72, 0.8);
  body.position.y = -0.35;
  enemy.add(body);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.58, 6), bodyMaterial);
  head.rotation.z = -Math.PI / 2;
  head.position.set(0.55, -0.05, 0);
  enemy.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 5), bodyMaterial);
    ear.position.set(0.42, 0.25, side * 0.19);
    enemy.add(ear);
  }
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.65, -0.35, 0),
    new THREE.Vector3(-1.05, 0.05, 0),
    new THREE.Vector3(-1.18, 0.48, 0),
  ]);
  enemy.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 8, 0.045, 5, false), bodyMaterial));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), dark);
  eye.position.set(0.78, 0.02, 0.14);
  enemy.add(eye);
};

const addGoblin = (
  enemy: THREE.Group,
  bodyMaterial: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
): void => {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 0.9, 6), bodyMaterial);
  body.position.y = -0.35;
  enemy.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), bodyMaterial);
  head.scale.set(0.9, 1.1, 0.85);
  head.position.y = 0.42;
  enemy.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), bodyMaterial);
    ear.rotation.z = side * -0.9;
    ear.position.set(side * 0.34, 0.48, 0);
    enemy.add(ear);
  }
  const scrap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1), dark);
  scrap.position.set(-0.54, -0.18, 0.14);
  scrap.rotation.z = 0.6;
  enemy.add(scrap);
};

const addBat = (
  enemy: THREE.Group,
  bodyMaterial: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
): void => {
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), bodyMaterial);
  body.position.y = 0.05;
  enemy.add(body);
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(side * 0.85, 0.22);
    shape.lineTo(side * 0.62, -0.28);
    shape.lineTo(side * 0.25, -0.08);
    shape.closePath();
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), bodyMaterial);
    wing.position.y = 0.08;
    enemy.add(wing);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), dark);
  eye.position.set(0.18, 0.12, 0.25);
  enemy.add(eye);
};

const addCrab = (enemy: THREE.Group, bodyMaterial: THREE.MeshStandardMaterial): void => {
  const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), bodyMaterial);
  shell.scale.set(1.3, 0.68, 0.92);
  shell.position.y = -0.2;
  enemy.add(shell);
  for (const side of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), bodyMaterial);
    claw.position.set(side * 0.78, -0.12, 0.12);
    enemy.add(claw);
    for (const z of [-0.28, 0.28]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.08), bodyMaterial);
      leg.position.set(side * 0.48, -0.42, z);
      leg.rotation.z = side * 0.3;
      enemy.add(leg);
    }
  }
};

const addWolf = (enemy: THREE.Group, bodyMaterial: THREE.MeshStandardMaterial): void => {
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), bodyMaterial);
  body.scale.set(1.45, 0.75, 0.7);
  body.position.y = -0.3;
  enemy.add(body);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 5), bodyMaterial);
  head.rotation.z = -Math.PI / 2;
  head.position.set(0.65, 0.05, 0);
  enemy.add(head);
  for (const x of [-0.35, 0.35]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.16), bodyMaterial);
    leg.position.set(x, -0.92, 0);
    enemy.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 5), bodyMaterial);
  tail.position.set(-0.8, 0.08, 0);
  tail.rotation.z = Math.PI / 2.8;
  enemy.add(tail);
};

const addBandit = (
  enemy: THREE.Group,
  bodyMaterial: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
): void => {
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.15, 5), dark);
  cloak.position.y = -0.35;
  enemy.add(cloak);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), bodyMaterial);
  head.position.y = 0.48;
  enemy.add(head);
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.35), bodyMaterial);
  shoulder.position.y = 0.05;
  enemy.add(shoulder);
  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.85, 0.1),
    material('#c0c7c4', 0.3, 0.7),
  );
  weapon.position.set(-0.58, -0.18, 0.14);
  weapon.rotation.z = 0.5;
  enemy.add(weapon);
};

const addEnemy = (group: THREE.Group, presentation: EnemyPresentation): THREE.Group => {
  const enemy = new THREE.Group();
  enemy.name = 'combat-enemy';
  enemy.position.set(1.35, 0, 0.1);
  enemy.scale.setScalar(presentation.scale);
  enemy.userData.idleAnimation = presentation.idleAnimation;
  const bodyMaterial = material(
    presentation.primaryColor,
    0.78,
    presentation.archetype === 'crab' ? 0.42 : 0.08,
  );
  const dark = material(presentation.secondaryColor, 0.92, 0.02);
  if (presentation.archetype === 'rat') addRat(enemy, bodyMaterial, dark);
  if (presentation.archetype === 'goblin') addGoblin(enemy, bodyMaterial, dark);
  if (presentation.archetype === 'bat') addBat(enemy, bodyMaterial, dark);
  if (presentation.archetype === 'crab') addCrab(enemy, bodyMaterial);
  if (presentation.archetype === 'wolf') addWolf(enemy, bodyMaterial);
  if (presentation.archetype === 'bandit') addBandit(enemy, bodyMaterial, dark);
  group.add(enemy);
  return enemy;
};

const fallbackPresentation = (theme: EnemyDefinition['theme']): EnemyPresentation => ({
  archetype: theme === 'rodent' ? 'rat' : theme,
  primaryColor: '#8b7464',
  secondaryColor: '#302b2c',
  scale: 1,
  idleAnimation: 'hunch',
  attackAnimation: 'swipe',
});

interface VisualState {
  updatePlayer: (options: PlayerVisualOptions) => void;
}

export function ThreeScene({
  screen,
  settings,
  theme = '#b58b53',
  enemyTheme = 'rodent',
  enemyPresentation,
  combatActive = false,
  playerWeaponTier = 'none',
  playerShieldTier = 'none',
  playerArmorTier = 'none',
  playerHasHelmet = false,
  playerHasBodyArmor = false,
  playerHasLegArmor = false,
  playerHasShield = false,
  miningTheme = 'stone',
  miningStage = 0,
}: ThreeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualRef = useRef<VisualState | null>(null);
  const combatActiveRef = useRef(combatActive);
  const initialPlayerOptions = useRef<PlayerVisualOptions>({
    weaponTier: playerWeaponTier,
    shieldTier: playerHasShield
      ? playerShieldTier === 'none'
        ? 'bronze'
        : playerShieldTier
      : 'none',
    armorTier: playerArmorTier,
    hasHelmet: playerHasHelmet,
    hasBodyArmor: playerHasBodyArmor,
    hasLegArmor: playerHasLegArmor,
  });
  useEffect(() => {
    combatActiveRef.current = combatActive;
  }, [combatActive]);
  useEffect(() => {
    const options: PlayerVisualOptions = {
      weaponTier: playerWeaponTier,
      shieldTier: playerHasShield
        ? playerShieldTier === 'none'
          ? 'bronze'
          : playerShieldTier
        : 'none',
      armorTier: playerArmorTier,
      hasHelmet: playerHasHelmet,
      hasBodyArmor: playerHasBodyArmor,
      hasLegArmor: playerHasLegArmor,
    };
    initialPlayerOptions.current = options;
    visualRef.current?.updatePlayer(options);
  }, [
    playerWeaponTier,
    playerShieldTier,
    playerArmorTier,
    playerHasHelmet,
    playerHasBodyArmor,
    playerHasLegArmor,
    playerHasShield,
  ]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || settings.threeQuality === 'off') {
      visualRef.current = null;
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: settings.threeQuality === 'high',
      });
    } catch {
      visualRef.current = null;
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0.55, 7);
    camera.lookAt(0, -0.25, 0);
    const group = new THREE.Group();
    scene.add(group);
    let sceneAccent = theme;
    let playerModel: THREE.Group | null = null;
    let enemyModel: THREE.Group | null = null;
    if (screen === 'combat') {
      addCombatEnvironment(group, theme);
      playerModel = addPlayer(group, initialPlayerOptions.current);
      enemyModel = addEnemy(group, enemyPresentation ?? fallbackPresentation(enemyTheme));
      visualRef.current = {
        updatePlayer: (options) => playerModel && updatePlayerEquipment(playerModel, options),
      };
    } else if (screen === 'mining') {
      sceneAccent = addMiningScene(group, miningTheme, miningStage);
      visualRef.current = null;
    } else {
      const color = new THREE.Color(theme);
      const ground = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.9, 0.26, 8),
        material('#1c252a', 0.9),
      );
      ground.position.y = -1.45;
      group.add(ground);
      const object = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.9, 0),
        material(color.getStyle()),
      );
      object.position.y = 0.3;
      group.add(object);
      visualRef.current = null;
    }
    scene.add(new THREE.AmbientLight('#a8b4b5', screen === 'combat' ? 1.8 : 1.5));
    const light = new THREE.PointLight(
      new THREE.Color(sceneAccent),
      screen === 'combat' ? 14 : 11,
      12,
    );
    light.position.set(0, 3, 3);
    scene.add(light);
    const resize = () => {
      const width = canvas.clientWidth || 300;
      const height = canvas.clientHeight || 200;
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, settings.threeQuality === 'high' ? 1.5 : 1),
      );
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const delta = Math.min(60, now - previous);
      previous = now;
      if (!document.hidden && !settings.reducedMotion) {
        if (screen === 'combat' && playerModel && enemyModel) {
          playerModel.position.y = Math.sin(now * 0.0024) * 0.025;
          playerModel.position.x = combatActiveRef.current
            ? -1.35 + Math.max(0, Math.sin(now * 0.004)) * 0.12
            : -1.35;
          const motion = enemyModel.userData.idleAnimation as string;
          enemyModel.position.y =
            motion === 'hover'
              ? Math.sin(now * 0.003) * 0.15
              : Math.sin(now * 0.0024 + 1.2) * (motion === 'heavy' ? 0.018 : 0.04);
          if (motion === 'scurry') enemyModel.rotation.z = Math.sin(now * 0.005) * 0.035;
          if (motion === 'alert') enemyModel.rotation.y = Math.sin(now * 0.002) * 0.06;
          if (motion === 'stride')
            enemyModel.position.x = 1.35 - Math.max(0, Math.sin(now * 0.0035 + Math.PI)) * 0.08;
        } else group.rotation.y += delta * 0.00025;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      visualRef.current = null;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose());
          else child.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [
    screen,
    settings.reducedMotion,
    settings.threeQuality,
    theme,
    enemyTheme,
    enemyPresentation,
    miningTheme,
    miningStage,
  ]);
  return (
    <div className="scene-frame">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div
        className="scene-glow"
        style={{ background: screen === 'mining' ? getMiningPalette(miningTheme).glow : theme }}
      />
    </div>
  );
}
