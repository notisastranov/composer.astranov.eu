// === GOOGLE AUTH (Supabase) ===
// Architect: notisastranov@gmail.com → profiles.is_owner (existing DB column)
const Auth = {
  client: null,
  user: null,
  isOwner: false,
  isArchitect: false,
  OWNER_EMAIL: 'notisastranov@gmail.com',

  init() {
    if (typeof supabase === 'undefined') {
      console.warn('[Auth] Supabase SDK missing — Google login unavailable');
      return;
    }
    this.client = supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    this.client.auth.onAuthStateChange((_ev, session) => {
      this.user = session?.user || null;
      this.applyUser();
      this.refreshAuthority();
    });
    this.client.auth.getSession().then(({ data }) => {
      this.user = data?.session?.user || null;
      this.applyUser();
      this.refreshAuthority();
    });
    const btn = document.getElementById('aci-login');
    if (btn) btn.onclick = () => this.user ? this.signOut() : this.signInGoogle();
  },

  async ensureSession() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    let session = data?.session || null;
    if (!session?.access_token) return null;
    const exp = session.expires_at ? session.expires_at * 1000 : 0;
    if (exp && exp < Date.now() + 120000) {
      const { data: refreshed, error } = await this.client.auth.refreshSession();
      if (!error && refreshed?.session) session = refreshed.session;
    }
    return session;
  },

  async authHeaders() {
    const h = { 'Content-Type': 'application/json', apikey: SB_KEY };
    const session = await this.ensureSession();
    h.Authorization = session?.access_token ? 'Bearer ' + session.access_token : 'Bearer ' + SB_KEY;
    return h;
  },

  async refreshAuthority() {
    if (!this.user) {
      this.isOwner = false;
      this.isArchitect = false;
      this.updateOwnerUI();
      return;
    }
    const email = (this.user.email || '').toLowerCase();
    this.isArchitect = email === this.OWNER_EMAIL;
    try {
      const r = await fetch(ACI.url + '/functions/v1/aci', {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({ mode: 'owner_sync' })
      }).then(res => res.json());
      this.isOwner = !!(r.is_owner || r.is_architect);
      if (this.isOwner) {
        window._aciOwner = true;
        ACI?.feed('owner-sync', email);
      }
    } catch (_) {
      if (this.client) {
        const { data: prof } = await this.client.from('profiles').select('is_owner').eq('id', this.user.id).single();
        this.isOwner = prof?.is_owner === true || this.isArchitect;
      }
    }
    this.updateOwnerUI();
    if (window.FieldBrain) FieldBrain.onAuth();
    if (window.AciCli) AciCli.onAuthChange();
  },

  updateOwnerUI() {
    const chip = document.getElementById('user-chip');
    if (this.isOwner && chip) {
      chip.textContent = (this.user?.user_metadata?.full_name || this.user?.email?.split('@')[0] || 'Owner') + ' · OWNER';
      chip.style.color = '#8f8';
    }
    if (this.isOwner) GlobeDeck?.setTitle('Astranov Collective CLI · FULL AUTHORITY');
    const prompt = document.getElementById('aci-cli-prompt');
    if (prompt && this.isOwner) {
      const name = this.user?.email?.split('@')[0] || 'owner';
      prompt.textContent = name + '@owner $';
    }
  },

  async signInGoogle() {
    if (!this.client) return;
    MapDepict?.action('think', { detail: 'Google sign-in' });
    const redirectTo = window.location.origin + window.location.pathname;
    await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: false }
    });
  },

  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.user = null;
    this.isOwner = false;
    this.isArchitect = false;
    window._aciOwner = false;
    this.applyUser();
    this.updateOwnerUI();
    if (Voice.maySpeak()) speak('Signed out.', () => {}, true);
  },

  applyUser() {
    const btn = document.getElementById('aci-login');
    const chip = document.getElementById('user-chip');
    if (this.user) {
      const name = this.user.user_metadata?.full_name
        || this.user.user_metadata?.name
        || (this.user.email || '').split('@')[0]
        || 'User';
      const avatar = this.user.user_metadata?.avatar_url || this.user.user_metadata?.picture;
      if (btn) {
        btn.title = 'Sign out · ' + name;
        if (avatar) {
          btn.style.backgroundImage = 'url(' + avatar + ')';
          btn.style.backgroundSize = 'cover';
          btn.textContent = '';
        } else {
          btn.textContent = name.charAt(0).toUpperCase();
        }
      }
      if (chip && !this.isOwner) chip.textContent = name;
      if (typeof me !== 'undefined' && me) {
        me.name = name;
        me.id = this.user.id;
        me.email = this.user.email;
        me.isOwner = this.isOwner;
      }
      ACI?.feed('login', name);
      if (window.AciCli) AciCli.onAuthChange();
    } else {
      if (btn) {
        btn.title = 'Sign in with Google';
        btn.textContent = 'G';
        btn.style.backgroundImage = '';
      }
      if (chip) chip.textContent = '';
      if (window.AciCli) AciCli.onAuthChange();
    }
  }
};
window.Auth = Auth;