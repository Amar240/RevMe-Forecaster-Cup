import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Globe,
  Globe2,
  GraduationCap,
  Lock,
  Shield,
  Target,
  Trophy,
  Upload,
  Users,
} from 'lucide-react'

export const brand = {
  name: 'RevME',
  year: 2026,
  tagline: 'RevME Forecaster Cup',
}

export const heroBadge = {
  icon: Clock3,
  label: '2026 Season Open',
}

export const countdownDeadline = '2026-03-21T23:59:00-04:00'

export const countdownClosedText = 'Round 1 Closed — Season Continues'

export const heroCopy = {
  kicker: 'The Only Student Competition Scored on Real Hotel Data',
  student: {
    headline: 'Prove you can forecast like a revenue analyst — before you graduate.',
    subtext:
      "Every week, three live hotel markets release actuals. Your forecast either holds or it doesn't. Compete across 7 scored rounds — MAPE-ranked against teams from programs in 8 countries — and graduate with a forecasting track record that speaks before your resume does.",
  },
  professor: {
    headline: 'Your students will forecast the same metrics your industry partners use every Monday morning.',
    subtext:
      'RevME puts your cohort into a live forecasting cycle: real markets, weekly deadlines, automated MAPE scoring, and a leaderboard that makes performance visible. Faculty run it in minutes. Students talk about it for years.',
  },
}

export const heroStats = [
  { displayValue: '$1,000', label: 'Prize Pool — Top Forecasting Team' },
  { displayValue: '50+ Teams', label: 'Competing Across 8 Countries' },
  { displayValue: '~12% → 8%', label: 'Avg. MAPE Improvement, Rounds 1–7' },
  { displayValue: '7 Rounds', label: 'Weekly Scored Forecasts, Live Results' },
]

export const trustSignals = [
  { label: '50+ Active Teams', icon: Users },
  { label: '12 Universities', icon: Building2 },
  { label: '8 Countries', icon: Globe },
]

export const proofStrip = [
  { label: 'Teams from 12+ universities', icon: Globe2 },
  { label: 'Scored weekly on published MAPE', icon: Target },
  { label: 'Live leaderboard after every round', icon: Trophy },
  { label: 'Audit-ready for academic programs', icon: Shield },
]

export const howItWorksSection = {
  badge: 'How it works',
  title: 'A real forecasting competition, not a classroom toy.',
  subtext: 'Four steps. One week. Real stakes. Every round follows the same cycle.',
}

export const howItWorks = [
  {
    step: 1,
    title: 'Register',
    description: "Pick your team, get your supervisor's approval, and you're in. Takes under a minute.",
    icon: GraduationCap,
  },
  {
    step: 2,
    title: 'Forecast',
    description:
      'Submit your occupancy and ADR forecast for each market before the window closes. Your predictions are locked — no amendments once actuals enter review.',
    icon: Upload,
  },
  {
    step: 3,
    title: 'Score',
    description: 'Once actuals drop, your MAPE is computed automatically. No black boxes, no manual grading.',
    icon: Target,
  },
  {
    step: 4,
    title: 'Compete',
    description: 'Watch your rank shift across 7 rounds. The leaderboard updates after every scored release.',
    icon: Trophy,
  },
]

export const productPreviewSection = {
  badge: 'Platform preview',
  title: 'What the platform looks like mid-season.',
  subtext:
    'Forecast windows, reviewed actuals, and live rankings move inside one governed workflow every round.',
  roundBadge: 'Current round',
  roundTitle: 'Round 3 Forecast Window',
  roundDescription:
    'Teams are forecasting occupancy and ADR across three active hotel markets with a single weekly deadline.',
  deadlineLabel: 'Deadline',
  deadlineValue: 'Sat, Mar 21, 11:59 PM ET',
  coverageLabel: 'Forecast coverage',
  coverageValue: '72 / 78',
  coverageDescription: 'Scored points published this week',
  coverageStatus: 'Ready to release',
  teamSnapshotLabel: 'Team snapshot',
  teamSnapshotName: 'Forecast Masters',
  teamSnapshotRankLabel: 'Rank',
  teamSnapshotRankValue: '#4',
  occupancyLabel: 'Occ. MAPE (forecast vs. STR actuals)',
  occupancyValue: '8.4%',
  adrLabel: 'ADR MAPE',
  adrValue: '8.9%',
  trendChartLabel: 'MAPE trajectory',
  trendChartTitle: 'Performance improves when the reasoning gets sharper.',
  trendChartDescription:
    'A seven-round view of one team against the season baseline shows how forecasting discipline compounds over time.',
  scoringTitle: 'Transparent scoring that still rewards real reasoning.',
  scoringDescription:
    "Booking pace, demand compression, and displacement effects aren't given to you — reasoning about them is the skill being scored.",
  governanceTitle: 'Built for credible competition operations.',
}

