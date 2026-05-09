/**
 * Curated country / dial-code / state data for sign-up + profile forms.
 *
 * Kept inline (rather than pulled from country-state-city, which is ~6MB)
 * because we only need ~30 countries and the resulting payload is tiny
 * — under 4KB — and shippable without a new dependency or migration.
 *
 * Add a country here and it shows up in:
 *   - ProfileCompleteGate Country dropdown
 *   - PhoneInput dial-code picker
 *   - The State dropdown (if STATES has an entry for the ISO code)
 *
 * Cities remain free-text — the dataset for cities is enormous and the
 * customer's compliance flow already accepts free text in that field.
 */

export interface Country {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** International dial code without the leading '+'. Stored as a string
   *  because some codes are multi-digit (e.g. 91, 880, 358). */
  dial: string;
  /** Optional flag emoji — purely cosmetic in the dropdown. */
  flag?: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'IN', name: 'India',                 dial: '91',  flag: '🇮🇳' },
  { code: 'AE', name: 'United Arab Emirates',  dial: '971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia',          dial: '966', flag: '🇸🇦' },
  { code: 'GB', name: 'United Kingdom',        dial: '44',  flag: '🇬🇧' },
  { code: 'US', name: 'United States',         dial: '1',   flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',                dial: '1',   flag: '🇨🇦' },
  { code: 'AU', name: 'Australia',             dial: '61',  flag: '🇦🇺' },
  { code: 'SG', name: 'Singapore',             dial: '65',  flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia',              dial: '60',  flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia',             dial: '62',  flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines',           dial: '63',  flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand',              dial: '66',  flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam',               dial: '84',  flag: '🇻🇳' },
  { code: 'JP', name: 'Japan',                 dial: '81',  flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea',           dial: '82',  flag: '🇰🇷' },
  { code: 'DE', name: 'Germany',               dial: '49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',                dial: '33',  flag: '🇫🇷' },
  { code: 'IT', name: 'Italy',                 dial: '39',  flag: '🇮🇹' },
  { code: 'ES', name: 'Spain',                 dial: '34',  flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands',           dial: '31',  flag: '🇳🇱' },
  { code: 'BR', name: 'Brazil',                dial: '55',  flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico',                dial: '52',  flag: '🇲🇽' },
  { code: 'ZA', name: 'South Africa',          dial: '27',  flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria',               dial: '234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya',                 dial: '254', flag: '🇰🇪' },
  { code: 'EG', name: 'Egypt',                 dial: '20',  flag: '🇪🇬' },
  { code: 'TR', name: 'Turkey',                dial: '90',  flag: '🇹🇷' },
  { code: 'PK', name: 'Pakistan',              dial: '92',  flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh',            dial: '880', flag: '🇧🇩' },
  { code: 'LK', name: 'Sri Lanka',             dial: '94',  flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal',                 dial: '977', flag: '🇳🇵' },
];

export function findCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  const c = code.toUpperCase();
  return COUNTRIES.find((x) => x.code === c);
}

/** Look up a country by its full name (matches the value stored on
 *  User.country in our DB — see ProfileCompleteGate, where the option
 *  value is `c.name`). */
export function findCountryByName(name: string | null | undefined): Country | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return COUNTRIES.find((x) => x.name.toLowerCase() === n);
}

/* ─── States ──────────────────────────────────────────────────────────────
 * Per-country state/province lists. Keyed by ISO alpha-2. Countries not
 * keyed here fall back to a plain text input in the form — the dropdown
 * just disappears so the user can still type a state.
 *
 * Values stored on User.state are the human-readable name (e.g.
 * "Maharashtra"), not the abbreviation, to match what the existing
 * profile form already wrote.
 * ─────────────────────────────────────────────────────────────────────── */

export const STATES: Record<string, readonly string[]> = {
  IN: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal',
    // Union territories
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ],
  US: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
    'District of Columbia',
  ],
  CA: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan',
    'Northwest Territories', 'Nunavut', 'Yukon',
  ],
  AU: [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory',
    'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
  ],
  GB: [
    'England', 'Scotland', 'Wales', 'Northern Ireland',
  ],
  AE: [
    'Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah',
    'Sharjah', 'Umm Al Quwain',
  ],
  SA: [
    "'Asir", 'Al Bahah', 'Al Jawf', 'Al Madinah', 'Al-Qassim', 'Eastern Province',
    "Ha'il", 'Jizan', 'Makkah', 'Najran', 'Northern Borders', 'Riyadh', 'Tabuk',
  ],
  PK: [
    'Azad Kashmir', 'Balochistan', 'Gilgit-Baltistan', 'Islamabad Capital Territory',
    'Khyber Pakhtunkhwa', 'Punjab', 'Sindh',
  ],
  BD: [
    'Barisal', 'Chittagong', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi',
    'Rangpur', 'Sylhet',
  ],
  SG: ['Central', 'East', 'North', 'North-East', 'West'],
  MY: [
    'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Malacca',
    'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya',
    'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  ],
  ID: [
    'Aceh', 'Bali', 'Bangka Belitung Islands', 'Banten', 'Bengkulu', 'Central Java',
    'Central Kalimantan', 'Central Sulawesi', 'East Java', 'East Kalimantan',
    'East Nusa Tenggara', 'Gorontalo', 'Jakarta', 'Jambi', 'Lampung', 'Maluku',
    'North Kalimantan', 'North Maluku', 'North Sulawesi', 'North Sumatra',
    'Papua', 'Riau', 'Riau Islands', 'South Kalimantan', 'South Sulawesi',
    'South Sumatra', 'Southeast Sulawesi', 'West Java', 'West Kalimantan',
    'West Nusa Tenggara', 'West Papua', 'West Sulawesi', 'West Sumatra', 'Yogyakarta',
  ],
};

export function statesFor(countryCodeOrName: string | null | undefined): readonly string[] | undefined {
  if (!countryCodeOrName) return undefined;
  const upper = countryCodeOrName.toUpperCase();
  if (STATES[upper]) return STATES[upper];
  const byName = findCountryByName(countryCodeOrName);
  return byName ? STATES[byName.code] : undefined;
}
