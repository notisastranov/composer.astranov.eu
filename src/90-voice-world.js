// Flow
let me = null;
let others = [];
let hidden = false;



// Identity unified via AstranovSession (same user across devices when signed in)
me = null;
window.me = me;

try { Voice.init(); initVoice(); } catch(e){ console.warn('Voice init skipped:', e.message); }

// Silent init (no panels, all on the globe) - user can play freely first
function initUser() {
  AstranovSession?._applyIdentity?.();
  if (!me) {
    me = { id: 'guest-pending', name: 'Guest', isGuest: true };
    window.me = me;
  }
  setTimeout(() => showOtherUsers(), 1500);

  // Default position on globe (Greece area) - no geo yet
  placeMe(36.22, 28.12, { quiet: true, markerOnly: true });
  userLocated = false;

  // optional camera/storage only if ever needed later
  // navigator.mediaDevices?.getUserMedia({video: true}).catch(() => {});
  // navigator.storage?.persist?.();
}

try { initUser(); } catch(e){ console.warn('User init skipped:', e.message); }

// Let user explore the globe freely first
console.log('%c[Astranov] Globe UI: drag rotate · wheel/pinch zoom · tap/double-tap fly. 💻 CLI for tasks. 🎧 hands-free optional.', 'color:#00ddff');

// Voice → Astranov Command Line (live transcript in input, same path as typing)
let _voiceBusy = false;
let _voiceGen = 0;
let _voiceSilenceTimer = null;
let _voiceCommitting = false;
let _lastVoiceCommit = '';
let _lastVoiceCommitT = 0;
let _voiceDraft = '';
window._handsFreeVoice = false;

const VOICE_SILENCE_MS = 900;
let _voiceLangLocked = false;
let _recognitionPaused = false;
let _listenRestartAt = 0;
let _voiceResumeTimer = null;
let _listenFailStreak = 0;
const VOICE_RESTART_GAP_MS = 1800;
const VOICE_RESTART_GAP_MAX_MS = 5200;
const EXECUTE_SUFFIX = /\s*(?:go(?:\s+(?:ahead|do(?:\s+it)?|now))?|do\s+it|execute(?:\s+it)?|run\s+it|send\s+it|now|πήγαινε|κάντο|καντο|εκτέλεσε|ξεκίνα|τρέξε)\s*$/i;
const EXECUTE_PREFIX = /^(?:go(?:\s+(?:ahead|do|and))?|please\s+)?\s*/i;
const CODERS_CANON = 'coders';

