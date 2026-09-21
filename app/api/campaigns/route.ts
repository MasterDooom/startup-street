import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../lib/db';

const createSchema = z.object({
  name: z.string().min(1).max(160),
  niche: z.string().max(160).optional(),
  channel: z.enum(['email','instagram','whatsapp','linkedin','phone']),
  businessIds: z.array(z.string()).min(1).max(500),
  filters: z.record(z.any()).optional(),
});

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, campaigns: [] });
  }

  const rows = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      recipients: {
        include: { business: { select: { id: true, name: true, city: true, score: true, status: true, website: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return NextResponse.json({ configured: true, campaigns: rows });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid campaign payload.', details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, niche, channel, businessIds, filters } = parsed.data;
  const businesses = await prisma.business.findMany({
    where: {
      id: { in: businessIds },
      doNotContact: false,
      rejected: false,
    },
    select: {
      id: true,
      name: true,
      city: true,
      score: true,
      recommendedService: true,
      opportunity: true,
      website: true,
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      name,
      niche,
      channel,
      filters,
      total: businesses.length,
      recipients: {
        create: businesses.map((business) => ({
          businessId: business.id,
        })),
      },
    },
    include: {
      recipients: {
        include: { business: true },
      },
    },
  });

  return NextResponse.json({ configured: true, campaign }, { status: 201 });
}
