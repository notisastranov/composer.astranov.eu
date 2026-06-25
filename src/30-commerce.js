// ── COMMERCE: real vendors, real menus only, orders (no fake defaults) ──
const Commerce = {
  vendors: [],
  markers: [],
  selected: null,
  cart: {},
  _uiReady: false,
  _menuRequestSent: false,

  haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  userLatLng() {
    if (userLocated && window._lastPos) return { lat: window._lastPos.lat, lng: window._lastPos.lng };
    return { lat: 36.4239, lng: 28.2245 };
  },

  menuFor(vendor) {
    const items = Array.isArray(vendor?.items) ? vendor.items.filter(i => i && i.name) : [];
    return items;
  },

  hasMenu(vendor) {
    return this.menuFor(vendor).length > 0;
  },

  async loadVendors() {
    try {
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,emoji,lat,lng,category,items,is_active,delivery_enabled&is_active=eq.true&limit=80', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      });
      this.vendors = r.ok ? await r.json() : [];
    } catch { this.vendors = []; }
    const u = this.userLatLng();
    this.vendors.sort((a, b) => this.haversineKm(u.lat, u.lng, a.lat, a.lng) - this.haversineKm(u.lat, u.lng, b.lat, b.lng));
    this.showOnGlobe();
    return this.vendors;
  },

  async myVendors() {
    if (!Auth?.user) return [];
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,emoji,items,category&owner_id=eq.' + Auth.user.id, { headers });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  },

  resolveVendorRef(ref) {
    const q = String(ref || '').trim().toLowerCase();
    if (!q) return null;
    return this.vendors.find(v => v.id === ref || v.name.toLowerCase().includes(q)) || null;
  },

  async resolveOwnedVendor(ref) {
    const owned = await this.myVendors();
    if (!owned.length) return null;
    const q = String(ref || '').trim().toLowerCase();
    if (!q) return owned[0];
    return owned.find(v => v.id === ref || v.name.toLowerCase().includes(q)) || owned[0];
  },

  flyToVendor(v) {
    if (!v || v.lat == null) return;
    const p = latLngToPos(v.lat, v.lng, 1.03);
    if (typeof flyToPoint === 'function') flyToPoint(new THREE.Vector3(p.x, p.y, p.z), 1.42);
    MapDepict?.action('vendor', { lat: v.lat, lng: v.lng, detail: v.name });
  },

  showOnGlobe() {
    this.markers.forEach(m => { if (m.parent) m.parent.remove(m); });
    this.markers = [];
    if (!this.vendors.length) return;
    MapDepict?.action('vendor', { vendors: this.vendors, detail: this.vendors.length + ' shops' });
    this.vendors.forEach(v => {
      const p = latLngToPos(v.lat, v.lng, 1.028);
      const col = /bar|restaurant|fast_food|food/.test(v.category || '') ? 0xff8844 : 0xffcc44;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(p.x, p.y, p.z);
      m.userData = { vendor: v };
      globePivot.add(m);
      this.markers.push(m);
    });
    this.flyToVendor(this.vendors[0]);
  },

  initUI() {
    if (this._uiReady) return;
    this._uiReady = true;
    const panel = document.getElementById('vendor-menu');
    document.getElementById('vm-close')?.addEventListener('click', () => this.hideMenu());
    document.getElementById('vm-back')?.addEventListener('click', () => this.showPicker());
    document.getElementById('vm-place')?.addEventListener('click', () => this.placeCart());
    document.getElementById('vm-request')?.addEventListener('click', () => this.requestMenu());
    if (panel) panel.addEventListener('click', e => e.stopPropagation());
  },

  showMenu() {
    this.initUI();
    document.getElementById('vendor-menu')?.classList.add('open');
  },

  hideMenu() {
    document.getElementById('vendor-menu')?.classList.remove('open');
    this.selected = null;
    this.cart = {};
    this._menuRequestSent = false;
  },

  async showPicker(filter) {
    await this.loadVendors();
    this.showMenu();
    this.selected = null;
    this.cart = {};
    this._menuRequestSent = false;
    const list = document.getElementById('vm-list');
    const detail = document.getElementById('vm-detail');
    if (list) list.style.display = 'block';
    if (detail) detail.style.display = 'none';
    const title = document.getElementById('vm-title');
    if (title) title.textContent = 'Επίλεξε κατάστημα · ' + this.vendors.length;

    let rows = this.vendors;
    if (filter) {
      const q = filter.toLowerCase();
      rows = this.vendors.filter(v => (v.name + ' ' + v.category).toLowerCase().includes(q));
      if (!rows.length) rows = this.vendors;
    }

    if (!list) return;
    list.innerHTML = '';
    const u = this.userLatLng();
    rows.slice(0, 24).forEach(v => {
      const km = this.haversineKm(u.lat, u.lng, v.lat, v.lng).toFixed(1);
      const hasMenu = this.hasMenu(v);
      const row = document.createElement('div');
      row.className = 'vm-vendor';
      row.innerHTML = '<span style="font-size:22px">' + (v.emoji || '🏪') + '</span><div><div style="color:#fda;font-weight:600">' + v.name + '</div><div style="color:#9ab;font-size:10px">' + (v.category || 'shop') + ' · ' + km + ' km' + (hasMenu ? '' : ' · <span style="color:#f96">χωρίς μενού</span>') + '</div></div>';
      row.onclick = () => this.openVendor(v);
      list.appendChild(row);
    });
    if (rows[0]) this.flyToVendor(rows[0]);
    ACIControl?.reply('Tap vendor on globe or list — ' + rows.length + ' shops');
  },

  openVendor(vendor) {
    if (!vendor) return;
    this.selected = vendor;
    this.cart = {};
    this._menuRequestSent = false;
    this.flyToVendor(vendor);
    this.showMenu();
    const list = document.getElementById('vm-list');
    const detail = document.getElementById('vm-detail');
    if (list) list.style.display = 'none';
    if (detail) detail.style.display = 'block';
    const title = document.getElementById('vm-title');
    if (title) title.textContent = (vendor.emoji || '🏪') + ' ' + vendor.name;
    this.renderCart();
    if (this.hasMenu(vendor)) {
      AciCli?.print('vendor: ' + vendor.name + ' — add items, tap Παραγγελία', 'ok');
    } else {
      AciCli?.print('vendor: ' + vendor.name + ' — no menu yet · tap Ζήτησε μενού', 'dim');
    }
  },

  renderCart() {
    const box = document.getElementById('vm-items');
    const empty = document.getElementById('vm-empty');
    const placeBtn = document.getElementById('vm-place');
    const requestBtn = document.getElementById('vm-request');
    if (!box || !this.selected) return;

    const menu = this.menuFor(this.selected);
    if (!menu.length) {
      box.innerHTML = '';
      if (empty) {
        empty.style.display = 'block';
        empty.innerHTML = '<p>Το κατάστημα δεν έχει ανεβάσει μενού στο Astranov ακόμα.</p><p style="color:#9ab;font-size:11px">Πάτα παρακάτω — θα ειδοποιηθεί ο ιδιοκτήτης να συμπληρώσει τα πραγματικά προϊόντα.</p>';
      }
      if (placeBtn) placeBtn.style.display = 'none';
      if (requestBtn) {
        requestBtn.style.display = 'block';
        requestBtn.textContent = this._menuRequestSent ? 'Αίτημα στάλθηκε ✓' : 'Ζήτησε μενού από κατάστημα';
        requestBtn.disabled = !!this._menuRequestSent;
      }
      return;
    }

    if (empty) empty.style.display = 'none';
    if (requestBtn) requestBtn.style.display = 'none';
    if (placeBtn) placeBtn.style.display = 'block';

    box.innerHTML = '';
    menu.forEach(item => {
      const key = item.name;
      const qty = this.cart[key] || 0;
      const row = document.createElement('div');
      row.className = 'vm-item';
      row.innerHTML = '<span>' + item.name + ' <small style="color:#9ab">' + (item.price || 0) + ' AVC</small></span>';
      const q = document.createElement('div');
      q.className = 'vm-qty';
      const minus = document.createElement('button');
      minus.textContent = '−';
      minus.onclick = () => { this.cart[key] = Math.max(0, (this.cart[key] || 0) - 1); this.renderCart(); };
      const span = document.createElement('span');
      span.textContent = String(qty);
      span.style.minWidth = '18px';
      span.style.textAlign = 'center';
      const plus = document.createElement('button');
      plus.textContent = '+';
      plus.onclick = () => { this.cart[key] = (this.cart[key] || 0) + 1; this.renderCart(); };
      q.append(minus, span, plus);
      row.appendChild(q);
      box.appendChild(row);
    });
    const total = menu.reduce((s, i) => s + (this.cart[i.name] || 0) * (i.price || 0), 0);
    if (placeBtn) placeBtn.textContent = total > 0 ? 'Παραγγελία · ' + total.toFixed(1) + ' AVC' : 'Παραγγελία';
  },

  cartItems() {
    const menu = this.menuFor(this.selected || {});
    return menu
      .filter(i => (this.cart[i.name] || 0) > 0)
      .map(i => ({ name: i.name, qty: this.cart[i.name], price: i.price }));
  },

  async requestMenu() {
    const vendor = this.selected;
    if (!vendor) { ACIControl?.reply('Pick a vendor first'); return; }
    if (this.hasMenu(vendor)) {
      ACIControl?.reply('Menu already available — add items to order');
      return;
    }
    if (!Auth?.user) {
      ACIControl?.reply('Sign in to request menu');
      Auth?.signInGoogle();
      return;
    }
    if (this._menuRequestSent) return;

    const u = this.userLatLng();
    let errMsg = '';
    let ok = false;
    let result = null;
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/functions/v1/menu-request', {
        method: 'POST', headers,
        body: JSON.stringify({
          vendor_id: vendor.id,
          notes: 'Customer waiting for menu · ' + vendor.name,
          delivery_lat: u.lat,
          delivery_lng: u.lng,
        }),
      });
      result = await r.json().catch(() => ({}));
      ok = r.ok && result.ok;
      if (!ok) errMsg = result.error || result.message || ('HTTP ' + r.status);
      else this._menuRequestSent = true;
    } catch (e) { errMsg = String(e.message || e); }

    const msg = ok
      ? 'Αίτημα μενού στο ' + vendor.name + (result?.already_pending ? ' (ήδη σε αναμονή)' : ' — ο ιδιοκτήτης ειδοποιήθηκε')
      : 'Αίτημα απέτυχε: ' + (errMsg || 'server error');

    if (ok) {
      this.renderCart();
      MapDepict?.action('order', { lat: u.lat, lng: u.lng, vendorLat: vendor.lat, vendorLng: vendor.lng, detail: 'menu request · ' + vendor.name });
      FieldBrain?.pulse('commerce', 'menu request · ' + vendor.name, { role: 'client' });
    }

    ACIControl?.reply(msg);
    AciCli?.print(msg, ok ? 'ok' : 'err');
    if (Voice.maySpeak()) speak(msg.slice(0, 120), () => resumeListening());
  },

  async placeCart() {
    const vendor = this.selected;
    if (!vendor) { ACIControl?.reply('Pick a vendor first'); return; }
    if (!this.hasMenu(vendor)) {
      ACIControl?.reply('No menu yet — tap Ζήτησε μενού to notify the vendor');
      return;
    }
    const items = this.cartItems();
    if (!items.length) { ACIControl?.reply('Add at least one item'); return; }
    if (!Auth?.user) {
      ACIControl?.reply('Sign in to place order');
      Auth?.signInGoogle();
      return;
    }
    await this.placeOrder(vendor, items);
  },

  async placeOrder(vendor, items, notes) {
    requestLocationIfNeeded(async () => {
      let dLat = this.userLatLng().lat;
      let dLng = this.userLatLng().lng;
      if (userLocated && window._lastPos) {
        dLat = window._lastPos.lat;
        dLng = window._lastPos.lng;
      }
      const total = items.reduce((s, i) => s + (i.qty || 1) * (i.price || 0), 0);
      let orderResult = null;
      let errMsg = '';
      try {
        const headers = Auth?.authHeaders ? await Auth.authHeaders() : sbHeaders();
        const r = await fetch(SB_URL + '/functions/v1/order-intake', {
          method: 'POST', headers,
          body: JSON.stringify({
            vendor_id: vendor.id,
            items: items.map(i => ({ name: i.name, qty: i.qty || 1, price: i.price })),
            delivery_lat: dLat,
            delivery_lng: dLng,
            notes: notes || ('Astranov order · ' + vendor.name),
            calc: { total_avc: total },
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) orderResult = j;
        else {
          if (j.error === 'vendor_menu_empty') errMsg = 'Το κατάστημα δεν έχει μενού — ζήτησε μενού πρώτα';
          else errMsg = j.error || j.message || ('HTTP ' + r.status);
        }
      } catch (e) { errMsg = String(e.message || e); }

      const driverObj = orderResult?.driver;
      const driver = driverObj?.name || orderResult?.order?.driver_name || (orderResult?.seeking_driver ? 'seeking driver' : null);
      const ordId = orderResult?.order?.short_id || orderResult?.order?.id;

      MapDepict?.action('order', {
        lat: dLat, lng: dLng,
        vendorLat: vendor.lat, vendorLng: vendor.lng,
        detail: vendor.name + (ordId ? ' · ' + ordId : ''),
      });
      if (window.DrivingView) DrivingView.setDestination(vendor.lat, vendor.lng);

      let msg;
      if (orderResult?.order) {
        msg = orderResult.seeking_driver
          ? 'Παραγγελία ' + (ordId || '') + ' στο ' + vendor.name + '. Αναζητούμε οδηγό — claim στο CLI.'
          : 'Παραγγελία ' + (ordId || '') + ' στο ' + vendor.name + '. Οδηγός: ' + (driver || 'pending') + '.';
        this.hideMenu();
      } else {
        msg = 'Παραγγελία απέτυχε: ' + (errMsg || 'server error') + '. Δοκίμασε ξανά.';
      }

      ACIControl?.reply(msg);
      AciCli?.print(msg, orderResult?.order ? 'ok' : 'err');
      FieldBrain?.pulse('order', vendor.name + ' → ' + (driver || 'pending'), { role: 'client' });
      if (Voice.maySpeak()) speak(msg.slice(0, 120), () => resumeListening());
    });
  },

  async updateVendorMenu(vendorId, items) {
    const headers = await Auth.authHeaders();
    const r = await fetch(SB_URL + '/rest/v1/vendors?id=eq.' + encodeURIComponent(vendorId), {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ items, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return { error: j.message || j.error || ('HTTP ' + r.status) };
    }
    const rows = await r.json();
    await this.fulfillMenuRequests(vendorId);
    await this.loadVendors();
    if (this.selected?.id === vendorId && rows[0]) this.selected = rows[0];
    return { ok: true, vendor: rows[0] };
  },

  async fulfillMenuRequests(vendorId) {
    try {
      const headers = await Auth.authHeaders();
      await fetch(SB_URL + '/rest/v1/vendor_menu_requests?vendor_id=eq.' + encodeURIComponent(vendorId) + '&status=eq.pending', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'fulfilled', updated_at: new Date().toISOString() }),
      });
    } catch { /* non-fatal */ }
  },

  async listMenuRequests() {
    const owned = await this.myVendors();
    if (!owned.length) return { error: 'no owned vendors' };
    const ids = owned.map(v => v.id).join(',');
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/vendor_menu_requests?select=id,vendor_id,status,notes,created_at&vendor_id=in.(' + ids + ')&status=eq.pending&order=created_at.desc&limit=20', { headers });
      const rows = r.ok ? await r.json() : [];
      const byId = Object.fromEntries(owned.map(v => [v.id, v.name]));
      return { ok: true, requests: rows.map(row => ({ ...row, vendor_name: byId[row.vendor_id] || row.vendor_id })) };
    } catch (e) { return { error: String(e.message || e) }; }
  },

  async cliVendorMenu(args) {
    if (!Auth?.user) return { error: 'login required' };
    const sub = (args[0] || 'list').toLowerCase();
    if (sub === 'list' || sub === 'ls') {
      const owned = await this.myVendors();
      if (!owned.length) return { error: 'you do not own any vendor — claim shop in dashboard first' };
      return {
        ok: true,
        vendors: owned.map(v => ({
          id: v.id,
          name: v.name,
          items: this.menuFor(v).length,
        })),
      };
    }
    if (sub === 'add') {
      const ref = args[1];
      const price = parseFloat(args[args.length - 1]);
      const name = args.slice(2, -1).join(' ').trim();
      if (!ref || !name || isNaN(price)) return { error: 'usage: vendor menu add <shop> <item name> <price>' };
      const v = await this.resolveOwnedVendor(ref);
      if (!v) return { error: 'owned vendor not found: ' + ref };
      const items = this.menuFor(v).concat([{ name, price }]);
      const r = await this.updateVendorMenu(v.id, items);
      if (r.error) return r;
      return { ok: true, message: 'added ' + name + ' @ ' + price + ' AVC to ' + v.name, items: items.length };
    }
    if (sub === 'clear') {
      const ref = args[1];
      if (!ref) return { error: 'usage: vendor menu clear <shop>' };
      const v = await this.resolveOwnedVendor(ref);
      if (!v) return { error: 'owned vendor not found: ' + ref };
      const r = await this.updateVendorMenu(v.id, []);
      if (r.error) return r;
      return { ok: true, message: 'cleared menu for ' + v.name };
    }
    if (sub === 'show') {
      const ref = args[1];
      const v = await this.resolveOwnedVendor(ref);
      if (!v) return { error: 'owned vendor not found' };
      return { ok: true, vendor: v.name, menu: this.menuFor(v) };
    }
    return { error: 'usage: vendor menu list|add|clear|show' };
  },

  announceVendors() {
    this.showPicker();
  },

  async openOrderFlow(query) {
    await this.loadVendors();
    if (!this.vendors.length) {
      ACIControl?.reply('No vendors on map yet');
      return;
    }
    const q = String(query || '').trim();
    if (q.length >= 2) {
      const hit = this.vendors.find(v => (v.name + ' ' + v.category).toLowerCase().includes(q.toLowerCase()));
      if (hit) { this.openVendor(hit); return; }
    }
    this.showPicker(q.length >= 2 ? q : '');
  },

  async orderPitogyra() {
    await this.openOrderFlow('goals');
  },
};