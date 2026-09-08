import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY || 're_dummy_123'
export const resend = new Resend(resendApiKey)

// You must verify this domain in Resend for emails to hit inboxes
const FROM_EMAIL = 'Moneylix <noreply@moneylix.in>'

export async function sendVerificationEmail(to: string, token: string, name: string) {
  const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`
  
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Confirm your Moneylix Account',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
        <h1 style="color: #38bdf8; margin-bottom: 24px;">Welcome to Moneylix, ${name}!</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1; margin-bottom: 32px;">
          You're one step away from taking full control of your finances. Please verify your email address to activate your dashboard.
        </p>
        <a href="${verifyLink}" style="display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: 800; border-radius: 8px; font-size: 16px; margin-bottom: 32px;">
          Verify Email Address
        </a>
        <p style="font-size: 12px; color: #64748b;">
          If you didn't create this account, please ignore this email. Or copy this link: <br />
          <span style="color: #38bdf8;">${verifyLink}</span>
        </p>
      </div>
    `
  })
}

export async function sendWelcomeEmail(to: string, name: string) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Welcome to the Moneylix Ecosystem 🚀',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
        <h1 style="color: #10b981; margin-bottom: 24px;">Verification Complete!</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1;">
          Hi ${name}, your email is now officially verified. You can log into your account and begin tracking your wealth journey.
        </p>
      </div>
    `
  })
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`
  
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Reset your Moneylix Password',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
        <h1 style="color: #f59e0b; margin-bottom: 24px;">Password Reset Request</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1; margin-bottom: 32px;">
          We received a request to reset your password. Click the button below to set a new one. This link will expire in 1 hour.
        </p>
        <a href="${resetLink}" style="display: inline-block; background-color: #f59e0b; color: #000; padding: 14px 28px; text-decoration: none; font-weight: 800; border-radius: 8px; font-size: 16px; margin-bottom: 32px;">
          Reset Password
        </a>
      </div>
    `
  })
}

export async function sendPlanUpgradeEmail(to: string, plan: string, expiry: Date) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Upgraded to ${plan.toUpperCase()} Plan 🎉`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
        <h1 style="color: #10b981; margin-bottom: 24px;">Payment Successful!</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1;">
          Thank you for trusting Moneylix. Your account has successfully been upgraded to the <strong>${plan.toUpperCase()}</strong> tier.
          <br /><br />
          Next billing date: <strong>${expiry.toLocaleDateString()}</strong>
        </p>
      </div>
    `
  })
}

export type RecapData = { credit: number; debit: number; pending: number }

export async function sendWeeklyRecapEmail(to: string, data: RecapData) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Your Moneylix Weekly Recap 📊',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #334155;">
        <h1 style="color: #38bdf8; margin-bottom: 24px;">Weekly Financial Recap</h1>
        
        <table style="width: 100%; border-collapse: separate; border-spacing: 0 10px;">
          <tr style="background-color: #1e293b;">
             <td style="padding: 15px; border-top-left-radius: 8px; border-bottom-left-radius: 8px; font-weight: bold; color: #10b981;">Total Income</td>
             <td style="padding: 15px; border-top-right-radius: 8px; border-bottom-right-radius: 8px; text-align: right; font-family: monospace;">₹${data.credit.toLocaleString()}</td>
          </tr>
          <tr style="background-color: #1e293b;">
             <td style="padding: 15px; border-top-left-radius: 8px; border-bottom-left-radius: 8px; font-weight: bold; color: #ef4444;">Total Spend</td>
             <td style="padding: 15px; border-top-right-radius: 8px; border-bottom-right-radius: 8px; text-align: right; font-family: monospace;">₹${data.debit.toLocaleString()}</td>
          </tr>
          <tr style="background-color: #1e293b;">
             <td style="padding: 15px; border-top-left-radius: 8px; border-bottom-left-radius: 8px; font-weight: bold; color: #f59e0b;">Pending Receivables</td>
             <td style="padding: 15px; border-top-right-radius: 8px; border-bottom-right-radius: 8px; text-align: right; font-family: monospace;">₹${data.pending.toLocaleString()}</td>
          </tr>
        </table>
        
        <p style="margin-top: 30px; color: #cbd5e1; font-size: 14px;">Log in to your dashboard to view complete analytics and OCR receipts.</p>
      </div>
    `
  })
}
