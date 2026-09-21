import { NextResponse } from 'next/server';
import { osmProvider } from '../../../lib/providers/osm';

type PlacesResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    businessStatus?: string;
    types?: string[];
  }>;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = cleanText(body?.query);
    const city = cleanText(body?.city);
    const pageSize = Math.min(Math.max(Number(body?.pageSize) || 10, 1), 20);
    const provider = cleanText(body?.provider || 'auto').toLowerCase();
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!['auto', 'google', 'osm'].includes(provider)) {
      return NextResponse.json({ error: 'Provider must be auto, google, or osm.' }, { status: 400 });
    }

    if (!apiKey && provider === 'google') {
      return NextResponse.json({ configured: false, provider: 'google', error: 'GOOGLE_MAPS_API_KEY is not configured.' }, { status: 503 });
    }

    if (!apiKey && (provider === 'auto' || provider === 'osm')) {
      try {
        const leads = await osmProvider.search({ query, city, pageSize });
        return NextResponse.json({ configured: true, provider: 'openstreetmap', query: city ? query + ' in ' + city + ', India' : query, leads });
      } catch (error) {
        return NextResponse.json({ configured: false, provider: 'openstreetmap', error: error instanceof Error ? error.message : 'OpenStreetMap discovery failed.' }, { status: 502 });
      }
    }

    if (!query) {
      return NextResponse.json({ error: 'A search query is required.' }, { status: 400 });
    }

    const textQuery = city ? `${query} in ${city}, India` : query;

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.websiteUri',
          'places.nationalPhoneNumber',
          'places.googleMapsUri',
          'places.rating',
          'places.userRatingCount',
          'places.businessStatus',
          'places.types',
        ].join(','),
      },
      body: JSON.stringify({ textQuery, pageSize }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { configured: true, error: `Google Places request failed (${response.status}).`, detail: detail.slice(0, 800) },
        { status: response.status },
      );
    }

    const data = (await response.json()) as PlacesResponse;
    const leads = (data.places ?? []).map((place, index) => {
      const name = cleanText(place.displayName?.text) || 'Unnamed business';
      const hasWebsite = Boolean(place.websiteUri);
      const ratings = place.userRatingCount ?? 0;
      const contactable = Boolean(place.nationalPhoneNumber || place.websiteUri);

      // Preliminary score only. A website audit should replace this with evidence-backed scoring.
      const websiteGap = hasWebsite ? 5 : 25;
      const businessFit = 15;
      const contactability = contactable ? 12 : 4;
      const socialUnknown = 6;
      const score = Math.min(100, websiteGap + businessFit + contactability + socialUnknown);

      return {
        id: `places-${place.id ?? index}-${Date.now()}`,
        name,
        city: city || cleanText(place.formattedAddress).split(',')[0] || '',
        state: '',
        type: cleanText(place.types?.[0]).replaceAll('_', ' ') || cleanText(query),
        category: cleanText(query),
        website: place.websiteUri || '',
        email: '',
        phone: place.nationalPhoneNumber || '',
        social: '',
        mapsUrl: place.googleMapsUri || '',
        source: 'Google Places API',
        discoveredAt: new Date().toISOString(),
        status: hasWebsite ? 'Needs review' : 'New',
        score,
        scoreBreakdown: {
          websiteGap,
          buyingSignals: 0,
          businessFit,
          contactability,
          serviceRelevance: socialUnknown,
        },
        findings: [],
        opportunity: hasWebsite ? 'Audit current website' : 'Launch conversion website',
        recommendedService: hasWebsite ? 'Growth Website' : 'Launch Website',
        evidence: hasWebsite ? 'Website found; run the site audit before outreach.' : 'No website URI returned by Google Places.',
        sourceMeta: {
          googleRating: place.rating ?? null,
          googleReviewCount: ratings,
          businessStatus: place.businessStatus ?? null,
        },
        notes: '',
        doNotContact: false,
      };
    });

    return NextResponse.json({ configured: true, query: textQuery, leads });
  } catch {
    return NextResponse.json({ error: 'Unable to complete discovery request.' }, { status: 500 });
  }
}
