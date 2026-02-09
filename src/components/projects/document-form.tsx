import * as React from "react"
import { IconTrash, IconPlus } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const [notes, setNotes] = React.useState<string[]>(() => {
    if (!initialData?.content) return [""]
    const lines = initialData.content.split("\n")
    return lines.length > 0 ? lines : [""]
  })
  
  const inputRefs = React.useRef<(HTMLTextAreaElement | null)[]>([])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const values = {
      title: formData.get("title") as string,
      content: notes.map(n => n.trim()).filter(n => n !== "").join("\n"),
    }
    await onSubmit(values)
  }

  const handleNoteChange = (index: number, value: string) => {
    const newNotes = [...notes]
    newNotes[index] = value
    setNotes(newNotes)
  }

  const handleAddNote = (index: number) => {
    const newNotes = [...notes]
    newNotes.splice(index + 1, 0, "")
    setNotes(newNotes)
    // Focus will be handled by useEffect to ensure the element exists
    setPendingFocusIndex(index + 1)
  }

  const [pendingFocusIndex, setPendingFocusIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (pendingFocusIndex !== null && inputRefs.current[pendingFocusIndex]) {
      inputRefs.current[pendingFocusIndex]?.focus()
      setPendingFocusIndex(null)
    }
  }, [pendingFocusIndex, notes])

  const handleRemoveNote = (index: number) => {
    if (notes.length === 1) {
      setNotes([""])
      return
    }
    const newNotes = notes.filter((_, i) => i !== index)
    setNotes(newNotes)
    const nextFocusIndex = Math.max(0, index - 1)
    setPendingFocusIndex(nextFocusIndex)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAddNote(index)
    } else if (e.key === "Backspace" && notes[index] === "" && notes.length > 1) {
      e.preventDefault()
      handleRemoveNote(index)
    } else if (e.key === "ArrowUp" && index > 0 && e.currentTarget.selectionStart === 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowDown" && index < notes.length - 1 && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full py-4 space-y-6">
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Meeting Notes - 2024-02-08"
            defaultValue={initialData?.title}
            required
            autoFocus
            className="text-lg font-medium"
          />
        </div>
        <div className="space-y-3 flex flex-col flex-1 min-h-0">
          <Label className="text-base">Notes</Label>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {notes.map((note, index) => (
              <div key={index} className="flex items-start gap-3 group">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-3" />
                <textarea
                  ref={el => inputRefs.current[index] = el}
                  value={note}
                  onChange={(e) => handleNoteChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  placeholder="Type a bullet point..."
                  className="flex-1 min-h-[36px] py-1 border-none focus-visible:ring-0 px-0 shadow-none focus-visible:border-b focus-visible:border-primary rounded-none resize-none bg-transparent outline-none text-base"
                  style={{ fieldSizing: "content" } as any}
                  rows={1}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0"
                  onClick={() => handleRemoveNote(index)}
                >
                  <IconTrash className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => handleAddNote(notes.length - 1)}
            >
              <IconPlus className="mr-2 h-4 w-4" /> Add Bullet Point
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 mt-auto border-t">
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
