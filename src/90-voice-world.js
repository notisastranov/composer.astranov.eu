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
console.log('%c[Astranov] Drag/zoom/click freely. Click marker for voice options incl. orbital video call or "request orbital tech". Location only when needed. Real WebRTC + orbital request for reduced wireless impact.', 'color:#00ddff');

// Globe-first instructions (no Windows-like panels)
console.log('%c[Astranov] Drag για περιστροφή, wheel zoom. Κλικ marker για voice: orbital video call ή request orbital tech. Location μόνο όταν χρειάζεται. No sim - real WebRTC, request sent to providers.', 'color:#00ddff');

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
  const transcript = (event.results[0][0].transcript || '').toLowerCase();
  console.log('User said:', transcript);

  if (transcript.includes('stop') || transcript.includes('σταμάτα') || transcript.includes('σταματα') || transcript.includes('διακοπή')) {
    userIntervene();
    return;
  } else if (transcript.includes('english') || transcript.includes('αγγλικά')) {
    Voice.preferredListenLang = 'en-US';
    if (recognition) recognition.lang = 'en-US';
    MapDepict.action('mode', { detail: 'English listen' });
    speak('English mode on. Greek mode: πες ελληνικά.', () => provokeAnswer());
  } else if (transcript.includes('ελληνικά') || transcript.includes('greek')) {
    Voice.preferredListenLang = 'el-GR';
    if (recognition) recognition.lang = 'el-GR';
    MapDepict.action('mode', { detail: 'Greek listen' });
    speak('Ελληνικά mode. Greklish works too — μίλα όπως θες.', () => provokeAnswer());
  } else if (transcript.includes('cli') || transcript.includes('terminal') || transcript.includes('κονσόλα')) {
    AciCli.toggle();
  } else if (transcript.includes('logout') || transcript.includes('αποσύνδεση') || transcript.includes('sign out')) {
    Auth.signOut();
  } else if (transcript.includes('login') || transcript.includes('σύνδεση') || transcript.includes('google')) {
    Auth.signInGoogle();
  } else if (transcript.includes('telecom') || transcript.includes('satellite') || transcript.includes('sat radio')) {
    Comms.startTelecomms();
  } else if (transcript.includes('work') || transcript.includes('δουλειά') || transcript.includes('pitogyra') || transcript.includes('πιτογυρ') || transcript.includes('μπίρ') || transcript.includes('τσιγαρ')) {
    Commerce.orderPitogyra();
  } else if (transcript.includes('explore') || transcript.includes('εξερεύνηση')) {
    requestLocationIfNeeded(() => {
      const randomLat = 35 + Math.random() * 10;
      const randomLng = 25 + Math.random() * 10;
      MapDepict.action('explore', { lat: randomLat, lng: randomLng, detail: 'explore' });
      const p = latLngToPos(randomLat, randomLng);
      focusOnGlobePoint(new THREE.Vector3(p.x, p.y, p.z));
      speak('Εξερευνάμε εδώ στον χάρτη.', () => provokeAnswer());
    });
  } else if (transcript.includes('video') || transcript.includes('call') || transcript.includes('βίντεο') || transcript.includes('κλήση') || transcript.includes('orbital')) {
    requestLocationIfNeeded(() => {
      const target = 'Αξαδίνα';
      MapDepict.action('video', { detail: target });
      startOrbitalVideoCall(target);
      speak('Ξεκινάω orbital video call.', () => provokeAnswer());
    });
  } else if (transcript.includes('mute') || transcript.includes('σιωπή') || transcript.includes('mute all')) {
    voiceEnabled = false;
    speak('Σίγαση.', () => {});
  } else if (transcript.includes('sleep') || transcript.includes('ύπνος')) {
    idleRoll = 0.00005;
    voiceEnabled = false;
    speak('Ύπνος.', () => {});
  } else if (transcript.includes('vhf') || transcript.includes('ασυρμ') || transcript.includes('radio')) {
    Comms.startVHF();
  } else if (transcript.includes('phone') || transcript.includes('τηλέφων')) {
    Comms.startPhone();
  } else if (transcript.includes('news') || transcript.includes('νέα') || transcript.includes('ειδήσει')) {
    NewsFeed.flash();
  } else if (transcript.includes('vendor') || transcript.includes('κατάστη')) {
    Commerce.loadVendors().then(() => Commerce.announceVendors());
  } else if (transcript.includes('request') || transcript.includes('technology') || transcript.includes('tech')) {
    requestOrbitalTech();
    speak('Request prepared.', () => provokeAnswer());
  } else if (transcript.includes('athenian') || transcript.includes('αθηναϊκ')) {
    ACI.thinkMode = 'athenian';
    MapDepict.action('mode', { detail: 'athenian' });
    speak('Athenian mode — creativity kai strategy.', () => provokeAnswer());
  } else if (transcript.includes('spartan') || transcript.includes('σπαρτιατ')) {
    ACI.thinkMode = 'spartan';
    MapDepict.action('mode', { detail: 'spartan' });
    speak('Spartan mode — terse kai decisive.', () => provokeAnswer());
  } else if (transcript.includes('myrmidon') || transcript.includes('μυρμιδόν')) {
    ACI.thinkMode = 'myrmidon';
    MapDepict.action('mode', { detail: 'myrmidon' });
    speak('Myrmidon mode — collective force.', () => provokeAnswer());
  } else if (transcript.match(/^(remember|θυμήσου|να θυμάσαι)/)) {
    const content = transcript.replace(/^(remember|θυμήσου|να θυμάσαι)[:,]?\s*/i, '').trim();
    ACI.teach(content || transcript).then(() => {
      speak('Remembered. Neuron strengthened.', () => provokeAnswer());
    });
  } else if (transcript.includes('evolve') || transcript.includes('collective') || transcript.includes('brain') || transcript.includes('neuron') || transcript.includes('self evolve')) {
    ACI.evolve('voice-command').then(() => {
      speak('Collective intelligence evolved. Council judged. Neurons updated.', () => provokeAnswer());
    });
  } else if (transcript.length > 3) {
    ACI.think(transcript).then(text => {
      if (!text) return;
      ACIControl.reply(text);
      speak(text.slice(0, 280), () => provokeAnswer());
    });
  } else {
    speak('Πες κάτι στο Astranov Collective Intelligence, ή: work, explore, evolve, remember, athenian, spartan.', () => startListeningForOptions());
  }
}

