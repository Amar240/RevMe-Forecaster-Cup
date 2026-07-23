'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PartyPopper } from 'lucide-react'

export function OneTimeCelebration({ eventKey, children }: { eventKey: string | null; children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!eventKey) return
    const key = `revme:celebration:v1:${eventKey}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, new Date().toISOString())
    setVisible(true)
  }, [eventKey])
  if (!visible) return null
  return <motion.div role="status" initial={reduced ? false : { opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-semibold"><PartyPopper className="h-5 w-5 text-accent" aria-hidden="true" />{children}<button onClick={() => setVisible(false)} className="ml-auto rounded px-2 py-1 text-xs text-text-secondary hover:bg-card focus-visible:ring-2 focus-visible:ring-ring" aria-label="Dismiss celebration">Dismiss</button></motion.div>
}
