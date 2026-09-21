import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../lib/db';

const leadSchema = z.object({
  name: z.string().min(1).max(180),
  city: z.string().max(120).default(''),
  state: z.string().max(120).default(''),
  type: z.string().max(120).default('Local business'),
  category: z.string().max(160).default('Local business'),
  address: z.string().max(500).default(''),
  postalCode: z.string().max(20).default(''),
  website: z.string().url().or(z.literal('')).default(''),
  phone: z.string().max(80).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  social: z.string().url().or(z.literal('')).default(''),
  mapsUrl: z.string().url().or(z.literal('')).default(''),
  source: z.string().max(120).default('manual'),
  provider: z.string().max(80).default('manual'),
  providerId: z.string().max(240).optional(),
  retrievedAt: z.string().datetime().optional(),
  score: z.number().int().min(0).max(100).default(0),
  scoreBreakdown: z.record(z.number()).optional(),
  findings: z.array(z.any()).default([]),
  intelligence: z.any().optional(),
  opportunity: z.string().max(1000).default(''),
  opportunityReasons: z.array(z.string()).optional(),
  whyNow: z.array(z.string()).optional(),
  recommendedService: z.string().max(500).default(''),
  priceRange: z.string().max(120).default(''),
  evidence: z.string().max(3000).default(''),
  notes: z.string().max(5000).default(''),
  shortlisted: z.boolean().default(false),
  rejected: z.boolean().default(false),
  doNotContact: z.boolean().default(false),
});

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? '91' + digits : digits;
}

function normalizeDomain(value: string) {
  if (!value) return '';
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return host;
  } catch {
    return '';
  }
}

const uiStatus: Record<string, string> = {
  New: 'New',
  Researched: 'Researched',
  NeedsReview: 'Needs review',
  Verified: 'Verified',
  ReadyToContact: 'Ready to contact',
  Contacted: 'Contacted',
  Replied: 'Replied',
  Interested: 'Interested',
  MeetingBooked: 'Meeting booked',
  ProposalSent: 'Proposal sent',
  Won: 'Won',
  Lost: 'Lost',
  DoNotContact: 'Do not contact',
};

function toClientLead(row: any) {
  const latestAudit = row.audits?.[0];
  const latestOutreach = row.outreachDrafts?.[0];
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state ?? '',
    type: row.type ?? row.category ?? 'Local business',
    category: row.category ?? row.type ?? 'Local business',
    website: row.website ?? '',
    email: row.contacts?.find((c: any) => c.channel === 'email')?.value ?? '',
    phone: row.phone ?? row.contacts?.find((c: any) => c.channel === 'phone')?.value ?? '',
    social: row.contacts?.find((c: any) => ['instagram', 'facebook', 'linkedin', 'social'].includes(c.channel))?.value ?? '',
    mapsUrl: row.mapsUrl ?? '',
    source: row.providerRecords?.[0]?.provider ?? 'database',
    discoveredAt: row.createdAt.toISOString(),
    status: uiStatus[String(row.status)] ?? 'New',
    score: row.score,
    scoreBreakdown: row.scoreBreakdown ?? { growth: row.growthScore ?? 0, website: row.websiteOpportunityScore ?? 0, buying: row.buyingSignalScore ?? 0, fit: row.agencyFitScore ?? 0, contact: row.contactabilityScore ?? 0, confidence: row.dataConfidenceScore ?? 0 },
    findings: latestAudit?.findings ?? [],
    growthScore: row.growthScore ?? 0,
    websiteOpportunityScore: row.websiteOpportunityScore ?? 0,
    buyingSignalScore: row.buyingSignalScore ?? 0,
    agencyFitScore: row.agencyFitScore ?? 0,
    contactabilityScore: row.contactabilityScore ?? 0,
    dataConfidenceScore: row.dataConfidenceScore ?? 0,
    intelligence: row.intelligence ?? null,
    opportunity: row.opportunity ?? '',
    recommendedService: row.recommendedService ?? '',
    priceRange: row.priceRange ?? '',
    evidence: row.evidence ?? '',
    notes: row.notes ?? '',
    shortlisted: row.shortlisted,
    rejected: row.rejected,
    doNotContact: row.doNotContact,
    sourceMeta: undefined,
    outreach: latestOutreach ? {
      channel: latestOutreach.channel,
      draft: latestOutreach.draft,
      generatedAt: latestOutreach.generatedAt.toISOString(),
      approved: latestOutreach.approved,
    } : undefined,
  };
}

