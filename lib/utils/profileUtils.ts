// Username generator utility
const adjectives = [
  "Happy",
  "Lucky",
  "Bright",
  "Swift",
  "Clever",
  "Bold",
  "Calm",
  "Cool",
  "Epic",
  "Fast",
  "Golden",
  "Heroic",
  "Jolly",
  "Kind",
  "Loyal",
  "Magic",
  "Noble",
  "Quick",
  "Royal",
  "Smart",
  "Stellar",
  "Super",
  "Tidy",
  "Vivid",
  "Wise",
  "Zesty",
  "Brave",
  "Cosmic",
  "Dynamic",
  "Fresh",
  "Gentle",
  "Honest",
  "Iconic",
  "Joyful",
  "Keen",
  "Lively",
  "Mighty",
  "Natural",
  "Optimistic",
  "Peaceful",
  "Radiant",
  "Sincere",
  "Trusty",
  "Unique",
  "Vibrant",
  "Warm",
  "Zen",
];

const nouns = [
  "Tiger",
  "Eagle",
  "Lion",
  "Wolf",
  "Bear",
  "Fox",
  "Shark",
  "Falcon",
  "Panther",
  "Hawk",
  "Dragon",
  "Phoenix",
  "Thunder",
  "Lightning",
  "Storm",
  "Blaze",
  "Frost",
  "Wind",
  "Star",
  "Moon",
  "Sun",
  "Ocean",
  "Mountain",
  "River",
  "Forest",
  "Valley",
  "Peak",
  "Wave",
  "Flame",
  "Crystal",
  "Knight",
  "Warrior",
  "Guardian",
  "Champion",
  "Hero",
  "Legend",
  "Master",
  "Sage",
  "Explorer",
  "Pioneer",
  "Voyager",
  "Ranger",
  "Scout",
  "Hunter",
  "Seeker",
  "Wanderer",
  "Dreamer",
];

/**
 * Generate a random username based on wallet address
 * Uses the wallet address as a seed to ensure consistent usernames per address
 */
