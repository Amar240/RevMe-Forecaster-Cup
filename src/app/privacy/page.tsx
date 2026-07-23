import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for the RevME Forecaster Cup platform.',
}

const sections = [
  {
    title: 'Information We Collect',
    body:
      'RevME Forecaster Cup stores basic account information such as name, email address, institutional affiliation, competition activity, and forecasting submissions. Operational logs may also be retained for platform security, auditability, and scoring transparency.',
  },
  {
    title: 'How Information Is Used',
    body:
      'Platform data is used to operate the competition, manage teams, publish scores, support faculty administration, and maintain platform integrity. Information is not sold, and access is restricted according to platform roles and operational need.',
  },
  {
    title: 'Questions and Support',
    body:
      'If your program needs a detailed institutional privacy review, contact the RevME team before onboarding a new cohort. This public page is intentionally lightweight and can be replaced later with a full policy approved for production use.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <Badge variant="neutral">Legal</Badge>
          <h1 className="font-display text-4xl font-semibold text-foreground">Privacy Policy</h1>
          <p className="max-w-3xl text-lg leading-8 text-text-secondary">
            This page explains the baseline privacy expectations for RevME Forecaster Cup. It is intentionally concise for now and can be replaced with a fuller policy later.
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
