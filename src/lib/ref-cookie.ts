// src/lib/ref-cookie.ts
//
// Pure referral-attribution cookie logic. Deliberately import-free so it can
// be unit-tested without the Next.js runtime (see src/middleware.ts for the
// NextRequest/NextResponse wiring that calls this).

export function resolveRefCookie(
  existingRef: string | undefined,
  subdomainSlug: string | null
): string | null {
  if (existingRef) return null; // first-write-wins
  if (!subdomainSlug) return null;
  return subdomainSlug;
}
