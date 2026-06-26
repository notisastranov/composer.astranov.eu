// === EARTH REALISM — live day/night terminator, sun & moon ===
const EarthRealism = {
  _inited: false,
  sunDir: new THREE.Vector3(1, 0.2, 0.4),
  moonMesh: null,
  sunGlow: null,
  terminator: null,
  _dayTex: null,
  _nightTex: null,
  _hudTimer: 0,

  init() {
    if (this._inited || !earth) return;
    this._inited = true;
    const loader = new THREE.TextureLoader();
    const dayUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg';
    const nightUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_lights_2048.png';
    loader.load(dayUrl, tex => {
      this._dayTex = tex;
      this._applyShader();
    });
    loader.load(nightUrl, tex => {
      this._nightTex = tex;
      this._applyShader();
    });
    this._buildSkyBodies();
    this._buildTerminator();
    this.tick();
  },

  _applyShader() {
    if (!this._dayTex || !this._nightTex || !earth) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: this._dayTex },
        nightTexture: { value: this._nightTex },
        sunDirection: { value: this.sunDir.clone() },
        brightness: { value: AstranovTheme?.mode === 'bright' ? 1.15 : 1.0 },
      },
      vertexShader: [
        'varying vec2 vUv;',
        'varying vec3 vNormalW;',
        'void main() {',
        '  vUv = uv;',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vNormalW = normalize(mat3(modelMatrix) * normal);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D dayTexture;',
        'uniform sampler2D nightTexture;',
        'uniform vec3 sunDirection;',
        'uniform float brightness;',
        'varying vec2 vUv;',
        'varying vec3 vNormalW;',
        'void main() {',
        '  float d = dot(normalize(vNormalW), normalize(sunDirection));',
        '  vec4 dayColor = texture2D(dayTexture, vUv);',
        '  vec4 nightColor = texture2D(nightTexture, vUv);',
        '  float blend = smoothstep(-0.12, 0.28, d);',
        '  vec4 col = mix(nightColor * 1.35, dayColor, blend);',
        '  gl_FragColor = vec4(col.rgb * brightness, 1.0);',
        '}',
      ].join('\n'),
    });
    earth.material = mat;
    earth.material.needsUpdate = true;
  },

  onThemeChange() {
    if (earth?.material?.uniforms?.brightness) {
      earth.material.uniforms.brightness.value = AstranovTheme?.mode === 'bright' ? 1.15 : 1.0;
    }
  },

  _buildSkyBodies() {
    const sunGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
    this.sunGlow = new THREE.Mesh(sunGeo, sunMat);
    this.sunGlow.userData = { type: 'sun-indicator' };
    scene.add(this.sunGlow);

    const moonGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xccddee });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.userData = { type: 'moon-indicator' };
    scene.add(this.moonMesh);
  },

  _buildTerminator() {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.012, 0, Math.sin(a) * 1.012));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.terminator = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.55 })
    );
    globePivot.add(this.terminator);
  },

  _solarPosition(date) {
    const d = date || new Date();
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const day = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000;
    const decl = 23.44 * Math.sin((360 / 365) * (day - 81) * Math.PI / 180) * Math.PI / 180;
    const utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const lon = ((12 - utcH) * 15) * Math.PI / 180;
    const lat = decl;
    const x = Math.cos(lat) * Math.cos(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.sin(lon);
    return new THREE.Vector3(x, y, z).normalize();
  },

  _moonPosition(date) {
    const d = date || new Date();
    const jd = 367 * d.getUTCFullYear()
      - Math.floor(7 * (d.getUTCFullYear() + Math.floor((d.getUTCMonth() + 9) / 12)) / 4)
      + Math.floor(275 * (d.getUTCMonth() + 1) / 9)
      + d.getUTCDate() - 730530
      + (d.getUTCHours() + d.getUTCMinutes() / 60) / 24;
    const phase = (jd / 29.53) * Math.PI * 2;
    const orbit = jd * 0.036 + 1.2;
    const dist = 2.8;
    const sun = this._solarPosition(d);
    const perp = new THREE.Vector3(-sun.z, 0.15, sun.x).normalize();
    const pos = sun.clone().multiplyScalar(Math.cos(phase) * dist * 0.35)
      .add(perp.clone().multiplyScalar(Math.sin(phase) * dist))
      .add(new THREE.Vector3(Math.cos(orbit) * 0.2, Math.sin(orbit) * 0.08, Math.sin(orbit) * 0.2));
    return pos.normalize().multiplyScalar(dist);
  },

  _updateTerminator(sunDir) {
    if (!this.terminator) return;
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(up, sunDir).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, up.dot(sunDir))));
    this.terminator.quaternion.setFromAxisAngle(axis, angle);
  },

  _formatHud(sunDir) {
    const subsolar = this._subsolarLatLng(sunDir);
    const now = new Date();
    const utc = now.toISOString().slice(11, 16) + ' UTC';
    const illum = Math.round((1 + sunDir.y) * 50);
    const moonVis = this.moonMesh?.visible ? 'visible' : 'below horizon';
    return '<div class="cg-title">Live Earth · ' + utc + '</div>'
      + '<div class="cg-item"><b>☀ Sun</b> — subsolar ' + subsolar.lat.toFixed(1) + '°, ' + subsolar.lng.toFixed(1) + '°</div>'
      + '<div class="cg-item"><b>🌗 Terminator</b> — real-time day/night boundary · ' + illum + '% lit</div>'
      + '<div class="cg-item"><b>🌙 Moon</b> — ' + moonVis + ' · phase from ephemeris</div>'
      + '<div class="cg-item"><i>Drag globe · zoom in for city satellite map</i></div>';
  },

  _subsolarLatLng(sunDir) {
    const lat = Math.asin(Math.max(-1, Math.min(1, sunDir.y))) * 180 / Math.PI;
    let lng = Math.atan2(sunDir.z, sunDir.x) * 180 / Math.PI;
    if (lng > 180) lng -= 360;
    return { lat, lng };
  },

  tick() {
    const sunDir = this._solarPosition();
    this.sunDir.copy(sunDir);
    if (earth?.material?.uniforms?.sunDirection) {
      earth.material.uniforms.sunDirection.value.copy(sunDir);
    }
    if (typeof sun !== 'undefined' && sun?.position) {
      sun.position.copy(sunDir.clone().multiplyScalar(8));
      sun.intensity = AstranovTheme?.mode === 'bright' ? 1.9 : 1.5;
    }
    if (this.sunGlow) {
      this.sunGlow.position.copy(sunDir.clone().multiplyScalar(4.2));
      const camZ = camera?.position?.z ?? 2.5;
      this.sunGlow.visible = camZ < 5.5 && camZ > 1.5 && !CityMap?.active;
      this.sunGlow.scale.setScalar(0.85 + Math.sin(Date.now() * 0.002) * 0.08);
    }
    if (this.moonMesh) {
      this.moonMesh.position.copy(this._moonPosition());
      const camZ = camera?.position?.z ?? 2.5;
      this.moonMesh.visible = camZ < 5.5 && camZ > 1.5 && !CityMap?.active;
    }
    this._updateTerminator(sunDir);

    const level = CosmicZoom?.level || 'earth';
    const camZ = camera?.position?.z ?? 2.5;
    if (level === 'earth' && camZ < 3.4 && !CityMap?.active) {
      const now = Date.now();
      if (now - this._hudTimer > 4000) {
        this._hudTimer = now;
        const el = document.getElementById('cosmic-guide');
        if (el) el.innerHTML = this._formatHud(sunDir);
      }
    }
  },
};
window.EarthRealism = EarthRealism;