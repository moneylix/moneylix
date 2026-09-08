import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { GlobalErrorToast } from '@/app/components/GlobalErrorToast'
import PWAInstallPrompt from '@/app/components/PWAInstallPrompt'
import { CookieBanner } from '@/app/components/CookieBanner'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#10b981',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Moneylix - Smart Finance Manager',
  description: 'Smart finance management for freelancers and small businesses in India. Track income, expenses & grow your money.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Moneylix',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Moneylix',
    'application-name': 'Moneylix',
    'msapplication-TileColor': '#10b981',
    'msapplication-tap-highlight': 'no',
  },
  icons: {
    apple: [
      { url: '/logos/moneylix-app-icon-dark.svg', sizes: '180x180' },
    ],
    icon: [
      { url: '/logos/moneylix-favicon.svg', type: 'image/svg+xml' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/logos/moneylix-app-icon-dark.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/logos/moneylix-app-icon-dark.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logos/moneylix-app-icon-dark.svg" />
        <link rel="apple-touch-icon" sizes="167x167" href="/logos/moneylix-app-icon-dark.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Moneylix" />
      </head>
      <body className="antialiased">
        {children}
        <GlobalErrorToast />
        <PWAInstallPrompt />
        <CookieBanner />
        <Script
          id="razorpay-checkout-js"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}
