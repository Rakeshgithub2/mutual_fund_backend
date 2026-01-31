import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  try {
    // Create admin user (without upsert to avoid transaction)
    const adminPassword = await hashPassword('admin123');
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@mutualfunds.com' },
    });

    let admin;
    if (!existingAdmin) {
      admin = await prisma.user.create({
        data: {
          email: 'admin@mutualfunds.com',
          password: adminPassword,
          name: 'Admin User',
          role: 'ADMIN',
          isVerified: true,
        },
      });
      console.log(`✓ Admin user created: ${admin.email}`);
    } else {
      admin = existingAdmin;
      console.log(`✓ Admin user already exists: ${admin.email}`);
    }

    // Create sample funds
    const funds = [
      {
        amfiCode: 'HDFC001',
        name: 'HDFC Top 100 Fund',
        type: 'EQUITY',
        category: 'EQUITY',
        subCategory: 'largecap',
        benchmark: 'Nifty 100',
        expenseRatio: 1.25,
        description: 'Large cap equity fund investing in top 100 companies',
        inceptionDate: new Date('2010-01-01'),
      },
      {
        amfiCode: 'ICICI001',
        name: 'ICICI Prudential Value Discovery Fund',
        type: 'EQUITY',
        category: 'EQUITY',
        subCategory: 'midcap',
        benchmark: 'Nifty Midcap 100',
        expenseRatio: 1.85,
        description: 'Mid cap value focused equity fund',
        inceptionDate: new Date('2012-06-15'),
      },
      {
        amfiCode: 'SBI001',
        name: 'SBI Small Cap Fund',
        type: 'EQUITY',
        category: 'EQUITY',
        subCategory: 'smallcap',
        benchmark: 'Nifty Smallcap 100',
        expenseRatio: 2.15,
        description: 'Small cap growth focused equity fund',
        inceptionDate: new Date('2015-03-20'),
      },
      {
        amfiCode: 'AXIS001',
        name: 'Axis Bluechip Fund',
        type: 'EQUITY',
        category: 'EQUITY',
        subCategory: 'largecap',
        benchmark: 'Nifty 50',
        expenseRatio: 0.65,
        description:
          'Flagship large cap fund focusing on quality bluechip stocks',
        inceptionDate: new Date('2008-12-29'),
      },
      {
        amfiCode: 'MIRAE001',
        name: 'Mirae Asset Emerging Bluechip Fund',
        type: 'EQUITY',
        category: 'EQUITY',
        subCategory: 'midcap',
        benchmark: 'Nifty Midcap 150',
        expenseRatio: 0.85,
        description: 'Mid cap fund investing in emerging quality businesses',
        inceptionDate: new Date('2013-07-03'),
      },
    ];

    let fundCount = 0;
    for (const fund of funds) {
      const existingFund = await prisma.fund.findUnique({
        where: { amfiCode: fund.amfiCode },
      });

      if (!existingFund) {
        await prisma.fund.create({
          data: fund,
        });
        fundCount++;
        console.log(`✓ Created fund: ${fund.name}`);
      } else {
        console.log(`✓ Fund already exists: ${fund.name}`);
      }
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log(
      `📊 Total funds: ${fundCount} new, ${funds.length - fundCount} existing`
    );
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
