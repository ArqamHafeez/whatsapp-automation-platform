<<<<<<< HEAD
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('./dist/auth/auth.service');

(async () => {
  const prisma = new PrismaClient();
  const jwt = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret' });
  const service = new AuthService(prisma, jwt);
  try {
    const result = await service.register('test@example.com', '123456', 'Test User', 'demo-org');
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error('ERR_TYPE', err && err.constructor ? err.constructor.name : 'unknown');
    console.error('ERR_MESSAGE', err && err.message);
    console.error('ERR_RESPONSE', err && err.response);
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
=======
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('./dist/auth/auth.service');

(async () => {
  const prisma = new PrismaClient();
  const jwt = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret' });
  const service = new AuthService(prisma, jwt);
  try {
    const result = await service.register('test@example.com', '123456', 'Test User', 'demo-org');
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error('ERR_TYPE', err && err.constructor ? err.constructor.name : 'unknown');
    console.error('ERR_MESSAGE', err && err.message);
    console.error('ERR_RESPONSE', err && err.response);
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
