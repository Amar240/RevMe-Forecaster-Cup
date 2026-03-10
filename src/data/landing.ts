import {
  Award,
  Globe,
  Clock,
  TrendingUp,
  Users,
  Target,
  Shield,
  Lock,
  ClipboardList,
  GraduationCap,
  Upload,
  Trophy,
  Sparkles,
  Building2,
  CheckCircle2,
  Briefcase,
  BarChart3,
  Medal,
  ChevronDown,
} from 'lucide-react'

export const brand = {
  name: 'RevME',
  year: 2026,
  tagline: 'RevME Forecaster Cup',
}

export const heroBadge = {
  icon: Sparkles,
  text: '2026 Season Now Open',
}

export const heroStats = [
  { value: 7, label: 'Rounds' },
  { value: 3, label: 'Markets' },
  { value: 2, label: 'Metrics' },
  { value: 1000, label: 'Prize', prefix: '$' },
]

export const trustSignals = [
  { label: 'Verified Teams', icon: CheckCircle2 },
  { label: 'Audit-Ready Scoring', icon: Shield },
  { label: 'Secure Submissions', icon: Lock },
]

export const howItWorks = [
  {
    step: 1,
    title: 'Register',
    description: 'Create your account and join a team in under a minute.',
    icon: GraduationCap,
    color: 'violet',
  },
  {
    step: 2,
    title: 'Forecast',
    description: 'Submit Occupancy and ADR predictions before the weekly deadline.',
    icon: Upload,
    color: 'blue',
  },
  {
    step: 3,
    title: 'Score',
    description: 'Actuals release after deadline. MAPE is computed automatically.',
    icon: Target,
    color: 'amber',
  },
  {
    step: 4,
    title: 'Compete',
    description: 'Climb the leaderboard across 7 rounds and prove your accuracy.',
    icon: Trophy,
    color: 'emerald',
  },
]

export const leaderboardData = [
  { rank: 1, team: 'Revenue Wizards', university: 'Cornell University', mape: '8.1%', trend: 'up' },
  { rank: 2, team: 'Forecast Masters', university: 'EHL Lausanne', mape: '8.4%', trend: 'up' },
  { rank: 3, team: 'Hotel Analytics', university: 'University of Houston', mape: '9.0%', trend: 'same' },
  { rank: 4, team: 'Demand Drivers', university: 'UNLV', mape: '9.7%', trend: 'down' },
  { rank: 5, team: 'Data Pioneers', university: 'NYU', mape: '10.2%', trend: 'up' },
]

export const markets = [
  {
    name: 'Nashville CBD',
    country: 'United States',
    color: 'violet' as const,
    desc: 'Event-driven demand and price-sensitive shoulder weeks.',
    signal: 'High volatility',
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    color: 'amber' as const,
    desc: 'Tourism cycles and global events create sharp seasonal peaks.',
    signal: 'Seasonality swings',
  },
  {
    name: 'Hamburg',
    country: 'Germany',
    color: 'emerald' as const,
    desc: 'Business and port-driven demand with stable baselines.',
    signal: 'Steady demand',
  },
]

export const universityFeatures = [
  {
    icon: Target,
    title: 'Competition Control Center',
    description: 'Configure seasons, deadlines, markets, and access levels in minutes.',
  },
  {
    icon: Shield,
    title: 'Audit-Ready Operations',
    description: 'Submissions, scoring, and changes are logged and fully transparent.',
  },
  {
    icon: Lock,
    title: 'Governance Built In',
    description: 'Warnings, approvals, and team constraints enforced by default.',
  },
  {
    icon: ClipboardList,
    title: 'Repeatable Every Year',
    description: 'Run new seasons without rebuilding the platform or workflows.',
  },
]

export const scoringFormula = [
  'APE = |Forecast - Actual| / Actual',
  'MAPE = average of all APE values',
  'Final = (Occupancy MAPE + ADR MAPE) / 2',
]

export const governanceBadges = [
  { label: 'Submissions locked after deadline', icon: Lock },
  { label: 'Audit log for every admin action', icon: Shield },
  { label: 'Role-based access controls', icon: Users },
]

export const faqItems = [
  {
    question: 'How does scoring work?',
    answer: 'Each prediction is scored using Absolute Percentage Error (APE). Your team MAPE is the average of all APE values across markets and metrics. Lower is better.',
  },
  {
    question: 'Why does this competition cost money?',
    answer: 'The platform funds verified scoring, secure submissions, and international benchmarking to keep results credible. Free trial weeks are available.',
  },
  {
    question: 'How are teams structured?',
    answer: 'Teams of 1-5 students, each with a supervisor. Supervisors manage up to 10 teams and approve join requests.',
  },
  {
    question: 'When are actuals released?',
    answer: 'Actuals are released weekly after the submission deadline closes to maintain fair scoring across all teams.',
  },
  {
    question: 'What if actual values are zero?',
    answer: 'Entries with actual=0 are excluded from MAPE calculations unless the prediction is also 0.',
  },
  {
    question: 'Can universities run this each year?',
    answer: 'Yes. Seasons are fully repeatable and managed through the admin control center with no rebuilding required.',
  },
]
