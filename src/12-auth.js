// === GOOGLE AUTH (Supabase) ===
const Auth = {
  client: null,
  user: null,

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
    });
    this.client.auth.getSession().then(({ data }) => {
      this.user = data?.session?.user || null;
      this.applyUser();
    });
    const btn = document.getElementById('aci-login');
    if (btn) btn.onclick = () => this.user ? this.signOut() : this.signInGoogle();
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
    this.applyUser();
    speak('Αποσυνδέθηκες.', () => {});
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
      if (chip) chip.textContent = name;
      if (typeof me !== 'undefined' && me) { me.name = name; me.id = this.user.id; me.email = this.user.email; }
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
  },

  headers() {
    if (!this.client) return {};
    return this.client.auth.getSession().then(({ data }) => {
      const t = data?.session?.access_token;
      return t ? { Authorization: 'Bearer ' + t } : {};
    });
  }
};
window.Auth = Auth;