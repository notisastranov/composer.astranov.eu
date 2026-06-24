// === VOICE + MAP DEPICT ===
// Natural speech: Greek, English, Greklish — never spell letter-by-letter.
// Every ACI action gets a visual on the globe; user can intervene anytime.

const Voice = {
  voices: [],
  ready: false,
  speaking: false,
  stopped: false,
  preferredListenLang: 'el-GR',
  _voicesReady: null,

  init() {
    const load = () => {
      this.voices = speechSynthesis.getVoices().filter(v => v.lang);
      if (this.voices.length) this.ready = true;
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    setTimeout(load, 400);
    setTimeout(load, 1200);
  },

  ensureVoices() {
    if (!this._voicesReady) {
      this._voicesReady = new Promise(resolve => {
        const done = () => {
          this.voices = speechSynthesis.getVoices().filter(v => v.lang);
          this.ready = this.voices.length > 0;
          resolve();
        };
        done();
        speechSynthesis.addEventListener('voiceschanged', done, { once: true });
        setTimeout(done, 800);
      });
    }
    return this._voicesReady;
  },

  detectLang(s) {
    const g = (s.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) || []).length;
    const l = (s.match(/[a-zA-Z]/g) || []).length;
    return g >= l * 0.25 ? 'el-GR' : 'en-US';
  },

  pickVoice(lang) {
    const v = this.voices;
    if (!v.length) return null;
    if (lang === 'el-GR') {
      return v.find(x => /stefanos|melina|google.*ελληνικά|greek/i.test(x.name))
        || v.find(x => /^el[-_]?GR$/i.test(x.lang))
        || v.find(x => /el/i.test(x.lang) && !/en/i.test(x.name));
    }
    return v.find(x => /zira|samantha|google.*english.*united states|natural/i.test(x.name))
      || v.find(x => /^en[-_]?US$/i.test(x.lang))
      || v.find(x => /^en[-_]?GB$/i.test(x.lang));
  },

  humanize(text) {
    return String(text || '')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[{}[\]"`#*_~|<>@$]/g, ' ')
      .replace(/\b([A-Z]{2,})\b/g, (_, w) => w.toLowerCase())
      .replace(/(\d)[.,](\d)/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  },

  shouldSpeak(text) {
    const t = (text || '').trim();
    if (t.length < 4) return false;
    if (/^[\d\s.,:;+\-/]+$/.test(t)) return false;
    if (t.startsWith('{') || t.startsWith('[') || /^\s*"ok"/.test(t)) return false;
    if ((t.match(/[a-zA-Z\u0370-\u03FF]/g) || []).length < 3) return false;
    return true;
  },

  splitSentences(text) {
    const parts = text.split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 3);
    const list = (parts.length ? parts : [text]).slice(0, 2);
    return list.map(s => ({ text: s, lang: this.detectLang(s) }));
  },

  stop() {
    this.stopped = true;
    this.speaking = false;
    try { speechSynthesis.cancel(); } catch (_) {}
  },

  speak(text, onEnd) {
    if (!voiceEnabled) { if (onEnd) onEnd(); return; }
    const clean = this.humanize(text);
    if (!this.shouldSpeak(clean)) { if (onEnd) onEnd(); return; }

    this.stop();
    this.stopped = false;

    this.ensureVoices().then(() => {
      const sentences = this.splitSentences(clean);
      let idx = 0;
      const speakNext = () => {
        if (this.stopped || idx >= sentences.length) {
          this.speaking = false;
          if (onEnd && !this.stopped) onEnd();
          return;
        }
        const { text: t, lang } = sentences[idx++];
        const utter = new SpeechSynthesisUtterance(t);
        utter.lang = lang;
        utter.rate = 0.95;
        utter.pitch = 1.0;
        const voice = this.pickVoice(lang);
        if (voice) utter.voice = voice;
        utter.onend = speakNext;
        utter.onerror = speakNext;
        this.speaking = true;
        speechSynthesis.speak(utter);
      };
      speakNext();
    });
  }
};

function speak(text, onEnd) { Voice.speak(text, onEnd); }
function stopSpeaking() { Voice.stop(); }

const MapDepict = {
  overlays: [],
  current: '',

  userPos() {
    return window._lastPos || { lat: 36.22, lng: 28.12 };
  },

  setHud(label, detail) {
    const ma = document.getElementById('map-action');
    if (ma) ma.textContent = detail ? label + ' — ' + detail : label;
    if (label && window.ACIControl) ACIControl.reply((label + (detail ? ': ' + detail : '')).slice(0, 220));
  },

  cancelAll() {
    this.overlays.forEach(o => {
      if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
      if (o.line && o.line.parent) o.line.parent.remove(o.line);
      if (o.group && o.group.parent) o.group.parent.remove(o.group);
    });
    this.overlays = [];
    this.current = '';
    const ma = document.getElementById('map-action');
    if (ma) ma.textContent = '';
  },

  pulse(lat, lng, color, label, duration = 9000) {
    const p = latLngToPos(lat, lng, 1.04);
    const pos = new THREE.Vector3(p.x, p.y, p.z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.018, 0.032, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.position.copy(pos);
    ring.lookAt(0, 0, 0);
    globePivot.add(ring);
    if (window.AIGraphics) AIGraphics.spawnEffect(pos, color, 14, 36);
    const entry = { mesh: ring, born: Date.now(), duration, label };
    this.overlays.push(entry);
    return entry;
  },

  arc(fromLat, fromLng, toLat, toLng, color = 0x00ffaa, duration = 14000) {
    const a = latLngToPos(fromLat, fromLng, 1.03);
    const b = latLngToPos(toLat, toLng, 1.03);
    const va = new THREE.Vector3(a.x, a.y, a.z);
    const vb = new THREE.Vector3(b.x, b.y, b.z);
    const mid = va.clone().add(vb).multiplyScalar(0.5).normalize().multiplyScalar(1.1);
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
    );
    globePivot.add(line);
    const entry = { line, born: Date.now(), duration };
    this.overlays.push(entry);
    return line;
  },

  action(type, opts = {}) {
    const u = this.userPos();
    const lat = opts.lat != null ? opts.lat : u.lat;
    const lng = opts.lng != null ? opts.lng : u.lng;
    const detail = (opts.detail || '').slice(0, 80);
    this.current = type;

    const palette = {
      think: 0x44ccff,
      evolve: 0xaa66ff,
      teach: 0x66ff99,
      order: 0xffaa44,
      vendor: 0xff8844,
      phone: 0x44ff88,
      vhf: 0xffdd44,
      news: 0xcc88ff,
      explore: 0x00aaff,
      video: 0x00ffcc,
      location: 0x00ffcc,
      mode: 0x88aaff,
      stop: 0xff4466,
      drive: 0x44aaff
    };
    const color = palette[type] || 0x00ddff;
    const labels = {
      think: 'Σκέψη ACI',
      evolve: 'Εξέλιξη collective',
      teach: 'Μνήμη / neuron',
      order: 'Παραγγελία',
      vendor: 'Καταστήματα',
      phone: 'Τηλέφωνο',
      vhf: 'VHF ασύρματος',
      news: 'Ειδήσεις',
      explore: 'Εξερεύνηση',
      video: 'Video κλήση',
      location: 'Τοποθεσία',
      mode: 'Λειτουργία ACI',
      stop: 'Διακοπή',
      drive: 'Οδήγηση δρόμου'
    };

    this.setHud(labels[type] || type, detail);
    this.pulse(lat, lng, color, labels[type]);

    if (type === 'order' && opts.vendorLat != null) {
      this.arc(opts.vendorLat, opts.vendorLng, lat, lng, color);
      const fp = latLngToPos(lat, lng, 1.04);
      focusOnGlobePoint(new THREE.Vector3(fp.x, fp.y, fp.z));
    }
    if (type === 'vendor' && opts.vendors) {
      opts.vendors.forEach(v => this.pulse(v.lat, v.lng, color, v.name, 12000));
    }
    if (type === 'news' && opts.worldLat != null) {
      this.pulse(opts.worldLat, opts.worldLng, color, 'World news', 10000);
    }
    if (type === 'evolve') {
      [{ lat: 36.22, lng: 28.12 }, { lat: 40, lng: 20 }, { lat: -15, lng: 45 }, { lat: 55, lng: -30 }]
        .forEach(s => this.pulse(s.lat, s.lng, color, 'neuron', 11000));
    }
    if (type === 'think') {
      const fp = latLngToPos(lat, lng, 1.04);
      focusOnGlobePoint(new THREE.Vector3(fp.x, fp.y, fp.z));
    }

    return { type, lat, lng };
  },

  tick() {
    const now = Date.now();
    this.overlays = this.overlays.filter(o => {
      const age = (now - o.born) / o.duration;
      if (age >= 1) {
        if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
        if (o.line && o.line.parent) o.line.parent.remove(o.line);
        return false;
      }
      if (o.mesh) {
        o.mesh.material.opacity = 0.9 * (1 - age * 0.85);
        const s = 1 + age * 1.8;
        o.mesh.scale.set(s, s, s);
      }
      if (o.line) o.line.material.opacity = 0.75 * (1 - age);
      return true;
    });
  }
};

window.Voice = Voice;
window.MapDepict = MapDepict;

function userIntervene() {
  Voice.stop();
  if (window.PmrRadio) PmrRadio.hide();
  if (window.DrivingView) DrivingView.deactivate();
  MapDepict.cancelAll();
  if (window._aciAbort) { try { window._aciAbort.abort(); } catch (_) {} }
  if (window._droneAnim) { clearInterval(window._droneAnim); window._droneAnim = null; }
  if (Comms) Comms.vhfActive = false;
  if (recognition) { try { recognition.stop(); } catch (_) {} }
  isListening = false;
  if (ACI) ACI.evolving = false;
  const ma = document.getElementById('map-action');
  if (ma) ma.textContent = '⏹ Διακοπή — εσύ παίρνεις τον έλεγχο';
  if (window.ACIControl) ACIControl.reply('Stopped — your move. Drag, zoom, type or speak.');
  speak('Σταμάτησα. Your move — πες ή γράψε τι θες.', () => {});
}

window.userIntervene = userIntervene;