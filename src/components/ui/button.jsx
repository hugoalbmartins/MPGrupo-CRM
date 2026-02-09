import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-500/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-cyber-500 to-cyber-600 text-white shadow-lg shadow-cyber-500/20 hover:shadow-cyber-500/30 hover:from-cyber-400 hover:to-cyber-500 active:scale-[0.98]",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30",
        outline:
          "border border-dark-700 bg-transparent text-slate-300 hover:bg-white/5 hover:border-cyber-500/30 hover:text-white",
        secondary:
          "bg-dark-800 text-slate-300 border border-dark-700 hover:bg-dark-700 hover:text-white hover:border-cyber-500/20",
        ghost: "text-slate-400 hover:bg-white/5 hover:text-white",
        link: "text-cyber-400 underline-offset-4 hover:underline hover:text-cyber-300",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
