'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Globe,
  Link2,
  MapPin,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type Status =
  | 'New'
  | 'Needs review'
  | 'Verified'
  | 'Ready to contact'
  | 'Contacted'
  | 'Replied'
  | 'Interested'
  | 'Proposal sent'
  | 'Won'
  | 'Lost'
  | 'Do not contact';

type Finding = {
  id: string;
  title: string;
  problem: string;
  severity: Severity;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  fix: string;
};

type ScoreBreakdown = {
  websiteGap: number;
  buyingSignals: number;
  businessFit: number;
  contactability: number;
  serviceRelevance: number;
};

type Lead = {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  category: string;
  website: string;
  email: string;
  phone: string;
  social: string;
  mapsUrl: string;
  source: string;
  discoveredAt: string;
  status: Status;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  findings: Finding[];
  opportunity: string;
  recommendedService: string;
  priceRange: string;
  evidence: string;
  notes: string;
  doNotContact: boolean;
  sourceMeta?: {
    googleRating?: number | null;
    googleReviewCount?: number | null;
    businessStatus?: string | null;
  };
  outreach?: {
    channel: string;
    draft: string;
    generatedAt: string;
    approved: boolean;
  };
};

type AuditResult = {
  url: string;
  finalUrl: string;
  reachable: boolean;
  httpStatus?: number;
  responseMs?: number;
  title?: string;
  score: number;
  findings: Finding[];
  metrics?: {
    hasViewport: boolean;
    h1Count: number;
    textLength: number;
    internalLinksChecked: number;
    brokenLinks: number;
    hasMenu: boolean;
    hasPhone: boolean;
    hasWhatsApp: boolean;
    hasBooking: boolean;
    hasOrder: boolean;
    hasHours: boolean;
    hasMap: boolean;
    hasCatering: boolean;
    socialLinks: number;
    hasPdfMenu: boolean;
    hasImageMenu: boolean;
  };
};

const STORAGE_KEY = 'startup-street-leads-v3';
const ACTIVE_NICHE_KEY = 'startup-street-niche-v1';

const nicheOptions = [
  {
    id: 'interior',
    label: 'Interior & renovation',
    short: 'High-ticket + visual',
    description: 'Portfolio-led businesses where trust, proof and enquiries matter.',
    query: 'interior designers and renovation companies',
    sources: ['Google Places', 'Public websites', 'Social profiles', 'Opening/project announcements'],
  },
  {
    id: 'home-services',
    label: 'Home services',
    short: 'High-intent + local',
    description: 'Local service businesses where better conversion paths can create more enquiries.',
    query: 'home service companies',
    sources: ['Google Places', 'Public websites', 'Business directories'],
  },
  {
    id: 'solar',
    label: 'Solar installers',
    short: 'Quote-driven + growing',
    description: 'Lead-driven installers selling high-value systems and site surveys.',
    query: 'rooftop solar installers',
    sources: ['Google Places', 'Public websites', 'Industry pages'],
  },
  {
    id: 'restaurants',
    label: 'Restaurants & cafés',
    short: 'Visual + high volume',
    description: 'Menu, location and booking/order journeys are easy to audit and improve.',
    query: 'restaurants and cafes',
    sources: ['Google Places', 'Public websites', 'Social profiles'],
  },
  {
    id: 'clinics',
    label: 'Private clinics',
    short: 'Trust + booking',
    description: 'Trust-heavy local businesses where clear information and appointments matter.',
    query: 'private clinics',
    sources: ['Google Places', 'Public websites', 'Public provider directories'],
  },
] as const;

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const sampleFindings: Finding[] = [
  {
    id: 'sample-viewport',
    title: 'No mobile viewport tag detected',
    problem: 'The site does not declare the standard responsive viewport configuration.',
    severity: 'high',
    evidence: 'Static HTML audit signal',
    confidence: 'high',
    fix: 'Rebuild the shell responsively and validate key sections at mobile widths.',
  },
  {
    id: 'sample-cta',
    title: 'No clear enquiry CTA',
    problem: 'The page does not expose a strong next step for a prospect.',
    severity: 'critical',
    evidence: 'No booking, quote, order or enquiry pattern detected in the HTML.',
    confidence: 'medium',
    fix: 'Create a single primary CTA and repeat it where a buyer is likely to decide.',
  },
];

const sampleLeads: Lead[] = [
  {
    id: 'sample-1',
    name: 'North & Form Studio',
    city: 'Bengaluru',
    state: 'Karnataka',
    type: 'Interior design studio',
    category: 'Interior & renovation',
    website: 'https://example.com',
    email: '',
    phone: '',
    social: '',
    mapsUrl: '',
    source: 'Sample data',
    discoveredAt: '2026-09-21T08:00:00.000Z',
    status: 'Needs review',
    score: 88,
    scoreBreakdown: { websiteGap: 14, buyingSignals: 20, businessFit: 19, contactability: 14, serviceRelevance: 21 },
    findings: sampleFindings,
    opportunity: 'Turn portfolio traffic into qualified design enquiries.',
    recommendedService: 'Portfolio + enquiry website',
    priceRange: '₹25k–₹60k',
    evidence: 'Sample record only. Replace with a real discovery + audit before contacting.',
    notes: 'Use as a UI demo. Do not contact.',
    doNotContact: true,
  },
  {
    id: 'sample-2',
    name: 'Studio Arc Renovation',
    city: 'Pune',
    state: 'Maharashtra',
    type: 'Renovation contractor',
    category: 'Interior & renovation',
    website: '',
    email: '',
    phone: '',
    social: '',
    mapsUrl: '',
    source: 'Sample data',
    discoveredAt: '2026-09-21T08:30:00.000Z',
    status: 'New',
    score: 82,
    scoreBreakdown: { websiteGap: 25, buyingSignals: 17, businessFit: 18, contactability: 10, serviceRelevance: 12 },
    findings: [],
    opportunity: 'Build a trusted local presence around projects, process and enquiries.',
    recommendedService: 'Launch website',
    priceRange: '₹18k–₹45k',
    evidence: 'Sample record only. Verify every claim.',
    notes: 'Demo lead.',
    doNotContact: true,
  },
  {
    id: 'sample-3',
    name: 'HelioGrid Solar',
    city: 'Hyderabad',
    state: 'Telangana',
    type: 'Solar installer',
    category: 'Solar installers',
    website: '',
    email: '',
    phone: '',
    social: '',
    mapsUrl: '',
    source: 'Sample data',
    discoveredAt: '2026-09-21T09:00:00.000Z',
    status: 'Ready to contact',
    score: 76,
    scoreBreakdown: { websiteGap: 25, buyingSignals: 18, businessFit: 15, contactability: 10, serviceRelevance: 8 },
    findings: [],
    opportunity: 'Create a quote-first landing page with trust, subsidy guidance and site-survey CTA.',
    recommendedService: 'Solar lead-generation landing page',
    priceRange: '₹20k–₹50k',
    evidence: 'Sample record only. Verify every claim.',
    notes: 'Demo lead.',
    doNotContact: true,
  },
  {
    id: 'sample-4',
    name: 'Morrow Home Projects',
    city: 'Mumbai',
    state: 'Maharashtra',
    type: 'Home improvement company',
    category: 'Home services',
    website: 'https://example.com',
    email: '',
    phone: '',
    social: '',
    mapsUrl: '',
    source: 'Sample data',
    discoveredAt: '2026-09-21T09:30:00.000Z',
    status: 'Verified',
    score: 72,
    scoreBreakdown: { websiteGap: 11, buyingSignals: 16, businessFit: 16, contactability: 14, serviceRelevance: 15 },
    findings: sampleFindings.slice(1),
    opportunity: 'Make the service offer, proof and enquiry path impossible to miss.',
    recommendedService: 'Conversion redesign',
    priceRange: '₹25k–₹70k',
    evidence: 'Sample record only. Verify every claim.',
    notes: 'Demo lead.',
    doNotContact: true,
  },
];

