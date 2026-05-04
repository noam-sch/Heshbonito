"use client"

import { Search, RefreshCw, Calendar } from "lucide-react"
import type { LogLevel } from "../logs.settings"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "react-i18next"

type LogsFiltersProps = {
  levelFilter: LogLevel[]
  setLevelFilter: (levels: LogLevel[]) => void
  categoryFilter: string[]
  setCategoryFilter: (categories: string[]) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  dateRange: { from: Date | null; to: Date | null }
  setDateRange: (range: { from: Date | null; to: Date | null }) => void
  categories: string[]
  totalLogs: number
  filteredCount: number
  onRefresh: () => void
}

const LOG_LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]

const levelColors: Record<LogLevel, string> = {
  DEBUG: "bg-muted text-muted-foreground",
  INFO: "bg-blue-500/10 text-blue-500",
  WARN: "bg-yellow-500/10 text-yellow-500",
  ERROR: "bg-red-500/10 text-red-500",
  FATAL: "bg-purple-500/10 text-purple-500",
}

export function LogsFilters({
  levelFilter,
  setLevelFilter,
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  dateRange,
  setDateRange,
  categories,
  totalLogs,
  filteredCount,
  onRefresh,
}: LogsFiltersProps) {
  const { t } = useTranslation()

  function toggleLevel(level: LogLevel) {
    if (levelFilter.includes(level)) {
      setLevelFilter(levelFilter.filter((l) => l !== level))
    } else {
      setLevelFilter([...levelFilter, level])
    }
  }

  function toggleCategory(category: string) {
    if (categoryFilter.includes(category)) {
      setCategoryFilter(categoryFilter.filter((c) => c !== category))
    } else {
      setCategoryFilter([...categoryFilter, category])
    }
  }

  function clearFilters() {
    setLevelFilter([])
    setCategoryFilter([])
    setSearchQuery("")
    setDateRange({ from: null, to: null })
  }

  const hasActiveFilters =
    levelFilter.length > 0 || categoryFilter.length > 0 || searchQuery || dateRange.from || dateRange.to

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("settings.logs.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Calendar className="h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                  </>
                ) : (
                  dateRange.from.toLocaleDateString()
                )
              ) : (
                t("settings.logs.dateRange")
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-2">
              <div>
                <label className="text-sm font-medium">{t("settings.logs.dateFrom")}</label>
                <CalendarComponent
                  mode="single"
                  selected={dateRange.from || undefined}
                  onSelect={(date) => setDateRange({ ...dateRange, from: date || null })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("settings.logs.dateTo")}</label>
                <CalendarComponent
                  mode="single"
                  selected={dateRange.to || undefined}
                  onSelect={(date) => setDateRange({ ...dateRange, to: date || null })}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button onClick={onRefresh} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>

        {hasActiveFilters && (
          <Button onClick={clearFilters} variant="ghost">
            {t("settings.logs.clearFilters")}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("settings.logs.level")}</span>
          <div className="flex gap-1.5">
            {LOG_LEVELS.map((level) => (
              <Badge
                key={level}
                variant={levelFilter.includes(level) ? "default" : "outline"}
                className={`cursor-pointer ${levelFilter.includes(level) ? levelColors[level] : ""}`}
                onClick={() => toggleLevel(level)}
              >
                {level}
              </Badge>
            ))}
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t("settings.logs.category")}</span>
            <Select
              value={categoryFilter[0] || "all"}
              onValueChange={(value) => {
                if (value === "all") {
                  setCategoryFilter([])
                } else {
                  toggleCategory(value)
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("settings.logs.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("settings.logs.allCategories")}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="ms-auto text-sm text-muted-foreground">
          {t("settings.logs.showing", { filtered: filteredCount.toLocaleString(), total: totalLogs.toLocaleString() })}
        </div>
      </div>
    </div>
  )
}
