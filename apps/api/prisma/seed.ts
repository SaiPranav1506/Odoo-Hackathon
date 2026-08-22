// Demo seed for Dayflow.
// Run after migrating the database:  npm run db:seed
// Uses idempotent upserts so it is safe to re-run.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = 'Admin@123';

  // --- HR admin ---
  const hr = await prisma.user.upsert({
    where: { email: 'hr@dayflow.local' },
    update: {},
    create: {
      email: 'hr@dayflow.local',
      passwordHash: await hashPassword(seedPassword),
      role: 'HR',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          employeeId: 'HR-0000',
          firstName: 'Alex',
          lastName: 'Marshall',
          department: 'Human Resources',
          jobTitle: 'HR Officer',
          status: 'ACTIVE',
          leaveBalance: { create: {} },
        },
      },
    },
  });
  void hr;

  // --- Sample employees ---
  const employees = [
    { employeeId: 'EMP-0001', firstName: 'Sofia', lastName: 'Carter', email: 'sofia.carter@dayflow.local', department: 'Engineering', jobTitle: 'Software Engineer', gender: 'Female', employmentType: 'Full-time', phone: '+1 555 0101' },
    { employeeId: 'EMP-0002', firstName: 'Liam', lastName: 'Nguyen', email: 'liam.nguyen@dayflow.local', department: 'Engineering', jobTitle: 'QA Engineer', gender: 'Male', employmentType: 'Full-time', phone: '+1 555 0102' },
    { employeeId: 'EMP-0003', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@dayflow.local', department: 'Marketing', jobTitle: 'Marketing Lead', gender: 'Female', employmentType: 'Full-time', phone: '+1 555 0103' },
    { employeeId: 'EMP-0004', firstName: 'Omar', lastName: 'Haddad', email: 'omar.haddad@dayflow.local', department: 'Sales', jobTitle: 'Account Executive', gender: 'Male', employmentType: 'Contract', phone: '+1 555 0104' },
  ];

  for (const emp of employees) {
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        passwordHash: await hashPassword(seedPassword),
        role: 'EMPLOYEE',
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            employeeId: emp.employeeId,
            firstName: emp.firstName,
            lastName: emp.lastName,
            department: emp.department,
            jobTitle: emp.jobTitle,
            gender: emp.gender,
            employmentType: emp.employmentType,
            phone: emp.phone,
            address: '1 Main Street, Anytown',
            status: 'ACTIVE',
            leaveBalance: { create: {} },
          },
        },
      },
    });

    // Give each employee a salary structure so payroll demos work.
    const profile = await prisma.employeeProfile.findUnique({ where: { employeeId: emp.employeeId } });
    if (profile) {
      await prisma.salaryStructure.upsert({
        where: { employeeId: profile.id },
        update: {},
        create: {
          employeeId: profile.id,
          basicPay: 50000,
          housingAllowance: 8000,
          transportAllowance: 2000,
          taxPercent: 18,
          otherAllowances: { meal: 3000, bonuses: 1500 },
          otherDeductions: { insurance: 1200 },
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete.');
  console.log('   HR:        hr@dayflow.local  / Admin@123');
  console.log('   Employee:  sofia.carter@dayflow.local  / Admin@123');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });