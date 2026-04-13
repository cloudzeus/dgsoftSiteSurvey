"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import gsap from "gsap"

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Single skeleton block — GSAP shimmer sliding left → right on repeat.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shimmerRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!shimmerRef.current || !containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        shimmerRef.current,
        { xPercent: -100 },
        { xPercent: 100, duration: 1.4, ease: "none", repeat: -1 },
      )
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn("skeleton-base", className)}
      style={style}
    >
      <div ref={shimmerRef} className="skeleton-shimmer" />
    </div>
  )
}

/** 4-column stat cards skeleton — mirrors StatsCards layout */
export function SkeletonStatsCards() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-8 rounded-lg" style={{ borderRadius: 8 }} />
          </div>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-2.5 w-28" />
        </div>
      ))}
    </div>
  )
}

/** Table rows skeleton */
export function SkeletonTableRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} style={{ borderBottom: "1px solid var(--border)" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-4">
              <Skeleton
                className="h-3.5"
                style={{ width: c === 0 ? "70%" : c === cols - 1 ? "40%" : "55%" }}
              />
              {c === 0 && (
                <Skeleton className="h-2.5 mt-1.5" style={{ width: "45%" }} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Generic text lines skeleton */
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: i === lines - 1 && lines > 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  )
}
