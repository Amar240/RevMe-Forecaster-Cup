const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatUniversityDisplayName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeUniversityName(name) {
  return formatUniversityDisplayName(name).toLowerCase()
}

function pickCanonicalUniversity(universities) {
  return [...universities].sort((left, right) => {
    const leftHasCountry = left.country ? 1 : 0
    const rightHasCountry = right.country ? 1 : 0

    if (leftHasCountry !== rightHasCountry) {
      return rightHasCountry - leftHasCountry
    }

    const leftIsTitled = left.name === left.name.replace(/\b\w/g, (char) => char.toUpperCase())
    const rightIsTitled = right.name === right.name.replace(/\b\w/g, (char) => char.toUpperCase())

    if (leftIsTitled !== rightIsTitled) {
      return rightIsTitled ? 1 : -1
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  })[0]
}

async function main() {
  const universities = await prisma.university.findMany({
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  })

  const grouped = new Map()
  for (const university of universities) {
    const normalizedName = normalizeUniversityName(university.normalizedName || university.name)
    const group = grouped.get(normalizedName) || []
    group.push(university)
    grouped.set(normalizedName, group)
  }

  let mergedGroups = 0
  let deletedUniversities = 0

  for (const [normalizedName, group] of grouped.entries()) {
    const canonical = pickCanonicalUniversity(group)
    const duplicates = group.filter((university) => university.id !== canonical.id)

    await prisma.university.update({
      where: { id: canonical.id },
      data: {
        name: formatUniversityDisplayName(canonical.name),
        normalizedName,
      },
    })

    if (duplicates.length === 0) {
      continue
    }

    mergedGroups += 1

    for (const duplicate of duplicates) {
      await prisma.$transaction([
        prisma.user.updateMany({
          where: { universityId: duplicate.id },
          data: { universityId: canonical.id },
        }),
        prisma.team.updateMany({
          where: { universityId: duplicate.id },
          data: { universityId: canonical.id },
        }),
      ])

      await prisma.university.delete({
        where: { id: duplicate.id },
      })

      deletedUniversities += 1
      console.log(`Merged "${duplicate.name}" into "${canonical.name}"`)
    }
  }

  console.log(`Done. Merged ${mergedGroups} groups and removed ${deletedUniversities} duplicate universities.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