const statusOptions: Array<'All' | Status> = [
  'All',
  'New',
  'Needs review',
  'Verified',
  'Ready to contact',
  'Contacted',
  'Replied',
  'Interested',
  'Proposal sent',
  'Won',
  'Lost',
  'Do not contact',
];

const sourceLinks = [
  {
    title: 'Google local search behavior',
    description: 'BrightLocal 2025/2026 research on local discovery, maps, websites and multi-channel research.',
    url: 'https://www.brightlocal.com/research/consumer-search-behavior-channels/',
  },
  {
    title: 'India interior design market',
    description: 'IMARC reports the Indian interior design market at USD 36.9B in 2025.',
    url: 'https://www.imarcgroup.com/interior-design-market-india',
  },
  {
    title: 'India home services',
    description: 'Redseer reports <1% online penetration in FY2025 with 18–22% projected online growth through FY2030.',
    url: 'https://redseer.com/articles/tapping-into-the-everyday-instant-home-services-and-the-next-habit-loop/',
  },
];

function priority(score: number) {
  if (score >= 80) return { label: 'High priority', className: 'priority-high' };
  if (score >= 60) return { label: 'Medium priority', className: 'priority-medium' };
  if (score >= 40) return { label: 'Low priority', className: 'priority-low' };
  return { label: 'Needs verification', className: 'priority-verify' };
}

function statusTone(status: Status) {
  if (['Ready to contact', 'Interested', 'Won'].includes(status)) return 'tone-good';
  if (['Needs review', 'Proposal sent', 'Contacted'].includes(status)) return 'tone-warn';
  if (['Lost', 'Do not contact'].includes(status)) return 'tone-bad';
  return 'tone-neutral';
}

