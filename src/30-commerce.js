// ── COMMERCE: vendors, drivers, pitogyra order to your location ──
const Commerce = {
  vendors: [],
  markers: [],
  async loadVendors() {
    try {
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,emoji,lat,lng,category,items&is_active=eq.true&limit=30', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
      this.vendors = r.ok ? await r.json() : [];
    } catch { this.vendors = []; }
    if (!this.vendors.length) {
      this.vendors = [
        { id: 'pitogyra-kos', name: 'Πιτογυράκος Κως', emoji: '🥙', lat: 36.89, lng: 27.29, category: 'food', items: [{ name: 'Πιτογύρα', price: 3.5 }, { name: 'Μπύρα', price: 2 }, { name: 'Τσιγάρα', price: 5 }] },
        { id: 'mini-market', name: 'Mini Market Αξάς', emoji: '🏪', lat: 36.22, lng: 28.14, category: 'shop', items: [] }
      ];
    }
    this.showOnGlobe();
    return this.vendors;
  },
  showOnGlobe() {
    this.markers.forEach(m => { if (m.parent) m.parent.remove(m); });
    this.markers = [];
    if (this.vendors.length) MapDepict.action('vendor', { vendors: this.vendors, detail: this.vendors.length + ' shops' });
    this.vendors.forEach(v => {
      const p = latLngToPos(v.lat, v.lng, 1.028);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
      m.position.set(p.x, p.y, p.z);
      m.userData = { vendor: v };
      globePivot.add(m);
      this.markers.push(m);
    });
  },
  announceVendors() {
    const names = this.vendors.map(v => v.name).join(', ');
    const msg = 'Καταστήματα στον χάρτη: ' + names;
    ACIControl.reply(msg);
    if (Voice.shouldSpeak(msg)) speak(msg.slice(0, 160));
  },
  async orderPitogyra() {
    requestLocationIfNeeded(async () => {
      await this.loadVendors();
      const vendor = this.vendors.find(v => /πιτο|pit|food|γυρ/i.test(v.name + v.id)) || this.vendors[0];
      if (!vendor) { speak('No vendor found.'); return; }
      let dLat = 36.22, dLng = 28.12;
      if (userLocated && window._lastPos) { dLat = window._lastPos.lat; dLng = window._lastPos.lng; }
      else if (window._meMarker) {
        const wp = new THREE.Vector3(); window._meMarker.getWorldPosition(wp);
        dLat = 36.22; dLng = 28.12;
      }
      const items = [{ name: 'Πιτογύρα', qty: 2 }, { name: 'Μπύρα', qty: 2 }, { name: 'Τσιγάρα', qty: 1 }];
      let orderResult = null;
      try {
        const r = await fetch(SB_URL + '/functions/v1/order-intake', {
          method: 'POST', headers: sbHeaders(),
          body: JSON.stringify({ vendor_id: vendor.id, items, delivery_lat: dLat, delivery_lng: dLng, notes: 'Astranov ACI order Αξάς', calc: { total_avc: 18 } })
        });
        orderResult = r.ok ? await r.json() : null;
      } catch { /* local fallback */ }
      const driver = orderResult?.driver || orderResult?.order?.driver_name || 'ΤΗΛΕΜΑΧΟΣ';
      MapDepict.action('order', {
        lat: dLat, lng: dLng,
        vendorLat: vendor.lat, vendorLng: vendor.lng,
        detail: vendor.name + ' → εσύ · ' + driver
      });
      if (window.DrivingView) DrivingView.setDestination(vendor.lat, vendor.lng);
      const msg = 'Παραγγελία στο ' + vendor.name + '. Οδηγός ' + driver + '. Πιτογύρα, μπύρες, τσιγάρα στο σημείο σου.';
      ACIControl.reply(msg);
      speak(msg, () => provokeAnswer());
      groupOrder();
    });
  }
};
