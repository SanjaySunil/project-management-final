import * as React from "react"
import { toast } from "sonner"
import { Send, Hash, MessageSquare } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { slugify, getErrorMessage } from "@/lib/utils"

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

interface PhaseChatProps {
  projectId: string
  phaseId: string
  phaseTitle: string
}

export function PhaseChat({ projectId, phaseId, phaseTitle }: PhaseChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [newMessage, setNewMessage] = React.useState("")
  const [channel, setChannel] = React.useState<Tables<"channels"> | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [])

  React.useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  React.useEffect(() => {
    if (!phaseId || !user) return

    async function setupChat() {
      try {
        setIsLoading(true)
        const { data: initialChannelData, error: channelError } = await supabase
          .from("channels")
          .select("*")
          .eq("phase_id", phaseId)
          .maybeSingle()

        if (channelError) throw channelError

        let channelData = initialChannelData
        const expectedName = slugify(phaseTitle)

        if (!channelData) {
          const { data: newChannel, error: createError } = await supabase
            .from("channels")
            .insert({
              name: expectedName,
              project_id: projectId,
              phase_id: phaseId,
              created_by: user?.id
            })
            .select()
            .single()
          
          if (createError) {
            if (createError.code === "23505") {
              const { data: existingChannel } = await supabase
                .from("channels")
                .select("*")
                .eq("phase_id", phaseId)
                .single()
              channelData = existingChannel
            } else throw createError
          } else {
            channelData = newChannel
          }
        }

        if (channelData) {
          setChannel(channelData)

          // Sync name if needed
          if (channelData.name !== expectedName) {
            const { error: updateError } = await supabase
              .from("channels")
              .update({ name: expectedName })
              .eq("id", channelData.id)
            
            if (!updateError) {
              setChannel({ ...channelData, name: expectedName })
            }
          }

          // Fetch messages
          const { data: messagesData, error: messagesError } = await supabase
            .from("messages")
            .select(`*, profiles:user_id (full_name, avatar_url, email)`)
            .eq("channel_id", channelData.id)
            .order("created_at", { ascending: true })

          if (messagesError) throw messagesError
          setMessages((messagesData as unknown as Message[]) || [])
        }
      } catch (error) {
        toast.error("Failed to setup chat: " + getErrorMessage(error))
      } finally {
        setIsLoading(false)
      }
    }

    setupChat()

    // Real-time subscription is handled in a separate effect for channelId
  }, [phaseId, projectId, user, phaseTitle])

  React.useEffect(() => {
    if (!channel?.id) return

    const subscription = supabase
      .channel(`phase_chat:${channel.id}`)
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
            .select(`*, profiles:user_id (full_name, avatar_url, email)`)
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
  }, [channel?.id])

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

    if (error) toast.error("Failed to send message: " + getErrorMessage(error))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex h-12 items-center px-4 border-b bg-muted/30">
        <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
        <span className="font-bold text-sm">#{channel?.name || "chat"}</span>
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.profiles?.avatar_url || ""} />
                  <AvatarFallback className="text-xs">
                    {(m.profiles?.full_name || m.profiles?.email || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">{m.profiles?.full_name || m.profiles?.email?.split("@")[0]}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <textarea
            placeholder="Type a message..."
            className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-md border bg-background px-3 py-2 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
