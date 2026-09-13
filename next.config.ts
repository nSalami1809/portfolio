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
    // Every remote image here comes from Vercel Blob, whose URLs are
    // content-addressed: a replaced image gets a new URL, so the bytes behind
    // a given URL never change and can be cached for a year.
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // User-uploaded photos/logos/icons live on Vercel Blob — next/image
    // refuses to load remote images whose host isn't explicitly allow-listed.
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
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
          // React needs unsafe-eval in dev; WASM instantiation needs it in prod
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
          // Framer Motion + Tailwind write inline styles at runtime
          "style-src 'self' 'unsafe-inline'",
          // Vercel Blob-hosted uploads (images)
          "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
          // Vercel Blob-hosted uploads (video clips)
          "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
          // next/font self-hosts — no external font CDN
          "font-src 'self' data:",
          // Server actions/API are same-origin; Vercel Blob for uploaded assets
          "connect-src 'self' https://*.public.blob.vercel-storage.com",
          // three.js / CodeMirror instantiate Web Workers from blob: URLs
          "worker-src blob: 'self'",
          "child-src blob: 'self'",
          // Nothing is embedded in an iframe anywhere in the app
          "frame-src 'none'",
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
