import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Lock, ShieldCheck, Loader2 } from 'lucide-react'

export function PinWall() {
  const { pin, verifyPin, setPin, resetPin, signOut, logPinAttempt, isPinBlacklisted } = useAuth()
  const [value, setValue] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [step, setStep] = useState(1) // 1: enter pin, 2: confirm pin (only for setup)
  const [isResetting, setIsResetting] = useState(false)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleComplete = async (pinValue: string) => {
    if (!pin) {
      if (step === 1) {
        if (isPinBlacklisted(pinValue)) {
          await logPinAttempt(pinValue, 'setup_initial_blocked', false)
          toast.error("You've entered a commonly used passcode, please try another one.")
          setValue('')
          return
        }
        
        setConfirmValue(pinValue)
        setStep(2)
        setValue('')
        await logPinAttempt(pinValue, 'setup_initial', true)
      } else {
        if (pinValue === confirmValue) {
          try {
            await setPin(pinValue, true)
            toast.success('PIN set successfully')
          } catch (error: any) {
            toast.error(error.message || 'Failed to set PIN')
            setValue('')
            setStep(1)
            setConfirmValue('')
          }
        } else {
          await logPinAttempt(pinValue, 'setup_confirmation_mismatch', false)
          toast.error('PINs do not match')
          setValue('')
          setStep(1)
          setConfirmValue('')
        }
      }
    } else {
      if (await verifyPin(pinValue)) {
        toast.success('Access granted')
      } else {
        toast.error('Incorrect PIN')
        setValue('')
      }
    }
  }

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      toast.error('Please enter your password')
      return
    }

    try {
      setIsLoading(true)
      await resetPin(password)
      toast.success('PIN reset successfully. Please set a new PIN.')
      setIsResetting(false)
      setPassword('')
      setStep(1)
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset PIN')
    } finally {
      setIsLoading(false)
    }
  }

  const onComplete = (val: string) => {
    if (val.length === 4) {
      handleComplete(val)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              {isResetting ? <ShieldCheck className="w-6 h-6" /> : pin ? <Lock className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isResetting 
              ? 'Reset Security PIN'
              : !pin 
                ? (step === 1 ? 'Set Security PIN' : 'Confirm Security PIN') 
                : 'Enter Security PIN'}
          </CardTitle>
          <CardDescription>
            {isResetting
              ? 'Enter your account password to reset your security PIN.'
              : !pin 
                ? (step === 1 
                    ? 'Create a 4-digit PIN to secure your account.' 
                    : 'Please re-enter your PIN to confirm.')
                : 'Enter your 4-digit PIN to regain access to the site.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center pb-8">
          {isResetting ? (
            <form onSubmit={handleResetPin} className="w-full space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Account Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Reset PIN
              </Button>
            </form>
          ) : (
            <InputOTP
              maxLength={4}
              value={value}
              onChange={(val) => setValue(val)}
              onComplete={onComplete}
              autoFocus
            >
              <InputOTPGroup className="gap-2">
                <InputOTPSlot index={0} className="w-12 h-12 text-xl" />
                <InputOTPSlot index={1} className="w-12 h-12 text-xl" />
                <InputOTPSlot index={2} className="w-12 h-12 text-xl" />
                <InputOTPSlot index={3} className="w-12 h-12 text-xl" />
              </InputOTPGroup>
            </InputOTP>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {isResetting ? (
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={() => setIsResetting(false)}
            >
              Cancel
            </Button>
          ) : (
            <>
              {pin && (
                <Button 
                  variant="link" 
                  className="w-full"
                  onClick={() => setIsResetting(true)}
                >
                  Forgot PIN?
                </Button>
              )}
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground"
                onClick={() => signOut()}
              >
                Sign out
              </Button>
              {!pin && step === 2 && (
                <Button 
                  variant="link" 
                  className="w-full"
                  onClick={() => {
                    setStep(1)
                    setValue('')
                    setConfirmValue('')
                  }}
                >
                  Back to first step
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
