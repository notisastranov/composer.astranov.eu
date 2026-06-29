// === FIELD BRAIN — multi-role field usage → collective brain (compliant scope) ===
// All logged-in users: client + driver. Vendor when they own a shop. Same person, all hats.

const FIELD_SCOPE = new Set([
  'heartbeat', 'login', 'roles_sync', 'location', 'drive', 'route', 'order',
  'vendor', 'commerce', 'think', 'teach', 'connect', 'explore', 'claim_delivery',
  'evolve', 'vhf', 'news', 'batch', 'post',
  'pilot', 'drone_seize', 'drone_rtb', 'drone_scan', 'drone_register',
]);

const FieldBrain = {
  roles: ['client', 'driver'],
  vendorIds: [],
  _hb: null,

  init() {
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange(() => this.onAuth());
    }
    this.onAuth();
    this._hb = setInterval(() => this.heartbeat(), 120000);
  },

  async onAuth() {
    if (!Auth?.user) {
      this.roles = [];
      this.vendorIds = [];
      return;
    }
    const r = await ACI.api({ mode: 'roles_sync' });
    if (r.ok) {
      this.roles = r.roles || ['client', 'driver'];
      this.vendorIds = r.vendor_ids || [];
      Auth.userRoles = this.roles;
      Auth.vendorIds = this.vendorIds;
      this.updateChip();
      this.pulse('roles_sync', this.roles.join('+'), { role: 'client' });
    }
  },

  updateChip() {
    const chip = document.getElementById('user-chip');
    if (!chip || !Auth?.user) return;
    if (AstranovSession?.isAstranov?.() || Auth.isOwner) {
      chip.textContent = 'ASTRANOV · OWNER';
      chip.style.color = '#00dd77';
      chip.title = AstranovSession?.SESSION_NAME || 'ASTRANOV COLLECTIVE INTELLIGENCE';
      return;
    }
    const name = Auth.user.user_metadata?.full_name || Auth.user.email?.split('@')[0] || 'User';
    const g = AstroGlyphs || { driver: '🚚', vendor: '🏬', client: '🧑' };
    const hats = this.roles.map(r => r === 'driver' ? g.driver : r === 'vendor' ? g.vendor : g.client).join('');
    const owner = Auth.isOwner ? ' · OWNER' : '';
    chip.textContent = (name + ' ' + hats + owner).slice(0, 48);
    chip.title = 'Roles: ' + this.roles.join(', ');
  },

  hasRole(role) {
    return this.roles.includes(role);
  },

  inferRole(action, opts = {}) {
    if (opts.role) return opts.role;
    if (opts.props?.visual_truth) return 'client';
    if (action === 'vendor' || action === 'commerce') return this.hasRole('vendor') ? 'vendor' : 'client';
    if (/drive|route|claim/.test(action)) return 'driver';
    return 'client';
  },

  pulse(action, detail, opts = {}) {
    if (window.AciCoders?.observeActivity) {
      AciCoders.observeActivity(action, detail, opts.props);
    }
    if (!Auth?.user || !FIELD_SCOPE.has(action)) return;
    const pos = GhostTravel?.active?.() ? GhostTravel.publicPos() : (window._lastPos || {});
    const props = { ...(opts.props || {}) };
    if (GhostTravel?.active?.()) {
      props.visual_truth = true;
      props.scramble_km = GhostTravel.SCRAMBLE_KM;
    }
    ACI.api({
      mode: 'field_pulse',
      action,
      role: this.inferRole(action, opts),
      detail: String(detail || '').slice(0, 220),
      lat: pos.lat ?? null,
      lng: pos.lng ?? null,
      props,
    });
  },

  heartbeat() {
    if (!Auth?.user) return;
    const mode = window.DrivingView?.mode || 'still';
    const speed = window.DrivingView?.speed ? Math.round(DrivingView.speed * 3.6) + 'km/h' : '';
    this.pulse('heartbeat', mode + (speed ? ' ' + speed : ''), { role: 'driver' });
  },

  async claimDelivery(orderId) {
    if (!Auth?.user) return { error: 'login required' };
    const r = await ACI.api({ mode: 'claim_delivery', order_id: orderId });
    if (r.ok) {
      this.pulse('claim_delivery', orderId, { role: 'driver' });
      ACIControl?.reply('Delivery claimed — you are driver for ' + (r.short_id || orderId));
    }
    return r;
  },

  hookFeed() {
    if (!ACI || ACI._fieldHooked) return;
    ACI._fieldHooked = true;
    const orig = ACI.feed.bind(ACI);
    ACI.feed = (action, detail) => {
      orig(action, detail);
      if (Auth?.user) FieldBrain.pulse(action === 'batch' ? 'batch' : action, detail);
    };
  }
};

window.FieldBrain = FieldBrain;