import { NextResponse } from 'next/server';
import { osmProvider } from '../../../lib/providers/osm';
import { analyzeLead } from '../../../lib/intelligence/engine';

type PlacesResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    postalAddress?: { postalCode?: string; locality?: string; administrativeArea?: string };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    businessStatus?: string;
    types?: string[];
    primaryType?: string;
    priceRange?: { startPrice?: { currencyCode?: string; units?: string }; endPrice?: { currencyCode?: string; units?: string } };
    pureServiceAreaBusiness?: boolean;
    openingDate?: { year?: number; month?: number; day?: number };
  }>;
  nextPageToken?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseState(address: string) {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = cleanText(body?.query);
    const city = cleanText(body?.city);
    const pageSize = Math.min(Math.max(Number(body?.pageSize) || 10, 1), 20);
    const provider = cleanText(body?.provider || 'auto').toLowerCase();
    const pageToken = cleanText(body?.pageToken);
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!query) return NextResponse.json({ error: 'A search query is required.' }, { status: 400 });

    if (!['auto', 'google', 'osm'].includes(provider)) {
      return NextResponse.json({ error: 'Provider must be auto, google, or osm.' }, { status: 400 });
    }

    if (!apiKey && provider === 'google') {
      return NextResponse.json({ configured: false, provider: 'google', error: 'GOOGLE_MAPS_API_KEY is not configured.' }, { status: 503 });
    }

    if (!apiKey && (provider === 'auto' || provider === 'osm')) {
      try {
        const leads = await osmProvider.search({ query, city, pageSize });
        const analyzed = leads.map((lead) => {
          const intelligence = analyzeLead({
            name: lead.name,
            category: lead.category,
            type: lead.type,
            city: lead.city,
            state: lead.state,
            address: lead.address,
            postalCode: lead.postalCode,
            website: lead.website,
            phone: lead.phone,
            mapsUrl: lead.mapsUrl,
            provider: lead.provider,
          });

          return {
            ...lead,
            status: intelligence.score >= 65 ? 'Needs review' : 'New',
            score: intelligence.score,
            scoreBreakdown: Object.fromEntries(intelligence.components.map((item) => [item.key, item.value])),
            findings: [],
            opportunity: intelligence.opportunity,
            recommendedService: intelligence.recommendedService,
            priceRange: intelligence.priceRange,
            evidence: lead.evidence,
            intelligence,
            notes: '',
            doNotContact: false,
          };
        });

        return NextResponse.json({
          configured: true,
          provider: 'openstreetmap',
          query: city ? query + ' in ' + city + ', India' : query,
          leads: analyzed,
          attribution: '© OpenStreetMap contributors',
        });
      } catch (error) {
        return NextResponse.json({ configured: false, provider: 'openstreetmap', error: error instanceof Error ? error.message : 'OpenStreetMap discovery failed.' }, { status: 502 });
      }
    }

    const textQuery = city ? query + ' in ' + city + ', India' : query;
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey!,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.primaryType',
          'places.types',
          'places.formattedAddress',
          'places.postalAddress',
          'places.websiteUri',
          'places.nationalPhoneNumber',
          'places.googleMapsUri',
          'places.rating',
          'places.userRatingCount',
          'places.businessStatus',
          'places.priceRange',
          'places.pureServiceAreaBusiness',
          'places.openingDate',
        ].join(','),
      },
      body: {
        textQuery,
        pageSize,
        regionCode: 'IN',
        ...(pageToken ? { pageToken } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { configured: true, provider: 'google', error: 'Google Places request failed (' + response.status + ').', detail: detail.slice(0, 800) },
        { status: response.status },
      );
    }

    const data = (await response.json()) as PlacesResponse;
    const retrievedAt = new Date().toISOString();

    const leads = (data.places ?? []).map((place, index) => {
      const name = cleanText(place.displayName?.text) || 'Unnamed business';
      const address = cleanText(place.formattedAddress);
      const postalCode = cleanText(place.postalAddress?.postalCode);
      const cityName = cleanText(place.postalAddress?.locality) || city || address.split(',')[0] || '';
      const state = cleanText(place.postalAddress?.administrativeArea) || parseState(address);
      const type = cleanText(place.primaryType) || cleanText(place.types?.[0]).replaceAll('_', ' ') || query;
      const priceRange = place.priceRange?.startPrice?.units && place.priceRange?.endPrice?.units
        ? String(place.priceRange.startPrice.units) + '–' + String(place.priceRange.endPrice.units) + ' ' + String(place.priceRange.startPrice.currencyCode || 'INR')
        : '';

      const intelligence = analyzeLead({
        name,
        category: query,
        type,
        city: cityName,
        state,
        address,
        postalCode,
        website: place.websiteUri || '',
        phone: place.nationalPhoneNumber || '',
        mapsUrl: place.googleMapsUri || '',
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        businessStatus: place.businessStatus ?? null,
        provider: 'Google Places API',
      });

      return {
        id: 'places-' + (place.id ?? index) + '-' + Date.now(),
        name,
        city: cityName,
        state,
        postalCode,
        address,
        type,
        category: query,
        website: place.websiteUri || '',
        email: '',
        phone: place.nationalPhoneNumber || '',
        social: '',
        mapsUrl: place.googleMapsUri || '',
        source: 'Google Places API',
        discoveredAt: retrievedAt,
        status: intelligence.score >= 65 ? 'Needs review' : 'New',
        score: intelligence.score,
        scoreBreakdown: Object.fromEntries(intelligence.components.map((item) => [item.key, item.value])),
        findings: [],
        opportunity: intelligence.opportunity,
        recommendedService: intelligence.recommendedService,
        priceRange: priceRange || intelligence.priceRange,
        evidence: place.websiteUri ? 'Google Places returned a public website URI. Run a website audit before outreach.' : 'Google Places returned no public website URI.',
        intelligence,
        sourceMeta: {
          googleRating: place.rating ?? null,
          googleReviewCount: place.userRatingCount ?? null,
          businessStatus: place.businessStatus ?? null,
          primaryType: place.primaryType ?? null,
          priceRange: place.priceRange ?? null,
          pureServiceAreaBusiness: place.pureServiceAreaBusiness ?? false,
          openingDate: place.openingDate ?? null,
        },
        notes: '',
        doNotContact: false,
      };
    });

    return NextResponse.json({
      configured: true,
      provider: 'google',
      query: textQuery,
      leads,
      nextPageToken: data.nextPageToken || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : 'Unable to complete discovery request.' }, { status: 500 });
  }
}
