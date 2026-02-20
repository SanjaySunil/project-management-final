import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconArrowsSort,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronsLeft,
  IconChevronsRight,
  IconGripVertical,
  IconLayoutColumns,
  IconPlus,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Create a context to share sortable attributes and listeners with cells
const SortableRowContext = React.createContext<{
  attributes: any
  listeners: any
  setActivatorNodeRef: (element: HTMLElement | null) => void
  isDragging?: boolean
} | null>(null)

// Create a separate component for the drag handle
export function DragHandle({ id }: { id: UniqueIdentifier }) {
  const context = React.useContext(SortableRowContext)
  
  // Use useSortable if not within a context (fallback)
  const sortable = useSortable({ id })
  
  const { attributes, listeners, setActivatorNodeRef } = context || sortable

  return (
    <div
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      data-drag-handle="true"
      className="text-muted-foreground size-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
    >
      <IconGripVertical className="size-4" />
      <span className="sr-only">Drag to reorder</span>
    </div>
  )
}

function DraggableRow<TData extends { id: string | number }>({ 
  row,
  onRowClick,
}: { 
  row: Row<TData>,
  onRowClick?: (row: TData) => void
}) {
  const { 
    transform, 
    transition, 
    setNodeRef, 
    isDragging,
    attributes,
    listeners,
    setActivatorNodeRef
  } = useSortable({
    id: row.original.id,
  })

  return (
    <SortableRowContext.Provider value={{ attributes, listeners, setActivatorNodeRef, isDragging }}>
      <TableRow
        data-state={row.getIsSelected() && "selected"}
        data-dragging={isDragging}
        ref={setNodeRef}
        className={cn(
          "relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80",
          onRowClick && "cursor-pointer hover:bg-muted/50"
        )}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: transition,
        }}
        onClick={() => onRowClick?.(row.original)}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} onClick={(e) => {
            // Prevent row click if clicking on a button, checkbox or dropdown
            const target = e.target as HTMLElement
            if (target.closest('button') || target.closest('input[type="checkbox"]') || target.closest('[role="menuitem"]') || target.closest('[data-drag-handle="true"]')) {
              e.stopPropagation()
            }
          }}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    </SortableRowContext.Provider>
  )
}

export interface DataTableTab {
  value: string
  label: string
  badge?: number
  content?: React.ReactNode
}

export interface DataTableProps<TData extends { id: string | number }> {

  columns: ColumnDef<TData, any>[]

  data: TData[]

  onDataChange?: (data: TData[]) => void

  enableReordering?: boolean

  tabs?: DataTableTab[]

  activeTab?: string

  onTabChange?: (value: string) => void

  addLabel?: string

  onAdd?: () => void

  searchPlaceholder?: string

  onSearchChange?: (value: string) => void

  isLoading?: boolean

  disablePadding?: boolean

  onRowClick?: (row: TData) => void

  toolbar?: React.ReactNode

  onRowSelectionChange?: (rowSelection: any) => void

  defaultSorting?: SortingState

}



export function DataTable<TData extends { id: string | number }> ({

  columns,

  data: initialData,

  onDataChange,

  enableReordering = false,

  tabs,

  activeTab,

  onTabChange,

  addLabel,

  onAdd,

  searchPlaceholder = "Filter...",

  onSearchChange,

  isLoading = false,

  disablePadding = true,

  onRowClick,

  toolbar,

  onRowSelectionChange,

  defaultSorting = [],

}: DataTableProps<TData>) {
  const [data, setData] = React.useState(() => initialData)
  
  React.useEffect(() => {
    setData(initialData)
  }, [initialData])

  const [rowSelection, setRowSelection] = React.useState({})
  
  const handleRowSelectionChange = (updater: any) => {
    const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater
    setRowSelection(nextSelection)
    onRowSelectionChange?.(nextSelection)
  }

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting)
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [internalActiveTab, setInternalActiveTab] = React.useState<string | undefined>(
    tabs && tabs.length > 0 ? tabs[0].value : undefined
  )

  const currentActiveTab = activeTab ?? internalActiveTab
  const handleTabChange = (value: string) => {
    setInternalActiveTab(value)
    onTabChange?.(value)
  }

  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: (value) => {
      setGlobalFilter(value)
      onSearchChange?.(value)
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      const oldIndex = dataIds.indexOf(active.id)
      const newIndex = dataIds.indexOf(over.id)
      const newData = arrayMove(data, oldIndex, newIndex)
      setData(newData)
      onDataChange?.(newData)
    }
  }

  const content = (
    <div className={cn(
      "relative flex flex-col gap-4 overflow-auto",
      !disablePadding && "px-4 lg:px-6"
    )}>
      <div className="overflow-hidden rounded-lg border bg-card">
        {enableReordering ? (
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : (
                            <div
                              className={cn(
                                header.column.getCanSort() &&
                                  "flex cursor-pointer select-none items-center gap-2"
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {{
                                asc: <IconChevronUp className="size-4" />,
                                desc: <IconChevronDown className="size-4" />,
                              }[header.column.getIsSorted() as string] ?? 
                                (header.column.getCanSort() ? (
                                  <IconArrowsSort className="size-4 text-muted-foreground/50" />
                                ) : null)}
                            </div>
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} onRowClick={onRowClick} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        ) : (
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : (
                          <div
                            className={cn(
                              header.column.getCanSort() &&
                                "flex cursor-pointer select-none items-center gap-2"
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {{
                              asc: <IconChevronUp className="size-4" />,
                              desc: <IconChevronDown className="size-4" />,
                            }[header.column.getIsSorted() as string] ?? 
                              (header.column.getCanSort() ? (
                                <IconArrowsSort className="size-4 text-muted-foreground/50" />
                              ) : null)}
                          </div>
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} onClick={(e) => {
                        // Prevent row click if clicking on a button, checkbox or dropdown
                        const target = e.target as HTMLElement
                        if (target.closest('button') || target.closest('input[type="checkbox"]') || target.closest('[role="menuitem"]')) {
                          e.stopPropagation()
                        }
                      }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex w-full items-center gap-4 lg:gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <IconChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <IconChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <IconChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <IconChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const header = (
    <div className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
      !disablePadding && "px-4 lg:px-6"
    )}>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
        {tabs && (
          <>
            <Label htmlFor="view-selector" className="sr-only">
              View
            </Label>
            <Select 
              value={currentActiveTab}
              onValueChange={handleTabChange}
            >
              <SelectTrigger
                className="flex w-fit @4xl/main:hidden"
                size="sm"
                id="view-selector"
              >
                <SelectValue placeholder="Select a view" />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label} {tab.badge !== undefined && <Badge variant="secondary">{tab.badge}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </>
        )}
        <div className="flex items-center gap-2">
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter ?? ""}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className="h-8 w-full sm:w-[150px] lg:w-[250px]"
          />
          {toolbar}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <IconLayoutColumns className="size-4" />
              <span className="hidden lg:inline">Columns</span>
              <IconChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" &&
                  column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        {onAdd && (
          <Button variant="default" size="sm" onClick={onAdd}>
            <IconPlus className="size-4" />
            <span className="hidden lg:inline">{addLabel || "Add"}</span>
          </Button>
        )}
      </div>
    </div>
  )

  if (tabs) {
    return (
      <Tabs
        value={currentActiveTab}
        onValueChange={handleTabChange}
        className="w-full flex-col justify-start gap-6"
      >
        {header}
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="m-0">
            {tab.content || content}
          </TabsContent>
        ))}
      </Tabs>
    )
  }

  return (
    <div className="w-full flex flex-col justify-start gap-6">
      {header}
      {content}
    </div>
  )
}