function voiceEditDist(a, b) {
  a = String(a || '').toLowerCase();
  b = String(b || '').toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function cleanVoiceToken(tok) {
  return String(tok || '').toLowerCase().replace(/[''´`]/g, '').replace(/[^\w\u0370-\u03FF]/g, '');
}

const CODERS_MISHEAR_EXACT = new Set([
  'coders', 'coder', 'corders', 'corder', 'codas', 'coda', 'cooters', 'coaters',
  'colders', 'colder', 'koders', 'koder', 'goders', 'gorder', 'couders', 'coderrs',
  'codehers', 'codeus', 'quarters', 'quarter', 'κοντερ', 'κοντερς', 'κόντερ', 'κόντερς',
  'κοντερσ', 'κοντρς', 'κοντρ', 'κοντερσ',
]);

function tokenSoundsLikeCoders(tok) {
  const w = cleanVoiceToken(tok);
  if (!w) return false;
  if (CODERS_MISHEAR_EXACT.has(w)) return true;
  if (w === 'coders' || w.startsWith('coder')) return true;
  if (/^c[o0q][od][aeiou]*r/.test(w) && w.length <= 10) return true;
  if (/^κ[oό]?ντ[εη]?ρ/.test(w)) return true;
  if (w.length >= 4 && w.length <= 10 && voiceEditDist(w, 'coders') <= 2) return true;
  if (w.length >= 4 && w.length <= 8 && voiceEditDist(w, 'coder') <= 1) return true;
  return false;
}

function phraseIsCodersMishear(text) {
  const core = String(text || '').trim().toLowerCase().replace(EXECUTE_SUFFIX, '').trim();
  if (!core) return false;
  if (tokenSoundsLikeCoders(core)) return true;
  if (/^code\s+her?s$/i.test(core)) return true;
  if (/^code\s+us$/i.test(core)) return true;
  if (/^call\s+her?s$/i.test(core)) return true;
  if (/^go\s+ders?$/i.test(core)) return true;
  return false;
}

/** Suspect "coders" before other garbage — runs on every voice transcript */
function fixVoiceHotwords(text) {
  let s = String(text || '').trim();
  if (!s) return s;

  const suffix = EXECUTE_SUFFIX.test(s) ? (s.match(EXECUTE_SUFFIX)?.[0] || '') : '';
  let core = suffix ? s.replace(EXECUTE_SUFFIX, '').trim() : s;

  const summon = core.match(/^(summon)\s+(\S+)(?:\s+(.*))?$/i);
  if (summon && tokenSoundsLikeCoders(summon[2])) {
    core = 'summon coders' + (summon[3] ? ' ' + summon[3] : '');
    return (core + suffix).trim();
  }

  const codeHer = core.match(/^code\s+(her|hers|us|errors?)\s+(.*)$/i);
  if (codeHer) return (CODERS_CANON + ' ' + codeHer[2] + suffix).trim();

  const parts = core.split(/\s+/);
  const first = parts[0] || '';

  if (tokenSoundsLikeCoders(first)) {
    const rest = parts.slice(1).join(' ');
    if (!rest || phraseIsCodersMishear(core)) return (CODERS_CANON + (rest ? ' ' + rest : '') + suffix).trim();
    return (CODERS_CANON + (rest ? ' ' + rest : '') + suffix).trim();
  }

  if (parts.length <= 3 && phraseIsCodersMishear(core)) return (CODERS_CANON + suffix).trim();

  if (parts.length >= 2 && parts.length <= 6 && tokenSoundsLikeCoders(parts[parts.length - 1])) {
    parts[parts.length - 1] = CODERS_CANON;
    return (parts.join(' ') + suffix).trim();
  }

  if (window.ArcangeloDialect) s = ArcangeloDialect.normalizeForRouting(s) || s;
  return s;
}
window.fixVoiceHotwords = fixVoiceHotwords;

function codersTranscriptScore(text) {
  const fixed = fixVoiceHotwords(String(text || '').trim());
  if (/^coders\b/i.test(fixed)) return 100;
  const first = cleanVoiceToken(String(text || '').split(/\s+/)[0]);
  if (tokenSoundsLikeCoders(first)) return 80 - voiceEditDist(first, 'coders');
  return 0;
}

function pickVoiceTranscript(result) {
  let best = result[0]?.transcript || '';
  let bestScore = codersTranscriptScore(best);
  for (let j = 1; j < result.length; j++) {
    const alt = result[j]?.transcript || '';
    const score = codersTranscriptScore(alt);
    if (score > bestScore) { bestScore = score; best = alt; }
  }
  const repaired = ArcangeloDialect?.repairTranscript?.(best) || best;
  ArcangeloDialect?.ingest?.(repaired);
  return fixVoiceHotwords(repaired);
}

function defaultListenLang() {
  const nav = (navigator.language || 'en-US').toLowerCase();
  if (nav.startsWith('el')) return 'el-GR';
  if (nav.startsWith('en')) return 'en-US';
  return 'el-GR';
}

function normalizeVoiceCommand(text) {
  let s = fixVoiceHotwords(String(text || '').trim());
  if (!s) return '';
  if (window.ArcangeloDialect) s = ArcangeloDialect.normalizeForRouting(s) || s;
  if (EXECUTE_SUFFIX.test(s)) s = s.replace(EXECUTE_SUFFIX, '').trim();
  if (/^(go|do|run|execute)\s+\S/i.test(s)) s = s.replace(EXECUTE_PREFIX, '').trim();
  return s;
}

function voiceListenBlocked() {
  return _recognitionPaused || Voice?.speaking || _voiceBusy || _voiceCommitting;
}

function setVoicePerfMode(on) {
  window._voicePerfMode = !!on;
  if (window.AIGraphics?.setVoicePerfMode) AIGraphics.setVoicePerfMode(!!on);
}
window.setVoicePerfMode = setVoicePerfMode;

function wantsExecuteNow(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return EXECUTE_SUFFIX.test(s) || /^(go|do|run|execute)\s+\S/i.test(s);
}

function syncListenLang(draft) {
  if (!recognition || !draft) return;
  if (window._handsFreeVoice && _voiceLangLocked) return;
  const lang = ArcangeloDialect?.listenLang?.(draft) || Voice?.detectLang?.(draft) || 'el-GR';
  if (lang === recognition.lang) {
    if (window._handsFreeVoice) _voiceLangLocked = true;
    return;
  }
  if (window._handsFreeVoice) return;
  recognition.lang = lang;
  Voice.preferredListenLang = lang;
}

function pauseVoiceRecognition() {
  if (!recognition) return;
  _recognitionPaused = true;
  if (!isListening) return;
  isListening = false;
  try { recognition.stop(); } catch (_) {}
}
window.pauseVoiceRecognition = pauseVoiceRecognition;

function resumeVoiceRecognition() {
  if (!_recognitionPaused) return;
  _recognitionPaused = false;
  if (window._handsFreeVoice || voiceSessionActive) scheduleVoiceResume();
}
window.resumeVoiceRecognition = resumeVoiceRecognition;

function voiceInterrupt(opts) {
  opts = opts || {};
  _voiceGen++;
  _voiceBusy = false;
  _voiceCommitting = false;
  if (_voiceResumeTimer) { clearTimeout(_voiceResumeTimer); _voiceResumeTimer = null; }
  if (_voiceSilenceTimer) { clearTimeout(_voiceSilenceTimer); _voiceSilenceTimer = null; }
  Voice?.flush?.();
  GlobeDeck?.setThinking?.(false);
  if (window._aciAbort) { try { window._aciAbort.abort(); } catch (_) {} window._aciAbort = null; }
  if (!opts.keepHandsFree) return;
  if (window._handsFreeVoice && !isListening) setTimeout(() => startListeningForOptions(), 80);
}
window.voiceInterrupt = voiceInterrupt;

function syncHandsFreeBtn() {
  const btn = document.getElementById('aci-handsfree');
  if (!btn) return;
  const on = voiceSessionActive || window._handsFreeVoice;
  btn.classList.toggle('deck-btn-active', on);
  btn.classList.toggle('listening', isListening);
  btn.classList.toggle('speaking', !!Voice?.speaking);
}
window.syncHandsFreeBtn = syncHandsFreeBtn;

function openVoiceCli() {
  const title = window.SuperCli?.title || 'Astranov Command Line';
  GlobeDeck?.expand(title);
  if (window.AciCli) AciCli.open = true;
  SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
  const input = document.getElementById('aci-cli-in');
  if (input) input.classList.add('voice-live');
  syncHandsFreeBtn();
}

function scheduleVoiceResume() {
  if (sessionHeld || SessionHold?.isHeld?.()) return;
  const active = voiceSessionActive || window._handsFreeVoice;
  if (!active || !voiceEnabled || isListening || voiceListenBlocked()) return;
  if (_voiceResumeTimer) return;
  const wait = Math.max(
    _listenRestartAt - Date.now(),
    window._handsFreeVoice ? VOICE_RESTART_GAP_MS : 500
  );
  _voiceResumeTimer = setTimeout(() => {
    _voiceResumeTimer = null;
    if (sessionHeld || SessionHold?.isHeld?.()) return;
    const on = voiceSessionActive || window._handsFreeVoice;
    if (!on || !voiceEnabled || isListening || voiceListenBlocked()) return;
    startListeningForOptions();
  }, wait);
}

function scheduleSilenceSubmit(draft) {
  if (!window._handsFreeVoice || !draft || _voiceCommitting) return;
  if (_voiceSilenceTimer) clearTimeout(_voiceSilenceTimer);
  _voiceSilenceTimer = setTimeout(() => {
    _voiceSilenceTimer = null;
    if (_voiceCommitting || _voiceBusy) return;
    const input = document.getElementById('aci-cli-in');
    const line = normalizeVoiceCommand((input?.value || draft).trim());
    if (line.length >= 3) commitVoiceCommand(line);
  }, VOICE_SILENCE_MS);
}

function commitVoiceCommand(raw) {
  const line = normalizeVoiceCommand(raw);
  const minLen = ArcangeloDialect?.sessionActive?.() ? 2 : 2;
  if (!line || line.length < minLen || _voiceCommitting) return;
  const now = Date.now();
  if (_lastVoiceCommit === line && now - _lastVoiceCommitT < 2200) return;
  _lastVoiceCommit = line;
  _lastVoiceCommitT = now;
  _voiceCommitting = true;
  if (_voiceSilenceTimer) { clearTimeout(_voiceSilenceTimer); _voiceSilenceTimer = null; }
  const input = document.getElementById('aci-cli-in');
  if (input) { input.value = ''; if (AciCli) AciCli.buffer = ''; }
  if (!window._handsFreeVoice) {
    isListening = false;
    try { recognition?.stop(); } catch (_) {}
  }
  console.log('Voice commit:', line);
  submitVoiceToCli(line).finally(() => { _voiceCommitting = false; });
}

function voiceWantsAciControl(line) {
  const low = line.toLowerCase();
  return /pitogyra|πιτογυρ|explore|εξερεύ|πήγαινε|go to|focus/.test(low)
    || GlobeVideo?.wantsYoutube?.(line)
    || /video\s+call|orbital\s+video|κλήση\s+βίντεο/.test(low)
    || /telecom|sat radio|satellite radio|ασύρματος/.test(low)
    || /αγγλικά|english|ελληνικά|greek|athenian|αθηναϊκ|spartan|σπαρτιατ|myrmidon|μυρμιδόν/.test(low)
    || /^(remember|θυμήσου|να θυμάσαι)\b/.test(low)
    || /evolve|neuron|collective|εξέλιξη|brain/.test(low)
    || (/μπίρ|τσιγαρ|beer|cigar|delivery|διανομ|παραγγελ|goals|work|δουλειά/.test(low) && !/^order\b/i.test(line));
}

async function submitVoiceToCli(transcript) {
  const line = normalizeVoiceCommand(transcript);
  if (!line) return;
  const gen = ++_voiceGen;
  _voiceBusy = true;
  openVoiceCli();

  const low = line.toLowerCase();
  if (gen !== _voiceGen) return;

  if (/^(hold|pause session|quiet mode|κράτα|κρατα|σίγαση|σιγαση)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    SessionHold?.hold?.();
    return;
  }
  if (/^(resume|unhold|continue|συνέχισε|συνεχισε|ξανα)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    await SessionHold?.resume?.();
    return;
  }
  if (sessionHeld || SessionHold?.isHeld?.()) {
    if (gen === _voiceGen) _voiceBusy = false;
    AciCli?.print('⏸ session held — say resume or tap ▶', 'dim');
    return;
  }
  if (/^(stop|σταμάτα|σταματα|pause|διακοπή|quiet|σιωπή|mute)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    userIntervene();
    return;
  }
  if (/^(mic|voice|handsfree|hands-free|μίκροφωνο|ακού)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    startVoiceOptions();
    return;
  }
  if (AstranovPresence?.wantsKryftoStart?.(line)) {
    if (gen === _voiceGen) _voiceBusy = false;
    AciCli?.print('🎧 ' + line, 'cmd');
    AstranovPresence?.startKryfto?.();
    if (window._handsFreeVoice && !Voice?.speaking) scheduleVoiceResume();
    return;
  }
  if (/^(dark|bright|light)\s*(theme|mode)?\b/.test(low) || /^theme\s+(dark|bright|light)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    const mode = /bright|light/.test(low) ? 'bright' : 'dark';
    AstranovTheme?.set?.(mode);
    AciCli?.print('theme → ' + mode, 'ok');
    return;
  }

  try {
    AciCli?.print('🎧 ' + line, 'cmd');
    if (gen !== _voiceGen) return;
    if (voiceWantsAciControl(line)) {
      await ACIControl.handle(line, { fromVoice: true });
    } else if (window.AciCli) {
      await AciCli.run(line, { fromVoice: true });
    } else {
      await ACIControl.handle(line, { fromVoice: true });
    }
  } catch (e) {
    if (gen === _voiceGen) AciCli?.print('voice error: ' + (e.message || e), 'err');
  } finally {
    if (gen === _voiceGen) {
      _voiceBusy = false;
      const input = document.getElementById('aci-cli-in');
      if (input) input.classList.remove('voice-live');
      syncHandsFreeBtn();
      if (window._handsFreeVoice && !Voice?.speaking) scheduleVoiceResume();
    }
  }
}
window.submitVoiceToCli = submitVoiceToCli;
window.scheduleVoiceResume = scheduleVoiceResume;

function initVoice() {
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    Voice.preferredListenLang = Voice.preferredListenLang || defaultListenLang();
    recognition.lang = Voice.preferredListenLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.onresult = handleVoiceCommand;
    recognition.onerror = (e) => {
      isListening = false;
      if (e.error === 'aborted' || _recognitionPaused) return;
      if (e.error === 'no-speech') {
        _listenFailStreak = Math.min(_listenFailStreak + 1, 6);
        if (voiceSessionActive || window._handsFreeVoice) {
          const gap = Math.min(
            VOICE_RESTART_GAP_MS + _listenFailStreak * 400,
            VOICE_RESTART_GAP_MAX_MS
          );
          _listenRestartAt = Date.now() + gap;
          scheduleVoiceResume();
        }
        return;
      }
      console.log('Voice error', e.error || e);
      _listenFailStreak = Math.min(_listenFailStreak + 1, 6);
      if ((voiceSessionActive || window._handsFreeVoice) && !voiceListenBlocked()) {
        const gap = Math.min(
          VOICE_RESTART_GAP_MS + _listenFailStreak * 500,
          VOICE_RESTART_GAP_MAX_MS
        );
        _listenRestartAt = Date.now() + gap;
        scheduleVoiceResume();
      }
    };
    recognition.onend = () => {
      isListening = false;
      if (_recognitionPaused || Voice?.speaking || voiceListenBlocked()) return;
      if ((voiceSessionActive || window._handsFreeVoice) && voiceEnabled) {
        const gap = _listenFailStreak > 0
          ? Math.min(VOICE_RESTART_GAP_MS + _listenFailStreak * 350, VOICE_RESTART_GAP_MAX_MS)
          : VOICE_RESTART_GAP_MS;
        _listenRestartAt = Date.now() + gap;
        scheduleVoiceResume();
      }
    };
  } else {
    console.log('Voice not supported, using console fallback.');
  }
}

function startListeningForOptions() {
  if (sessionHeld || SessionHold?.isHeld?.()) return;
  if (!recognition || isListening || voiceListenBlocked()) return;
  const wait = _listenRestartAt - Date.now();
  if (wait > 0) {
    if (!_voiceResumeTimer) {
      _voiceResumeTimer = setTimeout(() => {
        _voiceResumeTimer = null;
        startListeningForOptions();
      }, wait);
    }
    return;
  }
  openVoiceCli();
  isListening = true;
  syncHandsFreeBtn();
  try {
    recognition.start();
    _listenFailStreak = 0;
    _listenRestartAt = Date.now() + VOICE_RESTART_GAP_MS;
  } catch (e) {
    isListening = false;
    _listenFailStreak = Math.min(_listenFailStreak + 1, 6);
    if (e?.name === 'InvalidStateError') {
      _listenRestartAt = Date.now() + Math.min(
        VOICE_RESTART_GAP_MS * 2 + _listenFailStreak * 600,
        VOICE_RESTART_GAP_MAX_MS
      );
      if (voiceSessionActive || window._handsFreeVoice) scheduleVoiceResume();
    }
  }
}

function handleVoiceCommand(event) {
  const input = document.getElementById('aci-cli-in');
  let interim = '';
  let final = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const t = pickVoiceTranscript(event.results[i]);
    if (event.results[i].isFinal) final += t;
    else interim += t;
  }

  const draft = (final || interim).trim();
  if (!draft) return;

  if (_voiceBusy || _voiceCommitting) {
    if (input) {
      input.value = draft;
      input.classList.add('voice-live');
      if (AciCli) AciCli.buffer = draft;
    }
    _voiceDraft = draft;
    return;
  }
  if (Voice?.speaking && window._handsFreeVoice && draft.length > (_voiceDraft?.length || 0) + 8) {
    voiceInterrupt({ keepHandsFree: true });
  }
  _voiceDraft = draft;

  voiceSessionActive = true;
  voiceEnabled = true;
  syncListenLang(draft);
  openVoiceCli();
  if (input) {
    input.value = draft;
    input.classList.add('voice-live');
    if (AciCli) AciCli.buffer = draft;
    input.scrollLeft = input.scrollWidth;
  }
  GlobeDeck?.setPreview('🎧 ' + draft.slice(0, 96));
  syncHandsFreeBtn();

  const live = (final || interim).trim();
  if (final.trim()) {
    commitVoiceCommand(final.trim());
    return;
  }
  if (wantsExecuteNow(live)) {
    const cmd = normalizeVoiceCommand(live);
    if (cmd.length >= 2) commitVoiceCommand(cmd);
    return;
  }
  scheduleSilenceSubmit(live);
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
  if (window._handsFreeVoice && isListening) {
    userIntervene();
    return;
  }
  Voice.flush();
  _voiceLangLocked = false;
  _recognitionPaused = false;
  voiceSessionActive = true;
  voiceEnabled = true;
  window._handsFreeVoice = true;
  setVoicePerfMode(true);
  AciCoders?.enterSession?.({ focus: false, ping: false });
  openVoiceCli();
  _voiceDraft = '';
  _lastVoiceCommit = '';
  _listenFailStreak = 0;
  _listenRestartAt = 0;
  if (_voiceResumeTimer) { clearTimeout(_voiceResumeTimer); _voiceResumeTimer = null; }
  const lang = 'el-GR';
  Voice.preferredListenLang = lang;
  if (recognition) {
    recognition.lang = lang;
    _voiceLangLocked = true;
  }
  AciCli?.print('🎧 hands-free on — speak, pause, I reply', 'dim');
  const input = document.getElementById('aci-cli-in');
  if (input) input.placeholder = '🎧 speak — auto-runs when you pause';
  AstranovSession?.push?.();
  syncHandsFreeBtn();
  speak('Ακούω. Μίλα.', () => scheduleVoiceResume(), true);
}

function stopHandsFree() {
  window._handsFreeVoice = false;
  voiceSessionActive = false;
  _voiceLangLocked = false;
  _recognitionPaused = false;
  _listenFailStreak = 0;
  _voiceDraft = '';
  setVoicePerfMode(false);
  if (_voiceResumeTimer) { clearTimeout(_voiceResumeTimer); _voiceResumeTimer = null; }
  if (_voiceSilenceTimer) { clearTimeout(_voiceSilenceTimer); _voiceSilenceTimer = null; }
  AstranovSession?.push?.();
}
window.stopHandsFree = stopHandsFree;

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
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.028,8,8), new THREE.MeshBasicMaterial({color:0x3d9eff}));
  m.position.set(pos.x,pos.y,pos.z);
  m.userData = {type:'me', name: me ? me.name : 'You'};
  globePivot.add(m);
  window._meMarker = m;
  userLocated = true;
  GlobeEntity?.syncMe?.(lat, lng, me ? me.name : 'You');
  if (quiet) {
    MapDepict.pulse(lat, lng, 0x3d9eff, 'You', 6000);
    GlobeDeck?.setMapStatus('📍 ' + lat.toFixed(2) + ', ' + lng.toFixed(2));
  } else {
    MapDepict.action('location', { lat, lng, detail: me ? me.name : 'You' });
  }
  if (shouldFly && typeof flyToPoint === 'function') {
    const gz = GlobeControl?.Z?.global || 2.55;
    const nz = GlobeControl?.Z?.national || 1.82;
    const cz = CityLife?.CITY_ZOOM || GlobeControl?.Z?.city || 1.38;
    const z = opts.zoom ?? (opts.cityDrop ? cz : gz);
    flyToPoint(new THREE.Vector3(pos.x, pos.y, pos.z), z);
    cityLevel = !!opts.cityDrop && z <= (GlobeControl?.Z?.regional || 1.65);
    GlobeControl?.noteAutoFly?.();
    CosmicZoom?.update?.(z);
    if (opts.cityDrop && !window._globeFly) CityMap?.onCamera?.(z, 'earth');
  }
  if (!quiet) FieldBrain?.pulse('location', 'locate me', { role: 'client' });
  AstranovPresence?.onMove?.(lat, lng);
}

function locateMe() {
  if (!navigator.geolocation) {
    ACIControl?.reply('Geolocation not supported');
    return;
  }
  GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
  GlobeDeck?.setMapStatus('Locating…');
  GlobeControl?.userTookGlobe?.('silent');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      placeMe(lat, lng, { quiet: false, fly: true, zoom: GlobeControl?.Z?.global || 2.55 });
      ACIControl?.reply('On globe · ' + lat.toFixed(2) + ', ' + lng.toFixed(2) + ' — zoom in or say city view for shops');
      GlobeDeck?.setMapStatus('🌍 Global · ' + lat.toFixed(2) + ', ' + lng.toFixed(2));
    },
    () => {
      ACIControl?.reply('Location denied — enable GPS in browser');
      AciCli?.print('GPS denied — allow location for city view', 'err');
    },
    { enableHighAccuracy: true, timeout: 14000, maximumAge: 30000 }
  );
}
window.locateMe = locateMe;

function showOtherUsers() {
  AstranovPresence?.refresh?.();
}

function toggleKryfto() {
  return AstranovPresence?.toggleHide?.();
}

function groupOrder() {
  console.log('%c[Order] Ζητάω pitogyra + μπίρες + τσιγάρα με drone...', 'color:#ffaa33');
  TelemachosPilot?.runDemoDelivery?.();
}

function showPilotTelemachos() {
  return TelemachosPilot?.showPilot?.();
}
