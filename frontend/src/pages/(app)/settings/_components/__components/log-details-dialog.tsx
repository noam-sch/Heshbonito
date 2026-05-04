"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Log, LogLevel } from "../logs.settings"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"

type LogDetailsDialogProps = {
  log: Log | null
  onClose: () => void
}

const levelColors: Record<LogLevel, string> = {
  DEBUG: "bg-muted text-muted-foreground",
  INFO: "bg-blue-500/10 text-blue-500",
  WARN: "bg-yellow-500/10 text-yellow-500",
  ERROR: "bg-red-500/10 text-red-500",
  FATAL: "bg-purple-500/10 text-purple-500",
}

export function LogDetailsDialog({ log, onClose }: LogDetailsDialogProps) {
  const { t } = useTranslation()

  if (!log) return null

  return (
    <Dialog open={!!log} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t("settings.logs.details.title")}</span>
            <Badge className={levelColors[log.level]} variant="secondary">
              {log.level}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("settings.logs.details.timestamp")}</label>
              <p className="text-sm font-mono mt-1 text-foreground">{log.timestamp.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("settings.logs.details.category")}</label>
              <p className="text-sm font-medium mt-1 text-foreground">{log.category}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("settings.logs.details.userId")}</label>
              <p className="text-sm font-mono mt-1 text-foreground">{log.userId || t("settings.logs.details.na")}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("settings.logs.details.path")}</label>
              <p className="text-sm font-mono mt-1 text-foreground truncate">{log.path || t("settings.logs.details.na")}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("settings.logs.details.message")}</label>
            <p className="text-sm mt-1 p-3 bg-muted rounded-md text-foreground">{log.message}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("settings.logs.details.detailsJson")}</label>
            <pre className="text-xs mt-1 p-3 bg-muted rounded-md overflow-x-auto font-mono text-foreground">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("settings.logs.details.logId")}</label>
            <p className="text-xs font-mono mt-1 text-muted-foreground">{log.id}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
