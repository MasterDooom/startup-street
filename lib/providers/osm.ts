import type { LeadProvider, NormalizedLead } from './types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

let lastNominatimAt = 0;
const geocodeCache = new Map<string, { lat: number; lon: number; expiresAt: number }>();

async function respectNominatimRateLimit() {
  const elapsed = Date.now() - lastNominatimAt;
  const wait = Math.max(0, 1100 - elapsed);
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimAt = Date.now();
}

function headers() {
  return {
    'User-Agent': 'StartupStreet/2.0 (+https://github.com/MasterDooom/startup-street)',
    Accept: 'application/json',
  };
}

function inferTags(query: string) {
  const q = query.toLowerCase();
  if (/(restaurant|cafe|café|bakery|food)/.test(q)) return ['amenity="restaurant"', 'amenity="cafe"', 'amenity="fast_food"'];
  if (/(clinic|doctor|dentist|hospital)/.test(q)) return ['amenity="clinic"', 'amenity="doctors"', 'amenity="dentist"'];
  if (/(architect|interior|renovation|construction|home service)/.test(q)) return ['craft="interior_decoration"', 'office="architect"', 'craft="carpenter"'];
  if (/(real estate|property)/.test(q)) return ['office="estate_agent"'];
  return ['name'];
}

export const osmProvider: LeadProvider = {
  id: 'openstreetmap',
  async search({ query, city = 'India', pageSize = 20 }) {
    const cacheKey = city.trim().toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    let lat = cached?.expiresAt && cached.expiresAt > Date.now() ? cached.lat : NaN;
    let lon = cached?.expiresAt && cached.expiresAt > Date.now() ? cached.lon : NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const geocode = new URL(NOMINATIM_URL);
      geocode.searchParams.set('q', city + ', India');
      geocode.searchParams.set('format', 'jsonv2');
      geocode.searchParams.set('limit', '1');

      await respectNominatimRateLimit();
      const geoResponse = await fetch(geocode, { headers: headers(), cache: 'no-store' });
      if (!geoResponse.ok) throw new Error('OpenStreetMap geocoding failed (' + geoResponse.status + ').');
      const geo = (await geoResponse.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
      lat = Number(geo[0]?.lat);
      lon = Number(geo[0]?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Could not locate ' + city + '.');
      geocodeCache.set(cacheKey, { lat, lon, expiresAt: Date.now() + 10 * 60 * 1000 });
    }

    const tags = inferTags(query);
    const clauses = tags.map((tag) => tag === 'name'
      ? 'nwr(around:15000,' + lat + ',' + lon + ')[name];'
      : 'nwr(around:15000,' + lat + ',' + lon + ')[' + tag + '];'
    ).join('\n');
    const overpassQuery = '[out:json][timeout:25];(' + clauses + ');out center tags;';

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: overpassQuery }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('OpenStreetMap data query failed (' + response.status + ').');

    const payload = await response.json() as {
      elements?: Array<{ id?: number; type?: string; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }>;
    };

    const now = new Date().toISOString();
    const seen = new Set<string>();
    return (payload.elements ?? []).flatMap((element) => {
      const tags = element.tags ?? {};
      const name = tags.name?.trim();
      if (!name) return [];
      const providerId = (element.type ?? 'object') + '-' + (element.id ?? name);
      if (seen.has(providerId)) return [];
      seen.add(providerId);
      const center = element.center ?? {};
      const website = tags.website || tags['contact:website'] || '';
      const phone = tags.phone || tags['contact:phone'] || '';
      const cityName = tags['addr:city'] || city;
      const state = tags['addr:state'] || '';
      const postalCode = tags['addr:postcode'] || '';
      const address = [tags['addr:housenumber'], tags['addr:street'], cityName, state, postalCode].filter(Boolean).join(', ');
      return [{
        id: 'osm-' + providerId,
        provider: 'openstreetmap',
        providerId,
        name,
        type: tags.shop || tags.amenity || tags.office || tags.craft || query,
        category: query,
        address,
        city: cityName,
        state,
        postalCode,
        website,
        phone,
        mapsUrl: center.lat && center.lon
          ? 'https://www.openstreetmap.org/?mlat=' + center.lat + '&mlon=' + center.lon + '#map=18/' + center.lat + '/' + center.lon
          : '',
        source: 'OpenStreetMap / Overpass',
        retrievedAt: now,
        rating: null,
        reviewCount: null,
        businessStatus: null,
        evidence: 'Public OpenStreetMap feature matched ' + query + ' near ' + cityName + '.',
        confidence: 'medium' as const,
      } satisfies NormalizedLead];
    }).slice(0, Math.min(Math.max(pageSize, 1), 50));
  },
};
