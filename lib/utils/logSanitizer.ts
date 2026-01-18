type SanitizedPayload = Record<string, unknown>;

const MASK_CONFIG: Record<string, { keepStart: number; keepEnd: number }> = {
  wallet_address: { keepStart: 4, keepEnd: 4 },
  address: { keepStart: 4, keepEnd: 4 },
  vault_address: { keepStart: 4, keepEnd: 4 },
  receipt_number: { keepStart: 2, keepEnd: 2 },
  phone_number: { keepStart: 2, keepEnd: 2 },
  shortcode: { keepStart: 2, keepEnd: 2 },
  callback_url: { keepStart: 8, keepEnd: 4 },
};

const DEFAULT_MASK = { keepStart: 2, keepEnd: 2 };

const ONRAMP_CALLBACK_FIELDS = [
  "shortcode",
  "amount",
  "mobile_network",
  "transaction_id",
  "status",
  "phone_number",
  "receipt_number",
  "transaction_code",
  "reference",
  "message",
  "public_name",
  "wallet_address",
];

const ONRAMP_WEBHOOK_FIELDS = [
  "transaction_code",
  "status",
  "receipt_number",
  "transaction_hash",
  "tx_hash",
  "amount_in_usd",
  "message",
  "event",
  "id",
  "timestamp",
];

const ONRAMP_INITIATE_FIELDS = [
  "shortcode",
  "amount",
  "fee",
  "mobile_network",
  "chain",
  "asset",
  "address",
  "callback_url",
  "currency_code",
  "vault_address",
];

const ONRAMP_CALLBACK_MASK_KEYS = new Set([
  "phone_number",
  "receipt_number",
  "wallet_address",
  "shortcode",
]);

const ONRAMP_WEBHOOK_MASK_KEYS = new Set([
  "receipt_number",
  "wallet_address",
  "phone_number",
]);

const ONRAMP_INITIATE_MASK_KEYS = new Set([
  "shortcode",
  "address",
  "callback_url",
  "vault_address",
]);

function maskString(value: string, keepStart: number, keepEnd: number): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= keepStart + keepEnd) {
    return "*".repeat(trimmed.length);
  }
  return `${trimmed.slice(0, keepStart)}***${trimmed.slice(-keepEnd)}`;
}

function maskSensitiveValue(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return value;
  const asString =
    typeof value === "string"
      ? value
      : typeof value === "number"
        ? value.toString()
        : null;
  if (asString === null) return "[redacted]";
  const config = MASK_CONFIG[key] || DEFAULT_MASK;
  return maskString(asString, config.keepStart, config.keepEnd);
}

function sanitizePayload(
  payload: unknown,
  fields: string[],
  maskKeys: Set<string>
): SanitizedPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const type = Array.isArray(payload) ? "array" : typeof payload;
    return { valueType: type };
  }

  const record = payload as Record<string, unknown>;
  const sanitized: SanitizedPayload = {};

  for (const key of fields) {
    if (!(key in record)) continue;
    const value = record[key];
    sanitized[key] = maskKeys.has(key)
      ? maskSensitiveValue(value, key)
      : value;
  }

  return sanitized;
}

export function sanitizeOnrampCallbackPayload(
  payload: unknown
): SanitizedPayload {
  return sanitizePayload(payload, ONRAMP_CALLBACK_FIELDS, ONRAMP_CALLBACK_MASK_KEYS);
}

export function sanitizeOnrampWebhookPayload(
  payload: unknown
): SanitizedPayload {
  return sanitizePayload(payload, ONRAMP_WEBHOOK_FIELDS, ONRAMP_WEBHOOK_MASK_KEYS);
}

export function sanitizeOnrampInitiatePayload(
  payload: unknown
): SanitizedPayload {
  return sanitizePayload(payload, ONRAMP_INITIATE_FIELDS, ONRAMP_INITIATE_MASK_KEYS);
}
