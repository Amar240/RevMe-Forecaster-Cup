import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/sections'

export const metadata: Metadata = {
  title: 'The Only Student Competition Scored on Real Hotel Data',
  description:
    'Compete across 7 scored rounds, forecast occupancy and ADR in live hotel markets, and build a forecasting track record before you graduate.',
  openGraph: {
    title: 'RevME Forecaster Cup',
    description:
      'Compete across 7 scored rounds, forecast occupancy and ADR in live hotel markets, and build a forecasting track record before you graduate.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RevME Forecaster Cup',
    description:
      'Compete across 7 scored rounds, forecast occupancy and ADR in live hotel markets, and build a forecasting track record before you graduate.',
  },
}

export default function Home() {
  return (
    <div className="min-h-screen font-body">
      <LandingPage />
    </div>
  )
}
