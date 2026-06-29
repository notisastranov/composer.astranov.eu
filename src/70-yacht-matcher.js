// === YACHT MATCHER — demand/supply: yacht + captain + crew ↔ customer charter ===
// Min crew per hire: 1 captain (300€/d) · 1 vice captain (200€/d) · 1 cadet (100€/d)
const YachtMatcher = {
  CREW_RATES: { captain: 300, vice_captain: 200, cadet: 100 },
  REQUIRED: { captain: 1, vice_captain: 1, cadet: 1 },

  daysBetween(start, end) {
    const a = new Date(start);
    const b = new Date(end);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  },

  crewAvailable(crew, start, end, yachtId) {
    if (!crew?.active) return false;
    if (crew.available_from && start < crew.available_from) return false;
    if (crew.available_to && end > crew.available_to) return false;
    if (yachtId && crew.yacht_ids?.length && !crew.yacht_ids.includes(yachtId)) return false;
    return true;
  },

  pickCrew(pool, role, need, start, end, yachtId) {
    const rows = (pool || []).filter(c => c.role === role && this.crewAvailable(c, start, end, yachtId));
    return rows.slice(0, need);
  },

  matchLocal(yachts, crewPool, demand) {
    const start = demand.start_date;
    const end = demand.end_date;
    const passengers = demand.passengers || 2;
    const days = this.daysBetween(start, end);
    const matches = [];

    (yachts || []).forEach((y) => {
      if (!y.active) return;
      if (passengers > y.max_passengers) return;
      if (days > y.max_hire_days) return;

      const req = { ...this.REQUIRED, ...(y.required_crew || {}) };
      const roster = [];
      let crewOk = true;
      Object.keys(req).forEach((role) => {
        const picked = this.pickCrew(crewPool, role, req[role] || 0, start, end, y.id);
        if (picked.length < (req[role] || 0)) crewOk = false;
        roster.push(...picked);
      });
      if (!crewOk) return;

      const yachtTotal = days * Number(y.price_per_day_eur || 0);
      const crewTotal = roster.reduce((s, c) => s + days * Number(c.rate_per_day_eur || this.CREW_RATES[c.role] || 0), 0);
      const score = yachtTotal + crewTotal;

      matches.push({
        yacht: y,
        days,
        passengers,
        crew: roster,
        breakdown: {
          yacht_per_day: y.price_per_day_eur,
          yacht_total: yachtTotal,
          crew_total: crewTotal,
          crew_rates: this.CREW_RATES,
        },
        total_eur: score,
        score,
      });
    });

    matches.sort((a, b) => a.score - b.score || b.yacht.max_passengers - a.yacht.max_passengers);
    return matches;
  },

  async fetchFleet(siteId) {
    if (!Auth?.client || !siteId) return { yachts: [], crew: [] };
    const [yRes, cRes] = await Promise.all([
      Auth.client.from('booker_yachts').select('*').eq('site_id', siteId).eq('active', true),
      Auth.client.from('booker_crew').select('*').eq('site_id', siteId).eq('active', true),
    ]);
    return { yachts: yRes.data || [], crew: cRes.data || [] };
  },

  async matchDemand(opts) {
    opts = opts || {};
    const siteId = opts.site_id || opts.siteId;
    if (!siteId) throw new Error('site_id required');

    const demand = {
      start_date: opts.start_date || opts.start,
      end_date: opts.end_date || opts.end,
      passengers: Number(opts.passengers || opts.party_size || 2),
    };
    if (!demand.start_date || !demand.end_date) throw new Error('start_date and end_date required');

    const fleet = await this.fetchFleet(siteId);
    let yachts = fleet.yachts;
    if (opts.yacht_id) yachts = yachts.filter(y => y.id === opts.yacht_id);

    const matches = this.matchLocal(yachts, fleet.crew, demand);

    if (Auth?.user && matches[0]) {
      try {
        const headers = await Auth.authHeaders();
        await fetch(SB_URL + '/rest/v1/booker_charter_requests', {
          method: 'POST', headers,
          body: JSON.stringify({
            site_id: siteId,
            yacht_id: matches[0].yacht.id,
            customer_id: Auth.user.id,
            start_date: demand.start_date,
            end_date: demand.end_date,
            passengers: demand.passengers,
            status: 'matched',
            matched_payload: { matches: matches.slice(0, 5), picked: matches[0] },
            total_price_eur: matches[0].total_eur,
          }),
        });
      } catch (_) {}
    }

    return { demand, matches, best: matches[0] || null };
  },

  async upsertYacht(siteId, spec) {
    if (!Auth?.client || !siteId) throw new Error('login + site required');
    const row = {
      site_id: siteId,
      owner_id: Auth.user?.id,
      name: spec.name || 'Yacht',
      description: spec.description || '',
      max_passengers: Number(spec.max_passengers || spec.passengers || 8),
      max_hire_days: Number(spec.max_hire_days || spec.max_days || 14),
      price_per_day_eur: Number(spec.price_per_day || spec.price || 0),
      required_crew: spec.required_crew || this.REQUIRED,
      metadata: spec.metadata || {},
      active: true,
    };
    const { data, error } = await Auth.client.from('booker_yachts').insert(row).select().single();
    if (error) throw error;
    AciCoders?.observeActivity?.('yacht_spec', 'yacht added · ' + row.name, { siteId, yacht: data });
    return data;
  },

  formatMatch(m) {
    if (!m) return 'No matching yacht + crew for those dates.';
    const y = m.yacht;
    const crewNames = m.crew.map(c => (c.display_name || c.role) + ' ' + (c.rate_per_day_eur || this.CREW_RATES[c.role]) + '€/d').join(' · ');
    return y.name + ' · ' + m.days + 'd · ' + m.passengers + ' pax · '
      + m.total_eur.toFixed(0) + ' EUR (yacht ' + m.breakdown.yacht_total + ' + crew ' + m.breakdown.crew_total + ') · '
      + crewNames;
  },

  async cli(parts) {
    const sub = (parts[1] || 'help').toLowerCase();
    if (sub === 'help') {
      ACIControl?.reply('yacht match <site> <start> <end> [passengers] · yacht add <site> name · max_pax · max_days · price/day');
      return;
    }
    if (sub === 'match') {
      const siteId = parts[2];
      const start = parts[3];
      const end = parts[4];
      const passengers = Number(parts[5] || 2);
      const r = await this.matchDemand({ site_id: siteId, start_date: start, end_date: end, passengers });
      const msg = r.best ? this.formatMatch(r.best) : 'No match — adjust dates, passengers, or add yachts/crew';
      ACIControl?.reply(msg);
      AciCli?.print(msg, r.best ? 'ok' : 'dim');
      if (r.best && window.MapComms) {
        MapComms.postSystem?.('⛵ ' + msg.slice(0, 200));
      }
      FieldBrain?.pulse?.('yacht', msg.slice(0, 80), { role: 'client' });
      return r;
    }
    if (sub === 'add' && parts[2]) {
      const siteId = parts[2];
      const name = parts[3] || 'Yacht';
      const maxPax = Number(parts[4] || 8);
      const maxDays = Number(parts[5] || 14);
      const price = Number(parts[6] || 500);
      return this.upsertYacht(siteId, { name, max_passengers: maxPax, max_hire_days: maxDays, price_per_day: price });
    }
    ACIControl?.reply('yacht match <site> YYYY-MM-DD YYYY-MM-DD [pax]');
  },

  /** Coders evolve hook — parse natural language charter requests */
  async evolveFromText(text) {
    const low = String(text || '').toLowerCase();
    if (!/yacht|charter|crew|captain|sail|ενοικ/.test(low)) return null;
    const dates = text.match(/(\d{4}-\d{2}-\d{2})/g) || [];
    const paxM = text.match(/(\d+)\s*(passenger|pax|άτομα|people)/i);
    const passengers = paxM ? Number(paxM[1]) : 4;
    const siteM = text.match(/site\s+([a-z0-9-]+)/i);
    const siteId = siteM?.[1] || null;
    if (dates.length >= 2 && siteId) {
      return this.matchDemand({ site_id: siteId, start_date: dates[0], end_date: dates[1], passengers });
    }
    HellenicSource?.groundCoders?.(text);
    AciCoders?.observeActivity?.('yacht_evolve', text.slice(0, 120), { needs: 'site_id and dates' });
    return { hint: 'Need site slug and dates — e.g. yacht match my-charter 2026-07-01 2026-07-07 6' };
  },
};

window.YachtMatcher = YachtMatcher;