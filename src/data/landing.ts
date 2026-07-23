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

export const countdownClosedText = 'Round 1 closed. The season continues.'

export const heroCopy = {
  kicker: 'The only student competition scored on real hotel data',
  student: {
    headline: 'Forecast like a revenue analyst. Prove it before you graduate.',
    subtext:
      "Every week, three live hotel markets release their actuals, and your forecast either holds or it doesn't. Compete across seven scored rounds, ranked by accuracy against teams from eight countries, and graduate with a track record that speaks before your resume does.",
  },
  professor: {
    headline: 'Run a live forecasting competition your industry partners would respect.',
    subtext:
      'RevME puts your cohort into a real forecasting cycle: live markets, weekly deadlines, automated scoring, and a leaderboard that makes performance impossible to ignore. Faculty set it up in minutes. Students talk about it for years.',
  },
}

export const heroStats = [
  { displayValue: '$1,000', label: 'Prize pool for the top forecasting team' },
  { displayValue: '50+ Teams', label: 'Competing across 8 countries' },
  { displayValue: '12% → 8%', label: 'Average accuracy gain over 7 rounds' },
  { displayValue: '7 Rounds', label: 'Weekly scored forecasts with live results' },
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
  title: 'A real forecasting competition, not a classroom exercise.',
  subtext: 'Four steps. One week. Real stakes. Every round runs on the same cycle.',
}

export const howItWorks = [
  {
    step: 1,
    title: 'Register',
    description: "Build your team, get your supervisor's approval, and you're in. It takes under a minute.",
    icon: GraduationCap,
  },
  {
    step: 2,
    title: 'Forecast',
    description:
      'Submit your occupancy and ADR forecast for each market before the window closes. Once it does, your numbers lock. No edits after actuals go into review.',
    icon: Upload,
  },
  {
    step: 3,
    title: 'Score',
    description: 'When actuals drop, your accuracy is scored automatically. No black boxes, no manual grading.',
    icon: Target,
  },
  {
    step: 4,
    title: 'Compete',
    description: 'Watch your rank move across seven rounds. The leaderboard refreshes after every scored release.',
    icon: Trophy,
  },
]

export const productPreviewSection = {
  badge: 'Platform preview',
  title: 'What the platform looks like mid-season.',
  subtext:
    'Forecast windows, reviewed actuals, and live rankings all move through one governed workflow, round after round.',
  roundBadge: 'Current round',
  roundTitle: 'Round 3 forecast window',
  roundDescription:
    'Teams forecast occupancy and ADR across three active hotel markets against a single weekly deadline.',
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
  occupancyLabel: 'Occupancy MAPE vs. STR actuals',
  occupancyValue: '8.4%',
  adrLabel: 'ADR MAPE',
  adrValue: '8.9%',
  trendChartLabel: 'Accuracy trajectory',
  trendChartTitle: 'The sharper the reasoning, the better the score.',
  trendChartDescription:
    'One team tracked across seven rounds against the season baseline. Forecasting discipline compounds fast.',
  scoringTitle: 'Transparent scoring that still rewards real reasoning.',
  scoringDescription:
    "Booking pace, demand compression, and displacement effects are never handed to you. Reasoning through them is exactly the skill being scored.",
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
  'Your score is the average absolute percentage error across every scored forecast point.',
  'Lower is better. Scores update after each round so you can see exactly where you improved.',
  'Zero-actual edge cases follow published rules, applied the same way for every team. No surprises.',
]

export const governanceBadges = [
  { label: 'Submissions lock automatically at the round deadline.', icon: Lock },
  { label: 'Audit history stays visible for every scoring and admin decision.', icon: Shield },
  { label: 'Role controls keep students, supervisors, and admins in their own lane.', icon: Users },
]

export const leaderboardSection = {
  badge: 'Leaderboard preview',
  title: 'See exactly where you stand after every scored round.',
  subtext: 'Rankings update the moment actuals are released. Clear scope, clear scoring, clear movement.',
}

export const leaderboardProvocation = {
  supportingLine: 'Standings after Round 5 actuals review. 72 of 78 forecast points scored, zero unresolved anomalies.',
  headline: "Rank ? Your team's forecast is already being made. The only question is whether you're the one making it.",
  body: 'The leaderboard updates after every scored release. First-round entrants join the standings by the end of this week.',
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
    'Every market has its own demand signature. Learning to read all three is the whole challenge.',
}

export const markets = [
  {
    name: 'Nashville',
    country: 'United States',
    desc: 'Event-driven demand with price-sensitive shoulder weeks.',
    signal: 'Compression events & pickup spikes',
    insight: 'Learn to read event calendars and price around demand spikes that move week to week.',
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    desc: 'Tourism cycles and global events drive sharp seasonal peaks.',
    signal: 'Demand cliffs, Ramadan sensitivity',
    insight:
      'Master forecasting in a tourism-heavy market shaped by global events and extreme seasonality.',
  },
  {
    name: 'Hamburg',
    country: 'Germany',
    desc: 'Business and port-driven demand on a stable baseline.',
    signal: 'Corporate transient base, MICE pickup',
    insight:
      'Build confidence forecasting steady corporate demand with port-driven and trade-show patterns.',
  },
]

