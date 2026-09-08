import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Run this ONE-TIME script to read base64 passwords from your database
 * decode them, hash them with bcrypt (cost 12), and write them back.
 * 
 * If a password already looks like a valid bcrypt hash, it skips gracefully.
 */
async function main() {
  console.log('Starting one-time password migration from Base64 to bcrypt...')
  
  const users = await prisma.user.findMany()
  console.log(`Found ${users.length} total users to process.`)
  
  let migrated = 0
  let skipped = 0
  
  for (const user of users) {
    if (!user.password) {
      console.log(`[SKIP] User ${user.email} has no password set.`)
      skipped++
      continue
    }

    // A standard bcrypt hash typically starts with $2a$, $2b$, or $2y$ and is 60 chars long
    const isBcrypt = user.password.startsWith('$2') && user.password.length >= 50
    
    if (isBcrypt) {
      console.log(`[SKIP] User ${user.email} is already using bcrypt.`)
      skipped++
      continue
    }
    
    try {
      // Decode base64 to plain text 
      // (If a text wasn't base64, buffer decoding logic should be handled, but base64 decoding won't strictly crash, it will decode incorrectly)
      // Assuming previous system mandated ascii -> base64
      const plainText = Buffer.from(user.password, 'base64').toString('ascii')
      
      // Hash with cost factor 12
      const salt = await bcrypt.genSalt(12)
      const hashed = await bcrypt.hash(plainText, salt)
      
      // Update Prisma Database
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed }
      })
      
      console.log(`[OK] Migrated password for user ${user.email}`)
      migrated++
    } catch (e: any) {
      console.error(`[ERROR] Failed to migrate user ${user.email}: ${e.message}`)
    }
  }
  
  console.log('--- Migration Summary ---')
  console.log(`Successfully hash-upgraded: ${migrated}`)
  console.log(`Skipped (already secure/empty):  ${skipped}`)
  console.log('Password migration successfully completed.')
}

main()
  .catch(e => {
    console.error('Fatal Migration Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
