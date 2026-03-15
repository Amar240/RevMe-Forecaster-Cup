import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Serif, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

const display = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono',
})

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'RevME Forecaster Cup',
  description: 'Hospitality Revenue Management Forecasting Competition Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${body.variable} ${display.variable} ${mono.variable} font-body bg-background text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
