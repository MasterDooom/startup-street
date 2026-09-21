export type IntelligenceInput = {
  name: string;
  category?: string;
  type?: string;
  city?: string;
  website?: string;
  phone?: string;
  email?: string;
  social?: string;
  mapsUrl?: string;
  rating?: number | null;
  reviewCount?: number | null;
  businessStatus?: string | null;
  address?: string;
  state?: string;
  postalCode?: string;
  provider?: string;
  findings?: Array<{ title?: string; problem?: string; severity?: string; evidence?: string; confidence?: string; fix?: string }>;
  metrics?: {
    hasViewport?: boolean;
    h1Count?: number;
    textLength?: number;
    brokenLinks?: number;
    hasPhone?: boolean;
    hasWhatsApp?: boolean;
    hasBooking?: boolean;
    hasOrder?: boolean;
    hasHours?: boolean;
    hasMap?: boolean;
    socialLinks?: number;
  };
};

export type ScoreComponent = {
  key: string;
  label: string;
  value: number;
  max: number;
  reasons: string[];
};

export type IntelligenceResult = {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  components: ScoreComponent[];
  reasons: string[];
  growthSignals: Array<{ signal: string; evidence: string; kind: 'observed' | 'inference'; confidence: 'high' | 'medium' | 'low' }>;
  digitalSignals: Array<{ signal: string; evidence: string; confidence: 'high' | 'medium' | 'low' }>;
  whyNow: string[];
  recommendedService: string;
  opportunity: string;
  priceRange: string;
  dataCompleteness: number;
};

const marketWeights = {
  growth: 25,
  website: 25,
  buying: 20,
  fit: 15,
  contact: 10,
  confidence: 5,
};

function text(input: IntelligenceInput) {
  return [input.name, input.category, input.type, input.city, input.address].filter(Boolean).join(' ').toLowerCase();
}

function nicheType(s: string) {
  const q = s.toLowerCase();
  if (/(interior|renovation|architect|design|construction)/.test(q)) return 'design';
  if (/(solar|rooftop|pv)/.test(q)) return 'solar';
  if (/(restaurant|cafe|café|bakery|food)/.test(q)) return 'restaurant';
  if (/(clinic|doctor|dentist|health)/.test(q)) return 'clinic';
  if (/(real estate|property|realtor)/.test(q)) return 'real-estate';
  if (/(wedding|event|venue)/.test(q)) return 'events';
  return 'local-service';
}

function serviceFor(input: IntelligenceInput) {
  const kind = nicheType(text(input));
  if (kind === 'design') return { service: 'Portfolio + enquiry website', range: '₹30k–₹80k' };
  if (kind === 'solar') return { service: 'Quote + site-survey lead-generation website', range: '₹25k–₹70k' };
  if (kind === 'restaurant') return { service: 'Menu + booking/order website', range: '₹20k–₹60k' };
  if (kind === 'clinic') return { service: 'Trust + booking website', range: '₹30k–₹75k' };
  if (kind === 'real-estate') return { service: 'Lead-generation property website', range: '₹35k–₹90k' };
  if (kind === 'events') return { service: 'Portfolio + enquiry booking website', range: '₹25k–₹70k' };
  return { service: 'Local lead-generation website', range: '₹20k–₹60k' };
}

