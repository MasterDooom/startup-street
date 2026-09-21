import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeLead } from '../../../../lib/intelligence/engine';

const findingSchema = z.object({
  title: z.string().optional(),
  problem: z.string().optional(),
  severity: z.string().optional(),
  evidence: z.string().optional(),
  confidence: z.string().optional(),
  fix: z.string().optional(),
}).passthrough();

const leadSchema = z.object({
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
  metrics: z.any().optional(),
});

const inputSchema = z.object({
  leads: z.array(leadSchema).min(1).max(100),
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid batch intelligence payload.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results = parsed.data.leads.map((lead) => {
    const result = analyzeLead({
      ...lead,
      findings: lead.findings ?? [],
      metrics: lead.metrics,
    });

    return {
      id: lead.id,
      result,
    };
  });

  return NextResponse.json({
    configured: true,
    analyzed: results.length,
    results,
  });
}
