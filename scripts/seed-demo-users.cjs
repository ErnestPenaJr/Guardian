// Seed dedicated demo company + one demo user per non-JAFAR role.
//
// Idempotent: re-running updates passwords / role assignments instead of duplicating.
//
//   bun scripts/seed-demo-users.cjs
//   node scripts/seed-demo-users.cjs
//
// Demo accounts (all use password "demo123"):
//   demo.admin@guardian-demo.local     -> ROLE_ID 1 (Admin)
//   demo.user@guardian-demo.local      -> ROLE_ID 2 (General User)
//   demo.processor@guardian-demo.local -> ROLE_ID 3 (Processor)
//   demo.manager@guardian-demo.local   -> ROLE_ID 4 (Manager)
//   demo.external@guardian-demo.local  -> ROLE_ID 5 (External User)

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_COMPANY_NAME = 'DEMO COMPANY';
const DEMO_PASSWORD = 'demo123';

const DEMO_USERS = [
  { email: 'demo.admin@guardian-demo.local',     firstName: 'Demo', lastName: 'Admin',     roleId: 1 },
  { email: 'demo.user@guardian-demo.local',      firstName: 'Demo', lastName: 'User',      roleId: 2 },
  { email: 'demo.processor@guardian-demo.local', firstName: 'Demo', lastName: 'Processor', roleId: 3 },
  { email: 'demo.manager@guardian-demo.local',   firstName: 'Demo', lastName: 'Manager',   roleId: 4 },
  { email: 'demo.external@guardian-demo.local',  firstName: 'Demo', lastName: 'External',  roleId: 5 },
];

async function upsertDemoCompany() {
  const existing = await prisma.cOMPANY.findFirst({ where: { NAME: DEMO_COMPANY_NAME } });
  if (existing) {
    console.log(`✓ Demo company exists (COMPANY_ID=${existing.COMPANY_ID})`);
    return existing;
  }
  const created = await prisma.cOMPANY.create({
    data: {
      NAME: DEMO_COMPANY_NAME,
      ADDRESS: 'Demo Environment',
      PHONE: '000-000-0000',
    },
  });
  console.log(`+ Created demo company (COMPANY_ID=${created.COMPANY_ID})`);
  return created;
}

async function upsertDemoUser(spec, companyId, passwordHash) {
  const existing = await prisma.uSERS.findFirst({ where: { EMAIL: spec.email } });
  if (existing) {
    await prisma.uSERS.update({
      where: { USER_ID: existing.USER_ID },
      data: {
        PASSWORD_HASH: passwordHash,
        STATUS: 'A',
        EMAIL_VALIDATED: true,
        COMPANY_ID: companyId,
        FIRST_NAME: spec.firstName,
        LAST_NAME: spec.lastName,
        UPDATE_DATE: new Date(),
      },
    });
    console.log(`✓ Updated demo user ${spec.email} (USER_ID=${existing.USER_ID})`);
    return existing.USER_ID;
  }
  const created = await prisma.uSERS.create({
    data: {
      EMAIL: spec.email,
      FIRST_NAME: spec.firstName,
      LAST_NAME: spec.lastName,
      STATUS: 'A',
      EMAIL_VALIDATED: true,
      PASSWORD_HASH: passwordHash,
      COMPANY_ID: companyId,
      CREATE_DATE: new Date(),
      UPDATE_DATE: new Date(),
    },
  });
  console.log(`+ Created demo user ${spec.email} (USER_ID=${created.USER_ID})`);
  return created.USER_ID;
}

async function ensureRoleAssignment(userId, roleId) {
  const existing = await prisma.uSER_ROLES.findFirst({ where: { USER_ID: userId, ROLE_ID: roleId } });
  if (existing) {
    if (existing.STATUS !== 'A') {
      await prisma.uSER_ROLES.update({
        where: { USER_ROLE_ID: existing.USER_ROLE_ID },
        data: { STATUS: 'A', UPDATE_DATE: new Date() },
      });
      console.log(`  ↺ Reactivated USER_ROLES (USER_ID=${userId}, ROLE_ID=${roleId})`);
    }
    return;
  }
  await prisma.uSER_ROLES.create({
    data: {
      USER_ID: userId,
      ROLE_ID: roleId,
      STATUS: 'A',
      CREATE_DATE: new Date(),
      UPDATE_DATE: new Date(),
    },
  });
  console.log(`  + Assigned ROLE_ID=${roleId} to USER_ID=${userId}`);
}

async function main() {
  console.log('Seeding demo company + demo users...\n');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const company = await upsertDemoCompany();

  for (const spec of DEMO_USERS) {
    const userId = await upsertDemoUser(spec, company.COMPANY_ID, passwordHash);
    await ensureRoleAssignment(userId, spec.roleId);
  }

  console.log('\nDone. Demo password for all accounts: demo123');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
