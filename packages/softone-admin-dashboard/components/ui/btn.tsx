"use client"

import { forwardRef, ButtonHTMLAttributes } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type BtnVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "destructive"
  | "success"
  | "warning"

export type BtnSize = "sm" | "md" | "lg" | "xl" | "icon-sm" | "icon-md"

const sizeClass: Record<BtnSize, string> = {
  sm:       "btn-sm",
  md:       "btn-md",
  lg:       "btn-lg",
  xl:       "btn-xl",
  "icon-sm": "btn-icon-sm",
  "icon-md": "btn-icon-md",
}

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
  fullWidth?: boolean
}

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "btn",
        `btn-${variant}`,
        sizeClass[size],
        fullWidth && "btn-full",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : children}
    </button>
  ),
)
Btn.displayName = "Btn"
