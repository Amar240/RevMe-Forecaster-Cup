const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const prisma = new PrismaClient()
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const universityName = process.env.ADMIN_UNIVERSITY_NAME || 'University of Delaware'

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.')
  }

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
    where: { name: universityName },
  })

  if (!university) {
    university = await prisma.university.create({
      data: { name: universityName },
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

  console.log(`Created admin user: ${email}`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
