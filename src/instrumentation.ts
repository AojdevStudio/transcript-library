/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * This is the concrete server bootstrap/preflight entrypoint. In hosted mode,
 * it fails the deploy early if critical environment variables are missing.
 * In local dev, it logs warnings but never blocks startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run preflight on the Node.js server runtime, not the edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertPreflight } = await import("@/lib/hosted-config");
    assertPreflight();
  }
}
