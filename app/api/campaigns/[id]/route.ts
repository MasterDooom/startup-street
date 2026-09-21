import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/db';

const patchSchema = z.object({
  status: z.enum(['Draft','Generating','Review','Active','Paused','Completed','Cancelled']).optional(),
  recipientId: z.string().optional(),
  recipientStatus: z.enum(['Queued','Drafted','Approved','Contacted','Replied','Interested','MeetingBooked','Won','Lost','Suppressed']).optional(),
  draft: z.string().max(5000).optional(),
  evidenceUsed: z.any().optional(),
  approved: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      recipients: { include: { business: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  return NextResponse.json({ configured: true, campaign });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ configured: false, error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid campaign update.', details: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;

  if (input.recipientId) {
    const recipient = await prisma.campaignRecipient.findFirst({
      where: { id: input.recipientId, campaignId: params.id },
    });
    if (!recipient) return NextResponse.json({ error: 'Campaign recipient not found.' }, { status: 404 });

    const updated = await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: input.recipientStatus,
        draft: input.draft,
        evidenceUsed: input.evidenceUsed,
        approvedAt: input.approved ? new Date() : undefined,
      },
      include: { business: true },
    });

    if (input.approved) {
      await prisma.outreachDraft.create({
        data: {
          businessId: updated.businessId,
          channel: (await prisma.campaign.findUnique({ where: { id: params.id }, select: { channel: true } }))?.channel ?? 'email',
          draft: updated.draft ?? '',
          evidenceUsed: updated.evidenceUsed,
          generatedBy: 'campaign',
          approved: true,
          approvedAt: new Date(),
        },
      });
    }

    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        approved: { increment: input.approved ? 1 : 0 },
        contacted: { increment: input.recipientStatus === 'Contacted' ? 1 : 0 },
        replied: { increment: input.recipientStatus === 'Replied' ? 1 : 0 },
        meetings: { increment: input.recipientStatus === 'MeetingBooked' ? 1 : 0 },
        won: { increment: input.recipientStatus === 'Won' ? 1 : 0 },
      },
    });

    return NextResponse.json({ configured: true, recipient: updated });
  }

  const updated = await prisma.campaign.update({
    where: { id: params.id },
    data: { status: input.status },
  });

  return NextResponse.json({ configured: true, campaign: updated });
}
