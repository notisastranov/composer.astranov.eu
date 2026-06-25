// ── COMMS: phone + EU PMR (real audio, no simulation) ──
const Comms = {
  vhfActive: false,
  pmr: { channel: 11, freqMHz: 446.13125, label: 'EU PMR 11' },

  async startPhone() {
    const num = prompt('Phone number to call (e.g. +3069...):', '+30');
    if (num && /^\+?\d[\d\s-]{6,}$/.test(num)) {
      const up = window._lastPos || { lat: 36.22, lng: 28.12 };
      MapDepict.action('phone', { lat: up.lat, lng: up.lng, detail: num });
      window.location.href = 'tel:' + num.replace(/\s/g, '');
      ACIControl.reply('Τηλέφωνο: ' + num);
      if (Voice.maySpeak()) speak('Calling.', () => resumeListening());
    } else if (Voice.maySpeak()) speak('Wrong number.');
  },

  startVHF() {
    if (this.vhfActive) return;
    this.vhfActive = true;
    PmrRadio.show();
  },

  startTelecomms() {
    this.startVHF();
  }
};

// ── NEWS (real RSS) ──
const NewsFeed = {
  items: [],
  async fetch() {
    try {
      const url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://feeds.bbci.co.uk/news/world/rss.xml');
      const r = await fetch(url);
      const xml = await r.text();
      const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([^\]<]+)/g)].map(m => m[1]).filter(t => t.length > 12 && !t.includes('BBC'));
      this.items = titles.slice(0, 8);
    } catch { this.items = ['Astranov Collective Intelligence online', 'Globe trackball active', 'ACI ready for orders and comms']; }
    this.tick();
  },
  tick() {
    const el = document.getElementById('news-ticker');
    if (!el || !this.items.length) return;
    const i = Math.floor(Date.now() / 12000) % this.items.length;
    el.textContent = '📡 ' + this.items[i];
  },
  flash() {
    this.fetch();
    MapDepict.action('news', { worldLat: 51.5, worldLng: -0.12, detail: (this.items[0] || '').slice(0, 50) });
    if (Voice.maySpeak()) speak((this.items[0] || 'News').slice(0, 100), () => resumeListening());
  }
};