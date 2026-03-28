import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for the RevME Forecaster Cup platform.',
}

const sections = [
  {
    title: 'Use of the Platform',
    body:
      'RevME Forecaster Cup provides a hosted forecasting competition experience for students, faculty, and program administrators. By using the platform, participants agree to submit forecasts honestly, protect their login credentials, and follow the published competition rules.',
  },
  {
    title: 'Competition Participation',
    body:
      'Scores, rankings, warnings, and eligibility outcomes are determined according to the season rules and published scoring methodology. RevME may suspend access for abuse, tampering, or any activity that compromises competition integrity.',
  },
  {
    title: 'Institutional Access',
    body:
      'Supervisors, administrators, and partner programs are responsible for managing participation within their own institutions. Faculty and staff should review competition settings, timelines, and student access before each season begins.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <Badge variant="neutral">Legal</Badge>
          <h1 className="font-display text-4xl font-semibold text-foreground">Terms of Service</h1>
          <p className="max-w-3xl text-lg leading-8 text-text-secondary">
            These terms outline the baseline expectations for using RevME Forecaster Cup. A fuller legal version can replace this page later without changing the route structure.
          </p>
          <Link href="/" className="text-sm font-medium text-primary transition-colors hover:text-primary-hover">
            Back to home
          </Link>
        </div>

        <div className="grid gap-6">
          {sections.map((section) => (
            <Card key={section.title} className="border-border">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-text-secondary">{section.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