function provokeAnswer() {
  if (!voiceEnabled || isListening || window.AciCli?.open) return;
  setTimeout(() => {
    speak('Τι θες να κάνουμε τώρα Αξάς;', () => {
      startListeningForOptions();
    });
  }, 1200);
}

function startVoiceOptions() {
  if (!voiceEnabled) return;
  const txt = cityLevel 
    ? 'City level. Speak to Astranov Collective Intelligence: ask anything, remember, evolve, athenian, spartan, myrmidon, work, explore, video, mute, sleep.'
    : 'Speak to Astranov Collective Intelligence Αξάς. Ask anything, teach me to remember, evolve collective, or choose a mode.';
  speak(txt, () => {
    startListeningForOptions();
  });
}

function requestLocationIfNeeded(onLocated) {
  if (userLocated || !navigator.geolocation) {
    if (onLocated) onLocated();
    return;
  }
  speak('Για καλύτερη εμπειρία, δώσε άδεια τοποθεσίας.', () => {
    navigator.geolocation.getCurrentPosition(pos => {
      placeMe(pos.coords.latitude, pos.coords.longitude);
      window._lastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userLocated = true;
      MapDepict.action('location', { lat: pos.coords.latitude, lng: pos.coords.longitude, detail: 'GPS' });
      speak('Σε εντόπισα στον χάρτη.', () => {
        if (onLocated) onLocated();
      });
    }, () => {
      speak('Χρησιμοποιώ default θέση.', () => {
        if (onLocated) onLocated();
      });
    });
  });
}



function placeMe(lat, lng) {
  window._lastPos = { lat, lng };
  if (window._meMarker && window._meMarker.parent) window._meMarker.parent.remove(window._meMarker);
  const pos = latLngToPos(lat, lng, 1.03);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.02,5,5), new THREE.MeshBasicMaterial({color:0x00ffcc}));
  m.position.set(pos.x,pos.y,pos.z);
  m.userData = {type:'me', name: me ? me.name : 'You'};
  globePivot.add(m);
  window._meMarker = m;
  userLocated = true;
  MapDepict.action('location', { lat, lng, detail: me ? me.name : 'You' });
  // Focus
  camera.position.set(pos.x*0.6, pos.y*0.6 + 0.4, 1.6);
  camera.lookAt(pos.x*0.2, pos.y*0.2, 0);
  console.log('%c[Map] You are here (green dot). Drag to look around.', 'color:#0f0');
}

function showOtherUsers() {
  others = [
    {id:'o1', name:'Αξαδίνα', lat:36.21, lng:28.11, hidden:false, emoji:'🛵'},
    {id:'o3', name:'Αξάς', lat:36.25, lng:28.15, hidden:false, emoji:'🛵'},
    {id:'o2', name:'Σταύρος', lat:36.18, lng:28.09, hidden:false, emoji:'🍺'},
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