export const productPreviewTrendData = [
  { round: 'Round 1', teamMape: 14.2, seasonAverage: 13.6 },
  { round: 'Round 2', teamMape: 12.8, seasonAverage: 12.9 },
  { round: 'Round 3', teamMape: 11.4, seasonAverage: 12.1 },
  { round: 'Round 4', teamMape: 10.3, seasonAverage: 11.5 },
  { round: 'Round 5', teamMape: 9.6, seasonAverage: 10.9 },
  { round: 'Round 6', teamMape: 8.8, seasonAverage: 10.3 },
  { round: 'Round 7', teamMape: 8.0, seasonAverage: 9.8 },
]

export const scoringFormula = [
  'Your MAPE is the average of absolute percentage errors across all scored forecast points.',
  'Lower MAPE = better accuracy. Scores update after every round so you can track improvement.',
  'Zero-actual edge cases are handled consistently under published rules. No surprises.',
]

export const governanceBadges = [
  { label: 'Submissions lock automatically at the round deadline.', icon: Lock },
  { label: 'Audit history stays visible for scoring and admin decisions.', icon: Shield },
  { label: 'Role controls keep students, supervisors, and admins in the right lane.', icon: Users },
]

export const leaderboardSection = {
  badge: 'Leaderboard preview',
  title: 'See where you stand after every scored round.',
  subtext: 'Rankings update after actuals are released. Clear scope, clear scoring, clear movement.',
}

export const leaderboardProvocation = {
  supportingLine: 'Standings shown after Round 5 actuals review — 72 of 78 forecast points scored, zero unresolved anomalies.',
  headline: "Rank ? — Your team's forecast is already being made. The question is whether you're the one making it.",
  body: 'The leaderboard updates after every scored release. First-round entrants enter the standings by the end of this week.',
  ctaLabel: 'Join the Competition',
}

export const leaderboardData = [
  { rank: 1, team: 'Revenue Wizards', university: 'Cornell University', mape: '8.1%', trend: 'up' },
  { rank: 2, team: 'Forecast Masters', university: 'EHL Lausanne', mape: '8.4%', trend: 'up' },
  { rank: 3, team: 'Hotel Analytics', university: 'University of Houston', mape: '9.0%', trend: 'same' },
  { rank: 4, team: 'Demand Drivers', university: 'UNLV', mape: '9.7%', trend: 'down' },
  { rank: 5, team: 'Data Pioneers', university: 'NYU', mape: '10.2%', trend: 'up' },
]

export const marketsSection = {
  badge: 'Active markets',
  title: 'Three markets. Three demand stories. One weekly deadline.',
  subtext:
    'Each market has a different demand signature. The challenge is learning to reason through all of them.',
}

export const markets = [
  {
    name: 'Nashville',
    country: 'United States',
    desc: 'Event-driven demand and price-sensitive shoulder weeks.',
    signal: 'Compression events & pickup spikes',
    insight: 'Learn to read event calendars and price around demand spikes that shift week to week.',
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    desc: 'Tourism cycles and global events create sharp seasonal peaks.',
    signal: 'Demand cliff patterns, Ramadan sensitivity',
    insight:
      'Master the art of forecasting in a tourism-heavy market shaped by global events and extreme seasonality.',
  },
  {
    name: 'Hamburg',
    country: 'Germany',
    desc: 'Business and port-driven demand with stable baselines.',
    signal: 'Corporate transient baseline, MICE-driven pickup',
    insight:
      'Build confidence forecasting steady corporate demand with port-driven and trade-show patterns.',
  },
]

export const industryBridgeSection = {
  badge: 'Industry context',
  title: 'The same discipline. The same metrics. The real stakes.',
  body:
    "Revenue management analysts at full-service hotels forecast occupancy and ADR every week. They use the same metrics — the same vocabulary — the same consequences when they're wrong. RevME puts students in that chair before graduation.",
}

export const testimonialsSection = {
  badge: 'What participants say',
  title: 'Trusted by students and faculty at top hospitality programs.',
}

