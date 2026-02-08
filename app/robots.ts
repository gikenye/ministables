import { MetadataRoute } from "next";

const SITE_URL = "https://ministables.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/error"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
