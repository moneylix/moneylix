import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'

export type SessionData = {
  userId?: number
  isLoggedIn: boolean
}

export const sessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD || 'complex_password_at_least_32_characters_long_for_security',
  cookieName: 'moneylix_iron_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
}

export async function getSession() {
  const c = cookies()
  const session = await getIronSession<SessionData>(c, sessionOptions)

  if (!session.isLoggedIn) {
    session.isLoggedIn = false
  }

  return session
}
