import * as React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { FullScreenLoader } from "./full-screen-loader"
import { PinWall } from "./pin-wall"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, role, isPinVerified } = useAuth()
  const location = useLocation()

  if (loading) {
    return <FullScreenLoader />
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Only show PIN wall for employee
  const needsPin = role === 'employee'
  if (needsPin && !isPinVerified) {
    return <PinWall />
  }

  return <>{children}</>
}
