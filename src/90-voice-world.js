// Flow
let me = null;
let others = [];
let hidden = false;



// Auto join as Αξάς (no floating windows - everything on the globe)
me = {
  id: 'u' + Date.now(),
  name: 'Αξάς'
};

try { Voice.init(); initVoice(); } catch(e){ console.warn('Voice init skipped:', e.message); }

// Silent init (no panels, all on the globe) - user can play freely first
function initUser() {
  showOtherUsers();

  // Default position on globe (Greece area) - no geo yet
  placeMe(36.22, 28.12);
  userLocated = false;

  // optional camera/storage only if ever needed later
  // navigator.mediaDevices?.getUserMedia({video: true}).catch(() => {});
  // navigator.storage?.persist?.();
}

try { initUser(); } catch(e){ console.warn('User init skipped:', e.message); }

// Let user explore the globe freely first
console.log('%c[Astranov] Globe UI: drag rotate · wheel/pinch zoom · tap/double-tap fly. 💻 CLI for tasks. 🎤 mic optional.', 'color:#00ddff');

// Voice system - ask with voice, stop to listen, provoke answer. No delirium.
function initVoice() {
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.lang = Voice.preferredListenLang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = handleVoiceCommand;
    recognition.onerror = (e) => { isListening = false; console.log('Voice error', e); };
    recognition.onend = () => { isListening = false; };
  } else {
    console.log('Voice not supported, using console fallback.');
  }
}

function startListeningForOptions() {
  if (!recognition || isListening) return;
  isListening = true;
  try {
    recognition.start();
  } catch(e) { isListening = false; }
}

function handleVoiceCommand(event) {
  isListening = false;
  const transcript = (event.results[0][0].transcript || '').trim();
  if (!transcript) return;
  console.log('User said:', transcript);
  voiceSessionActive = true;
  voiceEnabled = true;
  ACIControl.handle(transcript, { fromVoice: true });
}

function resumeListening() {
  if (!voiceSessionActive || !voiceEnabled || isListening || Voice.speaking) return;
  setTimeout(() => {
    if (!voiceSessionActive || Voice.speaking) return;
    startListeningForOptions();
  }, 700);
}
window.resumeListening = resumeListening;

function startVoiceOptions() {
  Voice.flush();
  voiceSessionActive = true;
  voiceEnabled = true;
  ACIControl.reply('Mic on — say order, explore, drive, stop');
  speak('Listening.', () => startListeningForOptions(), true);
}

function requestLocationIfNeeded(onLocated) {
  if (userLocated || !navigator.geolocation) {
    if (onLocated) onLocated();
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    placeMe(pos.coords.latitude, pos.coords.longitude);
    window._lastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    userLocated = true;
    MapDepict.action('location', { lat: pos.coords.latitude, lng: pos.coords.longitude, detail: 'GPS' });
    if (onLocated) onLocated();
  }, () => {
    if (onLocated) onLocated();
  });
}



function placeMe(lat, lng) {
  window._lastPos = { lat, lng };
  if (window._meMarker && window._meMarker.parent) window._meMarker.parent.remove(window._meMarker);
  const pos = latLngToPos(lat, lng, 1.03);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.028,8,8), new THREE.MeshBasicMaterial({color:0x00ffcc}));
  m.position.set(pos.x,pos.y,pos.z);
  m.userData = {type:'me', name: me ? me.name : 'You'};
  globePivot.add(m);
  window._meMarker = m;
  userLocated = true;
  MapDepict.action('location', { lat, lng, detail: me ? me.name : 'You' });
  if (typeof flyToPoint === 'function') {
    flyToPoint(new THREE.Vector3(pos.x, pos.y, pos.z), 1.38);
  } else {
    camera.position.set(pos.x*0.6, pos.y*0.6 + 0.4, 1.6);
    camera.lookAt(pos.x*0.2, pos.y*0.2, 0);
  }
  FieldBrain?.pulse('location', 'locate me', { role: 'client' });
}

