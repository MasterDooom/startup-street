'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, Globe, Plus, ArrowUpRight, CheckCircle2, XCircle, Upload, Download, Trash2 } from 'lucide-react';

type Lead = {
  id: number;
  name: string;
  city: string;
  type: string;
  score: number;
  status: string;
  opportunity: string;
  evidence: string;
  website: string;
  email?: string;
  phone?: string;
  social?: string;
  source?: string;
  notes?: string;
};

const STORAGE_KEY = 'startup-street-leads-v1';
const statuses = ['All', 'New', 'Needs review', 'Approved', 'Contacted', 'Not a fit'];
const seed: Lead[] = [
  { id: 1, name: 'Moss & Bean', city: 'Bengaluru', type: 'Café', score: 88, status: 'Needs review', opportunity: 'Launch website', evidence: 'Sample record: active social presence and no dedicated website found. Verify manually.', website: 'None found', source: 'Sample data' },
  { id: 2, name: 'The Curry Room', city: 'Pune', type: 'Restaurant', score: 72, status: 'New', opportunity: 'Menu redesign', evidence: 'Sample record: PDF-only menu and unclear booking CTA. Verify manually.', website: 'Not verified', source: 'Sample data' },
  { id: 3, name: 'Basil Cloud Kitchen', city: 'Hyderabad', type: 'Cloud kitchen', score: 81, status: 'Approved', opportunity: 'Ordering landing page', evidence: 'Sample record: delivery promotions and social-first presence. Verify manually.', website: 'None verified', source: 'Sample data' },
  { id: 4, name: 'Oven Theory', city: 'Mumbai', type: 'Bakery', score: 56, status: 'New', opportunity: 'Digital menu', evidence: 'Sample record: mobile menu usability issue. Verify manually.', website: 'Not verified', source: 'Sample data' },
];

function parseCsv(text: string): Lead[] {
  const rows = text.trim().split(/\\r?\\n/).filter(Boolean).map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase());
  return rows.slice(1).map((row, index) => {
    const get = (key: string) => row[headers.indexOf(key)] || '';
    return {
      id: Date.now() + index,
      name: get('name') || get('business name') || 'Unnamed business',
      city: get('city'), type: get('type') || get('category') || 'Restaurant',
      score: Math.max(0, Math.min(100, Number(get('score')) || 0)),
      status: get('status') || 'New', opportunity: get('opportunity') || 'Needs research',
      evidence: get('evidence') || 'Imported lead; verify manually.', website: get('website') || 'Not verified',
      email: get('email'), phone: get('phone'), social: get('social'), source: get('source') || 'CSV import', notes: get('notes'),
    };
  });
}

