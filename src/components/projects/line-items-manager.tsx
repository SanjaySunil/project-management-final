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
import { Label } from "@/components/ui/label"

export interface LineItem {
  id: string
  description: string
  details: string
  price: number
  quantity: number
}

interface SortableLineItemProps {
  item: LineItem
  onUpdate: (id: string, updates: Partial<LineItem>) => void
  onDelete: (id: string) => void
}

function SortableLineItem({
  item,
  onUpdate,
  onDelete,
}: SortableLineItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

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
      <div className="flex-1 grid grid-cols-12 gap-2">
        <div className="col-span-5 space-y-1">
          <Input
            placeholder="Description"
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="col-span-3 space-y-1">
          <Input
            placeholder="Details"
            value={item.details}
            onChange={(e) => onUpdate(item.id, { details: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Input
            type="number"
            placeholder="Price"
            value={item.price || ""}
            onChange={(e) => onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })}
            className="h-8"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Input
            type="number"
            placeholder="Qty"
            value={item.quantity || ""}
            onChange={(e) => onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })}
            className="h-8"
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="mt-1 size-8 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(item.id)}
      >
        <IconTrash className="size-4" />
      </Button>
    </div>
  )
}

interface LineItemsManagerProps {
  lineItems: LineItem[]
  onChange: (items: LineItem[]) => void
}

export function LineItemsManager({
  lineItems,
  onChange,
}: LineItemsManagerProps) {
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = lineItems.findIndex((item) => item.id === active.id)
      const newIndex = lineItems.findIndex((item) => item.id === over.id)

      const newLineItems = arrayMove(lineItems, oldIndex, newIndex)
      onChange(newLineItems)
    }
  }

  const handleAdd = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      description: "",
      details: "",
      price: 0,
      quantity: 1,
    }
    onChange([...lineItems, newItem])
  }

  const handleUpdate = (id: string, updates: Partial<LineItem>) => {
    onChange(
      lineItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  const handleDelete = (id: string) => {
    onChange(lineItems.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Invoice Line Items</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const text = lineItems
                .filter(item => item.description)
                .map(item => `${item.description}${item.details ? ` (${item.details})` : ""}: $${item.price.toLocaleString()} x ${item.quantity} = $${(item.price * item.quantity).toLocaleString()}`)
                .join("\n")
              navigator.clipboard.writeText(text)
              toast.success("Line items copied to clipboard")
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
            Add Item
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
          items={lineItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {lineItems.map((item) => (
              <SortableLineItem
                key={item.id}
                item={item}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
            {lineItems.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No line items added yet. These will appear on the invoice.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
