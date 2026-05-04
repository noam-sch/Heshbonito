"use client"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import type { Client, Invoice, InvoiceItem, PaymentMethod, Receipt } from "@/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useState } from "react"
import { useGet, usePatch, usePost } from "@/hooks/use-fetch"

import { BetterInput } from "@/components/better-input"
import { Button } from "@/components/ui/button"
import { ClientUpsert } from "../../clients/_components/client-upsert"
import CurrencySelect from "@/components/currency-select"
import { PaymentMethodType } from "@/types"
import SearchSelect from "@/components/search-input"
import { Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

interface ReceiptUpsertDialogProps {
    receipt?: Receipt | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface Item {
    invoiceItemId?: string
    description: string
    amountPaid: number
}

type Mode = "fromInvoice" | "standalone"

export function ReceiptUpsert({ receipt, open, onOpenChange }: ReceiptUpsertDialogProps) {
    const { t } = useTranslation()
    const isEdit = !!receipt

    const [clientDialogOpen, setClientDialogOpen] = useState(false)
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("")
    const [clientSearchTerm, setClientSearchTerm] = useState("")
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
    const [selectedItem, setSelectedItem] = useState<InvoiceItem | null>(null)
    const [items, setItems] = useState<Item[]>(receipt?.items.map(item => ({
        invoiceItemId: item.invoiceItemId || undefined,
        description:
            receipt.invoice?.items.find(invItem => invItem.id === item.invoiceItemId)?.description ||
            item.description ||
            "",
        amountPaid: item.amountPaid
    })) || [])

    // Default mode: standalone for new, follows existing data for edit
    const initialMode: Mode = receipt?.invoiceId ? "fromInvoice" : "standalone"
    const [mode, setMode] = useState<Mode>(initialMode)

    const receiptSchema = z.object({
        invoiceId: z.string().optional(),
        clientId: z.string().optional(),
        currency: z.string().optional(),
        paymentMethodId: z.string().optional(),
        notes: z.string().optional(),
    })

    const { data: company } = useGet<{ currency?: string }>(`/api/company/info`)
    // /api/invoices/search returns either an array (when query is set) or a
    // paginated `{ pageCount, invoices }` object (when query is empty).
    // Normalize both shapes here so the dropdown can map over the result.
    const { data: invoicesRaw } = useGet<Invoice[] | { invoices: Invoice[]; pageCount: number }>(
        `/api/invoices/search?query=${invoiceSearchTerm}`
    )
    const invoices: Invoice[] = Array.isArray(invoicesRaw)
        ? invoicesRaw
        : (invoicesRaw?.invoices || [])
    const { data: clientsRaw } = useGet<Client[] | { clients: Client[]; pageCount: number }>(
        `/api/clients/search?query=${clientSearchTerm}`
    )
    const clients: Client[] = Array.isArray(clientsRaw)
        ? clientsRaw
        : (clientsRaw?.clients || [])
    const { data: paymentMethods } = useGet<PaymentMethod[]>(`/api/payment-methods`)
    const { trigger: createTrigger, loading: createLoading } = usePost("/api/receipts")
    const { trigger: updateTrigger, loading: updateLoading } = usePatch(`/api/receipts/${receipt?.id}`)

    const form = useForm<z.infer<typeof receiptSchema>>({
        resolver: zodResolver(receiptSchema),
        defaultValues: {
            invoiceId: receipt?.invoiceId || "",
            clientId: (receipt?.clientId || receipt?.invoice?.clientId) || "",
            currency: receipt?.currency || receipt?.invoice?.currency || "",
            paymentMethodId: receipt?.paymentMethodId || "",
            notes: receipt?.notes || "",
        },
    })

    useEffect(() => {
        if (isEdit && receipt) {
            const newMode: Mode = receipt.invoiceId ? "fromInvoice" : "standalone"
            setMode(newMode)
            form.reset({
                invoiceId: receipt.invoiceId || "",
                clientId: (receipt.clientId || receipt.invoice?.clientId) || "",
                currency: receipt.currency || receipt.invoice?.currency || "",
                paymentMethodId: (receipt as any).paymentMethodId || "",
                notes: receipt.notes || "",
            })
            setItems(receipt.items.map(item => ({
                invoiceItemId: item.invoiceItemId || undefined,
                description:
                    receipt.invoice?.items.find(invItem => invItem.id === item.invoiceItemId)?.description ||
                    item.description ||
                    "",
                amountPaid: item.amountPaid
            })))
            setSelectedInvoice(receipt.invoice || null)
            setSelectedItem(null)
        } else {
            // New receipt — default to standalone with the user's company currency.
            // Don't depend on `company.currency` here — if it loads asynchronously
            // we don't want to clobber the user's in-progress edits.
            setMode("standalone")
            form.reset({
                invoiceId: "",
                clientId: "",
                currency: "ILS",
                paymentMethodId: "",
                notes: "",
            })
            setItems([])
            setSelectedInvoice(null)
            setSelectedItem(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [receipt, form, isEdit])

    // Once the company info loads, prefill the currency for new receipts if
    // the user hasn't picked one yet. This runs at most once because the
    // condition stops matching as soon as currency is set.
    useEffect(() => {
        if (!isEdit && company?.currency && !form.getValues("currency")) {
            form.setValue("currency", company.currency)
        }
    }, [company?.currency, isEdit, form])

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setSelectedInvoice(null)
            setSelectedItem(null)
            setItems([])
            form.reset()
        }
        onOpenChange(open)
    }

    const onSubmit = (data: z.infer<typeof receiptSchema>) => {
        const trigger = isEdit ? updateTrigger : createTrigger

        if (mode === "fromInvoice") {
            if (!data.invoiceId) {
                form.setError("invoiceId", { message: t("receipts.upsert.form.invoice.errors.required") })
                return
            }
            trigger({
                invoiceId: data.invoiceId,
                paymentMethodId: data.paymentMethodId,
                notes: data.notes,
                items: items.map(item => ({
                    invoiceItemId: item.invoiceItemId,
                    amountPaid: item.amountPaid,
                })),
            })
                .then(() => {
                    onOpenChange(false)
                    form.reset()
                })
                .catch((err) => console.error(err))
        } else {
            if (!data.clientId) {
                form.setError("clientId", { message: t("receipts.upsert.form.client.errors.required") })
                return
            }
            if (items.length === 0) {
                return
            }
            trigger({
                clientId: data.clientId,
                currency: data.currency,
                paymentMethodId: data.paymentMethodId,
                notes: data.notes,
                items: items.map(item => ({
                    description: item.description,
                    amountPaid: item.amountPaid,
                })),
            })
                .then(() => {
                    onOpenChange(false)
                    form.reset()
                })
                .catch((err) => console.error(err))
        }
    }

    useEffect(() => {
        if (selectedInvoice) {
            form.setValue("paymentMethodId", selectedInvoice.paymentMethodId || "")
            form.setValue("currency", selectedInvoice.currency || "")
        }
    }, [form, selectedInvoice])

    const onAddItemFromInvoice = () => {
        if (selectedItem) {
            setItems([...items, {
                invoiceItemId: selectedItem.id,
                description: selectedItem.description,
                amountPaid: selectedItem.unitPrice * selectedItem.quantity
            }])
            setSelectedItem(null)
        }
    }

    const onAddBlankItem = () => {
        setItems([...items, { description: "", amountPaid: 0 }])
    }

    const onRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const onEditItem = (index: number, field: keyof Item) => (value: string | number) => {
        setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
    }

    const handleModeChange = (newMode: Mode) => {
        setMode(newMode)
        // Wipe items + invoice selection when switching modes to avoid mismatched data
        setItems([])
        setSelectedInvoice(null)
        setSelectedItem(null)
        if (newMode === "standalone") {
            form.setValue("invoiceId", "")
        } else {
            form.setValue("clientId", "")
        }
    }

    const currencyForDisplay = form.watch("currency") || company?.currency || ""

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-sm lg:max-w-4xl min-w-fit max-h-[90vh] overflow-y-auto overflow-visible" dataCy="receipt-dialog">
                    <DialogHeader className="h-fit">
                        <DialogTitle>{t(`receipts.upsert.title.${isEdit ? "edit" : "create"}`)}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} data-cy="receipt-form">
                            {!isEdit && (
                                <FormItem className="mb-2">
                                    <FormLabel>{t("receipts.upsert.form.mode.label", "Source")}</FormLabel>
                                    <FormControl>
                                        <Select value={mode} onValueChange={(v) => handleModeChange(v as Mode)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="standalone">
                                                    {t("receipts.upsert.form.mode.standalone", "Standalone receipt")}
                                                </SelectItem>
                                                <SelectItem value="fromInvoice">
                                                    {t("receipts.upsert.form.mode.fromInvoice", "From invoice")}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                </FormItem>
                            )}

                            {mode === "fromInvoice" && (
                                <FormField
                                    control={form.control}
                                    name="invoiceId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel required>{t("receipts.upsert.form.invoice.label")}</FormLabel>
                                            <FormControl>
                                                <SearchSelect
                                                    options={(invoices || []).map((invoice) => ({ label: invoice.rawNumber || invoice.number.toString(), value: invoice.id }))}
                                                    value={field.value ?? ""}
                                                    onValueChange={(val) => { field.onChange(val || null); setSelectedInvoice(invoices?.find(inv => inv.id === val) || null); setSelectedItem(null); }}
                                                    onSearchChange={setInvoiceSearchTerm}
                                                    placeholder={t("receipts.upsert.form.invoice.placeholder")}
                                                    noResultsText={t("receipts.upsert.form.invoice.noResults")}
                                                    data-cy="receipt-invoice-select"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {mode === "standalone" && (
                                <>
                                    <FormField
                                        control={form.control}
                                        name="clientId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel required>{t("receipts.upsert.form.client.label", "Client")}</FormLabel>
                                                <FormControl>
                                                    <SearchSelect
                                                        options={(clients || []).map((c) => ({ label: c.name || `${c.contactFirstname || ""} ${c.contactLastname || ""}`.trim(), value: c.id }))}
                                                        value={field.value ?? ""}
                                                        onValueChange={(val) => field.onChange(val || null)}
                                                        onSearchChange={setClientSearchTerm}
                                                        placeholder={t("receipts.upsert.form.client.placeholder", "Select a client")}
                                                        data-cy="receipt-client-select"
                                                        noResultsComponent={
                                                            <Button
                                                                variant="link"
                                                                onClick={() => setClientDialogOpen(true)}
                                                            >
                                                                {t("receipts.upsert.form.client.noOptions", "Create a new client")}
                                                            </Button>
                                                        }
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="currency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t("receipts.upsert.form.currency.label", "Currency")}</FormLabel>
                                                <FormControl>
                                                    <CurrencySelect value={field.value} onChange={(value) => field.onChange(value)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </>
                            )}

                            <FormField
                                control={form.control}
                                name="paymentMethodId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("receipts.upsert.form.paymentMethod.label")}</FormLabel>
                                        <FormControl>
                                            <Select value={field.value ?? ""} onValueChange={(val) => field.onChange(val || "")}>
                                                <SelectTrigger className="w-full" aria-label={t("receipts.upsert.form.paymentMethod.label") as string}>
                                                    <SelectValue placeholder={t("receipts.upsert.form.paymentMethod.placeholder")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(paymentMethods || []).map((pm: PaymentMethod) => (
                                                        <SelectItem key={pm.id} value={pm.id}>
                                                            {pm.name} - {pm.type == PaymentMethodType.BANK_TRANSFER ? t("paymentMethods.fields.type.bank_transfer") : pm.type == PaymentMethodType.PAYPAL ? t("paymentMethods.fields.type.paypal") : pm.type == PaymentMethodType.CHECK ? t("paymentMethods.fields.type.check") : pm.type == PaymentMethodType.CASH ? t("paymentMethods.fields.type.cash") : pm.type == PaymentMethodType.OTHER ? t("paymentMethods.fields.type.other") : pm.type}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormDescription>
                                            {t("receipts.upsert.form.paymentMethod.description")}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormItem className="flex flex-col gap-2 mt-2">
                                <FormLabel className="mb-0">{t("receipts.upsert.form.items.label")}</FormLabel>

                                {mode === "fromInvoice" && (
                                    <section className="grid grid-cols-1 md:grid-cols-4 gap-2 !m-0">
                                        <FormItem className="col-span-3">
                                            <FormControl>
                                                <SearchSelect
                                                    options={(selectedInvoice?.items || [])
                                                        .filter(item => !items.some(i => i.invoiceItemId === item.id))
                                                        .map(item => ({ label: item.description, value: item.id }))}
                                                    value={selectedItem?.id || undefined}
                                                    onValueChange={(val) => {
                                                        setSelectedItem((selectedInvoice?.items || []).find(item => item.id === val) || null);
                                                    }}
                                                    placeholder={t("receipts.upsert.form.items.placeholder")}
                                                    noResultsText={t("receipts.upsert.form.items.noResults")}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={!selectedItem}
                                            onClick={onAddItemFromInvoice}
                                        >
                                            {t("receipts.upsert.form.items.addButton")}
                                        </Button>
                                    </section>
                                )}

                                {mode === "standalone" && (
                                    <Button type="button" variant="outline" onClick={onAddBlankItem}>
                                        {t("receipts.upsert.form.items.addBlank", "+ Add item")}
                                    </Button>
                                )}

                                <div className="flex flex-col gap-2">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <BetterInput
                                                        value={item.description || ""}
                                                        placeholder={t("receipts.upsert.form.items.description.placeholder")}
                                                        onChange={(e) => onEditItem(index, "description")(e.target.value)}
                                                        disabled={mode === "fromInvoice"}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            <FormItem>
                                                <FormControl>
                                                    <BetterInput
                                                        defaultValue={item.amountPaid || ""}
                                                        placeholder={t("receipts.upsert.form.items.amountPaid.placeholder")}
                                                        onChange={(e) => onEditItem(index, "amountPaid")(parseFloat(e.target.value))}
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        postAdornment={currencyForDisplay}
                                                        disabled={mode === "fromInvoice" && !selectedInvoice}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>

                                            <Button variant={"outline"} onClick={() => onRemoveItem(index)} type="reset" className="h-8">
                                                <Trash2 className="h-4 w-4 text-red-700" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </FormItem>
                        </form>
                    </Form>
                    <DialogFooter className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t("receipts.upsert.actions.cancel")}
                        </Button>
                        <Button type="button" onClick={form.handleSubmit(onSubmit)} loading={createLoading || updateLoading} dataCy="receipt-submit">
                            {t(`receipts.upsert.actions.${isEdit ? "save" : "create"}`)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ClientUpsert
                open={clientDialogOpen}
                onOpenChange={setClientDialogOpen}
            />
        </>
    )
}
