/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Vercel sets this automatically per-deploy; falls back to 'dev' locally.
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
};

module.exports = nextConfig;
