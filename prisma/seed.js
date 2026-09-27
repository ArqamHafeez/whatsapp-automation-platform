const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function upsertUser({ email, name, password, role, orgId }) {
  const passwordHash = await bcrypt.hash(password, 10);
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        isAdmin: role === 'admin',
        organizationId: orgId,
      },
    });
    console.log(`✅ User created (${role}):`, user.email);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        role,
        isAdmin: role === 'admin',
        passwordHash,
      },
    });
    console.log(`ℹ️ User updated (${role}, password reset):`, user.email);
  }
  return user;
}

async function main() {
  console.log('🌱 Seeding database...');

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

  await upsertUser({
    email: 'admin@demo.com',
    name: 'Admin User',
    password: 'admin123',
    role: 'admin',
    orgId: org.id,
  });

  await upsertUser({
    email: 'reviewer@demo.com',
    name: 'Reviewer User',
    password: 'reviewer123',
    role: 'reviewer',
    orgId: org.id,
  });

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

  console.log('\n🎉 Seed complete!');
  console.log('Admin:    admin@demo.com / admin123');
  console.log('Reviewer: reviewer@demo.com / reviewer123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