function locateMe() {
  if (!navigator.geolocation) {
    ACIControl?.reply('Geolocation not supported in this browser');
    return;
  }
  ACIControl?.reply('Locating you…');
  AciCli?.print('locating…', 'dim');
  navigator.geolocation.getCurrentPosition(
    pos => {
      placeMe(pos.coords.latitude, pos.coords.longitude);
      const msg = 'You · ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
      ACIControl?.reply(msg);
      AciCli?.print('located · ' + msg, 'ok');
    },
    err => {
      const msg = 'Location denied or unavailable — enable GPS for locate me';
      ACIControl?.reply(msg);
      AciCli?.print(msg, 'err');
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
}
window.locateMe = locateMe;

function showOtherUsers() {
  others = [
    {id:'o1', name:'Αξαδίνα', lat:36.21, lng:28.11, hidden:false, emoji:'🛸'},
    {id:'o3', name:'Αξάς', lat:36.25, lng:28.15, hidden:false, emoji:'🛸'},
    {id:'o2', name:'Σταύρος', lat:36.18, lng:28.09, hidden:false, emoji:'🍻'},
  ];
  others.forEach(u => {
    const pos = latLngToPos(u.lat, u.lng, 1.025);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.015,5,5), new THREE.MeshBasicMaterial({color: u.hidden ? 0x555 : 0xffaa33}));
    m.position.set(pos.x, pos.y, pos.z);
    m.userData = u;
    globePivot.add(m);
  });
}

function toggleKryfto() {
  if (!window._meMarker) return;
  hidden = !hidden;
  window._meMarker.visible = !hidden;
  console.log(hidden ? 'You are now hidden for kryfto!' : 'You are visible again');
}

function groupOrder() {
  ACI.feed('group-order', 'pitogyra-beers-cigarettes-drone');
  console.log('%c[Order] Ζητάω pitogyra + μπίρες + τσιγάρα με drone...', 'color:#ffaa33');
  
  // Εμφάνισε τον Πιλότο ΤΗΛΕΜΑΧΟΣ να κάνει την δουλειά
  showPilotTelemachos();
  
  // Focus view on the pilot/delivery area so user sees it clearly
  globePivot.rotation.y = -28.1 * Math.PI / 180 + Math.PI / 2;
  globePivot.rotation.x = -0.01;
  camera.position.z = 1.6;
  camera.lookAt(0, 0, 0);
  
  // STRONG ROUTING FALLBACK PROVIDER CYCLING for safety
  const vendorLat = 36.8, vendorLng = 27.5;
  const deliveryLat = 36.2, deliveryLng = 28.1;
  const userPos3D = others.map(o => latLngToPos(o.lat, o.lng, 1.025));
  if (window._meMarker) userPos3D.push(window._meMarker.position);
  const routeData = RoutingEngine.computeRoute(vendorLat, vendorLng, deliveryLat, deliveryLng, userPos3D);
  console.log('%c[Safe Routing] Provider: ' + routeData.provider + ' | Safety: ' + routeData.safetyScore + ' | ETA: ' + routeData.etaSim + ' (users & drivers protected)', 'color:#44ff88');

  // Visualize safe route on the globe (temporary)
  const routeGeo = new THREE.BufferGeometry().setFromPoints(routeData.points);
  let routeLine = new THREE.Line(routeGeo, new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.35 }));
  globePivot.add(routeLine);

  // Drone delivery animation using the routed path
  const droneGroup = new THREE.Group();

  // Main body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6),
    new THREE.MeshBasicMaterial({ color: 0x44ccff })
  );
  body.rotation.x = Math.PI / 2;
  droneGroup.add(body);

  // Top sensor / rotor hub
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  hub.position.y = 0.01;
  droneGroup.add(hub);

  // Small wings / arms
  const arm1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.003, 0.003),
    new THREE.MeshBasicMaterial({ color: 0x0088ff })
  );
  droneGroup.add(arm1);
  const arm2 = arm1.clone();
  arm2.rotation.z = Math.PI / 2;
  droneGroup.add(arm2);

  droneGroup.position.copy(routeData.points[0]);
  globePivot.add(droneGroup);

  // Spawn initial AI graphics particle burst
  AIGraphics.spawnEffect(droneGroup.position, 0x44ccff, 22, 40);
  
  let steps = 0;
  let routeIdx = 0;
  if (window._droneAnim) clearInterval(window._droneAnim);
  window._droneAnim = setInterval(() => {
    steps++;
    
    // Follow the safe routed path
    if (routeIdx < routeData.points.length - 1) {
      const target = routeData.points[routeIdx + 1];
      droneGroup.position.lerp(target, 0.12);
      if (droneGroup.position.distanceTo(target) < 0.008) {
        routeIdx++;
      }
    }
    
    // Make pilot follow the drone a bit (stays near delivery)
    if (window._pilot) {
      const final = routeData.points[routeData.points.length - 1];
      window._pilot.position.lerp(final, 0.2);
    }

    // Advanced particle trail from AI Graphics Engine (every few steps)
    if (steps % 4 === 0) {
      AIGraphics.spawnEffect(droneGroup.position, 0x44ccff, 8, 22);
    }

    // Real-time safety check vs users/drivers
    userPos3D.forEach(up => {
      if (droneGroup.position.distanceTo(up) < 0.09) {
        console.log('%c[RoutingEngine] ⚠️ Πολύ κοντά σε user/driver! Προστασία ενεργή.', 'color:#ff8800');
      }
    });
    
    if (steps > 45 || routeIdx >= routeData.points.length - 1) {
      clearInterval(window._droneAnim);
      window._droneAnim = null;
      if (droneGroup.parent) droneGroup.parent.remove(droneGroup);
      if (routeLine && routeLine.parent) routeLine.parent.remove(routeLine);
      if (window._pilot && window._pilot.parent) {
        setTimeout(() => {
          if (window._pilot && window._pilot.parent) window._pilot.parent.remove(window._pilot);
        }, 3000);
      }
      console.log('%c[Drone Arrival - Πιλότος ΤΗΛΕΜΑΧΟΣ] Pitogyra, μπίρες & τσιγάρα παραδόθηκαν! Καλή απόλαυση αξά <3 (safe routing used)', 'color:#44ff88');
    }
  }, 70);
}

