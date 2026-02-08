import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Tables } from "@/lib/database.types"

type Document = Tables<"documents">

interface DocumentFormProps {
  initialData?: Document | null
  onSubmit: (values: any) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function DocumentForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: DocumentFormProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const values = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
    }
    await onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Meeting Notes - 2024-02-08"
            defaultValue={initialData?.title}
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="content">Notes</Label>
          <Textarea
            id="content"
            name="content"
            placeholder="Write your meeting notes here..."
            className="min-h-[400px] font-sans text-base resize-y"
            defaultValue={initialData?.content || ""}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : initialData ? "Update Document" : "Create Document"}
        </Button>
      </div>
    </form>
  )
}
