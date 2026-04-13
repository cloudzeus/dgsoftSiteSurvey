"use client"

import { FileUploadDialog } from "@/components/shared/file-upload-dialog"

type Props = {
  open: boolean
  onClose: () => void
  customerId: number
  customerName?: string | null
  onUploaded?: () => void
}

export function CustomerFileUploadDialog({ open, onClose, customerId, customerName, onUploaded }: Props) {
  return (
    <FileUploadDialog
      open={open}
      onClose={onClose}
      uploadUrl={`/api/customers/${customerId}/files`}
      title="Upload Files"
      subtitle={customerName ?? undefined}
      onUploaded={onUploaded}
    />
  )
}
