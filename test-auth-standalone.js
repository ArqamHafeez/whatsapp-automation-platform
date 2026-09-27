const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testLogin() {
  console.log('Testing login...');
  
  const user = await prisma.user.findUnique({ where: { email: 'admin@demo.com' } });
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  const valid = await bcrypt.compare('admin123', user.passwordHash);
  if (!valid) {
    console.log('❌ Password incorrect');
    return;
  }
  
  const token = jwt.sign(
    { userId: user.id, orgId: user.organizationId },
    'dev-secret',
    { expiresIn: '7d' }
  );
  
  console.log('✅ Login successful!');
  console.log('Token:', token.substring(0, 50) + '...');
  console.log('User:', { id: user.id, email: user.email, name: user.name });
}

testLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
