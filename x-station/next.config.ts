import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/en/front-desk',
        permanent: true,
        locale: false
      },
      {
        source: '/:lang(en|ar)',
        destination: '/:lang/front-desk',
        permanent: true,
        locale: false
      },
      {
        source: '/:path((?!en|ar|front-pages|images|api|favicon.ico|xstation.jpeg).*)*',
        destination: '/en/:path*',
        permanent: true,
        locale: false
      }
    ]
  }
}

export default nextConfig
