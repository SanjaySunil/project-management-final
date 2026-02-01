import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"

const projectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  client_id: z.string().min(1, "Please select a client"),
  member_ids: z.array(z.string()).default([]),
})

type ProjectFormValues = z.infer<typeof projectSchema>

interface ProjectFormProps {
  initialValues?: Partial<{
    name: string
    description: string | null
    status: string | null
    client_id: string | null
    member_ids: string[]
  }>
  onSubmit: (values: ProjectFormValues) => void
  onCancel: () => void
  isLoading?: boolean
}

interface ClientOption {
  id: string
  first_name: string
  last_name: string | null
}

interface ProfileOption {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export function ProjectForm({ initialValues, onSubmit, onCancel, isLoading }: ProjectFormProps) {
  const [clients, setClients] = React.useState<ClientOption[]>([])
  const [profiles, setProfiles] = React.useState<ProfileOption[]>([])
  const [isFetchingData, setIsFetchingData] = React.useState(true)

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: initialValues?.name || "",
      description: initialValues?.description || "",
      status: initialValues?.status || "active",
      client_id: initialValues?.client_id || "",
      member_ids: initialValues?.member_ids || [],
    },
  })

  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsFetchingData(true)
        const [clientsRes, profilesRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id, first_name, last_name")
            .order("first_name", { ascending: true }),
          supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .order("full_name", { ascending: true })
        ])

        if (clientsRes.error) throw clientsRes.error
        if (profilesRes.error) throw profilesRes.error
        
        setClients(clientsRes.data || [])
        setProfiles(profilesRes.data || [])
      } catch (error: any) {
        console.error("Failed to fetch data:", error)
        toast.error("Failed to load clients or team members: " + (error.message || "Unknown error"))
      } finally {
        setIsFetchingData(false)
      }
    }

    fetchData()
  }, [])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Website Redesign" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isFetchingData ? "Loading..." : "Select a client"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.first_name} {client.last_name || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

                        <FormField

                          control={form.control}

                          name="member_ids"

                          render={({ field }) => (

                            <FormItem>

                              <FormLabel>Team Members</FormLabel>

                              <FormControl>

                                <MultiSelect

                                  placeholder="Select team members..."

                                  options={profiles.map(p => ({

                                    label: p.full_name || p.email || p.id,

                                    value: p.id,

                                    avatar_url: p.avatar_url

                                  }))}

                                  selected={field.value}

                                  onChange={field.onChange}

                                />

                              </FormControl>

                              <FormMessage />

                            </FormItem>

                          )}

                        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
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
                <Textarea placeholder="Project details and goals..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || isFetchingData}>
            {isLoading ? "Saving..." : "Save Project"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
