(() => {
  'use strict';

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let context = null;
  let masterBus;
  let musicBus;
  let effectsBus;
  let ambienceBus;
  let noiseBuffer;
  let activeScene = 'arena';
  let active = false;
  let scoreTimer = 0;
  let barIndex = 0;
  let engineOscillators = [];
  let ambienceSources = [];
  let tension = 0.28;
  let engineIntensity = 0.24;
  const levels = { master: 0.72, music: 0.34, effects: 0.72 };

  // iOS Safari specifically (confirmed elsewhere in this project - other
  // browsers were fine) sometimes needs an actual audio node to start
  // playing, even a silent one, inside the same synchronous gesture call
  // stack as context creation/resume - a bare .resume() isn't always
  // enough on its own. ensureAudio() already only ever runs from a real
  // click (the mixer panel toggle, or whatever UI calls play()/start()
  // first), so this kick riding along in the same call is the cheapest
  // place to add the extra safety net.
  function kickContext() {
    if (!context) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
    try {
      const kick = context.createBufferSource();
      kick.buffer = context.createBuffer(1, 1, context.sampleRate);
      kick.connect(context.destination);
      kick.start(0);
    } catch (_) {}
  }
  function ensureAudio() {
    if (context) { kickContext(); return true; }
    if (!AudioContextClass) return false;
    try {
      context = new AudioContextClass();
      masterBus = context.createGain();
      musicBus = context.createGain();
      effectsBus = context.createGain();
      ambienceBus = context.createGain();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -19;
      compressor.knee.value = 12;
      compressor.ratio.value = 3.2;
      compressor.attack.value = 0.012;
      compressor.release.value = 0.24;
      musicBus.connect(masterBus);
      effectsBus.connect(masterBus);
      ambienceBus.connect(masterBus);
      masterBus.connect(compressor);
      compressor.connect(context.destination);
      masterBus.gain.value = levels.master;
      musicBus.gain.value = 0;
      effectsBus.gain.value = levels.effects;
      ambienceBus.gain.value = 0;
      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < samples.length; i++) {
        brown = (brown + 0.025 * (Math.random() * 2 - 1)) / 1.025;
        samples[i] = brown * 3.5;
      }
      noiseBuffer = buffer;
      mountMixer();
      kickContext();
      return true;
    } catch (error) {
      console.warn('Game audio is unavailable in this browser.', error);
      return false;
    }
  }

  function setTarget(param, value, time = 0.4) {
    if (!context || !param) return;
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, Math.max(0.03, time));
  }

  function makePanner(pan = 0) {
    if (!context || !context.createStereoPanner) return null;
    const node = context.createStereoPanner();
    node.pan.value = clamp(Number(pan) || 0, -1, 1);
    return node;
  }

  function envelope(node, peak, duration, delay = 0, hold = 0.015) {
    const now = context.currentTime + delay;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(0.0001, now);
    node.gain.linearRampToValueAtTime(Math.max(0.0002, peak), now + hold);
    node.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  function tone(startHz, endHz, duration, options = {}) {
    if (!ensureAudio()) return;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = makePanner(options.pan);
    oscillator.type = options.type || 'triangle';
    oscillator.frequency.setValueAtTime(Math.max(20, startHz), context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), context.currentTime + duration);
    filter.type = options.filter || 'lowpass';
    filter.frequency.value = options.cutoff || 2100;
    filter.Q.value = options.q || 0.7;
    oscillator.connect(filter);
    filter.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(options.bus || effectsBus);
    } else gain.connect(options.bus || effectsBus);
    envelope(gain, options.level || 0.12, duration, options.delay || 0, options.attack || 0.012);
    oscillator.start(context.currentTime + (options.delay || 0));
    oscillator.stop(context.currentTime + (options.delay || 0) + duration + 0.03);
  }

  function noiseBurst(duration, options = {}) {
    if (!ensureAudio()) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = makePanner(options.pan);
    source.buffer = noiseBuffer;
    filter.type = options.filter || 'lowpass';
    filter.frequency.setValueAtTime(options.high || 1300, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(70, options.low || 130), context.currentTime + duration);
    filter.Q.value = options.q || 0.7;
    source.connect(filter);
    filter.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(options.bus || effectsBus);
    } else gain.connect(options.bus || effectsBus);
    envelope(gain, options.level || 0.14, duration, 0, options.attack || 0.004);
    source.start();
    source.stop(context.currentTime + duration + 0.04);
  }

  function impact(options = {}) {
    const power = clamp(options.power || 1, 0.2, 2.2);
    tone(92 * power, 31, 0.42, { type: 'sine', level: 0.3 * power, cutoff: 480, pan: options.pan });
    tone(740, 93, 0.18, { type: 'square', level: 0.075 * power, cutoff: 1550, pan: options.pan });
    noiseBurst(0.3, { level: 0.2 * power, high: 1500, low: 115, pan: options.pan });
  }

  function weaponShot(kind, options = {}) {
    const pan = options.pan || 0;
    const power = clamp(options.power || 1, 0.2, 1.8);
    const profiles = {
      cannon: [270, 38, 0.34],
      plasma: [520, 70, 0.24],
      laser: [960, 210, 0.18],
      missile: [180, 45, 0.72],
      rail: [1240, 95, 0.5],
      shot: [350, 48, 0.26],
      enemyshot: [240, 52, 0.24]
    };
    const [high, low, duration] = profiles[kind] || profiles.shot;
    tone(high, low, duration, { type: kind === 'laser' || kind === 'rail' ? 'sawtooth' : 'square', level: 0.18 * power, cutoff: kind === 'rail' ? 3600 : 1850, pan });
    tone(high * 0.52, low * 0.65, duration * 1.28, { type: 'sine', level: 0.2 * power, cutoff: 440, pan });
    noiseBurst(kind === 'missile' ? 0.58 : 0.22, {
      level: (kind === 'missile' ? 0.2 : 0.1) * power,
      high: kind === 'rail' ? 4800 : 2400,
      low: 150,
      pan
    });
  }

  function kaijuBellow(options = {}) {
    const pan = options.pan || 0;
    tone(78, 27, 1.8, { type: 'sawtooth', level: 0.19, cutoff: 390, q: 3.5, pan });
    tone(116, 42, 1.45, { type: 'triangle', level: 0.16, cutoff: 670, q: 2.1, pan });
    noiseBurst(1.55, { level: 0.16, high: 900, low: 100, filter: 'bandpass', q: 1.8, pan });
  }

  function uiChime(kind = 'confirm') {
    const notes = kind === 'warning' ? [420, 330] : kind === 'lock' ? [740, 1120] : [520, 780, 1040];
    notes.forEach((frequency, index) =>
      tone(frequency, frequency * 1.02, 0.22, {
        type: 'sine', level: 0.065, cutoff: 3500, delay: index * 0.07
      })
    );
  }

  function play(name, options = {}) {
    if (!ensureAudio()) return;
    if (context.state === 'suspended' && active) context.resume().catch(() => {});
    const aliases = {
      shot: 'shot', fireball: 'enemyshot', enemyshot: 'enemyshot', cannon: 'cannon',
      plasma: 'plasma', laser: 'laser', missile: 'missile', rail: 'rail'
    };
    if (aliases[name]) return weaponShot(aliases[name], options);
    if (['hit', 'punch', 'mech-hit', 'kaiju-hit'].includes(name)) return impact(options);
    if (['bellow', 'roar', 'kaiju'].includes(name)) return kaijuBellow(options);
    if (['step', 'stomp'].includes(name)) {
      tone(63, 29, 0.34, { type: 'sine', level: 0.19, cutoff: 250, pan: options.pan });
      noiseBurst(0.22, { level: 0.14, high: 660, low: 80, pan: options.pan });
      return;
    }
    if (['boost', 'dash'].includes(name)) {
      tone(180, 980, 0.46, { type: 'sawtooth', level: 0.09, cutoff: 1800, pan: options.pan });
      noiseBurst(0.34, { level: 0.12, high: 2400, low: 190, pan: options.pan });
      return;
    }
    if (['shield', 'shield-on'].includes(name)) {
      tone(115, 920, 0.56, { type: 'triangle', level: 0.11, cutoff: 2500 });
      tone(480, 125, 0.45, { type: 'sine', level: 0.1, cutoff: 1200 });
      return;
    }
    if (['door', 'reload'].includes(name)) {
      tone(410, 150, 0.3, { type: 'triangle', level: 0.085, cutoff: 1000 });
      noiseBurst(0.19, { level: 0.075, high: 1100, low: 220 });
      return;
    }
    if (['empty', 'warning', 'hurt'].includes(name)) {
      tone(490, 190, 0.31, { type: 'square', level: 0.075, cutoff: 1250 });
      return;
    }
    if (['win', 'levelup', 'confirm', 'pickup', 'lock'].includes(name)) {
      return uiChime(name === 'warning' ? 'warning' : name === 'lock' ? 'lock' : 'confirm');
    }
    if (name === 'radio') {
      noiseBurst(0.1, { level: 0.04, high: 6400, low: 1200, filter: 'bandpass', q: 5 });
      tone(1150, 760, 0.1, { type: 'square', level: 0.025, cutoff: 2400 });
    }
  }

  function createAmbience() {
    if (ambienceSources.length) return;
    const humFilter = context.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 260;
    const humGain = context.createGain();
    humGain.gain.value = 0.032;
    engineOscillators = [36, 54, 82].map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 1 ? 'triangle' : 'sawtooth';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 2 ? 4 : -3;
      oscillator.connect(humFilter);
      oscillator.start();
      return oscillator;
    });
    humFilter.connect(humGain);
    humGain.connect(ambienceBus);

    const sea = context.createBufferSource();
    const seaFilter = context.createBiquadFilter();
    const seaGain = context.createGain();
    sea.buffer = noiseBuffer;
    sea.loop = true;
    seaFilter.type = 'lowpass';
    seaFilter.frequency.value = 410;
    seaGain.gain.value = 0.018;
    sea.connect(seaFilter);
    seaFilter.connect(seaGain);
    seaGain.connect(ambienceBus);
    sea.start();
    ambienceSources.push(sea);

    const radio = context.createOscillator();
    const radioGain = context.createGain();
    radio.type = 'sine';
    radio.frequency.value = 0.13;
    radioGain.gain.value = 0.004;
    radio.connect(radioGain);
    radioGain.connect(ambienceBus);
    radio.start();
    ambienceSources.push(radio);
  }

  const chordSets = {
    mech: [[55, 82.4, 110], [49, 73.4, 98], [65.4, 98, 130.8], [43.7, 65.4, 87.3]],
    alien: [[49, 73.4, 98], [46.2, 69.3, 92.5], [55, 82.4, 110], [41.2, 61.7, 82.4]],
    arena: [[65.4, 98, 130.8], [73.4, 110, 146.8], [55, 82.4, 110], [61.7, 92.5, 123.5]]
  };

  function scoreBar() {
    if (!active || !context || context.state !== 'running') return;
    const set = chordSets[activeScene] || chordSets.arena;
    const chord = set[barIndex % set.length];
    barIndex++;
    chord.forEach((frequency, index) => {
      tone(frequency, frequency * (index === 0 ? 0.99 : 1.01), 3.45, {
        type: index === 1 ? 'triangle' : 'sawtooth',
        level: (0.016 + tension * 0.012) / (index + 1),
        cutoff: 820 + tension * 1300,
        filter: 'lowpass',
        bus: musicBus,
        attack: 0.65
      });
    });
    const motif = [chord[2] * 2, chord[1] * 2.52, chord[2] * 1.5, chord[0] * 2];
    const note = motif[barIndex % motif.length];
    tone(note, note * 0.998, 0.62, {
      type: 'sine', level: 0.012 + tension * 0.012, cutoff: 2200,
      bus: musicBus, attack: 0.04
    });
    if (activeScene === 'mech' && barIndex % 2 === 0) {
      tone(38, 29, 0.8, { type: 'sine', level: 0.025 + tension * 0.024, cutoff: 150, bus: musicBus });
      noiseBurst(0.14, { level: 0.012 + tension * 0.012, high: 400, low: 85, bus: musicBus });
    }
    setTarget(musicBus.gain, levels.music, 0.5);
  }

  function updateMixerLevels() {
    if (!context) return;
    setTarget(masterBus.gain, levels.master, 0.08);
    setTarget(effectsBus.gain, levels.effects, 0.08);
    if (!active) setTarget(musicBus.gain, 0, 0.16);
  }

  function mountMixer() {
    if (document.getElementById('orbitron-audio-toggle')) return;
    const style = document.createElement('style');
    style.textContent = `
      #orbitron-audio { position:fixed; z-index:95; right:14px; top:14px; font:700 10px/1.2 ui-monospace,monospace; letter-spacing:.1em; color:#dcecf4; }
      #orbitron-audio-toggle { min-height:34px; padding:0 11px; border:1px solid rgba(105,226,241,.55); background:rgba(5,12,19,.86); color:#c9fbff; cursor:pointer; backdrop-filter:blur(8px); }
      #orbitron-audio-panel { width:190px; margin-top:6px; padding:12px; border:1px solid rgba(105,226,241,.32); background:rgba(5,12,19,.94); box-shadow:0 12px 32px #0008; }
      #orbitron-audio-panel[hidden] { display:none; }
      #orbitron-audio-panel label { display:grid; grid-template-columns:1fr auto; gap:5px 8px; margin:8px 0; color:#a9bdc8; font-size:9px; }
      #orbitron-audio-panel input { grid-column:1/-1; width:100%; accent-color:#69e2f1; }
      #orbitron-audio-panel button { width:100%; padding:7px; border:1px solid #527280; background:#12232d; color:#e8fbff; cursor:pointer; font:inherit; }
      @media(max-width:700px) {
        #orbitron-audio { top:10px; bottom:auto; right:10px; }
        #orbitron-audio.orbitron-audio-touch { top:50%; right:auto; bottom:auto; left:8px; transform:translateY(-50%); }
      }
    `;
    document.head.appendChild(style);
    const mount = document.createElement('div');
    mount.id = 'orbitron-audio';
    if (document.querySelector('.touch-controls, #touch-fire, [data-game-mode]')) mount.classList.add('orbitron-audio-touch');
    mount.innerHTML = `
      <button id="orbitron-audio-toggle" type="button" aria-expanded="false">AUDIO MIX</button>
      <div id="orbitron-audio-panel" hidden>
        <label>MASTER <output id="orbitron-audio-master-value">72%</output>
          <input data-audio-level="master" type="range" min="0" max="1" step=".01" value=".72" aria-label="Master volume">
        </label>
        <label>MUSIC <output id="orbitron-audio-music-value">34%</output>
          <input data-audio-level="music" type="range" min="0" max="1" step=".01" value=".34" aria-label="Music volume">
        </label>
        <label>EFFECTS <output id="orbitron-audio-effects-value">72%</output>
          <input data-audio-level="effects" type="range" min="0" max="1" step=".01" value=".72" aria-label="Effects volume">
        </label>
        <button id="orbitron-audio-mute" type="button">MUTE / RESUME</button>
      </div>`;
    document.body.appendChild(mount);
    const toggle = mount.querySelector('#orbitron-audio-toggle');
    const panel = mount.querySelector('#orbitron-audio-panel');
    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) ensureAudio();
    });
    mount.querySelectorAll('[data-audio-level]').forEach(input => {
      input.addEventListener('input', () => {
        levels[input.dataset.audioLevel] = Number(input.value);
        const output = mount.querySelector(`#orbitron-audio-${input.dataset.audioLevel}-value`);
        if (output) output.value = Math.round(Number(input.value) * 100) + '%';
        updateMixerLevels();
        if (active && input.dataset.audioLevel === 'music') setTarget(musicBus.gain, levels.music, 0.08);
      });
    });
    mount.querySelector('#orbitron-audio-mute').addEventListener('click', () => {
      levels.master = levels.master > 0 ? 0 : 0.72;
      mount.querySelector('[data-audio-level="master"]').value = levels.master;
      mount.querySelector('#orbitron-audio-master-value').value = Math.round(levels.master * 100) + '%';
      updateMixerLevels();
    });
  }

  async function start(scene = 'arena') {
    if (!ensureAudio()) return false;
    activeScene = ['mech', 'alien', 'arena'].includes(scene) ? scene : 'arena';
    active = true;
    if (context.state === 'suspended') await context.resume().catch(() => {});
    createAmbience();
    setTarget(ambienceBus.gain, levels.master > 0 ? 0.78 : 0, 0.8);
    setTarget(musicBus.gain, levels.music, 0.8);
    clearInterval(scoreTimer);
    scoreBar();
    scoreTimer = setInterval(scoreBar, activeScene === 'mech' ? 3100 : 3900);
    return true;
  }

  function stop() {
    active = false;
    clearInterval(scoreTimer);
    scoreTimer = 0;
    if (!context) return;
    setTarget(musicBus.gain, 0, 0.8);
    setTarget(ambienceBus.gain, 0, 0.9);
  }

  function setTension(value) {
    tension = clamp(Number(value) || 0, 0, 1);
  }

  function setEngineIntensity(value) {
    engineIntensity = clamp(Number(value) || 0, 0, 1);
    if (context && engineOscillators.length) {
      const base = activeScene === 'mech' ? 38 + engineIntensity * 18 : 33 + engineIntensity * 9;
      engineOscillators[0].frequency.setTargetAtTime(base, context.currentTime, 0.18);
      engineOscillators[1].frequency.setTargetAtTime(base * 1.49, context.currentTime, 0.18);
      engineOscillators[2].frequency.setTargetAtTime(base * 2.14, context.currentTime, 0.18);
    }
  }

  // Belt-and-suspenders: every current call site into this module
  // (mixer toggle, start-match buttons) already fires from a genuine
  // click, so this may never actually be needed - but if some future
  // caller ever triggers audio without a prior click, this guarantees
  // one gesture-scoped unlock attempt happens regardless.
  (function unlockOnFirstGesture() {
    const unlock = () => {
      ensureAudio();
      ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown'].forEach(t => window.removeEventListener(t, unlock));
    };
    ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown'].forEach(t => window.addEventListener(t, unlock, { passive: true }));
  })();

  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden && context.state === 'running') context.suspend().catch(() => {});
    else if (!document.hidden && active && context.state === 'suspended') context.resume().catch(() => {});
  });

  window.OrbitronAudio = {
    start,
    stop,
    play,
    setTension,
    setEngineIntensity,
    get state() { return { active, scene: activeScene, levels: { ...levels } }; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountMixer, { once: true });
  else mountMixer();
})();