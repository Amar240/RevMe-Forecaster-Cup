const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-green-100 text-green-700 border-green-200',
  'Closing Soon': 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-gray-100 text-gray-700 border-gray-200',
  Upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[status] || STATUS_COLORS.Upcoming}`}
    >
      {status}
    </span>
  )
}
