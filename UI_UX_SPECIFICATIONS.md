# UI/UX Specifications - Softone Integration Dashboard

---

## 1. 🔌 Custom Shadcn Modal (Responsive Width)

### Problem
Default Shadcn modal has fixed width. We need responsive sizing based on screen breakpoints.

### Solution: Override Modal Component

```typescript
// components/ui/responsive-modal.tsx

import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ResponsiveModalProps extends React.ComponentProps<typeof Dialog.Content> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const sizeClasses = {
  sm: 'w-full sm:max-w-sm',      // Mobile: 100%, Desktop: 384px
  md: 'w-full sm:max-w-md',      // Mobile: 100%, Desktop: 448px
  lg: 'w-full sm:max-w-lg',      // Mobile: 100%, Desktop: 512px
  xl: 'w-full sm:max-w-2xl',     // Mobile: 100%, Desktop: 672px
  full: 'w-11/12 sm:w-full'      // Mobile: 91.666%, Desktop: 100%
}

export function ResponsiveModal({
  open,
  onOpenChange,
  children,
  title,
  description,
  size = 'md',
  className,
  ...props
}: ResponsiveModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        className={cn(
          // Base styles
          "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
          "border bg-background shadow-lg duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          
          // Responsive width
          sizeClasses[size],
          
          // Max height (mobile: 90vh, desktop: 85vh)
          "max-h-[90vh] sm:max-h-[85vh]",
          
          // Padding (mobile: p-4, desktop: p-6)
          "p-4 sm:p-6",
          
          // Border radius (mobile: rounded-lg, desktop: rounded-xl)
          "rounded-lg sm:rounded-xl",
          
          // Z-index
          "z-50",
          
          // Custom className
          className
        )}
        {...props}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex flex-col space-y-1.5 border-b pb-4 mb-4">
            {title && (
              <h2 className="text-sm sm:text-base font-semibold leading-none tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] sm:max-h-[calc(85vh-120px)]">
          {children}
        </div>

        {/* Close button */}
        <Dialog.Close
          className={cn(
            "absolute right-3 top-3 sm:right-4 sm:top-4",
            "rounded-md opacity-70 hover:opacity-100",
            "transition-opacity disabled:pointer-events-none",
            "text-gray-400 hover:text-gray-600"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export const modalTrigger = Dialog.Trigger
export const modalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t", className)}
    {...props}
  />
)
```

### Usage

```typescript
// In your page component

import { ResponsiveModal, modalTrigger, modalFooter } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'

export function SyncConfigsPage() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <ResponsiveModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Add New Sync Configuration"
        description="Select objects, tables, and fields to sync"
        size="lg" // Mobile: full width, Desktop: 512px
      >
        <WizardForm onComplete={() => setIsOpen(false)} />
      </ResponsiveModal>
    </div>
  )
}
```

### Responsive Behavior

```
Mobile (< 640px):
┌─────────────────┐
│  Title & Close  │
├─────────────────┤
│   Form Content  │
│   (100% width)  │
├─────────────────┤
│  Buttons Stack  │
│  (vertical)     │
└─────────────────┘

Desktop (≥ 640px):
┌────────────────────────────────┐
│  Title                    Close │
├────────────────────────────────┤
│   Form Content                 │
│   (max-width: 512px for lg)    │
├────────────────────────────────┤
│                  [Cancel] [Save]│
└────────────────────────────────┘
```

---

## 2. 🧙 Setup Wizard Flow

### Wizard Architecture

