const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUB_ADMIN'] } },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, emailVerified: true },
    orderBy: { createdAt: 'asc' },
  })
  if (admins.length === 0) {
    console.log('No admin users found in the database.')
    return
  }
  console.log('Admin users in database:')
  console.log(JSON.stringify(admins, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