function csvEscape(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>(seed);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<Lead | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setLeads(JSON.parse(saved));
  }, []);
  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); }, [leads]);

  const filtered = useMemo(() => leads.filter(l => (filter === 'All' || l.status === filter) && `${l.name} ${l.city} ${l.type}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.score - a.score), [leads, query, filter]);
  const update = (status: string) => { if (!selected) return; setLeads(current => current.map(l => l.id === selected.id ? { ...l, status } : l)); setSelected({ ...selected, status }); };
  const addLead = () => { const lead: Lead = { id: Date.now(), name: 'New business', city: '', type: 'Restaurant', score: 0, status: 'New', opportunity: 'Needs research', evidence: 'Add verified observations here.', website: 'Not verified', source: 'Manual entry' }; setLeads(current => [lead, ...current]); setSelected(lead); };
  const importCsv = (file: File) => { const reader = new FileReader(); reader.onload = () => { const imported = parseCsv(String(reader.result)); if (imported.length) setLeads(current => [...imported, ...current]); }; reader.readAsText(file); };
  const exportCsv = () => { const headers = ['name','city','type','score','status','opportunity','evidence','website','email','phone','social','source','notes']; const body = leads.map(l => headers.map(h => csvEscape(l[h as keyof Lead])).join(',')); const blob = new Blob([[headers.join(','), ...body].join('\\n')], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'startup-street-leads.csv'; a.click(); URL.revokeObjectURL(url); };

  return <main className="shell"><aside><div className="brand"><span>SS</span><div><b>Startup Street</b><small>Lead intelligence</small></div></div><nav><a className="active">Overview</a><a>Lead inbox <em>{leads.length}</em></a><a>Audits</a><a>Campaigns</a><a>Settings</a></nav><div className="side-foot"><small>WORKSPACE</small><p>Restaurant acquisition</p><div className="progress"><i /></div><small>Local persistence enabled</small></div></aside><section className="content"><header><div><p className="eyebrow">MONDAY, SEPTEMBER 21</p><h1>Good afternoon, founder.</h1><p className="muted">Find businesses with a reason to buy.</p></div><div className="header-actions"><button className="secondary" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import CSV</button><button className="secondary" onClick={exportCsv}><Download size={16} /> Export</button><button className="primary" onClick={addLead}><Plus size={17} /> Add lead</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} /></div></header><div className="stats"><Stat label="Total leads" value={leads.length} note="Saved in this browser"/><Stat label="Needs review" value={leads.filter(l => l.status === 'Needs review').length} note="Manual verification"/><Stat label="High opportunity" value={leads.filter(l => l.score >= 75).length} note="Score 75+"/><Stat label="Approved" value={leads.filter(l => l.status === 'Approved').length} note="Ready for outreach"/></div><div className="toolbar"><div className="search"><Search size={17} /><input placeholder="Search leads, cities or categories..." value={query} onChange={e => setQuery(e.target.value)} /></div><div className="filters">{statuses.map(s => <button key={s} className={filter === s ? 'selected' : ''} onClick={() => setFilter(s)}>{s}</button>)}</div></div><div className="panel"><div className="panel-head"><div><h2>Lead inbox</h2><p className="muted">Prioritized opportunities across India</p></div><span className="count">{filtered.length} leads</span></div><div className="table-wrap"><table><thead><tr><th>Business</th><th>Opportunity</th><th>Score</th><th>Status</th><th /></tr></thead><tbody>{filtered.map(l => <tr key={l.id} onClick={() => setSelected(l)}><td><div className="business"><div className="avatar">{l.name.slice(0, 1)}</div><div><b>{l.name}</b><small><MapPin size={12} />{l.city || 'City missing'} · {l.type}</small></div></div></td><td><b>{l.opportunity}</b><small className="truncate">{l.evidence}</small></td><td><span className={`score ${l.score >= 75 ? 'high' : ''}`}>{l.score}</span></td><td><span className="status"><span /> {l.status}</span></td><td><ArrowUpRight size={17} /></td></tr>)}</tbody></table></div></div></section>{selected && <div className="overlay" onClick={() => setSelected(null)}><article className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><span className="eyebrow">LEAD DETAILS</span><button className="icon-btn" onClick={() => setSelected(null)}>×</button></div><h2>{selected.name}</h2><p className="muted"><MapPin size={14} /> {selected.city || 'City missing'} · {selected.type}</p><div className="detail-score"><span>Opportunity score</span><strong>{selected.score}<small>/100</small></strong></div><div className="detail"><label>Recommended offer</label><b>{selected.opportunity}</b></div><div className="detail"><label>Evidence</label><p>{selected.evidence}</p></div><div className="detail"><label>Website</label><p><Globe size={14} /> {selected.website}</p></div><div className="detail"><label>Contact</label><p>{selected.email || 'No email'}{selected.phone ? ` · ${selected.phone}` : ''}</p></div><div className="drawer-actions"><button className="primary" onClick={() => update('Approved')}><CheckCircle2 size={16} /> Approve</button><button className="secondary" onClick={() => update('Not a fit')}><XCircle size={16} /> Not a fit</button><button className="icon-btn" title="Delete lead" onClick={() => { setLeads(current => current.filter(l => l.id !== selected.id)); setSelected(null); }}><Trash2 size={16} /></button></div></article></div>}</main>;
}
function Stat({ label, value, note }: { label: string; value: number; note: string }) { return <div className="stat"><small>{label}</small><strong>{value}</strong><p>{note}</p></div>; }
