import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addNavData() {
  console.log('Adding NAV data for funds...');

  try {
    // Get all funds
    const funds = await prisma.fund.findMany();
    console.log(`Found ${funds.length} funds`);

    // Generate NAV data for the last 365 days
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 365);

    for (const fund of funds) {
      console.log(`\nAdding NAV data for: ${fund.name}`);

      // Starting NAV based on fund category
      let baseNav = 100;
      if (fund.category === 'LARGE_CAP') baseNav = 250;
      else if (fund.category === 'MID_CAP') baseNav = 180;
      else if (fund.category === 'SMALL_CAP') baseNav = 120;

      // Generate daily NAV data
      const navRecords = [];
      let currentNav = baseNav;
      const currentDate = new Date(startDate);

      while (currentDate <= today) {
        // Skip weekends
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
          // Random daily change between -2% to +2%
          const change = (Math.random() - 0.5) * 0.04;
          currentNav = currentNav * (1 + change);

          navRecords.push({
            fundId: fund.id,
            date: new Date(currentDate),
            nav: parseFloat(currentNav.toFixed(2)),
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`  Generated ${navRecords.length} NAV records`);

      // Insert NAV records in batches
      const batchSize = 100;
      for (let i = 0; i < navRecords.length; i += batchSize) {
        const batch = navRecords.slice(i, i + batchSize);

        try {
          await prisma.fundPerformance.createMany({
            data: batch,
          });
        } catch (error) {
          console.log(
            `  Warning: Some records in batch ${Math.floor(i / batchSize) + 1} may already exist`
          );
        }

        console.log(
          `  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(navRecords.length / batchSize)}`
        );
      }

      console.log(`  ✓ Completed ${fund.name}`);
    }

    console.log('\n🎉 NAV data added successfully!');
  } catch (error) {
    console.error('Error adding NAV data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addNavData();
