const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const prisma = new PrismaClient()
  const email = 'admin@udel.edu'
  const password = 'Admin@123'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', emailVerified: true },
    })
    console.log('Updated existing user to ADMIN')
    await prisma.$disconnect()
    return
  }

  let university = await prisma.university.findUnique({
    where: { name: 'University of Delaware' },
  })

  if (!university) {
    university = await prisma.university.create({
      data: { name: 'University of Delaware' },
    })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      emailVerified: true,
      universityId: university.id,
    },
  })

  console.log('Created admin user')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
