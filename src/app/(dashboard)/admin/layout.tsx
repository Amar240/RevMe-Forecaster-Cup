import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN') {
    redirect('/dashboard')
  }

  return children
}
