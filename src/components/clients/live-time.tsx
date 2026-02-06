import * as React from "react"

interface LiveTimeProps {
  timezone?: string | null
  country?: string | null
  city?: string | null
  baseTime?: Date | null
}

export function LiveTime({ timezone, country, city, baseTime }: LiveTimeProps) {
  const [time, setTime] = React.useState<string>("")

  React.useEffect(() => {
    let resolvedTimezone = timezone

    // If no timezone but city is provided, try to find a matching timezone
    if (!resolvedTimezone && city) {
      const cityNormalized = city.toLowerCase().replace(/\s+/g, '_')
      const timezones = Intl.supportedValuesOf('timeZone')
      resolvedTimezone = timezones.find(tz => 
        tz.toLowerCase().endsWith(`/${cityNormalized}`) || 
        tz.toLowerCase() === cityNormalized
      ) || null
    }

    if (!resolvedTimezone) {
      setTime("-")
      return
    }

    const updateTime = () => {
      try {
        const now = baseTime || new Date()
        const formatter = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: resolvedTimezone!,
        })
        setTime(formatter.format(now))
      } catch (e) {
        setTime("-")
      }
    }

    updateTime()
    
    // Only set interval if we are showing live time
    if (!baseTime) {
      const interval = setInterval(updateTime, 30000)
      return () => clearInterval(interval)
    }
  }, [timezone, city, country, baseTime])

  return <span className="font-mono">{time}</span>
}