'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertTriangle, Trophy, Users, Clock, Target, Calculator, Send, HelpCircle, ChevronDown, ChevronUp, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RulesPage() {
  const router = useRouter()
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const redirectTimerRef = useRef<number | null>(null)

  useEffect(() => {
    fetchAcknowledgment()
  }, [])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  const fetchAcknowledgment = async () => {
    try {
      const res = await csrfFetch('/api/users/me')
      if (res.ok) {
        const data = await res.json()
        setAcknowledged(!!data.user.rulesAcknowledgedAt)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch:', error)
    }
  }

  const handleAcknowledge = async () => {
    setLoading(true)
    try {
      const res = await csrfFetch('/api/users/acknowledge-rules', { method: 'POST' })
      if (res.ok) {
        setAcknowledged(true)
        setShowSuccess(true)
        redirectTimerRef.current = window.setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 1200)
      }
    } catch (error) {
      clientLogger.error('Failed to acknowledge:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showSuccess && (
        <div className="fixed top-6 right-6 z-50 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-sm">
          Acknowledged. Redirecting to your dashboard...
        </div>
      )}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Guidelines + Help</h1>
        <p className="text-gray-600 mt-2">RevME Forecaster Cup - Everything you need to know</p>
      </div>

      {acknowledged === false && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-amber-800">Please read and acknowledge the rules below to participate in the competition.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 text-blue-600" />
              Competition Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>The RevME Forecaster Cup is a hospitality revenue forecasting competition where teams predict hotel performance metrics.</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>8 Rounds</strong> of weekly forecasting</li>
              <li>Predict <strong>2-week ahead</strong> horizon (Week+1 and Week+2)</li>
              <li>Two metrics: <strong>Occupancy</strong> and <strong>ADR ($)</strong></li>
              <li>Three markets: <strong>Nashville CBD, Dubai, Hamburg</strong></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Team Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Each team can have <strong>up to 5 students</strong></li>
              <li>Teams are created by <strong>supervisors only</strong></li>
              <li>Each team has <strong>1 designated submitter</strong></li>
              <li>Each supervisor can manage <strong>up to 10 teams</strong></li>
              <li>Students <strong>cannot create teams</strong> themselves</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              Submissions & Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Submit forecasts before the <strong>round deadline</strong></li>
              <li>Submissions are <strong>permanently locked</strong> after submit</li>
              <li>You must submit <strong>12 values per round</strong>:<br/>
                <span className="text-gray-500 ml-4">3 markets x 2 weeks x 2 metrics</span>
              </li>
              <li>Late or missing submissions are <strong>not allowed</strong></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Warnings & Disqualification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Missed submission = <strong>1 warning</strong></li>
              <li>After <strong>3 warnings</strong>, team is <strong>disqualified</strong></li>
              <li>Disqualified teams cannot submit forecasts</li>
              <li>Warnings cannot be removed once issued</li>
            </ul>
            <p className="text-red-600 font-medium mt-4">Disqualification is permanent for the season!</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
            Scoring & Leaderboards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Scoring is based on <strong>Mean Absolute Percentage Error (MAPE)</strong> - lower is better!</p>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-600">Occupancy MAPE</h4>
              <p className="text-gray-600 text-xs mt-1">|Predicted - Actual| / Actual × 100%</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-600">ADR MAPE</h4>
              <p className="text-gray-600 text-xs mt-1">|Predicted - Actual| / Actual × 100%</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-600">Final Score</h4>
              <p className="text-gray-600 text-xs mt-1">Average of Occupancy and ADR MAPE</p>
            </div>
          </div>
          <p className="mt-4 text-gray-700">
            Leaderboards show rankings for <strong>Occupancy</strong>, <strong>ADR</strong>, and <strong>Combined</strong> scores.
            Teams and Universities are ranked separately.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('scoring')}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Calculator className="h-5 w-5 mr-2 text-blue-600" />
              How Scoring Works
            </span>
            {expandedSection === 'scoring' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CardTitle>
        </CardHeader>
        {expandedSection === 'scoring' && (
          <CardContent className="space-y-4 text-sm">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Mean Absolute Percentage Error (MAPE)</h4>
              <p className="text-gray-600 mb-3">Your score is based on the percentage error between your predictions and actual values. Lower is better!</p>
              <div className="bg-gray-50 p-3 rounded-lg font-mono text-center text-sm">
                MAPE = Average of (|Predicted - Actual| / Actual) × 100%
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-semibold text-indigo-600 mb-2">Occupancy Scoring</h4>
                <p className="text-gray-600 text-sm">Measured as percentage error. If you predict 75 and actual is 78, your error is |75-78|/78 = 3.85%.</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-semibold text-green-600 mb-2">ADR Scoring</h4>
                <p className="text-gray-600 text-sm">Measured as percentage error. If you predict $150 and actual is $155, your error is |150-155|/155 = 3.23%.</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Round vs Season Scores</h4>
              <ul className="text-gray-600 space-y-1">
                <li>Round Score: MAPE across all predictions in that round</li>
                <li>Season Score: MAPE across all predictions in the entire season</li>
                <li>Leaderboards show separate rankings for Occupancy and ADR</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('submit')}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Send className="h-5 w-5 mr-2 text-green-600" />
              How to Submit Forecasts
            </span>
            {expandedSection === 'submit' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CardTitle>
        </CardHeader>
        {expandedSection === 'submit' && (
          <CardContent className="space-y-4 text-sm">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Step-by-Step Guide</h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li><strong>Go to Submit Forecast</strong> from your dashboard</li>
                <li><strong>Select the current round</strong> if multiple are available</li>
                <li><strong>Enter predictions</strong> for each market and metric:
                  <ul className="ml-6 mt-1 list-disc">
                    <li>Occupancy (value, e.g., 75.5)</li>
                    <li>ADR (as dollar amount, e.g., 189.50)</li>
                  </ul>
                </li>
                <li><strong>Review all values</strong> carefully before submitting</li>
                <li><strong>Click Submit</strong> to lock in your forecast</li>
              </ol>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-700 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Important Notes
              </h4>
              <ul className="text-amber-700 space-y-1">
                <li>Only the designated submitter can submit forecasts</li>
                <li>Submissions are locked immediately after submitting</li>
                <li>You cannot edit or delete a submitted forecast</li>
                <li>Submit before the deadline shown on your dashboard</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('help')}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <HelpCircle className="h-5 w-5 mr-2 text-purple-600" />
              Contact Admin / Get Help
            </span>
            {expandedSection === 'help' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CardTitle>
        </CardHeader>
        {expandedSection === 'help' && (
          <CardContent className="space-y-4 text-sm">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-3">Need Assistance?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Contact Your Supervisor</p>
                    <p className="text-gray-600">For team-related questions, submission issues, or general guidance</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Submit a Support Ticket</p>
                    <p className="text-gray-600">For technical issues, login problems, or competition questions</p>
                    <Link href="/support" className="text-purple-600 hover:underline font-medium">
                      Go to Support Center
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-700 mb-2">Common Issues</h4>
              <ul className="text-purple-700 space-y-1">
                <li>Cannot submit? Check if you are the designated submitter</li>
                <li>Missing team? Contact your supervisor to be added</li>
                <li>Deadline passed? Contact admin for assistance</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-2 border-blue-200">
        <CardContent className="py-6">
          <div className="text-center">
            {acknowledged ? (
              <div className="flex items-center justify-center space-x-3 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <span className="font-medium">You have acknowledged the competition guidelines</span>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-700">By clicking below, you confirm that you have read and understand the competition guidelines.</p>
                <Button onClick={handleAcknowledge} disabled={loading} size="lg">
                  {loading ? 'Acknowledging...' : 'I Acknowledge the Guidelines'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


