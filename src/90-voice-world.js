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
  placeMe(36.22, 28.12, { quiet: true, markerOnly: true });
  userLocated = false;

  // optional camera/storage only if ever needed later
  // navigator.mediaDevices?.getUserMedia({video: true}).catch(() => {});
  // navigator.storage?.persist?.();
}

try { initUser(); } catch(e){ console.warn('User init skipped:', e.message); }

// Let user explore the globe freely first
console.log('%c[Astranov] Globe UI: drag rotate · wheel/pinch zoom · tap/double-tap fly. 💻 CLI for tasks. 🎤 mic optional.', 'color:#00ddff');

// Voice → Astranov Command Line (live transcript in input, same path as typing)
let _voiceBusy = false;

function openVoiceCli() {
  const title = window.SuperCli?.title || 'Astranov Command Line';
  GlobeDeck?.expand(title);
  if (window.AciCli) AciCli.open = true;
  SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
}

function scheduleVoiceResume() {
  if (sessionHeld || SessionHold?.isHeld?.()) return;
  if (!voiceSessionActive || !voiceEnabled || isListening || Voice.speaking || _voiceBusy) return;
  setTimeout(() => {
    if (!voiceSessionActive || !voiceEnabled || isListening || Voice.speaking || _voiceBusy) return;
    startListeningForOptions();
  }, 700);
}

function voiceWantsAciControl(line) {
  const low = line.toLowerCase();
  return /pitogyra|πιτογυρ|explore|εξερεύ|πήγαινε|go to|focus/.test(low)
    || /video|βίντεο|orbital/.test(low)
    || /telecom|sat radio|satellite radio|ασύρματος/.test(low)
    || /αγγλικά|english|ελληνικά|greek|athenian|αθηναϊκ|spartan|σπαρτιατ|myrmidon|μυρμιδόν/.test(low)
    || /^(remember|θυμήσου|να θυμάσαι)\b/.test(low)
    || /evolve|neuron|collective|εξέλιξη|brain/.test(low)
    || (/μπίρ|τσιγαρ|beer|cigar|delivery|διανομ|παραγγελ|goals|work|δουλειά/.test(low) && !/^order\b/i.test(line));
}

async function submitVoiceToCli(transcript) {
  const line = (transcript || '').trim();
  if (!line || _voiceBusy) return;
  _voiceBusy = true;
  openVoiceCli();
  const input = document.getElementById('aci-cli-in');
  if (input) { input.value = ''; if (AciCli) AciCli.buffer = ''; }

  const low = line.toLowerCase();
  if (/^(hold|pause session|quiet mode|κράτα|κρατα|σίγαση|σιγαση)\b/.test(low)) {
    _voiceBusy = false;
    SessionHold?.hold?.();
    return;
  }
  if (/^(resume|unhold|continue|συνέχισε|συνεχισε|ξανα)\b/.test(low)) {
    _voiceBusy = false;
    await SessionHold?.resume?.();
    return;
  }
  if (sessionHeld || SessionHold?.isHeld?.()) {
    _voiceBusy = false;
    AciCli?.print('⏸ session held — say resume or tap ▶', 'dim');
    return;
  }
  if (/^(stop|σταμάτα|σταματα|pause|διακοπή|quiet|σιωπή|mute)\b/.test(low)) {
    _voiceBusy = false;
    userIntervene();
    return;
  }
  if (/^(mic|voice|μίκροφωνο|ακού)\b/.test(low)) {
    _voiceBusy = false;
    startVoiceOptions();
    return;
  }

  try {
    if (voiceWantsAciControl(line)) {
      AciCli?.print('🎤 ' + line, 'cmd');
      await ACIControl.handle(line, { fromVoice: true });
    } else if (window.AciCli) {
      await AciCli.run(line);
    } else {
      await ACIControl.handle(line, { fromVoice: true });
    }
  } catch (e) {
    AciCli?.print('voice error: ' + (e.message || e), 'err');
  } finally {
    _voiceBusy = false;
    scheduleVoiceResume();
  }
}
window.submitVoiceToCli = submitVoiceToCli;

function initVoice() {
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.lang = Voice.preferredListenLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = handleVoiceCommand;
    recognition.onerror = (e) => {
      isListening = false;
      console.log('Voice error', e);
      if (voiceSessionActive && e.error !== 'aborted') scheduleVoiceResume();
    };
    recognition.onend = () => {
      isListening = false;
      if (voiceSessionActive && voiceEnabled) scheduleVoiceResume();
    };
  } else {
    console.log('Voice not supported, using console fallback.');
  }
}

