import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { EnemyDefinition, GameSettings, ScreenId } from '../game/types';

interface ThreeSceneProps {
  screen: ScreenId;
  settings: GameSettings;
  theme?: string;
  enemyTheme?: EnemyDefinition['theme'];
  combatActive?: boolean;
  playerWeaponTier?: 'bronze' | 'iron' | 'steel' | 'none';
  playerHasShield?: boolean;
}

const material = (color: string, roughness = 0.72, metalness = 0.12): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const addCombatEnvironment = (group: THREE.Group, accent: string): void => {
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.22, 10), material('#182025', 0.95));
  ground.position.y = -1.5;
  group.add(ground);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.045, 6, 36), material(accent, 0.7, 0.35));
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
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), material('#3d2d2c'));
    support.position.set(0, -0.65, -0.5);
    support.rotation.z = 0.16;
    group.add(support);
  } else {
    for (const x of [-2.25, 2.2]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.6, 5), material('#293032'));
      trunk.position.set(x, -0.65, -0.42);
      trunk.rotation.z = x < 0 ? -0.2 : 0.2;
      group.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), material('#334749'));
      crown.position.set(x + (x < 0 ? 0.22 : -0.18), 0.2, -0.42);
      group.add(crown);
    }
  }
};

const addPlayer = (
  group: THREE.Group,
  weaponTier: 'bronze' | 'iron' | 'steel' | 'none',
  hasShield: boolean,
): void => {
  const player = new THREE.Group();
  player.position.set(-1.35, 0, 0.15);
  const armor = material('#7b8990', 0.55, 0.32);
  const dark = material('#253137', 0.9, 0.05);
  const skin = material('#b88d72', 0.85);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.82, 6), armor);
  torso.position.y = -0.25;
  player.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 0.38;
  player.add(head);
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.42), dark);
  helm.position.set(0, 0.52, 0);
  player.add(helm);
  for (const x of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), dark);
    leg.position.set(x, -0.98, 0);
    player.add(leg);
  }
  const weaponColor = weaponTier === 'steel' ? '#d9e3df' : weaponTier === 'iron' ? '#aebbb7' : '#c08a55';
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.1), material(weaponColor, 0.3, 0.7));
  sword.position.set(0.58, -0.16, 0.12);
  sword.rotation.z = -0.55;
  player.add(sword);
  if (hasShield) {
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8), material('#a56d45', 0.55, 0.35));
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.52, -0.22, 0.18);
    player.add(shield);
  }
  group.add(player);
};

const addEnemy = (group: THREE.Group, theme: EnemyDefinition['theme']): void => {
  const enemy = new THREE.Group();
  enemy.position.set(1.35, 0, 0.1);
  const colors: Record<EnemyDefinition['theme'], string> = {
    rodent: '#9b765b',
    goblin: '#668356',
    bat: '#7c6891',
    crab: '#a06b4d',
    wolf: '#7f909b',
    bandit: '#a47b5f',
  };
  const bodyMaterial = material(colors[theme], 0.78, theme === 'crab' ? 0.42 : 0.08);
  const dark = material('#24272a', 0.92, 0.02);
  const scale = theme === 'rodent' ? 0.65 : theme === 'bat' ? 0.8 : theme === 'crab' ? 1.1 : theme === 'wolf' ? 1.15 : 0.95;
  enemy.scale.setScalar(scale);
  const body = new THREE.Mesh(theme === 'crab' ? new THREE.DodecahedronGeometry(0.68, 0) : new THREE.IcosahedronGeometry(0.62, 0), bodyMaterial);
  body.position.y = -0.2;
  enemy.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), bodyMaterial);
  head.position.set(theme === 'wolf' ? 0.25 : 0, 0.44, 0.05);
  enemy.add(head);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#f7c36b' });
  for (const z of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMaterial);
    eye.position.set(0.22, 0.48, z + 0.18);
    enemy.add(eye);
  }
  if (theme === 'bat') {
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.08, 4), bodyMaterial);
      wing.position.set(side * 0.63, 0.06, 0);
      wing.rotation.z = side * 0.35;
      enemy.add(wing);
    }
  } else if (theme === 'crab') {
    for (const side of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), bodyMaterial);
      claw.position.set(side * 0.72, -0.08, 0.12);
      enemy.add(claw);
    }
  } else {
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1), dark);
    weapon.position.set(-0.54, -0.2, 0.14);
    weapon.rotation.z = 0.6;
    enemy.add(weapon);
  }
  group.add(enemy);
};

export function ThreeScene({ screen, settings, theme = '#b58b53', enemyTheme = 'rodent', combatActive = false, playerWeaponTier = 'none', playerHasShield = false }: ThreeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || settings.threeQuality === 'off') return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: settings.threeQuality === 'high' });
    } catch {
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0.55, 7);
    camera.lookAt(0, -0.25, 0);
    const group = new THREE.Group();
    scene.add(group);
    if (screen === 'combat') {
      addCombatEnvironment(group, theme);
      addPlayer(group, playerWeaponTier, playerHasShield);
      addEnemy(group, enemyTheme);
    } else {
      const color = new THREE.Color(theme);
      const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.9, 0.26, 8), material('#1c252a', 0.9));
      ground.position.y = -1.45;
      group.add(ground);
      const object = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), material(color.getStyle()));
      object.position.y = 0.3;
      group.add(object);
    }
    scene.add(new THREE.AmbientLight('#a8b4b5', screen === 'combat' ? 1.8 : 1.5));
    const light = new THREE.PointLight(new THREE.Color(theme), screen === 'combat' ? 14 : 11, 12);
    light.position.set(0, 3, 3);
    scene.add(light);
    const resize = () => {
      const width = canvas.clientWidth || 300;
      const height = canvas.clientHeight || 200;
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.threeQuality === 'high' ? 1.5 : 1));
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
        if (screen === 'combat') {
          const player = group.children.find((child) => child instanceof THREE.Group && child.position.x < 0);
          const enemy = group.children.find((child) => child instanceof THREE.Group && child.position.x > 0);
          if (player) player.position.y = Math.sin(now * 0.0024) * 0.025;
          if (enemy) enemy.position.y = Math.sin(now * 0.0024 + 1.2) * 0.04;
          if (combatActive && player && enemy) {
            player.position.x = -1.35 + Math.max(0, Math.sin(now * 0.004)) * 0.12;
            enemy.position.x = 1.35 - Math.max(0, Math.sin(now * 0.004 + Math.PI)) * 0.08;
          }
        } else group.rotation.y += delta * 0.00025;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose());
          else child.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [screen, settings.reducedMotion, settings.threeQuality, theme, enemyTheme, combatActive, playerWeaponTier, playerHasShield]);
  return <div className="scene-frame"><canvas ref={canvasRef} aria-hidden="true" /><div className="scene-glow" style={{ background: theme }} /></div>;
}
