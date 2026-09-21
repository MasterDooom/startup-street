import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../lib/db';

const schema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1500).optional(),
  services: z.array(z.string()).optional(),
  pricingRanges: z.record(z.string()).optional(),
  differentiators: z.array(z.string()).optional(),
  targetNiches: z.array(z.string()).optional(),
  preferredCities: z.array(z.string()).optional(),
  website: z.string().url().or(z.literal('')).optional(),
  portfolioItems: z.array(z.object({
    title: z.string().min(1),
    description: z.string().max(1000).optional(),
    niche: z.string().max(120).optional(),
    service: z.string().max(120).optional(),
    url: z.string().url().or(z.literal('')).optional(),
    imageUrl: z.string().url().or(z.literal('')).optional(),
  })).optional(),
});

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ configured: false, profile: null });

  const profile = await prisma.agencyProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { portfolioItems: true },
  });

  return NextResponse.json({ configured: true, profile });
}

export async function PUT(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid agency profile.', details: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const existing = await prisma.agencyProfile.findFirst({ orderBy: { createdAt: 'asc' } });

  const profile = existing
    ? await prisma.agencyProfile.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description,
          services: input.services,
          pricingRanges: input.pricingRanges,
          differentiators: input.differentiators,
          targetNiches: input.targetNiches,
          preferredCities: input.preferredCities,
          website: input.website || null,
          portfolioItems: input.portfolioItems ? {
            deleteMany: {},
            create: input.portfolioItems,
          } : undefined,
        },
        include: { portfolioItems: true },
      })
    : await prisma.agencyProfile.create({
        data: {
          name: input.name,
          description: input.description,
          services: input.services,
          pricingRanges: input.pricingRanges,
          differentiators: input.differentiators,
          targetNiches: input.targetNiches,
          preferredCities: input.preferredCities,
          website: input.website || null,
          portfolioItems: {
            create: input.portfolioItems ?? [],
          },
        },
        include: { portfolioItems: true },
      });

  return NextResponse.json({ configured: true, profile });
}
