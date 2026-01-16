import "server-only";

export const GAS_SPONSORSHIP_CONFIG = {
  ENABLED: process.env.NEXT_PUBLIC_GAS_SPONSORSHIP_ENABLED === "true",
  SPONSOR_PK: process.env.GAS_SPONSOR_PK,
};
