import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../lib/db';
import { analyzeLead } from '../../../lib/intelligence/engine';

const findingSchema = z.object({
  title: z.string().optional(),
  problem: z.string().optional(),
  severity: z.string().optional(),
  evidence: z.string().optional(),
  confidence: z.string().optional(),
  fix: z.string().optional(),
}).passthrough();

const inputSchema = z.object({
  lead: z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    category: z.string().optional(),
    type: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    social: z.string().optional(),
    mapsUrl: z.string().optional(),
    rating: z.number().nullable().optional(),
    reviewCount: z.number().nullable().optional(),
    businessStatus: z.string().nullable().optional(),
    provider: z.string().optional(),
    findings: z.array(findingSchema).optional(),
    sourceMeta: z.any().optional(),
  }),
  metrics: z.any().optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid intelligence payload.', details: parsed.error.flatten() }, { status: 400 });
    }

    const { lead, metrics } = parsed.data;
    const result = analyzeLead({ ...lead, findings: lead.findings ?? [], metrics });

    if (process.env.DATABASE_URL && lead.id) {
      const existing = await prisma.business.findUnique({ where: { id: lead.id }, select: { id: true, score: true } }).catch(() => null);

      if (existing) {
        const weights = Object.fromEntries(result.components.map((item) => [item.key, item.max]));
        const updated = await prisma.$transaction(async (tx) => {
          await tx.business.update({
            where: { id: lead.id },
            data: {
              score: result.score,
              scoreBreakdown: Object.fromEntries(result.components.map((item) => [item.key, item.value])),
              growthScore: result.components.find((item) => item.key === 'growth')?.value ?? 0,
              websiteOpportunityScore: result.components.find((item) => item.key === 'website')?.value ?? 0,
              buyingSignalScore: result.components.find((item) => item.key === 'buying')?.value ?? 0,
              agencyFitScore: result.components.find((item) => item.key === 'fit')?.value ?? 0,
              contactabilityScore: result.components.find((item) => item.key === 'contact')?.value ?? 0,
              dataConfidenceScore: result.components.find((item) => item.key === 'confidence')?.value ?? 0,
              intelligence: {
                confidence: result.confidence,
                dataCompleteness: result.dataCompleteness,
                reasons: result.reasons,
                growthSignals: result.growthSignals,
                digitalSignals: result.digitalSignals,
                whyNow: result.whyNow,
              },
              opportunity: result.opportunity,
              opportunityReasons: result.reasons,
              whyNow: result.whyNow,
              recommendedService: result.recommendedService,
              priceRange: result.priceRange,
              status: existing.score === 0 ? 'Researched' : undefined,
            },
          });

          await tx.score.create({
            data: {
              businessId: lead.id!,
              total: result.score,
              weights,
              reasons: result.reasons,
              components: {
                create: result.components.map((item) => ({
                  key: item.key,
                  value: item.value,
                  max: item.max,
                  evidence: item.reasons,
                })),
              },
            },
          });

          for (const signal of [...result.growthSignals, ...result.digitalSignals]) {
            await tx.buyingSignal.create({
              data: {
                businessId: lead.id!,
                signal: signal.signal,
                evidence: signal.evidence,
                confidence: signal.confidence,
                kind: 'kind' in signal && signal.kind === 'inference' ? 'inference' : 'observed',
              },
            });
          }

          const insights = [
            ...result.whyNow.map((body) => ({ kind: 'why-now', title: 'Why now', summary: body })),
            { kind: 'opportunity', title: 'Client opportunity', summary: result.opportunity },
            { kind: 'recommended-offer', title: 'Recommended offer', summary: result.recommendedService },
          ];

          for (const insight of insights) {
            await tx.businessInsight.create({
              data: {
                businessId: lead.id!,
                kind: insight.kind,
                title: insight.title,
                summary: insight.summary,
                confidence: result.confidence,
              },
            });
          }

          return tx.business.findUnique({ where: { id: lead.id! }, select: { id: true } });
        });

        return NextResponse.json({ configured: true, persisted: true, result, businessId: updated?.id });
      }
    }

    return NextResponse.json({ configured: Boolean(process.env.DATABASE_URL), persisted: false, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message.slice(0, 500) : 'Intelligence analysis failed.' },
      { status: 500 },
    );
  }
}
