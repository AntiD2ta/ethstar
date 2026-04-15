import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        // Sonner's default description color is the same foreground at ~0.5
        // alpha, which renders as unreadable grey on a dark popover surface
        // (photo 2026-04-15: "Your GitHub token was discarded…" barely
        // visible). Bumping the description to the full popover-foreground
        // at 85% gives roughly 9:1 against var(--popover) — clears WCAG AAA
        // for normal text and matches the title weight hierarchy without
        // making the description compete with the title.
        classNames: {
          description: "!text-popover-foreground/85",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
