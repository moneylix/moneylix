import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration from SQLite to PostgreSQL...');
  
  // Connect to the legacy SQLite database
  const sqliteDbPath = path.join(process.cwd(), 'moneyflow.db');
  console.log(`Reading from SQLite: ${sqliteDbPath}`);
  const sqlite = new Database(sqliteDbPath, { readonly: true });
  
  // Helpers
  const parseDate = (d: any) => d ? new Date(d) : undefined;
  
  try {
    // -------------------------------------------------------------------------
    // 1. Users
    // -------------------------------------------------------------------------
    console.log('Migrating Users...');
    const users = sqlite.prepare('SELECT * FROM users').all() as any[];
    for (const user of users) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          username: user.username,
          email: user.email,
          password: user.password,
          role: user.role ?? 'user',
          currency: 'INR', // SQLite doesn't have a currency field in users table, default applied
          createdAt: parseDate(user.created_at) || new Date(),
          updatedAt: new Date()
        }
      });
    }
    console.log(`✅ ${users.length} users migrated.`);

    // -------------------------------------------------------------------------
    // 2. Businesses
    // -------------------------------------------------------------------------
    console.log('Migrating Businesses...');
    const businesses = sqlite.prepare('SELECT * FROM businesses').all() as any[];
    for (const biz of businesses) {
      await prisma.business.upsert({
        where: { id: biz.id },
        update: {},
        create: {
          id: biz.id,
          userId: biz.user_id,
          name: biz.name,
          currency: biz.currency || 'INR',
          createdAt: parseDate(biz.created_at) || new Date(),
          updatedAt: new Date()
        }
      });
    }
    console.log(`✅ ${businesses.length} businesses migrated.`);

    // -------------------------------------------------------------------------
    // 3. Categories
    // -------------------------------------------------------------------------
    console.log('Migrating Categories...');
    const categories = sqlite.prepare('SELECT * FROM categories').all() as any[];
    for (const cat of categories) {
      await prisma.category.upsert({
        where: { id: cat.id },
        update: {},
        create: {
          id: cat.id,
          businessId: cat.business_id,
          name: cat.name,
          icon: cat.icon,
          color: cat.color || '#22c55e',
          type: cat.type || 'both',
          createdAt: parseDate(cat.created_at) || new Date()
        }
      });
    }
    console.log(`✅ ${categories.length} categories migrated.`);

    // -------------------------------------------------------------------------
    // 4. Transactions
    // -------------------------------------------------------------------------
    console.log('Migrating Transactions...');
    const transactions = sqlite.prepare('SELECT * FROM transactions').all() as any[];
    for (const tx of transactions) {
      await prisma.transaction.upsert({
        where: { id: tx.id },
        update: {},
        create: {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          categoryId: tx.category_id,
          businessId: tx.business_id,
          currency: tx.currency || 'INR',
          date: tx.date,
          dueDate: tx.due_date,
          reminderDays: tx.reminder_days || 3,
          note: tx.note,
          method: tx.method || 'cash',
          tags: tx.tags,
          status: tx.status || 'completed',
          clientName: tx.client_name,
          createdAt: parseDate(tx.created_at) || new Date(),
          updatedAt: parseDate(tx.updated_at) || new Date()
        }
      });
    }
    console.log(`✅ ${transactions.length} transactions migrated.`);

    // -------------------------------------------------------------------------
    // 5. Sessions
    // -------------------------------------------------------------------------
    console.log('Migrating Sessions...');
    const sessions = sqlite.prepare('SELECT * FROM sessions').all() as any[];
    for (const s of sessions) {
      await prisma.session.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          userId: s.user_id,
          token: s.token,
          expiresAt: parseDate(s.expires_at) || new Date(Date.now() + 30 * 24 * 3600 * 1000),
          createdAt: parseDate(s.created_at) || new Date()
        }
      });
    }
    console.log(`✅ ${sessions.length} sessions migrated.`);

    // -------------------------------------------------------------------------
    // 6. Subscriptions
    // -------------------------------------------------------------------------
    console.log('Migrating Subscriptions...');
    const subscriptions = sqlite.prepare('SELECT * FROM subscriptions').all() as any[];
    for (const sub of subscriptions) {
      await prisma.subscription.upsert({
        where: { id: sub.id },
        update: {},
        create: {
          id: sub.id,
          userId: sub.user_id,
          plan: sub.plan,
          status: sub.status,
          startedAt: parseDate(sub.started_at) || new Date(),
          expiresAt: parseDate(sub.expires_at),
          amountPaid: sub.amount_paid,
          paymentMethod: sub.payment_method,
          notes: sub.notes,
          createdAt: parseDate(sub.created_at) || new Date(),
          updatedAt: new Date()
        }
      });
    }
    console.log(`✅ ${subscriptions.length} subscriptions migrated.`);

    // -------------------------------------------------------------------------
    // 7. Feature Requests
    // -------------------------------------------------------------------------
    console.log('Migrating Feature Requests...');
    const featureRequests = sqlite.prepare('SELECT * FROM feature_requests').all() as any[];
    for (const fr of featureRequests) {
      await prisma.featureRequest.upsert({
        where: { id: fr.id },
        update: {},
        create: {
          id: fr.id,
          title: fr.title,
          description: fr.description,
          status: fr.status,
          votes: fr.votes,
          createdAt: parseDate(fr.created_at) || new Date()
        }
      });
    }
    console.log(`✅ ${featureRequests.length} feature requests migrated.`);

    // Important: Update PostgreSQL sequence after manual ID inserts
    console.log('Updating PostgreSQL sequences...');
    await prisma.$executeRawUnsafe(`SELECT setval('"users_id_seq"', (SELECT MAX(id) FROM "users"));`);
    await prisma.$executeRawUnsafe(`SELECT setval('"businesses_id_seq"', (SELECT MAX(id) FROM "businesses"));`);
    await prisma.$executeRawUnsafe(`SELECT setval('"categories_id_seq"', (SELECT MAX(id) FROM "categories"));`);
    await prisma.$executeRawUnsafe(`SELECT setval('"transactions_id_seq"', (SELECT MAX(id) FROM "transactions"));`);
    await prisma.$executeRawUnsafe(`SELECT setval('"sessions_id_seq"', (SELECT MAX(id) FROM "sessions"));`);
    await prisma.$executeRawUnsafe(`SELECT setval('"subscriptions_id_seq"', (SELECT MAX(id) FROM "subscriptions"));`);
    await prisma.$executeRawUnsafe(`SELECT setval('"feature_requests_id_seq"', (SELECT MAX(id) FROM "feature_requests"));`);

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main();
