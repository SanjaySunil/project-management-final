import { useEffect, useState, useCallback } from "react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw, Eye, Calendar, User, Database, Activity, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"

interface AuditLog {
  id: string
  created_at: string
  user_id: string | null
  action: string
  table_name: string
  record_id: string
  old_data: any
  new_data: any
  profiles?: {
    full_name: string | null
    email: string | null
  }
}

export default function AuditLogsPage() {
  const { user, role, checkPermission } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  // Filters
  const [filterAction, setFilterAction] = useState<string>("all")
  const [filterTable, setFilterTable] = useState<string>("")
  const [filterUser, setFilterUser] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  const canViewLogs = checkPermission('read', 'audit_logs')

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filterAction !== "all") {
        query = query.eq('action', filterAction)
      }

      if (filterTable) {
        query = query.ilike('table_name', `%${filterTable}%`)
      }

      if (filterUser) {
        query = query.or(`user_id.eq.${filterUser},profiles.full_name.ilike.%${filterUser}%,profiles.email.ilike.%${filterUser}%`)
      }

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString())
      }

      if (endDate) {
        // Add one day to end date to include the entire day
        const end = new Date(endDate)
        end.setDate(end.getDate() + 1)
        query = query.lt('created_at', end.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      setLogs((data as any[]) || [])
    } catch (error: any) {
      toast.error("Error fetching audit logs: " + error.message)
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterTable, filterUser, startDate, endDate])

  useEffect(() => {
    if (user && canViewLogs) {
      fetchLogs()
    }
  }, [user, canViewLogs, fetchLogs])

  const resetFilters = () => {
    setFilterAction("all")
    setFilterTable("")
    setFilterUser("")
    setStartDate("")
    setEndDate("")
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'UPDATE': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'DELETE': return 'bg-red-500/10 text-red-500 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "created_at",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs font-mono">
          {format(new Date(row.original.created_at), 'MMM d, yyyy HH:mm:ss')}
        </span>
      ),
    },
    {
      id: "user",
      header: "User",
      accessorFn: (row) => row.profiles?.full_name || row.profiles?.email || row.user_id || "System",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {row.original.profiles?.full_name || "System/Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.profiles?.email || row.original.user_id || "N/A"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <Badge variant="outline" className={getActionColor(row.original.action)}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: "table_name",
      header: "Table",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Database className="size-3 text-muted-foreground" />
          <span className="text-sm">{row.original.table_name}</span>
        </div>
      ),
    },
    {
      accessorKey: "record_id",
      header: "Record ID",
      cell: ({ row }) => (
        <span className="max-w-[150px] truncate text-xs font-mono text-muted-foreground">
          {row.original.record_id}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Details</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedLog(row.original)}
          >
            <Eye className="size-4 mr-2" />
            View
          </Button>
        </div>
      ),
    },
  ]

  if (!loading && !canViewLogs && role !== null) {
    return (
      <PageContainer>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have permission to view this page. Audit logs are restricted.
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SEO title="Audit Logs" description="Review system activity and track changes across the platform." />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">Track all operations performed in the system</p>
          </div>
          <Button onClick={fetchLogs} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid w-full max-w-[180px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Action</label>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full max-w-[180px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Table Name</label>
            <div className="relative">
              <Input
                placeholder="Filter by table..."
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="h-9 pr-8"
              />
              {filterTable && (
                <button
                  onClick={() => setFilterTable("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid w-full max-w-[220px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">User (Name, Email, ID)</label>
            <div className="relative">
              <Input
                placeholder="Filter by user..."
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="h-9 pr-8"
              />
              {filterUser && (
                <button
                  onClick={() => setFilterUser("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid w-full max-w-[150px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid w-full max-w-[150px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="flex gap-2 pb-0.5">
            {(filterAction !== "all" || filterTable || filterUser || startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters}
                className="h-9"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1">
          <DataTable 
            columns={columns} 
            data={logs} 
            isLoading={loading}
            searchPlaceholder="Search in results..."
          />
        </div>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about the operation performed.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="size-3" /> Timestamp
                  </span>
                  <p className="font-medium">{format(new Date(selectedLog.created_at), 'PPPPpppp')}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="size-3" /> User
                  </span>
                  <p className="font-medium">{selectedLog.profiles?.full_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{selectedLog.profiles?.email || selectedLog.user_id}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Activity className="size-3" /> Action
                  </span>
                  <div>
                    <Badge variant="outline" className={getActionColor(selectedLog.action)}>
                      {selectedLog.action}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Database className="size-3" /> Table
                  </span>
                  <p className="font-medium">{selectedLog.table_name}</p>
                </div>
              </div>

              <div className="space-y-4">
                {selectedLog.old_data && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Previous Data</h4>
                    <pre className="p-3 bg-muted rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.new_data && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">New Data</h4>
                    <pre className="p-3 bg-muted rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
                    )}
                  </DialogContent>
                </Dialog>
              </PageContainer>
            )
          }
          