import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Separator } from "@/components/ui/separator"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

export default function AccountPage() {
  const { user, role, setPin, isPinBlacklisted } = useAuth()
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newPin, setNewPin] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isUpdatingPin, setIsUpdatingPin] = useState(false)

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name)
    }
  }, [user])

  if (!user) return null

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase()
    : user.email?.substring(0, 2).toUpperCase() || "U"

  const handleSaveProfile = async () => {
    try {
      setIsUpdatingProfile(true)
      
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      })
      if (authError) throw authError

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)
      
      if (profileError) throw profileError

      toast.success("Profile updated successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!password) {
      toast.error("Please enter a new password")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    try {
      setIsUpdatingPassword(true)
      const { error } = await supabase.auth.updateUser({
        password: password
      })
      if (error) throw error

      toast.success("Password updated successfully")
      setPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      toast.error(error.message || "Failed to update password")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleUpdatePin = async () => {
    const sanitizedPin = newPin.toString().trim()
    if (sanitizedPin.length !== 4) {
      toast.error("PIN must be 4 digits")
      return
    }

    if (isPinBlacklisted(sanitizedPin)) {
      toast.error("You've entered a commonly used passcode, please try another one.")
      return
    }

    try {
      setIsUpdatingPin(true)
      await setPin(sanitizedPin)
      toast.success("PIN updated successfully")
      setNewPin("")
    } catch (error: any) {
      toast.error(error.message || "Failed to update PIN")
    } finally {
      setIsUpdatingPin(false)
    }
  }

  const needsPin = role === 'employee'

  return (
    <PageContainer>
      <SEO title="Account Settings" description="Manage your personal profile and security settings." />
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Account</h2>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Update your account settings and profile information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <Button variant="outline">Change Avatar</Button>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={isUpdatingProfile}>
                {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </CardContent>
          </Card>
          
          <div className="col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Security</CardTitle>
                <CardDescription>
                  Manage your security preferences and password.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input 
                    id="confirm-password" 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleUpdatePassword} 
                  disabled={isUpdatingPassword}
                  className="w-full"
                >
                  {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </CardContent>
            </Card>

            {needsPin && (
              <Card>
                <CardHeader>
                  <CardTitle>Security PIN</CardTitle>
                  <CardDescription>
                    Update your 4-digit security PIN for page refreshes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex flex-col items-center">
                  <InputOTP
                    maxLength={4}
                    value={newPin}
                    onChange={(val) => setNewPin(val)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button 
                    variant="outline" 
                    onClick={handleUpdatePin} 
                    disabled={isUpdatingPin || newPin.length !== 4}
                    className="w-full"
                  >
                    {isUpdatingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Security PIN
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
