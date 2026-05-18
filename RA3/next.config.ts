import type { NextConfig } from 'next'

const UPSTREAM_API =
  process.env.NEXT_PUBLIC_API_UPSTREAM ||
  'https://Solarsector.net/api/maintenance/engineers-ap/proc.php'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  rewrites: async () => {
    return [
      {
        // Same-origin proxy to avoid CORS preflight failures from the browser.
        // Frontend calls /maintenance-api?action=... → Next rewrites to upstream.
        source: '/maintenance-api',
        destination: UPSTREAM_API
      }
    ]
  }
}

export default nextConfig