function completeness(input: IntelligenceInput) {
  const fields = [
    input.name,
    input.category || input.type,
    input.city,
    input.address,
    input.website,
    input.phone,
    input.mapsUrl,
    input.rating != null ? String(input.rating) : '',
    input.reviewCount != null ? String(input.reviewCount) : '',
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function scoreGrowth(input: IntelligenceInput) {
  let value = 5;
  const reasons: string[] = [];
  const signals: IntelligenceResult['growthSignals'] = [];
  const q = text(input);

  if (q.match(/(studio|designer|contractor|agency|clinic|installer|architect|company)/)) {
    value += 3;
    reasons.push('Professional service business is a plausible agency buyer.');
  }

  if ((input.reviewCount ?? 0) >= 500) {
    value += 4;
    reasons.push('Large public review base suggests meaningful customer volume.');
    signals.push({ signal: 'Strong public review footprint', evidence: String(input.reviewCount) + ' public reviews returned by the provider.', kind: 'observed', confidence: 'high' });
  } else if ((input.reviewCount ?? 0) >= 100) {
    value += 3;
    reasons.push('Material public review footprint suggests established demand.');
    signals.push({ signal: 'Established public review footprint', evidence: String(input.reviewCount) + ' public reviews returned by the provider.', kind: 'observed', confidence: 'high' });
  }

  if ((input.rating ?? 0) >= 4.5) {
    value += 3;
    reasons.push('High public rating can support a stronger customer-acquisition proposition.');
    signals.push({ signal: 'Strong public rating', evidence: 'Provider rating: ' + String(input.rating) + '.', kind: 'observed', confidence: 'high' });
  }

  if (input.website) {
    value += 2;
  } else {
    value += 3;
    signals.push({ signal: 'No owned website returned by provider', evidence: 'The discovery provider returned no website URL.', kind: 'observed', confidence: 'medium' });
  }

  const growthLanguage = /(multiple|branches|expansion|group|projects|studio|premium|solutions|services)/.test(q);
  if (growthLanguage) {
    value += 3;
    reasons.push('Business language suggests multiple services, projects, or a larger operating footprint.');
    signals.push({ signal: 'Potential operating complexity', evidence: 'Category/name text includes multi-service or project-oriented terms: ' + (input.category || input.type || input.name) + '.', kind: 'inference', confidence: 'low' });
  }

  return { value: Math.min(25, value), reasons, signals };
}

function scoreWebsite(input: IntelligenceInput) {
  const findings = input.findings ?? [];
  if (!input.website) {
    return {
      value: 25,
      reasons: ['No owned website URL was returned by the provider.'],
      signals: [{ signal: 'No owned website', evidence: 'Discovery returned no website URI.', confidence: 'medium' as const }],
    };
  }

  let value = 6;
  const reasons: string[] = [];
  const signals: IntelligenceResult['digitalSignals'] = [];

  const critical = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;
  const medium = findings.filter((f) => f.severity === 'medium').length;

  value += Math.min(10, critical * 5 + high * 2 + medium);
  if (critical) reasons.push(String(critical) + ' critical website finding(s) were observed.');
  if (high) reasons.push(String(high) + ' high-severity website finding(s) were observed.');
  if (medium) reasons.push(String(medium) + ' medium-severity website finding(s) were observed.');

  for (const f of findings.filter((x) => x.severity === 'critical' || x.severity === 'high').slice(0, 4)) {
    signals.push({
      signal: f.title || 'Website issue',
      evidence: f.evidence || f.problem || 'Audit finding',
      confidence: f.confidence === 'low' ? 'low' : f.confidence === 'high' ? 'high' : 'medium',
    });
  }

  if (input.metrics?.hasBooking === false && input.metrics?.hasOrder === false) {
    value += 3;
    reasons.push('No booking/order flow was detected in the audit.');
  }

  if (input.metrics?.hasWhatsApp === false && input.metrics?.hasPhone === false) {
    value += 2;
    reasons.push('No obvious fast contact channel was detected in the audit.');
  }

  return { value: Math.min(25, value), reasons, signals };
}

function scoreBuying(input: IntelligenceInput) {
  let value = 5;
  const reasons: string[] = [];
  if (!input.website) {
    value += 6;
    reasons.push('No owned website creates an obvious digital-gap opportunity.');
  }
  if (input.social) {
    value += 3;
    reasons.push('A public social profile creates a potential owned-vs-rented audience gap.');
  }
  if ((input.reviewCount ?? 0) >= 100) {
    value += 2;
    reasons.push('Established public demand can make digital conversion improvements more commercially relevant.');
  }
  if ((input.reviewCount ?? 0) >= 500) value += 2;
  if (input.mapsUrl) value += 1;

  return { value: Math.min(20, value), reasons };
}

function scoreFit(input: IntelligenceInput) {
  const kind = nicheType(text(input));
  let value = kind === 'design' || kind === 'solar' || kind === 'clinic' || kind === 'real-estate' ? 13 : 10;
  const reasons = ['Business type maps to a defined web-agency offer.'];
  if (/(premium|studio|architect|designer|consulting|solutions|projects)/.test(text(input))) {
    value += 2;
    reasons.push('Public positioning suggests a presentation/proof-heavy offer where website quality matters.');
  }
  return { value: Math.min(15, value), reasons };
}

function scoreContact(input: IntelligenceInput) {
  let value = 0;
  const reasons: string[] = [];
  if (input.phone) { value += 5; reasons.push('Public phone number available.'); }
  if (input.email) { value += 3; reasons.push('Public email available.'); }
  if (input.social) { value += 2; reasons.push('Public social profile available.'); }
  return { value: Math.min(10, value), reasons };
}

export function analyzeLead(input: IntelligenceInput): IntelligenceResult {
  const growth = scoreGrowth(input);
  const website = scoreWebsite(input);
  const buying = scoreBuying(input);
  const fit = scoreFit(input);
  const contact = scoreContact(input);
  const dataConfidence = Math.max(1, Math.min(5, Math.round(completeness(input) / 20)));

  const reasons = [...growth.reasons, ...website.reasons, ...buying.reasons, ...fit.reasons, ...contact.reasons];
  const signals = [...growth.signals];
  const digitalSignals = [...website.signals];

  const service = serviceFor(input);
  const score = Math.min(100, growth.value + website.value + buying.value + fit.value + contact.value + dataConfidence);

  const confidence = completeness(input) >= 75 ? 'high' : completeness(input) >= 50 ? 'medium' : 'low';

  const whyNow = [
    ...growth.reasons.slice(0, 2),
    ...buying.reasons.slice(0, 2),
    ...website.reasons.slice(0, 1),
  ];

  const opportunity =
    score >= 80 ? 'High client opportunity: multiple commercial and digital signals align.' :
    score >= 65 ? 'Promising client opportunity: meaningful web need with some supporting business signals.' :
    score >= 50 ? 'Potential opportunity: verify additional business and growth evidence before prioritizing outreach.' :
    'Low-confidence opportunity: collect more evidence before spending outreach effort.';

  return {
    score,
    confidence,
    components: [
      { key: 'growth', label: 'Growth potential', value: growth.value, max: 25, reasons: growth.reasons },
      { key: 'website', label: 'Website opportunity', value: website.value, max: 25, reasons: website.reasons },
      { key: 'buying', label: 'Buying signals', value: buying.value, max: 20, reasons: buying.reasons },
      { key: 'fit', label: 'Agency service fit', value: fit.value, max: 15, reasons: fit.reasons },
      { key: 'contact', label: 'Contactability', value: contact.value, max: 10, reasons: contact.reasons },
      { key: 'confidence', label: 'Data confidence', value: dataConfidence, max: 5, reasons: [String(completeness(input)) + '% of key lead fields are currently populated.'] },
    ],
    reasons: reasons.slice(0, 10),
    growthSignals: signals.slice(0, 8),
    digitalSignals: digitalSignals.slice(0, 8),
    whyNow: whyNow.slice(0, 5),
    recommendedService: service.service,
    opportunity,
    priceRange: service.range,
    dataCompleteness: completeness(input),
  };
}

export { marketWeights };