```typescript
// hooks/useSetupWizard.ts

interface WizardStep {
  id: string
  title: string
  description: string
  component: React.ComponentType<WizardStepProps>
  validation: (data: any) => boolean
  error?: string
}

interface WizardStepProps {
  data: WizardFormData
  onUpdate: (data: Partial<WizardFormData>) => void
  onNext: () => void
  onPrev: () => void
  isLoading?: boolean
  error?: string
}

interface WizardFormData {
  // Step 1: Object Selection
  selectedObject?: {
    name: string
    description: string
    tableCount: number
  }

  // Step 2: Table Selection
  selectedTables?: Array<{
    name: string
    description: string
    fieldCount: number
  }>

  // Step 3: Field Selection
  fieldMappings?: Array<{
    tableName: string
    fields: Array<{
      name: string
      type: string
      selected: boolean
      primaryKey?: boolean
    }>
  }>

  // Step 4: Sync Configuration
  syncConfig?: {
    direction: 'READ' | 'WRITE' | 'BIDIRECTIONAL'
    cronSchedule: string
    batchSize: number
    conflictStrategy: 'SOFTONE_WINS' | 'LOCAL_WINS' | 'MANUAL_REVIEW'
  }

  // Step 5: Review & Create
  syncName?: string
  syncDescription?: string
}

export function useSetupWizard(onComplete: (config: SyncConfig) => void) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<WizardFormData>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const steps: WizardStep[] = [
    {
      id: 'select-object',
      title: 'Select Softone Object',
      description: 'Choose which object to sync (Customers, Invoices, etc.)',
      component: SelectObjectStep,
      validation: (data) => !!data.selectedObject
    },
    {
      id: 'select-tables',
      title: 'Select Tables',
      description: 'Choose tables from the object',
      component: SelectTablesStep,
      validation: (data) => data.selectedTables && data.selectedTables.length > 0
    },
    {
      id: 'select-fields',
      title: 'Select Fields',
      description: 'Choose fields from each table',
      component: SelectFieldsStep,
      validation: (data) => data.fieldMappings && data.fieldMappings.length > 0
    },
    {
      id: 'sync-config',
      title: 'Configure Sync',
      description: 'Set schedule, direction, and conflict resolution',
      component: ConfigureSyncStep,
      validation: (data) => !!data.syncConfig
    },
    {
      id: 'review',
      title: 'Review & Create',
      description: 'Review configuration and create sync',
      component: ReviewStep,
      validation: (data) => !!data.syncName
    }
  ]

  const handleNext = () => {
    const step = steps[currentStep]
    if (step.validation(formData)) {
      setCurrentStep(Math.min(currentStep + 1, steps.length - 1))
    } else {
      setErrors({ [step.id]: `Please complete ${step.title}` })
    }
  }

  const handlePrev = () => {
    setCurrentStep(Math.max(currentStep - 1, 0))
  }

  const handleUpdate = (newData: Partial<WizardFormData>) => {
    setFormData({ ...formData, ...newData })
  }

  return {
    currentStep,
    steps,
    formData,
    errors,
    handleNext,
    handlePrev,
    handleUpdate,
    isLastStep: currentStep === steps.length - 1,
    progress: ((currentStep + 1) / steps.length) * 100
  }
}
```

### Wizard UI Component

```typescript
// components/setup-wizard/index.tsx

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const {
    currentStep,
    steps,
    formData,
    errors,
    handleNext,
    handlePrev,
    handleUpdate,
    isLastStep,
    progress
  } = useSetupWizard(onComplete)

  const CurrentStepComponent = steps[currentStep].component
  const step = steps[currentStep]

  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">
            Step {currentStep + 1} of {steps.length}
          </h3>
          <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step Title & Description */}
      <div className="mb-6">
        <h4 className="text-base sm:text-lg font-semibold mb-1">
          {step.title}
        </h4>
        <p className="text-xs sm:text-sm text-gray-600">
          {step.description}
        </p>
      </div>

      {/* Step Content */}
      <div className="mb-6 min-h-[300px]">
        <CurrentStepComponent
          data={formData}
          onUpdate={handleUpdate}
          onNext={handleNext}
          onPrev={handlePrev}
          error={errors[step.id]}
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-2 justify-between">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="px-3 py-2 text-xs sm:text-sm rounded border disabled:opacity-50"
        >
          Back
        </button>

        <button
          onClick={handleNext}
          className="px-4 py-2 text-xs sm:text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {isLastStep ? 'Create Sync' : 'Next'}
        </button>
      </div>

      {/* Step Indicators */}
      <div className="mt-6 flex gap-2 justify-center">
        {steps.map((s, idx) => (
          <div
            key={s.id}
            className={cn(
              "h-2 rounded-full transition-all",
              idx <= currentStep ? "bg-blue-500 w-3" : "bg-gray-300 w-2"
            )}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## 3. 🃏 Sync Config Cards (Dashboard View)

### Card Component

```typescript
// components/sync-config/sync-card.tsx

