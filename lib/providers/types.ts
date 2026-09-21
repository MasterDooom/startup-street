export type NormalizedLead = {
  id: string;
  provider: string;
  providerId: string;
  name: string;
  type: string;
  category: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  website: string;
  phone: string;
  mapsUrl: string;
  source: string;
  retrievedAt: string;
  rating?: number | null;
  reviewCount?: number | null;
  businessStatus?: string | null;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
};

export interface LeadProvider {
  readonly id: string;
  search(input: { query: string; city?: string; pageSize?: number }): Promise<NormalizedLead[]>;
}
