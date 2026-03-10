import { LandingPage } from '@/components/landing/sections'
import { Space_Grotesk, Manrope } from 'next/font/google'

export const dynamic = 'force-dynamic'

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const body = Manrope({ subsets: ['latin'], variable: '--font-body' })

export default function Home() {
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen bg-canvas text-white font-body`}>
      <LandingPage />
    </div>
  )
}
