import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = "admin_digikan";
  const adminPassword = "digikan357";

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existingAdmin) {
    console.log(`Admin user "${adminUsername}" already exists. Skipping seed.`);
    return;
  }

  // Hash the password
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Create the admin user
  const admin = await prisma.user.create({
    data: {
      username: adminUsername,
      passwordHash,
      role: "admin",
    },
  });

  console.log(`Admin user "${adminUsername}" created with id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
