import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    providers: {
      googlePlaces: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      ai: Boolean(process.env.AI_API_KEY && process.env.AI_MODEL),
      database: Boolean(process.env.DATABASE_URL),
      osmFallback: true,
    },
  });
}
