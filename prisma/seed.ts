import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function upsertUser(opts: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  orgId: string;
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  let user = await prisma.user.findUnique({ where: { email: opts.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: opts.email,
        name: opts.name,
        passwordHash,
        role: opts.role,
        isAdmin: opts.role === UserRole.admin,
        organizationId: opts.orgId,
      },
    });
    console.log(`✅ User created (${opts.role}):`, user.email);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: opts.name,
        role: opts.role,
        isAdmin: opts.role === UserRole.admin,
        passwordHash,
      },
    });
    console.log(`ℹ️ User updated (${opts.role}, password reset):`, user.email);
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo',
    },
  });

  await upsertUser({
    email: 'admin@demo.com',
    name: 'Admin User',
    password: 'admin123',
    role: UserRole.admin,
    orgId: org.id,
  });

  await upsertUser({
    email: 'reviewer@demo.com',
    name: 'Reviewer User',
    password: 'reviewer123',
    role: UserRole.reviewer,
    orgId: org.id,
  });

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
