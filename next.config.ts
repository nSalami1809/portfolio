import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    optimizePackageImports: [
      'framer-motion',
      '@react-three/fiber',
      '@react-three/drei',
      'three',
    ],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production'

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // frame-ancestors supersedes X-Frame-Options in modern browsers
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // React needs unsafe-eval in dev; Spline WASM needs it in prod too
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
          // Framer Motion + Tailwind write inline styles at runtime
          "style-src 'self' 'unsafe-inline'",
          // Vercel Blob-hosted uploads (images) + Spline textures/blobs
          "img-src 'self' data: blob: https://*.spline.design https://*.public.blob.vercel-storage.com",
          // Vercel Blob-hosted uploads (video clips)
          "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
          // next/font self-hosts — no external font CDN
          "font-src 'self' data:",
          // Spline loads scene + assets from CDN; server actions/API same-origin
          "connect-src 'self' https://*.spline.design https://*.public.blob.vercel-storage.com",
          // Spline uses Web Workers + WASM via blob: URLs
          "worker-src blob: 'self'",
          "child-src blob: 'self'",
          // Allow embedding Spline scenes via iframe; block everything else
          "frame-src https://my.spline.design",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
      ...(isProd
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
        : []),
    ]

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