export function generateUsernameFromAddress(walletAddress: string): string {
  if (!walletAddress) return "Anonymous User";

  // Create a simple hash from the wallet address
  let hash = 0;
  for (let i = 0; i < walletAddress.length; i++) {
    const char = walletAddress.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value to handle negative hashes
  const positiveHash = Math.abs(hash);

  // Select adjective and noun based on hash
  const adjectiveIndex = positiveHash % adjectives.length;
  const nounIndex = Math.floor(positiveHash / adjectives.length) % nouns.length;

  const adjective = adjectives[adjectiveIndex];
  const noun = nouns[nounIndex];

  // Add a number based on part of the address for uniqueness
  const addressNumber = parseInt(walletAddress.slice(-4), 16) % 100;

  return `${adjective}${noun}${addressNumber}`;
}

/**
 * Get avatar URL based on wallet address using DiceBear API
 */
export function getAvatarUrl(
  walletAddress: string,
  style: "avataaars" | "bottts" | "identicon" | "initials" = "avataaars"
): string {
  if (!walletAddress) return "";

  // Use a reliable avatar service that generates consistent avatars based on seed
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${walletAddress}&backgroundColor=b6e3f4,c0aede,d1d4f9,fecaca,fed7aa,fef3c7`;
}

/**
 * Get member since date from wallet address creation estimate
 * For demo purposes, we'll use a fixed date but this could be enhanced
 */
export function getMemberSinceDate(walletAddress?: string): string {
  // Guard against falsy inputs
  if (!walletAddress) {
    return "";
  }

  // For now, return a consistent date based on the address
  // In a real app, you'd track actual user registration dates
  const hash = walletAddress.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const monthsAgo = (hash % 24) + 1; // 1-24 months ago

  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}

/**
 * Convert 3-letter country code to flag emoji
 * Maps Self Protocol country codes to their corresponding flag emojis
 */
export function countryCodeToFlag(countryCode: string): string {
  // Comprehensive mapping of 3-letter country codes to 2-letter ISO codes for flag display
  const countryMap: { [key: string]: string } = {
    AFG: "AF", // Afghanistan
    ALA: "AX", // Aland Islands
    ALB: "AL", // Albania
    DZA: "DZ", // Algeria
    ASM: "AS", // American Samoa
    AND: "AD", // Andorra
    AGO: "AO", // Angola
    AIA: "AI", // Anguilla
    ATA: "AQ", // Antarctica
    ATG: "AG", // Antigua and Barbuda
    ARG: "AR", // Argentina
    ARM: "AM", // Armenia
    ABW: "AW", // Aruba
    AUS: "AU", // Australia
    AUT: "AT", // Austria
    AZE: "AZ", // Azerbaijan
    BHS: "BS", // Bahamas
    BHR: "BH", // Bahrain
    BGD: "BD", // Bangladesh
    BRB: "BB", // Barbados
    BLR: "BY", // Belarus
    BEL: "BE", // Belgium
    BLZ: "BZ", // Belize
    BEN: "BJ", // Benin
    BMU: "BM", // Bermuda
    BTN: "BT", // Bhutan
    BOL: "BO", // Bolivia
    BES: "BQ", // Bonaire, Sint Eustatius and Saba
    BIH: "BA", // Bosnia and Herzegovina
    BWA: "BW", // Botswana
    BVT: "BV", // Bouvet Island
    BRA: "BR", // Brazil
    IOT: "IO", // British Indian Ocean Territory
    BRN: "BN", // Brunei
    BGR: "BG", // Bulgaria
    BFA: "BF", // Burkina Faso
    BDI: "BI", // Burundi
    CPV: "CV", // Cape Verde
    KHM: "KH", // Cambodia
    CMR: "CM", // Cameroon
    CAN: "CA", // Canada
    CYM: "KY", // Cayman Islands
    CAF: "CF", // Central African Republic
    TCD: "TD", // Chad
    CHL: "CL", // Chile
    CHN: "CN", // China
    CXR: "CX", // Christmas Island
    CCK: "CC", // Cocos Islands
    COL: "CO", // Colombia
    COM: "KM", // Comoros
    COG: "CG", // Congo
    COD: "CD", // DR Congo
    COK: "CK", // Cook Islands
    CRI: "CR", // Costa Rica
    CIV: "CI", // Ivory Coast
    HRV: "HR", // Croatia
    CUB: "CU", // Cuba
    CUW: "CW", // Curacao
    CYP: "CY", // Cyprus
    CZE: "CZ", // Czech Republic
    DNK: "DK", // Denmark
    DJI: "DJ", // Djibouti
    DMA: "DM", // Dominica
    DOM: "DO", // Dominican Republic
    ECU: "EC", // Ecuador
    EGY: "EG", // Egypt
    SLV: "SV", // El Salvador
    GNQ: "GQ", // Equatorial Guinea
    ERI: "ER", // Eritrea
    EST: "EE", // Estonia
    ETH: "ET", // Ethiopia
    FLK: "FK", // Falkland Islands
    FRO: "FO", // Faroe Islands
    FJI: "FJ", // Fiji
    FIN: "FI", // Finland
    FRA: "FR", // France
    GUF: "GF", // French Guiana
    PYF: "PF", // French Polynesia
    ATF: "TF", // French Southern Territories
    GAB: "GA", // Gabon
    GMB: "GM", // Gambia
    GEO: "GE", // Georgia
    DEU: "DE", // Germany
    GHA: "GH", // Ghana
    GIB: "GI", // Gibraltar
    GRC: "GR", // Greece
    GRL: "GL", // Greenland
    GRD: "GD", // Grenada
    GLP: "GP", // Guadeloupe
    GUM: "GU", // Guam
    GTM: "GT", // Guatemala
    GGY: "GG", // Guernsey
    GIN: "GN", // Guinea
    GNB: "GW", // Guinea-Bissau
    GUY: "GY", // Guyana
    HTI: "HT", // Haiti
    HMD: "HM", // Heard Island and McDonald Islands
    VAT: "VA", // Vatican City
    HND: "HN", // Honduras
    HKG: "HK", // Hong Kong
    HUN: "HU", // Hungary
    ISL: "IS", // Iceland
    IND: "IN", // India
    IDN: "ID", // Indonesia
    IRN: "IR", // Iran
    IRQ: "IQ", // Iraq
    IRL: "IE", // Ireland
    IMN: "IM", // Isle of Man
    ISR: "IL", // Israel
    ITA: "IT", // Italy
    JAM: "JM", // Jamaica
    JPN: "JP", // Japan
    JEY: "JE", // Jersey
    JOR: "JO", // Jordan
    KAZ: "KZ", // Kazakhstan
    KEN: "KE", // Kenya
    KIR: "KI", // Kiribati
    PRK: "KP", // North Korea
    KOR: "KR", // South Korea
    KWT: "KW", // Kuwait
    KGZ: "KG", // Kyrgyzstan
    LAO: "LA", // Laos
    LVA: "LV", // Latvia
    LBN: "LB", // Lebanon
    LSO: "LS", // Lesotho
    LBR: "LR", // Liberia
    LBY: "LY", // Libya
    LIE: "LI", // Liechtenstein
    LTU: "LT", // Lithuania
    LUX: "LU", // Luxembourg
    MAC: "MO", // Macao
    MKD: "MK", // North Macedonia
    MDG: "MG", // Madagascar
    MWI: "MW", // Malawi
    MYS: "MY", // Malaysia
    MDV: "MV", // Maldives
    MLI: "ML", // Mali
    MLT: "MT", // Malta
    MHL: "MH", // Marshall Islands
    MTQ: "MQ", // Martinique
    MRT: "MR", // Mauritania
    MUS: "MU", // Mauritius
    MYT: "YT", // Mayotte
    MEX: "MX", // Mexico
    FSM: "FM", // Micronesia
    MDA: "MD", // Moldova
    MCO: "MC", // Monaco
    MNG: "MN", // Mongolia
    MNE: "ME", // Montenegro
    MSR: "MS", // Montserrat
    MAR: "MA", // Morocco
    MOZ: "MZ", // Mozambique
    MMR: "MM", // Myanmar
    NAM: "NA", // Namibia
    NRU: "NR", // Nauru
    NPL: "NP", // Nepal
    NLD: "NL", // Netherlands
    NCL: "NC", // New Caledonia
    NZL: "NZ", // New Zealand
    NIC: "NI", // Nicaragua
    NER: "NE", // Niger
    NGA: "NG", // Nigeria
    NIU: "NU", // Niue
    NFK: "NF", // Norfolk Island
    MNP: "MP", // Northern Mariana Islands
    NOR: "NO", // Norway
    OMN: "OM", // Oman
    PAK: "PK", // Pakistan
    PLW: "PW", // Palau
    PSE: "PS", // Palestine
    PAN: "PA", // Panama
    PNG: "PG", // Papua New Guinea
    PRY: "PY", // Paraguay
    PER: "PE", // Peru
    PHL: "PH", // Philippines
    PCN: "PN", // Pitcairn
    POL: "PL", // Poland
    PRT: "PT", // Portugal
    PRI: "PR", // Puerto Rico
    QAT: "QA", // Qatar
    REU: "RE", // Reunion
    ROU: "RO", // Romania
    RUS: "RU", // Russia
    RWA: "RW", // Rwanda
    BLM: "BL", // Saint Barthelemy
    SHN: "SH", // Saint Helena
    KNA: "KN", // Saint Kitts and Nevis
    LCA: "LC", // Saint Lucia
    MAF: "MF", // Saint Martin
    SPM: "PM", // Saint Pierre and Miquelon
    VCT: "VC", // Saint Vincent and the Grenadines
    WSM: "WS", // Samoa
    SMR: "SM", // San Marino
    STP: "ST", // Sao Tome and Principe
    SAU: "SA", // Saudi Arabia
    SEN: "SN", // Senegal
    SRB: "RS", // Serbia
    SYC: "SC", // Seychelles
    SLE: "SL", // Sierra Leone
    SGP: "SG", // Singapore
    SXM: "SX", // Sint Maarten
    SVK: "SK", // Slovakia
    SVN: "SI", // Slovenia
    SLB: "SB", // Solomon Islands
    SOM: "SO", // Somalia
    ZAF: "ZA", // South Africa
    SGS: "GS", // South Georgia and the South Sandwich Islands
    SSD: "SS", // South Sudan
    ESP: "ES", // Spain
    LKA: "LK", // Sri Lanka
    SDN: "SD", // Sudan
    SUR: "SR", // Suriname
    SJM: "SJ", // Svalbard and Jan Mayen
    SWZ: "SZ", // Swaziland
    SWE: "SE", // Sweden
    CHE: "CH", // Switzerland
    SYR: "SY", // Syria
    TWN: "TW", // Taiwan
    TJK: "TJ", // Tajikistan
    TZA: "TZ", // Tanzania
    THA: "TH", // Thailand
    TLS: "TL", // Timor-Leste
    TGO: "TG", // Togo
    TKL: "TK", // Tokelau
    TON: "TO", // Tonga
    TTO: "TT", // Trinidad and Tobago
    TUN: "TN", // Tunisia
    TUR: "TR", // Turkey
    TKM: "TM", // Turkmenistan
    TCA: "TC", // Turks and Caicos Islands
    TUV: "TV", // Tuvalu
    UGA: "UG", // Uganda
    UKR: "UA", // Ukraine
    ARE: "AE", // United Arab Emirates
    GBR: "GB", // United Kingdom
    USA: "US", // United States
    UMI: "UM", // United States Minor Outlying Islands
    URY: "UY", // Uruguay
    UZB: "UZ", // Uzbekistan
    VUT: "VU", // Vanuatu
    VEN: "VE", // Venezuela
    VNM: "VN", // Vietnam
    VGB: "VG", // British Virgin Islands
    VIR: "VI", // US Virgin Islands
    WLF: "WF", // Wallis and Futuna
    ESH: "EH", // Western Sahara
    YEM: "YE", // Yemen
    ZMB: "ZM", // Zambia
    ZWE: "ZW", // Zimbabwe
  };

  const twoLetterCode = countryMap[countryCode?.toUpperCase()];
  if (!twoLetterCode) return "";

  // Convert two-letter country code to flag emoji
  return twoLetterCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}
