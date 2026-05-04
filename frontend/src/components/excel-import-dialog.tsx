import { AlertCircle, CheckCircle, Download, Loader2, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { authenticatedFetch } from "@/hooks/use-fetch"

interface ImportError {
    row: number
    field: string
    message: string
}

interface ParsedRow {
    docKey: string
    clientName: string
    [key: string]: any
}

interface ValidationResult {
    valid: ParsedRow[]
    errors: ImportError[]
}

interface ExcelImportDialogProps {
    type: "quotes" | "invoices"
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

type Step = "upload" | "preview" | "importing"

export function ExcelImportDialog({ type, open, onOpenChange, onSuccess }: ExcelImportDialogProps) {
    const { t } = useTranslation()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [step, setStep] = useState<Step>("upload")
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [dragOver, setDragOver] = useState(false)

    const reset = () => {
        setStep("upload")
        setValidationResult(null)
        setLoading(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleClose = (open: boolean) => {
        if (!open) reset()
        onOpenChange(open)
    }

    const handleFile = async (file: File) => {
        if (!file.name.endsWith(".xlsx")) {
            toast.error(t("excel.import.invalidFile"))
            return
        }

        setLoading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)

            const url = `${import.meta.env.VITE_BACKEND_URL || ""}/api/excel/${type}/validate`
            const res = await authenticatedFetch(url, {
                method: "POST",
                headers: {},  // Let browser set multipart boundary
                body: formData,
            })

            if (!res.ok) throw new Error("Validation failed")
            const result: ValidationResult = await res.json()
            setValidationResult(result)
            setStep("preview")
        } catch {
            toast.error(t("excel.import.error"))
        } finally {
            setLoading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
    }

    const handleImport = async () => {
        if (!validationResult || validationResult.valid.length === 0) return

        setStep("importing")
        setLoading(true)
        try {
            const url = `${import.meta.env.VITE_BACKEND_URL || ""}/api/excel/${type}/import`
            const res = await authenticatedFetch(url, {
                method: "POST",
                body: JSON.stringify({ rows: validationResult.valid }),
            })

            if (!res.ok) throw new Error("Import failed")
            const result = await res.json()
            toast.success(t("excel.import.success", { count: result.created }))
            handleClose(false)
            onSuccess?.()
        } catch {
            toast.error(t("excel.import.error"))
            setStep("preview")
        } finally {
            setLoading(false)
        }
    }

    const handleTemplateDownload = async () => {
        try {
            const url = `${import.meta.env.VITE_BACKEND_URL || ""}/api/excel/${type}/template`
            const res = await authenticatedFetch(url)
            if (!res.ok) throw new Error()
            const blob = await res.blob()
            const objectUrl = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = objectUrl
            link.download = `${type}-template.xlsx`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(objectUrl)
        } catch {
            toast.error(t("excel.export.error"))
        }
    }

    // Count unique documents
    const uniqueDocs = validationResult
        ? new Set(validationResult.valid.map(r => `${r.docKey}__${r.clientName}`)).size
        : 0

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t("excel.import.title")}</DialogTitle>
                    <DialogDescription>
                        {type === "quotes"
                            ? t("excel.import.quotes")
                            : t("excel.import.invoices")}
                    </DialogDescription>
                </DialogHeader>

                {step === "upload" && (
                    <div className="space-y-4">
                        {/* Drop zone */}
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                        >
                            {loading ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                    <p className="text-sm text-muted-foreground">{t("excel.import.processingFile")}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="h-8 w-8 text-gray-400" />
                                    <p className="font-medium">{t("excel.import.dragDrop")}</p>
                                    <p className="text-sm text-muted-foreground">{t("excel.import.upload")}</p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        {/* Template download */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground">
                                {t("excel.import.noTemplate")}
                            </p>
                            <Button variant="ghost" size="sm" onClick={handleTemplateDownload}>
                                <Download className="h-4 w-4 me-2" />
                                {t("excel.import.downloadTemplate")}
                            </Button>
                        </div>
                    </div>
                )}

                {step === "preview" && validationResult && (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                                <div>
                                    <p className="font-medium text-green-800">{t("excel.import.documents", { count: uniqueDocs })}</p>
                                    <p className="text-sm text-green-600">{t("excel.import.validRows", { count: validationResult.valid.length })}</p>
                                </div>
                            </div>
                            {validationResult.errors.length > 0 && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                                    <div>
                                        <p className="font-medium text-red-800">{t("excel.import.errors")}</p>
                                        <p className="text-sm text-red-600">{t("excel.import.errorRows", { count: validationResult.errors.length })}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Errors table */}
                        {validationResult.errors.length > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <div className="mt-2 space-y-1">
                                        {validationResult.errors.slice(0, 10).map((err, i) => (
                                            <div key={i} className="text-xs">
                                                {t("excel.import.row")} {err.row}: <strong>{err.field}</strong> — {err.message}
                                            </div>
                                        ))}
                                        {validationResult.errors.length > 10 && (
                                            <div className="text-xs text-muted-foreground">{t("excel.import.moreErrors", { count: validationResult.errors.length - 10 })}</div>
                                        )}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Valid rows preview */}
                        {validationResult.valid.length > 0 && (
                            <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-end p-2 font-medium">{t("excel.import.colClient")}</th>
                                            <th className="text-end p-2 font-medium">{t("excel.import.colDescription")}</th>
                                            <th className="text-end p-2 font-medium">{t("excel.import.colQuantity")}</th>
                                            <th className="text-end p-2 font-medium">{t("excel.import.colPrice")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {validationResult.valid.slice(0, 8).map((row, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="p-2 text-end">{row.clientName}</td>
                                                <td className="p-2 text-end truncate max-w-[150px]">{row.description}</td>
                                                <td className="p-2 text-end">{row.quantity}</td>
                                                <td className="p-2 text-end">{row.unitPrice}</td>
                                            </tr>
                                        ))}
                                        {validationResult.valid.length > 8 && (
                                            <tr className="border-t">
                                                <td colSpan={4} className="p-2 text-center text-muted-foreground text-xs">
                                                    {t("excel.import.moreRows", { count: validationResult.valid.length - 8 })}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {step === "importing" && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-muted-foreground">{t("excel.import.importing")}</p>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {step === "upload" && (
                        <Button variant="outline" onClick={() => handleClose(false)}>
                            {t("excel.import.cancel")}
                        </Button>
                    )}
                    {step === "preview" && (
                        <>
                            <Button variant="outline" onClick={reset}>
                                {t("excel.import.back")}
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={validationResult?.valid.length === 0}
                            >
                                {t("excel.import.confirm", { count: uniqueDocs })}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
