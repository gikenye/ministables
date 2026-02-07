function absoluteUrl(baseUrl: string, path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_URL ??
    "https://app.minilend.xyz";
  const accountAssociation = {
    header: process.env.FARCASTER_ACCOUNT_ASSOC_HEADER ?? "",
    payload: process.env.FARCASTER_ACCOUNT_ASSOC_PAYLOAD ?? "",
    signature: process.env.FARCASTER_ACCOUNT_ASSOC_SIGNATURE ?? "",
  };

  return Response.json({
    accountAssociation,
    miniapp: {
      version: "1",
      name: "Minilend",
      homeUrl: appUrl,
      iconUrl: absoluteUrl(appUrl, "/icons/icon-512x512.png"),
      splashImageUrl: absoluteUrl(appUrl, "/icons/icon-512x512.png"),
      splashBackgroundColor: "#162013",
      webhookUrl: absoluteUrl(appUrl, "/api/webhook"),
      subtitle: "Save with friends and family",
      description: "Save for your goals, and earn rewards",
      screenshotUrls: [
        absoluteUrl(appUrl, "/minilend-pwa.png"),
        absoluteUrl(appUrl, "/new-logo.png"),
        absoluteUrl(appUrl, "/placeholder-logo.png"),
      ],
      primaryCategory: "finance",
      tags: ["social", "savings", "payments", "baseapp"],
      heroImageUrl: absoluteUrl(appUrl, "/minilend-pwa.png"),
      tagline: "Save and borrow instantly",
      ogTitle: "Minilend",
      ogDescription: "Save for your goals, and earn rewards",
      ogImageUrl: absoluteUrl(appUrl, "/minilend-pwa.png"),
      noindex: false,
    },
  });
}
