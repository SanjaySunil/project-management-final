import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IconGripVertical, IconPlus, IconTrash, IconCopy } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export interface Deliverable {
  id: string
  title: string
  description: string | null
  order_index: number
}

interface SortableDeliverableItemProps {
  deliverable: Deliverable
  onUpdate: (id: string, updates: Partial<Deliverable>) => void
  onDelete: (id: string) => void
}

function SortableDeliverableItem({
  deliverable,
  onUpdate,
  onDelete,
}: SortableDeliverableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deliverable.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-lg border bg-card p-3 ${isDragging ? "opacity-50 ring-2 ring-primary" : ""
        }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-2 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <IconGripVertical className="size-4" />
      </button>
      <div className="flex-1 space-y-2">
        <Input
          placeholder="Deliverable title"
          value={deliverable.title}
          onChange={(e) => onUpdate(deliverable.id, { title: e.target.value })}
          className="h-8"
        />
        <Textarea
          placeholder="Description (optional)"
          value={deliverable.description || ""}
          onChange={(e) =>
            onUpdate(deliverable.id, { description: e.target.value })
          }
          className="min-h-[60px] resize-none text-sm"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="mt-1 size-8 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(deliverable.id)}
      >
        <IconTrash className="size-4" />
      </Button>
    </div>
  )
}

interface DeliverablesManagerProps {
  deliverables: Deliverable[]
  onChange: (deliverables: Deliverable[]) => void
}

export function DeliverablesManager({
  deliverables,
  onChange,
}: DeliverablesManagerProps) {
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = deliverables.findIndex((d) => d.id === active.id)
      const newIndex = deliverables.findIndex((d) => d.id === over.id)

      const newDeliverables = arrayMove(deliverables, oldIndex, newIndex).map(
        (d, index) => ({
          ...d,
          order_index: index,
        })
      )
      onChange(newDeliverables)
    }
  }

  const handleAdd = () => {
    const newDeliverable: Deliverable = {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      order_index: deliverables.length,
    }
    onChange([...deliverables, newDeliverable])
  }

  const handleUpdate = (id: string, updates: Partial<Deliverable>) => {
    onChange(
      deliverables.map((d) => (d.id === id ? { ...d, ...updates } : d))
    )
  }

  const handleDelete = (id: string) => {
    onChange(
      deliverables
        .filter((d) => d.id !== id)
        .map((d, index) => ({ ...d, order_index: index }))
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Deliverables</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const text = deliverables
                .filter(d => d.title)
                .map((d, i) => `${i + 1}. ${d.title}${d.description ? `: ${d.description}` : ""}`)
                .join("\n")
              navigator.clipboard.writeText(text)
              toast.success("Deliverables copied to clipboard")
            }}
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <IconCopy className="size-3.5" />
            Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="h-8 gap-1"
          >
            <IconPlus className="size-3.5" />
            Add Deliverable
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={deliverables.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {deliverables.map((deliverable) => (
              <SortableDeliverableItem
                key={deliverable.id}
                deliverable={deliverable}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
            {deliverables.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No deliverables added yet.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
