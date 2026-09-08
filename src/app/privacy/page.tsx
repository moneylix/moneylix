import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Privacy Policy - Moneylix',
  description: 'Privacy Policy for Moneylix - Smart Finance Manager for Indian Freelancers & SMBs',
}

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">Last updated: June 2, 2026</p>
          <p className="text-slate-400 text-sm mt-1">Effective date: June 2, 2026</p>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-10 text-slate-300 leading-relaxed">

          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p>
              Moneylix (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is a personal finance management
              application designed for freelancers, small business owners, and individuals in India.
              This Privacy Policy explains how we collect, use, store, and protect your personal
              information when you use our website (<a href="https://moneylix.in" className="text-emerald-400 hover:underline">moneylix.in</a>),
              mobile applications (iOS and Android), and related services (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p>
              By using Moneylix, you agree to the collection and use of information in accordance
              with this policy. This policy complies with the Digital Personal Data Protection Act,
              2023 (DPDP Act) of India and applicable international data protection standards.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Account Information:</strong> Name, email address, and password when you register</li>
              <li><strong className="text-white">Financial Data:</strong> Income, expenses, transactions, categories, and receivable records you manually enter</li>
              <li><strong className="text-white">Business Information:</strong> Business names and categories you create within the app</li>
              <li><strong className="text-white">Payment Information:</strong> Subscription payments are processed by Razorpay; we do not store your card/UPI details</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Device Information:</strong> Device type, operating system, app version</li>
              <li><strong className="text-white">Usage Data:</strong> Features used, session duration, and interaction patterns (anonymized)</li>
              <li><strong className="text-white">Log Data:</strong> IP address, browser type, and access timestamps for security</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">2.3 Bank Sync Data (Optional, Future Feature)</h3>
            <p>
              If you choose to connect your bank account via Account Aggregator (AA) framework,
              we will access transaction data only with your explicit consent, for the duration
              you specify, and only for the purpose of auto-importing transactions. This data is
              processed locally and not shared with third parties.
            </p>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your transactions and display financial summaries</li>
              <li>Provide AI-powered investment recommendations (using anonymized financial summaries)</li>
              <li>Send transactional emails (plan upgrades, password resets)</li>
              <li>Process subscription payments via Razorpay</li>
              <li>Detect and prevent fraud, abuse, and security issues</li>
              <li>Comply with legal obligations under Indian law</li>
            </ul>
          </section>

          {/* Data Storage & Security */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Storage & Security</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Your data is stored on secure servers hosted in India</li>
              <li>All data transmission is encrypted using SSL/TLS (HTTPS)</li>
              <li>Passwords are hashed using bcrypt and never stored in plain text</li>
              <li>Admin access is protected with bcrypt-authenticated credentials</li>
              <li>We implement access controls and regular security reviews</li>
            </ul>
            <p className="mt-4">
              While we implement industry-standard security measures, no method of electronic
              storage is 100% secure. We cannot guarantee absolute security but are committed
              to protecting your data to the best of our ability.
            </p>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Sharing & Third Parties</h2>
            <p className="mb-4">We do <strong className="text-white">not</strong> sell your personal data. We share data only with:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Razorpay:</strong> Payment processing for subscriptions (Razorpay&apos;s own privacy policy applies)</li>
              <li><strong className="text-white">Anthropic (Claude AI):</strong> Anonymized financial summaries for investment advice generation — no personal identifiers are sent</li>
              <li><strong className="text-white">Resend:</strong> Transactional email delivery</li>
              <li><strong className="text-white">Setu (future):</strong> Bank account sync via Account Aggregator framework, only with your explicit consent</li>
            </ul>
            <p className="mt-4">
              We may disclose information if required by law, court order, or government regulation.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Your Rights (DPDP Act Compliance)</h2>
            <p className="mb-4">Under the Digital Personal Data Protection Act, 2023, you have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Access:</strong> Request a copy of all personal data we hold about you</li>
              <li><strong className="text-white">Correction:</strong> Request correction of inaccurate data</li>
              <li><strong className="text-white">Erasure:</strong> Request deletion of your account and all associated data</li>
              <li><strong className="text-white">Withdraw Consent:</strong> Withdraw consent for data processing at any time</li>
              <li><strong className="text-white">Grievance Redressal:</strong> File a complaint with our Grievance Officer</li>
              <li><strong className="text-white">Nominate:</strong> Nominate another person to exercise your rights in case of death or incapacity</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, use the &ldquo;Delete Account&rdquo; option in your dashboard
              settings or contact us at the email below. We will respond within 30 days.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Your account data is retained as long as your account is active</li>
              <li>If you delete your account, all personal data is permanently erased within 30 days</li>
              <li>Anonymized, aggregated analytics data may be retained indefinitely</li>
              <li>Payment transaction records are retained for 7 years as required by Indian tax law</li>
            </ul>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Cookies & Local Storage</h2>
            <p>
              We use essential cookies and local storage for authentication (session tokens)
              and app preferences (theme, last-viewed business). We do <strong className="text-white">not</strong> use
              third-party tracking cookies or advertising cookies.
            </p>
          </section>

          {/* Children */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Children&apos;s Privacy</h2>
            <p>
              Moneylix is not intended for users under 18 years of age. We do not knowingly
              collect personal data from children. If we become aware that a child has provided
              us with personal data, we will delete it immediately.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              significant changes via email or an in-app notification. The &ldquo;Last updated&rdquo; date
              at the top reflects the most recent revision.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or wish to exercise your rights:</p>
            <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-6 space-y-2">
              <p><strong className="text-white">Moneylix</strong></p>
              <p>Email: <a href="mailto:privacy@moneylix.in" className="text-emerald-400 hover:underline">privacy@moneylix.in</a></p>
              <p>Website: <a href="https://moneylix.in" className="text-emerald-400 hover:underline">https://moneylix.in</a></p>
              <p className="text-sm text-slate-500 mt-4">
                Grievance Officer: Available at the email above. Response time: within 30 days.
              </p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-6 text-sm text-slate-500">
          <Link href="/terms" className="hover:text-emerald-400 transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-emerald-400 transition-colors">Home</Link>
          <Link href="/auth/login" className="hover:text-emerald-400 transition-colors">Sign In</Link>
        </div>
      </main>
    </div>
  )
}
