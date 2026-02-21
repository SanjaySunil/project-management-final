"use client"

import * as React from "react"
import { useTheme } from "next-themes"

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  // Optional: override the automatic theme detection
  variant?: "light" | "dark"
}

export function Logo({ variant, className, ...props }: LogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch by waiting for the component to mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a placeholder or the default logo during SSR
    return <img src="/logo-black.png" className={className} alt="Logo" {...props} />
  }

  const currentTheme = variant || resolvedTheme || theme

  const logoSrc = currentTheme === "dark" ? "/logo-white.png" : "/logo-black.png"

  return (
    <img
      src={logoSrc}
      className={className}
      alt="Logo"
      {...props}
    />
  )
}
