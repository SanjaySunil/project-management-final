import * as React from "react"

interface LiveTimeProps {
  timezone?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  baseTime?: Date | null
}

const STATE_TIMEZONES: Record<string, string> = {
  // US States
  "alabama": "America/Chicago",
  "alaska": "America/Anchorage",
  "arizona": "America/Phoenix",
  "arkansas": "America/Chicago",
  "california": "America/Los_Angeles",
  "colorado": "America/Denver",
  "connecticut": "America/New_York",
  "delaware": "America/New_York",
  "dc": "America/New_York",
  "district of columbia": "America/New_York",
  "florida": "America/New_York",
  "georgia": "America/New_York",
  "hawaii": "Pacific/Honolulu",
  "idaho": "America/Boise",
  "illinois": "America/Chicago",
  "indiana": "America/Indiana/Indianapolis",
  "iowa": "America/Chicago",
  "kansas": "America/Chicago",
  "kentucky": "America/New_York",
  "louisiana": "America/Chicago",
  "maine": "America/New_York",
  "maryland": "America/New_York",
  "massachusetts": "America/New_York",
  "michigan": "America/Detroit",
  "minnesota": "America/Chicago",
  "mississippi": "America/Chicago",
  "missouri": "America/Chicago",
  "montana": "America/Denver",
  "nebraska": "America/Chicago",
  "nevada": "America/Los_Angeles",
  "new hampshire": "America/New_York",
  "new jersey": "America/New_York",
  "new mexico": "America/Denver",
  "new york": "America/New_York",
  "north carolina": "America/New_York",
  "north dakota": "America/Chicago",
  "ohio": "America/New_York",
  "oklahoma": "America/Chicago",
  "oregon": "America/Los_Angeles",
  "pennsylvania": "America/New_York",
  "rhode island": "America/New_York",
  "south carolina": "America/New_York",
  "south dakota": "America/Chicago",
  "tennessee": "America/Chicago",
  "texas": "America/Chicago",
  "utah": "America/Denver",
  "vermont": "America/New_York",
  "virginia": "America/New_York",
  "washington": "America/Los_Angeles",
  "west virginia": "America/New_York",
  "wisconsin": "America/Chicago",
  "wyoming": "America/Denver",
}

export function LiveTime({ timezone, country, state, city, baseTime }: LiveTimeProps) {
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

    // If still no timezone but state is provided (and it's USA), use state mapping
    if (!resolvedTimezone && state && (country?.toLowerCase() === 'united states' || country?.toLowerCase() === 'usa' || country?.toLowerCase() === 'us')) {
      resolvedTimezone = STATE_TIMEZONES[state.toLowerCase()] || null
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
  }, [timezone, city, state, country, baseTime])

  return <span className="font-mono">{time}</span>
}