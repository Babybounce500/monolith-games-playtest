(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const isTouchDevice = () => ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const weapons = [
    { name: 'NEEDLE RACK', full: 'RAPID MICRO-MISSILES', mag: 18, reserve: 72, damage: 68, cooldown: 430, range: 360, color: '#87f6f0' },
    { name: 'HAILSTORM', full: 'TRIPLE LOCK-ON SALVO', mag: 6, reserve: 18, damage: 172, cooldown: 1250, range: 440, color: '#ffb96c' },
    { name: 'TITANBREAKER', full: 'CHARGED HEAVY MISSILE', mag: 4, reserve: 12, damage: 255, cooldown: 1850, range: 520, color: '#b8a9ff' },
    { name: 'THUNDERHEAD', full: 'CLOSE-RANGE MISSILE SWARM', mag: 0, reserve: 0, damage: 360, cooldown: 1700, range: 48, color: '#ff7768' }
  ];
  const BLACK_TIDE_ART = {
    marauder: { file: 'jaeger-marauder-back.webp', aspect: 401 / 768 },
    anchor: { file: 'jaeger-anchor-back.webp', aspect: 505 / 768 },
    wraith: { file: 'jaeger-wraith-back.webp', aspect: 439 / 768 },
    tidebreaker: { file: 'kaiju-tidebreaker.webp', aspect: 768 / 739 },
    riftmaw: { file: 'kaiju-riftmaw.webp', aspect: 581 / 768 },
    coast: { file: 'kuroshio-coastal-panorama.webp', aspect: 1 }
  };
  const BLACK_TIDE_EFFECTS = {
    hailstormRocket: { file: 'black-tide-hailstorm-rocket.webp', aspect: 782 / 244 }
  };
  const KAIJU_ATTACKS = {
    fire: { label: 'INFERNO SPIT', color: '#ff5b35', core: '#ffe79a', speed: 190, arc: 8, damageScale: 1, radius: 17 },
    acid: { label: 'CORROSIVE SPIT', color: '#9dff36', core: '#e9ff9a', speed: 225, arc: 18, damageScale: 0.92, radius: 22 },
    laser: { label: 'ABYSSAL LASER', color: '#ff43ee', core: '#f4ffff', windup: 0.22, beamLife: 0.42, damageScale: 1.18, radius: 14 }
  };
  const KAIJU_ATTACK_CYCLE = {
    tidebreaker: ['fire', 'acid', 'laser'],
    riftmaw: ['acid', 'laser', 'fire']
  };
  const artImages = {};
  const artTextures = {};
  function loadArtImage(id, filename) {
    const image = new Image();
    image.onload = () => {
      if (artTextures[id]) artTextures[id].needsUpdate = true;
    };
    image.onerror = () => console.error('Black Tide local artwork failed to load:', filename);
    image.src = `assets/black-tide/${filename}`;
    artImages[id] = image;
  }
  Object.entries(BLACK_TIDE_ART).forEach(([id, asset]) => {
    loadArtImage(id, asset.file);
  });
  Object.entries(BLACK_TIDE_EFFECTS).forEach(([id, asset]) => loadArtImage(id, asset.file));
  const simulationStep = 1 / 60;
  const state = {
    mode: 'menu', fallback: false, seconds: 420, kills: 0, shots: 0,
    weapon: 0, player: { x: 0, z: 178, yaw: 0, pitch: 0, health: 100, shield: 100, boost: 100 },
    kaiju: [], allies: [], ammo: weapons.map(weapon => ({ mag: weapon.mag, reserve: weapon.reserve })),
    firing: false, shieldHeld: false, boostHeld: false, heavyCharging: false,
    heavyCharge: 0, reloadUntil: 0, lastFireAt: 0, lastStepAt: 0,
    target: null, lockProgress: 0, overdriveUntil: 0, overdriveCooldown: 0,
    timeSinceHud: 0, timeSinceRadar: 0, timeSinceRadio: 0, disableAI: false
  };
  const keys = new Set();
  const colliders = [];
  const missiles = [];
  const kaijuAttacks = [];
  const visualEffects = [];
  const fallbackTracers = [];
  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;
  let actorRoot = null;
  let rain = null;
  let rainPositions = null;
  let fallbackCanvas = null;
  let fallbackContext = null;
  let lastFrame = 0;
  let accumulator = 0;
  let worldBuilt = false;
  let touchMove = { x: 0, y: 0 };

  function showError(message) {
    const error = $('#loading-error');
    error.textContent = message;
    error.classList.remove('hidden');
  }

  function initializeFallback(reason) {
    state.fallback = true;
    fallbackCanvas = $('#fallback-canvas');
    fallbackContext = fallbackCanvas.getContext('2d');
    if (!fallbackContext) {
      showError('3D und 2D-Renderer sind in diesem Browser nicht verfügbar.');
      return false;
    }
    fallbackCanvas.classList.remove('hidden');
    $('#render-mode-badge').classList.remove('hidden');
    resizeFallback();
    console.info('Black Tide is using its 2D compatibility renderer:', reason);
    return true;
  }

  function initializeRenderer() {
    try {
      if (!window.THREE) {
        showError('Die lokale Three.js-Datei konnte nicht geladen werden.');
        return false;
      }
      const probe = document.createElement('canvas');
      const probeContext = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl');
      if (!probeContext) return initializeFallback('This browser does not provide WebGL.');
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#85999b');
      scene.fog = new THREE.FogExp2('#14242a', 0.0017);
      camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 900);
      camera.rotation.order = 'YXZ';
      renderer = new THREE.WebGLRenderer({ canvas: probe, antialias: false, powerPreference: 'low-power', alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
      renderer.setSize(innerWidth, innerHeight);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.setAttribute('aria-label', 'First-person Jaeger cockpit view');
      renderer.domElement.tabIndex = 0;
      $('#world-canvas').appendChild(renderer.domElement);
      const hemisphere = new THREE.HemisphereLight(0xa8cbd0, 0x101b20, 0.78);
      scene.add(hemisphere);
      const key = new THREE.DirectionalLight(0xd9c2a0, 1.12);
      key.position.set(-90, 160, 110);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x5aa8b6, 0.42);
      fill.position.set(140, 75, -120);
      scene.add(fill);
      actorRoot = new THREE.Group();
      scene.add(actorRoot);
      clock = new THREE.Clock();
      return true;
    } catch (error) {
      return initializeFallback(error.message || 'The WebGL renderer could not start.');
    }
  }

  function resizeFallback() {
    if (!fallbackCanvas || !fallbackContext) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    fallbackCanvas.width = Math.round(innerWidth * ratio);
    fallbackCanvas.height = Math.round(innerHeight * ratio);
    fallbackContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function makeMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: options.metalness ?? 0.64,
      roughness: options.roughness ?? 0.42,
      emissive: options.emissive || '#000000',
      emissiveIntensity: options.emissiveIntensity || 0,
      flatShading: options.flatShading ?? true
    });
  }

  function getArtTexture(id) {
    if (!artTextures[id]) {
      const texture = new THREE.Texture(artImages[id]);
      texture.encoding = THREE.sRGBEncoding;
      texture.needsUpdate = artImages[id]?.complete && artImages[id].naturalWidth > 0;
      artTextures[id] = texture;
    }
    return artTextures[id];
  }

  function artAspect(id, fallback) {
    const image = artImages[id];
    if (image?.naturalWidth && image?.naturalHeight) return image.naturalWidth / image.naturalHeight;
    return BLACK_TIDE_ART[id]?.aspect || BLACK_TIDE_EFFECTS[id]?.aspect || fallback;
  }

  function makeImageSprite(parent, id, height, marker = 'imageSprite') {
    const descriptor = BLACK_TIDE_ART[id] || BLACK_TIDE_EFFECTS[id];
    if (!descriptor) throw new Error(`Missing Black Tide image definition: ${id}`);
    const material = new THREE.SpriteMaterial({
      map: getArtTexture(id),
      color: '#ffffff',
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      depthTest: marker !== 'weaponSprite',
      blending: THREE.NormalBlending,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = height * 0.5;
    sprite.scale.set(height * artAspect(id, descriptor.aspect), height, 1);
    sprite.renderOrder = marker === 'weaponSprite' ? 20 : 2;
    sprite.userData[marker] = id;
    if (parent) parent.add(sprite);
    return sprite;
  }

  function addWorldBox(parent, geometry, material, x, y, z, sx, sy, sz, rotationY = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = rotationY;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function buildCity() {
    const coast = getArtTexture('coast');
    coast.mapping = THREE.EquirectangularReflectionMapping;
    coast.needsUpdate = true;
    scene.background = coast;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(620, 620),
      new THREE.MeshBasicMaterial({ color: '#26343a' })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(620, 190),
      new THREE.MeshStandardMaterial({ color: '#0b2028', metalness: 0.32, roughness: 0.34 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.58, -304);
    scene.add(water);

    const roadMaterial = new THREE.MeshBasicMaterial({ color: '#111c21' });
    for (let road = -2; road <= 2; road++) {
      const eastWest = new THREE.Mesh(new THREE.PlaneGeometry(620, 12), roadMaterial);
      eastWest.rotation.x = -Math.PI / 2;
      eastWest.position.set(0, -0.91, road * 58);
      scene.add(eastWest);
      const northSouth = new THREE.Mesh(new THREE.PlaneGeometry(12, 620), roadMaterial);
      northSouth.rotation.x = -Math.PI / 2;
      northSouth.position.set(road * 58, -0.9, 0);
      scene.add(northSouth);
    }
    const stripeGeometry = new THREE.BoxGeometry(0.6, 0.12, 8);
    const stripeMaterial = new THREE.MeshBasicMaterial({ color: '#3a5156' });
    for (let x = -240; x <= 240; x += 24) {
      for (const z of [-116, -58, 0, 58, 116]) {
        addWorldBox(scene, stripeGeometry, stripeMaterial, x, -0.79, z, 1, 1, 1);
      }
    }

    let seed = 9031709;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const towerData = [];
    for (let x = -250; x <= 250; x += 34) {
      for (let z = -238; z <= 222; z += 38) {
        if (Math.abs(x) < 79 && z > -186 && z < 202) continue;
        if (random() < 0.9) continue;
        const width = 11 + random() * 11;
        const depth = 11 + random() * 11;
        const height = 8 + random() * 24;
        const tx = x + (random() - 0.5) * 13;
        const tz = z + (random() - 0.5) * 13;
        towerData.push({ x: tx, z: tz, width, depth, height });
        colliders.push({ x: tx, z: tz, width: width + 5, depth: depth + 5 });
      }
    }
    const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const towerMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const towers = new THREE.InstancedMesh(towerGeometry, towerMaterial, towerData.length);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    towerData.forEach((tower, index) => {
      position.set(tower.x, tower.height / 2 - 0.9, tower.z);
      scale.set(tower.width, tower.height, tower.depth);
      matrix.compose(position, rotation, scale);
      towers.setMatrixAt(index, matrix);
      const shade = 0.7 + random() * 0.28;
      color.setRGB(shade * 0.02, shade * 0.045, shade * 0.06);
      towers.setColorAt(index, color);
    });
    towers.instanceMatrix.needsUpdate = true;
    if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
    scene.add(towers);

    const windows = [];
    towerData.forEach(tower => {
      const rows = Math.max(2, Math.floor(tower.height / 12));
      for (let row = 0; row < rows; row++) {
        if (random() < 0.44) continue;
        const side = random() < 0.5 ? -1 : 1;
        const wx = tower.x + side * (tower.width / 2 + 0.08);
        const wy = 2 + row * 9 + random() * 2;
        windows.push({ x: wx, y: wy, z: tower.z + (random() - 0.5) * tower.depth * 0.72, color: random() < 0.35 ? '#efb96e' : '#9bd8d5' });
      }
    });
    if (windows.length) {
      const windowMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.18, 1.35, 1.15),
        new THREE.MeshBasicMaterial({ color: '#ffffff' }),
        windows.length
      );
      windows.forEach((window, index) => {
        position.set(window.x, window.y, window.z);
        scale.set(1, 1, 1);
        matrix.compose(position, rotation, scale);
        windowMesh.setMatrixAt(index, matrix);
        windowMesh.setColorAt(index, new THREE.Color(window.color));
      });
      scene.add(windowMesh);
    }

    const breakwater = new THREE.MeshBasicMaterial({ color: '#1b2a30' });
    for (let x = -250; x <= 250; x += 22) {
      addWorldBox(scene, new THREE.BoxGeometry(1, 1, 1), breakwater, x, 3, -210, 18, 6, 8);
    }
    const warningLightMaterial = new THREE.MeshBasicMaterial({ color: '#ff836a' });
    const beaconGeometry = new THREE.SphereGeometry(1.2, 8, 6);
    for (let x = -232; x <= 232; x += 44) {
      const beacon = new THREE.Mesh(beaconGeometry, warningLightMaterial);
      beacon.position.set(x, 7, -204);
      scene.add(beacon);
    }

    const rainCount = 1200;
    const rainGeometry = new THREE.BufferGeometry();
    rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (random() - 0.5) * 490;
      rainPositions[i * 3 + 1] = random() * 130;
      rainPositions[i * 3 + 2] = (random() - 0.5) * 490;
    }
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rain = new THREE.Points(rainGeometry, new THREE.PointsMaterial({
      color: '#c4e1dd', size: 0.8, transparent: true, opacity: 0.35, sizeAttenuation: true
    }));
    scene.add(rain);
  }

  function makeJaeger(name, x, z, playerUnit = false) {
    const id = name.toLowerCase();
    const root = new THREE.Group();
    root.userData.spriteOnlyActor = true;
    makeImageSprite(root, id, 30, 'actorSprite');
    root.position.set(x, 0, z);
    actorRoot.add(root);
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name, x, z, yaw: 0, root, health: 100, maxHealth: 100,
      targetY: 15, radius: 12, playerUnit, alive: true,
      nextFireAt: performance.now() + Math.random() * 700,
      bob: Math.random() * 7, attack: Math.random() * 2
    };
  }

  function makeKaiju(config) {
    const root = new THREE.Group();
    const spriteHeight = config.radius * 2.3;
    root.userData.spriteOnlyActor = true;
    makeImageSprite(root, config.id, spriteHeight, 'actorSprite');
    root.position.set(config.x, 0, config.z);
    actorRoot.add(root);
    return {
      id: config.id, name: config.name, className: config.className,
      x: config.x, z: config.z, yaw: 0, root, health: config.health, maxHealth: config.health,
      targetY: 25, radius: config.radius, speed: config.speed, alive: true,
      nextAttackAt: performance.now() + 3200 + Math.random() * 2500,
      nextRoarAt: performance.now() + 7000 + Math.random() * 5000,
      nextFireAt: 0, attack: 0, lastAttackType: null, phase: Math.random() * 6,
      color: config.color
    };
  }

  function resetUnits() {
    if (actorRoot) {
      while (actorRoot.children.length) {
        const child = actorRoot.children[0];
        child.traverse?.(node => {
          node.geometry?.dispose?.();
          if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.());
          else node.material?.dispose?.();
        });
        actorRoot.remove(child);
      }
    }
    if (state.fallback) {
      state.allies = [
        { id: 'marauder', name: 'MARAUDER', x: -27, z: 157, health: 100, alive: true, nextFireAt: performance.now() + 500 },
        { id: 'anchor', name: 'ANCHOR', x: 32, z: 161, health: 100, alive: true, nextFireAt: performance.now() + 900 },
        { id: 'wraith', name: 'WRAITH', x: -53, z: 129, health: 100, alive: true, nextFireAt: performance.now() + 1300 }
      ];
      state.kaiju = [
        { id: 'tidebreaker', name: 'TIDEBREAKER', className: 'CLASS IV // ABYSSAL', x: -22, z: -79, health: 1760, maxHealth: 1760, targetY: 25, radius: 29, speed: 4.4, alive: true, nextAttackAt: performance.now() + 4000, nextRoarAt: performance.now() + 12000, attack: 0, lastAttackType: null, phase: 0, color: '#35494a' },
        { id: 'riftmaw', name: 'RIFTMAW', className: 'CLASS III // RAZORBACK', x: 77, z: -138, health: 1180, maxHealth: 1180, targetY: 25, radius: 22, speed: 5.4, alive: true, nextAttackAt: performance.now() + 5200, nextRoarAt: performance.now() + 15000, attack: 0, lastAttackType: null, phase: 2, color: '#59494a' }
      ];
      return;
    }
    state.allies = [
      makeJaeger('MARAUDER', -27, 157),
      makeJaeger('ANCHOR', 32, 161),
      makeJaeger('WRAITH', -53, 129)
    ];
    state.kaiju = [
      makeKaiju({
        id: 'tidebreaker', name: 'TIDEBREAKER', className: 'CLASS IV // ABYSSAL',
        x: -22, z: -79, health: 1760, radius: 29, speed: 4.4,
        color: '#35494a', armor: '#607573', under: '#152a30'
      }),
      makeKaiju({
        id: 'riftmaw', name: 'RIFTMAW', className: 'CLASS III // RAZORBACK',
        x: 77, z: -138, health: 1180, radius: 22, speed: 5.4,
        color: '#59494a', armor: '#a46a51', under: '#24242c'
      })
    ];
  }

  function buildWorld() {
    if (worldBuilt) return;
    if (state.fallback) {
      resetUnits();
      worldBuilt = true;
      return;
    }
    buildCity();
    resetUnits();
    worldBuilt = true;
  }

  function canOccupy(x, z) {
    if (x < -270 || x > 270 || z < -270 || z > 270) return false;
    return !colliders.some(box =>
      Math.abs(x - box.x) < box.width / 2 + 4 &&
      Math.abs(z - box.z) < box.depth / 2 + 4
    );
  }

  function canOccupyPlayer(x, z) {
    if (!canOccupy(x, z)) return false;
    return !state.kaiju.some(kaiju =>
      kaiju.alive && Math.hypot(x - kaiju.x, z - kaiju.z) < kaiju.radius + 6
    );
  }

  function positionCamera() {
    if (!camera) return;
    const bob = state.mode === 'playing' ? Math.sin(performance.now() * 0.009) * 0.13 : 0;
    camera.position.set(state.player.x, 13.4 + bob, state.player.z);
    camera.rotation.set(state.player.pitch, state.player.yaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);
  }

  function startMission(options = {}) {
    if (state.mode === 'playing') return true;
    if (!worldBuilt) buildWorld();
    clearKaijuAttacks();
    resetUnits();
    state.mode = 'playing';
    state.seconds = 420;
    state.kills = 0;
    state.shots = 0;
    state.player = { x: 0, z: 178, yaw: 0, pitch: 0, health: 100, shield: 100, boost: 100 };
    state.weapon = 0;
    state.ammo = weapons.map(weapon => ({ mag: weapon.mag, reserve: weapon.reserve }));
    state.target = null;
    state.lockProgress = 0;
    state.heavyCharging = false;
    state.heavyCharge = 0;
    state.reloadUntil = 0;
    state.lastFireAt = 0;
    state.lastStepAt = 0;
    state.overdriveUntil = 0;
    state.overdriveCooldown = 0;
    state.disableAI = options.disableAI === true;
    state.firing = false;
    state.shieldHeld = false;
    state.boostHeld = false;
    keys.clear();
    $('#mission-briefing').classList.add('hidden');
    $('#pause-screen').classList.add('hidden');
    $('#result-screen').classList.add('hidden');
    $('#mission-hud').classList.remove('hidden');
    positionCamera();
    renderWeaponState();
    updateHUD(true);
    window.OrbitronAudio?.start('mech');
    window.OrbitronAudio?.setTension(0.62);
    window.OrbitronAudio?.play('radio');
    window.OrbitronAudio?.play('bellow', { pan: -0.2, power: 1.1 });
    if (options.lockPointer !== false && !state.fallback) {
      try { renderer.domElement.requestPointerLock?.(); } catch (_) {}
    }
    return true;
  }

  function stopPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  function pauseMission() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      state.firing = false;
      state.shieldHeld = false;
      state.boostHeld = false;
      state.heavyCharging = false;
      $('#pause-screen').classList.remove('hidden');
      stopPointerLock();
      window.OrbitronAudio?.stop();
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      $('#pause-screen').classList.add('hidden');
      window.OrbitronAudio?.start('mech');
    }
  }

  function finishMission(success, reason = '') {
    if (state.mode === 'finished') return;
    state.mode = 'finished';
    state.firing = false;
    state.shieldHeld = false;
    state.boostHeld = false;
    clearKaijuAttacks();
    $('#mission-hud').classList.add('hidden');
    $('#pause-screen').classList.add('hidden');
    $('#result-screen').classList.remove('hidden');
    $('#result-kicker').textContent = success ? 'GNS AFTER ACTION // SECTOR HELD' : 'GNS AFTER ACTION // LINK LOST';
    $('#result-title').textContent = success ? 'BREAKWATER SECURED' : reason || 'PILOT LINK LOST';
    $('#result-copy').textContent = success
      ? 'Beide Titanen sind neutralisiert. Die Küstenlinie hält. Jaeger-Division bleibt im Sektor.'
      : 'Die Evakuierung läuft weiter. Bereitmachen für einen neuen Anflug.';
    $('#result-stats').innerHTML = `
      <div><b>${state.kills}/2</b><small>KAIJU DOWN</small></div>
      <div><b>${Math.round(state.shots)}</b><small>WEAPON DISCHARGES</small></div>
      <div><b>${Math.max(0, Math.ceil(state.player.health))}%</b><small>FRAME INTEGRITY</small></div>`;
    stopPointerLock();
    window.OrbitronAudio?.stop();
    window.OrbitronAudio?.play(success ? 'win' : 'hurt');
  }

  function aimAtTarget(id) {
    const target = state.kaiju.find(kaiju => kaiju.id === id && kaiju.alive);
    if (!target) return false;
    const dx = target.x - state.player.x;
    const dz = target.z - state.player.z;
    state.player.yaw = Math.atan2(-dx, -dz);
    state.player.pitch = Math.atan2(target.targetY - 13.4, Math.hypot(dx, dz));
    state.target = target;
    state.lockProgress = 1;
    positionCamera();
    updateHUD(true);
    return true;
  }

  function getAimedTarget(maxRange = 520) {
    const direction = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(state.player.pitch, state.player.yaw, 0, 'YXZ')
    ).normalize();
    const origin = new THREE.Vector3(state.player.x, 13.4, state.player.z);
    let best = null;
    let bestAlong = maxRange;
    for (const target of state.kaiju) {
      if (!target.alive) continue;
      const delta = new THREE.Vector3(target.x - origin.x, target.targetY - origin.y, target.z - origin.z);
      const along = delta.dot(direction);
      if (along <= 0 || along > bestAlong) continue;
      const miss = delta.addScaledVector(direction, -along).length();
      const tolerance = Math.max(8, target.radius * 0.59);
      if (miss <= tolerance) {
        best = target;
        bestAlong = along;
      }
    }
    return best ? { target: best, distance: bestAlong } : null;
  }

  function getCloseRangeTarget() {
    const forwardX = -Math.sin(state.player.yaw);
    const forwardZ = -Math.cos(state.player.yaw);
    let best = null;
    let bestAlong = Infinity;
    for (const target of state.kaiju) {
      if (!target.alive) continue;
      const dx = target.x - state.player.x;
      const dz = target.z - state.player.z;
      const distance = Math.hypot(dx, dz);
      const along = dx * forwardX + dz * forwardZ;
      const lateral = Math.abs(dx * forwardZ - dz * forwardX);
      const bodyReach = target.radius * 0.4;
      if (along <= 0 || along > weapons[3].range + bodyReach) continue;
      if (distance - bodyReach > weapons[3].range) continue;
      if (lateral > Math.max(4, bodyReach * 0.8)) continue;
      if (along < bestAlong) {
        best = target;
        bestAlong = along;
      }
    }
    return best;
  }

  function acquireTarget() {
    const current = state.target;
    const candidates = state.kaiju.filter(kaiju => kaiju.alive).sort((a, b) =>
      Math.hypot(a.x - state.player.x, a.z - state.player.z) -
      Math.hypot(b.x - state.player.x, b.z - state.player.z)
    );
    const next = candidates.find(kaiju => kaiju !== current) || candidates[0];
    state.target = next || null;
    state.lockProgress = 0;
    if (next) {
      $('#squad-callout').innerHTML = `TARGET DESIGNATED // ${next.name} <span>·</span> SQUAD ENGAGING`;
      window.OrbitronAudio?.play('lock');
      window.OrbitronAudio?.play('radio');
    }
    updateHUD(true);
    return next || null;
  }

  function showCallout(text) {
    const node = $('#squad-callout');
    node.textContent = text;
    clearTimeout(showCallout.timer);
    showCallout.timer = setTimeout(() => {
      if (state.mode === 'playing') node.innerHTML = 'SQUAD LINK STABLE <span>·</span> MARK A TARGET WITH Q';
    }, 1900);
  }

  function makeBeam(start, end, color, thickness = 0.1, life = 0.22, spriteId = null) {
    if (!scene || state.fallback) {
      fallbackTracers.push({ x1: start.x, z1: start.z, x2: end.x, z2: end.z, color, life, maxLife: life, spriteId });
      return;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    scene.add(line);
    visualEffects.push({ object: line, life, maxLife: life, beam: true });
    if (spriteId) {
      const sprite = makeImageSprite(scene, spriteId, 1, 'weaponSprite');
      sprite.position.copy(end);
      const distance = camera ? camera.position.distanceTo(end) : start.distanceTo(end);
      const spriteHeight = clamp(distance * 0.09, 3.5, 24);
      sprite.scale.set(
        spriteHeight * artAspect(spriteId, BLACK_TIDE_EFFECTS[spriteId]?.aspect || 1),
        spriteHeight,
        1
      );
      if (camera) {
        const from = start.clone().project(camera);
        const to = end.clone().project(camera);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (Math.hypot(dx, dy) > 0.25) sprite.material.rotation = Math.atan2(dy, dx);
      }
      visualEffects.push({ object: sprite, life, maxLife: life, beam: true, weaponSprite: spriteId });
    }
    const impact = new THREE.Mesh(
      new THREE.SphereGeometry(thickness * 3, 7, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 })
    );
    impact.position.copy(end);
    scene.add(impact);
    visualEffects.push({ object: impact, life: life * 0.7, maxLife: life * 0.7, beam: false });
  }

  function makeExplosion(x, y, z, color = '#ffb76d', scale = 1) {
    if (!scene || state.fallback) return;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.83 })
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    visualEffects.push({ object: mesh, life: 0.42, maxLife: 0.42, beam: false, explosionScale: scale });
  }

  function addKaijuAttackOrb(parent, radius, color, opacity, x = 0, y = 0, z = 0) {
    const geometry = new THREE.SphereGeometry(radius, 10, 8);
    geometry.computeBoundingSphere();
    const orb = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false
      })
    );
    orb.userData.baseOpacity = opacity;
    orb.position.set(x, y, z);
    orb.renderOrder = 24;
    parent.add(orb);
    return orb;
  }

  function makeKaijuAttackOverlay(attack) {
    if (!camera || !scene || state.fallback || !attack.target.player) return null;
    const overlay = new THREE.Group();
    overlay.userData.kaijuAttackOverlay = attack.type;
    const addPlane = (width, height, color, opacity, role) => {
      const geometry = new THREE.PlaneGeometry(width, height);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false
      }));
      mesh.position.z = -18;
      mesh.renderOrder = 90;
      mesh.userData.attackRole = role;
      mesh.userData.baseOpacity = opacity;
      mesh.visible = role === 'charge';
      overlay.add(mesh);
    };
    if (attack.type === 'laser') {
      addPlane(1.9, 1.9, '#fff5ff', 0.4, 'charge');
      addPlane(24, 1.25, '#ff43ee', 0.36, 'beam');
      addPlane(18, 0.48, '#ffb9fb', 0.72, 'beam');
      addPlane(12, 0.16, '#ffffff', 0.98, 'beam');
    } else if (attack.type === 'fire') {
      addKaijuAttackOrb(overlay, 1.85, attack.config.color, 0.7, 0, 0, -18).userData.attackRole = 'projectile';
      addKaijuAttackOrb(overlay, 1.08, attack.config.core, 0.96, 0.08, 0.05, -18).userData.attackRole = 'projectile';
      addKaijuAttackOrb(overlay, 0.46, '#fff8df', 0.98, -0.46, 0.38, -18).userData.attackRole = 'projectile';
    } else {
      addKaijuAttackOrb(overlay, 1.55, attack.config.color, 0.74, 0, 0, -18).userData.attackRole = 'projectile';
      addKaijuAttackOrb(overlay, 0.72, attack.config.core, 0.98, 0.32, 0.25, -18).userData.attackRole = 'projectile';
      addKaijuAttackOrb(overlay, 0.42, '#e8ff4d', 0.92, -0.48, -0.2, -18).userData.attackRole = 'projectile';
    }
    scene.add(overlay);
    return overlay;
  }

  function makeKaijuAttackVisual(attack) {
    if (!scene || state.fallback) return null;
    const group = new THREE.Group();
    group.userData.kaijuAttack = attack.type;
    if (attack.type === 'laser') {
      const direction = attack.end.clone().sub(attack.start);
      const length = direction.length();
      const orientation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize()
      );
      const center = attack.start.clone().add(attack.end).multiplyScalar(0.5);
      const addBeam = (topRadius, bottomRadius, color, opacity, role) => {
        const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 10, 1);
        geometry.computeBoundingSphere();
        const beam = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color, transparent: true, opacity, depthWrite: false,
            depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false
          })
        );
        beam.position.copy(center);
        beam.quaternion.copy(orientation);
        beam.renderOrder = 25;
        beam.userData.attackRole = role;
        beam.userData.baseOpacity = opacity;
        beam.visible = false;
        group.add(beam);
      };
      const muzzle = addKaijuAttackOrb(group, 3.5, attack.config.color, 0.9, attack.start.x, attack.start.y, attack.start.z);
      muzzle.userData.attackRole = 'charge';
      addKaijuAttackOrb(group, 2.1, attack.config.core, 0.9, attack.end.x, attack.end.y, attack.end.z).visible = false;
      group.children[1].userData.attackRole = 'impact';
      addBeam(0.9, 3.2, attack.config.color, 0.36, 'beam');
      addBeam(0.38, 0.72, attack.config.core, 0.98, 'beam');
    } else {
      group.position.copy(attack.position);
      if (attack.type === 'fire') {
        const flame = addKaijuAttackOrb(group, 5.2, attack.config.color, 0.68);
        flame.scale.set(1.15, 0.92, 1.25);
        addKaijuAttackOrb(group, 3.1, attack.config.core, 0.95, 0.25, 0.1, -0.2);
        addKaijuAttackOrb(group, 1.25, '#fff6cf', 0.95, -0.55, 0.35, 0.35);
      } else {
        const glob = addKaijuAttackOrb(group, 4.2, attack.config.color, 0.9);
        glob.scale.set(0.88, 1.18, 0.94);
        addKaijuAttackOrb(group, 1.35, attack.config.core, 0.9, 0.42, 0.72, 0.22);
        addKaijuAttackOrb(group, 0.92, '#e8ff4d', 0.85, -0.7, -0.2, -0.34);
      }
    }
    scene.add(group);
    attack.overlay = makeKaijuAttackOverlay(attack);
    return group;
  }

  function disposeKaijuAttackVisual(attack) {
    if (!attack) return;
    for (const root of [attack.visual, attack.overlay]) {
      if (!root) continue;
      root.parent?.remove(root);
      root.traverse(node => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.());
        else node.material?.dispose?.();
      });
    }
    attack.visual = null;
    attack.overlay = null;
  }

  function clearKaijuAttacks() {
    while (kaijuAttacks.length) disposeKaijuAttackVisual(kaijuAttacks.pop());
  }

  function launchKaijuAttack(kaiju, target, requestedType = null) {
    if (!kaiju?.alive || !target || (target.player ? state.player.health <= 0 : !target.alive)) return null;
    const cycle = KAIJU_ATTACK_CYCLE[kaiju.id] || ['fire', 'acid', 'laser'];
    const type = requestedType || cycle[kaiju.attack % cycle.length];
    const config = KAIJU_ATTACKS[type];
    if (!config) return null;
    const direction = new THREE.Vector3(target.x - kaiju.x, 0, target.z - kaiju.z);
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    direction.normalize();
    const start = new THREE.Vector3(kaiju.x, kaiju.targetY + 7, kaiju.z)
      .addScaledVector(direction, kaiju.radius * 0.62);
    const end = new THREE.Vector3(target.x, target.player ? 13 : (target.targetY || 15), target.z);
    const distance = start.distanceTo(end);
    const duration = type === 'laser'
      ? config.windup + config.beamLife
      : clamp(distance / config.speed, 0.52, 1.38);
    const attack = {
      type, config, kaiju, target, start, end, position: start.clone(),
      previousPosition: start.clone(), age: 0, duration,
      damage: (kaiju.id === 'tidebreaker' ? 17 : 12) * config.damageScale,
      radius: config.radius,
      arc: config.arc || 0,
      visual: null
    };
    if (type === 'laser') attack.position.lerp(end, 0.5);
    attack.visual = makeKaijuAttackVisual(attack);
    kaijuAttacks.push(attack);
    kaiju.lastAttackType = type;
    kaiju.attack += 1;
    showCallout(`${kaiju.name} // ${config.label}`);
    window.OrbitronAudio?.play(type === 'laser' ? 'warning' : 'bellow', {
      pan: Math.sign(kaiju.x - state.player.x) * 0.55,
      power: type === 'laser' ? 1.25 : 0.8
    });
    return attack;
  }

  function resolveKaijuAttack(attack) {
    const target = attack.target;
    const targetAlive = target?.player ? state.player.health > 0 : target?.alive;
    const targetX = target?.player ? state.player.x : target?.x;
    const targetZ = target?.player ? state.player.z : target?.z;
    const closeEnough = Number.isFinite(targetX) && Number.isFinite(targetZ) &&
      Math.hypot(targetX - attack.end.x, targetZ - attack.end.z) <= attack.radius + (target.radius || 0);
    if (targetAlive && closeEnough && target.player) {
      const shielded = state.shieldHeld && state.player.shield > 1;
      const damage = shielded ? 3.5 : attack.damage;
      if (shielded) state.player.shield = Math.max(0, state.player.shield - 15);
      state.player.health = Math.max(0, state.player.health - damage);
      $('#damage-vignette').classList.add('active');
      setTimeout(() => $('#damage-vignette').classList.remove('active'), 210);
      window.OrbitronAudio?.play(shielded ? 'shield' : 'mech-hit', {
        pan: Math.sign(attack.kaiju.x - state.player.x) * 0.65,
        power: attack.type === 'laser' ? 1.35 : 1.1
      });
      showCallout(shielded ? 'AEGIS SHIELD // IMPACT ABSORBED' : `${attack.kaiju.name} // ${attack.config.label}`);
      if (state.player.health <= 0) finishMission(false, 'FRAME COMPROMISED');
    } else if (targetAlive && closeEnough && target) {
      target.health = Math.max(0, target.health - 13);
      if (target.health <= 0) {
        target.alive = false;
        if (target.root) target.root.visible = false;
        window.OrbitronAudio?.play('mech-hit', { pan: Math.sign(target.x - state.player.x) * 0.45 });
        showCallout(`${target.name} // LINK LOST`);
      }
    }
    makeExplosion(
      attack.end.x, attack.end.y, attack.end.z,
      attack.config.color, attack.type === 'laser' ? 11 : attack.type === 'acid' ? 8 : 7
    );
    updateHUD(true);
    return targetAlive && closeEnough;
  }

  function updateKaijuAttacks(dt) {
    for (let i = kaijuAttacks.length - 1; i >= 0; i--) {
      const attack = kaijuAttacks[i];
      if (!attack) continue;
      attack.age += dt;
      if (attack.overlay && camera) {
        attack.overlay.position.copy(camera.position);
        attack.overlay.quaternion.copy(camera.quaternion);
      }
      if (attack.type === 'laser') {
        attack.position.lerpVectors(attack.start, attack.end, 0.5);
        const beamProgress = clamp((attack.age - attack.config.windup) / attack.config.beamLife, 0, 1);
        attack.visual?.children.forEach(node => {
          if (node.userData.attackRole === 'charge') {
            node.visible = attack.age < attack.config.windup + 0.08;
            node.scale.setScalar(0.88 + Math.sin(attack.age * 48) * 0.22);
          } else if (node.userData.attackRole === 'impact') {
            node.visible = attack.age >= attack.config.windup;
            node.material.opacity = 0.9 * (1 - beamProgress * 0.55);
            node.scale.setScalar(1 + beamProgress * 2.4);
          } else if (node.userData.attackRole === 'beam') {
            node.visible = attack.age >= attack.config.windup;
            node.material.opacity = node.userData.baseOpacity * (1 - beamProgress * 0.68);
          }
        });
        attack.overlay?.children.forEach(node => {
          const visible = node.userData.attackRole === 'charge'
            ? attack.age < attack.config.windup
            : attack.age >= attack.config.windup;
          node.visible = visible;
          if (node.userData.attackRole === 'beam') {
            node.material.opacity = node.userData.baseOpacity * (1 - beamProgress * 0.7);
          }
        });
      } else {
        attack.previousPosition.copy(attack.position);
        const progress = clamp(attack.age / attack.duration, 0, 1);
        attack.position.lerpVectors(attack.start, attack.end, progress);
        attack.position.y += Math.sin(progress * Math.PI) * attack.arc;
        if (attack.visual) {
          attack.visual.position.copy(attack.position);
          attack.visual.rotation.z = Math.sin(attack.age * 19) * 0.18;
          attack.visual.scale.setScalar(0.86 + Math.sin(attack.age * 31) * 0.13);
        }
        attack.overlay?.children.forEach(node => {
          node.material.opacity = node.userData.baseOpacity * (1 - progress * 0.62);
          node.scale.setScalar(0.78 + progress * 0.82 + Math.sin(attack.age * 26) * 0.08);
        });
      }
      if (attack.age >= attack.duration) {
        resolveKaijuAttack(attack);
        disposeKaijuAttackVisual(attack);
        kaijuAttacks.splice(i, 1);
      }
    }
  }

  function triggerKaijuAttack(kaijuId, type = null, targetId = 'player') {
    const kaiju = state.kaiju.find(unit => unit.id === kaijuId && unit.alive);
    const target = targetId === 'player'
      ? { player: true, x: state.player.x, z: state.player.z }
      : state.allies.find(unit => unit.id === targetId && unit.alive);
    return Boolean(launchKaijuAttack(kaiju, target, type));
  }

  function damageKaiju(target, damage, weaponColor = '#86f6ed') {
    if (!target?.alive) return false;
    const multiplier = performance.now() < state.overdriveUntil ? 1.32 : 1;
    const dealt = damage * multiplier;
    target.health = Math.max(0, target.health - dealt);
    if (target.root) {
      target.root.position.y = 0.5;
      setTimeout(() => { if (target.root) target.root.position.y = 0; }, 90);
    }
    makeExplosion(target.x, Math.max(13, target.targetY), target.z - 15, weaponColor, target.radius * 0.42);
    if (target.health <= 0) {
      target.alive = false;
      target.root && (target.root.visible = false);
      state.kills++;
      state.target = state.kaiju.find(kaiju => kaiju.alive) || null;
      window.OrbitronAudio?.play('bellow', { pan: target.x < state.player.x ? -0.6 : 0.6, power: 1.35 });
      window.OrbitronAudio?.play('radio');
      showCallout(`${target.name} NEUTRALIZED // SQUAD ADVANCE`);
      if (state.kills >= state.kaiju.length) finishMission(true);
    } else if (target.health < target.maxHealth * 0.48) {
      showCallout(`${target.name} ARMOR BREACH // KEEP PRESSURE`);
    }
    window.OrbitronAudio?.setTension(1 - Math.min(...state.kaiju.filter(item => item.alive).map(item => item.health / item.maxHealth), 0.4));
    updateHUD(true);
    return true;
  }

  function launchMissileSalvo(target, options = {}) {
    const weaponIndex = options.weaponIndex ?? state.weapon;
    const weapon = weapons[weaponIndex];
    const ammo = state.ammo[weaponIndex];
    if (!weapon || (target && !target.alive)) return false;
    const now = performance.now();
    if (state.reloadUntil > now || (state.lastFireAt && now < state.lastFireAt + weapon.cooldown)) return false;
    if (weapon.mag > 0 && ammo.mag <= 0) {
      beginReload();
      return false;
    }

    const count = Math.max(1, Math.round(options.count ?? 1));
    const damagePerMissile = (options.damage ?? weapon.damage) / count;
    const rightX = Math.cos(state.player.yaw);
    const rightZ = -Math.sin(state.player.yaw);
    const direction = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(state.player.pitch, state.player.yaw, 0, 'YXZ')
    ).normalize();
    const targetPoint = target
      ? new THREE.Vector3(target.x, target.targetY, target.z - 10)
      : null;

    if (weapon.mag > 0) ammo.mag--;
    state.lastFireAt = now;
    state.shots++;

    for (let index = 0; index < count; index++) {
      const lane = index - (count - 1) / 2;
      const launchOffset = (options.muzzleOffset ?? 6.5) + lane * (options.launchSpacing ?? 0.9);
      const start = new THREE.Vector3(
        state.player.x + rightX * launchOffset,
        (options.launchHeight ?? 12.8) + lane * (options.verticalSpread ?? 0.22),
        state.player.z + rightZ * launchOffset - 12
      );
      const destination = targetPoint?.clone() || start.clone().addScaledVector(direction, weapon.range);
      const sprite = !state.fallback && scene
        ? makeImageSprite(scene, 'hailstormRocket', 0.75, 'weaponSprite')
        : null;
      if (sprite) sprite.material.color.set(options.tint || weapon.color);
      sprite?.position.copy(start);
      missiles.push({
        object: sprite,
        start,
        target,
        end: destination,
        age: -index * (options.stagger ?? 0.035),
        duration: state.fallback ? (options.fallbackDuration ?? 0.42) : (options.duration ?? 0.78),
        damage: damagePerMissile,
        position: start.clone(),
        arcRightX: rightX,
        arcRightZ: rightZ,
        arc: options.arc ?? 0,
        spriteScale: options.spriteScale ?? 1,
        impactColor: options.impactColor || weapon.color,
        impactScale: options.impactScale ?? 5
      });
      makeBeam(start, start.clone().addScaledVector(direction, -8),
        options.trailColor || weapon.color, 0.15, options.trailLife ?? 0.38);
    }

    window.OrbitronAudio?.play('missile', {
      power: options.audioPower ?? 1,
      pan: target ? Math.sign(target.x - state.player.x) * 0.3 : 0
    });
    updateHUD(true);
    return true;
  }

  function fireChargedMissile(charge = state.heavyCharge) {
    const fraction = Math.min(1, Math.max(0.22, charge / 1.05));
    const targetInfo = getAimedTarget(weapons[2].range);
    state.heavyCharging = false;
    state.heavyCharge = 0;
    return launchMissileSalvo(targetInfo?.target || null, {
      weaponIndex: 2,
      damage: weapons[2].damage * fraction,
      duration: 0.92,
      spriteScale: 1.65,
      arc: 13,
      tint: '#d8c7ff',
      trailColor: '#c5a5ff',
      impactColor: weapons[2].color,
      impactScale: 11,
      audioPower: 0.7 + fraction * 0.55
    });
  }

  function fireSelectedWeapon(force = false) {
    if (state.mode !== 'playing') return false;
    const weapon = weapons[state.weapon];
    const now = performance.now();
    if (state.reloadUntil > now || (state.lastFireAt && now < state.lastFireAt + weapon.cooldown)) return false;
    if (state.weapon === 2 && !force) {
      state.heavyCharging = true;
      state.heavyCharge = 0;
      return true;
    }
    if (weapon.mag > 0 && state.ammo[state.weapon].mag <= 0) {
      beginReload();
      return false;
    }
    if (state.weapon === 0) {
      const targetInfo = getAimedTarget(weapon.range);
      return launchMissileSalvo(targetInfo?.target || null, {
        weaponIndex: 0,
        duration: 0.38,
        spriteScale: 0.72,
        arc: 7,
        launchSpacing: 0.4,
        tint: '#bafff8',
        trailColor: '#87f6f0',
        impactColor: weapon.color,
        impactScale: 4
      });
    }
    if (state.weapon === 1) {
      const target = state.target?.alive ? state.target : null;
      if (!target || state.lockProgress < 1) {
        showCallout('HAILSTORM GUIDANCE // ACQUIRE A Q-LOCK');
        window.OrbitronAudio?.play('warning');
        return false;
      }
      return launchMissileSalvo(target, {
        weaponIndex: 1,
        count: 3,
        duration: 0.78,
        fallbackDuration: 0.42,
        spriteScale: 1,
        arc: 24,
        launchSpacing: 1.2,
        stagger: 0.045,
        tint: '#ffd2a0',
        trailColor: '#ffbe68',
        impactColor: weapon.color,
        impactScale: 7
      });
    }
    if (state.weapon === 2) {
      return fireChargedMissile(force ? Math.max(0.78, state.heavyCharge) : state.heavyCharge);
    }
    const target = getCloseRangeTarget();
    if (!target) {
      showCallout('THUNDERHEAD // TARGET MUST BE WITHIN 48M');
      window.OrbitronAudio?.play('warning');
      return false;
    }
    return launchMissileSalvo(target, {
      weaponIndex: 3,
      count: 6,
      duration: 0.3,
      fallbackDuration: 0.42,
      spriteScale: 0.62,
      arc: 5,
      launchSpacing: 0.75,
      verticalSpread: 0.3,
      stagger: 0.025,
      tint: '#ffb3a8',
      trailColor: '#ff7768',
      impactColor: weapon.color,
      impactScale: 8,
      audioPower: 1.2
    });
  }

  function beginReload() {
    if (state.weapon === 3 || state.reloadUntil > performance.now()) return false;
    const weapon = weapons[state.weapon];
    const ammo = state.ammo[state.weapon];
    if (ammo.mag >= weapon.mag || ammo.reserve <= 0) {
      window.OrbitronAudio?.play('empty');
      return false;
    }
    state.reloadUntil = performance.now() + (state.weapon === 2 ? 2050 : state.weapon === 1 ? 1700 : 1250);
    showCallout(`${weapon.name} // RELOADING`);
    window.OrbitronAudio?.play('reload');
    return true;
  }

  function finishReload() {
    const weapon = weapons[state.weapon];
    const ammo = state.ammo[state.weapon];
    const fill = Math.min(weapon.mag - ammo.mag, ammo.reserve);
    ammo.mag += fill;
    ammo.reserve -= fill;
    state.reloadUntil = 0;
    updateHUD(true);
  }

  function selectWeapon(index) {
    if (!Number.isInteger(index) || index < 0 || index >= weapons.length) return false;
    if (state.heavyCharging && state.heavyCharge >= 0.28) fireChargedMissile();
    state.heavyCharging = false;
    state.weapon = index;
    renderWeaponState();
    window.OrbitronAudio?.play('confirm');
    return true;
  }

  function renderWeaponState() {
    const weapon = weapons[state.weapon];
    $('#weapon-readout-type').textContent = `${String(state.weapon + 1).padStart(2, '0')} // ${weapon.name}`;
    $('#weapon-readout-name').textContent = weapon.full;
    document.querySelectorAll('.weapon-card').forEach((button, index) =>
      button.classList.toggle('is-active', index === state.weapon)
    );
    updateHUD(true);
  }

  function activateOverdrive() {
    const now = performance.now();
    if (state.mode !== 'playing' || now < state.overdriveCooldown) return false;
    state.overdriveUntil = now + 8500;
    state.overdriveCooldown = now + 26000;
    showCallout('CONN-POD OVERDRIVE // NEURAL LINK AT 118%');
    window.OrbitronAudio?.play('boost', { power: 1.15 });
    window.OrbitronAudio?.setTension(0.9);
    updateHUD(true);
    return true;
  }

  function movePlayer(dt) {
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) - touchMove.y;
    const sideways = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touchMove.x;
    const length = Math.hypot(forward, sideways);
    const boosted = state.boostHeld && state.player.boost > 0.5;
    const speed = boosted ? 33 : 21;
    if (length > 0.04) {
      const cos = Math.cos(state.player.yaw);
      const sin = Math.sin(state.player.yaw);
      const dx = ((sideways * cos) - (forward * sin)) / length * speed * dt;
      const dz = (-(sideways * sin) - (forward * cos)) / length * speed * dt;
      const nextX = state.player.x + dx;
      const nextZ = state.player.z + dz;
      let moved = false;
      if (canOccupyPlayer(nextX, state.player.z)) { state.player.x = nextX; moved = true; }
      if (canOccupyPlayer(state.player.x, nextZ)) { state.player.z = nextZ; moved = true; }
      if (moved && performance.now() > state.lastStepAt + (boosted ? 530 : 820)) {
        state.lastStepAt = performance.now();
        window.OrbitronAudio?.play(boosted ? 'stomp' : 'step', { pan: sideways * 0.36, power: boosted ? 1.2 : 0.85 });
      }
    }
    if (boosted) state.player.boost = Math.max(0, state.player.boost - 31 * dt);
    else state.player.boost = Math.min(100, state.player.boost + 12 * dt);
    if (state.shieldHeld && state.player.shield > 0.2) state.player.shield = Math.max(0, state.player.shield - 17 * dt);
    else state.player.shield = Math.min(100, state.player.shield + 8 * dt);
    if (state.heavyCharging) {
      state.heavyCharge = Math.min(1.15, state.heavyCharge + dt);
      if (state.heavyCharge >= 1.15) fireChargedMissile(state.heavyCharge);
    }
    if (state.firing && state.weapon === 0) fireSelectedWeapon();
    if (state.reloadUntil && performance.now() >= state.reloadUntil) finishReload();
    if (performance.now() < state.overdriveUntil && state.overdriveUntil - performance.now() < 100) {
      window.OrbitronAudio?.setTension(0.62);
    }
    positionCamera();
    window.OrbitronAudio?.setEngineIntensity(length ? (boosted ? 0.96 : 0.58) : 0.2);
  }

  function nearestTargetForAlly(ally) {
    return state.kaiju.filter(kaiju => kaiju.alive)
      .sort((a, b) => Math.hypot(a.x - ally.x, a.z - ally.z) - Math.hypot(b.x - ally.x, b.z - ally.z))[0];
  }

  function updateAllies(dt, now) {
    for (const ally of state.allies) {
      if (!ally.alive) continue;
      ally.bob += dt * 4.5;
      const target = nearestTargetForAlly(ally);
      if (!target) continue;
      const dx = target.x - ally.x;
      const dz = target.z - ally.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 50) {
        ally.x += (dx / distance) * Math.min(distance - 48, 9 * dt);
        ally.z += (dz / distance) * Math.min(distance - 48, 9 * dt);
      }
      ally.yaw = Math.atan2(-dx, -dz);
      if (ally.root) {
        ally.root.position.set(ally.x, Math.sin(ally.bob) * 0.32, ally.z);
        ally.root.rotation.y = ally.yaw;
      }
      if (now > ally.nextFireAt && distance < 245) {
        ally.nextFireAt = now + 1280 + Math.random() * 480;
        damageKaiju(target, 21 + Math.random() * 10, '#79dfda');
        if (Math.random() < 0.6) {
          const start = new THREE.Vector3(ally.x, 12, ally.z - 3);
          const end = new THREE.Vector3(target.x, 24, target.z - 8);
          makeBeam(start, end, '#82dfde', 0.1, 0.18);
        }
      }
    }
  }

  function updateKaiju(dt, now) {
    for (const kaiju of state.kaiju) {
      if (!kaiju.alive) continue;
      const targets = [{ x: state.player.x, z: state.player.z, player: true }, ...state.allies.filter(ally => ally.alive)];
      const target = targets.sort((a, b) =>
        Math.hypot(a.x - kaiju.x, a.z - kaiju.z) - Math.hypot(b.x - kaiju.x, b.z - kaiju.z)
      )[0];
      const dx = target.x - kaiju.x;
      const dz = target.z - kaiju.z;
      const distance = Math.hypot(dx, dz);
      kaiju.phase += dt * (distance > 45 ? 1.5 : 3.5);
      kaiju.yaw = Math.atan2(-dx, -dz);
      if (distance > 35) {
        kaiju.x += dx / distance * kaiju.speed * dt;
        kaiju.z += dz / distance * kaiju.speed * dt;
      }
      if (kaiju.root) {
        kaiju.root.position.x = kaiju.x;
        kaiju.root.position.z = kaiju.z;
        kaiju.root.rotation.y = kaiju.yaw;
        kaiju.root.position.y = Math.sin(kaiju.phase * 2) * 0.2;
      }
      if (!state.disableAI && now >= kaiju.nextAttackAt && distance < 245) {
        kaiju.nextAttackAt = now + 2450 + Math.random() * 1700;
        launchKaijuAttack(kaiju, target);
      }
      if (!state.disableAI && now >= kaiju.nextRoarAt) {
        kaiju.nextRoarAt = now + 9600 + Math.random() * 8000;
        window.OrbitronAudio?.play('bellow', { pan: Math.sign(kaiju.x - state.player.x) * 0.72, power: 1 });
        showCallout(`${kaiju.name} // SONAR SIGNATURE RISING`);
      }
    }
  }

  function updateMissiles(dt) {
    for (let i = missiles.length - 1; i >= 0; i--) {
      const missile = missiles[i];
      missile.age += dt;
      if (missile.age < 0) continue;
      const progress = Math.min(1, missile.age / missile.duration);
      if (missile.target && !missile.target.alive) {
        if (missile.object) {
          scene?.remove(missile.object);
          missile.object.material?.dispose();
        }
        missiles.splice(i, 1);
        continue;
      }
      const destination = missile.target
        ? new THREE.Vector3(missile.target.x, missile.target.targetY, missile.target.z - 10)
        : missile.end;
      missile.position.lerpVectors(missile.start, destination, progress);
      if (!state.fallback) {
        const arc = Math.sin(progress * Math.PI) * missile.arc;
        missile.position.x += missile.arcRightX * arc;
        missile.position.z += missile.arcRightZ * arc;
      }
      if (missile.object) {
        missile.object.position.copy(missile.position);
        if (camera) {
          const from = missile.start.clone().project(camera);
          const to = destination.clone().project(camera);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          if (Math.hypot(dx, dy) > 0.04) missile.object.material.rotation = Math.atan2(dy, dx);
          const cameraDistance = camera.position.distanceTo(missile.position);
          const spriteHeight = clamp(cameraDistance * 0.08, 1.4, 12.5) * missile.spriteScale;
          missile.object.scale.set(
            spriteHeight * artAspect('hailstormRocket', BLACK_TIDE_EFFECTS.hailstormRocket.aspect),
            spriteHeight,
            1
          );
        }
        missile.object.material.opacity = Math.max(0.55, 1 - progress * 0.45);
      }
      if (progress >= 1) {
        if (missile.object) {
          scene?.remove(missile.object);
          missile.object.material?.dispose();
        }
        missiles.splice(i, 1);
        if (missile.target) damageKaiju(missile.target, missile.damage, missile.impactColor);
        makeExplosion(destination.x, destination.y, destination.z, missile.impactColor, missile.impactScale);
      }
    }
  }

  function updateEffects(dt) {
    for (let i = visualEffects.length - 1; i >= 0; i--) {
      const effect = visualEffects[i];
      effect.life -= dt;
      if (effect.explosionScale) {
        const progress = 1 - Math.max(0, effect.life / effect.maxLife);
        const size = 1 + progress * effect.explosionScale;
        effect.object.scale.setScalar(size);
        if (effect.object.material) effect.object.material.opacity = Math.max(0, 0.83 * (1 - progress));
      } else if (!effect.beam && effect.object.material) {
        effect.object.material.opacity = Math.max(0, effect.life / effect.maxLife);
      } else if (effect.beam && effect.object.material) {
        effect.object.material.opacity = Math.max(0, effect.life / effect.maxLife);
      }
      if (effect.life <= 0) {
        scene?.remove(effect.object);
        effect.object.geometry?.dispose();
        effect.object.material?.dispose();
        visualEffects.splice(i, 1);
      }
    }
    for (let i = fallbackTracers.length - 1; i >= 0; i--) {
      fallbackTracers[i].life -= dt;
      if (fallbackTracers[i].life <= 0) fallbackTracers.splice(i, 1);
    }
  }

  function updateHUD(force = false) {
    if (state.mode !== 'playing' && !force) return;
    const wholeSeconds = Math.max(0, Math.ceil(state.seconds));
    $('#mission-clock').textContent = `${String(Math.floor(wholeSeconds / 60)).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`;
    $('#armor-value').textContent = `${Math.ceil(state.player.health)}%`;
    $('#armor-fill').style.width = `${state.player.health}%`;
    $('#shield-value').textContent = `${Math.ceil(state.player.shield)}%`;
    $('#shield-fill').style.width = `${state.player.shield}%`;
    $('#boost-value').textContent = `${Math.ceil(state.player.boost)}%`;
    $('#boost-fill').style.width = `${state.player.boost}%`;
    const now = performance.now();
    const overdrive = $('#overdrive-value');
    overdrive.textContent = now < state.overdriveUntil ? 'ACTIVE' : now < state.overdriveCooldown
      ? `${Math.ceil((state.overdriveCooldown - now) / 1000)}S` : 'READY';
    $('#threat-count').textContent = `${state.kaiju.filter(kaiju => kaiju.alive).length} TITANS ACTIVE`;
    $('#kaiju-bars').innerHTML = state.kaiju.map(kaiju =>
      `<div class="kaiju-bar" title="${kaiju.name}"><i style="width:${Math.max(0, kaiju.health / kaiju.maxHealth * 100)}%"></i></div>`
    ).join('');
    const statuses = [{ name: 'YOU', health: state.player.health > 0 }, ...state.allies.map(ally => ({ name: ally.name, health: ally.alive }))];
    $('#squad-status').innerHTML = statuses.map(member =>
      `<span>${member.name}<i style="opacity:${member.health ? 1 : 0.15}"></i></span>`
    ).join('');
    state.ammo.forEach((ammo, index) => {
      const label = index === 3 ? '6-PACK READY' : `${ammo.mag} / ${ammo.reserve}`;
      $(`#ammo-${index}`).textContent = state.reloadUntil && state.weapon === index ? 'RELOADING' : label;
    });
    const currentAmmo = state.ammo[state.weapon];
    $('#mag-value').textContent = state.weapon === 3 ? '6' : currentAmmo.mag;
    $('#reserve-value').textContent = state.weapon === 3 ? '∞' : currentAmmo.reserve;
    const aimed = getAimedTarget(520);
    const target = state.target?.alive ? state.target : aimed?.target || null;
    const bracket = $('#target-bracket');
    if (target && state.mode === 'playing') {
      bracket.classList.remove('hidden');
      $('#target-name').textContent = target.name;
      $('#target-class').textContent = target.className;
      $('#target-health-fill').style.width = `${Math.max(0, target.health / target.maxHealth * 100)}%`;
      $('#target-distance').textContent = `RANGE ${Math.round(Math.hypot(target.x - state.player.x, target.z - state.player.z))} M`;
      const lock = $('#lock-indicator');
      if (state.lockProgress >= 1 && state.target === target) {
        lock.textContent = 'TARGET LOCK // GUIDANCE READY';
        lock.classList.add('locked');
      } else if (state.target === target) {
        lock.textContent = `LOCK ACQUIRING // ${Math.floor(state.lockProgress * 100)}%`;
        lock.classList.remove('locked');
      } else {
        lock.textContent = 'Q // ACQUIRE TARGET';
        lock.classList.remove('locked');
      }
    } else {
      bracket.classList.add('hidden');
      $('#lock-indicator').textContent = 'Q // ACQUIRE TARGET';
      $('#lock-indicator').classList.remove('locked');
    }
  }

  function drawRadar() {
    const canvas = $('#radar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(4,17,22,.64)';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(116,229,220,.2)';
    ctx.lineWidth = 1;
    [30, 60, 88].forEach(radius => {
      ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(center, 0); ctx.lineTo(center, size); ctx.moveTo(0, center); ctx.lineTo(size, center); ctx.stroke();
    const range = 400;
    const plot = (x, z, color, radius) => {
      const dx = x - state.player.x;
      const dz = z - state.player.z;
      const angle = Math.atan2(dx, -dz) - state.player.yaw;
      const distance = Math.min(1, Math.hypot(dx, dz) / range) * 82;
      const px = center + Math.sin(angle) * distance;
      const py = center - Math.cos(angle) * distance;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    };
    state.kaiju.filter(unit => unit.alive).forEach(unit => plot(unit.x, unit.z, '#ff796c', 5));
    state.allies.filter(unit => unit.alive).forEach(unit => plot(unit.x, unit.z, '#75e8d2', 3));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(center, center - 6); ctx.lineTo(center - 4, center + 4); ctx.lineTo(center + 4, center + 4); ctx.closePath(); ctx.fill();
  }

  function updateGame(dt) {
    if (state.mode !== 'playing') return;
    const now = performance.now();
    state.seconds -= dt;
    if (state.seconds <= 0) {
      state.seconds = 0;
      finishMission(false, 'SECTOR NOT SECURED');
      return;
    }
    movePlayer(dt);
    if (!state.disableAI) {
      updateAllies(dt, now);
      updateKaiju(dt, now);
    }
    updateKaijuAttacks(dt);
    if (state.target?.alive) {
      const distance = Math.hypot(state.target.x - state.player.x, state.target.z - state.player.z);
      if (distance < 390) state.lockProgress = Math.min(1, state.lockProgress + dt * 0.84);
      else state.lockProgress = Math.max(0, state.lockProgress - dt * 0.4);
    } else {
      state.target = null;
      state.lockProgress = 0;
    }
    updateMissiles(dt);
    if (rainPositions) {
      const positions = rain.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= dt * (35 + (i % 5) * 3);
        positions[i] += dt * 5;
        if (positions[i + 1] < 0) {
          positions[i + 1] = 115;
          positions[i] = state.player.x + (Math.random() - 0.5) * 480;
          positions[i + 2] = state.player.z + (Math.random() - 0.5) * 480;
        }
      }
      rain.geometry.attributes.position.needsUpdate = true;
      rain.position.set(state.player.x * 0.18, 0, state.player.z * 0.18);
    }
    state.timeSinceHud += dt;
    if (state.timeSinceHud > 0.1) {
      state.timeSinceHud = 0;
      updateHUD();
    }
    state.timeSinceRadar += dt;
    if (state.timeSinceRadar > 0.18) {
      state.timeSinceRadar = 0;
      drawRadar();
    }
  }

  function drawFallback() {
    const ctx = fallbackContext;
    const width = innerWidth;
    const height = innerHeight;
    const coastImage = artImages.coast;
    if (coastImage.complete && coastImage.naturalWidth) {
      const viewHeight = height * 0.88;
      const scale = Math.max(width / coastImage.width, viewHeight / coastImage.height);
      const imageWidth = coastImage.width * scale;
      const imageHeight = coastImage.height * scale;
      ctx.drawImage(coastImage, (width - imageWidth) / 2, (viewHeight - imageHeight) / 2, imageWidth, imageHeight);
      const shade = ctx.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, 'rgba(2,9,16,.18)');
      shade.addColorStop(0.63, 'rgba(3,12,18,.20)');
      shade.addColorStop(1, 'rgba(3,9,14,.83)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, height * 0.72);
      sky.addColorStop(0, '#273e49');
      sky.addColorStop(0.52, '#82999b');
      sky.addColorStop(1, '#d0c2a0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = 'rgba(18,31,34,.50)';
    ctx.fillRect(0, height * 0.64, width, height * 0.24);
    for (let i = 0; i < 45; i++) {
      const x = ((i * 97 + 21) % width);
      const base = height * (0.63 - (i % 4) * 0.025);
      const w = 14 + (i % 5) * 8;
      const h = 22 + (i * 19 % 80);
      ctx.fillStyle = i % 3 ? 'rgba(14,27,31,.82)' : 'rgba(34,46,47,.78)';
      ctx.fillRect(x, base - h, w, h);
      ctx.fillStyle = 'rgba(239,201,129,.58)';
      for (let row = 0; row < Math.floor(h / 12); row++) ctx.fillRect(x + 3, base - h + row * 12 + 5, 3, 3);
    }
    state.allies.filter(unit => unit.alive).forEach(unit => {
      const dx = unit.x - state.player.x;
      const dz = unit.z - state.player.z;
      let angle = Math.atan2(-dx, -dz) - state.player.yaw;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      const distance = Math.hypot(dx, dz);
      if (Math.abs(angle) > 1.02) return;
      const image = artImages[unit.id];
      if (!image?.complete || !image.naturalWidth) return;
      const spriteHeight = clamp(width * 10 / Math.max(32, distance), 34, height * 0.34);
      const x = width / 2 + angle * width * 0.55;
      const y = height * 0.78;
      const spriteWidth = spriteHeight * artAspect(unit.id, BLACK_TIDE_ART[unit.id].aspect);
      ctx.drawImage(image, x - spriteWidth / 2, y - spriteHeight, spriteWidth, spriteHeight);
      ctx.fillStyle = '#9ffff0';
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(unit.name, x, y - spriteHeight - 5);
    });
    const visible = state.kaiju.filter(unit => unit.alive).map(unit => {
      const dx = unit.x - state.player.x;
      const dz = unit.z - state.player.z;
      let angle = Math.atan2(-dx, -dz) - state.player.yaw;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return { unit, distance: Math.hypot(dx, dz), angle };
    }).filter(item => Math.abs(item.angle) < 0.85).sort((a, b) => b.distance - a.distance);
    visible.forEach(({ unit, distance, angle }) => {
      const scale = clamp(width * 62 / Math.max(60, distance), 34, height * 0.76);
      const x = width / 2 + angle * width * 0.55;
      const y = height * 0.61;
      const image = artImages[unit.id];
      if (image?.complete && image.naturalWidth) {
        const spriteHeight = scale * 1.14;
        const spriteWidth = spriteHeight * artAspect(unit.id, BLACK_TIDE_ART[unit.id].aspect);
        ctx.drawImage(image, x - spriteWidth / 2, y - spriteHeight * 0.92, spriteWidth, spriteHeight);
      } else {
        ctx.fillStyle = unit.id === 'tidebreaker' ? '#253b3b' : '#563d3d';
        ctx.beginPath();
        ctx.ellipse(x, y - scale * 0.28, scale * 0.22, scale * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - scale * 0.16, y - scale * 0.29, scale * 0.32, scale * 0.42);
        ctx.fillStyle = '#ff665d';
        ctx.fillRect(x - scale * 0.09, y - scale * 0.58, scale * 0.18, scale * 0.025);
      }
      ctx.fillStyle = '#e9b688';
      ctx.font = '700 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${unit.name} // ${Math.ceil(unit.health / unit.maxHealth * 100)}%`, x, y - scale * 0.72);
    });
    missiles.forEach(missile => {
      const image = artImages.hailstormRocket;
      if (!image?.complete || !image.naturalWidth || !missile.position) return;
      const dx = missile.position.x - state.player.x;
      const dz = missile.position.z - state.player.z;
      let angle = Math.atan2(-dx, -dz) - state.player.yaw;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      if (Math.abs(angle) > 1.02) return;
      const distance = Math.hypot(dx, dz);
      const x = width / 2 + angle * width * 0.55;
      const progress = clamp(missile.age / missile.duration, 0, 1);
      const y = height * (0.77 - progress * 0.16);
      const startDx = missile.start.x - state.player.x;
      const startDz = missile.start.z - state.player.z;
      let startAngle = Math.atan2(-startDx, -startDz) - state.player.yaw;
      while (startAngle > Math.PI) startAngle -= Math.PI * 2;
      while (startAngle < -Math.PI) startAngle += Math.PI * 2;
      const horizontalMotion = (angle - startAngle) * width * 0.55;
      const rotation = Math.atan2(-height * 0.16, horizontalMotion || 0.001);
      const spriteHeight = clamp(width * 1.1 / Math.max(40, distance), 10, height * 0.045);
      const spriteWidth = spriteHeight * artAspect('hailstormRocket', BLACK_TIDE_EFFECTS.hailstormRocket.aspect);
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(image, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
      ctx.restore();
    });
    const projectAttackPoint = point => {
      const dx = point.x - state.player.x;
      const dz = point.z - state.player.z;
      let angle = Math.atan2(-dx, -dz) - state.player.yaw;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      const distance = Math.hypot(dx, dz);
      return {
        x: width / 2 + angle * width * 0.55,
        y: height * 0.56 - clamp((point.y - 13) / Math.max(45, distance), -0.3, 0.3) * height * 0.55,
        distance, angle
      };
    };
    kaijuAttacks.forEach(attack => {
      const fade = attack.type === 'laser'
        ? clamp((attack.age - attack.config.windup) / attack.config.beamLife, 0, 1)
        : clamp(attack.age / attack.duration, 0, 1);
      const alpha = attack.type === 'laser' && attack.age < attack.config.windup
        ? 0.58 + Math.sin(attack.age * 44) * 0.24
        : 1 - fade * 0.2;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0.22, 1);
      ctx.lineCap = 'round';
      if (attack.type === 'laser') {
        const start = projectAttackPoint(attack.start);
        const end = projectAttackPoint(attack.end);
        if (attack.age >= attack.config.windup && (Math.abs(start.angle) < 1.2 || Math.abs(end.angle) < 1.2)) {
          ctx.shadowColor = attack.config.color;
          ctx.shadowBlur = 32;
          ctx.strokeStyle = attack.config.color;
          ctx.lineWidth = Math.max(11, width * 0.014);
          ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
          ctx.shadowBlur = 18;
          ctx.strokeStyle = '#ffb9fb';
          ctx.lineWidth = Math.max(5, width * 0.006);
          ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(2, width * 0.002);
          ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        } else if (attack.age < attack.config.windup && Math.abs(start.angle) < 1.2) {
          ctx.shadowColor = attack.config.color;
          ctx.shadowBlur = 24;
          ctx.fillStyle = attack.config.core;
          ctx.beginPath(); ctx.arc(start.x, start.y, Math.max(7, width * 0.009), 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const point = projectAttackPoint(attack.position);
        const previous = projectAttackPoint(attack.previousPosition);
        if (Math.abs(point.angle) < 1.15) {
          const size = clamp(width * (attack.type === 'fire' ? 7 : 5.5) / Math.max(45, point.distance), 7, height * 0.085);
          ctx.shadowColor = attack.config.color;
          ctx.shadowBlur = attack.type === 'fire' ? 30 : 20;
          ctx.strokeStyle = attack.config.color;
          ctx.lineWidth = Math.max(3, size * 0.52);
          ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke();
          ctx.fillStyle = attack.config.color;
          ctx.beginPath(); ctx.ellipse(point.x, point.y, size * 0.72, size, attack.age * 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = attack.config.core;
          ctx.beginPath(); ctx.ellipse(point.x, point.y, size * 0.34, size * 0.48, -attack.age, 0, Math.PI * 2); ctx.fill();
          if (attack.type === 'acid') {
            ctx.fillStyle = '#ddff58';
            ctx.beginPath(); ctx.arc(point.x + size * 0.72, point.y - size * 0.55, size * 0.18, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(point.x - size * 0.58, point.y + size * 0.4, size * 0.13, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.restore();
    });
    ctx.strokeStyle = '#a9fff1';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(width / 2, height / 2, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width / 2 - 25, height / 2); ctx.lineTo(width / 2 + 25, height / 2);
    ctx.moveTo(width / 2, height / 2 - 25); ctx.lineTo(width / 2, height / 2 + 25); ctx.stroke();
    ctx.fillStyle = 'rgba(5,11,15,.82)';
    ctx.fillRect(0, height * 0.84, width, height * 0.16);
    ctx.strokeStyle = '#8ef4ec55';
    ctx.strokeRect(12, 12, width - 24, height - 24);
    fallbackTracers.forEach(tracer => {
      ctx.strokeStyle = tracer.color;
      ctx.globalAlpha = Math.max(0, tracer.life / tracer.maxLife);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(width / 2, height / 2); ctx.lineTo(width / 2 + (tracer.x2 - tracer.x1) * 1.1, height / 2 - (tracer.z2 - tracer.z1) * 0.8); ctx.stroke();
      const image = tracer.spriteId ? artImages[tracer.spriteId] : null;
      if (image?.complete && image.naturalWidth) {
        let angle = Math.atan2(-(tracer.x2 - tracer.x1), -(tracer.z2 - tracer.z1)) - state.player.yaw;
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        if (Math.abs(angle) < 1.25) {
          const distance = Math.hypot(tracer.x2 - state.player.x, tracer.z2 - state.player.z);
          const spriteHeight = clamp(width * 1.4 / Math.max(70, distance), 10, height * 0.06);
          const spriteWidth = spriteHeight * artAspect(tracer.spriteId, BLACK_TIDE_EFFECTS[tracer.spriteId]?.aspect || 1);
          const directionX = Math.sin(angle);
          const directionY = -Math.cos(angle);
          ctx.save();
          ctx.globalAlpha = Math.max(0, tracer.life / tracer.maxLife);
          ctx.translate(width / 2 + angle * width * 0.55, height / 2);
          ctx.rotate(Math.atan2(directionY, directionX));
          ctx.drawImage(image, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
          ctx.restore();
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  function frame(time) {
    const elapsed = Math.min(0.12, Math.max(0, (time - lastFrame) / 1000 || 0));
    lastFrame = time;
    accumulator = Math.min(0.12, accumulator + elapsed);
    let steps = 0;
    while (accumulator >= simulationStep && steps < 7) {
      updateGame(simulationStep);
      updateEffects(simulationStep);
      accumulator -= simulationStep;
      steps++;
    }
    if (state.fallback) {
      drawFallback();
    } else if (renderer && scene && camera) {
      positionCamera();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  function setAimFromDelta(dx, dy) {
    state.player.yaw -= dx * 0.0022;
    state.player.pitch = clamp(state.player.pitch - dy * 0.0020, -0.58, 0.45);
    positionCamera();
  }

  function startFiring() {
    if (state.mode !== 'playing') return;
    if (state.weapon === 2) {
      if (!state.heavyCharging) {
        state.heavyCharging = true;
        state.heavyCharge = 0;
        window.OrbitronAudio?.play('radio');
      }
      return;
    }
    fireSelectedWeapon();
    if (state.weapon === 0) state.firing = true;
  }

  function stopFiring() {
    state.firing = false;
    if (state.heavyCharging) {
      state.heavyCharging = false;
      if (state.heavyCharge >= 0.2) fireChargedMissile(state.heavyCharge);
      else state.heavyCharge = 0;
    }
  }

  function bindTouch() {
    const stick = $('#move-stick');
    let stickPointer = null;
    const stickUpdate = event => {
      if (stickPointer !== event.pointerId) return;
      const rect = stick.getBoundingClientRect();
      const dx = (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.36);
      const dy = (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.36);
      touchMove = { x: clamp(dx, -1, 1), y: clamp(dy, -1, 1) };
      const knob = stick.querySelector('i');
      knob.style.transform = `translate(${touchMove.x * 22}px, ${touchMove.y * 22}px)`;
    };
    stick.addEventListener('pointerdown', event => {
      event.preventDefault(); stickPointer = event.pointerId; stick.setPointerCapture(event.pointerId); stickUpdate(event);
    });
    stick.addEventListener('pointermove', stickUpdate);
    const releaseStick = event => {
      if (event.pointerId !== stickPointer) return;
      stickPointer = null; touchMove = { x: 0, y: 0 };
      stick.querySelector('i').style.transform = '';
    };
    stick.addEventListener('pointerup', releaseStick);
    stick.addEventListener('pointercancel', releaseStick);

    let lastLook = null;
    const look = $('#look-zone');
    look.addEventListener('pointerdown', event => { lastLook = { id: event.pointerId, x: event.clientX, y: event.clientY }; look.setPointerCapture(event.pointerId); });
    look.addEventListener('pointermove', event => {
      if (!lastLook || lastLook.id !== event.pointerId) return;
      setAimFromDelta(event.clientX - lastLook.x, event.clientY - lastLook.y);
      lastLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    const releaseLook = event => { if (lastLook?.id === event.pointerId) lastLook = null; };
    look.addEventListener('pointerup', releaseLook); look.addEventListener('pointercancel', releaseLook);

    const press = (selector, down, up = () => {}) => {
      const button = $(selector);
      button.addEventListener('pointerdown', event => { event.preventDefault(); down(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => button.addEventListener(type, event => { event.preventDefault(); up(); }));
    };
    press('#touch-fire', startFiring, stopFiring);
    press('#touch-lock', acquireTarget);
    press('#touch-boost', () => { state.boostHeld = true; window.OrbitronAudio?.play('boost'); }, () => { state.boostHeld = false; });
    press('#touch-shield', () => { state.shieldHeld = true; window.OrbitronAudio?.play('shield'); }, () => { state.shieldHeld = false; });
    $('#touch-reload').addEventListener('pointerdown', event => { event.preventDefault(); beginReload(); });
  }

  function attachEvents() {
    $('#deploy-button').addEventListener('click', () => startMission());
    $('#resume-button').addEventListener('click', pauseMission);
    $('#abort-button').addEventListener('click', () => {
      state.mode = 'menu';
      $('#pause-screen').classList.add('hidden');
      $('#mission-hud').classList.add('hidden');
      $('#mission-briefing').classList.remove('hidden');
      stopPointerLock();
      window.OrbitronAudio?.stop();
    });
    $('#replay-button').addEventListener('click', () => startMission());
    $('#briefing-button').addEventListener('click', () => {
      state.mode = 'menu';
      $('#result-screen').classList.add('hidden');
      $('#mission-briefing').classList.remove('hidden');
    });
    $('#weapon-dock').addEventListener('click', event => {
      const button = event.target.closest('[data-weapon]');
      if (button) selectWeapon(Number(button.dataset.weapon));
    });
    window.addEventListener('keydown', event => {
      if (event.code === 'Enter' && state.mode === 'menu') {
        event.preventDefault(); startMission(); return;
      }
      if (event.code === 'Escape') { event.preventDefault(); pauseMission(); return; }
      if (state.mode !== 'playing') return;
      keys.add(event.code);
      if (/^Digit[1-4]$/.test(event.code)) selectWeapon(Number(event.code.slice(-1)) - 1);
      if (event.code === 'KeyQ' && !event.repeat) acquireTarget();
      if (event.code === 'KeyR' && !event.repeat) beginReload();
      if (event.code === 'KeyF') {
        state.shieldHeld = true;
        if (!event.repeat) window.OrbitronAudio?.play('shield');
      }
      if (event.code === 'KeyE' && !event.repeat) activateOverdrive();
      if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat) {
        state.boostHeld = true;
        window.OrbitronAudio?.play('boost');
      }
      if (event.code === 'Space') { event.preventDefault(); startFiring(); }
      if (event.code === 'Tab') event.preventDefault();
    });
    window.addEventListener('keyup', event => {
      keys.delete(event.code);
      if (event.code === 'KeyF') state.shieldHeld = false;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') state.boostHeld = false;
      if (event.code === 'Space') stopFiring();
    });
    document.addEventListener('mousemove', event => {
      if (state.mode !== 'playing') return;
      if (document.pointerLockElement === renderer?.domElement) setAimFromDelta(event.movementX, event.movementY);
      else if (event.buttons === 1) setAimFromDelta(event.movementX || 0, event.movementY || 0);
    });
    document.addEventListener('mousedown', event => {
      if (state.mode !== 'playing' || event.target.closest('button, input, label, #orbitron-audio')) return;
      if (event.button === 0) startFiring();
      if (event.button === 2) acquireTarget();
      if (event.button === 0 && renderer && document.pointerLockElement !== renderer.domElement) {
        try { renderer.domElement.requestPointerLock?.(); } catch (_) {}
      }
    });
    document.addEventListener('mouseup', event => { if (event.button === 0) stopFiring(); });
    document.addEventListener('contextmenu', event => {
      if (state.mode === 'playing' || isTouchDevice()) event.preventDefault();
    });
    // A long-press on a touch control can summon the browser's native
    // "Copy/Select" callout independent of the CSS user-select/
    // touch-callout suppression on some Android builds. No selectstart
    // guard existed here at all before.
    window.addEventListener('selectstart', event => { if (isTouchDevice()) event.preventDefault(); });
    window.addEventListener('blur', () => {
      state.firing = false; state.shieldHeld = false; state.boostHeld = false; keys.clear();
    });
    window.addEventListener('resize', () => {
      if (renderer && camera) {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      }
      resizeFallback();
    });
    bindTouch();
  }

  if (!initializeRenderer()) return;
  buildWorld();
  attachEvents();
  updateHUD(true);
  drawRadar();
  requestAnimationFrame(frame);

  window.GNSKaijuCoast = {
    startMission,
    fireWeapon: () => fireSelectedWeapon(true),
    selectWeapon,
    aimAtTarget,
    acquireTarget,
    toggleShield(value) { state.shieldHeld = Boolean(value); },
    tick: updateGame,
    get state() {
      let actorSprites = 0;
      let proceduralActorMeshes = 0;
      const missingGeometryBounds = [];
      actorRoot?.traverse(node => {
        if (node.userData?.actorSprite) actorSprites++;
        else if (node.isMesh) proceduralActorMeshes++;
      });
      scene?.traverse(node => {
        if (node.geometry && node.geometry.boundingSphere === undefined) {
          missingGeometryBounds.push(`${node.type}:${node.geometry.type || 'unknown'}`);
        }
      });
      const visibleActorSprites = actorRoot?.children.reduce((count, actor) =>
        count + actor.children.filter(node => node.userData?.actorSprite && node.visible).length, 0
      ) || 0;
      return {
        mode: state.mode, fallback: state.fallback, seconds: state.seconds,
        weapon: state.weapon, shots: state.shots, kills: state.kills,
        player: { ...state.player }, allies: state.allies.map(unit => ({ id: unit.id, name: unit.name, x: unit.x, z: unit.z, alive: unit.alive, health: unit.health, yaw: unit.yaw || 0 })),
        kaiju: state.kaiju.map(unit => ({ id: unit.id, name: unit.name, x: unit.x, z: unit.z, alive: unit.alive, health: unit.health, maxHealth: unit.maxHealth, yaw: unit.yaw || 0, lastAttackType: unit.lastAttackType || null })),
        ammo: state.ammo.map(ammo => ({ ...ammo })), lockProgress: state.lockProgress,
        visuals: {
          actorSprites: state.fallback ? state.allies.length + state.kaiju.length : actorSprites,
          visibleActorSprites: state.fallback ? state.allies.length + state.kaiju.length : visibleActorSprites,
          proceduralActorMeshes,
          spriteOnlyActors: state.fallback
            ? state.allies.length + state.kaiju.length
            : actorRoot?.children.filter(node => node.userData?.spriteOnlyActor).length || 0,
          activeMissileSprites: state.fallback
            ? missiles.filter(missile => missile.position).length
            : missiles.filter(missile => missile.object?.userData?.weaponSprite === 'hailstormRocket').length,
          activeKaijuAttacks: kaijuAttacks.length,
          kaijuAttackDiagnostics: kaijuAttacks.map(attack => ({
            type: attack.type,
            position: attack.position.toArray(),
            start: attack.start.toArray(),
            end: attack.end.toArray(),
            age: attack.age,
            duration: attack.duration,
            visible: state.fallback || Boolean(attack.visual?.visible),
            visibleBeamParts: attack.visual?.children.filter(node => node.visible).length || 0
          })),
          weaponSpriteDiagnostics: {
            camera: camera ? {
              position: camera.position.toArray(),
              rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z]
            } : null,
            missiles: missiles.map(missile => ({
              position: missile.position?.toArray?.() || null,
              destination: missile.end?.toArray?.() || null,
              objectPosition: missile.object?.position.toArray() || null,
              screenPosition: camera && missile.object
                ? missile.object.position.clone().project(camera).toArray()
                : null,
              scale: missile.object?.scale.toArray() || null,
              rotation: missile.object?.material?.rotation ?? null,
              visible: missile.object?.visible ?? state.fallback,
              opacity: missile.object?.material?.opacity ?? null,
              imageSize: missile.object?.material?.map?.image
                ? [missile.object.material.map.image.width, missile.object.material.map.image.height]
                : null
            }))
          },
          missingGeometryBounds,
          jaegerRearImagesLoaded: ['marauder', 'anchor', 'wraith'].every(id =>
            artImages[id]?.complete && artImages[id].naturalWidth > 0
          ),
          kaijuFrontImagesLoaded: ['tidebreaker', 'riftmaw'].every(id =>
            artImages[id]?.complete && artImages[id].naturalWidth > 0
          ),
          missileSpriteLoaded: artImages.hailstormRocket?.complete && artImages.hailstormRocket.naturalWidth > 0,
        },
        artwork: Object.fromEntries(Object.entries(artImages).map(([id, image]) => [
          id, { loaded: image.complete && image.naturalWidth > 0, width: image.naturalWidth, height: image.naturalHeight }
        ]))
      };
    },
    testHooks: { triggerKaijuAttack }
  };
})();