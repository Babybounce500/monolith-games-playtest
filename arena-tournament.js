(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const arenaCards = [...document.querySelectorAll('[data-arena]')];
  const ARENAS = {
    'core-forge': {
      name: 'CORE FORGE',
      accent: '#ff7949',
      secondary: '#f3b465',
      floor: '#171921',
      wall: '#30323b',
      start: [0, 30],
      spawns: [
        [-29, -27], [29, -27], [-29, 26], [29, 26],
        [-35, 0], [35, 0], [-20, -34], [20, -34], [-20, 34], [20, 34]
      ],
      obstacles: [
        [-12, -12, 5, 5, 4], [12, -12, 5, 5, 4], [-12, 12, 5, 5, 4], [12, 12, 5, 5, 4],
        [-3, 0, 5, 13, 2.5], [3, 0, 5, 13, 2.5],
        [-23, 1, 8, 3, 2.4], [23, 1, 8, 3, 2.4],
        [0, -26, 11, 3, 2.2], [0, 26, 11, 3, 2.2]
      ],
      pillars: [[0, -17], [0, 17]]
    },
    'void-bridge': {
      name: 'VOID BRIDGE',
      accent: '#7792ff',
      secondary: '#57dbff',
      floor: '#111629',
      wall: '#262b43',
      start: [0, 33],
      spawns: [
        [-31, -28], [31, -28], [-33, 24], [32, 23],
        [-36, 0], [36, 0], [-20, -34], [20, -34], [-20, 34], [20, 34]
      ],
      obstacles: [
        [-16, -10, 12, 3, 2.2], [16, -10, 12, 3, 2.2],
        [-16, 10, 12, 3, 2.2], [16, 10, 12, 3, 2.2],
        [0, -21, 3, 12, 2.6], [0, 21, 3, 12, 2.6],
        [-28, 0, 3, 11, 2.4], [28, 0, 3, 11, 2.4],
        [-8, 0, 4, 8, 2], [8, 0, 4, 8, 2]
      ],
      pillars: [[-9, -18], [9, -18], [-9, 18], [9, 18]]
    },
    'ion-cathedral': {
      name: 'ION CATHEDRAL',
      accent: '#5de2bb',
      secondary: '#bb85ff',
      floor: '#101b1a',
      wall: '#263735',
      start: [0, 34],
      spawns: [
        [-31, -27], [31, -27], [-31, 25], [31, 25],
        [-35, 0], [35, 0], [-20, -34], [20, -34], [-20, 34], [20, 34]
      ],
      obstacles: [
        [-18, -18, 4, 4, 6], [18, -18, 4, 4, 6],
        [-18, 18, 4, 4, 6], [18, 18, 4, 4, 6],
        [-8, -7, 3, 13, 2.5], [8, -7, 3, 13, 2.5],
        [-8, 13, 3, 8, 2.5], [8, 13, 3, 8, 2.5],
        [0, -22, 12, 3, 2.3], [0, 22, 12, 3, 2.3],
        [0, 0, 5, 5, 1.8]
      ],
      pillars: [[-28, 0], [28, 0], [0, -30]]
    }
  };

  const BOT_ARCHETYPES = [
    { id: 'vanguard', name: 'VANGUARD', color: '#ff5867', weapon: 3, skill: 0.68 },
    { id: 'specter', name: 'SPECTER', color: '#5ca8ff', weapon: 0, skill: 0.76 },
    { id: 'sentinel', name: 'SENTINEL', color: '#64e1ac', weapon: 1, skill: 0.63 },
    { id: 'rogue', name: 'ROGUE', color: '#ffc166', weapon: 2, skill: 0.71 },
    { id: 'warden', name: 'WARDEN', color: '#c8eaff', weapon: 0, skill: 0.72 },
    { id: 'phantom', name: 'PHANTOM', color: '#c28aff', weapon: 1, skill: 0.78 },
    { id: 'bulwark', name: 'BULWARK', color: '#f2cd55', weapon: 3, skill: 0.66 },
    { id: 'voltage', name: 'VOLTAGE', color: '#59e6ff', weapon: 2, skill: 0.81 },
    { id: 'reaper', name: 'REAPER', color: '#fa5a8d', weapon: 1, skill: 0.79 },
    { id: 'nova', name: 'NOVA', color: '#ff9b56', weapon: 0, skill: 0.74 }
  ];

  const WEAPONS = [
    { id: 'laser-carbine', name: 'LASER CARBINE', short: 'LASER', key: '1', viewmodel: '02-laser-carbine.webp', color: '#ff405f', damage: 12, fireMs: 115, magSize: 42, reserve: 252, reloadMs: 850, automatic: true },
    { id: 'particle-beam', name: 'PARTICLE BEAM RIFLE', short: 'BEAM', key: '2', viewmodel: '04-particle-beam-rifle.webp', color: '#4ce7ff', damage: 17, fireMs: 190, magSize: 36, reserve: 216, reloadMs: 960, automatic: true },
    { id: 'ion-smg', name: 'ION SMG', short: 'ION', key: '3', viewmodel: '07-ion-smg.webp', color: '#b888ff', damage: 8, fireMs: 78, magSize: 54, reserve: 324, reloadMs: 900, automatic: true },
    { id: 'siege-gatling', name: 'SIEGE GATLING', short: 'GATLING', key: '4', viewmodel: '09-siege-gatling.webp', color: '#ff984d', damage: 7, fireMs: 65, magSize: 110, reserve: 660, reloadMs: 1650, automatic: true }
  ];
  const ARENA_ART_ROOT = 'assets/gns-deathmatch/';
  const BOT_ROOT = 'assets/gns-deathmatch/bots/';
  const WEAPON_VIEW_ROOT = 'assets/gns-deathmatch/weapons/';
  const MATCH_DEFAULT_SECONDS = 180;
  const STEP = 1 / 60;

  // =========================================================
  // AUDIO — GNS had no sound at all before this (confirmed by an
  // earlier audit pass). ElevenLabs-generated SFX loaded as
  // AudioBuffers (not <audio> elements) so rapid automatic-weapon
  // fire triggers overlapping BufferSource instances instead of
  // cutting itself off. Falls back silently to no sound for any
  // weapon without a dedicated buffer (only 4 of 10 weapons are
  // active in this build; ion-smg has no dedicated SFX yet).
  // =========================================================
  const SFX_BASE = 'assets/gns-deathmatch/sfx/';
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const REAL_SFX = {};
  function loadRealSfx(id, url) {
    fetch(url).then(r => r.arrayBuffer()).then(buf => audioCtx.decodeAudioData(buf)).then(decoded => { REAL_SFX[id] = decoded; }).catch(() => {});
  }
  function playRealSfx(id, volume = 0.5) {
    const buf = REAL_SFX[id];
    if (!buf) return false;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain); gain.connect(audioCtx.destination);
    src.start();
    return true;
  }
  const WEAPON_SFX_ID = { 'laser-carbine': 'weapon-laser-carbine', 'particle-beam': 'weapon-particle-beam', 'siege-gatling': 'weapon-siege-gatling' };
  loadRealSfx('weapon-laser-carbine', SFX_BASE + 'weapon-laser-carbine.mp3');
  loadRealSfx('weapon-particle-beam', SFX_BASE + 'weapon-particle-beam.mp3');
  loadRealSfx('weapon-siege-gatling', SFX_BASE + 'weapon-siege-gatling.mp3');
  loadRealSfx('bot-death', SFX_BASE + 'bot-death.mp3');
  loadRealSfx('arena-hum', SFX_BASE + 'arena-hum.mp3');
  loadRealSfx('arena-battle-theme', SFX_BASE + 'arena-battle-theme.mp3');
  let arenaHumSource = null, battleThemeSource = null;
  function startArenaAudio() {
    stopArenaAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (REAL_SFX['arena-hum']) {
      const src = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.18;
      src.buffer = REAL_SFX['arena-hum'];
      src.loop = true;
      src.connect(gain); gain.connect(audioCtx.destination);
      src.start();
      arenaHumSource = src;
    }
    if (REAL_SFX['arena-battle-theme']) {
      const src = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.22;
      src.buffer = REAL_SFX['arena-battle-theme'];
      src.loop = true;
      src.connect(gain); gain.connect(audioCtx.destination);
      src.start();
      battleThemeSource = src;
    }
  }
  function stopArenaAudio() {
    if (arenaHumSource) { try { arenaHumSource.stop(); } catch (_) {} arenaHumSource = null; }
    if (battleThemeSource) { try { battleThemeSource.stop(); } catch (_) {} battleThemeSource = null; }
  }
  // Player weapon fire is hold-to-loop, same reasoning as Alien Breach's
  // automatic weapons: the generated samples are sustained bursts, not
  // single bullets, so a one-shot per fire tick kept playing the whole
  // clip long after the button was released.
  let weaponLoopSource = null, weaponLoopId = null;
  function startWeaponLoopSfx(weaponId) {
    const sfxId = WEAPON_SFX_ID[weaponId];
    if (!sfxId) { stopWeaponLoopSfx(); return; }
    if (weaponLoopId === sfxId && weaponLoopSource) return;
    stopWeaponLoopSfx();
    const buf = REAL_SFX[sfxId];
    if (!buf) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    src.buffer = buf;
    src.loop = true;
    src.connect(gain); gain.connect(audioCtx.destination);
    src.start();
    weaponLoopSource = src;
    weaponLoopId = sfxId;
  }
  function stopWeaponLoopSfx() {
    if (!weaponLoopSource) return;
    try { weaponLoopSource.stop(); } catch (_) {}
    weaponLoopSource = null;
    weaponLoopId = null;
  }
  const WORLD_EDGE = 41;

  const ui = {
    container: $('#canvas-container'),
    menu: $('#menu-layer'),
    pause: $('#pause-screen'),
    end: $('#end-screen'),
    hud: $('#game-hud'),
    start: $('#start-match'),
    startFootnote: $('.menu-footnote'),
    error: $('#renderer-error'),
    weaponView: $('#weapon-view'),
    time: $('#time-left'),
    arena: $('#hud-arena'),
    health: $('#health-value'),
    healthFill: $('#health-fill'),
    weaponName: $('#weapon-name'),
    weaponSlot: $('#weapon-slot'),
    ammoMag: $('#ammo-mag'),
    ammoReserve: $('#ammo-reserve'),
    weaponBar: $('#weapon-keybar'),
    liveBoard: $('#live-leaderboard'),
    scoreBoard: $('#live-scoreboard'),
    scoreOverlay: $('#scoreboard-overlay'),
    killFeed: $('#kill-feed'),
    hitmarker: $('#hitmarker'),
    laserFlare: $('#laser-flare'),
    reload: $('#reload-message'),
    damage: $('#damage-flash'),
    movePad: $('#move-pad'),
    touchControls: $('#touch-controls')
  };

  let renderer;
  let fallbackMode = false;
  let fallbackCanvas;
  let fallbackContext;
  let fallbackTracers = [];
  let scene;
  let camera;
  let arenaRoot;
  let actorsRoot;
  let effectsRoot;
  let ambientLight;
  let accentLight;
  let raycaster;
  let selectedArena = 'core-forge';
  let currentWeapon = 0;
  let gameState = 'menu';
  let secondsRemaining = MATCH_DEFAULT_SECONDS;
  let player;
  let bots = [];
  let obstacles = [];
  let solidMeshes = [];
  let activeEffects = [];
  let ammoPickups = [];
  let botTextures = {};
  let weaponImages = {};
  let assetsReady = null;
  let assetFailure = '';
  let accumulator = 0;
  let previousFrame = 0;
  let lastHudUpdate = 0;
  let mouseFiring = false;
  let touchFiring = false;
  let scoreboardHeld = false;
  let moveStick = { x: 0, y: 0 };
  let touchLook = null;
  let mouseSensitivity = 0.0026;
  let jumpRequested = false;
  let loadedAssetCount = 0;

  function initializeRenderer() {
    if (typeof THREE === 'undefined') {
      return initialize2DFallback('Three.js did not load.');
    }
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#0a1019');
      scene.fog = new THREE.FogExp2('#0a1019', 0.0085);
      camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 180);
      camera.rotation.order = 'YXZ';
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute('aria-label', 'GNS Frag Arena game view');
      ui.container.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0x9dbbd0, 0x11101a, 0.72));
      ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambientLight);
      const keyLight = new THREE.DirectionalLight(0xffe5c7, 0.82);
      keyLight.position.set(-10, 24, 12);
      scene.add(keyLight);
      accentLight = new THREE.PointLight(0x65f5e5, 1.8, 58);
      accentLight.position.set(0, 4.5, 0);
      scene.add(accentLight);
      arenaRoot = new THREE.Group();
      actorsRoot = new THREE.Group();
      effectsRoot = new THREE.Group();
      scene.add(arenaRoot, actorsRoot, effectsRoot);
      raycaster = new THREE.Raycaster();
      return true;
    } catch (error) {
      return initialize2DFallback(error.message || 'This browser could not start the 3D renderer.');
    }
  }

  function showRendererError(message) {
    ui.error.classList.remove('hidden');
    ui.error.querySelector('span').textContent = message;
  }

  function getInputSurface() {
    return renderer?.domElement || fallbackCanvas;
  }

  function resizeFallbackCanvas() {
    if (!fallbackCanvas || !fallbackContext) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    fallbackCanvas.width = Math.round(window.innerWidth * ratio);
    fallbackCanvas.height = Math.round(window.innerHeight * ratio);
    fallbackCanvas.style.width = window.innerWidth + 'px';
    fallbackCanvas.style.height = window.innerHeight + 'px';
    fallbackContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function initialize2DFallback(reason) {
    fallbackMode = true;
    try {
      fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.id = 'arena-fallback-canvas';
      fallbackCanvas.setAttribute('aria-label', '2D arena fallback');
      fallbackCanvas.tabIndex = 0;
      fallbackContext = fallbackCanvas.getContext('2d', { alpha: false });
      if (!fallbackContext) throw new Error('Canvas 2D is unavailable in this browser.');
      ui.container.appendChild(fallbackCanvas);
      document.getElementById('game-root').classList.add('fallback-mode');
      $('#fallback-badge').classList.remove('hidden');
      resizeFallbackCanvas();
      console.warn('GNS Frag Arena is using its 2D compatibility renderer:', reason);
      return true;
    } catch (error) {
      showRendererError(error.message || reason || 'This browser could not start the arena renderer.');
      return false;
    }
  }

  function loadTexture(url) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        texture => {
          texture.encoding = THREE.sRGBEncoding;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          resolve(texture);
        },
        undefined,
        () => reject(new Error('Could not load local game art: ' + url))
      );
    });
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not load local game image: ' + url));
      image.src = url;
    });
  }

  async function loadWeaponImages(total) {
    const loaded = await Promise.all(WEAPONS.map(async weapon => {
      const image = await loadImage(WEAPON_VIEW_ROOT + weapon.viewmodel);
      loadedAssetCount++;
      ui.startFootnote.textContent = `LOADING LOCAL ART ${loadedAssetCount}/${total} · FOUR ORIGINAL WEAPON VIEWS`;
      return [weapon.id, image];
    }));
    weaponImages = Object.fromEntries(loaded);
  }

  async function loadGameAssets() {
    if (!renderer) return false;
    const total = BOT_ARCHETYPES.length + WEAPONS.length;
    try {
      const botResults = await Promise.all(BOT_ARCHETYPES.map(async archetype => {
        const texture = await loadTexture(BOT_ROOT + archetype.id + '.webp');
        loadedAssetCount++;
        ui.startFootnote.textContent = `LOADING LOCAL ART ${loadedAssetCount}/${total} · TEN ARMED RIVALS · THREE ARENAS`;
        return texture;
      }));
      BOT_ARCHETYPES.forEach((archetype, index) => { botTextures[archetype.id] = botResults[index]; });
      await loadWeaponImages(total);
      renderWeaponBar();
      selectWeapon(0);
      ui.start.disabled = false;
      ui.startFootnote.textContent = 'Single-player against ten armed bots · Mouse/keyboard and touch controls · No network connection required';
      return true;
    } catch (error) {
      assetFailure = error.message;
      ui.start.disabled = true;
      ui.start.textContent = 'LOCAL ART FAILED TO LOAD';
      ui.startFootnote.textContent = error.message;
      console.error(error);
      return false;
    }
  }

  async function loadFallbackAssets() {
    const total = BOT_ARCHETYPES.length + WEAPONS.length;
    try {
      const loadedBots = await Promise.all(BOT_ARCHETYPES.map(async archetype => {
        const image = await loadImage(BOT_ROOT + archetype.id + '.webp');
        loadedAssetCount++;
        ui.startFootnote.textContent = `LOADING LOCAL ART ${loadedAssetCount}/${total} · TEN ARMED RIVALS · 2D COMPATIBILITY MODE`;
        return image;
      }));
      BOT_ARCHETYPES.forEach((archetype, index) => { botTextures[archetype.id] = loadedBots[index]; });
      await loadWeaponImages(total);
      renderWeaponBar();
      selectWeapon(0);
      ui.start.disabled = false;
      ui.startFootnote.textContent = '2D compatibility view · ten armed bots · mouse/keyboard and touch controls · offline';
      return true;
    } catch (error) {
      assetFailure = error.message;
      ui.start.disabled = true;
      ui.start.textContent = 'LOCAL ART FAILED TO LOAD';
      ui.startFootnote.textContent = error.message;
      console.error(error);
      return false;
    }
  }

  function boxMaterial(color, accent = false) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: accent ? 0.38 : 0.76,
      metalness: accent ? 0.52 : 0.42,
      emissive: accent ? color : '#000000',
      emissiveIntensity: accent ? 0.45 : 0
    });
  }

  function addBox(x, y, z, width, height, depth, color, collision = true, accent = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      boxMaterial(color, accent)
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    arenaRoot.add(mesh);
    if (collision) {
      obstacles.push({
        minX: x - width / 2, maxX: x + width / 2,
        minZ: z - depth / 2, maxZ: z + depth / 2
      });
      solidMeshes.push(mesh);
    }
    return mesh;
  }

  function addNeonBar(x, y, z, width, height, depth, color) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    );
    mesh.position.set(x, y, z);
    arenaRoot.add(mesh);
    return mesh;
  }

  function addPillar(x, z, accent, variation = 0) {
    const main = addBox(x, 2.6 + variation, z, 1.9, 5.2 + variation * 2, 1.9, '#242b35', true);
    addNeonBar(x, 4.2 + variation, z, 2.02, 0.08, 2.02, accent);
    addNeonBar(x, 1.05, z, 2.02, 0.08, 2.02, '#526576');
    return main;
  }

  function createAmmoPickup(x, z, index) {
    const spec = ARENAS[selectedArena];
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshBasicMaterial({ color: spec.secondary, toneMapped: false })
    );
    mesh.position.set(x, 0.7, z);
    arenaRoot.add(mesh);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.035, 5, 14),
      new THREE.MeshBasicMaterial({ color: spec.accent, toneMapped: false })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.14, z);
    arenaRoot.add(ring);
    ammoPickups.push({ x, z, mesh, ring, available: true, respawnAt: 0, phase: index * 1.4 });
  }

  function addArenaSign(text, color, x, z, rotation = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(5,10,16,.84)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.fillStyle = color;
    ctx.font = '900 42px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 1.9),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
    );
    sign.position.set(x, 6.8, z);
    sign.rotation.y = rotation;
    arenaRoot.add(sign);
  }

  function clearActors() {
    while (actorsRoot.children.length) {
      const child = actorsRoot.children[0];
      actorsRoot.remove(child);
      if (child.material) child.material.dispose();
    }
  }

  function clearEffects() {
    for (const effect of activeEffects) {
      effectsRoot.remove(effect.object);
      effect.object.geometry.dispose();
      if (effect.object.material) effect.object.material.dispose();
    }
    activeEffects = [];
  }

  function buildArena(arenaId = selectedArena) {
    if (!renderer) {
      if (fallbackMode) buildFallbackArena(arenaId);
      return;
    }
    selectedArena = ARENAS[arenaId] ? arenaId : 'core-forge';
    const spec = ARENAS[selectedArena];
    while (arenaRoot.children.length) {
      const child = arenaRoot.children[0];
      arenaRoot.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
        else child.material.dispose();
      }
    }
    obstacles = [];
    solidMeshes = [];
    ammoPickups = [];
    clearActors();
    clearEffects();

    scene.background.set('#0a1019');
    scene.fog.color.set('#0a1019');
    accentLight.color.set(spec.accent);
    accentLight.position.set(0, 5, 0);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(84, 84),
      new THREE.MeshStandardMaterial({ color: spec.floor, roughness: 0.92, metalness: 0.26 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    arenaRoot.add(floor);
    const grid = new THREE.GridHelper(82, 42, spec.accent, '#36414e');
    grid.position.y = 0.005;
    grid.material.transparent = true;
    grid.material.opacity = 0.31;
    arenaRoot.add(grid);
    // Local generated arena art is a non-blocking in-world billboard. If an
    // image is still being generated or unavailable, the modeled arena remains playable.
    const art = new THREE.Mesh(
      // Source art is square; keep the billboard square so its composition is
      // not stretched in-world (the menu preview still crops it naturally).
      new THREE.PlaneGeometry(6.2, 6.2),
      new THREE.MeshBasicMaterial({ map: null, color: spec.accent, transparent: true, opacity: .2, side: THREE.DoubleSide })
    );
    art.position.set(0, 4.6, -40.95);
    art.rotation.y = Math.PI;
    arenaRoot.add(art);
    loadTexture(ARENA_ART_ROOT + selectedArena + '-arena.jpg').then(texture => {
      art.material.map = texture;
      art.material.color.set('#ffffff');
      art.material.opacity = .82;
      art.material.needsUpdate = true;
    }).catch(() => {});

    const wallHeight = 8;
    addBox(0, wallHeight / 2, -42, 84, wallHeight, 1.4, spec.wall);
    addBox(0, wallHeight / 2, 42, 84, wallHeight, 1.4, spec.wall);
    addBox(-42, wallHeight / 2, 0, 1.4, wallHeight, 84, spec.wall);
    addBox(42, wallHeight / 2, 0, 1.4, wallHeight, 84, spec.wall);
    for (let i = -3; i <= 3; i++) {
      addNeonBar(i * 11, 7.2, -41.23, 4.5, 0.11, 0.08, spec.accent);
      addNeonBar(i * 11, 7.2, 41.23, 4.5, 0.11, 0.08, spec.accent);
      addNeonBar(-41.23, 7.2, i * 11, 0.08, 0.11, 4.5, spec.accent);
      addNeonBar(41.23, 7.2, i * 11, 0.08, 0.11, 4.5, spec.accent);
    }

    for (const [x, z, width, depth, height] of spec.obstacles) {
      const color = height > 2.5 ? spec.wall : '#394451';
      addBox(x, height / 2, z, width, height, depth, color);
      addNeonBar(x, height + 0.04, z, Math.min(width * 0.8, 5.8), 0.08, 0.1, spec.accent);
    }
    for (const [x, z] of spec.pillars) addPillar(x, z, spec.secondary, 0.15);

    if (selectedArena === 'core-forge') {
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.6, 4.5, 8),
        boxMaterial('#47302a', true)
      );
      core.position.set(0, 2.25, 0);
      arenaRoot.add(core);
      obstacles.push({ minX: -2.6, maxX: 2.6, minZ: -2.6, maxZ: 2.6 });
      solidMeshes.push(core);
      addNeonBar(0, 4.58, 0, 3.6, 0.12, 3.6, spec.accent);
      const coreLight = new THREE.PointLight(spec.accent, 2.7, 17);
      coreLight.position.set(0, 4.2, 0);
      arenaRoot.add(coreLight);
    } else if (selectedArena === 'void-bridge') {
      for (let i = -2; i <= 2; i++) {
        addNeonBar(i * 7, 0.08, -1, 0.13, 0.04, 29, spec.secondary);
        addNeonBar(i * 7, 0.08, 1, 0.13, 0.04, 29, spec.accent);
      }
      addNeonBar(0, 2.4, 0, 0.12, 4.8, 0.12, spec.accent);
      addNeonBar(0, 0.08, 0, 7, 0.06, 0.12, spec.secondary);
    } else {
      for (let i = -2; i <= 2; i++) {
        addNeonBar(i * 8, 7.7, -4, 0.09, 0.09, 58, spec.secondary);
      }
      const dais = addBox(0, 0.12, 0, 9, 0.24, 9, '#243633', false);
      dais.material.emissive.set(spec.accent);
      dais.material.emissiveIntensity = 0.22;
    }
    [[-34, 0], [34, 0], [0, -34], [0, 34]].forEach(([x, z], index) => createAmmoPickup(x, z, index));
    addArenaSign(spec.name + ' // FRAG ARENA', spec.accent, 0, -40.9, 0);
    ui.arena.textContent = spec.name;
    ui.arena.style.color = spec.accent;
    updateMinimap();
  }

  function clearOldBots() {
    for (const bot of bots) {
      if (bot.sprite?.material) bot.sprite.material.dispose();
      actorsRoot?.remove(bot.sprite);
    }
    bots = [];
  }

  function createBot(index, spawn) {
    const archetype = BOT_ARCHETYPES[index % BOT_ARCHETYPES.length];
    const material = new THREE.SpriteMaterial({
      map: botTextures[archetype.id],
      color: '#ffffff',
      transparent: true,
      alphaTest: 0.025,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.65, 3.45, 1);
    sprite.position.set(spawn[0], 1.68, spawn[1]);
    sprite.renderOrder = 2;
    actorsRoot.add(sprite);
    return {
      id: 'bot-' + index,
      name: archetype.name,
      archetype,
      color: archetype.color,
      weaponIndex: archetype.weapon,
      x: spawn[0],
      z: spawn[1],
      health: 100,
      maxHealth: 100,
      frags: 0,
      deaths: 0,
      alive: true,
      nextShotAt: 0,
      respawnAt: 0,
      strafeDir: index % 2 === 0 ? 1 : -1,
      bobPhase: index * 0.9,
      hitFlash: 0,
      sprite
    };
  }

  function createFallbackBot(index, spawn) {
    const archetype = BOT_ARCHETYPES[index % BOT_ARCHETYPES.length];
    return {
      id: 'bot-' + index,
      name: archetype.name,
      archetype,
      color: archetype.color,
      weaponIndex: archetype.weapon,
      x: spawn[0],
      z: spawn[1],
      health: 100,
      maxHealth: 100,
      frags: 0,
      deaths: 0,
      alive: true,
      nextShotAt: 0,
      respawnAt: 0,
      strafeDir: index % 2 === 0 ? 1 : -1,
      bobPhase: index * 0.9,
      hitFlash: 0,
      sprite: { image: botTextures[archetype.id], visible: true }
    };
  }

  function buildFallbackArena(arenaId = selectedArena) {
    selectedArena = ARENAS[arenaId] ? arenaId : 'core-forge';
    const spec = ARENAS[selectedArena];
    obstacles = spec.obstacles.map(([x, z, width, depth]) => ({
      minX: x - width / 2, maxX: x + width / 2,
      minZ: z - depth / 2, maxZ: z + depth / 2
    }));
    for (const [x, z] of spec.pillars) {
      obstacles.push({ minX: x - 1.05, maxX: x + 1.05, minZ: z - 1.05, maxZ: z + 1.05 });
    }
    if (selectedArena === 'core-forge') {
      obstacles.push({ minX: -2.6, maxX: 2.6, minZ: -2.6, maxZ: 2.6 });
    }
    solidMeshes = [];
    fallbackTracers = [];
    ammoPickups = [[-34, 0], [34, 0], [0, -34], [0, 34]].map(([x, z], index) => ({
      x, z, available: true, respawnAt: 0, phase: index * 1.4,
      mesh: { visible: true }, ring: { visible: true }
    }));
    ui.arena.textContent = spec.name;
    ui.arena.style.color = spec.accent;
    updateMinimap();
  }

  function createPlayer() {
    const spec = ARENAS[selectedArena];
    return {
      id: 'player',
      name: 'YOU',
      color: '#65f5e5',
      x: spec.start[0],
      z: spec.start[1],
      yaw: Math.PI,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      frags: 0,
      deaths: 0,
      alive: true,
      respawnAt: 0,
      jumpHeight: 0,
      verticalVelocity: 0,
      reloadUntil: 0,
      lastFireAt: 0,
      ammo: WEAPONS.map(weapon => ({ mag: weapon.magSize, reserve: weapon.reserve })),
      sprite: null
    };
  }

  function startMatch(arenaId = selectedArena, options = {}) {
    if ((!renderer && !fallbackMode) || assetFailure ||
        Object.keys(botTextures).length !== BOT_ARCHETYPES.length ||
        Object.keys(weaponImages).length !== WEAPONS.length) return false;
    selectedArena = ARENAS[arenaId] ? arenaId : 'core-forge';
    buildArena(selectedArena);
    clearOldBots();
    player = createPlayer();
    const spawns = ARENAS[selectedArena].spawns;
    bots = BOT_ARCHETYPES.map((_, index) =>
      fallbackMode ? createFallbackBot(index, spawns[index]) : createBot(index, spawns[index])
    );
    secondsRemaining = Number($('#match-duration').value) || MATCH_DEFAULT_SECONDS;
    currentWeapon = 0;
    mouseFiring = false;
    touchFiring = false;
    keys.clear();
    ui.reload.classList.add('hidden');
    ui.killFeed.innerHTML = '';
    scoreboardHeld = false;
    gameState = 'playing';
    ui.menu.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.end.classList.add('hidden');
    ui.scoreOverlay.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.touchControls.classList.toggle('hidden', !('ontouchstart' in window || navigator.maxTouchPoints > 0));
    player.yaw = 0;
    positionCamera();
    selectWeapon(0);
    updateHud(true);
    appendKillFeed('MATCH LIVE', ARENAS[selectedArena].name, 'START');
    if (options.lockPointer !== false && !('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      getInputSurface()?.requestPointerLock?.();
    }
    startArenaAudio();
    return true;
  }

  function finishMatch() {
    if (gameState === 'finished') return;
    gameState = 'finished';
    stopArenaAudio();
    stopWeaponLoopSfx();
    mouseFiring = false;
    touchFiring = false;
    document.exitPointerLock?.();
    ui.pause.classList.add('hidden');
    ui.scoreOverlay.classList.add('hidden');
    ui.hud.classList.add('hidden');
    ui.end.classList.remove('hidden');
    const standings = getStandings();
    const leaders = standings.filter(contestant => contestant.frags === standings[0].frags);
    const playerWon = leaders.some(contestant => contestant.id === 'player');
    $('#winner-title').textContent = leaders.length > 1 ? 'TIED AT THE TOP' : playerWon ? 'FRAG LEADER: YOU' : 'FRAG LEADER: ' + standings[0].name;
    $('#winner-title').style.color = leaders.length > 1 ? '#ffc56f' : playerWon ? '#65f5e5' : standings[0].color;
    $('#winner-subtitle').textContent = leaders.length > 1
      ? `${standings[0].frags} frags each · sudden-death tie`
      : `${standings[0].frags} frags · ${standings[0].deaths} deaths · TOP FRAGGER WINS`;
    $('#final-arena').textContent = ARENAS[selectedArena].name;
    $('#final-scoreboard').innerHTML = standings.map((contestant, index) =>
      scoreRowMarkup(contestant, index + 1, false)
    ).join('');
    return standings;
  }

  function getContestants() {
    return player ? [player, ...bots] : [];
  }

  function getStandings() {
    return getContestants().slice().sort((a, b) => b.frags - a.frags || a.deaths - b.deaths || a.name.localeCompare(b.name));
  }

  function scoreRowMarkup(contestant, rank, head = false) {
    if (head) {
      return '<div class="score-row scoreboard-head"><span>POS</span><span>FIGHTER</span><span class="frags">FRAGS</span><span class="deaths">DEATHS</span></div>';
    }
    const playerClass = contestant.id === 'player' ? ' me' : '';
    return `<div class="score-row${playerClass}" data-score-id="${contestant.id}">
      <span class="rank">${String(rank).padStart(2, '0')}</span>
      <span>${contestant.name}</span>
      <span class="frags">${contestant.frags}</span>
      <span class="deaths">${contestant.deaths}</span>
    </div>`;
  }

  function renderWeaponBar() {
    ui.weaponBar.innerHTML = WEAPONS.map((weapon, index) =>
      `<button class="weapon-key-slot${index === currentWeapon ? ' active' : ''}" type="button" data-weapon="${index}" aria-label="Select ${weapon.name}">
        <kbd>${weapon.key}</kbd><span>${weapon.short}</span>
      </button>`
    ).join('');
  }

  function selectWeapon(index) {
    if (!Number.isInteger(index) || index < 0 || index >= WEAPONS.length) return false;
    currentWeapon = index;
    const weapon = WEAPONS[index];
    ui.weaponView.src = weaponImages[weapon.id]?.src || WEAPON_VIEW_ROOT + weapon.viewmodel;
    ui.weaponView.alt = `${weapon.name} local rendered weapon view`;
    ui.laserFlare.style.setProperty('--flare-color', weapon.color);
    ui.weaponName.textContent = weapon.name;
    ui.weaponSlot.textContent = String(index + 1).padStart(2, '0') + ' // ' + weapon.short;
    if (player) {
      ui.ammoMag.textContent = player.ammo[index].mag;
      ui.ammoReserve.textContent = player.ammo[index].reserve;
    }
    [...ui.weaponBar.children].forEach((slot, slotIndex) => slot.classList.toggle('active', slotIndex === index));
    return true;
  }

  function updateHud(force = false) {
    if (!player || (gameState !== 'playing' && gameState !== 'paused')) return;
    const now = performance.now();
    if (!force && now - lastHudUpdate < 100) return;
    lastHudUpdate = now;
    const time = Math.max(0, Math.ceil(secondsRemaining));
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    ui.time.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    ui.time.parentElement.classList.toggle('low', time <= 20);
    ui.health.textContent = Math.max(0, Math.ceil(player.health));
    ui.healthFill.style.width = Math.max(0, player.health) + '%';
    ui.healthFill.style.background = player.health <= 35 ? '#ff536a' : '#65f5e5';
    const ammo = player.ammo[currentWeapon];
    ui.ammoMag.textContent = ammo.mag;
    ui.ammoReserve.textContent = ammo.reserve;
    const standings = getStandings();
    ui.liveBoard.innerHTML = standings.map(contestant =>
      `<div class="live-score-chip${contestant.id === 'player' ? ' me' : ''}"><span>${contestant.name}</span><b>${contestant.frags}</b></div>`
    ).join('');
    if (scoreboardHeld) {
      ui.scoreBoard.innerHTML = scoreRowMarkup(null, null, true) +
        standings.map((contestant, index) => scoreRowMarkup(contestant, index + 1)).join('');
    }
  }

  function positionCamera() {
    if (!player || !camera) return;
    camera.position.set(player.x, 1.72 + player.jumpHeight, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);
  }

  function canOccupy(x, z, radius = 0.76) {
    if (x < -WORLD_EDGE + radius || x > WORLD_EDGE - radius || z < -WORLD_EDGE + radius || z > WORLD_EDGE - radius) return false;
    for (const obstacle of obstacles) {
      if (x + radius > obstacle.minX && x - radius < obstacle.maxX &&
          z + radius > obstacle.minZ && z - radius < obstacle.maxZ) return false;
    }
    return true;
  }

  function moveEntity(entity, dx, dz, radius = 0.76) {
    let moved = false;
    const nextX = entity.x + dx;
    if (canOccupy(nextX, entity.z, radius)) {
      entity.x = nextX;
      moved = true;
    }
    const nextZ = entity.z + dz;
    if (canOccupy(entity.x, nextZ, radius)) {
      entity.z = nextZ;
      moved = true;
    }
    return moved;
  }

  function updatePlayer(dt) {
    if (!player) return;
    if (!player.alive) {
      if (performance.now() >= player.respawnAt) respawnContestant(player, true);
      return;
    }
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) - moveStick.y;
    const sideways = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + moveStick.x;
    const length = Math.hypot(forward, sideways);
    if (length > 0.03) {
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 15 : 10.3;
      const localX = sideways / length;
      const localZ = -forward / length;
      const dx = (localX * Math.cos(player.yaw) + localZ * Math.sin(player.yaw)) * speed * dt;
      const dz = (localZ * Math.cos(player.yaw) - localX * Math.sin(player.yaw)) * speed * dt;
      moveEntity(player, dx, dz);
    }
    if (jumpRequested && player.jumpHeight <= 0.001) player.verticalVelocity = 6.8;
    jumpRequested = false;
    player.verticalVelocity -= 18 * dt;
    player.jumpHeight = Math.max(0, player.jumpHeight + player.verticalVelocity * dt);
    if (player.jumpHeight === 0) player.verticalVelocity = 0;
    if (performance.now() >= player.reloadUntil && player.reloadUntil > 0) finishReload();
    positionCamera();
    // All 4 GNS weapons are automatic, and their generated samples are
    // sustained bursts, not single bullets - firePlayerWeapon()'s own
    // fire-rate cooldown means retriggering a one-shot per call (like
    // semi-auto weapons correctly do) left the whole clip playing long
    // after the button was released. startWeaponLoopSfx/stopWeaponLoopSfx
    // are both idempotent per-weapon, so calling them every held frame is
    // safe and also naturally handles switching weapons mid-fire.
    if (mouseFiring || touchFiring || keys.has('Space')) {
      firePlayerWeapon();
      const weapon = WEAPONS[currentWeapon];
      const isReloading = player.reloadUntil > performance.now();
      if (weapon.automatic && !isReloading) startWeaponLoopSfx(weapon.id); else stopWeaponLoopSfx();
    } else {
      stopWeaponLoopSfx();
    }
  }

  function chooseTarget(bot) {
    let best = null;
    let bestDistance = Infinity;
    for (const contestant of getContestants()) {
      if (contestant === bot || !contestant.alive) continue;
      const distance = Math.hypot(contestant.x - bot.x, contestant.z - bot.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = contestant;
      }
    }
    return best;
  }

  function updateBots(dt) {
    if (fallbackMode) {
      updateFallbackBots(dt);
      return;
    }
    const now = performance.now();
    for (const bot of bots) {
      if (!bot.alive) {
        if (now >= bot.respawnAt) respawnContestant(bot, false);
        continue;
      }
      const target = chooseTarget(bot);
      if (!target) continue;
      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const distance = Math.hypot(dx, dz);
      const inverse = 1 / Math.max(distance, 0.001);
      let moveX = 0;
      let moveZ = 0;
      if (distance > 10) {
        moveX += dx * inverse;
        moveZ += dz * inverse;
      } else if (distance < 5.4) {
        moveX -= dx * inverse * 0.7;
        moveZ -= dz * inverse * 0.7;
      }
      const strafe = (distance < 24 ? 0.38 : 0.12) * bot.strafeDir;
      moveX += -dz * inverse * strafe;
      moveZ += dx * inverse * strafe;
      const magnitude = Math.hypot(moveX, moveZ) || 1;
      const speed = 5.3 + (indexHash(bot.id) % 3) * 0.35;
      const moved = moveEntity(bot, moveX / magnitude * speed * dt, moveZ / magnitude * speed * dt, 0.72);
      if (!moved) {
        bot.strafeDir *= -1;
        const sideX = -dz * inverse * speed * dt * bot.strafeDir;
        const sideZ = dx * inverse * speed * dt * bot.strafeDir;
        moveEntity(bot, sideX, sideZ, 0.72);
      }
      bot.bobPhase += dt * (distance > 8 ? 8.5 : 4);
      if (bot.hitFlash > 0) {
        bot.hitFlash -= dt;
        bot.sprite.material.color.set('#ffb2b9');
      } else {
        bot.sprite.material.color.set('#ffffff');
      }
      bot.sprite.position.set(bot.x, 1.68 + Math.sin(bot.bobPhase) * 0.055, bot.z);

      if (distance < 43 && now >= bot.nextShotAt && canSee(bot, target)) {
        fireBot(bot, target, distance, now);
      }
    }
  }

  function updateFallbackBots(dt) {
    const now = performance.now();
    for (const bot of bots) {
      if (!bot.alive) {
        if (now >= bot.respawnAt) respawnContestant(bot, false);
        continue;
      }
      const target = chooseTarget(bot);
      if (!target) continue;
      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const distance = Math.hypot(dx, dz);
      const inverse = 1 / Math.max(distance, 0.001);
      let moveX = 0;
      let moveZ = 0;
      if (distance > 10) {
        moveX += dx * inverse;
        moveZ += dz * inverse;
      } else if (distance < 5.4) {
        moveX -= dx * inverse * 0.7;
        moveZ -= dz * inverse * 0.7;
      }
      const strafe = (distance < 24 ? 0.38 : 0.12) * bot.strafeDir;
      moveX += -dz * inverse * strafe;
      moveZ += dx * inverse * strafe;
      const magnitude = Math.hypot(moveX, moveZ) || 1;
      const speed = 5.3 + (indexHash(bot.id) % 3) * 0.35;
      const moved = moveEntity(bot, moveX / magnitude * speed * dt, moveZ / magnitude * speed * dt, 0.72);
      if (!moved) {
        bot.strafeDir *= -1;
        moveEntity(bot, -dz * inverse * speed * dt * bot.strafeDir, dx * inverse * speed * dt * bot.strafeDir, 0.72);
      }
      bot.bobPhase += dt * (distance > 8 ? 8.5 : 4);
      if (distance < 43 && now >= bot.nextShotAt && canSee(bot, target)) fireBot(bot, target, distance, now);
    }
  }

  function indexHash(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash += value.charCodeAt(i);
    return hash;
  }

  function contestantAimPoint(contestant) {
    return new THREE.Vector3(contestant.x, contestant === player ? 1.32 + player.jumpHeight : 1.42, contestant.z);
  }

  function canSee(shooter, target) {
    if (fallbackMode) return !lineBlocked2D(shooter.x, shooter.z, target.x, target.z);
    const origin = contestantAimPoint(shooter);
    const destination = contestantAimPoint(target);
    const direction = destination.clone().sub(origin);
    const distance = direction.length();
    direction.normalize();
    raycaster.set(origin, direction);
    const hits = raycaster.intersectObjects(solidMeshes, false);
    return !hits.length || hits[0].distance > distance - 0.8;
  }

  function lineBlocked2D(x1, z1, x2, z2) {
    const distance = Math.hypot(x2 - x1, z2 - z1);
    const samples = Math.max(2, Math.ceil(distance * 2.5));
    for (let step = 1; step < samples; step++) {
      const amount = step / samples;
      if (!canOccupy(x1 + (x2 - x1) * amount, z1 + (z2 - z1) * amount, 0.05)) return true;
    }
    return false;
  }

  function createFallbackBeam(x1, z1, x2, z2, color, lifetime = 0.16) {
    fallbackTracers.push({ x1, z1, x2, z2, color, life: lifetime, maxLife: lifetime });
  }

  function fireBot(bot, target, distance, now = performance.now()) {
    const weapon = WEAPONS[bot.weaponIndex];
    const accuracy = Math.max(0.22, bot.archetype.skill - distance * 0.009);
    const hits = Math.random() < accuracy;
    // Quieter than the player's own shots and softly distance-attenuated
    // so a firefight across the map doesn't sound as loud as one right
    // next to the camera.
    const botSfxId = WEAPON_SFX_ID[weapon.id];
    if (botSfxId) playRealSfx(botSfxId, Math.max(0.08, 0.3 - distance * 0.006));
    if (fallbackMode) {
      createFallbackBeam(bot.x, bot.z, target.x, target.z, weapon.color, 0.2);
      bot.nextShotAt = now + (bot.weaponIndex === 3 ? 310 : 680 + Math.random() * 480);
      if (hits) damageContestant(target, Math.round(weapon.damage * 0.9), bot);
      return;
    }
    const origin = contestantAimPoint(bot);
    const destination = contestantAimPoint(target);
    const end = hits
      ? destination
      : destination.clone().add(new THREE.Vector3((Math.random() - .5) * distance * .35, (Math.random() - .5) * 2, (Math.random() - .5) * distance * .35));
    createBeam(origin, end, weapon.color, 0.12, 0.16);
    bot.nextShotAt = now + (bot.weaponIndex === 3 ? 310 : 680 + Math.random() * 480);
    if (hits) damageContestant(target, Math.round(weapon.damage * 0.9), bot);
  }

  function rayHitBot(origin, direction, maxDistance) {
    let bestBot = null;
    let bestDistance = maxDistance;
    for (const bot of bots) {
      if (!bot.alive) continue;
      const center = contestantAimPoint(bot);
      const toCenter = center.sub(origin);
      const along = toCenter.dot(direction);
      if (along < 0 || along > bestDistance) continue;
      const perpendicularSq = Math.max(0, toCenter.lengthSq() - along * along);
      const aimAssistRadius = touchFiring ? 1.18 : 0.88;
      if (perpendicularSq < aimAssistRadius * aimAssistRadius) {
        bestBot = bot;
        bestDistance = along;
      }
    }
    return bestBot ? { bot: bestBot, distance: bestDistance } : null;
  }

  function firePlayerWeapon() {
    if (gameState !== 'playing' || !player || !player.alive) return false;
    if (fallbackMode) return firePlayerWeapon2D();
    const weapon = WEAPONS[currentWeapon];
    const now = performance.now();
    const ammo = player.ammo[currentWeapon];
    if (player.reloadUntil > now || now - player.lastFireAt < weapon.fireMs) return false;
    if (ammo.mag <= 0) {
      beginReload();
      return false;
    }
    ammo.mag--;
    player.lastFireAt = now;
    const origin = camera.position.clone();
    const baseDirection = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyEuler(camera.rotation).normalize();
    const pelletCount = weapon.pellets || 1;
    let hitAny = false;
    let primaryEnd = origin.clone().add(baseDirection.clone().multiplyScalar(54));
    for (let pellet = 0; pellet < pelletCount; pellet++) {
      const spread = weapon.spread || 0.002;
      const direction = baseDirection.clone()
        .addScaledVector(right, (Math.random() - .5) * spread)
        .addScaledVector(up, (Math.random() - .5) * spread)
        .normalize();
      let wallDistance = 54;
      scene.updateMatrixWorld(true);
      raycaster.set(origin, direction);
      const wallHit = raycaster.intersectObjects(solidMeshes, false)[0];
      if (wallHit) wallDistance = wallHit.distance;
      const botHit = rayHitBot(origin, direction, wallDistance);
      if (botHit) {
        const target = botHit.bot;
        const hitPoint = origin.clone().add(direction.clone().multiplyScalar(botHit.distance));
        if (pellet === 0) primaryEnd = hitPoint;
        damageContestant(target, weapon.damage, player);
        hitAny = true;
      } else if (pellet === 0) {
        primaryEnd = origin.clone().add(direction.clone().multiplyScalar(wallDistance));
      }
    }
    createBeam(
      origin.clone().add(baseDirection.clone().multiplyScalar(0.55)),
      primaryEnd,
      weapon.color,
      weapon.id === 'laser-carbine' ? 0.105 : weapon.id === 'railgun' || weapon.id === 'photon-lance' ? 0.16 : 0.075,
      weapon.id === 'laser-carbine' ? 0.19 : 0.13
    );
    // Sound is handled as a hold-to-loop, not retriggered per shot -
    // see startWeaponLoopSfx in the main update loop.
    animateWeaponShot(weapon);
    if (hitAny) pulseHitmarker();
    updateHud(true);
    return true;
  }

  function firePlayerWeapon2D() {
    const weapon = WEAPONS[currentWeapon];
    const now = performance.now();
    const ammo = player.ammo[currentWeapon];
    if (player.reloadUntil > now || now - player.lastFireAt < weapon.fireMs) return false;
    if (ammo.mag <= 0) {
      beginReload();
      return false;
    }
    ammo.mag--;
    player.lastFireAt = now;
    const pelletCount = weapon.pellets || 1;
    let hitAny = false;
    let endX = player.x - Math.sin(player.yaw) * 54;
    let endZ = player.z - Math.cos(player.yaw) * 54;
    for (let pellet = 0; pellet < pelletCount; pellet++) {
      const shotYaw = player.yaw + (Math.random() - 0.5) * (weapon.spread || 0.004);
      const dx = -Math.sin(shotYaw);
      const dz = -Math.cos(shotYaw);
      let nearest = null;
      let nearestDistance = 54;
      for (const bot of bots) {
        if (!bot.alive) continue;
        const toX = bot.x - player.x;
        const toZ = bot.z - player.z;
        const along = toX * dx + toZ * dz;
        const side = Math.abs(toX * dz - toZ * dx);
        const aimAssistRadius = touchFiring ? 1.35 : 1.1;
        if (along <= 0 || along >= nearestDistance || side > aimAssistRadius) continue;
        if (lineBlocked2D(player.x, player.z, bot.x, bot.z)) continue;
        nearest = bot;
        nearestDistance = along;
      }
      if (nearest) {
        if (pellet === 0) {
          endX = player.x + dx * nearestDistance;
          endZ = player.z + dz * nearestDistance;
        }
        damageContestant(nearest, weapon.damage, player);
        hitAny = true;
      } else if (pellet === 0) {
        endX = player.x + dx * 54;
        endZ = player.z + dz * 54;
      }
    }
    createFallbackBeam(player.x, player.z, endX, endZ, weapon.color, weapon.id === 'laser-carbine' ? 0.2 : 0.14);
    // Sound is handled as a hold-to-loop, not retriggered per shot -
    // see startWeaponLoopSfx in the main update loop.
    animateWeaponShot(weapon);
    if (hitAny) pulseHitmarker();
    updateHud(true);
    return true;
  }

  function createBeam(start, end, color, width = 0.1, lifetime = 0.15) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
    const beam = new THREE.Line(geometry, material);
    beam.frustumCulled = false;
    effectsRoot.add(beam);
    activeEffects.push({ object: beam, life: lifetime, maxLife: lifetime, isLine: true, width });
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(width * 2.3, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    spark.position.copy(end);
    effectsRoot.add(spark);
    activeEffects.push({ object: spark, life: lifetime * 0.68, maxLife: lifetime * 0.68, isLine: false });
  }

  function animateWeaponShot(weapon) {
    ui.weaponView.classList.remove('fire');
    ui.laserFlare.classList.remove('active');
    void ui.weaponView.offsetWidth;
    ui.weaponView.classList.add('fire');
    ui.laserFlare.classList.add('active');
    setTimeout(() => {
      ui.weaponView.classList.remove('fire');
      ui.laserFlare.classList.remove('active');
    }, 150);
    ui.laserFlare.style.setProperty('--flare-color', weapon.color);
  }

  function pulseHitmarker() {
    ui.hitmarker.classList.remove('active');
    void ui.hitmarker.offsetWidth;
    ui.hitmarker.classList.add('active');
  }

  function damageContestant(target, amount, attacker) {
    if (!target || !target.alive || gameState !== 'playing') return false;
    target.health = Math.max(0, target.health - amount);
    if (target === player) {
      ui.damage.classList.remove('damage-hit');
      void ui.damage.offsetWidth;
      ui.damage.classList.add('damage-hit');
      updateHud(true);
    } else {
      target.hitFlash = 0.12;
      if (target.sprite?.material?.color) target.sprite.material.color.set('#ffb2b9');
    }
    if (target.health <= 0) killContestant(target, attacker);
    return true;
  }

  function killContestant(target, attacker) {
    if (!target.alive) return;
    target.alive = false;
    target.deaths++;
    target.respawnAt = performance.now() + 2400;
    if (target.sprite) target.sprite.visible = false;
    if (target !== player) playRealSfx('bot-death', 0.5);
    if (attacker && attacker !== target) {
      attacker.frags++;
      appendKillFeed(attacker.name, target.name, 'FRAG');
    } else {
      appendKillFeed('ARENA', target.name, 'DOWN');
    }
    updateHud(true);
  }

  function respawnContestant(contestant, isPlayer) {
    const spec = ARENAS[selectedArena];
    const spawn = isPlayer
      ? spec.start
      : spec.spawns[Number(contestant.id.split('-')[1]) % spec.spawns.length];
    contestant.x = spawn[0] + (Math.random() - .5) * 3;
    contestant.z = spawn[1] + (Math.random() - .5) * 3;
    contestant.health = contestant.maxHealth;
    contestant.alive = true;
    contestant.respawnAt = 0;
    if (!isPlayer && contestant.sprite) {
      contestant.sprite.position?.set?.(contestant.x, 1.68, contestant.z);
      contestant.sprite.visible = true;
    } else if (isPlayer) {
      player.reloadUntil = 0;
      player.jumpHeight = 0;
      player.verticalVelocity = 0;
      positionCamera();
      appendKillFeed('YOU', 'SPAWN', 'READY');
    }
    updateHud(true);
  }

  function beginReload() {
    if (!player || gameState !== 'playing') return false;
    const weapon = WEAPONS[currentWeapon];
    const ammo = player.ammo[currentWeapon];
    if (player.reloadUntil > performance.now() || ammo.mag >= weapon.magSize || ammo.reserve <= 0) return false;
    player.reloadUntil = performance.now() + weapon.reloadMs;
    ui.reload.classList.remove('hidden');
    return true;
  }

  function finishReload() {
    const weapon = WEAPONS[currentWeapon];
    const ammo = player.ammo[currentWeapon];
    const fill = Math.min(weapon.magSize - ammo.mag, ammo.reserve);
    ammo.mag += fill;
    ammo.reserve -= fill;
    player.reloadUntil = 0;
    ui.reload.classList.add('hidden');
    updateHud(true);
  }

  function appendKillFeed(killer, victim, label) {
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    item.innerHTML = `<span class="killer">${escapeHtml(killer)}</span> <span>${escapeHtml(label)}</span> <span class="victim">${escapeHtml(victim)}</span>`;
    ui.killFeed.prepend(item);
    while (ui.killFeed.children.length > 4) ui.killFeed.lastElementChild.remove();
    setTimeout(() => item.remove(), 5000);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function updateEffects(dt) {
    if (fallbackMode) {
      for (let i = fallbackTracers.length - 1; i >= 0; i--) {
        fallbackTracers[i].life -= dt;
        if (fallbackTracers[i].life <= 0) fallbackTracers.splice(i, 1);
      }
      return;
    }
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const effect = activeEffects[i];
      effect.life -= dt;
      if (effect.life <= 0) {
        effectsRoot.remove(effect.object);
        effect.object.geometry.dispose();
        effect.object.material.dispose();
        activeEffects.splice(i, 1);
      } else if (effect.object.material.transparent) {
        effect.object.material.opacity = Math.max(0, effect.life / effect.maxLife);
      }
    }
  }

  function updateMinimap() {
    const canvas = $('#radar-canvas');
    if (!canvas || !player) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const scale = width / (WORLD_EDGE * 2);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(7,12,19,.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(130,155,175,.2)';
    ctx.strokeRect(1, 1, width - 2, height - 2);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-player.x, -player.z);
    ctx.fillStyle = 'rgba(145,171,189,.25)';
    for (const obstacle of obstacles) {
      ctx.fillRect(obstacle.minX, obstacle.minZ, obstacle.maxX - obstacle.minX, obstacle.maxZ - obstacle.minZ);
    }
    for (const bot of bots) {
      if (!bot.alive) continue;
      ctx.fillStyle = bot.color;
      ctx.beginPath();
      ctx.arc(bot.x, bot.z, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#65f5e5';
    ctx.beginPath();
    ctx.arc(player.x, player.z, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const keys = new Set();
  function updateGame(dt) {
    if (gameState !== 'playing') return;
    secondsRemaining = Math.max(0, secondsRemaining - dt);
    if (secondsRemaining <= 0) {
      finishMatch();
      return;
    }
    updatePlayer(dt);
    updateBots(dt);
    updateAmmoPickups(dt);
    updateEffects(dt);
    updateHud();
    updateMinimap();
  }

  function updateAmmoPickups(dt) {
    const now = performance.now();
    for (const pickup of ammoPickups) {
      pickup.phase += dt * 1.8;
      if (!fallbackMode) {
        pickup.mesh.rotation.y += dt * 1.6;
        pickup.mesh.position.y = 0.7 + Math.sin(pickup.phase) * 0.12;
      }
      if (!pickup.available) {
        if (now >= pickup.respawnAt) {
          pickup.available = true;
          pickup.mesh.visible = true;
          pickup.ring.visible = true;
        }
        continue;
      }
      if (!player.alive || Math.hypot(player.x - pickup.x, player.z - pickup.z) > 1.55) continue;
      let restored = 0;
      player.ammo.forEach((ammo, index) => {
        const weapon = WEAPONS[index];
        const before = ammo.reserve;
        ammo.reserve = Math.min(weapon.reserve * 1.5, ammo.reserve + Math.max(6, Math.round(weapon.magSize * 0.8)));
        restored += ammo.reserve - before;
      });
      if (restored) appendKillFeed('AMMO CACHE', 'ALL WEAPONS', 'RESUPPLIED');
      pickup.available = false;
      pickup.respawnAt = now + 18000;
      pickup.mesh.visible = false;
      pickup.ring.visible = false;
      updateHud(true);
    }
  }

  function renderFallbackFrame() {
    if (!fallbackContext || !fallbackCanvas) return;
    const ctx = fallbackContext;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const spec = ARENAS[selectedArena];
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#080e16');
    background.addColorStop(1, '#111a24');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const scale = Math.min(width / 94, height / 66);
    const centerX = width / 2;
    const centerY = height / 2 + 12;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-(player?.x || 0), -(player?.z || 0));

    ctx.fillStyle = spec.floor;
    ctx.fillRect(-WORLD_EDGE, -WORLD_EDGE, WORLD_EDGE * 2, WORLD_EDGE * 2);
    ctx.lineWidth = 0.035;
    ctx.strokeStyle = 'rgba(156,190,211,.14)';
    for (let line = -40; line <= 40; line += 4) {
      ctx.beginPath();
      ctx.moveTo(line, -WORLD_EDGE);
      ctx.lineTo(line, WORLD_EDGE);
      ctx.moveTo(-WORLD_EDGE, line);
      ctx.lineTo(WORLD_EDGE, line);
      ctx.stroke();
    }
    ctx.lineWidth = 0.34;
    ctx.strokeStyle = spec.accent;
    ctx.strokeRect(-WORLD_EDGE, -WORLD_EDGE, WORLD_EDGE * 2, WORLD_EDGE * 2);
    for (const obstacle of obstacles) {
      const obstacleWidth = obstacle.maxX - obstacle.minX;
      const obstacleDepth = obstacle.maxZ - obstacle.minZ;
      ctx.fillStyle = 'rgba(91,109,128,.48)';
      ctx.fillRect(obstacle.minX + 0.2, obstacle.minZ + 0.2, obstacleWidth, obstacleDepth);
      ctx.fillStyle = 'rgba(28,38,50,.98)';
      ctx.fillRect(obstacle.minX, obstacle.minZ, obstacleWidth, obstacleDepth);
      ctx.strokeStyle = 'rgba(179,205,221,.52)';
      ctx.lineWidth = 0.08;
      ctx.strokeRect(obstacle.minX, obstacle.minZ, obstacleWidth, obstacleDepth);
      ctx.fillStyle = spec.accent;
      ctx.fillRect(obstacle.minX, obstacle.minZ, Math.min(obstacleWidth, 1.2), 0.12);
    }
    if (selectedArena === 'core-forge') {
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,121,73,.35)';
      ctx.fill();
      ctx.strokeStyle = spec.accent;
      ctx.lineWidth = 0.16;
      ctx.stroke();
    }
    for (const pickup of ammoPickups) {
      if (!pickup.available) continue;
      ctx.save();
      ctx.translate(pickup.x, pickup.z);
      ctx.rotate(pickup.phase);
      ctx.fillStyle = spec.secondary;
      ctx.shadowColor = spec.secondary;
      ctx.shadowBlur = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -0.55); ctx.lineTo(0.48, 0); ctx.lineTo(0, 0.55); ctx.lineTo(-0.48, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    for (const tracer of fallbackTracers) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, tracer.life / tracer.maxLife);
      ctx.strokeStyle = tracer.color;
      ctx.lineWidth = 0.12;
      ctx.shadowColor = tracer.color;
      ctx.shadowBlur = 1.1;
      ctx.beginPath();
      ctx.moveTo(tracer.x1, tracer.z1);
      ctx.lineTo(tracer.x2, tracer.z2);
      ctx.stroke();
      ctx.restore();
    }
    for (const bot of bots) {
      if (!bot.alive || !bot.sprite?.visible) continue;
      ctx.save();
      ctx.translate(bot.x, bot.z);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.ellipse(0, 0.14, 1.18, 0.52, 0, 0, Math.PI * 2); ctx.fill();
      const image = bot.sprite.image;
      if (image?.complete && image.naturalWidth) {
        ctx.drawImage(image, -1.15, -2.8, 2.3, 2.8);
      } else {
        ctx.fillStyle = bot.color;
        ctx.beginPath(); ctx.arc(0, 0, 0.82, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(5,9,14,.83)';
      ctx.fillRect(-0.95, -3.18, 1.9, 0.18);
      ctx.fillStyle = bot.color;
      ctx.fillRect(-0.92, -3.15, 1.84 * bot.health / bot.maxHealth, 0.12);
      ctx.textAlign = 'center';
      ctx.font = 'bold 0.66px ui-monospace, monospace';
      ctx.fillStyle = '#dce7ef';
      ctx.fillText(bot.name, 0, -3.42);
      ctx.restore();
    }
    if (player?.alive) {
      ctx.save();
      ctx.translate(player.x, player.z);
      ctx.fillStyle = 'rgba(101,245,229,.18)';
      ctx.beginPath(); ctx.arc(0, 0, 1.55, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(-player.yaw);
      ctx.fillStyle = '#65f5e5';
      ctx.strokeStyle = '#ecfffc';
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(0, -1.15); ctx.lineTo(0.72, 0.62); ctx.lineTo(0, 0.35); ctx.lineTo(-0.72, 0.62);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      const aimX = player.x - Math.sin(player.yaw) * 8;
      const aimZ = player.z - Math.cos(player.yaw) * 8;
      ctx.strokeStyle = 'rgba(101,245,229,.32)';
      ctx.lineWidth = 0.055;
      ctx.beginPath(); ctx.moveTo(player.x, player.z); ctx.lineTo(aimX, aimZ); ctx.stroke();
      ctx.strokeStyle = '#eafffd';
      ctx.lineWidth = 0.09;
      ctx.beginPath(); ctx.arc(aimX, aimZ, 0.45, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function frame(timestamp) {
    if (!renderer && !fallbackMode) return;
    if (!previousFrame) previousFrame = timestamp;
    const elapsed = Math.min((timestamp - previousFrame) / 1000, 0.1);
    previousFrame = timestamp;
    accumulator = Math.min(accumulator + elapsed, 0.12);
    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      if (gameState === 'playing') updateGame(STEP);
      else updateEffects(STEP);
      accumulator -= STEP;
      steps++;
    }
    if (fallbackMode) renderFallbackFrame();
    else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resumeMatch() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    ui.pause.classList.add('hidden');
    if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) getInputSurface()?.requestPointerLock?.();
  }

  function pauseMatch() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    mouseFiring = false;
    touchFiring = false;
    ui.pause.classList.remove('hidden');
    document.exitPointerLock?.();
  }

  function updateStick(event) {
    const rect = ui.movePad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let x = (event.clientX - centerX) / (rect.width * 0.37);
    let y = (event.clientY - centerY) / (rect.height * 0.37);
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    moveStick = { x, y };
    const knob = ui.movePad.querySelector('i');
    knob.style.transform = `translate(${x * 31}px, ${y * 31}px)`;
  }

  function bindInput() {
    const inputSurface = getInputSurface();
    if (!inputSurface) return;
    ui.weaponBar.addEventListener('click', event => {
      const slot = event.target.closest('[data-weapon]');
      if (slot) selectWeapon(Number(slot.dataset.weapon));
    });
    arenaCards.forEach(card => card.addEventListener('click', () => {
      arenaCards.forEach(item => item.classList.toggle('selected', item === card));
      selectedArena = card.dataset.arena;
      buildArena(selectedArena);
    }));
    ui.start.addEventListener('click', () => startMatch(selectedArena));
    $('#resume-match').addEventListener('click', resumeMatch);
    $('#quit-match').addEventListener('click', () => {
      gameState = 'menu';
      document.exitPointerLock?.();
      ui.pause.classList.add('hidden');
      ui.hud.classList.add('hidden');
      ui.menu.classList.remove('hidden');
      ui.touchControls.classList.add('hidden');
    });
    $('#replay-match').addEventListener('click', () => startMatch(selectedArena));
    $('#back-to-menu').addEventListener('click', () => {
      gameState = 'menu';
      ui.end.classList.add('hidden');
      ui.menu.classList.remove('hidden');
      ui.hud.classList.add('hidden');
    });
    document.addEventListener('keydown', event => {
      if (event.code === 'Tab') {
        event.preventDefault();
        scoreboardHeld = true;
        ui.scoreOverlay.classList.remove('hidden');
        updateHud(true);
        return;
      }
      if (event.code === 'Escape' && gameState === 'playing') {
        pauseMatch();
        return;
      }
      keys.add(event.code);
      if (/^Digit[0-9]$/.test(event.code) && gameState === 'playing') {
        const digit = event.code.slice(-1);
        selectWeapon(digit === '0' ? 9 : Number(digit) - 1);
      }
      if (event.code === 'KeyR') beginReload();
      if (event.code === 'Space' && gameState === 'playing') event.preventDefault();
    });
    document.addEventListener('keyup', event => {
      keys.delete(event.code);
      if (event.code === 'Tab') {
        scoreboardHeld = false;
        ui.scoreOverlay.classList.add('hidden');
      }
    });
    document.addEventListener('mousemove', event => {
      if (document.pointerLockElement === inputSurface && gameState === 'playing') {
        player.yaw -= event.movementX * mouseSensitivity;
        if (!fallbackMode) player.pitch = Math.max(-1.28, Math.min(1.28, player.pitch - event.movementY * mouseSensitivity * .88));
      }
    });
    inputSurface.addEventListener('mousedown', event => {
      if (event.button === 0 && gameState === 'playing') {
        mouseFiring = true;
        firePlayerWeapon();
      }
    });
    document.addEventListener('mouseup', event => {
      if (event.button === 0) mouseFiring = false;
    });
    inputSurface.addEventListener('click', () => {
      if (gameState === 'paused') resumeMatch();
      else if (gameState === 'playing' && !('ontouchstart' in window)) inputSurface.requestPointerLock?.();
    });
    inputSurface.addEventListener('wheel', event => {
      if (gameState !== 'playing') return;
      const direction = event.deltaY > 0 ? 1 : -1;
      selectWeapon((currentWeapon + direction + WEAPONS.length) % WEAPONS.length);
    }, { passive: true });
    ui.movePad.addEventListener('pointerdown', event => {
      ui.movePad.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    ui.movePad.addEventListener('pointermove', event => {
      if (ui.movePad.hasPointerCapture(event.pointerId)) updateStick(event);
    });
    const resetStick = () => {
      moveStick = { x: 0, y: 0 };
      ui.movePad.querySelector('i').style.transform = 'translate(0,0)';
    };
    ui.movePad.addEventListener('pointerup', resetStick);
    ui.movePad.addEventListener('pointercancel', resetStick);
    $('#touch-fire').addEventListener('pointerdown', event => {
      event.preventDefault();
      touchFiring = true;
      firePlayerWeapon();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(name => $('#touch-fire').addEventListener(name, () => { touchFiring = false; }));
    $('#touch-jump').addEventListener('pointerdown', event => { event.preventDefault(); jumpRequested = true; });
    $('#touch-reload').addEventListener('pointerdown', event => { event.preventDefault(); beginReload(); });
    inputSurface.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || gameState !== 'playing') return;
      touchLook = { x: event.clientX, y: event.clientY };
      inputSurface.setPointerCapture?.(event.pointerId);
    });
    inputSurface.addEventListener('pointermove', event => {
      if (!touchLook || event.pointerType !== 'touch' || gameState !== 'playing') return;
      const dx = event.clientX - touchLook.x;
      const dy = event.clientY - touchLook.y;
      player.yaw -= dx * 0.005;
      if (!fallbackMode) player.pitch = Math.max(-1.28, Math.min(1.28, player.pitch - dy * 0.004));
      touchLook = { x: event.clientX, y: event.clientY };
    });
    ['pointerup', 'pointercancel'].forEach(name => inputSurface.addEventListener(name, () => { touchLook = null; }));
    document.addEventListener('pointerlockchange', () => {
      if (gameState === 'playing' && document.pointerLockElement !== inputSurface && !('ontouchstart' in window)) pauseMatch();
    });
    $('#mouse-sensitivity')?.addEventListener('change', event => {
      mouseSensitivity = Number(event.target.value) || 0.0026;
    });
    window.addEventListener('resize', () => {
      if (fallbackMode) {
        resizeFallbackCanvas();
        return;
      }
      if (!renderer || !camera) return;
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  if (!initializeRenderer()) return;
  bindInput();
  buildArena(selectedArena);
  renderWeaponBar();
  assetsReady = fallbackMode ? loadFallbackAssets() : loadGameAssets();
  requestAnimationFrame(frame);

  window.GNSDeathmatch = {
    ARENAS,
    BOT_ARCHETYPES,
    WEAPONS,
    get gameState() { return gameState; },
    get fallbackMode() { return fallbackMode; },
    get selectedArena() { return selectedArena; },
    get currentWeapon() { return currentWeapon; },
    get secondsRemaining() { return secondsRemaining; },
    get assetsReady() { return assetsReady; },
    get camera() { return camera; },
    get scene() { return scene; },
    get player() { return player; },
    get bots() { return bots; },
    get activeEffects() { return activeEffects; },
    get ammoPickups() { return ammoPickups; },
    startMatch,
    buildArena,
    finishMatch,
    firePlayerWeapon,
    selectWeapon,
    fireBot,
    damageContestant,
    getStandings,
    canOccupy,
    syncCamera: positionCamera,
    tick: updateGame,
    setSecondsRemaining(value) { secondsRemaining = Math.max(0, Number(value) || 0); }
  };
  window.startMatch = startMatch;
  window.finishMatch = finishMatch;
})();