import { useEffect, useState, useCallback } from "react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw, Calendar, User, ShieldCheck, X, CheckCircle2, XCircle, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"

interface PinLog {
  id: string
  created_at: string
  user_id: string
  pin_entered: string
  attempt_type: string
  is_success: boolean
  profiles?: {
    full_name: string | null
    email: string | null
  }
}

export default function PinLogsPage() {
  const { user, role, checkPermission } = useAuth()
  const [logs, setLogs] = useState<PinLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filters
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterUser, setFilterUser] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  const canViewLogs = role === 'admin'

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('pin_logs')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (filterType !== "all") {
        query = query.eq('attempt_type', filterType)
      }

      if (filterStatus !== "all") {
        query = query.eq('is_success', filterStatus === "success")
      }

      if (filterUser) {
        query = query.or(`user_id.eq.${filterUser},profiles.full_name.ilike.%${filterUser}%,profiles.email.ilike.%${filterUser}%`)
      }

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setDate(end.getDate() + 1)
        query = query.lt('created_at', end.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      setLogs((data as any[]) || [])
    } catch (error: any) {
      toast.error("Error fetching PIN logs: " + error.message)
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, filterUser, startDate, endDate])

  useEffect(() => {
    if (user && canViewLogs) {
      fetchLogs()
    }
  }, [user, canViewLogs, fetchLogs])

  const handleClearLogs = async () => {
    try {
      setIsDeleting(true)
      const { error } = await supabase
        .from('pin_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Deletes all

      if (error) throw error
      
      toast.success("All PIN logs have been cleared")
      setLogs([])
    } catch (error: any) {
      toast.error("Error clearing logs: " + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const resetFilters = () => {
    setFilterType("all")
    setFilterStatus("all")
    setFilterUser("")
    setStartDate("")
    setEndDate("")
  }

  const columns: ColumnDef<PinLog>[] = [
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
      header: "Employee",
      accessorFn: (row) => row.profiles?.full_name || row.profiles?.email || row.user_id,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {row.original.profiles?.full_name || "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.profiles?.email || row.original.user_id}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "pin_entered",
      header: "PIN Tried",
      cell: ({ row }) => (
        <span className="font-mono font-bold tracking-widest bg-muted px-2 py-1 rounded text-sm">
          {row.original.pin_entered}
        </span>
      ),
    },
    {
      accessorKey: "attempt_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.attempt_type.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: "is_success",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.is_success ? (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 flex items-center gap-1">
              <CheckCircle2 className="size-3" />
              Success
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 flex items-center gap-1">
              <XCircle className="size-3" />
              Failed
            </Badge>
          )}
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
              You do not have permission to view this page. PIN logs are restricted to administrators.
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SEO title="PIN Logs" description="Monitor employee security PIN attempts and entries." />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="size-6 text-primary" />
              Security PIN Logs
            </h1>
            <p className="text-sm text-muted-foreground">Track all PIN entries and setup attempts by employees</p>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={logs.length === 0 || isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Logs
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all security PIN logs from the database.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear Logs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={fetchLogs} variant="outline" size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid w-full max-w-[180px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Attempt Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="setup_initial">Initial Setup</SelectItem>
                <SelectItem value="setup_confirmation">Setup Confirm</SelectItem>
                <SelectItem value="verification">Verification</SelectItem>
                <SelectItem value="update">Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full max-w-[180px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full max-w-[220px] gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Employee Search</label>
            <div className="relative">
              <Input
                placeholder="Name, email, or ID..."
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
            {(filterType !== "all" || filterStatus !== "all" || filterUser || startDate || endDate) && (
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
    </PageContainer>
  )
}
