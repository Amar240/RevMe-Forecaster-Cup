import {
  SiteHeader,
  HeroSection,
  WhyJoinSection,
  StudentRoiSection,
  UniversityValueSection,
  TimelineSection,
  HowItWorksSection,
  LeaderboardSection,
  MarketsSection,
  SecuritySection,
  CommunitySection,
  ProfessorsSection,
  FaqSection,
  FinalCtaSection,
  SiteFooter,
} from '@/components/landing/sections'
import { Space_Grotesk, Manrope } from 'next/font/google'

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const body = Manrope({ subsets: ['latin'], variable: '--font-body' })

export default function Home() {
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen bg-white text-zinc-900 font-body`}>
      <SiteHeader />

      <main className="relative">
        <HeroSection />
        <WhyJoinSection />
        <StudentRoiSection />
        <UniversityValueSection />
        <TimelineSection />
        <HowItWorksSection />
        <LeaderboardSection />
        <MarketsSection />
        <SecuritySection />
        <CommunitySection />
        <ProfessorsSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <SiteFooter />
    </div>
  )
}
