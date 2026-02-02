import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Tables } from "@/lib/database.types"

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  user_id: z.string().nullable().optional(),
  proposal_id: z.string().nullable().optional(),
})

export type TaskFormValues = z.infer<typeof taskSchema>

interface TaskFormProps {
  onSubmit: (values: TaskFormValues) => void
  onCancel: () => void
  onDelete?: () => void
  isLoading?: boolean
  members: Tables<"profiles">[]
  proposals?: Tables<"proposals">[]
  defaultValues?: Partial<TaskFormValues>
  hideAssignee?: boolean
}

export function TaskForm({ 
  onSubmit, 
  onCancel, 
  onDelete,
  isLoading, 
  members, 
  proposals,
  defaultValues,
  hideAssignee = false
}: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      user_id: defaultValues?.user_id || null,
      proposal_id: defaultValues?.proposal_id || null,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Task title..." 
                  className="min-h-[100px] resize-none" 
                  {...field} 
                />
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
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Task description..." 
                  className="min-h-[150px] resize-none" 
                  {...field} 
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!hideAssignee && (
          <FormField
            control={form.control}
            name="user_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assign To</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || "unassigned"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name || member.email || member.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {proposals && proposals.length > 0 && (
          <FormField
            control={form.control}
            name="proposal_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proposal</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a proposal" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {proposals.map((proposal) => (
                      <SelectItem key={proposal.id} value={proposal.id}>
                        {proposal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="flex justify-between gap-2 pt-4">
          <div>
            {onDelete && (
              <Button 
                type="button" 
                variant="ghost" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                Delete Task
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Task"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
