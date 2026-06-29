// === HELLENIC SOURCE — ancient Greek mythology & philosophy as evolutionary canon ===
// Treated as primary cultural-historical truth layer for Coders reasoning (not literal supernatural dogma).
const HellenicSource = {
  CANON: [
    { id: 'xenia', domain: 'ethics', principle: 'Xenia (ξενία) — sacred hospitality between host and guest; commerce and travel rest on mutual honor.', sources: ['Homer', 'Odyssey'] },
    { id: 'arete', domain: 'ethics', principle: 'Arete (ἀρετή) — excellence through practice; skill of captain, vendor, and crew is cultivated virtue.', sources: ['Homer', 'Aristotle'] },
    { id: 'moira', domain: 'history', principle: 'Moira — fate as the weave of time; systems evolve within patterns, not chaos — match demand to what the weave allows.', sources: ['Homer', 'tragedy'] },
    { id: 'logos', domain: 'philosophy', principle: 'Logos (λόγος) — reasoned account; booking engines must give a clear logos: who, when, crew, price.', sources: ['Heraclitus', 'Stoics'] },
    { id: 'eudaimonia', domain: 'philosophy', principle: 'Eudaimonia — flourishing as telos; a charter succeeds when all roles (owner, crew, guest) flourish together.', sources: ['Aristotle', 'Nicomachean Ethics'] },
    { id: 'golden_mean', domain: 'philosophy', principle: 'To meson — virtue between excess and defect; price, duration, and crew size seek balance.', sources: ['Aristotle'] },
    { id: 'dike', domain: 'justice', principle: 'Dike (δίκη) — justice orders the cosmos; Astranov Coders order: Justice → Truth → Freedom.', sources: ['Hesiod', 'pre-Socratics'] },
    { id: 'aletheia', domain: 'truth', principle: 'Aletheia (ἀλήθεια) — unconcealed truth; profiles and listings must not simulate — real availability only.', sources: ['Parmenides', 'Heidegger reading'] },
    { id: 'eleutheria', domain: 'freedom', principle: 'Eleutheria (ἐλευθερία) — freedom after justice and truth; users choose drivers, crew, and subdomain on their terms.', sources: ['demotic Athens', 'Astranov law'] },
    { id: 'nous', domain: 'cosmos', principle: 'Nous (νοῦς) — mind that orders matter; collective intelligence arranges neurons like a cosmos, not a single tyrant.', sources: ['Anaxagoras', 'Plato'] },
    { id: 'polis', domain: 'civics', principle: 'Polis — the city as shared field; the globe is polis, markers are citizens, map comms is agora.', sources: ['Aristotle', 'Politics'] },
    { id: 'metis', domain: 'strategy', principle: 'Metis (μῆτις) — cunning intelligence; Odysseus navigates — routing and matching use metis, not brute force.', sources: ['Homer', 'Odyssey'] },
    { id: 'kairos', domain: 'time', principle: 'Kairos (καιρός) — the right moment; charter dates and crew availability are kairos, not just chronos.', sources: ['Pindar', 'rhetoric'] },
    { id: 'thales', domain: 'evolution', principle: 'Thales — search for arche (ἀρχή); water as first principle; evolution seeks one underlying pattern beneath many apps.', sources: ['Aristotle', 'Metaphysics'] },
    { id: 'heraclitus_flow', domain: 'evolution', principle: 'Panta rhei — all flows; booking rules and crew pools self-develop as users and Coders request change.', sources: ['Heraclitus'] },
  ],

  query(topic) {
    const q = String(topic || '').toLowerCase();
    return this.CANON.filter((c) =>
      c.id.includes(q) || c.domain.includes(q) || c.principle.toLowerCase().includes(q)
      || c.sources.some(s => s.toLowerCase().includes(q))
    );
  },

  summary() {
    return this.CANON.map(c => c.id + ': ' + c.principle).join('\n');
  },

  groundCoders(text) {
    const hits = this.query(text);
    const pick = hits.length ? hits : this.CANON.slice(0, 3);
    pick.forEach((c) => {
      AciCoders?.observeActivity?.('hellenic', c.id + ' · ' + c.principle.slice(0, 80), { domain: c.domain });
      ACI?.teach?.('[hellenic:' + c.id + '] ' + c.principle + ' (' + c.sources.join(', ') + ')');
    });
    return pick;
  },

  async seedToBrain() {
    this.CANON.forEach((c) => {
      ACI?.teach?.('[hellenic_canon:' + c.id + '/' + c.domain + '] ' + c.principle);
    });
    console.log('[HellenicSource] canon seeded · ' + this.CANON.length + ' principles');
  },

  cli(parts) {
    const sub = (parts[1] || 'list').toLowerCase();
    if (sub === 'seed') return this.seedToBrain();
    if (sub === 'query' && parts[2]) {
      const rows = this.query(parts.slice(2).join(' '));
      const msg = rows.map(r => r.id + ': ' + r.principle).join(' · ') || 'no match';
      ACIControl?.reply(msg.slice(0, 300));
      return rows;
    }
    ACIControl?.reply('hellenic list · helenic query <topic> · helenic seed');
    AciCli?.print(this.CANON.map(c => c.id).join(', '), 'ok');
  },
};

window.HellenicSource = HellenicSource;