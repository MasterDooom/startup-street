import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

const profiles: Record<string, {
  title: string;
  summary: string;
  demandSignals: string[];
  digitalMaturity: string[];
  buyingTriggers: string[];
  commonWeaknesses: string[];
  salesAngles: string[];
  sourceLinks: string[];
}> = {
  'interior & renovation': {
    title: 'Interior + renovation',
    summary: 'Visual, project-led local businesses where proof, trust, lead capture and portfolio presentation can influence enquiries.',
    demandSignals: ['Local discovery', 'Project-led demand', 'Portfolio dependence', 'Trust-heavy buying journey'],
    digitalMaturity: ['Social-first discovery', 'Website quality varies widely', 'Location and project proof matter'],
    buyingTriggers: ['New projects', 'Expansion', 'More branches', 'New service lines', 'Portfolio growth'],
    commonWeaknesses: ['Weak project storytelling', 'No clear consultation CTA', 'Poor mobile conversion', 'Social audience not captured on owned web'],
    salesAngles: ['Turn project traffic into qualified enquiries', 'Build location/project landing pages', 'Create a stronger portfolio and consultation funnel'],
    sourceLinks: [
      'https://www.imarcgroup.com/interior-design-market-india',
      'https://redseer.com/articles/tapping-into-the-everyday-instant-home-services-and-the-next-habit-loop/',
    ],
  },
  'home services': {
    title: 'Home services',
    summary: 'Local service businesses where search intent, trust and fast contact paths can materially affect lead flow.',
    demandSignals: ['Local intent', 'Urgent service needs', 'Phone/WhatsApp dependency'],
    digitalMaturity: ['Directory-led discovery', 'Patchy owned web presence'],
    buyingTriggers: ['Service expansion', 'Hiring', 'Territory expansion', 'New branches'],
    commonWeaknesses: ['No clear quote CTA', 'Poor service-area pages', 'Weak mobile contact flow'],
    salesAngles: ['Quote-first landing pages', 'Local service-area SEO architecture', 'Faster mobile enquiry journey'],
    sourceLinks: ['https://data.gov.in/'],
  },
};

export async function GET(request: Request) {
  const niche = new URL(request.url).searchParams.get('niche')?.trim().toLowerCase() || 'interior & renovation';
  const profile = profiles[niche] ?? {
    title: niche,
    summary: 'Custom market profile. Add evidence-backed research sources before using market-level claims in outreach.',
    demandSignals: [],
    digitalMaturity: [],
    buyingTriggers: [],
    commonWeaknesses: [],
    salesAngles: [],
    sourceLinks: [],
  };

  let persisted = false;
  if (process.env.DATABASE_URL) {
    const row = await prisma.marketProfile.upsert({
      where: { niche_country: { niche, country: 'IN' } },
      update: {
        title: profile.title,
        summary: profile.summary,
        demandSignals: profile.demandSignals,
        digitalMaturity: profile.digitalMaturity,
        buyingTriggers: profile.buyingTriggers,
        commonWeaknesses: profile.commonWeaknesses,
        salesAngles: profile.salesAngles,
        sourceLinks: profile.sourceLinks,
      },
      create: {
        niche,
        country: 'IN',
        title: profile.title,
        summary: profile.summary,
        demandSignals: profile.demandSignals,
        digitalMaturity: profile.digitalMaturity,
        buyingTriggers: profile.buyingTriggers,
        commonWeaknesses: profile.commonWeaknesses,
        salesAngles: profile.salesAngles,
        sourceLinks: profile.sourceLinks,
      },
    });
    persisted = Boolean(row.id);
  }

  return NextResponse.json({ configured: Boolean(process.env.DATABASE_URL), persisted, profile });
}
