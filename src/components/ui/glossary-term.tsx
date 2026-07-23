import { Tooltip } from '@/components/ui/tooltip'

const definitions = {
  MAPE: 'Mean Absolute Percentage Error: the average percentage miss across forecasts. Lower is better.',
  ADR: 'Average Daily Rate: room revenue divided by rooms sold.',
  Occupancy: 'The percentage of available rooms that are sold.',
  RevPAR: 'Revenue per available room: ADR multiplied by occupancy.',
  'comp set': 'A comparison set of similar hotels used to benchmark market performance.',
} as const

export type GlossaryTermName = keyof typeof definitions

export function GlossaryTerm({ term, children }: { term: GlossaryTermName; children?: React.ReactNode }) {
  return <Tooltip label={definitions[term]}><span className="border-b border-dotted border-current">{children || term}</span></Tooltip>
}
