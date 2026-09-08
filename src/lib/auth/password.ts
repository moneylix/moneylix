import bcrypt from 'bcryptjs'

/**
 * Hash a plain text password using bcrypt with a cost factor of 12.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(plain, salt)
}

/**
 * Validate a plain text password against a bcrypt hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // Graceful failure if somehow an empty hash is passed
  if (!hash) return false
  return bcrypt.compare(plain, hash)
}
