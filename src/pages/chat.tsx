import * as React from "react"
import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { SEO } from "@/components/seo"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Hash, Plus, MessageSquare, Send, Search, Bell, Info, ChevronDown, Globe, Settings, Trash2, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn, slugify } from "@/lib/utils"
import { usePresence } from "@/hooks/use-presence"
import { useNotifications } from "@/hooks/use-notifications"
import { MentionTextarea } from "@/components/mention-textarea"
import { useIsMobile } from "@/hooks/use-mobile"

interface Project {
  id: string
  name: string
}

interface Channel {
  id: string
  name: string
  description: string | null
  project_id: string | null
  created_by: string | null
}

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: {
    full_name: string | null
    avatar_url: string | null
    email: string | null
  }
}

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
  username: string | null
}

export default function ChatPage() {
  const { projectId: routeProjectId, channelId: routeChannelId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, checkPermission } = useAuth()
  const { isOnline } = usePresence()
  const { notifications, markAsRead } = useNotifications()
  const isMobile = useIsMobile()
  
  const canReadChat = checkPermission('read', 'chat')
  const canCreateChannel = checkPermission('create', 'chat')
  const canUpdateChannel = checkPermission('update', 'chat')

  const searchParams = new URLSearchParams(location.search)
  const dmUserId = searchParams.get("with")
  const isDMMode = location.pathname.includes("/chat/dms")
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(routeProjectId || null)
  const [projects, setProjects] = useState<Project[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [newChannelName, setNewChannelName] = useState("")
  const [isNewChannelDialogOpen, setIsNewChannelDialogOpen] = useState(false)
  const [isNewDMDialogOpen, setIsNewDMDialogOpen] = useState(false)
  const [dmSearchQuery, setDmSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [members, setMembers] = useState<Profile[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isCreatingDM = React.useRef(false)

  // Channel Settings State
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [editChannelName, setEditChannelName] = useState("")
  const [editChannelDescription, setEditChannelDescription] = useState("")
  const [isDeletingChannel, setIsDeletingChannel] = useState(false)
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false)

  const currentProjectName = currentProjectId 
    ? projects.find(p => p.id === currentProjectId)?.name || "Project"
    : "Global Workspace"

  const canManageChannel = selectedChannel && (
    canUpdateChannel || 
    selectedChannel.created_by === user?.id
  ) && !selectedChannel.name.startsWith("dm--")

  // Helper to handle DMs
  const getOtherUserFromDM = (channel: Channel) => {
    if (!channel.name.startsWith("dm--") || !user) return null
    const parts = channel.name.replace("dm--", "").split("--")
    const otherUserId = parts.find(id => id !== user.id) || parts[0]
    return members.find(m => m.id === otherUserId)
  }

  const handleSelectChannel = React.useCallback((channel: Channel) => {
    if (channel.name.startsWith("dm--")) {
      navigate(`/dashboard/chat/dms/${channel.id}`)
    } else if (!channel.project_id) {
      navigate(`/dashboard/chat/${channel.id}`)
    } else {
      navigate(`/dashboard/projects/${channel.project_id}/chat/${channel.id}`)
    }
  }, [navigate])

  const handleProjectChange = React.useCallback((id: string | null) => {
    if (id) {
      navigate(`/dashboard/projects/${id}/chat`)
    } else {
      navigate("/dashboard/chat")
    }
  }, [navigate])

  const handleBackToList = React.useCallback(() => {
    if (isDMMode) {
      navigate("/dashboard/chat/dms")
    } else if (currentProjectId) {
      navigate(`/dashboard/projects/${currentProjectId}/chat`)
    } else {
      navigate("/dashboard/chat")
    }
    setSelectedChannel(null)
  }, [navigate, isDMMode, currentProjectId])

  const handleStartDM = React.useCallback(async (otherUser: Profile) => {
    if (!user || isCreatingDM.current) return
    if (otherUser.id === user.id) return

    const dmName = [user.id, otherUser.id].sort().join("--")
    const fullName = `dm--${dmName}`

    // Check if DM channel already exists in current state
    const existing = channels.find(c => c.name === fullName)
    if (existing) {
      handleSelectChannel(existing)
      return
    }

    isCreatingDM.current = true
    try {
      // Double check with database to be sure
      const { data: existingFromDb } = await supabase
        .from("channels")
        .select("*")
        .eq("name", fullName)
        .is("project_id", null)
        .maybeSingle()

      if (existingFromDb) {
        setChannels(prev => {
          if (prev.find(c => c.id === existingFromDb.id)) return prev
          return [...prev, existingFromDb as Channel]
        })
        handleSelectChannel(existingFromDb as Channel)
        return
      }

      // Create new DM channel
      const { data, error } = await supabase.from("channels").insert({
        name: fullName,
        project_id: null,
        created_by: user.id,
        description: `Direct message between ${user.user_metadata?.full_name || user.email} and ${otherUser.full_name || otherUser.email}`
      }).select().single()

      if (error) {
        if (error.code === '23505') { // Unique violation
           const { data: retryData } = await supabase
            .from("channels")
            .select("*")
            .eq("name", fullName)
            .is("project_id", null)
            .single()
           if (retryData) {
              setChannels(prev => {
                if (prev.find(c => c.id === (retryData as Channel).id)) return prev
                return [...prev, retryData as Channel]
              })
              handleSelectChannel(retryData as Channel)
           }
        } else {
          toast.error("Failed to start direct message")
        }
      } else {
        const newChannel = data as Channel
        setChannels(prev => [...prev, newChannel])
        handleSelectChannel(newChannel)
        toast.success(`Started conversation with ${otherUser.full_name || otherUser.username || "User"}`)
      }
    } finally {
      isCreatingDM.current = false
    }
  }, [user, channels, handleSelectChannel])

  // Sync state with route
  useEffect(() => {
    setCurrentProjectId(routeProjectId || null)
  }, [routeProjectId])

  // Mark notifications for this channel as read
  useEffect(() => {
    if (selectedChannel && notifications.length > 0) {
      const channelNotifications = notifications.filter(
        n => !n.is_read && n.metadata?.channel_id === selectedChannel.id
      )
      
      channelNotifications.forEach(n => markAsRead(n.id))
    }
  }, [selectedChannel, notifications, markAsRead])

  // Handle 'with' query param for starting DMs
  useEffect(() => {
    if (dmUserId && members.length > 0 && user && channels.length > 0) {
      const otherUser = members.find(m => m.id === dmUserId)
      if (otherUser) {
        handleStartDM(otherUser)
        // Clean up the URL
        navigate(location.pathname, { replace: true })
      }
    }
  }, [dmUserId, members, user, channels, navigate, location.pathname, handleStartDM])

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      const projectsQuery = supabase.from("projects").select("id, name").order("name")
      
      const isAdmin = role === "admin"
      if (!isAdmin && user) {
        // Only show projects the user is a member of
        const { data: memberProjects } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id)
        
        if (memberProjects && memberProjects.length > 0) {
          const projectIds = memberProjects.map(mp => mp.project_id)
          projectsQuery.in("id", projectIds)
        } else {
          projectsQuery.eq("id", "00000000-0000-0000-0000-000000000000")
        }
      }

      const [projectsRes, profilesRes] = await Promise.all([
        projectsQuery,
        supabase.from("profiles").select("*").order("full_name")
      ])
      
      if (!projectsRes.error && projectsRes.data) {
        setProjects(projectsRes.data as Project[])
      }

      if (!profilesRes.error && profilesRes.data) {
        setMembers(profilesRes.data as Profile[])
      }
    }
    fetchData()
  }, [user, role])

  // Fetch channels based on current project context
  useEffect(() => {
    async function fetchChannels() {
      // Only show loading if we don't have channels yet or project changed
      if (channels.length === 0) setIsLoading(true)
      
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("name")
      
      if (error) {
        toast.error("Failed to load channels")
      } else {
        const fetchedChannels = (data as Channel[]) || []
        setChannels(fetchedChannels)
      }
      setIsLoading(false)
    }

    fetchChannels()
  }, [currentProjectId, isDMMode])

  // Sync selected channel with route
  useEffect(() => {
    if (channels.length === 0) return

    let channelToSelect: Channel | undefined
    
    if (routeChannelId) {
      channelToSelect = channels.find(c => c.id === routeChannelId)
    }
    
    if (!channelToSelect && !isMobile) {
      if (isDMMode) {
        // Pick first DM channel
        channelToSelect = channels.find(c => c.name.startsWith("dm--"))
      } else {
        // Fallback to project context if no channel in route
        channelToSelect = channels.find(c => 
          !c.name.startsWith("dm--") && 
          (currentProjectId ? c.project_id === currentProjectId : !c.project_id)
        ) || channels.find(c => !c.name.startsWith("dm--"))
      }
    }
    
    if (channelToSelect && channelToSelect.id !== selectedChannel?.id) {
      setSelectedChannel(channelToSelect)
    } else if (!channelToSelect && selectedChannel) {
      setSelectedChannel(null)
    }
  }, [routeChannelId, channels, isDMMode, currentProjectId, selectedChannel?.id, isMobile])

  // Fetch messages when selectedChannel changes
  useEffect(() => {
    if (!selectedChannel) {
      setMessages([])
      return
    }

    const channelId = selectedChannel.id
    setMessages([]) // Clear messages when channel changes

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })

      if (error) {
        toast.error("Failed to load messages")
      } else {
        setMessages((data as unknown as Message[]) || [])
      }
    }

    fetchMessages()

    // Subscribe to new messages
    const subscription = supabase
      .channel(`channel:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch the full message with profile info
          const { data, error } = await supabase
            .from("messages")
            .select(`
              *,
              profiles:user_id (
                full_name,
                avatar_url,
                email
              )
            `)
            .eq("id", payload.new.id)
            .single()

          if (!error && data) {
            setMessages((prev) => [...prev, data as unknown as Message])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [selectedChannel])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChannel || !user) return

    const messageContent = newMessage.trim()
    setNewMessage("")

    const { error } = await supabase.from("messages").insert({
      content: messageContent,
      channel_id: selectedChannel.id,
      user_id: user.id,
    })

    if (error) {
      toast.error("Failed to send message")
    }
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user) return

    const { data, error } = await supabase.from("channels").insert({
      name: slugify(newChannelName),
      project_id: currentProjectId || null,
      created_by: user.id,
    }).select().single()

    if (error) {
      toast.error("Failed to create channel")
    } else {
      const newChannel = data as Channel
      setChannels((prev) => [...prev, newChannel].sort((a, b) => a.name.localeCompare(b.name)))
      handleSelectChannel(newChannel)
      setNewChannelName("")
      setIsNewChannelDialogOpen(false)
      toast.success("Channel created")
    }
  }

  const handleUpdateChannel = async () => {
    if (!selectedChannel || !editChannelName.trim()) return

    const { data, error } = await supabase
      .from("channels")
      .update({
        name: slugify(editChannelName),
        description: editChannelDescription.trim() || null,
      })
      .eq("id", selectedChannel.id)
      .select()
      .single()

    if (error) {
      toast.error("Failed to update channel")
    } else {
      const updatedChannel = data as Channel
      setChannels((prev) => 
        prev.map((c) => (c.id === updatedChannel.id ? updatedChannel : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setSelectedChannel(updatedChannel)
      setIsSettingsDialogOpen(false)
      toast.success("Channel updated")
    }
  }

  const handleDeleteChannel = async () => {
    if (!selectedChannel) return

    setIsDeletingChannel(true)
    const { error } = await supabase
      .from("channels")
      .delete()
      .eq("id", selectedChannel.id)

    if (error) {
      toast.error("Failed to delete channel")
      setIsDeletingChannel(false)
    } else {
      const remainingChannels = channels.filter((c) => c.id !== selectedChannel.id)
      setChannels(remainingChannels)
      setSelectedChannel(remainingChannels.length > 0 ? remainingChannels[0] : null)
      setIsConfirmDeleteDialogOpen(false)
      setIsSettingsDialogOpen(false)
      toast.success("Channel deleted")
      setIsDeletingChannel(false)
    }
  }

  useEffect(() => {
    if (selectedChannel && isSettingsDialogOpen) {
      setEditChannelName(selectedChannel.name)
      setEditChannelDescription(selectedChannel.description || "")
    }
  }, [selectedChannel, isSettingsDialogOpen])

  const filteredRegularChannels = channels.filter(c => 
    !c.name.startsWith("dm--") && 
    (currentProjectId ? c.project_id === currentProjectId : !c.project_id)
  )

  const dmChannels = channels.filter(c => c.name.startsWith("dm--"))

  const filteredMembers = members.filter(m => 
    m.id !== user?.id && 
    (m.full_name?.toLowerCase().includes(dmSearchQuery.toLowerCase()) || 
     m.email?.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
     m.username?.toLowerCase().includes(dmSearchQuery.toLowerCase()))
  )

  if (!canReadChat && role !== null) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <h3 className="text-lg font-bold">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to access the chat.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <SEO title="Chat" description="Communicate with your team and collaborate on projects in real-time." />
      <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
        {/* Chat Sidebar */}
        <div className={cn(
          "flex w-64 flex-col border-r bg-muted/20",
          isMobile && selectedChannel && "hidden",
          isMobile && !selectedChannel && "w-full"
        )}>
          <div className="flex h-14 items-center justify-between px-4 border-b">
            {isDMMode ? (
              <div className="flex items-center h-9 px-2">
                <span className="font-bold text-sm">Direct Messages</span>
              </div>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 px-2 flex items-center gap-2 max-w-[180px] overflow-hidden">
                      <span className="font-bold text-sm truncate">{currentProjectName}</span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={() => handleProjectChange(null)} className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Global Workspace</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {projects.map((project) => (
                      <DropdownMenuItem 
                        key={project.id} 
                        onClick={() => handleProjectChange(project.id)}
                        className="flex items-center gap-2"
                      >
                        <div className="h-4 w-4 rounded-sm bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                          {project.name.charAt(0)}
                        </div>
                        <span className="truncate">{project.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {canCreateChannel && (
                  <Dialog open={isNewChannelDialogOpen} onOpenChange={setIsNewChannelDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create a channel</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Channel name</Label>
                          <Input
                            id="name"
                            placeholder="e.g. general"
                            value={newChannelName}
                            onChange={(e) => setNewChannelName(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Channels are where your team communicates in {currentProjectName}.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewChannelDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateChannel}>Create</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-4">
              {/* Channels Section */}
              {!isDMMode && (
                <div className="space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Channels
                  </div>
                  {isLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">Loading...</div>
                  ) : filteredRegularChannels.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">No channels</div>
                  ) : (
                    filteredRegularChannels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => handleSelectChannel(channel)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all duration-200",
                          selectedChannel?.id === channel.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Hash className={cn(
                          "h-4 w-4 shrink-0 transition-opacity",
                          selectedChannel?.id === channel.id ? "opacity-100" : "opacity-50"
                        )} />
                        <span className="truncate">{channel.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Direct Messages Section */}
              {isDMMode && (
                <div className="space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    Direct Messages
                    <Dialog open={isNewDMDialogOpen} onOpenChange={setIsNewDMDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-4 w-4 opacity-50 hover:opacity-100">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Direct Messages</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search people..."
                              className="pl-9"
                              value={dmSearchQuery}
                              onChange={(e) => setDmSearchQuery(e.target.value)}
                            />
                          </div>
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-1">
                              {filteredMembers.length === 0 ? (
                                <p className="text-center py-4 text-sm text-muted-foreground">No people found</p>
                              ) : (
                                filteredMembers.map((member) => (
                                  <button
                                    key={member.id}
                                    onClick={() => {
                                      handleStartDM(member)
                                      setIsNewDMDialogOpen(false)
                                      setDmSearchQuery("")
                                    }}
                                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={member.avatar_url || ""} />
                                      <AvatarFallback>
                                        {(member.full_name || member.email || "U").charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col items-start min-w-0">
                                      <span className="font-medium truncate w-full text-left">
                                        {member.full_name || member.username || member.email?.split("@")[0]}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground truncate w-full text-left">
                                        {member.email}
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {isLoading ? (
                    <div className="px-3 py-2 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : dmChannels.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">No conversations</div>
                  ) : (
                    dmChannels.map((channel) => {
                      const otherUser = getOtherUserFromDM(channel)
                      return (
                        <button
                          key={channel.id}
                          onClick={() => handleSelectChannel(channel)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all duration-200",
                            selectedChannel?.id === channel.id
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={otherUser?.avatar_url || ""} />
                              <AvatarFallback className="text-[6px] bg-primary/10">
                                {(otherUser?.full_name || otherUser?.email || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {otherUser && isOnline(otherUser.id) && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-background bg-emerald-500" />
                            )}
                          </div>
                          <span className="truncate">
                            {otherUser?.full_name || otherUser?.username || otherUser?.email?.split("@")[0] || "Deleted User"}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className={cn(
          "flex flex-1 flex-col overflow-hidden bg-background",
          isMobile && !selectedChannel && "hidden"
        )}>
          {selectedChannel ? (
            <>
              {/* Chat Header */}
              <div className="flex h-14 items-center justify-between px-4 border-b">
                <div className="flex items-center gap-2 overflow-hidden">
                  {isMobile && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={handleBackToList}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  )}
                  {selectedChannel.name.startsWith("dm--") ? (
                    (() => {
                      const otherUser = getOtherUserFromDM(selectedChannel)
                      return (
                        <>
                          <div className="relative shrink-0">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={otherUser?.avatar_url || ""} />
                              <AvatarFallback className="text-[10px] bg-primary/10">
                                {(otherUser?.full_name || otherUser?.email || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {otherUser && isOnline(otherUser.id) && (
                              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-background bg-emerald-500" />
                            )}
                          </div>
                          <h3 className="font-bold text-sm leading-none truncate">
                            {otherUser?.full_name || otherUser?.username || otherUser?.email?.split("@")[0] || "Direct Message"}
                          </h3>
                        </>
                      )
                    })()
                  ) : (
                    <>
                      <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex flex-col">
                        <h3 className="font-bold text-sm leading-none truncate">{selectedChannel.name}</h3>
                        {selectedChannel.description && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[200px] md:max-w-[400px]">
                            {selectedChannel.description}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  {canManageChannel && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 ml-1 shrink-0" 
                      onClick={() => setIsSettingsDialogOpen(true)}
                    >
                      <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Bell className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={isSidebarOpen ? "secondary" : "ghost"} 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Channel Settings Dialog */}
              <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Channel Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Channel Name</Label>
                      <Input
                        id="edit-name"
                        value={editChannelName}
                        onChange={(e) => setEditChannelName(e.target.value)}
                        placeholder="channel-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editChannelDescription}
                        onChange={(e) => setEditChannelDescription(e.target.value)}
                        placeholder="What is this channel about?"
                        rows={3}
                      />
                    </div>
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full justify-start gap-2"
                        onClick={() => setIsConfirmDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Channel
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdateChannel}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation */}
              <ConfirmDialog
                open={isConfirmDeleteDialogOpen}
                onOpenChange={setIsConfirmDeleteDialogOpen}
                onConfirm={handleDeleteChannel}
                title={`Delete channel #${selectedChannel.name}?`}
                description="This will permanently delete the channel and all of its messages. This action cannot be undone."
                confirmText={isDeletingChannel ? "Deleting..." : "Delete Channel"}
                variant="destructive"
              />

              {/* Message List */}
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-6 p-4 md:p-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                        {selectedChannel.name.startsWith("dm--") ? (
                          <MessageSquare className="h-10 w-10 text-muted-foreground" />
                        ) : (
                          <Hash className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      <h4 className="font-bold text-2xl tracking-tight">
                        {selectedChannel.name.startsWith("dm--") 
                          ? `Chat with ${getOtherUserFromDM(selectedChannel)?.full_name || "this user"}`
                          : `Welcome to #${selectedChannel.name}!`}
                      </h4>
                      <p className="text-muted-foreground max-w-sm mt-2 text-sm">
                        {selectedChannel.name.startsWith("dm--")
                          ? "This is the very beginning of your direct message history."
                          : `This is the start of the #${selectedChannel.name} channel. ${selectedChannel.description || "Use it to discuss anything related to this topic."}`}
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="flex gap-4 group">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={message.profiles?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {(message.profiles?.full_name || message.profiles?.email || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {message.profiles?.full_name || message.profiles?.email?.split("@")[0]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-sm text-foreground/90 leading-normal whitespace-pre-wrap break-words">
                            {(() => {
                              if (!message.content.includes("@")) return message.content
                              
                              // Match @ followed by word characters, dots, or hyphens
                              const parts = message.content.split(/(@[\w.-]+)/g)
                              return parts.map((part, i) => {
                                if (part.startsWith("@")) {
                                  const username = part.slice(1).toLowerCase()
                                  const isMember = members.some(m => 
                                    (m.username?.toLowerCase() === username) || 
                                    (m.full_name?.replace(/\s+/g, "").toLowerCase() === username)
                                  )
                                  if (isMember) {
                                    return (
                                      <span key={i} className="text-primary font-semibold bg-primary/10 px-1 rounded-sm">
                                        {part}
                                      </span>
                                    )
                                  }
                                }
                                return part
                              })
                            })()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="px-4 pb-4">
                <form 
                  onSubmit={handleSendMessage}
                  className="relative rounded-xl border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all"
                >
                  <MentionTextarea
                    placeholder={selectedChannel.name.startsWith("dm--") 
                      ? `Message ${getOtherUserFromDM(selectedChannel)?.full_name || "user"}`
                      : `Message #${selectedChannel.name}`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onSendMessage={(content) => {
                      if (!content.trim() || !selectedChannel || !user) return
                      
                      const messageContent = content.trim()
                      setNewMessage("")
                      
                      supabase.from("messages").insert({
                        content: messageContent,
                        channel_id: selectedChannel.id,
                        user_id: user.id,
                      }).then(({ error }) => {
                        if (error) toast.error("Failed to send message")
                      })
                    }}
                    members={members}
                  />
                  <div className="flex items-center justify-between px-2 py-1.5 border-t bg-muted/5 rounded-b-xl">
                    <div className="flex gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button type="submit" size="sm" className="h-8 px-3 gap-1.5" disabled={!newMessage.trim()}>
                      <span className="text-xs font-medium">Send</span>
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold">Select a conversation</h3>
              <p className="text-muted-foreground mt-2">
                Choose a channel or direct message from the sidebar to start chatting.
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar - Member List */}
        {isSidebarOpen && selectedChannel && (
          <div className="hidden lg:flex w-64 flex-col border-l bg-muted/20">
            <div className="flex h-14 items-center justify-between px-4 border-b">
              <h4 className="font-bold text-sm">Details</h4>
              {canManageChannel && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs gap-1"
                  onClick={() => setIsSettingsDialogOpen(true)}
                >
                  Edit
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-8">
                {!selectedChannel.name.startsWith("dm--") && (
                  <div>
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 px-2">
                      About
                    </h5>
                    <div className="px-2 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Topic</p>
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          {selectedChannel.description || "No topic set for this channel."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 px-2">
                    {selectedChannel.name.startsWith("dm--") ? "Conversation With" : `Members — ${members.length}`}
                  </h5>
                  <div className="space-y-0.5">
                    {selectedChannel.name.startsWith("dm--") ? (
                      (() => {
                        const otherUser = getOtherUserFromDM(selectedChannel)
                        if (!otherUser) return <p className="text-xs px-2 text-muted-foreground">User not found</p>
                        return (
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors cursor-pointer group">
                            <div className="relative">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={otherUser.avatar_url || ""} />
                                <AvatarFallback className="text-[10px] bg-primary/5">
                                  {(otherUser.full_name || otherUser.email || "U").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {isOnline(otherUser.id) && (
                                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-background bg-emerald-500" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium truncate group-hover:text-foreground text-muted-foreground">
                                {otherUser.full_name || otherUser.username || otherUser.email?.split("@")[0]}
                              </span>
                              <span className="text-[9px] text-muted-foreground truncate">{otherUser.email}</span>
                            </div>
                          </div>
                        )
                      })()
                    ) : (
                      members.map((member) => (
                        <div
                          key={member.id}
                          onClick={() => handleStartDM(member)}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors cursor-pointer group"
                        >
                          <div className="relative">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={member.avatar_url || ""} />
                              <AvatarFallback className="text-[10px] bg-primary/5">
                                {(member.full_name || member.email || "U").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {isOnline(member.id) && (
                              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-background bg-emerald-500" />
                            )}
                          </div>
                          <span className="text-xs font-medium truncate group-hover:text-foreground text-muted-foreground">
                            {member.full_name || member.username || member.email?.split("@")[0]}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </>
  )
}