function showPilotTelemachos() {
  // Εμφάνισε τον Πιλότο ΤΗΛΕΜΑΧΟΣ (drone pilot) - πιο έντονα, σαν μικρό πλοιάριο
  if (window._pilot && window._pilot.parent) window._pilot.parent.remove(window._pilot);
  
  const pos = latLngToPos(36.2, 28.1, 1.04);
  
  // Pilot group for better visual - bigger ship-like
  const pilotGroup = new THREE.Group();
  
  // Body (bigger orb)
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.95 })
  );
  pilotGroup.add(body);
  
  // Cockpit / nose (larger)
  const cockpit = new THREE.Mesh(
    new THREE.ConeGeometry(0.014, 0.032, 4),
    new THREE.MeshBasicMaterial({ color: 0x00ff99 })
  );
  cockpit.rotation.x = Math.PI / 2;
  cockpit.position.z = 0.02;
  pilotGroup.add(cockpit);
  
  // Add small "wing" or stabilizer for ship look
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.005, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x0088ff })
  );
  wing.position.z = 0.005;
  pilotGroup.add(wing);

  // Extra AI core glow ring (advanced gaming detail, no model)
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  pilotGroup.add(core);

  // Thrusters - gaming ship style (back engines)
  const thruster1 = new THREE.Mesh(
    new THREE.ConeGeometry(0.006, 0.018, 4),
    new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 })
  );
  thruster1.rotation.x = Math.PI / 2;
  thruster1.position.set(0.015, 0, -0.02);
  pilotGroup.add(thruster1);

  const thruster2 = thruster1.clone();
  thruster2.position.set(-0.015, 0, -0.02);
  pilotGroup.add(thruster2);

  // Store thrusters for animation
  pilotGroup.userData.thrusters = [thruster1, thruster2];
  
  pilotGroup.position.set(pos.x, pos.y, pos.z);
  pilotGroup.userData = { type: 'pilot', name: 'ΤΗΛΕΜΑΧΟΣ' };
  globePivot.add(pilotGroup);
  window._pilot = pilotGroup;

  // Advanced AI Graphics: spawn particle aura around pilot (gaming effect)
  AIGraphics.spawnEffect(pilotGroup.position, 0x00ff99, 18, 55);
  
  console.log('%c[Πιλότος ΤΗΛΕΜΑΧΟΣ] Αναλαμβάνω την παράδοση με drone! Pitogyra + μπίρες + τσιγάρα on the way. Aksako <3', 'color:#00ddff');
}
