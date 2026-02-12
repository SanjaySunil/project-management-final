import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { useState } from "react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { BellOff } from "lucide-react"

const reminderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.date({
    required_error: "A date is required.",
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)"),
  link: z.string().optional(),
})

export function ReminderForm({ 
  onSuccess, 
  initialData 
}: { 
  onSuccess?: () => void,
  initialData?: any
}) {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { permission, requestPermission } = usePushNotifications()

  const form = useForm<z.infer<typeof reminderSchema>>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      date: initialData?.date ? new Date(initialData.date) : new Date(),
      time: initialData?.time || format(new Date(), "HH:mm"),
      link: initialData?.link || "",
    },
  })

  async function onSubmit(values: z.infer<typeof reminderSchema>) {
    if (!user) return

    setIsSubmitting(true)
    try {
      // Combine date and time
      const [hours, minutes] = values.time.split(":").map(Number)
      const remindAt = new Date(values.date)
      remindAt.setHours(hours, minutes, 0, 0)

      const { error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title: values.title,
          description: values.description,
          remind_at: remindAt.toISOString(),
          link: values.link,
          task_id: initialData?.task_id || null,
        })

      if (error) throw error

      toast.success("Reminder created successfully!")
      form.reset()
      onSuccess?.()
    } catch (error: any) {
      toast.error("Failed to create reminder: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {permission !== "granted" && (
          <div className="flex items-center gap-3 p-3 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg text-yellow-800 dark:text-yellow-200">
            <BellOff className="h-4 w-4 shrink-0" />
            <div className="flex-1">
              Push notifications are disabled. You won't receive alerts at the scheduled time.
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-7 text-[10px] px-2"
              onClick={() => requestPermission()}
            >
              Enable
            </Button>
          </div>
        )}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="What do you want to be reminded about?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Add some details..." className="resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type="time" {...field} />
                    <Clock className="absolute right-3 top-2.5 h-4 w-4 opacity-50" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="link"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference Link (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormDescription>
                The notification will open this link when clicked.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Set Reminder"}
        </Button>
      </form>
    </Form>
  )
}
