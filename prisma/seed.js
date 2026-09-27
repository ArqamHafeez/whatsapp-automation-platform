const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

<<<<<<< HEAD
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

=======
async function main() {
  console.log('🌱 Seeding database...');

  // Check if org exists
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
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

<<<<<<< HEAD
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

=======
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
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
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

<<<<<<< HEAD
  console.log('\n🎉 Seed complete!');
  console.log('Admin:    admin@demo.com / admin123');
  console.log('Reviewer: reviewer@demo.com / reviewer123');
=======
  console.log('\n🎉 Seed complete! Login with: admin@demo.com / admin123');
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
