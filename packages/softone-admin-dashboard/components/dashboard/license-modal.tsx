"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X, ShieldCheck, Hash, Building2, UserCheck, CalendarDays } from "lucide-react"

export interface LicenseData {
  serial: string
  vendor: string
  buyer: string
}

interface LicenseModalProps {
  open: boolean
  onClose: () => void
  license: LicenseData
}

export function LicenseModal({ open, onClose, license }: LicenseModalProps) {
  const issuedYear = new Date().getFullYear()

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }}
        />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl w-full flex flex-col"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            maxWidth: 640,
            maxHeight: "88vh",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="size-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(99,102,241,0.12)" }}
              >
                <ShieldCheck className="size-5" style={{ color: "#6366f1" }} />
              </div>
              <div>
                <Dialog.Title className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                  Software License Agreement
                </Dialog.Title>
                <Dialog.Description className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Site Survey Platform — Licensed Copy
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1.5 rounded-md transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* License details strip */}
          <div
            className="grid grid-cols-2 gap-4 px-6 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)", background: "rgba(99,102,241,0.04)" }}
          >
            <Detail icon={Hash} label="License Serial" value={license.serial} mono />
            <Detail icon={CalendarDays} label="Issued" value={`${issuedYear}`} />
            <Detail icon={Building2} label="Licensor (Vendor)" value={license.vendor} />
            <Detail icon={UserCheck} label="Licensee (Buyer)" value={license.buyer} />
          </div>

          {/* Agreement body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-[13px]" style={{ color: "var(--foreground)", lineHeight: "1.7" }}>
            <Section title="1. Grant of License">
              {license.vendor} ("Licensor") grants {license.buyer} ("Licensee") a non-exclusive,
              non-transferable, limited license to install and use the Site Survey Platform software
              (the "Software") solely for Licensee's internal business operations, subject to the
              terms and conditions set forth herein. This license is valid for a single deployment
              instance identified by the serial number <strong>{license.serial}</strong>.
            </Section>

            <Section title="2. Restrictions">
              Licensee shall not: (a) sublicense, sell, resell, transfer, assign, or otherwise
              commercially exploit or make available to any third party the Software; (b) reverse
              engineer, decompile, or disassemble the Software; (c) modify or make derivative works
              based upon the Software; (d) remove or obscure any proprietary notices, labels, or
              marks on the Software; (e) use the Software to build a competitive product or service.
            </Section>

            <Section title="3. Intellectual Property">
              The Software and all copies thereof are proprietary to the Licensor and title thereto
              remains in Licensor. All rights in the Software not specifically granted in this
              Agreement are reserved to Licensor. Licensee acknowledges that no title to the
              intellectual property in the Software is transferred to Licensee.
            </Section>

            <Section title="4. Confidentiality">
              Licensee agrees to maintain the confidentiality of the Software, its source code,
              documentation, and any related materials. Licensee shall use the same degree of care
              to protect the confidential information as it uses to protect its own confidential
              information of similar importance, but in no event less than reasonable care.
            </Section>

            <Section title="5. Warranty Disclaimer">
              THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. LICENSOR EXPRESSLY
              DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE
              IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT.
            </Section>

            <Section title="6. Limitation of Liability">
              IN NO EVENT SHALL LICENSOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              EXEMPLARY, OR CONSEQUENTIAL DAMAGES ARISING OUT OF OR IN CONNECTION WITH THIS
              AGREEMENT OR THE USE OF THE SOFTWARE, EVEN IF LICENSOR HAS BEEN ADVISED OF THE
              POSSIBILITY OF SUCH DAMAGES.
            </Section>

            <Section title="7. Term and Termination">
              This Agreement is effective until terminated. Licensor may terminate this Agreement
              immediately upon written notice if Licensee breaches any provision hereof. Upon
              termination, Licensee must destroy all copies of the Software in its possession.
              Sections 3, 4, 5, and 6 shall survive any termination of this Agreement.
            </Section>

            <Section title="8. Governing Law">
              This Agreement shall be governed by and construed in accordance with the laws of the
              Hellenic Republic. Any disputes arising under this Agreement shall be subject to the
              exclusive jurisdiction of the courts of Athens, Greece.
            </Section>

            <p className="text-[11px] pt-2" style={{ color: "var(--muted-foreground)" }}>
              By using this Software, Licensee acknowledges that it has read this Agreement,
              understands it, and agrees to be bound by its terms and conditions.
            </p>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              © {issuedYear} {license.vendor}. All rights reserved.
            </span>
            <Dialog.Close asChild>
              <button
                className="btn-sm px-4 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  height: 32,
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="size-3.5 mt-0.5 flex-shrink-0" style={{ color: "#6366f1" }} />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>
          {label}
        </p>
        <p
          className="text-[13px] font-medium truncate"
          style={{ color: "var(--foreground)", fontFamily: mono ? "monospace" : undefined }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#6366f1" }}>
        {title}
      </h3>
      <p style={{ color: "var(--muted-foreground)" }}>{children}</p>
    </div>
  )
}
