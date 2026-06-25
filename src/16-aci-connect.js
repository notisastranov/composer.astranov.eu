// === ACI CONNECT — link architect to collective AI for deployment ===
const AciConnect = {
  connected: false,
  sessionId: null,

  async open() {
    if (!Auth?.user) {
      ACIControl?.reply('Sign in with G — then collective AI opens');
      await Auth.signInGoogle();
      return null;
    }
    if (window.AciCli) AciCli.show();
    await Auth.refreshAuthority();
    return this.connect(true);
  },

  async connect(speakGreeting) {
    if (!Auth?.user) {
      ACIControl?.reply('Login required for collective connection');
      return { error: 'login required' };
    }
    if (AciCli) AciCli.print('linking to Astranov Collective Intelligence…', 'dim');

    const sync = await AciCli.api({ mode: 'owner_sync' });
    if (sync.is_owner) Auth.isOwner = true;

    const conn = await AciCli.api({
      mode: 'connect',
      deploy_context: true,
      architect: Auth.OWNER_EMAIL
    });

    this.connected = !!(conn.ok && conn.connected);
    this.sessionId = conn.session_id || Auth.user.id;
    window._aciConnected = this.connected;

    if (AciCli) {
      if (this.connected) {
        AciCli.print((AstroGlyphs?.ok || '✔️') + ' CONNECTED — collective AI online · session ' + (this.sessionId || '').slice(0, 8), 'ok');
        if (conn.steps) conn.steps.forEach(s => AciCli.print('  · ' + s, 'dim'));
        if (conn.deploy_ready) AciCli.print('  · deploy authority: FULL — type: deploy <task>', 'ok');
      } else {
        AciCli.print((AstroGlyphs?.err || '❌') + ' CONNECT FAILED: ' + (conn.error || JSON.stringify(conn).slice(0, 120)), 'err');
      }
    }

    if (conn.greeting) {
      ACIControl?.reply(conn.greeting);
      if (AciCli) AciCli.print(conn.greeting, 'out');
      if (speakGreeting && Voice.maySpeak() && Voice.shouldSpeak(conn.greeting)) {
        speak(conn.greeting.slice(0, 120), () => resumeListening());
      }
    }

    MapDepict?.action('think', { detail: this.connected ? 'ACI linked' : 'connect failed' });
    return conn;
  },

  async deploy(task) {
    if (!Auth?.isOwner) {
      const msg = 'Owner only — login as notisastranov@gmail.com';
      if (AciCli) AciCli.print(msg, 'err');
      return null;
    }
    if (!this.connected) await this.connect(false);
    if (AciCli) AciCli.print('deploy → collective AI: ' + (task || 'continue batch'), 'dim');
    const r = await AciCli.api({
      mode: 'deploy',
      task: task || 'continue deployment from streets',
      session_id: this.sessionId
    });
    const text = r.plan || r.text || r.response || r.error || '';
    if (AciCli) AciCli.print(text.slice(0, 800), r.ok ? 'out' : 'err');
    ACIControl?.reply(text.slice(0, 220));
    if (Voice.maySpeak() && Voice.shouldSpeak(text)) speak(text.slice(0, 120));
    return r;
  }
};
window.AciConnect = AciConnect;