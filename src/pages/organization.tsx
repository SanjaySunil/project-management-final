import { useState, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Building2, Globe, Mail, Save, Upload, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useOrganization } from "@/hooks/use-organization"
import { useAuth } from "@/hooks/use-auth"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const SIDEBAR_ITEMS = [
  { id: "My Tasks", label: "My Tasks" },
  { id: "Notifications", label: "Notifications" },
  { id: "Clients", label: "Clients" },
  { id: "Projects", label: "Projects" },
  { id: "Finances", label: "Finances" },
  { id: "Credentials", label: "Credentials" },
  { id: "Team Chat", label: "Team Chat" },
  { id: "Direct Messages", label: "Direct Messages" },
  { id: "Team", label: "Team" },
  { id: "Audit Logs", label: "Audit Logs" },
]

export default function OrganizationPage() {
  const { role } = useAuth()
  const { organization, updateOrganization } = useOrganization()
  const [loading, setLoading] = useState(false)
  const [orgData, setOrgData] = useState(organization)

  const isAdmin = role === 'admin'

  useEffect(() => {
    setOrgData(organization)
  }, [organization])

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can update organization settings")
      return
    }
    setLoading(true)
    await updateOrganization(orgData)
    setLoading(false)
  }

  const handleSidebarToggle = (itemId: string, enabled: boolean) => {
    setOrgData({
      ...orgData,
      sidebar_settings: {
        ...(orgData.sidebar_settings || {}),
        [itemId]: enabled,
      },
    })
  }

  const initials = orgData.name
    ? orgData.name.substring(0, 2).toUpperCase()
    : "OR"

  return (
    <PageContainer>
      <SEO title="Organization Settings" description="Manage your company profile, branding, and billing information." />
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Organization Settings</h2>
          <Button onClick={handleSave} disabled={loading || !isAdmin}>
            {loading ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
          </Button>
        </div>
        {!isAdmin && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Read Only</AlertTitle>
            <AlertDescription>
              You do not have permission to modify organization settings. Please contact an administrator.
            </AlertDescription>
          </Alert>
        )}
        <Separator />
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>
                Basic information about your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={orgData.logo || undefined} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" /> Change Logo
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Recommended size: 512x512px. Max 1MB.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="org-name"
                      value={orgData.name}
                      onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                      className="pl-9"
                      placeholder="Organization Name"
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="website"
                      value={orgData.website || ""}
                      onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                      className="pl-9"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Contact Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={orgData.email || ""}
                      onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                      className="pl-9"
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-4 lg:col-span-3">
            <CardHeader>
              <CardTitle>Sidebar Configuration</CardTitle>
              <CardDescription>
                Toggle which pages are visible in the sidebar for all users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {SIDEBAR_ITEMS.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <Label htmlFor={`sidebar-${item.id}`} className="flex-1 cursor-pointer">
                      {item.label}
                    </Label>
                    <Switch
                      id={`sidebar-${item.id}`}
                      checked={orgData.sidebar_settings?.[item.id] !== false}
                      onCheckedChange={(checked) => handleSidebarToggle(item.id, checked)}
                      disabled={!isAdmin}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-4 lg:col-span-3">
            <CardHeader>
              <CardTitle>Billing Contact</CardTitle>
              <CardDescription>
                Where we should send your invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="billing-email">Billing Email</Label>
                <Input
                  id="billing-email"
                  type="email"
                  value={orgData.billing_email || ""}
                  onChange={(e) => setOrgData({ ...orgData, billing_email: e.target.value })}
                  placeholder="billing@example.com"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Invoices will be sent to this email address. If empty, the contact email will be used.
              </p>
            </CardContent>
          </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="font-medium">Delete Organization</p>
                <p className="text-sm text-muted-foreground">
                  Once you delete an organization, there is no going back. Please be certain.
                </p>
              </div>
              <Button variant="destructive">Delete Organization</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
