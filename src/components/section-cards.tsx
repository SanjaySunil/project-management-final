import { IconTrendingDown, IconTrendingUp, IconUsers, IconBriefcase, IconCurrencyDollar, IconListCheck } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface SectionCardsProps {
  data?: {
    revenue: number
    projects: number
    clients: number
    tasks: number
    trends: {
      revenue: number
      projects: number
      clients: number
      tasks: number
    }
  }
  loading?: boolean
}

export function SectionCards({ data, loading }: SectionCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value)
  }

  const renderTrend = (trend: number) => {
    const isPositive = trend >= 0
    return (
      <Badge variant="outline" className={isPositive ? "text-emerald-500" : "text-rose-500"}>
        {isPositive ? <IconTrendingUp className="mr-1 size-3" /> : <IconTrendingDown className="mr-1 size-3" />}
        {Math.abs(trend)}%
      </Badge>
    )
  }

  const cards = [
    {
      title: "Total Revenue",
      value: data ? formatCurrency(data.revenue) : "$0.00",
      description: "From active & complete proposals",
      trend: data?.trends.revenue || 0,
      icon: <IconCurrencyDollar className="size-4 text-muted-foreground" />,
      footer: "Updated just now"
    },
    {
      title: "Active Projects",
      value: data ? data.projects.toString() : "0",
      description: "Total projects in system",
      trend: data?.trends.projects || 0,
      icon: <IconBriefcase className="size-4 text-muted-foreground" />,
      footer: "Ongoing developments"
    },
    {
      title: "Total Clients",
      value: data ? data.clients.toString() : "0",
      description: "Partnered companies",
      trend: data?.trends.clients || 0,
      icon: <IconUsers className="size-4 text-muted-foreground" />,
      footer: "Customer base growth"
    },
    {
      title: "Pending Tasks",
      value: data ? data.tasks.toString() : "0",
      description: "Tasks awaiting completion",
      trend: data?.trends.tasks || 0,
      icon: <IconListCheck className="size-4 text-muted-foreground" />,
      footer: "Immediate action required"
    }
  ]

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @md/main:grid-cols-2 @4xl/main:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index} className="@container/card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">{card.title}</CardDescription>
              {card.icon}
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {card.value}
              </CardTitle>
            )}
            <CardAction>
              {loading ? <Skeleton className="h-5 w-16" /> : renderTrend(card.trend)}
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
            <div className="line-clamp-1 font-medium text-foreground">
              {card.description}
            </div>
            <div>{card.footer}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}