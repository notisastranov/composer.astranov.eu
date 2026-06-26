const container = document.getElementById('globe');

// Robust WebGL + error guard so user never sees silent black
window.addEventListener('error', function(e) {
  try {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;bottom:8px;left:8px;padding:4px 8px;background:rgba(20,0,0,0.7);color:#f66;font:11px/1.3 monospace;z-index:99999;pointer-events:none;';
    msg.textContent = 'Init/Render error: ' + (e.message || 'unknown') + ' — try Chrome/Firefox, enable HW accel, check console';
    document.body.appendChild(msg);
  } catch(_) {}
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
} catch (e) {
  const fb = document.createElement('div');
  fb.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#0af;font:15px system-ui;background:#000;z-index:10;text-align:center;';
  fb.innerHTML = 'WebGL unavailable.<br>Update browser or enable hardware acceleration.<br><small>Astranov globe needs WebGL</small>';
  container.appendChild(fb);
  throw e;
}

// Hoisted top-level mutable state (must be declared BEFORE any top-level calls like initVoice/initUser)
let drag = false, px = 0, py = 0;
let dragging = false;
let idleRoll = 0.00035;
let globePivot;
let trackVelX = 0, trackVelY = 0;
let cityLevel = false;
let voiceEnabled = false;
let voiceSessionActive = false;
let isListening = false;
let recognition;
let userLocated = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.25, 2.5);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0x667788, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(5, 3, 4);
scene.add(sun);

// Stars - bigger/brighter to guarantee visibility against black
const starPos = [];
for (let i=0; i<14000; i++) {
  const r = 140 + Math.random()*900;
  const t = Math.random()*Math.PI*2;
  const p = Math.acos(2*Math.random()-1);
  starPos.push(r*Math.sin(p)*Math.cos(t), r*Math.sin(p)*Math.sin(t), r*Math.cos(p));
}
const sgeo = new THREE.BufferGeometry();
sgeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos,3));
scene.add(new THREE.Points(sgeo, new THREE.PointsMaterial({color:0xffffff, size:2.8, sizeAttenuation:false})));

// Earth - use BasicMaterial for guaranteed visibility (Phong can look black depending on lighting)
const earthMat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
const earthTexUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg';
new THREE.TextureLoader().load(
  earthTexUrl,
  (tex) => { earthMat.map = tex; earthMat.needsUpdate = true; },
  undefined,
  () => { console.log('Earth texture fallback active'); }
);
globePivot = new THREE.Group();
scene.add(globePivot);

const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat);
globePivot.add(earth);
globePivot.rotation.y = 0.82;

// lat/lng to 3D sphere position
function latLngToPos(lat, lng, r = 1) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return {
    x: -(r * Math.sin(phi) * Math.cos(theta)),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta)
  };
}

// Globe follow vs free explore — release when user drags the globe
const GlobeControl = {
  followMode: 'free',
  userExploring: false,
  _exploreUntil: 0,
  _lastAutoFly: 0,
  _snapConflicts: 0,

  isEarthView() {
    const z = camera?.position?.z ?? 2.5;
    const level = CosmicZoom?.level || 'earth';
    return (level === 'earth' || level === 'orbit') && z < 4.5;
  },

  shouldAutoFly() {
    if (drag || dragging) return false;
    if (this.userExploring && Date.now() < this._exploreUntil) return false;
    return this.followMode !== 'free';
  },

  engageFollow(mode) {
    this.followMode = mode || 'locate';
    this.userExploring = false;
    this._exploreUntil = 0;
    const btn = document.getElementById('aci-locate');
    if (btn) btn.classList.toggle('deck-btn-active', mode === 'locate');
  },

  userTookGlobe(reason) {
    if (this.userExploring && Date.now() - this._lastAutoFly < 2500) {
      this._snapConflicts++;
      window.AciCoders?.observeActivity?.('ui_struggle', 'globe snap-back · user freed globe', { conflicts: this._snapConflicts });
    }
    this.userExploring = true;
    this._exploreUntil = Date.now() + 180000;
    this.followMode = 'free';
    window._globeFly = null;
    const btn = document.getElementById('aci-locate');
    if (btn) btn.classList.remove('deck-btn-active');
    if (window.DrivingView) DrivingView._cameraFollow = false;
    GlobeDeck?.setPreview('🌍 Globe free — drag to explore');
    window.SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
    if (reason !== 'silent') {
      window.AciCoders?.observeActivity?.('ui', 'user explore globe · follow released', { reason: reason || 'drag' });
    }
  },

  noteAutoFly() {
    this._lastAutoFly = Date.now();
  },

  flyToLatLng(lat, lng, label, targetZ) {
    if (!this.isEarthView()) return false;
    const p = latLngToPos(lat, lng, 1.04);
    if (typeof flyToPoint !== 'function') return false;
    flyToPoint(new THREE.Vector3(p.x, p.y, p.z), targetZ || 1.48);
    this.noteAutoFly();
    MapDepict?.pulse?.(lat, lng, 0x00ddff, label || 'task', 8000);
    return true;
  },
};
window.GlobeControl = GlobeControl;
