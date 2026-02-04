import * as React from "react"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { Command, CommandGroup, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
  username: string | null
}

interface MentionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  members: Profile[]
  onSendMessage: (content: string) => void
}

export function MentionTextarea({ 
  members, 
  onSendMessage, 
  className, 
  value, 
  onChange, 
  onKeyDown,
  ...props 
}: MentionTextareaProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [cursorPosition, setCursorPosition] = React.useState(0)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const position = e.target.selectionStart || 0
    setCursorPosition(position)
    
    if (onChange) onChange(e)

    // Detect if we are typing a mention
    const textBeforeCursor = newValue.slice(0, position)
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@")
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1)
      // Check if there are no spaces between @ and cursor
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setSearch(textAfterAt)
        setOpen(true)
        return
      }
    }
    
    setOpen(false)
  }

  const handleSelectUser = (user: Profile) => {
    if (!textareaRef.current) return

    const text = value as string
    const textBeforeAt = text.slice(0, text.lastIndexOf("@", cursorPosition - 1))
    const textAfterCursor = text.slice(cursorPosition)
    
    const mentionName = user.username || user.full_name?.replace(/\s+/g, "").toLowerCase() || "user"
    const newText = `${textBeforeAt}@${mentionName} ${textAfterCursor}`
    
    // Simulate a change event
    const event = {
      target: {
        value: newText
      }
    } as React.ChangeEvent<HTMLTextAreaElement>
    
    if (onChange) onChange(event)
    
    setOpen(false)
    
    // Focus back and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newPosition = textBeforeAt.length + mentionName.length + 2 // +1 for @, +1 for space
        textareaRef.current.setSelectionRange(newPosition, newPosition)
      }
    }, 0)
  }

  const filteredMembers = members.filter(m => {
    const searchLower = search.toLowerCase()
    return (
      m.full_name?.toLowerCase().includes(searchLower) ||
      m.username?.toLowerCase().includes(searchLower) ||
      m.email?.toLowerCase().includes(searchLower)
    )
  })

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter")) {
      // Allow Command component to handle these
      if (e.key === "Enter" && filteredMembers.length > 0) {
        e.preventDefault()
        // We'll let the CommandItem's onSelect handle it, 
        // but we need to prevent the form submission/newline
      }
      return
    }

    if (e.key === "Enter" && !e.shiftKey && !open) {
      e.preventDefault()
      onSendMessage(value as string)
    }

    if (onKeyDown) onKeyDown(e)
  }

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <textarea
            {...props}
            ref={textareaRef}
            className={cn(
              "min-h-[80px] w-full resize-none border-0 bg-transparent p-3 text-sm focus-visible:ring-0",
              className
            )}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
          />
        </PopoverAnchor>
        <PopoverContent 
          className="p-0 w-[200px]"
          align="start"
          side="top"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command className="w-full">
            <CommandList>
              <CommandEmpty>No users found</CommandEmpty>
              <CommandGroup heading="People">
                {filteredMembers.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={member.username || member.full_name || member.id}
                    onSelect={() => handleSelectUser(member)}
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url || ""} />
                      <AvatarFallback className="text-[10px]">
                        {(member.full_name || member.email || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium truncate">
                        {member.full_name || member.username || member.email?.split("@")[0]}
                      </span>
                      {member.username && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          @{member.username}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