function formatAgo(date: string) {
  const delta = Math.max(0, Date.now() - new Date(date).getTime());
  const mins = Math.round(delta / 60000);
  if (mins < 60) return \`\${mins}m ago\`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return \`\${hours}h ago\`;
  return \`\${Math.round(hours / 24)}d ago\`;
}

function escapeCsv(value: unknown) {
  return \`"\${String(value ?? '').replace(/"/g, '""')}"\`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\\n' || char === '\\r') && !quoted) {
      if (char === '\\r' && text[i + 1] === '\\n') i += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function makeLead(raw: Record<string, string>, index: number): Lead {
  return {
    id: raw.id || \`csv-\${Date.now()}-\${index}\`,
    name: raw.name || raw['business name'] || 'Unnamed business',
    city: raw.city || '',
    state: raw.state || '',
    type: raw.type || raw.category || 'Local business',
    category: raw.category || raw.type || 'Local business',
    website: raw.website || '',
    email: raw.email || '',
    phone: raw.phone || '',
    social: raw.social || raw.instagram || '',
    mapsUrl: raw['maps url'] || raw.mapsUrl || '',
    source: raw.source || 'CSV import',
    discoveredAt: raw.discoveredAt || new Date().toISOString(),
    status: (raw.status as Status) || 'New',
    score: Math.max(0, Math.min(100, Number(raw.score) || 0)),
    scoreBreakdown: {
      websiteGap: Number(raw.websiteGap) || 0,
      buyingSignals: Number(raw.buyingSignals) || 0,
      businessFit: Number(raw.businessFit) || 0,
      contactability: Number(raw.contactability) || 0,
      serviceRelevance: Number(raw.serviceRelevance) || 0,
    },
    findings: [],
    opportunity: raw.opportunity || 'Needs research',
    recommendedService: raw.recommendedService || 'Needs research',
    priceRange: raw.priceRange || 'Set after discovery call',
    evidence: raw.evidence || 'Imported lead; verify before outreach.',
    notes: raw.notes || '',
    doNotContact: /^(true|1|yes)$/i.test(raw.doNotContact || ''),
  };
}

function scoreFromAudit(existing: Lead, audit: AuditResult) {
  const critical = audit.findings.filter((item) => item.severity === 'critical').length;
  const high = audit.findings.filter((item) => item.severity === 'high').length;

  const websiteGap = existing.website ? Math.min(25, Math.max(5, critical * 7 + high * 3)) : 25;
  const buyingSignals = Math.min(25, (audit.metrics?.hasBooking || audit.metrics?.hasOrder ? 4 : 0) + (audit.metrics?.hasCatering ? 7 : 0) + (audit.metrics?.hasMenu ? 6 : 0) + 8);
  const businessFit = 18;
  const contactability = Math.min(15, (existing.phone ? 7 : 0) + (existing.email ? 4 : 0) + (existing.social ? 4 : 0));
  const serviceRelevance = Math.min(15, 8 + Math.min(7, critical + high));
  const total = websiteGap + buyingSignals + businessFit + contactability + serviceRelevance;

  return {
    score: Math.min(100, total),
    scoreBreakdown: { websiteGap, buyingSignals, businessFit, contactability, serviceRelevance },
  };
}

function recommendedOffer(lead: Lead) {
  const text = \`\${lead.category} \${lead.type} \${lead.opportunity}\`.toLowerCase();
  if (text.includes('solar')) return 'Solar lead-generation website';
  if (text.includes('interior') || text.includes('renovation') || text.includes('design')) return 'Portfolio + enquiry website';
  if (text.includes('clinic')) return 'Trust + booking website';
  if (text.includes('restaurant') || text.includes('cafe')) return 'Menu + booking/order website';
  return 'Conversion-focused business website';
}

function problemSolution(finding: Finding | undefined) {
  if (!finding) {
    return {
      title: 'Start with evidence',
      body: 'Run an audit or research pass before pitching. The strongest outreach is built around one real, fixable friction point.',
    };
  }

  return {
    title: finding.title,
    body: finding.fix,
  };
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [ready, setReady] = useState(false);
  const [storageMode, setStorageMode] = useState<'database' | 'local'>('local');
  const [syncing, setSyncing] = useState(false);
  const [dataError, setDataError] = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'leads' | 'audits' | 'outreach' | 'sources'>('dashboard');
  const [activeNiche, setActiveNiche] = useState('interior');
  const [city, setCity] = useState('Bengaluru');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryCity, setDiscoveryCity] = useState('Bengaluru');
  const [discoveryQuery, setDiscoveryQuery] = useState('interior designers and renovation companies');
  const [discoveryResults, setDiscoveryResults] = useState<Lead[]>([]);
  const [discoveryProvider, setDiscoveryProvider] = useState<'auto' | 'google' | 'osm'>('auto');
  const [discoveryMessage, setDiscoveryMessage] = useState('');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [auditUrl, setAuditUrl] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditMessage, setAuditMessage] = useState('');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [outreachChannel, setOutreachChannel] = useState('instagram');
  const [outreachText, setOutreachText] = useState('');
  const [outreachMode, setOutreachMode] = useState('');
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [researchText, setResearchText] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchMode, setResearchMode] = useState('');
  const [todayLabel, setTodayLabel] = useState('');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const niche = nicheOptions.find((item) => item.id === activeNiche) ?? nicheOptions[0];

  useEffect(() => {
    setTodayLabel(new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()));

    try {
      const savedNiche = window.localStorage.getItem(ACTIVE_NICHE_KEY);
      if (savedNiche && nicheOptions.some((item) => item.id === savedNiche)) {
        setActiveNiche(savedNiche);
        const saved = nicheOptions.find((item) => item.id === savedNiche);
        if (saved) setDiscoveryQuery(saved.query);
      }
    } catch {
      // Ignore unavailable storage.
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/leads?limit=500', { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled && response.ok && data.configured && Array.isArray(data.leads)) {
          setLeads(data.leads as Lead[]);
          setStorageMode('database');
          setReady(true);
          return;
        }
      } catch {
        // Fall back to local browser storage when PostgreSQL is not configured.
      }

      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setLeads(Array.isArray(parsed) ? parsed : (demoMode ? sampleLeads : []));
        } else {
          setLeads(demoMode ? sampleLeads : []);
        }
      } catch {
        setDataError('Saved lead data was invalid. The workspace was reset to an empty live-data state.');
        setLeads(demoMode ? sampleLeads : []);
      } finally {
        if (!cancelled) {
          setStorageMode('local');
          setReady(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);;

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(ACTIVE_NICHE_KEY, activeNiche);
      if (storageMode === 'local') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
      }
    } catch {
      setDataError('Your browser blocked local storage. Export your leads before closing this tab.');
    }
  }, [leads, activeNiche, ready, storageMode]);;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return leads
      .filter((lead) => statusFilter === 'All' || lead.status === statusFilter)
      .filter((lead) => {
        if (!normalized) return true;
        return \`\${lead.name} \${lead.city} \${lead.state} \${lead.category} \${lead.type} \${lead.opportunity}\`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => b.score - a.score);
  }, [leads, query, statusFilter]);

  const todayQueue = useMemo(
    () => leads
      .filter((lead) => !lead.doNotContact && !['Won', 'Lost', 'Do not contact'].includes(lead.status))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
    [leads],
  );

  const stats = {
    total: leads.length,
    high: leads.filter((lead) => lead.score >= 80 && !lead.doNotContact).length,
    verify: leads.filter((lead) => lead.status === 'Needs review').length,
    contact: leads.filter((lead) => ['Ready to contact', 'Contacted', 'Replied', 'Interested'].includes(lead.status)).length,
    won: leads.filter((lead) => lead.status === 'Won').length,
    pipeline: leads.filter((lead) => ['Interested', 'Proposal sent'].includes(lead.status)).length,
  };

  function apiStatus(status?: Status) {
    if (!status) return undefined;
    const map: Record<string, string> = {
      'New': 'New',
      'Researched': 'Researched',
      'Needs review': 'NeedsReview',
      'Verified': 'Verified',
      'Ready to contact': 'ReadyToContact',
      'Contacted': 'Contacted',
      'Replied': 'Replied',
      'Interested': 'Interested',
      'Meeting booked': 'MeetingBooked',
      'Proposal sent': 'ProposalSent',
      'Won': 'Won',
      'Lost': 'Lost',
      'Do not contact': 'DoNotContact',
    };
    return map[status];
  }

  function syncLead(id: string, patch: Partial<Lead>) {
    if (storageMode !== 'database') return;
    const body: Record<string, unknown> = {};

    for (const key of ['score', 'scoreBreakdown', 'findings', 'opportunity', 'recommendedService', 'notes', 'doNotContact', 'website', 'phone', 'mapsUrl']) {
      if ((patch as any)[key] !== undefined) body[key] = (patch as any)[key];
    }
    if (patch.status) body.status = apiStatus(patch.status);
    if (patch.outreach) {
      body.outreach = {
        channel: patch.outreach.channel,
        draft: patch.outreach.draft,
        generatedBy: 'startup-street',
        approved: patch.outreach.approved,
      };
    }

    setSyncing(true);
    void fetch('/api/leads/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || 'Database sync failed.');
        }
      })
      .catch((error) => {
        setDataError(error instanceof Error ? error.message : 'Database sync failed.');
      })
      .finally(() => setSyncing(false));
  }

  function updateLead(id: string, patch: Partial<Lead>) {
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)));
    setSelected((current) => current && current.id === id ? { ...current, ...patch } : current);
    syncLead(id, patch);
  }

  function chooseNiche(id: string) {
    setActiveNiche(id);
    const chosen = nicheOptions.find((item) => item.id === id);
    if (chosen) {
      setDiscoveryQuery(chosen.query);
      setDiscoveryMessage('');
    }
  }

  function addLead(lead: Lead) {
    setLeads((current) => {
      const duplicate = current.some((item) => item.name.toLowerCase() === lead.name.toLowerCase() && item.city.toLowerCase() === lead.city.toLowerCase());
      if (duplicate) return current;
      return [lead, ...current];
    });
  }

  function addManualLead() {
    const lead: Lead = {
      id: \`manual-\${Date.now()}\`,
      name: 'New prospect',
      city,
      state: '',
      type: niche.label,
      category: niche.label,
      website: '',
      email: '',
      phone: '',
      social: '',
      mapsUrl: '',
      source: 'Manual entry',
      discoveredAt: new Date().toISOString(),
      status: 'New',
      score: 0,
      scoreBreakdown: { websiteGap: 0, buyingSignals: 0, businessFit: 0, contactability: 0, serviceRelevance: 0 },
      findings: [],
      opportunity: 'Needs research',
      recommendedService: 'Needs research',
      priceRange: 'Set after discovery call',
      evidence: 'Add verified evidence before outreach.',
      notes: '',
      doNotContact: false,
    };
    addLead(lead);
    setSelected(lead);
  }

  function importCsv(file: File) {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ''));
        if (rows.length < 2) throw new Error('CSV needs a header row and at least one lead.');
        const headers = rows[0].map((item) => item.toLowerCase().trim());
        const imported = rows.slice(1).map((row, index) => {
          const raw = Object.fromEntries(headers.map((header, column) => [header, row[column] || ''])) as Record<string, string>;
          return makeLead(raw, index);
        });
        setLeads((current) => {
          const keys = new Set(current.map((lead) => \`\${lead.name.toLowerCase()}|\${lead.city.toLowerCase()}\`));
          return [...imported.filter((lead) => !keys.has(\`\${lead.name.toLowerCase()}|\${lead.city.toLowerCase()}\`)), ...current];
        });
        setDataError(\`\${imported.length} rows imported.\`);
      } catch (error) {
        setDataError(error instanceof Error ? error.message : 'Could not read that CSV.');
      } finally {
        setImporting(false);
      }
    };
    reader.onerror = () => {
      setImporting(false);
      setDataError('The CSV file could not be read.');
    };
    reader.readAsText(file);
  }

  function exportCsv() {
    const headers = ['id', 'name', 'city', 'state', 'type', 'category', 'website', 'email', 'phone', 'social', 'mapsUrl', 'source', 'discoveredAt', 'status', 'score', 'websiteGap', 'buyingSignals', 'businessFit', 'contactability', 'serviceRelevance', 'opportunity', 'recommendedService', 'priceRange', 'evidence', 'notes', 'doNotContact'];
    const lines = [
      headers.join(','),
      ...leads.map((lead) => [
        lead.id,
        lead.name,
        lead.city,
        lead.state,
        lead.type,
        lead.category,
        lead.website,
        lead.email,
        lead.phone,
        lead.social,
        lead.mapsUrl,
        lead.source,
        lead.discoveredAt,
        lead.status,
        lead.score,
        lead.scoreBreakdown.websiteGap,
        lead.scoreBreakdown.buyingSignals,
        lead.scoreBreakdown.businessFit,
        lead.scoreBreakdown.contactability,
        lead.scoreBreakdown.serviceRelevance,
        lead.opportunity,
        lead.recommendedService,
        lead.priceRange,
        lead.evidence,
        lead.notes,
        lead.doNotContact,
      ].map(escapeCsv).join(',')),
    ];
    const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'startup-street-leads.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function runDiscovery() {
    setDiscoverLoading(true);
    setDiscoveryMessage('');
    setDiscoveryResults([]);

    try {
      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: discoveryQuery, city: discoveryCity, pageSize: 20, provider: discoveryProvider }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Discovery failed.');

      const results = Array.isArray(data.leads) ? data.leads as Lead[] : [];
      setDiscoveryResults(results);
      setDiscoveryMessage(results.length ? \`\${results.length} public business records found. Audit before outreach.\` : 'No results returned.');
    } catch (error) {
      setDiscoveryMessage(error instanceof Error ? error.message : 'Discovery failed.');
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function runAudit(targetLead?: Lead) {
    const url = targetLead?.website || auditUrl;
    if (!url) {
      setAuditMessage('Add a public website URL first.');
      return;
    }

    setAuditLoading(true);
    setAuditMessage('');
    setAuditResult(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Audit failed.');
      setAuditResult(data);
      setAuditUrl(data.finalUrl || data.url || url);

      if (targetLead) {
        const scoring = scoreFromAudit(targetLead, data);
        const strongest = data.findings.find((item: Finding) => item.severity === 'critical' || item.severity === 'high');
        const patch: Partial<Lead> = {
          findings: data.findings,
          score: scoring.score,
          scoreBreakdown: scoring.scoreBreakdown,
          evidence: strongest?.problem || 'Audit completed. Review the findings before outreach.',
          opportunity: strongest?.fix || recommendedOffer(targetLead),
          recommendedService: recommendedOffer(targetLead),
          status: targetLead.status === 'New' ? 'Needs review' : targetLead.status,
        };
        updateLead(targetLead.id, patch);
      }
    } catch (error) {
      setAuditMessage(error instanceof Error ? error.message : 'Audit failed.');
    } finally {
      setAuditLoading(false);
    }
  }

  async function runResearch() {
    if (!selected || selected.doNotContact) return;
    setResearchLoading(true);
    setResearchText('');
    setResearchMode('');
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Research failed.');
      setResearchText(data.text || 'No research output returned.');
      setResearchMode(data.mode === 'web-search' ? 'Live web research' : 'Research');
    } catch (error) {
      setResearchMode(error instanceof Error ? error.message : 'Research failed.');
    } finally {
      setResearchLoading(false);
    }
  }

  async function generateOutreach() {
    if (!selected || selected.doNotContact) return;
    setOutreachLoading(true);
    setOutreachMode('');

    try {
      const response = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: selected, channel: outreachChannel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Outreach generation failed.');
      setOutreachText(data.message || '');
      setOutreachMode(data.mode === 'ai' ? \`AI · \${data.model}\` : 'Verified finding template');
    } catch (error) {
      setOutreachText('');
      setOutreachMode(error instanceof Error ? error.message : 'Outreach generation failed.');
    } finally {
      setOutreachLoading(false);
    }
  }

  function saveOutreach() {
    if (!selected || !outreachText.trim()) return;
    updateLead(selected.id, {
      status: selected.status === 'New' || selected.status === 'Needs review' ? 'Ready to contact' : selected.status,
      outreach: {
        channel: outreachChannel,
        draft: outreachText.trim(),
        generatedAt: new Date().toISOString(),
        approved: false,
      },
    });
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setDataError('Copied to clipboard.');
    } catch {
      setDataError('Clipboard permission was blocked by the browser.');
    }
  }

  function deleteSelected() {
    if (!selected) return;
    const deletedId = selected.id;
    setLeads((current) => current.filter((lead) => lead.id !== deletedId));
    if (storageMode === 'database') {
      void fetch('/api/leads/' + encodeURIComponent(deletedId), { method: 'DELETE' })
        .catch(() => setDataError('Lead removed locally, but database deletion failed.'));
    }
    setSelected(null);
  }

  const bestProblem = selected?.findings.find((item) => item.severity === 'critical' || item.severity === 'high');

  return (
    <main className="app-shell">
      <aside className={\`sidebar \${mobileSidebar ? 'sidebar-open' : ''}\`}>
        <div className="brand-row">
          <div className="brand-mark"><Radar size={19} /></div>
          <div>
            <div className="brand-name">Startup Street</div>
            <div className="brand-sub">Revenue intelligence</div>
          </div>
          <button className="mobile-close" onClick={() => setMobileSidebar(false)}><PanelLeftClose size={18} /></button>
        </div>

        <div className="niche-card">
          <div className="niche-kicker"><span className="live-dot" /> CURRENT WEDGE</div>
          <strong>{niche.label}</strong>
          <span>{niche.short}</span>
          <select value={activeNiche} onChange={(event) => chooseNiche(event.target.value)}>
            {nicheOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        <nav className="nav-stack">
          {[
            ['dashboard', 'Command center', BarChart3],
            ['leads', 'Lead radar', Target],
            ['audits', 'Website audits', FileSearch],
            ['outreach', 'Outreach queue', Send],
            ['sources', 'Sources & setup', Settings2],
          ].map(([view, label, Icon]) => (
            <button
              key={String(view)}
              className={activeView === view ? 'nav-item nav-active' : 'nav-item'}
              onClick={() => { setActiveView(view as typeof activeView); setMobileSidebar(false); }}
            >
              <Icon size={17} />
              <span>{String(label)}</span>
              {view === 'leads' && <em>{leads.length}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="mini-stat">
            <span>Today's target</span>
            <strong>10 conversations</strong>
            <div className="mini-track"><i style={{ width: \`\${Math.min(100, (stats.contact / 10) * 100)}%\` }} /></div>
            <small>{Math.min(10, stats.contact)} / 10 active leads</small>
          </div>
          <div className="privacy-note"><ShieldCheck size={14} /> Evidence-first. Human-approved.</div>
        </div>
      </aside>

      {mobileSidebar && <button className="mobile-backdrop" aria-label="Close sidebar" onClick={() => setMobileSidebar(false)} />}

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileSidebar(true)}><PanelLeftClose size={18} /></button>
            <div>
              <div className="top-eyebrow">{todayLabel || 'Revenue workspace'}</div>
              <div className="top-title">{activeView === 'dashboard' ? 'Who should you contact today?' : niche.label}</div>
            </div>
          </div>
          <div className="top-actions">
            <div className="location-chip"><MapPin size={14} /><input value={city} onChange={(event) => setCity(event.target.value)} /></div>
            <button className="ghost-btn" onClick={() => fileRef.current?.click()} disabled={importing}><Upload size={15} /> {importing ? 'Importing…' : 'Import'}</button>
            <button className="ghost-btn" onClick={exportCsv}><Download size={15} /> Export</button>
            <button className="primary-btn" onClick={() => setDiscoveryOpen(true)}><Zap size={15} /> Find leads</button>
            <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) importCsv(file); event.currentTarget.value = ''; }} />
          </div>
        </header>

        {dataError && (
          <div className="toast">
            <span>{dataError}</span>
            <button onClick={() => setDataError('')}><X size={14} /></button>
          </div>
        )}

        {activeView === 'dashboard' && (
          <div className="page-stack">
            <section className="hero-card">
              <div className="hero-copy">
                <div className="hero-label"><Sparkles size={14} /> THE ACQUISITION LOOP</div>
                <h1>Find the business.<br /><em>Prove the gap.</em><br />Sell the fix.</h1>
                <p>Startup Street turns public business signals into an evidence-backed shortlist, then gives you a specific problem, offer and first message.</p>
                <div className="hero-buttons">
                  <button className="primary-btn large" onClick={() => setDiscoveryOpen(true)}><Radar size={17} /> Scan {city}</button>
                  <button className="outline-btn large" onClick={() => { setActiveView('audits'); setAuditUrl(''); }}>Audit a website</button>
                </div>
                <div className="hero-proof">
                  <span><CheckCircle2 size={14} /> No fake lead data</span>
                  <span><CheckCircle2 size={14} /> Verify before outreach</span>
                  <span><CheckCircle2 size={14} /> Human approval required</span>
                </div>
              </div>
              <div className="hero-orbit">
                <div className="orbit-ring ring-one" />
                <div className="orbit-ring ring-two" />
                <div className="radar-core"><Target size={30} /><span>LEAD<br />RADAR</span></div>
                <div className="orbit-node node-a"><span>01</span><b>DISCOVER</b></div>
                <div className="orbit-node node-b"><span>02</span><b>AUDIT</b></div>
                <div className="orbit-node node-c"><span>03</span><b>CONVERT</b></div>
              </div>
            </section>

            <section className="stat-grid">
              <Metric label="Leads in workspace" value={String(stats.total)} note="Persistent in this browser" icon={Target} />
              <Metric label="High priority" value={String(stats.high)} note="80+ opportunity score" icon={Zap} accent />
              <Metric label="Needs verification" value={String(stats.verify)} note="Manual review queue" icon={AlertTriangle} />
              <Metric label="Active conversations" value={String(stats.contact)} note="Contacted → interested" icon={MessageSquare} />
              <Metric label="Pipeline" value={String(stats.pipeline)} note="Interested or proposal" icon={CircleDollarSign} />
            </section>

            <section className="split-grid">
              <div className="surface">
                <div className="section-head">
                  <div>
                    <span className="section-kicker">ACTION QUEUE</span>
                    <h2>Who should you contact today?</h2>
                    <p>Highest evidence-backed opportunities first.</p>
                  </div>
                  <button className="text-btn" onClick={() => setActiveView('leads')}>View all <ChevronRight size={14} /></button>
                </div>

                <div className="queue-list">
                  {todayQueue.length === 0 && <EmptyState title="No ready leads yet" body="Import or discover a few businesses and run audits to build the queue." />}
                  {todayQueue.map((lead, index) => {
                    const p = priority(lead.score);
                    const finding = lead.findings.find((item) => item.severity === 'critical' || item.severity === 'high');
                    return (
                      <button className="queue-row" key={lead.id} onClick={() => setSelected(lead)}>
                        <div className="queue-number">0{index + 1}</div>
                        <div className="queue-main">
                          <div className="queue-title"><strong>{lead.name}</strong><span>{lead.city}</span></div>
                          <div className="queue-detail">{finding?.title || lead.opportunity}</div>
                          <div className="queue-tags">
                            <span className={\`priority-pill \${p.className}\`}>{p.label}</span>
                            <span>{lead.recommendedService || recommendedOffer(lead)}</span>
                          </div>
                        </div>
                        <div className="queue-score"><strong>{lead.score}</strong><small>/100</small></div>
                        <ChevronRight size={16} className="muted-icon" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="surface strategy-panel">
                <div className="section-head">
                  <div>
                    <span className="section-kicker">NICHE INTELLIGENCE</span>
                    <h2>{niche.label}</h2>
                    <p>{niche.description}</p>
                  </div>
                </div>

                <div className="wedge-callout">
                  <div className="wedge-icon"><Sparkles size={16} /></div>
                  <div>
                    <strong>Why this wedge</strong>
                    <p>Visual proof + high-value enquiries make website quality easier to connect to an actual business conversation.</p>
                  </div>
                </div>

                <div className="signal-list">
                  <Signal title="Local discovery matters" body="Google remains a major starting point for local research, while consumers increasingly use multiple channels." />
                  <Signal title="Website is a verification layer" body="A strong review or social presence often sends people back to the business site for more information." />
                  <Signal title="Pitch the friction, not the page count" body="Lead with one verified problem, then show the smallest useful fix." />
                </div>

                <div className="source-strip">
                  <Globe size={14} />
                  <span>Research-backed strategy</span>
                  <button onClick={() => setActiveView('sources')}>View sources <ChevronRight size={13} /></button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeView === 'leads' && (
          <div className="page-stack">
            <section className="page-intro">
              <div>
                <span className="section-kicker">LEAD RADAR</span>
                <h1>Every lead needs a reason.</h1>
                <p>Filter by fit, evidence and buying signal — not by how pretty the spreadsheet looks.</p>
              </div>
              <div className="intro-actions">
                <button className="outline-btn" onClick={addManualLead}><Plus size={15} /> Manual lead</button>
                <button className="primary-btn" onClick={() => setDiscoveryOpen(true)}><Radar size={15} /> Discover</button>
              </div>
            </section>

            <section className="surface">
              <div className="table-toolbar">
                <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search business, city, category…" /></div>
                <div className="filter-row">
                  <SlidersHorizontal size={14} />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                    {statusOptions.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
              </div>
              <div className="lead-table-wrap">
                <table className="lead-table">
                  <thead><tr><th>Business</th><th>Signal</th><th>Score</th><th>Status</th><th>Source</th><th /></tr></thead>
                  <tbody>
                    {filtered.map((lead) => {
                      const p = priority(lead.score);
                      const finding = lead.findings.find((item) => item.severity === 'critical' || item.severity === 'high');
                      return (
                        <tr key={lead.id} onClick={() => setSelected(lead)}>
                          <td>
                            <div className="lead-business">
                              <div className="avatar-block">{lead.name.slice(0, 1).toUpperCase()}</div>
                              <div><strong>{lead.name}</strong><span>{lead.city}{lead.state ? \`, \${lead.state}\` : ''} · {lead.type}</span></div>
                            </div>
                          </td>
                          <td><div className="table-signal"><strong>{finding?.title || lead.opportunity}</strong><span>{lead.evidence}</span></div></td>
                          <td><ScoreBadge score={lead.score} /></td>
                          <td><span className={\`status-pill \${statusTone(lead.status)}\`}><i />{lead.status}</span></td>
                          <td><span className="source-chip">{lead.source}</span></td>
                          <td><ChevronRight size={15} className="muted-icon" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && <EmptyState title="No leads match that filter" body="Change the search or import a fresh batch." />}
            </section>
          </div>
        )}

        {activeView === 'audits' && (
          <div className="page-stack">
            <section className="page-intro">
              <div>
                <span className="section-kicker">WEBSITE AUDIT</span>
                <h1>Find a problem you can actually fix.</h1>
                <p>Static checks are evidence. Visual quality and true performance need a browser provider later.</p>
              </div>
            </section>
            <section className="audit-workspace">
              <div className="surface audit-input-card">
                <div className="audit-orb"><FileSearch size={22} /></div>
                <h2>Audit a public website</h2>
                <p>Checks mobile viewport signals, CTA presence, menus, map/contact paths, basic content and lightweight internal-link health.</p>
                <div className="audit-form">
                  <input value={auditUrl} onChange={(event) => setAuditUrl(event.target.value)} placeholder="https://business.com" />
                  <button className="primary-btn" onClick={() => runAudit()} disabled={auditLoading}>{auditLoading ? <><RefreshCw size={15} className="spin" /> Auditing</> : <><FileSearch size={15} /> Run audit</>}</button>
                </div>
                {auditMessage && <div className="inline-message">{auditMessage}</div>}
                <div className="audit-disclaimer"><ShieldCheck size={14} /> Claims are only scored when the audit returns evidence.</div>
              </div>

              <div className="surface audit-result-card">
                {!auditResult ? (
                  <EmptyState title="No audit yet" body="Paste a business website above or open a lead and run its audit from the lead drawer." />
                ) : (
                  <>
                    <div className="audit-result-head">
                      <div>
                        <span className="section-kicker">AUDIT RESULT</span>
                        <h2>{auditResult.title || auditResult.finalUrl}</h2>
                        <p>{auditResult.finalUrl} · {auditResult.responseMs ?? '—'}ms</p>
                      </div>
                      <ScoreBadge score={auditResult.score} label="Site score" />
                    </div>
                    <div className="finding-grid">
                      {auditResult.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {activeView === 'outreach' && (
          <div className="page-stack">
            <section className="page-intro">
              <div>
                <span className="section-kicker">OUTREACH QUEUE</span>
                <h1>Every message starts from evidence.</h1>
                <p>Generate, edit, approve and track. Never blast an unverified complaint.</p>
              </div>
            </section>
            <section className="outreach-grid">
              <div className="surface">
                <div className="section-head">
                  <div><span className="section-kicker">READY</span><h2>Leads with something to say</h2></div>
                  <span className="count-badge">{leads.filter((lead) => lead.findings.length > 0 && !lead.doNotContact).length}</span>
                </div>
                <div className="mini-lead-list">
                  {leads.filter((lead) => lead.findings.length > 0 && !lead.doNotContact).sort((a,b) => b.score-a.score).slice(0,10).map((lead) => (
                    <button key={lead.id} className="mini-lead" onClick={() => setSelected(lead)}>
                      <div className="mini-avatar">{lead.name.slice(0, 1)}</div>
                      <div><strong>{lead.name}</strong><span>{lead.findings[0]?.title || lead.opportunity}</span></div>
                      <ScoreBadge score={lead.score} compact />
                    </button>
                  ))}
                  {leads.filter((lead) => lead.findings.length > 0 && !lead.doNotContact).length === 0 && <EmptyState title="No audited leads" body="Run a few audits first. Your outreach queue will populate automatically." />}
                </div>
              </div>
              <div className="surface">
                <div className="section-head"><div><span className="section-kicker">RULE</span><h2>Sell the fix, not the redesign.</h2><p>One verified issue. One relevant service. One low-pressure next step.</p></div></div>
                <div className="pitch-framework">
                  <div><span>01</span><strong>Observation</strong><p>Show exactly what you found.</p></div>
                  <div><span>02</span><strong>Consequence</strong><p>Explain the friction in plain language.</p></div>
                  <div><span>03</span><strong>Fix</strong><p>Offer a small, concrete improvement.</p></div>
                  <div><span>04</span><strong>CTA</strong><p>Ask for permission to show the idea.</p></div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeView === 'sources' && (
          <div className="page-stack">
            <section className="page-intro">
              <div>
                <span className="section-kicker">SOURCES & SETUP</span>
                <h1>Use the internet. Verify the lead.</h1>
                <p>Discovery can be live when provider keys are configured. Until then, CSV import keeps the workflow honest.</p>
              </div>
            </section>
            <section className="split-grid">
              <div className="surface">
                <div className="section-head"><div><span className="section-kicker">RESEARCH</span><h2>Why this niche strategy</h2><p>Current external research informing the initial wedge.</p></div></div>
                <div className="source-cards">
                  {sourceLinks.map((source) => (
                    <a className="source-card" key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      <div className="source-card-icon"><Link2 size={15} /></div>
                      <div><strong>{source.title}</strong><p>{source.description}</p></div>
                      <ExternalLink size={15} />
                    </a>
                  ))}
                </div>
              </div>
              <div className="surface setup-panel">
                <div className="section-head"><div><span className="section-kicker">INTEGRATIONS</span><h2>Connect the real sources</h2><p>Keys stay on the server.</p></div></div>
                <SetupRow name="Google Places API (New)" detail="Live local business discovery" state={process.env.NEXT_PUBLIC_GOOGLE_PLACE_STATUS || 'Not configured'} />
                <SetupRow name="AI personalization" detail="OpenAI Responses API" state="Optional" />
                <SetupRow name="Browser visual audit" detail="Lighthouse / screenshot provider" state="Planned" />
                <div className="setup-note"><ShieldCheck size={15} /><span>Never paste API keys into lead records or the browser.</span></div>
              </div>
            </section>
          </div>
        )}
      </section>

      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <aside className="lead-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-top">
              <div>
                <span className="section-kicker">LEAD INTELLIGENCE</span>
                <h2>{selected.name}</h2>
                <p><MapPin size={13} /> {selected.city || 'City missing'}{selected.state ? \`, \${selected.state}\` : ''} · {selected.type}</p>
              </div>
              <button className="circle-btn" onClick={() => setSelected(null)}><X size={16} /></button>
            </div>

            <div className="drawer-score-card">
              <div><span>Opportunity score</span><strong>{selected.score}<small>/100</small></strong></div>
              <div className={\`priority-pill \${priority(selected.score).className}\`}>{priority(selected.score).label}</div>
            </div>

            <div className="drawer-block">
              <div className="drawer-block-head"><span className="section-kicker">BUSINESS</span><span className="source-chip">{selected.source}</span></div>
              <div className="contact-grid">
                <InfoCell icon={Globe} label="Website" value={selected.website || 'Not found'} href={selected.website} />
                <InfoCell icon={MapPin} label="Maps" value={selected.mapsUrl ? 'Open listing' : 'Not found'} href={selected.mapsUrl} />
                <InfoCell icon={MessageSquare} label="Social" value={selected.social || 'Not captured'} href={selected.social} />
                <InfoCell icon={Send} label="Phone / email" value={selected.phone || selected.email || 'Not captured'} />
              </div>
            </div>

            <div className="drawer-block">
              <div className="drawer-block-head"><span className="section-kicker">WHAT THEY MAY BE LOSING</span><button className="text-btn" onClick={() => { setActiveView('audits'); setAuditUrl(selected.website); setSelected(null); }}>Open audit <ChevronRight size={13} /></button></div>
              {selected.findings.length === 0 ? (
                <div className="empty-inline"><AlertTriangle size={15} /><span>No verified findings yet. Run the audit before contacting them.</span></div>
              ) : (
                <div className="finding-stack">{selected.findings.map((finding) => <FindingCard key={finding.id} finding={finding} compact />)}</div>
              )}
            </div>

            <div className="drawer-block">
              <div className="drawer-block-head"><span className="section-kicker">THE FIX</span></div>
              <div className="solution-card">
                <div className="solution-icon"><Zap size={16} /></div>
                <div>
                  <strong>{selected.recommendedService || recommendedOffer(selected)}</strong>
                  <p>{problemSolution(bestProblem).body}</p>
                  <span>Suggested range: {selected.priceRange}</span>
                </div>
              </div>
            </div>

            {researchText && (
              <div className="drawer-block">
                <div className="drawer-block-head"><span className="section-kicker">LIVE WEB RESEARCH</span><span className="source-chip">{researchMode}</span></div>
                <div className="research-card"><Sparkles size={14} /><pre>{researchText}</pre></div>
              </div>
            )}

            <div className="drawer-block">
              <div className="drawer-block-head"><span className="section-kicker">SCORE BREAKDOWN</span></div>
              <ScoreBars breakdown={selected.scoreBreakdown} />
            </div>

            <div className="drawer-block">
              <div className="drawer-block-head"><span className="section-kicker">NEXT ACTION</span></div>
              <div className="next-action-card">
                <strong>{selected.findings.length ? 'Generate a message around the strongest verified issue.' : 'Verify the business before writing a message.'}</strong>
                <p>{bestProblem?.problem || selected.evidence}</p>
                <div className="action-row">
                  {selected.website && <button className="outline-btn small" onClick={() => runAudit(selected)} disabled={auditLoading}><FileSearch size={14} /> {auditLoading ? 'Auditing' : 'Audit site'}</button>}
                  {!selected.doNotContact && <button className="outline-btn small" onClick={runResearch} disabled={researchLoading}><Globe size={14} /> {researchLoading ? 'Researching' : 'Deep research'}</button>}
                  {!selected.doNotContact && <button className="primary-btn small" onClick={() => document.getElementById('outreach-box')?.scrollIntoView({ behavior: 'smooth' })}><Send size={14} /> Draft outreach</button>}
                </div>
              </div>
            </div>

            <div id="outreach-box" className="drawer-block">
              <div className="drawer-block-head"><span className="section-kicker">OUTREACH</span>{outreachMode && <span className="source-chip">{outreachMode}</span>}</div>
              {selected.doNotContact ? (
                <div className="do-not-contact"><ShieldCheck size={16} /><div><strong>Do not contact</strong><p>This lead is sample data or has been manually suppressed.</p></div></div>
              ) : (
                <>
                  <div className="channel-tabs">
                    {['instagram', 'whatsapp', 'email'].map((channel) => <button key={channel} className={outreachChannel === channel ? 'channel-active' : ''} onClick={() => setOutreachChannel(channel)}>{channel}</button>)}
                  </div>
                  <textarea value={outreachText} onChange={(event) => setOutreachText(event.target.value)} placeholder="Generate a concise evidence-based draft…" />
                  <div className="action-row">
                    <button className="outline-btn small" onClick={generateOutreach} disabled={outreachLoading}><Sparkles size={14} /> {outreachLoading ? 'Generating' : 'Generate'}</button>
                    <button className="ghost-btn small" onClick={() => copyToClipboard(outreachText)} disabled={!outreachText}><Copy size={14} /> Copy</button>
                    <button className="primary-btn small" onClick={saveOutreach} disabled={!outreachText}>Save draft</button>
                  </div>
                </>
              )}
            </div>

            <div className="drawer-block">
              <div className="drawer-block-head"><span className="section-kicker">PIPELINE</span></div>
              <select className="status-select" value={selected.status} onChange={(event) => updateLead(selected.id, { status: event.target.value as Status })}>
                {statusOptions.slice(1).map((item) => <option key={item}>{item}</option>)}
              </select>
              <textarea className="notes-box" value={selected.notes} onChange={(event) => updateLead(selected.id, { notes: event.target.value })} placeholder="Sales notes, objections, follow-up date…" />
            </div>

            <div className="drawer-footer">
              <button className="danger-btn" onClick={deleteSelected}><Trash2 size={14} /> Delete</button>
              <button className="primary-btn" onClick={() => updateLead(selected.id, { doNotContact: true, status: 'Do not contact' })}><ShieldCheck size={14} /> Suppress lead</button>
            </div>
          </aside>
        </div>
      )}

      {discoveryOpen && (
        <div className="modal-overlay" onClick={() => setDiscoveryOpen(false)}>
          <div className="discovery-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><span className="section-kicker">LIVE DISCOVERY</span><h2>Find businesses worth researching.</h2><p>Uses Google Places when configured. Results are candidates, not automatic outreach targets.</p></div>
              <button className="circle-btn" onClick={() => setDiscoveryOpen(false)}><X size={16} /></button>
            </div>

            <div className="discovery-controls">
              <label>Search intent<input value={discoveryQuery} onChange={(event) => setDiscoveryQuery(event.target.value)} /></label>
              <label>City<input value={discoveryCity} onChange={(event) => setDiscoveryCity(event.target.value)} /></label>
              <label>Provider
                <select value={discoveryProvider} onChange={(event) => setDiscoveryProvider(event.target.value as 'auto' | 'google' | 'osm')}>
                  <option value="auto">Auto (Google → OSM)</option>
                  <option value="google">Google Places</option>
                  <option value="osm">OpenStreetMap</option>
                </select>
              </label>
              <button className="primary-btn" onClick={runDiscovery} disabled={discoverLoading}><Radar size={15} /> {discoverLoading ? 'Searching' : 'Search public businesses'}</button>
            </div>

            {discoveryMessage && <div className="inline-message"><Activity size={14} /> {discoveryMessage}</div>}

            <div className="discovery-list">
              {discoveryResults.map((lead) => {
                const already = leads.some((item) => item.name.toLowerCase() === lead.name.toLowerCase() && item.city.toLowerCase() === lead.city.toLowerCase());
                return (
                  <div className="discovery-result" key={lead.id}>
                    <div className="discovery-logo">{lead.name.slice(0,1)}</div>
                    <div className="discovery-main">
                      <strong>{lead.name}</strong>
                      <span>{lead.city} · {lead.type}</span>
                      <p>{lead.website ? 'Website found — audit before pitching.' : 'No website URI returned — high-priority website gap candidate.'}</p>
                    </div>
                    <ScoreBadge score={lead.score} compact />
                    <button className="outline-btn small" disabled={already} onClick={() => { addLead({ ...lead, doNotContact: false }); setSelected(lead); }}>{already ? 'Added' : 'Add'}</button>
                  </div>
                );
              })}
              {!discoveryResults.length && !discoverLoading && <EmptyState title="No live results yet" body="Search for a niche + city, or configure Google Places API in the server environment." />}
            </div>

            <div className="modal-footer"><ShieldCheck size={14} /> Source data is used for discovery only. Verify the business and website before outreach.</div>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, note, icon: Icon, accent }: { label: string; value: string; note: string; icon: typeof Target; accent?: boolean }) {
  return (
    <div className={accent ? 'metric-card metric-accent' : 'metric-card'}>
      <div className="metric-icon"><Icon size={15} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Signal({ title, body }: { title: string; body: string }) {
  return <div className="signal-row"><span className="signal-dot" /><div><strong>{title}</strong><p>{body}</p></div></div>;
}

function ScoreBadge({ score, compact, label = 'Score' }: { score: number; compact?: boolean; label?: string }) {
  const p = priority(score);
  return <div className={compact ? 'score-badge compact' : 'score-badge'}><strong>{score}</strong>{!compact && <span>{label}</span>}<i className={p.className} /></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><div className="empty-icon"><Target size={17} /></div><strong>{title}</strong><p>{body}</p></div>;
}

function FindingCard({ finding, compact }: { finding: Finding; compact?: boolean }) {
  const color = finding.severity === 'critical' ? 'finding-critical' : finding.severity === 'high' ? 'finding-high' : finding.severity === 'medium' ? 'finding-medium' : 'finding-low';
  return (
    <div className={compact ? 'finding-card compact' : 'finding-card'}>
      <div className="finding-top"><span className={\`severity-pill \${color}\`}>{finding.severity}</span><span>{finding.confidence} confidence</span></div>
      <strong>{finding.title}</strong>
      <p>{finding.problem}</p>
      {!compact && <><div className="evidence-line"><ShieldCheck size={12} /> {finding.evidence}</div><div className="fix-line"><Zap size={12} /> {finding.fix}</div></>}
    </div>
  );
}

function ScoreBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  const items = [
    ['Website gap', breakdown.websiteGap, 25],
    ['Buying signals', breakdown.buyingSignals, 25],
    ['Business fit', breakdown.businessFit, 20],
    ['Contactability', breakdown.contactability, 15],
    ['Service relevance', breakdown.serviceRelevance, 15],
  ];
  return <div className="score-bars">{items.map(([label, value, max]) => <div key={String(label)}><div className="score-bar-head"><span>{label}</span><b>{value}/{max}</b></div><div className="bar-track"><i style={{ width: \`\${(Number(value) / Number(max)) * 100}%\` }} /></div></div>)}</div>;
}

function InfoCell({ icon: Icon, label, value, href }: { icon: typeof Globe; label: string; value: string; href?: string }) {
  return (
    <div className="info-cell"><Icon size={14} /><div><span>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer">{value} <ExternalLink size={11} /></a> : <strong>{value}</strong>}</div></div>
  );
}

function SetupRow({ name, detail, state }: { name: string; detail: string; state: string }) {
  return <div className="setup-row"><div><strong>{name}</strong><span>{detail}</span></div><span className={state === 'Not configured' ? 'setup-state warn' : 'setup-state'}>{state}</span></div>;
}
