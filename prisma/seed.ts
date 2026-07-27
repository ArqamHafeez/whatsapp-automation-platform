import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const org = await prisma.organization.create({
    data: {
      name: 'Demo Organization',
      slug: 'demo',
    },
  });
  console.log('✅ Organization created:', org.id);

  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      name: 'Admin User',
      passwordHash,
      isAdmin: true,
      organizationId: org.id,
    },
  });
  console.log('✅ Admin user created:', user.email);

  console.log('\n🎉 Seed complete! Login with: admin@demo.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
