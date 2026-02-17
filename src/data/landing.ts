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
  CalendarClock,
  MapPin,
  Medal,
} from 'lucide-react'

export const heroStats = [
  { value: 7, label: 'Rounds per season' },
  { value: 3, label: 'Global markets' },
  { value: 2, label: 'Metrics per round' },
  { value: 1000, label: 'Prize for 1st place' },
]

export const trustSignals = [
  { label: 'Verified teams', icon: CheckCircle2 },
  { label: 'Audit ready scoring', icon: Shield },
  { label: 'Secure submissions', icon: Lock },
]

export const whyStudentsJoin = [
  {
    icon: Award,
    title: 'Portfolio ready evidence',
    description: 'Weekly forecasting sprints with clear accuracy signals you can explain and defend.',
  },
  {
    icon: Globe,
    title: 'International competition',
    description: 'Compete against teams across universities in multiple countries.',
  },
  {
    icon: Clock,
    title: 'Professional workflow',
    description: 'Deadlines, locked submissions, and round based scoring built in.',
  },
  {
    icon: TrendingUp,
    title: 'Benchmark your progress',
    description: 'Track your rank by round and compare against teams nationwide.',
  },
  {
    icon: Users,
    title: 'Team plus mentor model',
    description: 'Work with a supervisor and learn the decision cadence of real teams.',
  },
]

export const studentRoi = [
  {
    icon: Briefcase,
    title: 'Resume ready proof',
    description: 'Show a ranked, auditable record of forecasting accuracy across rounds.',
  },
  {
    icon: Medal,
    title: 'Prize and recognition',
    description: 'Earn awards and a $1,000 top team prize that signals real performance.',
  },
  {
    icon: BarChart3,
    title: 'Skill progression',
    description: 'Weekly feedback helps you improve and explain variance like a pro.',
  },
]

export const universityBenefits = [
  {
    icon: Building2,
    title: 'Program credibility',
    description: 'Demonstrate student outcomes with a standardized competition benchmark.',
  },
  {
    icon: Shield,
    title: 'Compliance friendly',
    description: 'Role based access, audit trails, and locked submissions protect integrity.',
  },
  {
    icon: Users,
    title: 'Recruitment advantage',
    description: 'Promote a global competition that differentiates your hospitality program.',
  },
]

export const leaderboardData = [
  { rank: 1, team: 'Revenue Wizards', university: 'Cornell University', trend: 'up' },
  { rank: 2, team: 'Forecast Masters', university: 'EHL Lausanne', trend: 'up' },
  { rank: 3, team: 'Hotel Analytics', university: 'University of Houston', trend: 'same' },
  { rank: 4, team: 'Demand Drivers', university: 'UNLV', trend: 'down' },
  { rank: 5, team: 'Data Pioneers', university: 'NYU', trend: 'up' },
]

export const professorFeatures = [
  {
    icon: Target,
    title: 'Competition control center',
    description: 'Configure seasons, deadlines, markets, and access levels in minutes.',
  },
  {
    icon: Shield,
    title: 'Audit ready operations',
    description: 'Submissions, scoring, and changes are logged and transparent.',
  },
  {
    icon: Lock,
    title: 'Governance built in',
    description: 'Warnings, approvals, and team constraints are enforced by default.',
  },
  {
    icon: ClipboardList,
    title: 'Repeatable every year',
    description: 'Run new seasons without rebuilding the platform or workflows.',
  },
]

export const howItWorks = [
  {
    step: 1,
    title: 'Register',
    description: 'Create your student account in under a minute.',
    icon: GraduationCap,
  },
  {
    step: 2,
    title: 'Join a team',
    description: 'Request your supervisor and get added to a team.',
    icon: Users,
  },
  {
    step: 3,
    title: 'Submit forecasts',
    description: 'Enter Occupancy and ADR predictions before the deadline.',
    icon: Upload,
  },
  {
    step: 4,
    title: 'Track results',
    description: 'Rankings update after actuals are released each round.',
    icon: TrendingUp,
  },
]

export const seasonTimeline = [
  { label: 'Round 1 opens', detail: 'Week 1 forecast window', icon: CalendarClock },
  { label: 'Round 2', detail: 'Submit predictions', icon: CalendarClock },
  { label: 'Round 3', detail: 'Leaderboard update', icon: Trophy },
  { label: 'Round 4', detail: 'Mid season checkpoint', icon: Target },
  { label: 'Round 5', detail: 'Scoring release', icon: BarChart3 },
  { label: 'Round 6', detail: 'Final stretch', icon: TrendingUp },
  { label: 'Round 7', detail: 'Final rankings', icon: Medal },
]

export const markets = [
  {
    name: 'Nashville CBD',
    country: 'United States',
    color: 'blue',
    desc: 'Event driven demand and price sensitive shoulder weeks.',
    signal: 'High volatility',
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    color: 'amber',
    desc: 'Tourism cycles and global events create sharp seasonal peaks.',
    signal: 'Seasonality swings',
  },
  {
    name: 'Hamburg',
    country: 'Germany',
    color: 'emerald',
    desc: 'Business and port driven demand with stable baselines.',
    signal: 'Steady demand',
  },
]

export const securityHighlights = [
  {
    icon: Shield,
    title: 'Verified roles',
    description: 'Students, supervisors, and admins are gated by role based access controls.',
  },
  {
    icon: Lock,
    title: 'Locked submissions',
    description: 'Forecasts lock at deadline with an audit trail on every change.',
  },
  {
    icon: ClipboardList,
    title: 'Transparent scoring',
    description: 'Every scoring run is recorded and reviewable by organizers.',
  },
  {
    icon: Building2,
    title: 'University ready',
    description: 'Multi team oversight, approvals, and compliance friendly workflows.',
  },
]

export const faqItems = [
  {
    question: 'Why does this competition cost money?',
    answer: 'The platform funds verified scoring, secure submissions, and international benchmarking to keep results credible.',
  },
  {
    question: 'How do you protect the data?',
    answer: 'Role based access, locked submissions, and audit logs protect the integrity of forecasts and results.',
  },
  {
    question: 'What do students get besides the prize?',
    answer: 'A ranked record of performance, resume ready proof, and measurable forecasting skill progression.',
  },
  {
    question: 'Can universities run this each year?',
    answer: 'Yes, seasons are repeatable and fully managed by the admin control center.',
  },
]

export const heroBadge = {
  icon: Sparkles,
  text: '2026 season now open',
}

export const brand = {
  name: 'RevME',
  year: 2026,
  tagline: 'RevME Forecaster Cup',
}
