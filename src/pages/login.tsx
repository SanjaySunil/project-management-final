import * as React from "react"
import { useNavigate } from "react-router-dom"
import { LoginForm } from "@/components/login-form"
import { SEO } from "@/components/seo"
import { Logo } from "@/components/logo"
import { useAuth } from "@/hooks/use-auth"

export default function LoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (!loading && session) {
      navigate("/dashboard")
    }
  }, [session, loading, navigate])

  if (loading) return null

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <SEO 
        title="Login" 
        description="Login to your Arehsoft account to manage your projects and business operations."
      />
      <div className="w-full max-w-sm">
        <div className="flex justify-center gap-2 mb-6">
          <a href="#" className="flex items-center gap-2 font-medium text-xl">
            <Logo className="h-8 w-auto" />
            Arehsoft
          </a>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
