import { Card, CardContent } from "@/components/ui/card"
import { FileText, Plus, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useGetRaw, useSse } from "@/hooks/use-fetch"

import { Button } from "@/components/ui/button"
import { ExcelExportButton } from "@/components/excel-export-button"
import { ExcelImportDialog } from "@/components/excel-import-dialog"
import { Input } from "@/components/ui/input"
import type { Quote } from "@/types"
import { QuoteList } from "@/pages/(app)/quotes/_components/quote-list"
import type { QuoteListHandle } from "@/pages/(app)/quotes/_components/quote-list"
import { useTranslation } from "react-i18next"

export default function Quotes() {
    const { t } = useTranslation()
    const quoteListRef = useRef<QuoteListHandle>(null)
    const [page, setPage] = useState(1)
    const { data: quotes } = useSse<{ pageCount: number; quotes: Quote[] }>(`/api/quotes/sse?page=${page}`)
    const [downloadQuotePdf, setDownloadQuotePdf] = useState<Quote | null>(null)
    const { data: pdf } = useGetRaw<Response>(`/api/quotes/${downloadQuotePdf?.id}/pdf`)

    useEffect(() => {
        if (downloadQuotePdf && pdf) {
            pdf.arrayBuffer().then((buffer) => {
                const blob = new Blob([buffer], { type: "application/pdf" })
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = `quote-${downloadQuotePdf.number}.pdf`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
                setDownloadQuotePdf(null) // Reset after download
            })
        }
    }, [downloadQuotePdf, pdf])

    const [searchTerm, setSearchTerm] = useState("")
    const [importOpen, setImportOpen] = useState(false)

    const filteredQuotes =
        quotes?.quotes.filter(
            (quote) =>
                quote.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                quote.status.toLowerCase().includes(searchTerm.toLowerCase()),
        ) || []

    const emptyState = (
        <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-foreground">
                {searchTerm ? t("quotes.emptyState.noResults") : t("quotes.emptyState.noQuotes")}
            </h3>
            <p className="mt-1 text-sm text-primary">
                {searchTerm ? t("quotes.emptyState.tryDifferentSearch") : t("quotes.emptyState.startAdding")}
            </p>
            {!searchTerm && (
                <div className="mt-6">
                    <Button onClick={() => quoteListRef.current?.handleAddClick()}>
                        <Plus className="h-4 w-4 me-2" />
                        {t("quotes.actions.addNew")}
                    </Button>
                </div>
            )}
        </div>
    )

    return (
        <div className="max-w-7xl mx-auto space-y-6 p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-0 lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <div className="text-sm text-primary">{t("quotes.header.subtitle")}</div>
                        <div className="font-medium text-foreground">
                            {t("quotes.header.count", {
                                count: filteredQuotes.length,
                                found: searchTerm ? t("quotes.header.found") : "",
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex flex-row items-center gap-4 w-full lg:w-fit lg:gap-6 lg:justify-between">
                    <div className="relative w-full lg:w-fit">
                        <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder={t("quotes.search.placeholder")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ps-10 w-full"
                        />
                    </div>
                    <ExcelImportDialog type="quotes" open={importOpen} onOpenChange={setImportOpen} />
                    <ExcelExportButton type="quotes" variant="outline" size="default" />
                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                        <span className="hidden md:inline-flex">{t("excel.import.button")}</span>
                        <span className="md:hidden">⬆</span>
                    </Button>
                    <Button onClick={() => quoteListRef.current?.handleAddClick()}>
                        <Plus className="h-4 w-4 me-0 md:me-2" />
                        <span className="hidden md:inline-flex">{t("quotes.actions.addNew")}</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-foreground">{quotes?.quotes.length || 0}</p>
                                <p className="text-sm text-primary">{t("quotes.stats.total")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-100 rounded-lg">
                                <div className="w-6 h-6 flex items-center justify-center">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                </div>
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-foreground">
                                    {quotes?.quotes.filter((c) => c.status === "DRAFT").length || 0}
                                </p>
                                <p className="text-sm text-primary">{t("quotes.stats.draft")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <div className="w-6 h-6 flex items-center justify-center">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                </div>
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-foreground">
                                    {quotes?.quotes.filter((c) => c.status === "SIGNED").length || 0}
                                </p>
                                <p className="text-sm text-primary">{t("quotes.stats.signed")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <QuoteList
                ref={quoteListRef}
                quotes={filteredQuotes}
                loading={false}
                title={t("quotes.list.title")}
                description={t("quotes.list.description")}
                page={page}
                pageCount={quotes?.pageCount || 1}
                setPage={setPage}
                emptyState={emptyState}
                showCreateButton={true}
            />
        </div>
    )
}
