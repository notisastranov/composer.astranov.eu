// === GLOBE ENTITIES — every map thing has a name, proximity label, tap action ===
const GlobeEntity = {
  entities: new Map(),
  _labelRoot: null,
  _selected: null,
  _hud: null,

  TYPES: {
    vendor: { color: 0xff8844, icon: '🏬', label: 'Shop' },
    driver: { color: 0x4488ff, icon: '🚚', label: 'Driver' },
    friend: { color: 0xffaa33, icon: '👤', label: 'Friend' },
    post: { color: 0xff66aa, icon: '▶', label: 'Post' },
    me: { color: 0x00ffcc, icon: '📍', label: 'You' },
    news: { color: 0xcc88ff, icon: '📰', label: 'News' },
    order: { color: 0xffaa44, icon: '🛒', label: 'Order' },
    media: { color: 0xff4466, icon: '🎬', label: 'Media' },
    pilot: { color: 0x00ccff, icon: '🛸', label: 'Delivery' },
    place: { color: 0x00aaff, icon: '◎', label: 'Place' },
  },

  init() {
    this._labelRoot = document.getElementById('globe-entity-labels');
    this._hud = document.getElementById('globe-entity-hud');
    document.getElementById('ge-hud-close')?.addEventListener('click', () => this.clearSelection());
    document.getElementById('ge-hud-action')?.addEventListener('click', () => this._runSelectedAction());
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  _worldPos(lat, lng, r) {
    const p = latLngToPos(lat, lng, r || 1.028);
    const v = new THREE.Vector3(p.x, p.y, p.z);
    globePivot.localToWorld(v);
    return v;
  },

  _project(world) {
    const v = world.clone();
    v.project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      behind: v.z > 1,
      depth: v.z,
    };
  },

  _urgencyClass(u) {
    return 'ge-urg-' + Math.min(3, Math.max(0, u | 0));
  },

  register(opts) {
    const id = opts.id || ('ge-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    const type = opts.type || 'place';
    const meta = this.TYPES[type] || this.TYPES.place;
    const lat = opts.lat, lng = opts.lng;
    if (lat == null || lng == null) return null;

    this.unregister(id);

    const urgency = opts.urgency != null ? opts.urgency : (type === 'driver' ? 2 : type === 'me' ? 2 : 1);
    const color = opts.color || meta.color;
    const r = opts.radius || (type === 'me' ? 0.028 : type === 'vendor' ? 0.016 : 0.014);

    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.1, r * 1.65, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: urgency >= 2 ? 0.55 : 0.28, side: THREE.DoubleSide })
    );
    ring.lookAt(0, 0, 0);
    group.add(ring);
    group.add(core);

    const pos = latLngToPos(lat, lng, opts.altitude || 1.028);
    group.position.set(pos.x, pos.y, pos.z);
    group.lookAt(0, 0, 0);

    const entity = {
      id, type, lat, lng, title: opts.title || meta.label,
      description: opts.description || '',
      urgency, color, icon: opts.icon || meta.icon,
      persist: opts.persist !== false,
      expires: opts.expires || 0,
      born: Date.now(),
      data: opts.data || {},
      onTap: opts.onTap || null,
      mesh: group,
      ring,
      core,
      _revealed: false,
      _labelEl: null,
    };

    group.userData = { globeEntity: id, type, title: entity.title, lat, lng };
    globePivot.add(group);

    const label = document.createElement('div');
    label.className = 'ge-label ' + this._urgencyClass(urgency) + ' ge-type-' + type;
    label.dataset.id = id;
    label.innerHTML = '<div class="ge-pin">' + this.esc(entity.icon) + '</div>'
      + '<div class="ge-text"><b>' + this.esc(entity.title) + '</b>'
      + '<span>' + this.esc(entity.description) + '</span></div>';
    label.style.display = 'none';
    this._labelRoot?.appendChild(label);
    entity._labelEl = label;

    this.entities.set(id, entity);
    return entity;
  },

  unregister(id) {
    const e = this.entities.get(id);
    if (!e) return;
    if (e.mesh?.parent) e.mesh.parent.remove(e.mesh);
    if (e._labelEl?.parentNode) e._labelEl.parentNode.removeChild(e._labelEl);
    if (this._selected === id) this.clearSelection();
    this.entities.delete(id);
  },

  unregisterType(type) {
    [...this.entities.values()].filter(e => e.type === type).forEach(e => this.unregister(e.id));
  },

  registerTemp(opts) {
    return this.register({ ...opts, persist: false, expires: opts.expires || 12000 });
  },

  _proximity(entity) {
    const world = this._worldPos(entity.lat, entity.lng, 1.03);
    const camPos = camera.position.clone();
    const toEnt = world.clone().sub(camPos).normalize();
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const dot = look.dot(toEnt);
    const z = camera.position.z;
    const zoomNear = Math.max(0, Math.min(1, (2.45 - z) / 1.35));
    const u = entity.urgency;
    const thresh = 0.94 - u * 0.12 - zoomNear * 0.22;
    const show = dot > thresh && !this._project(world).behind;
    const flash = u >= 3 && dot > 0.45;
    const glow = u >= 2 && show;
    return { show, flash, glow, dot, zoomNear, world };
  },

  _scavengeView(entity, reason) {
    if (!entity._revealed && reason === 'proximity') {
      entity._revealed = true;
      FieldBrain?.pulse?.('explore', 'saw:' + entity.type + ':' + entity.title.slice(0, 60), {
        role: 'client',
        props: { entity_id: entity.id, type: entity.type, urgency: entity.urgency, lat: entity.lat, lng: entity.lng },
      });
      AciCoders?.observeActivity?.('entity_view', entity.type + ':' + entity.title.slice(0, 80));
    }
    if (reason === 'tap') {
      FieldBrain?.pulse?.('explore', 'tap:' + entity.type + ':' + entity.title.slice(0, 60), {
        role: 'client',
        props: { entity_id: entity.id, type: entity.type, action: true },
      });
      AciCoders?.observeActivity?.('entity_tap', entity.type + ':' + entity.title.slice(0, 80));
    }
  },

  select(entity) {
    this._selected = entity.id;
    const hud = this._hud;
    if (!hud) return;
    hud.classList.add('open');
    document.getElementById('ge-hud-type').textContent = (entity.icon || '') + ' ' + (this.TYPES[entity.type]?.label || entity.type);
    document.getElementById('ge-hud-title').textContent = entity.title;
    document.getElementById('ge-hud-desc').textContent = entity.description || 'Tap action below';
    const btn = document.getElementById('ge-hud-action');
    if (btn) btn.textContent = entity._actionLabel || this._defaultActionLabel(entity);
    GlobeDeck?.setPreview?.(entity.icon + ' ' + entity.title + ' — ' + (entity.description || '').slice(0, 50));
    AciCli?.print('◎ ' + entity.title + ' · ' + (entity.description || entity.type), 'map');
  },

  clearSelection() {
    this._selected = null;
    this._hud?.classList.remove('open');
  },

  _defaultActionLabel(entity) {
    const map = {
      vendor: 'Open shop menu',
      driver: 'Request delivery',
      friend: 'Fly here',
      post: 'Watch / read',
      me: 'City view',
      news: 'Read news',
      order: 'View order',
      media: 'Play media',
      pilot: 'Track delivery',
      place: 'Go here',
    };
    return map[entity.type] || 'Interact';
  },

  _runSelectedAction() {
    const e = this.entities.get(this._selected);
    if (e) this.activate(e);
  },

  activate(entity) {
    this._scavengeView(entity, 'tap');
    this.select(entity);
    if (entity.onTap) {
      entity.onTap(entity);
      return;
    }
    if (entity.onAction) {
      entity.onAction(entity);
      return;
    }
    if (entity.data?.url || entity.subtitle?.includes('.astranov.eu')) {
      const url = entity.data?.url || ('https://' + entity.subtitle);
      if (window.AstranovSiteShell?.open) {
        AstranovSiteShell.open(url, { domain: entity.subtitle, title: entity.title });
        return;
      }
    }
    this._defaultTap(entity);
  },

  _defaultTap(entity) {
    const fp = latLngToPos(entity.lat, entity.lng, 1.04);
    flyToPoint?.(new THREE.Vector3(fp.x, fp.y, fp.z), entity.type === 'vendor' ? 1.18 : 1.28);
    GlobeControl?.noteAutoFly?.();

    switch (entity.type) {
      case 'vendor':
        if (entity.data?.vendor) Commerce?.openVendor?.(entity.data.vendor);
        else Commerce?.showPicker?.();
        break;
      case 'driver':
        ACIControl?.reply('Driver ' + entity.title + ' — type: order groceries · scenario assign');
        Commerce?.smartOrder?.('delivery from ' + entity.title);
        break;
      case 'friend':
        SuperCli?.run?.('locate');
        ACIControl?.reply(entity.title + ' is nearby on the globe');
        break;
      case 'post':
        if (entity.data?.url) {
          GlobeVideo?.play?.(entity.data.url, { title: entity.title }, entity.title);
        } else {
          ACIControl?.reply(entity.description || entity.title);
        }
        break;
      case 'me':
        CityLife?.dropIn?.(entity.lat, entity.lng, { openShops: true });
        break;
      case 'news':
        NewsFeed?.flash?.();
        break;
      default:
        ACIControl?.reply(entity.title + (entity.description ? ' — ' + entity.description : ''));
    }
  },

  pickFromHit(object) {
    let o = object;
    for (let i = 0; i < 6 && o; i++) {
      if (o.userData?.globeEntity) return this.entities.get(o.userData.globeEntity);
      if (o.userData?.vendor) {
        const v = o.userData.vendor;
        return [...this.entities.values()].find(e => e.type === 'vendor' && e.data?.vendor?.id === v.id)
          || this.register({
            id: 'vendor-' + v.id, type: 'vendor', lat: v.lat, lng: v.lng,
            title: v.name, description: (v.category || 'shop') + ' · tap to order',
            data: { vendor: v },
            onTap: () => Commerce?.openVendor?.(v),
          });
      }
      if (o.userData?.driver) {
        const d = o.userData.driver;
        return [...this.entities.values()].find(e => e.type === 'driver' && e.data?.driver?.id === d.id);
      }
      if (o.userData?.type === 'post') {
        return [...this.entities.values()].find(e => e.type === 'post' && e.title === o.userData.label);
      }
      if (o.userData?.type === 'me') {
        return [...this.entities.values()].find(e => e.type === 'me');
      }
      if (o.userData?.name && o.userData?.lat != null) {
        return [...this.entities.values()].find(e => e.title === o.userData.name);
      }
      o = o.parent;
    }
    return null;
  },

  clickTargets() {
    const list = [];
    this.entities.forEach(e => { if (e.mesh) list.push(e.mesh); });
    return list;
  },

  tick() {
    const now = Date.now();
    const toRemove = [];

    this.entities.forEach((entity, id) => {
      if (!entity.persist && entity.expires && now - entity.born > entity.expires) {
        toRemove.push(id);
        return;
      }

      const prox = this._proximity(entity);
      const el = entity._labelEl;
      if (el) {
        if (prox.show) {
          const scr = this._project(prox.world);
          el.style.display = 'flex';
          el.style.left = scr.x + 'px';
          el.style.top = (scr.y - 8) + 'px';
          el.classList.toggle('ge-flash', prox.flash);
          el.classList.toggle('ge-glow', prox.glow);
          el.classList.toggle('ge-selected', this._selected === id);
          if (!entity._revealed) this._scavengeView(entity, 'proximity');
        } else {
          el.style.display = 'none';
          el.classList.remove('ge-flash', 'ge-glow', 'ge-selected');
        }
      }

      if (entity.ring) {
        const pulse = prox.glow ? 0.45 + Math.sin(now / 280) * 0.25 : 0.2;
        entity.ring.material.opacity = prox.flash ? 0.65 + Math.sin(now / 180) * 0.35 : pulse;
        entity.ring.visible = prox.show || entity.urgency >= 2;
      }
      if (entity.core && prox.flash) {
        const s = 1 + Math.sin(now / 200) * 0.18;
        entity.core.scale.set(s, s, s);
      }
    });

    toRemove.forEach(id => this.unregister(id));
  },

  // ── Adapters for existing systems ──

  syncVendors(vendors) {
    this.unregisterType('vendor');
    (vendors || []).forEach((v, i) => {
      if (v.lat == null) return;
      const km = Commerce?.haversineKm?.(Commerce.userLatLng().lat, Commerce.userLatLng().lng, v.lat, v.lng);
      const menu = Commerce?.menuFor?.(v)?.length || 0;
      this.register({
        id: 'vendor-' + v.id,
        type: 'vendor',
        lat: v.lat,
        lng: v.lng,
        title: v.name,
        description: (menu ? menu + ' items' : 'menu on request') + (km != null ? ' · ' + km.toFixed(1) + ' km' : '') + ' · tap to order',
        urgency: i === 0 ? 2 : 1,
        data: { vendor: v },
        _actionLabel: 'Open ' + v.name,
        onTap: () => Commerce?.openVendor?.(v),
      });
    });
  },

  syncDrivers(drivers) {
    this.unregisterType('driver');
    (drivers || []).forEach((d, i) => {
      if (d.field_lat == null) return;
      const km = Commerce?.haversineKm?.(Commerce.userLatLng().lat, Commerce.userLatLng().lng, d.field_lat, d.field_lng);
      this.register({
        id: 'driver-' + d.id,
        type: 'driver',
        lat: d.field_lat,
        lng: d.field_lng,
        title: d.display_name || 'Driver',
        description: 'Available · ' + (km != null ? km.toFixed(1) + ' km' : 'nearby') + ' · tap to assign',
        urgency: 2,
        data: { driver: d },
        _actionLabel: 'Assign ' + (d.display_name || 'driver'),
        onTap: (e) => {
          ACIControl?.reply('Driver ' + e.title + ' — confirm order to assign');
          Commerce?.smartOrder?.('delivery');
        },
      });
    });
  },

  syncFriends(others) {
    this.unregisterType('friend');
    (others || []).forEach(u => {
      this.register({
        id: 'friend-' + u.id,
        type: 'friend',
        lat: u.lat,
        lng: u.lng,
        title: (u.emoji || '') + ' ' + u.name,
        description: 'Friend nearby · tap to fly here',
        urgency: 1,
        data: { user: u },
        onTap: (e) => {
          const p = latLngToPos(e.lat, e.lng, 1.04);
          flyToPoint?.(new THREE.Vector3(p.x, p.y, p.z), 1.22);
          ACIControl?.reply(u.name + ' on the globe');
        },
      });
    });
  },

  syncMe(lat, lng, name) {
    this.unregisterType('me');
    this.register({
      id: 'me',
      type: 'me',
      lat,
      lng,
      title: name || 'You',
      description: 'Your location · tap for city view',
      urgency: 2,
      persist: true,
      onTap: () => CityLife?.dropIn?.(lat, lng, { openShops: true }),
    });
  },

  syncPost(p) {
    if (p.lat == null) return;
    const id = 'post-' + (p.id || p.lat + '-' + p.lng);
    this.register({
      id,
      type: 'post',
      lat: p.lat,
      lng: p.lng,
      title: (p.text || p.author || 'Post').slice(0, 48),
      description: (p.channel || 'global') + (p.mode === 'video' ? ' · video' : '') + ' · tap to open',
      urgency: p.mode === 'video' ? 2 : 1,
      data: { url: p.url, channel: p.channel, post: p },
      _actionLabel: p.url ? 'Play video' : 'Read post',
      onTap: (e) => {
        if (e.data?.url) GlobeVideo?.play?.(e.data.url, { title: e.title }, e.title);
        else ACIControl?.reply(e.description);
      },
    });
  },
};
window.GlobeEntity = GlobeEntity;