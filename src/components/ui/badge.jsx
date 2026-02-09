import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyber-500/40",
  {
    variants: {
      variant: {
        default:
          "border-cyber-500/20 bg-cyber-500/10 text-cyber-300 shadow-sm",
        secondary:
          "border-dark-700 bg-dark-800 text-slate-300",
        destructive:
          "border-red-500/20 bg-red-500/10 text-red-400 shadow-sm",
        outline: "text-slate-300 border-dark-600",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
