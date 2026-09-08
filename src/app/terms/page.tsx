import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Terms of Service - Moneylix',
  description: 'Terms of Service for Moneylix - Smart Finance Manager for Indian Freelancers & SMBs',
}

export default function TermsOfServicePage() {
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
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Terms of Service</h1>
          <p className="text-slate-400 text-sm">Last updated: June 2, 2026</p>
          <p className="text-slate-400 text-sm mt-1">Effective date: June 2, 2026</p>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-10 text-slate-300 leading-relaxed">

          {/* Agreement */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Agreement to Terms</h2>
            <p>
              By accessing or using Moneylix (the &ldquo;Service&rdquo;), available at{' '}
              <a href="https://moneylix.in" className="text-emerald-400 hover:underline">moneylix.in</a> and
              via our iOS and Android mobile applications, you agree to be bound by these Terms of
              Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you and Moneylix. The Service
              is intended for users who are at least 18 years of age and residents of India.
            </p>
          </section>

          {/* Description of Service */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p>Moneylix is a personal finance management platform that provides:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>Income and expense tracking with categorization</li>
              <li>Receivables management (tracking pending payments from clients)</li>
              <li>Financial dashboard with analytics and reports</li>
              <li>AI-powered investment recommendations (Premium plan)</li>
              <li>Multi-business financial management</li>
              <li>Bank account sync via Account Aggregator (future feature)</li>
            </ul>
            <p className="mt-4">
              Moneylix is a financial tracking tool, not a financial advisor, bank, or investment
              platform. AI-generated recommendations are for informational purposes only and should
              not be considered professional financial advice.
            </p>
          </section>

          {/* Accounts */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must not share your account with others or create multiple accounts</li>
              <li>You must notify us immediately if you suspect unauthorized access to your account</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
            </ul>
          </section>

          {/* Subscription & Payments */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Subscription Plans & Payments</h2>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">4.1 Plans</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-white">Free:</strong> Basic features, 1 business, limited functionality</li>
              <li><strong className="text-white">Pro (₹199/month or ₹1,788/year):</strong> Full transactions, reports, receivables, 3 businesses</li>
              <li><strong className="text-white">Premium (₹499/month or ₹3,588/year):</strong> All features including AI Advisor, unlimited businesses</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">4.2 Payment Processing</h3>
            <p>
              All payments are processed securely by Razorpay. By subscribing to a paid plan, you
              agree to Razorpay&apos;s terms of service. We do not store your payment card or UPI details.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">4.3 Billing & Renewal</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Subscriptions are billed in advance on a monthly or annual basis</li>
              <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
              <li>Price changes will be notified at least 30 days in advance</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">4.4 Refund Policy</h3>
            <p>
              We offer a full refund within 7 days of purchase if you are unsatisfied with the
              Service. After 7 days, refunds are not available for the current billing period.
              Contact us at <a href="mailto:support@moneylix.in" className="text-emerald-400 hover:underline">support@moneylix.in</a> to
              request a refund.
            </p>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Acceptable Use</h2>
            <p className="mb-3">You agree NOT to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Use the Service for any illegal purpose, including money laundering or tax evasion</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or our systems</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Use automated tools (bots, scrapers) to access the Service without our permission</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Resell or redistribute the Service without written authorization</li>
              <li>Use the AI features to generate content that is harmful, illegal, or misleading</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Intellectual Property</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>The Moneylix name, logo, UI design, and codebase are our intellectual property</li>
              <li>You retain ownership of all financial data you enter into the Service</li>
              <li>We do not claim any rights over your personal financial information</li>
              <li>You grant us a limited license to process your data solely to provide the Service</li>
            </ul>
          </section>

          {/* AI Disclaimer */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. AI Investment Advisor Disclaimer</h2>
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-6">
              <p className="text-amber-200 font-semibold mb-3">⚠️ Important Disclaimer</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>AI-generated investment recommendations are for <strong className="text-white">informational purposes only</strong></li>
                <li>They do not constitute professional financial, tax, or investment advice</li>
                <li>We are not a SEBI-registered investment advisor (RIA)</li>
                <li>You should consult a qualified financial advisor before making investment decisions</li>
                <li>Past performance indicators mentioned by AI do not guarantee future results</li>
                <li>We are not liable for any financial losses arising from AI recommendations</li>
              </ul>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-3">
              <li>The Service is provided &ldquo;as is&rdquo; without warranties of any kind</li>
              <li>We do not guarantee uninterrupted or error-free operation</li>
              <li>We are not liable for any indirect, incidental, or consequential damages</li>
              <li>Our total liability shall not exceed the amount you paid us in the preceding 12 months</li>
              <li>We are not responsible for data loss due to circumstances beyond our reasonable control</li>
            </ul>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Termination</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>You may delete your account at any time from your dashboard settings</li>
              <li>We may suspend or terminate your account for violation of these Terms</li>
              <li>Upon termination, your data will be deleted within 30 days (per our Privacy Policy)</li>
              <li>Sections regarding liability, intellectual property, and disputes survive termination</li>
            </ul>
          </section>

          {/* Data Protection */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Data Protection</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</Link>,
              which explains how we collect, use, and protect your personal data in compliance
              with the Digital Personal Data Protection Act, 2023 (DPDP Act).
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Governing Law & Disputes</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>These Terms are governed by the laws of India</li>
              <li>Any disputes shall be subject to the exclusive jurisdiction of courts in Kerala, India</li>
              <li>Before filing any claim, you agree to attempt informal resolution by contacting us</li>
            </ul>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be
              notified via email or in-app notification at least 15 days before taking effect.
              Continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Moneylix, its team, and affiliates from any
              claims, damages, or expenses arising from your use of the Service, violation of these
              Terms, or infringement of any third-party rights.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Contact Us</h2>
            <p>For questions about these Terms:</p>
            <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-6 space-y-2">
              <p><strong className="text-white">Moneylix</strong></p>
              <p>Email: <a href="mailto:support@moneylix.in" className="text-emerald-400 hover:underline">support@moneylix.in</a></p>
              <p>Website: <a href="https://moneylix.in" className="text-emerald-400 hover:underline">https://moneylix.in</a></p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-6 text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-emerald-400 transition-colors">Home</Link>
          <Link href="/auth/login" className="hover:text-emerald-400 transition-colors">Sign In</Link>
        </div>
      </main>
    </div>
  )
}