const include = {
  contacts: true,
  providerRecords: { orderBy: { retrievedAt: 'desc' as const }, take: 1 },
  audits: { orderBy: { retrievedAt: 'desc' as const }, take: 1 },
  outreachDrafts: { orderBy: { generatedAt: 'desc' as const }, take: 1 },
};

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const city = searchParams.get('city')?.trim() ?? '';
  const status = searchParams.get('status')?.trim() ?? '';
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);

  const rows = await prisma.business.findMany({
    where: {
      ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      ...(status ? { status: status as any } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { type: { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    },
    include,
    orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });

  return NextResponse.json({ configured: true, leads: rows.map(toClientLead) });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid lead payload.', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const normalizedName = normalizeName(input.name);
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedDomain = normalizeDomain(input.website);

  const existing = await prisma.business.findFirst({
    where: {
      OR: [
        ...(input.providerId ? [{ providerRecords: { some: { provider: input.provider, providerId: input.providerId } } }] : []),
        ...(normalizedDomain ? [{ normalizedDomain }] : []),
        ...(normalizedPhone ? [{ normalizedPhone }] : []),
        { normalizedName, city: input.city },
      ],
    },
    include,
  });

  if (existing) return NextResponse.json({ created: false, lead: toClientLead(existing) });

  const created = await prisma.business.create({
    data: {
      name: input.name,
      normalizedName,
      city: input.city,
      state: input.state,
      category: input.category,
      type: input.type,
      address: input.address,
      postalCode: input.postalCode,
      website: input.website || null,
      normalizedDomain: normalizedDomain || null,
      phone: input.phone || null,
      normalizedPhone: normalizedPhone || null,
      mapsUrl: input.mapsUrl || null,
      score: input.score,
      scoreBreakdown: input.scoreBreakdown,
      growthScore: input.scoreBreakdown?.growth ?? 0,
      websiteOpportunityScore: input.scoreBreakdown?.website ?? 0,
      buyingSignalScore: input.scoreBreakdown?.buying ?? 0,
      agencyFitScore: input.scoreBreakdown?.fit ?? 0,
      contactabilityScore: input.scoreBreakdown?.contact ?? 0,
      dataConfidenceScore: input.scoreBreakdown?.confidence ?? 0,
      intelligence: input.intelligence,
      opportunity: input.opportunity,
      opportunityReasons: input.opportunityReasons,
      whyNow: input.whyNow,
      shortlisted: input.shortlisted,
      rejected: input.rejected,
      recommendedService: input.recommendedService,
      priceRange: input.priceRange,
      evidence: input.evidence,
      notes: input.notes,
      doNotContact: input.doNotContact,
      providerRecords: input.providerId ? {
        create: {
          provider: input.provider,
          providerId: input.providerId,
          retrievedAt: input.retrievedAt ? new Date(input.retrievedAt) : new Date(),
          evidence: input.evidence,
        },
      } : undefined,
      contacts: {
        create: [
          ...(input.email ? [{ channel: 'email', value: input.email, normalizedValue: input.email.toLowerCase(), confidence: 'medium' }] : []),
          ...(input.phone ? [{ channel: 'phone', value: input.phone, normalizedValue: normalizePhone(input.phone), confidence: 'medium' }] : []),
          ...(input.social ? [{ channel: 'social', value: input.social, normalizedValue: input.social.toLowerCase(), confidence: 'medium' }] : []),
        ],
      },
    },
    include,
  });

  return NextResponse.json({ created: true, lead: toClientLead(created) }, { status: 201 });
}
