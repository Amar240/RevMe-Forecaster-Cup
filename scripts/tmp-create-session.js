const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@udel.edu' } })
  if (!user) {
    console.error('admin missing')
    process.exit(1)
  }
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { userId: user.id, token, expiresAt } })
  console.log(token)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
