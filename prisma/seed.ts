import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const adminEmail = 'admin@udel.edu'
  const adminPassword = 'Admin@123'

  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12)
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    })
    console.log('Admin user created: admin@udel.edu / Admin@123')
  } else {
    console.log('Admin user already exists')
  }

  console.log('\\n=== Admin Credentials ===')
  console.log('Admin:      admin@udel.edu / Admin@123')
  console.log('==========================\\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
