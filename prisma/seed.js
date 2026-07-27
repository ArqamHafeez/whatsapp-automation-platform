const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Check if org exists
  let org = await prisma.organization.findUnique({
    where: { slug: 'demo' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Demo Organization',
        slug: 'demo',
      },
    });
    console.log('✅ Organization created:', org.id);
  } else {
    console.log('ℹ️ Organization already exists:', org.id);
  }

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { email: 'admin@demo.com' },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    user = await prisma.user.create({
      data: {
        email: 'admin@demo.com',
        name: 'Admin User',
        passwordHash,
        isAdmin: true,
        organizationId: org.id,
      },
    });
    console.log('✅ Admin user created:', user.email);
  } else {
    console.log('ℹ️ Admin user already exists:', user.email);
  }

  // Check if connection exists
  let connection = await prisma.whatsAppConnection.findFirst({
    where: { name: 'main-instance' },
  });

  if (!connection) {
    connection = await prisma.whatsAppConnection.create({
      data: {
        orgId: org.id,
        name: 'main-instance',
        status: 'disconnected',
      },
    });
    console.log('✅ WhatsApp connection created:', connection.id);
  } else {
    console.log('ℹ️ WhatsApp connection already exists:', connection.id);
  }

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
