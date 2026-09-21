// Temporary diagnostic - runs unconditionally on every `next build`/`next dev`
// since next.config.js is always loaded regardless of how the build was
// invoked (bypasses uncertainty about whether npm lifecycle hooks like
// prebuild actually ran). Remove once the Render module-resolution issue
// is resolved.
;(function renderDebug() {
  const fs = require('fs')
  const path = require('path')
  console.log('=== RENDER-DEBUG (next.config.js) START ===')
  console.log('cwd:', process.cwd())
  console.log('node version:', process.version)
  const targets = [
    'src/components/ui/Button.tsx',
    'src/components/ui/Input.tsx',
    'src/components/ui/Badge.tsx',
    'src/lib/utils/format.ts',
  ]
  for (const t of targets) {
    const full = path.join(process.cwd(), t)
    console.log(`exists(${t}):`, fs.existsSync(full))
  }
  try {
    console.log('ls src/components/ui/:', fs.readdirSync(path.join(process.cwd(), 'src/components/ui')).sort().join(', '))
  } catch (e) { console.log('ERROR ls ui:', e.message) }
  try {
    console.log('ls src/lib/utils/:', fs.readdirSync(path.join(process.cwd(), 'src/lib/utils')).sort().join(', '))
  } catch (e) { console.log('ERROR ls utils:', e.message) }
  console.log('=== RENDER-DEBUG (next.config.js) END ===')
})()

/** @type {import('next').NextConfig} */
// Temporarily removed entirely (not just its own `disable` flag): next-pwa's
// withPWA() wrapper, even with disable:true, changes how Next.js composes a
// user-supplied webpack() function - combining the two triggered a spurious
// "Cannot find module for page: /_document" PageNotFoundError during
// "Collecting page data" that doesn't happen with either piece alone. Since
// this build also needs a custom webpack() (see below, for a separate
// Render-only module-resolution issue), dropping withPWA entirely was the
// clean way to keep both working. Re-add and investigate once live.
//
// const withPWA = require('next-pwa')({
//   dest: 'public',
//   register: true,
//   skipWaiting: true,
//   disable: true,
//   runtimeCaching: [
//     {
//       urlPattern: /^https:\/\/moneylix\.in\/.*/i,
//       handler: 'NetworkFirst',
//       options: {
//         cacheName: 'moneylix-cache',
//         expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
//       },
//     },
//   ],
// })

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://checkout.razorpay.com https://cdn.razorpay.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.razorpay.com https://cdn.razorpay.com https://lumberjack.razorpay.com https://generativelanguage.googleapis.com",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  experimental: { instrumentationHook: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  // Explicit absolute-path aliases for 3 modules (Button.tsx, Input.tsx,
  // format.ts) that Render's production build consistently fails to
  // resolve via the normal tsconfig-based "@/*" alias, despite the files
  // being verified present, correctly cased, and resolvable via plain
  // Node.js require.resolve() at that exact build path (see git history
  // around this line for the investigation). Bypasses whatever's going
  // wrong in the tsconfig-paths webpack plugin for just these targets by
  // resolving them to an absolute path computed from this file's own
  // location, which doesn't depend on the same mechanism that's failing.
  webpack(config, options) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/components/ui/Button': path.resolve(__dirname, 'src/components/ui/Button.tsx'),
      '@/components/ui/Input': path.resolve(__dirname, 'src/components/ui/Input.tsx'),
      '@/lib/utils/format': path.resolve(__dirname, 'src/lib/utils/format.ts'),
    }
    return config
  },
}

module.exports = nextConfig
