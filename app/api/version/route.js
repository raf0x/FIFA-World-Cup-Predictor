// Returns the commit SHA of whatever deployment is currently live.
// Vercel sets VERCEL_GIT_COMMIT_SHA automatically on every deploy — no
// manual versioning needed. Must stay dynamic so it always reflects the
// production deployment actually serving requests right now.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ sha: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' });
}
