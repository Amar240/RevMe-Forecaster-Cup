import { redirect } from 'next/navigation'

export default async function LegacyDebriefLayout({ params }: { children: React.ReactNode; params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  redirect(`/debrief/${roundId}`)
}
