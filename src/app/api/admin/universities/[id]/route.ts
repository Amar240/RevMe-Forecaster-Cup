import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await prisma.university.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'University deleted' })
  } catch (error) {
    console.error('Delete university error:', error)
    return NextResponse.json({ message: 'Failed to delete university' }, { status: 500 })
  }
}
