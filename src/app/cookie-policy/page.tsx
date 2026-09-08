import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Cookie Policy - Moneylix',
  description: 'Cookie Policy for Moneylix - Smart Finance Manager',
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#080d18] text-white">
      {/* Header */}
      <nav className="border-b border-white/8 bg-[#080d18]/95 backdrop-blur-2xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logos/moneylix-mark.svg" alt="Moneylix" width={30} height={30} className="rounded-xl" />
            <span className="text-lg font-black tracking-tight text-white">moneylix</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Cookie Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: June 2, 2026</p>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-10 text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help
              the site remember your preferences and improve your experience. Some cookies are
              essential for the site to function, while others help us understand how you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Cookies We Use</h2>
            <p className="mb-4">Moneylix uses only <strong className="text-white">essential cookies</strong>. We do not use advertising or third-party tracking cookies.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-white/10 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left px-4 py-3 text-white font-semibold border-b border-white/10">Cookie</th>
                    <th className="text-left px-4 py-3 text-white font-semibold border-b border-white/10">Purpose</th>
                    <th className="text-left px-4 py-3 text-white font-semibold border-b border-white/10">Duration</th>
                    <th className="text-left px-4 py-3 text-white font-semibold border-b border-white/10">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-400">moneylix_session_token</td>
                    <td className="px-4 py-3">Authentication — keeps you logged in</td>
                    <td className="px-4 py-3">7 days</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-400">moneylix_auth</td>
                    <td className="px-4 py-3">Stores login state (logged in/out)</td>
                    <td className="px-4 py-3">7 days</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-400">moneylix_plan</td>
                    <td className="px-4 py-3">Caches your subscription plan locally</td>
                    <td className="px-4 py-3">Session</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-400">moneylix_theme</td>
                    <td className="px-4 py-3">Remembers dark/light mode preference</td>
                    <td className="px-4 py-3">1 year</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Preference</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Local Storage</h2>
            <p>
              In addition to cookies, we use your browser&apos;s Local Storage for:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Session authentication tokens</li>
              <li>Active business selection</li>
              <li>Theme preference (dark/light)</li>
              <li>Subscription plan cache</li>
            </ul>
            <p className="mt-3">
              Local Storage data never leaves your device and is not sent to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Cookies</h2>
            <p>
              Moneylix does <strong className="text-white">not</strong> use:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Google Analytics or any analytics tracking cookies</li>
              <li>Facebook Pixel or social media tracking</li>
              <li>Advertising cookies or retargeting pixels</li>
              <li>Any cross-site tracking technology</li>
            </ul>
            <p className="mt-3">
              Razorpay (our payment processor) may set its own cookies during the checkout flow.
              These are governed by{' '}
              <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                Razorpay&apos;s Privacy Policy
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Managing Cookies</h2>
            <p>
              Since we only use essential cookies, disabling them may prevent the app from
              functioning correctly (e.g., you won&apos;t be able to stay logged in). You can manage
              cookies through your browser settings:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li><strong className="text-white">Chrome:</strong> Settings → Privacy and Security → Cookies</li>
              <li><strong className="text-white">Safari:</strong> Preferences → Privacy → Manage Website Data</li>
              <li><strong className="text-white">Firefox:</strong> Settings → Privacy & Security → Cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Updates</h2>
            <p>
              We may update this Cookie Policy if we introduce new features that require
              additional cookies. Changes will be reflected in the &ldquo;Last updated&rdquo; date above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Contact</h2>
            <p>
              Questions about our cookie usage? Contact us at{' '}
              <a href="mailto:privacy@moneylix.in" className="text-emerald-400 hover:underline">privacy@moneylix.in</a>
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-6 text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-emerald-400 transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-emerald-400 transition-colors">Home</Link>
        </div>
      </main>
    </div>
  )
}
