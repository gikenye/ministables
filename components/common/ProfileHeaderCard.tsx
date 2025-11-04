import React from "react";
import { generateUsernameFromAddress } from "@/lib/utils/profileUtils";

// Comprehensive mapping of 3-letter country codes to 2-letter ISO codes for flag display
const countryToEmoji = (countryCode: string): string => {
  // Complete mapping of Self protocol 3-letter codes to 2-letter ISO codes
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
    SWZ: "SZ", // Eswatini
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
    "D<<": "DE", // Germany (alternative)
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
    GNB: "GW", // Guinea Bissau
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
    MKD: "MK", // North Macedonia
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
    SHN: "SH", // Saint Helena, Ascension and Tristan da Cunha
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
    SWE: "SE", // Sweden
    CHE: "CH", // Switzerland
    SYR: "SY", // Syrian Arab Republic
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
    VNM: "VN", // Viet Nam
    VGB: "VG", // Virgin Islands British
    VIR: "VI", // Virgin Islands US
    WLF: "WF", // Wallis and Futuna
    ESH: "EH", // Western Sahara
    YEM: "YE", // Yemen
    ZMB: "ZM", // Zambia
    ZWE: "ZW", // Zimbabwe
  };

  // Use mapped code or assume it's already 2-letter
  const twoLetterCode =
    countryMap[countryCode.toUpperCase()] || countryCode.toUpperCase();

  // Only process if we have exactly 2 characters
  if (twoLetterCode.length !== 2) {
    return "🏳️"; // Default flag for invalid codes
  }

  const codePoints = twoLetterCode
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Generate a deterministic avatar from wallet address
const generateAvatar = (address: string): string => {
  // Use a simple hash to generate consistent colors
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 70 + (Math.abs(hash) % 30); // 70-100%
  const lightness = 45 + (Math.abs(hash) % 20); // 45-65%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

interface ProfileHeaderCardProps {
  walletAddress: string;
  memberSince: string;
  countryCode?: string;
}

export const ProfileHeaderCard = ({
  walletAddress,
  memberSince,
  countryCode,
}: ProfileHeaderCardProps) => {
  const username = generateUsernameFromAddress(walletAddress);
  const avatarColor = generateAvatar(walletAddress);

  return (
    <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 rounded-2xl p-4 mx-4 mt-3 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent"></div>

      <div className="relative flex flex-col items-center">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full mb-3 flex items-center justify-center text-white text-lg font-bold shadow-lg"
          style={{ backgroundColor: avatarColor }}
        >
          {username.slice(0, 2).toUpperCase()}
        </div>

        {/* Username and Country */}
        <div className="flex items-center gap-1.5 mb-2">
          <h1 className="text-lg font-bold text-white">{username}</h1>
          {countryCode && (
            <span className="text-lg" title={`From ${countryCode}`}>
              {countryToEmoji(countryCode)}
            </span>
          )}
        </div>

        {/* Wallet Address */}
        <p className="text-xs text-purple-200 mb-2 font-mono">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </p>

        {/* Member Since */}
        <p className="text-xs text-purple-300">Member since {memberSince}</p>
      </div>
    </div>
  );
};
