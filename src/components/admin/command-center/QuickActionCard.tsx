import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

type QuickActionVariant = 'default' | 'primary' | 'warning' | 'success'

export interface QuickActionCardProps {
  icon: React.ElementType
  title: string
  description: string
  href?: string
  variant?: QuickActionVariant
  onClick?: () => void
  loading?: boolean
}

const VARIANT_STYLES: Record<QuickActionVariant, string> = {
  default: 'bg-white hover:bg-gray-50 border-gray-200',
  primary: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  warning: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
  success: 'bg-green-50 hover:bg-green-100 border-green-200',
}

const ICON_STYLES: Record<QuickActionVariant, string> = {
  default: 'bg-gray-100 text-gray-600',
  primary: 'bg-blue-100 text-blue-600',
  warning: 'bg-amber-100 text-amber-600',
  success: 'bg-green-100 text-green-600',
}

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  variant = 'default',
  onClick,
  loading,
}: QuickActionCardProps) {
  const content = (
    <div
      className={`p-4 rounded-xl border transition-all cursor-pointer ${VARIANT_STYLES[variant]} ${loading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="flex items-start space-x-4">
        <div className={`p-2.5 rounded-lg ${ICON_STYLES[variant]}`}>
          {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    )
  }

  return href ? <Link href={href}>{content}</Link> : content
}
