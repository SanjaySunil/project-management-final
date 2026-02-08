import { useState } from "react"
import { Bug, LifeBuoy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { TicketForm, type TicketFormValues } from "./ticket-form"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"

export function TicketButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const handleSubmit = async (values: TicketFormValues) => {
    if (!user) {
      toast.error("You must be logged in to submit a ticket")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from("tickets").insert({
        title: values.title,
        description: values.description,
        type: values.type,
        priority: values.priority,
        user_id: user.id,
        status: "open",
      })

      if (error) throw error

      toast.success("Ticket submitted successfully! Thank you for your feedback.")
      setOpen(false)
    } catch (error: any) {
      console.error("Error submitting ticket:", error)
      toast.error(error.message || "Failed to submit ticket")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Report Bug / Request Feature">
          <LifeBuoy className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Submit a Ticket
          </DialogTitle>
          <DialogDescription>
            Help us improve the application by reporting bugs or suggesting new features.
          </DialogDescription>
        </DialogHeader>
        <TicketForm 
          onSubmit={handleSubmit} 
          onCancel={() => setOpen(false)} 
          isLoading={loading}
        />
      </DialogContent>
    </Dialog>
  )
}
