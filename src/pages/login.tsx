import * as React from "react"
import { useNavigate } from "react-router-dom"
import { LoginForm } from "@/components/login-form"
import { SEO } from "@/components/seo"
import { GalleryVerticalEnd } from "lucide-react"
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
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Arehsoft
          </a>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
