import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { MessageSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

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

interface Channel {
  id: string
  name: string
}

interface DirectMessageProps {
  recipientId: string
  recipientName: string
}

export function DirectMessage({ recipientId, recipientName }: DirectMessageProps) {
  const { user } = useAuth()
  const [channel, setChannel] = React.useState<Channel | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [newMessage, setNewMessage] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Find or create DM channel
  React.useEffect(() => {
    if (!user || !recipientId) return

    async function getOrCreateChannel() {
      if (!user) return
      setIsLoading(true)
      const dmName = [user.id, recipientId].sort().join("--")
      const fullName = `dm--${dmName}`

      const { data: existing } = await supabase
        .from("channels")
        .select("id, name")
        .eq("name", fullName)
        .is("project_id", null)
        .maybeSingle()

      if (existing) {
        setChannel(existing)
        setIsLoading(false)
      } else {
        const { data: created, error: createError } = await supabase
          .from("channels")
          .insert({
            name: fullName,
            project_id: null,
            created_by: user.id,
            description: `Direct message`
          })
          .select("id, name")
          .single()

        if (createError) {
          if (createError.code === '23505') { // Unique violation
            const { data: retryData } = await supabase
              .from("channels")
              .select("id, name")
              .eq("name", fullName)
              .is("project_id", null)
              .single()
            if (retryData) {
              setChannel(retryData)
            } else {
              toast.error("Failed to start direct message")
            }
          } else {
            toast.error("Failed to start direct message")
          }
          setIsLoading(false)
        } else {
          setChannel(created)
          setIsLoading(false)
        }
      }
    }

    getOrCreateChannel()
  }, [user, recipientId])

  // Fetch messages
  React.useEffect(() => {
    if (!channel) return

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
        .eq("channel_id", channel!.id)
        .order("created_at", { ascending: true })

      if (!error && data) {
        setMessages((data as unknown as Message[]) || [])
      }
    }

    fetchMessages()

    const subscription = supabase
      .channel(`channel:${channel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channel.id}`,
        },
        async (payload) => {
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
  }, [channel])

  // Auto scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !channel || !user) return

    const content = newMessage.trim()
    setNewMessage("")

    const { error } = await supabase.from("messages").insert({
      content,
      channel_id: channel.id,
      user_id: user.id,
    })

    if (error) {
      toast.error("Failed to send message")
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Opening conversation...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[500px]">
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation with {recipientName}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={message.profiles?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    {(message.profiles?.full_name || message.profiles?.email || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs">
                      {message.profiles?.full_name || message.profiles?.email?.split("@")[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <textarea
            placeholder={`Message ${recipientName}...`}
            className="flex min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(e)
              }
            }}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()} className="shrink-0 h-[40px] w-[40px]">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
