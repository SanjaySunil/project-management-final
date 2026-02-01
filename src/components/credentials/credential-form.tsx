import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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

const credentialSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.string().min(1, "Please select a type"),
  value: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  password: z.string().optional(),
  notes: z.string().optional(),
  project_id: z.string().min(1, "Please select a project"),
}).superRefine((data, ctx) => {
  if (data.type === "Email Password") {
    if (!data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required",
        path: ["email"],
      });
    }
    if (!data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password is required",
        path: ["password"],
      });
    }
  } else {
    if (!data.value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Value is required",
        path: ["value"],
      });
    }
  }
})

type CredentialFormValues = z.infer<typeof credentialSchema>

interface CredentialFormProps {
  initialValues?: Partial<{
    name: string
    type: string
    value: string
    notes: string | null
    project_id: string | null
  }>
  onSubmit: (values: any) => void
  onCancel: () => void
  isLoading?: boolean
}

interface ProjectOption {
  id: string
  name: string
}

export function CredentialForm({ initialValues, onSubmit, onCancel, isLoading }: CredentialFormProps) {
  const [projects, setProjects] = React.useState<ProjectOption[]>([])
  const [isFetchingProjects, setIsFetchingProjects] = React.useState(true)

  const form = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      name: initialValues?.name || "",
      type: initialValues?.type || "",
      value: initialValues?.value || "",
      email: "",
      password: "",
      notes: initialValues?.notes || "",
      project_id: initialValues?.project_id || "",
    },
  })

  const type = form.watch("type")

  React.useEffect(() => {
    if (initialValues?.type === "Email Password" && initialValues?.value) {
      try {
        const parsed = JSON.parse(initialValues.value)
        form.setValue("email", parsed.email || "")
        form.setValue("password", parsed.password || "")
      } catch (e) {
        console.error("Failed to parse Email Password credential", e)
      }
    }
  }, [initialValues, form])

  const handleFormSubmit = (values: CredentialFormValues) => {
    const submitValues = { ...values }
    if (submitValues.type === "Email Password") {
      submitValues.value = JSON.stringify({
        email: submitValues.email,
        password: submitValues.password
      })
    }
    // Remove temporary fields
    delete submitValues.email
    delete submitValues.password
    onSubmit(submitValues)
  }

  React.useEffect(() => {
    async function fetchProjects() {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name")
          .order("name", { ascending: true })

        if (error) throw error
        setProjects(data || [])
      } catch (error) {
        console.error("Failed to fetch projects:", error)
      } finally {
        setIsFetchingProjects(false)
      }
    }

    fetchProjects()
  }, [])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="project_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isFetchingProjects ? "Loading projects..." : "Select a project"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credential Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g. AWS Production Access" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="API Key">API Key</SelectItem>
                  <SelectItem value="Email Password">Email Password</SelectItem>
                  <SelectItem value="Password">Password</SelectItem>
                  <SelectItem value="SSH Key">SSH Key</SelectItem>
                  <SelectItem value="Database URL">Database URL</SelectItem>
                  <SelectItem value="Token">Token</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {type === "Email Password" ? (
          <>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Textarea placeholder="Paste the credential value here..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any additional context or usage instructions..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || isFetchingProjects}>
            {isLoading ? "Saving..." : "Save Credential"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
