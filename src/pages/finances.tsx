import { useEffect, useState } from "react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { 
  TrendingUp, 
  DollarSign, 
  Receipt, 
  ArrowUpRight, 
  Wallet,
  Plus
} from "lucide-react"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ExpenseForm } from "@/components/finances/expense-form"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

export default function FinancesPage() {
  const { user, organizationId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [expenseData, setExpenseData] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    pendingInvoices: 0,
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [
        { data: proposals },
        { data: expenses },
        { data: projectsData }
      ] = await Promise.all([
        supabase
          .from("proposals")
          .select("*, projects(name, clients(first_name, last_name))")
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("*, projects(name)")
          .order("date", { ascending: false }),
        supabase
          .from("projects")
          .select("id, name")
          .order("name")
      ])

      const totalRevenue = proposals?.reduce((acc, p) => acc + (Number(p.net_amount ?? p.amount) || 0), 0) || 0
      const totalExpenses = expenses?.reduce((acc, e) => acc + (Number(e.amount) || 0), 0) || 0
      
      setRevenueData(proposals || [])
      setExpenseData(expenses || [])
      setProjects(projectsData || [])
      
      setStats({
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        pendingInvoices: proposals?.filter(p => p.status === "sent").length || 0
      })
    } catch (error) {
      console.error("Error fetching finance data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddExpense = async (values: any) => {
    try {
      if (!organizationId) {
        toast.error("No organization found. Please try again.")
        return
      }

      const { error } = await supabase.from("expenses").insert({
        ...values,
        amount: Number(values.amount),
        user_id: user?.id,
        organization_id: organizationId
      })

      if (error) throw error

      toast.success("Expense added successfully")
      setIsDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error("Error adding expense:", error)
      toast.error("Failed to add expense")
    }
  }

  const revenueColumns = [
    {
      accessorKey: "title",
      header: "Template/Invoice",
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("title")}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{row.original.order_source}</span>
        </div>
      )
    },
    {
      accessorKey: "projects.clients",
      header: "Client",
      cell: ({ row }: any) => {
        const client = row.original.projects?.clients
        return client ? `${client.first_name} ${client.last_name || ""}` : "N/A"
      }
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }: any) => {
        const amount = Number(row.getValue("amount") || 0)
        const netAmount = Number(row.original.net_amount ?? amount)
        const isFiverr = row.original.order_source === "fiverr"

        return (
          <div className="flex flex-col">
            <span className="font-mono text-emerald-600">+{formatCurrency(netAmount)}</span>
            {isFiverr && (
              <span className="text-[10px] text-muted-foreground">
                Gross: {formatCurrency(amount)}
              </span>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: "order_source",
      header: "Source",
      cell: ({ row }: any) => (
        <Badge variant="outline" className="capitalize">
          {row.getValue("order_source") || "Direct"}
        </Badge>
      )
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => (
        <Badge 
          variant={
            row.getValue("status") === "accepted" ? "default" : 
            row.getValue("status") === "sent" ? "secondary" : "outline"
          } 
          className="capitalize"
        >
          {row.getValue("status")}
        </Badge>
      )
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }: any) => new Date(row.getValue("created_at")).toLocaleDateString()
    }
  ]

  const expenseColumns = [
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("description")}</span>
          <span className="text-xs text-muted-foreground">{row.original.projects?.name || "General"}</span>
        </div>
      )
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }: any) => (
        <Badge variant="outline" className="capitalize">
          {row.getValue("category")}
        </Badge>
      )
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }: any) => (
        <span className="font-mono text-red-600">-{formatCurrency(row.getValue("amount") || 0)}</span>
      )
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }: any) => new Date(row.getValue("date")).toLocaleDateString()
    }
  ]

  return (
    <PageContainer>
      <SEO title="Finances" description="Manage your business revenue, expenses, and financial health." />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
            <p className="text-muted-foreground">Track your income, expenses and overall financial performance.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <ExpenseForm onSubmit={handleAddExpense} projects={projects} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-emerald-500 flex items-center"><TrendingUp className="h-3 w-3" /> +12.5%</span> from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalExpenses)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-red-500 flex items-center"><TrendingUp className="h-3 w-3" /> +4.2%</span> from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.netProfit)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-emerald-500 flex items-center"><TrendingUp className="h-3 w-3" /> +18.2%</span> from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
              <p className="text-xs text-muted-foreground">Currently awaiting payment</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Revenue vs Expenses</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <ChartAreaInteractive />
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>
                    Your most recent financial activities.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {revenueData.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center">
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.projects?.clients?.first_name} {item.projects?.clients?.last_name}
                          </p>
                        </div>
                        <div className="ml-auto font-medium text-emerald-600">
                          +{formatCurrency(item.net_amount ?? item.amount)}
                        </div>
                      </div>
                    ))}
                    {expenseData.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-center">
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">{item.description}</p>
                          <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
                        </div>
                        <div className="ml-auto font-medium text-red-600">
                          -{formatCurrency(item.amount)}
                        </div>
                      </div>
                    ))}
                    {revenueData.length === 0 && expenseData.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground">No recent transactions</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                  <CardDescription>
                    Detailed breakdown of all income from projects and templates.
                  </CardDescription>
                </CardHeader>
              <CardContent>
                <DataTable 
                  columns={revenueColumns} 
                  data={revenueData} 
                  isLoading={loading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Expenses</CardTitle>
                <CardDescription>
                  Track what you're spending on your business operations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable 
                  columns={expenseColumns} 
                  data={expenseData} 
                  isLoading={loading}
                />
                {expenseData.length === 0 && !loading && (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Receipt className="mx-auto h-12 w-12 opacity-20" />
                      <h3 className="mt-4 text-lg font-semibold">No expenses recorded</h3>
                      <p className="text-sm">Start tracking your business costs to see your net profit.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}