export const testimonials = [
  {
    quote:
      'By Round 3 my MAPE dropped from 14.2% to 9.1%. I stopped guessing and started building a real reasoning process. I referenced this competition in every hotel interview I had.',
    name: 'Ariana Patel',
    role: 'Hospitality Analytics Student, Cornell',
    university: 'Cornell University',
  },
  {
    quote:
      "I ran two cohorts back to back — fall and spring — without changing a single workflow. My students had a leaderboard conversation at the end of every class. That doesn't happen with spreadsheet assignments.",
    name: 'Professor Daniel Brooks',
    role: 'Faculty Lead, Revenue Management',
    university: 'University of Houston',
  },
  {
    quote:
      'Competing against teams from other countries changed the way we prepared. Once the leaderboard went live, every round felt like professional accountability, not classroom participation.',
    name: 'Sofia Rahman',
    role: 'Hospitality Strategy Student, EHL',
    university: 'EHL Lausanne',
  },
]

export const universitiesSection = {
  badge: 'For universities',
  title: 'Built for faculty who want credibility without complexity.',
  subtext:
    'RevME is designed to feel credible to faculty, engaging to students, and maintainable for programs that want to run forecasting cohorts year after year.',
}

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
    description: 'Warnings, approvals, and team constraints are enforced by default.',
  },
  {
    icon: ClipboardList,
    title: 'Repeatable Every Year',
    description: 'Run new seasons without rebuilding the platform or workflow each time.',
  },
]

export const programOutcomesSection = {
  title: 'What this does for your program',
  pillars: [
    {
      icon: Building2,
      title: 'Industry Alignment',
      description:
        'Students graduate having forecasted real hotel markets, a credential that maps directly to revenue management analyst roles at full-service brands.',
    },
    {
      icon: BarChart3,
      title: 'Teachable Performance Signal',
      description:
        "Every team's MAPE trajectory is visible round-by-round. You can use this in course debrief, placement conversations, and program reviews.",
    },
    {
      icon: ClipboardList,
      title: 'Zero Rebuild Every Year',
      description:
        'Archive the season. Open a new one. The workflow, scoring rules, and leaderboard reset without touching a single config file.',
    },
  ],
}

export const competitionPrinciples = [
  {
    icon: Users,
    text: 'Designed for cohorts, teams, supervisors, and institutional oversight.',
  },
  {
    icon: Lock,
    text: 'Submission windows, role controls, and audit history stay explicit.',
  },
  {
    icon: CheckCircle2,
    text: 'Each season can be rerun without rebuilding the workflow from scratch.',
  },
]

export const faqSection = {
  badge: 'FAQ',
  title: 'Everything you need to know before Round 1.',
  subtext: 'Clear rules, transparent scoring, and no surprises once the season starts.',
}

export const faqItems = [
  {
    question: 'How does scoring work?',
    answer:
      'Each scored forecast contributes to your team MAPE across the active markets and metrics. Lower MAPE is better, and zero-actual cases are handled consistently under the published scoring rules.',
  },
  {
    question: "What's included in my registration?",
    answer:
      'Full access to the platform for the season, weekly scoring across all active markets, leaderboard placement, team collaboration tools, and supervisor oversight. Free trial rounds may be available depending on the season.',
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
    question: 'How is the final winner determined?',
    answer:
      'The team with the lowest cumulative MAPE across all scored rounds wins. In case of a tie, occupancy MAPE is used as the tiebreaker, followed by ADR MAPE.',
  },
  {
    question: 'When does the 2026 season start and end?',
    answer:
      'The season runs for 7 rounds with a final championship round. Exact dates are published in the competition calendar once the season opens. Teams can register anytime before Round 1 closes.',
  },
  {
    question: 'Can universities run this each year?',
    answer: 'Yes. Seasons are fully repeatable and managed through the admin control center with no rebuilding required.',
  },
]

export const finalCtaSection = {
  badge: 'Ready to start',
  student: {
    headline:
      "Most revenue management analysts will tell you they wish they'd started forecasting before they graduated. You still can. Round 1 closes in 3 days.",
    urgency: "Teams that enter now can still make this week's leaderboard release.",
  },
  professor: {
    headline:
      "Your students are forecasting something every week — whether it's structured or not. Give them a leaderboard, a scoring system, and real markets to reason through. See what changes.",
    urgency: 'Book a walkthrough this week and you can brief students before the next live deadline.',
  },
}

export const footerLinks = {
  primary: [
    { href: '/login', label: 'Sign In' },
    { href: '/register', label: 'Register' },
    { href: '/request-demo', label: 'Request Demo' },
  ],
  secondary: [
    { href: '/terms', label: 'Terms of Service' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: 'mailto:hello@revme.com?subject=RevME%20Forecaster%20Cup%20Support', label: 'Contact' },
  ],
}