export const industryBridgeSection = {
  badge: 'Industry context',
  title: 'Same discipline. Same metrics. Real stakes.',
  body:
    "Revenue managers at full-service hotels forecast occupancy and ADR every week. Same metrics, same vocabulary, same consequences when they get it wrong. RevME puts students in that chair before they graduate.",
}

export const testimonialsSection = {
  badge: 'What participants say',
  title: 'What a single season actually changes.',
}

export const testimonials = [
  {
    quote:
      'By Round 3, my occupancy accuracy jumped from 14.2% error down to 9.1%. I stopped guessing and built a real reasoning process. It came up in every hotel interview I had that year.',
    role: 'Hospitality analytics student',
    context: 'Final-year undergraduate',
    icon: GraduationCap,
  },
  {
    quote:
      'I ran two cohorts back to back, fall and spring, without changing a thing in my workflow. My students had a leaderboard conversation at the end of every class. Spreadsheet assignments never did that.',
    role: 'Faculty lead',
    context: 'Revenue management course',
    icon: Building2,
  },
  {
    quote:
      'Competing against teams from other countries completely changed how we prepared. Once the leaderboard went live, every round felt like professional accountability, not classroom participation.',
    role: 'Hospitality strategy student',
    context: 'Graduate program',
    icon: GraduationCap,
  },
]

export const universitiesSection = {
  badge: 'For universities',
  title: 'Built for faculty who want credibility without the overhead.',
  subtext:
    'RevME is designed to feel credible to faculty, engaging to students, and easy to maintain for programs that run forecasting cohorts year after year.',
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
    description: 'Every submission, score, and change is logged and fully transparent.',
  },
  {
    icon: Lock,
    title: 'Governance Built In',
    description: 'Warnings, approvals, and team limits are enforced by default.',
  },
  {
    icon: ClipboardList,
    title: 'Repeatable Every Year',
    description: 'Run new seasons without rebuilding the platform or the workflow.',
  },
]

export const programOutcomesSection = {
  title: 'What this does for your program',
  pillars: [
    {
      icon: Building2,
      title: 'Industry Alignment',
      description:
        'Students graduate having forecasted real hotel markets, a credential that maps straight to revenue analyst roles at full-service brands.',
    },
    {
      icon: BarChart3,
      title: 'A Teachable Performance Signal',
      description:
        "Every team's accuracy trajectory is visible round by round. Use it in course debriefs, placement conversations, and program reviews.",
    },
    {
      icon: ClipboardList,
      title: 'No Rebuild Every Year',
      description:
        'Archive the season, open a new one. The workflow, scoring rules, and leaderboard reset without touching a single config file.',
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
    text: 'Every season reruns without rebuilding the workflow from scratch.',
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
      'Each scored forecast feeds your team accuracy across the active markets and metrics. Lower error is better, and zero-actual cases follow the published scoring rules, applied the same way for everyone.',
  },
  {
    question: "What's included in my registration?",
    answer:
      'Full platform access for the season, weekly scoring across every active market, leaderboard placement, team collaboration tools, and supervisor oversight. Free trial rounds may be available depending on the season.',
  },
  {
    question: 'How are teams structured?',
    answer: 'Teams of 1 to 5 students, each with a supervisor. Supervisors manage up to 10 teams and approve join requests.',
  },
  {
    question: 'When are actuals released?',
    answer: 'Actuals are released weekly, after the submission deadline closes, so scoring stays fair across every team.',
  },
  {
    question: 'How is the final winner determined?',
    answer:
      'The team with the lowest cumulative error across all scored rounds wins. Ties break on occupancy accuracy first, then ADR accuracy.',
  },
  {
    question: 'When does the 2026 season start and end?',
    answer:
      'The season runs seven rounds plus a final championship round. Exact dates are published in the competition calendar once the season opens. Teams can register any time before Round 1 closes.',
  },
  {
    question: 'Can universities run this every year?',
    answer: 'Yes. Seasons are fully repeatable and managed from the admin control center, with no rebuilding required.',
  },
]

export const finalCtaSection = {
  badge: 'Ready to start',
  student: {
    headline:
      "Most revenue analysts wish they had started forecasting before they graduated. You still can. Round 1 closes in 3 days.",
    urgency: "Enter now and your team can still make this week's leaderboard release.",
  },
  professor: {
    headline:
      "Your students are already forecasting something every week, structured or not. Give them a leaderboard, a scoring system, and real markets to reason through, then watch what changes.",
    urgency: 'Book a walkthrough this week and brief your students before the next live deadline.',
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
