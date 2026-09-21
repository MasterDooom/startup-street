import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/db';

const patchSchema = z.object({
  status: z.enum(['New','Researched','NeedsReview','Verified','ReadyToContact','Contacted','Replied','Interested','MeetingBooked','ProposalSent','Won','Lost','DoNotContact']).optional(),
  score: z.number().int().min(0).max(100).optional(),
  scoreBreakdown: z.record(z.number()).optional(),
  findings: z.array(z.any()).optional(),
  opportunity: z.string().max(1000).optional(),
  recommendedService: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  doNotContact: z.boolean().optional(),
  shortlisted: z.boolean().optional(),
  rejected: z.boolean().optional(),
  intelligence: z.any().optional(),
  opportunityReasons: z.array(z.string()).optional(),
  whyNow: z.array(z.string()).optional(),
  website: z.string().url().or(z.literal('')).optional(),
  phone: z.string().max(80).optional(),
  mapsUrl: z.string().url().or(z.literal('')).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  social: z.string().max(500).optional(),
  audit: z.object({
    url: z.string().url(),
    finalUrl: z.string().url().optional(),
    reachable: z.boolean(),
    httpStatus: z.number().int().optional(),
    responseMs: z.number().int().optional(),
    title: z.string().optional(),
    score: z.number().int().min(0).max(100).optional(),
    metrics: z.any().optional(),
    findings: z.array(z.any()),
  }).optional(),
  outreach: z.object({
    channel: z.string(),
    draft: z.string(),
    generatedBy: z.string().default('rule'),
    approved: z.boolean().default(false),
  }).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid lead update.', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.business.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });

  const input = parsed.data;
  const data: any = {};
  for (const key of ['status','score','scoreBreakdown','opportunity','recommendedService','notes','doNotContact']) {
    if (input[key as keyof typeof input] !== undefined) data[key] = input[key as keyof typeof input];
  }
  if (input.website !== undefined) {
    data.website = input.website || null;
    try { data.normalizedDomain = input.website ? new URL(input.website).hostname.toLowerCase().replace(/^www\./, '') : null; } catch { data.normalizedDomain = null; }
  }
  if (input.phone !== undefined) {
    data.phone = input.phone || null;
    const digits = input.phone.replace(/\D/g, '');
    data.normalizedPhone = digits ? (digits.length === 10 ? '91' + digits : digits) : null;
  }
  if (input.mapsUrl !== undefined) data.mapsUrl = input.mapsUrl || null;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.business.update({
      where: { id: params.id },
      data,
      include: {
        contacts: true,
        providerRecords: { orderBy: { retrievedAt: 'desc' }, take: 1 },
        audits: { orderBy: { retrievedAt: 'desc' }, take: 1 },
        outreachDrafts: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
    });

    if (input.status && input.status !== existing.status) {
      await tx.pipelineEvent.create({
        data: {
          businessId: row.id,
          fromStatus: existing.status,
          toStatus: input.status,
        },
      });
    }

    if (input.doNotContact) {
      await tx.suppression.upsert({
        where: { businessId: row.id },
        create: { businessId: row.id, reason: 'User-suppressed lead' },
        update: {},
      });
    }

    if (input.audit) {
      await tx.websiteAudit.create({
        data: {
          businessId: row.id,
          url: input.audit.url,
          finalUrl: input.audit.finalUrl,
          reachable: input.audit.reachable,
          httpStatus: input.audit.httpStatus,
          responseMs: input.audit.responseMs,
          title: input.audit.title,
          score: input.audit.score,
          metrics: input.audit.metrics,
          findings: input.audit.findings,
        },
      });
    }

    if (input.outreach) {
      await tx.outreachDraft.create({
        data: {
          businessId: row.id,
          channel: input.outreach.channel,
          draft: input.outreach.draft,
          generatedBy: input.outreach.generatedBy,
          approved: input.outreach.approved,
          approvedAt: input.outreach.approved ? new Date() : null,
        },
      });
    }

    return row;
  });

  return NextResponse.json({ configured: true, lead: { id: updated.id, status: String(updated.status), score: updated.score } });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const existing = await prisma.business.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  await prisma.business.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true, id: params.id });
}