function startListeningForOptions() {
  if (sessionHeld || SessionHold?.isHeld?.()) return;
  if (!recognition || isListening || _voiceBusy || Voice.speaking) return;
  isListening = true;
  try {
    recognition.start();
  } catch (e) {
    isListening = false;
    if (e?.name === 'InvalidStateError' && voiceSessionActive) scheduleVoiceResume();
  }
}

function handleVoiceCommand(event) {
  const input = document.getElementById('aci-cli-in');
  let interim = '';
  let final = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const t = event.results[i][0].transcript || '';
    if (event.results[i].isFinal) final += t;
    else interim += t;
  }

  const draft = (final || interim).trim();
  if (draft) {
    voiceSessionActive = true;
    voiceEnabled = true;
    openVoiceCli();
    if (input) {
      input.value = draft;
      if (AciCli) AciCli.buffer = draft;
    }
    GlobeDeck?.setPreview('🎤 ' + draft.slice(0, 96));
  }

  if (!final.trim()) return;

  isListening = false;
  try { recognition.stop(); } catch (_) {}
  console.log('User said:', final.trim());
  submitVoiceToCli(final.trim());
}

function resumeListening() {
  scheduleVoiceResume();
}
window.resumeListening = resumeListening;

function startVoiceOptions() {
  if (sessionHeld || SessionHold?.isHeld?.()) {
    SessionHold?.resume?.();
    return;
  }
  Voice.flush();
  voiceSessionActive = true;
  voiceEnabled = true;
  openVoiceCli();
  AciCli?.print('🎤 listening — speak commands (locate, order, batch, help, stop)', 'dim');
  const input = document.getElementById('aci-cli-in');
  if (input) input.placeholder = '🎤 listening…';
  ACIControl.reply('Mic on — voice controls Astranov Command Line');
  speak('Listening.', () => startListeningForOptions(), true);
}

function requestLocationIfNeeded(onLocated) {
  if (userLocated || !navigator.geolocation) {
    if (onLocated) onLocated();
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    placeMe(pos.coords.latitude, pos.coords.longitude, { quiet: true, markerOnly: true });
    window._lastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    userLocated = true;
    if (onLocated) onLocated();
  }, () => {
    if (onLocated) onLocated();
  });
}



function placeMe(lat, lng, opts) {
  opts = opts || {};
  const quiet = !!opts.quiet;
  const markerOnly = !!opts.markerOnly;
  const shouldFly = !!opts.fly || (!markerOnly && GlobeControl?.shouldAutoFly?.());
  window._lastPos = { lat, lng };
  if (window._meMarker && window._meMarker.parent) window._meMarker.parent.remove(window._meMarker);
  const pos = latLngToPos(lat, lng, 1.03);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.028,8,8), new THREE.MeshBasicMaterial({color:0x00ffcc}));
  m.position.set(pos.x,pos.y,pos.z);
  m.userData = {type:'me', name: me ? me.name : 'You'};
  globePivot.add(m);
  window._meMarker = m;
  userLocated = true;
  if (quiet) {
    MapDepict.pulse(lat, lng, 0x00ffcc, 'You', 6000);
    GlobeDeck?.setMapStatus('📍 ' + lat.toFixed(2) + ', ' + lng.toFixed(2));
  } else {
    MapDepict.action('location', { lat, lng, detail: me ? me.name : 'You' });
  }
  if (shouldFly && typeof flyToPoint === 'function') {
    flyToPoint(new THREE.Vector3(pos.x, pos.y, pos.z), opts.zoom || 1.38);
    GlobeControl?.noteAutoFly?.();
  } else if (shouldFly) {
    camera.position.set(pos.x*0.6, pos.y*0.6 + 0.4, 1.6);
    camera.lookAt(pos.x*0.2, pos.y*0.2, 0);
    GlobeControl?.noteAutoFly?.();
  }
  if (!quiet) FieldBrain?.pulse('location', 'locate me', { role: 'client' });
}

function locateMe() {
  if (!navigator.geolocation) {
    ACIControl?.reply('Geolocation not supported');
    return;
  }
  GlobeDeck?.setMapStatus('Locating…');
  GlobeControl?.engageFollow?.('locate');
  navigator.geolocation.getCurrentPosition(
    pos => {
      placeMe(pos.coords.latitude, pos.coords.longitude, { quiet: true, fly: true });
      ACIControl?.reply('Located · ' + pos.coords.latitude.toFixed(2) + ', ' + pos.coords.longitude.toFixed(2));
    },
    () => {
      ACIControl?.reply('Location denied — enable GPS');
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