interface SyncCardProps {
  config: SyncConfig
  onEdit: (config: SyncConfig) => void
  onDelete: (configId: string) => void
  onToggle: (configId: string, enabled: boolean) => void
}

export function SyncConfigCard({
  config,
  onEdit,
  onDelete,
  onToggle
}: SyncCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const lastSync = config.lastSyncedAt ? new Date(config.lastSyncedAt) : null
  const isSyncing = config.status === 'IN_PROGRESS'

  return (
    <div className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Card Header */}
      <div className="p-3 sm:p-4 border-b bg-gradient-to-r from-blue-50 to-transparent">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
              {config.objectName} → {config.tableName}
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              {config.fieldMappings.length} fields configured
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <div
              className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                config.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              {config.isActive ? "Active" : "Inactive"}
            </div>

            {isSyncing && (
              <div className="animate-spin">
                <Loader2 size={16} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3 sm:p-4 space-y-3">
        {/* Sync Direction */}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-600">Sync Direction:</span>
          <span className="font-medium">
            {config.syncDirection === 'READ' && '← Read Only'}
            {config.syncDirection === 'WRITE' && 'Write Only →'}
            {config.syncDirection === 'BIDIRECTIONAL' && '↔ Bi-directional'}
          </span>
        </div>

        {/* Schedule */}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-600">Schedule:</span>
          <span className="font-medium font-mono">{config.syncSchedule}</span>
        </div>

        {/* Last Sync */}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-600">Last Sync:</span>
          <span className="font-medium">
            {lastSync ? formatDistanceToNow(lastSync, { addSuffix: true }) : 'Never'}
          </span>
        </div>

        {/* Sync Stats (if expanded) */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-medium text-green-600">
                {config.successRate}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Records Synced:</span>
              <span className="font-medium">{config.totalRecordsSynced}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Error:</span>
              <span className="text-red-600 max-w-xs text-right truncate">
                {config.lastError || 'None'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-3 sm:px-4 py-3 border-t bg-gray-50 flex gap-2 justify-end">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2 sm:px-3 py-1 text-xs border rounded hover:bg-gray-100"
        >
          {isExpanded ? 'Hide' : 'Details'}
        </button>

        <button
          onClick={() => onEdit(config)}
          className="px-2 sm:px-3 py-1 text-xs border rounded hover:bg-gray-100"
        >
          Edit
        </button>

        <button
          onClick={() => onToggle(config.id, !config.isActive)}
          className="px-2 sm:px-3 py-1 text-xs border rounded hover:bg-gray-100"
        >
          {config.isActive ? 'Disable' : 'Enable'}
        </button>

        <button
          onClick={() => onDelete(config.id)}
          className="px-2 sm:px-3 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
```

### Dashboard Grid

```typescript
// app/(dashboard)/sync-configs/page.tsx

export default function SyncConfigsPage() {
  const [configs, setConfigs] = useState<SyncConfig[]>([])
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold">Sync Configurations</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Manage Softone object syncing
          </p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + Add New
        </button>
      </div>

      {/* Wizard Modal */}
      <ResponsiveModal
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        title="Setup New Sync"
        description="Configure a new Softone object sync"
        size="lg"
      >
        <SetupWizard onComplete={() => setIsWizardOpen(false)} />
      </ResponsiveModal>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map(config => (
          <SyncConfigCard
            key={config.id}
            config={config}
            onEdit={(cfg) => {
              // Open edit wizard
            }}
            onDelete={(id) => {
              // Delete config
            }}
            onToggle={(id, enabled) => {
              // Toggle active status
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## 4. 📊 Sync Details & Logs View

### Detailed View Modal

```typescript
// components/sync-config/sync-details-modal.tsx

interface SyncDetailsModalProps {
  config: SyncConfig
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncDetailsModal({
  config,
  open,
  onOpenChange
}: SyncDetailsModalProps) {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview')

  useEffect(() => {
    if (open) {
      loadSyncLogs(config.id)
    }
  }, [open, config.id])

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${config.objectName} → ${config.tableName}`}
      description="Sync configuration and execution logs"
      size="xl"
    >
      {/* Tabs */}
      <div className="flex gap-2 border-b mb-4">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "px-3 py-2 text-xs sm:text-sm border-b-2 transition",
            activeTab === 'overview'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            "px-3 py-2 text-xs sm:text-sm border-b-2 transition",
            activeTab === 'logs'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600"
          )}
        >
          Sync Logs
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Configuration Summary */}
          <div className="bg-gray-50 p-3 sm:p-4 rounded">
            <h4 className="text-xs sm:text-sm font-semibold mb-3">Configuration</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Object:</span>
                <span className="font-medium">{config.objectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Table:</span>
                <span className="font-medium">{config.tableName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Direction:</span>
                <span className="font-medium">{config.syncDirection}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Schedule:</span>
                <span className="font-medium font-mono">{config.syncSchedule}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Conflict Strategy:</span>
                <span className="font-medium">{config.conflictStrategy}</span>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatCard
              label="Success Rate"
              value={`${config.successRate}%`}
              variant="success"
            />
            <StatCard
              label="Total Synced"
              value={config.totalRecordsSynced}
              variant="info"
            />
            <StatCard
              label="Failed"
              value={config.failedRecords}
              variant="danger"
            />
            <StatCard
              label="Pending"
              value={config.pendingRecords}
              variant="warning"
            />
          </div>

          {/* Last Sync Info */}
          <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded">
            <h4 className="text-xs sm:text-sm font-semibold mb-2">Last Sync</h4>
            <div className="space-y-1 text-xs">
              <div>
                <span className="text-gray-600">Time:</span>{' '}
                <span className="font-medium">
                  {config.lastSyncedAt
                    ? format(config.lastSyncedAt, 'PPpp')
                    : 'Never'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>{' '}
                <span
                  className={cn(
                    "font-medium",
                    config.lastSyncStatus === 'SUCCESS'
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {config.lastSyncStatus}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Duration:</span>{' '}
                <span className="font-medium">{config.lastSyncDuration}ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <SyncLogsTable logs={logs} configId={config.id} />
      )}
    </ResponsiveModal>
  )
}

function StatCard({
  label,
  value,
  variant
}: {
  label: string
  value: string | number
  variant: 'success' | 'danger' | 'warning' | 'info'
}) {
  const colorClasses = {
    success: 'bg-green-50 text-green-700',
    danger: 'bg-red-50 text-red-700',
    warning: 'bg-yellow-50 text-yellow-700',
    info: 'bg-blue-50 text-blue-700'
  }

  return (
    <div className={cn('p-2 sm:p-3 rounded', colorClasses[variant])}>
      <div className="text-xs text-opacity-70">{label}</div>
      <div className="text-lg sm:text-2xl font-bold">{value}</div>
    </div>
  )
}
```

### Sync Logs Table

```typescript
// components/sync-config/sync-logs-table.tsx

interface SyncLog {
  id: string
  timestamp: Date
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  recordsProcessed: number
  recordsSuccessful: number
  recordsFailed: number
  duration: number
  errorMessage?: string
  jobId: string
}

export function SyncLogsTable({
  logs,
  configId
}: {
  logs: SyncLog[]
  configId: string
}) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div
          key={log.id}
          className="border rounded overflow-hidden"
        >
          {/* Log Row */}
          <button
            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
            className="w-full px-3 sm:px-4 py-2 flex items-center justify-between hover:bg-gray-50 text-xs sm:text-sm"
          >
            <div className="flex items-center gap-2 flex-1">
              <ChevronDown
                size={16}
                className={cn(
                  "transition",
                  expandedLog === log.id && "rotate-180"
                )}
              />

              {/* Status Badge */}
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  log.status === 'SUCCESS' && 'bg-green-500',
                  log.status === 'FAILED' && 'bg-red-500',
                  log.status === 'PARTIAL' && 'bg-yellow-500'
                )}
              />

              {/* Timestamp */}
              <span className="font-medium">
                {format(log.timestamp, 'MMM d, HH:mm:ss')}
              </span>

              {/* Stats */}
              <span className="text-gray-600">
                {log.recordsSuccessful}/{log.recordsProcessed} records
              </span>

              {/* Duration */}
              <span className="text-gray-500 ml-auto">
                {log.duration}ms
              </span>
            </div>
          </button>

          {/* Expanded Details */}
          {expandedLog === log.id && (
            <div className="px-3 sm:px-4 py-2 border-t bg-gray-50 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Job ID:</span>
                <span className="font-mono text-gray-700">{log.jobId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processed:</span>
                <span>{log.recordsProcessed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Successful:</span>
                <span className="text-green-600">{log.recordsSuccessful}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed:</span>
                <span className="text-red-600">{log.recordsFailed}</span>
              </div>

              {log.errorMessage && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                  <div className="text-gray-600 mb-1">Error:</div>
                  <div className="text-red-700 font-mono text-xs">
                    {log.errorMessage}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {logs.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-xs">
          No sync logs yet
        </div>
      )}
    </div>
  )
}
```

---

## 5. 📚 Softone Help Tables Integration

### Help Tables Support

Softone provides reference/lookup tables. Integrate them:

```typescript
// types/softone-help-tables.ts

/**
 * Softone Help Tables (Reference Data)
 * Used for dropdowns, validations, and lookups
 */

export interface SoftoneHelpTable {
  name: string
  displayName: string
  fields: Array<{
    name: string
    type: 'character' | 'numeric' | 'datetime' | 'boolean'
    size?: number
  }>
  records: Array<Record<string, any>>
  lastUpdated: Date
  cacheExpiry: Date
}

// Common Softone help tables
export const SOFTONE_HELP_TABLES = {
  SALESMAN: 'Sales Representatives',
  CUSTOMERS_CATEGORIES: 'Customer Categories',
  PAYMENT_TERMS: 'Payment Terms',
  WAREHOUSES: 'Warehouses',
  PRODUCT_CATEGORIES: 'Product Categories',
  CURRENCIES: 'Currencies',
  TAX_TYPES: 'Tax Types',
  DOCUMENT_TYPES: 'Document Types',
  ACCOUNT_CODES: 'Account Codes'
} as const
```

### Fetch Help Tables

```typescript
// lib/softone-api-extended.ts

export class SoftoneAPIClient {
  // ... existing methods ...

  /**
   * Fetch Softone help table
   * Caches result for 24 hours
   */
  async getHelpTable(
    tableName: keyof typeof SOFTONE_HELP_TABLES
  ): Promise<SoftoneHelpTable> {
    // Check cache
    const cached = await this.checkCache(tableName);
    if (cached && cached.cacheExpiry > new Date()) {
      return cached;
    }

    // Fetch from Softone
    const response = await fetch(
      `${this.endpoint}/help-tables/${tableName}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        }
      }
    );

    const data = await response.json();

    // Cache result
    await this.cacheHelpTable(tableName, {
      name: tableName,
      displayName: SOFTONE_HELP_TABLES[tableName],
      fields: data.fields,
      records: data.records,
      lastUpdated: new Date(),
      cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    return data;
  }

  /**
   * Get all available help tables
   */
  async listHelpTables(): Promise<Array<{name: string, displayName: string}>> {
    return Object.entries(SOFTONE_HELP_TABLES).map(([name, displayName]) => ({
      name: name as any,
      displayName
    }));
  }
}
```

### Use Help Tables in Field Selection

```typescript
// components/setup-wizard/select-fields-step.tsx

interface SelectFieldsStepProps extends WizardStepProps {
  data: WizardFormData
}

export function SelectFieldsStep({
  data,
  onUpdate
}: SelectFieldsStepProps) {
  const [helpTablesLoaded, setHelpTablesLoaded] = useState<Record<string, any>>({})

  useEffect(() => {
    loadAvailableHelpTables();
  }, [])

  const loadAvailableHelpTables = async () => {
    const tables = await softoneClient.listHelpTables();
    for (const table of tables) {
      const data = await softoneClient.getHelpTable(table.name as any);
      setHelpTablesLoaded(prev => ({
        ...prev,
        [table.name]: data.records
      }))
    }
  }

  return (
    <div className="space-y-4">
      {data.fieldMappings?.map(mapping => (
        <div key={mapping.tableName} className="border p-3 rounded">
          <h4 className="text-sm font-semibold mb-3">
            {mapping.tableName}
          </h4>

          <div className="space-y-2">
            {mapping.fields.map(field => (
              <label key={field.name} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={field.selected}
                  onChange={(e) => {
                    // Update field selection
                  }}
                  className="rounded"
                />

                <span className="flex-1">
                  {field.name}
                  <span className="text-gray-500 text-xs ml-1">
                    ({field.type})
                  </span>
                </span>

                {/* Link to Help Table if available */}
                {SOFTONE_HELP_TABLES[field.name as any] && (
                  <HelpTableLink
                    tableName={field.name}
                    data={helpTablesLoaded[field.name]}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function HelpTableLink({ tableName, data }: { tableName: string; data: any[] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-blue-500 hover:text-blue-700 text-xs"
      >
        View Table
      </button>

      <ResponsiveModal
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`Help Table: ${tableName}`}
        size="lg"
      >
        <div className="space-y-2">
          {data?.map((record: any, idx: number) => (
            <div key={idx} className="text-xs p-2 border rounded">
              {JSON.stringify(record)}
            </div>
          ))}
        </div>
      </ResponsiveModal>
    </>
  )
}
```

---

## 6. 📱 Responsive Layout Summary

### Mobile-First Approach

```
Mobile (<640px):
- Full-width modals
- Single column cards
- Stacked button layout
- Smaller text
- Touch-friendly spacing

Tablet (640px-1024px):
- Medium-width modals
- 2-column cards
- Horizontal buttons
- Regular text
- Adequate spacing

Desktop (>1024px):
- Max-width 512-800px modals
- 3-column cards
- Horizontal buttons
- Regular text
- Generous spacing
```

### Tailwind Breakpoints Used

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

---

## 7. ✅ Implementation Checklist

### Responsive Modal
- [ ] Custom ResponsiveModal component created
- [ ] Size options: sm, md, lg, xl, full
- [ ] Mobile-optimized padding & text
- [ ] Smooth animations
- [ ] Close button accessible
- [ ] Scrollable content

### Setup Wizard
- [ ] 5-step wizard flow
- [ ] Progress bar visualization
- [ ] Step validation
- [ ] Form data persistence
- [ ] Previous/Next navigation
- [ ] Step indicators

### Sync Cards
- [ ] Card layout with header/body/footer
- [ ] Status badge (Active/Inactive)
- [ ] Sync direction indicator
- [ ] Expandable details
- [ ] Quick action buttons
- [ ] Responsive grid

### Details Modal
- [ ] Overview tab (configuration summary)
- [ ] Logs tab (sync history)
- [ ] Statistics cards
- [ ] Last sync info
- [ ] Log expandable rows
- [ ] Error display

### Help Tables
- [ ] Fetch from Softone API
- [ ] Cache for 24 hours
- [ ] Display in modals
- [ ] Link from fields
- [ ] Searchable/filterable

---

## 8. 🎯 Quick Implementation Order

1. **ResponsiveModal** (foundation)
2. **SetupWizard** (core flow)
3. **SyncCard** (display)
4. **SyncDetailsModal** (details)
5. **Help Tables** (enrichment)
6. **Dashboard integration** (everything together)

---

All UI/UX specifications documented and ready to implement!

