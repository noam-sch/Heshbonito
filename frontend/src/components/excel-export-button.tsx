import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authenticatedFetch } from "@/hooks/use-fetch"

interface ExcelExportButtonProps {
    type: "quotes" | "invoices" | "receipts"
    variant?: "default" | "outline" | "ghost"
    size?: "default" | "sm" | "lg" | "icon"
}

export function ExcelExportButton({ type, variant = "outline", size = "default" }: ExcelExportButtonProps) {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)

    const handleExport = async () => {
        setLoading(true)
        try {
            const url = `${import.meta.env.VITE_BACKEND_URL || ""}/api/excel/${type}/export`
            const res = await authenticatedFetch(url)
            if (!res.ok) throw new Error("Export failed")

            const blob = await res.blob()
            const objectUrl = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = objectUrl
            link.download = `${type}-${new Date().toISOString().split("T")[0]}.xlsx`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(objectUrl)

            toast.success(t("excel.export.success"))
        } catch {
            toast.error(t("excel.export.error"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant={variant} size={size} onClick={handleExport} disabled={loading}>
            {loading ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
                <Download className="h-4 w-4 me-2" />
            )}
            {t("excel.export.button")}
        </Button>
    )
}
