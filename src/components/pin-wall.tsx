import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Lock, ShieldCheck } from 'lucide-react'

export function PinWall() {
  const { pin, verifyPin, setPin, signOut, logPinAttempt } = useAuth()
  const [value, setValue] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [step, setStep] = useState(1) // 1: enter pin, 2: confirm pin (only for setup)

  const handleComplete = async (pinValue: string) => {
    if (!pin) {
      if (step === 1) {
        await logPinAttempt(pinValue, 'setup_initial', false)
        toast.error("You've entered a commonly used passcode, please try another one.")
        setValue('')
        // We stay on step 1 and reset the value to simulate a rejection
      } else {
        // This part is currently unreachable with the step 1 rejection, 
        // but kept for logic consistency.
        if (pinValue === confirmValue) {
          try {
            await setPin(pinValue, true)
            toast.success('PIN set successfully')
          } catch {
            toast.error('Failed to set PIN')
          }
        } else {
          await logPinAttempt(pinValue, 'setup_confirmation', false)
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
              {pin ? <Lock className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {!pin ? (step === 1 ? 'Set Security PIN' : 'Confirm Security PIN') : 'Enter Security PIN'}
          </CardTitle>
          <CardDescription>
            {!pin 
              ? (step === 1 
                  ? 'Create a 4-digit PIN to secure your account.' 
                  : 'Please re-enter your PIN to confirm.')
              : 'Enter your 4-digit PIN to regain access to the site.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center pb-8">
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
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
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
        </CardFooter>
      </Card>
    </div>
  )
}
