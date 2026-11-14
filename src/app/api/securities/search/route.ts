import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter, validateQuery } from "@/lib/market-data/rateLimit";
import { getProvider } from "@/lib/market-data/server";
import { ProviderError } from "@/lib/market-data/types";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(30, 60_000);

/**
 * GET /api/securities/search?q=AAPL
 * Receives only the search text. No values or portfolio data are accepted.
 * Queries are never logged.
 */
export async function GET(req: NextRequest) {
  const provider = getProvider();
  if (!provider) return NextResponse.json({ error: "Security search is not enabled." }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = limiter(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const q = validateQuery(req.nextUrl.searchParams.get("q"));
  if (!q) return NextResponse.json({ error: "Enter 1–40 letters or digits." }, { status: 400 });

  try {
    const results = await provider.search(q, AbortSignal.timeout(6000));
    return NextResponse.json(
      { provider: provider.info, results },
      // Short private cache only; adjust to the provider's caching terms.
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 502;
    const message = err instanceof ProviderError ? err.message : "Security search is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status });
  }
}
