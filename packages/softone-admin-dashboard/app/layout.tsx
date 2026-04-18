import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { default: "Softone Sync", template: "%s · Softone Sync" },
  description: "Enterprise Softone ERP integration dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
