import { useState, useEffect, useCallback } from "react"
import { AlarmClock, Plus, Trash2, Calendar, Clock, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { format } from "date-fns"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ReminderForm } from "@/components/reminder-form"

interface Reminder {
  id: string
  title: string
  description: string | null
  remind_at: string
  is_sent: boolean
  task_id: string | null
  link: string | null
  created_at: string
}

export default function RemindersPage() {
  const { user } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const fetchReminders = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('remind_at', { ascending: true })

      if (error) throw error
      setReminders(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch reminders: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchReminders()
  }, [fetchReminders])

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

      if (error) throw error
      setReminders(prev => prev.filter(r => r.id !== id))
      toast.success("Reminder deleted")
    } catch (error: any) {
      toast.error("Failed to delete reminder: " + error.message)
    }
  }

  const upcomingReminders = reminders.filter(r => !r.is_sent)
  const pastReminders = reminders.filter(r => r.is_sent)

  return (
    <PageContainer>
      <SEO title="Reminders" description="Set and manage your personal reminders." />
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Reminders</h1>
            <Badge variant="outline" className="ml-2">
              {upcomingReminders.length} upcoming
            </Badge>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Reminder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Reminder</DialogTitle>
                <DialogDescription>
                  Set a reminder to receive a push notification at a specific time.
                </DialogDescription>
              </DialogHeader>
              <ReminderForm 
                onSuccess={() => {
                  setIsFormOpen(false)
                  fetchReminders()
                }} 
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Upcoming Reminders
            </h2>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-40 w-full rounded-xl" />
                ))}
              </div>
            ) : upcomingReminders.length === 0 ? (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <AlarmClock className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium">No upcoming reminders</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                    You don't have any reminders set. Click the button above to create one.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingReminders.map(reminder => (
                  <ReminderCard 
                    key={reminder.id} 
                    reminder={reminder} 
                    onDelete={handleDelete} 
                  />
                ))}
              </div>
            )}
          </section>

          {pastReminders.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                Past Reminders
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60 hover:opacity-100 transition-opacity">
                {pastReminders.map(reminder => (
                  <ReminderCard 
                    key={reminder.id} 
                    reminder={reminder} 
                    onDelete={handleDelete} 
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

function ReminderCard({ 
  reminder, 
  onDelete 
}: { 
  reminder: Reminder, 
  onDelete: (id: string) => void 
}) {
  return (
    <Card className={reminder.is_sent ? "bg-muted/30" : "bg-card"}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-base line-clamp-1">{reminder.title}</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(reminder.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="line-clamp-2 min-h-[2.5rem]">
          {reminder.description || "No description"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Clock className="h-3.5 w-3.5" />
            {format(new Date(reminder.remind_at), "PPP p")}
          </div>
          {reminder.link && (
            <Link 
              to={reminder.link}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Reference Link
            </Link>
          )}
          {reminder.is_sent && (
            <Badge variant="secondary" className="w-fit text-[10px] h-4 px-1">Sent</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
