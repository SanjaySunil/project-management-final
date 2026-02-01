import * as React from "react"
import { 
  IconCopy, 
  IconEye, 
  IconEyeOff,
  IconExternalLink,
  IconCalendar,
  IconTag,
  IconNotes,
  IconDatabase,
  IconLock,
  IconMail
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CredentialWithProject } from "./credentials-table"

interface CredentialDetailsModalProps {
  credential: CredentialWithProject | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (credential: CredentialWithProject) => void
}

export function CredentialDetailsModal({ 
  credential, 
  open, 
  onOpenChange,
  onEdit
}: CredentialDetailsModalProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  if (!credential) return null

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const renderValue = () => {
    let email = ""
    let password = ""
    let isEmailPassword = credential.type === "Email Password"

    if (isEmailPassword) {
      try {
        const parsed = JSON.parse(credential.value)
        email = parsed.email || ""
        password = parsed.password || ""
      } catch (e) {
        // fallback
      }
    }

    if (isEmailPassword) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconMail className="size-4" /> Email
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => copyToClipboard(email, "Email")}
              >
                <IconCopy className="size-4" />
              </Button>
            </div>
            <div className="bg-muted p-2 rounded-md font-mono text-sm break-all">
              {email}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconLock className="size-4" /> Password
              </span>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setIsVisible(!isVisible)}
                >
                  {isVisible ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(password, "Password")}
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            </div>
            <div className="bg-muted p-2 rounded-md font-mono text-sm break-all">
              {isVisible ? password : "••••••••••••••••"}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <IconLock className="size-4" /> Value
          </span>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setIsVisible(!isVisible)}
            >
              {isVisible ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => copyToClipboard(credential.value, "Value")}
            >
              <IconCopy className="size-4" />
            </Button>
          </div>
        </div>
        <div className="bg-muted p-3 rounded-md font-mono text-sm break-all whitespace-pre-wrap min-h-[60px]">
          {isVisible ? credential.value : "••••••••••••••••••••••••••••••••"}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-xl font-bold">{credential.name}</DialogTitle>
            <Badge variant="outline">{credential.type}</Badge>
          </div>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <IconDatabase className="size-3" />
            Project: <span className="font-medium text-foreground">{credential.projects?.name || "No Project"}</span>
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {renderValue()}

            {credential.notes && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconNotes className="size-4" /> Notes
                </span>
                <div className="text-sm text-foreground bg-muted/50 p-3 rounded-md border">
                  {credential.notes}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <IconCalendar className="size-3" /> Created
                </span>
                <p className="text-sm">
                  {credential.created_at ? new Date(credential.created_at).toLocaleString() : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <IconTag className="size-3" /> ID
                </span>
                <p className="text-sm font-mono truncate">
                  {credential.id}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => {
            onOpenChange(false)
            onEdit(credential)
          }}>
            Edit Credential
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
