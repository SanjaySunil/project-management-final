import { Bell } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/hooks/use-notifications"

export function NotificationsButton() {
  const { unreadCount } = useNotifications()

  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link to="/dashboard/notifications">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        )}
      </Link>
        </Button>
      )
    }
    