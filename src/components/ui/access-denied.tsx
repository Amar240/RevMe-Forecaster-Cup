'use client'

import { ShieldX, ArrowLeft, Mail } from 'lucide-react'
import { Button } from './button'
import Link from 'next/link'

interface AccessDeniedProps {
  title?: string
  message?: string
  showBackButton?: boolean
  backUrl?: string
}

export function AccessDenied({
  title = 'Access Denied',
  message = 'You do not have permission to access this page. Please contact an administrator for assistance.',
  showBackButton = true,
  backUrl = '/dashboard',
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="h-10 w-10 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
        
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Mail className="h-4 w-4" />
            <span>Contact your administrator to request access</span>
          </div>
        </div>
        
        {showBackButton && (
          <Link href={backUrl}>
            <Button variant="outline" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
