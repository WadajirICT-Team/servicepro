"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageSpinner } from "@/components/ui/spinner";
import { Plus, Search, Users, Pencil, Trash2, Eye, AlertTriangle, Download, ArrowUpDown, ArrowUp, ArrowDown, Wrench } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import { toast } from "sonner";
import { exportToXlsx } from "@/lib/exportExcel";
import { ProtectedRoute } from "@/components/RouteGuards";

export default function CustomersPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleteTicketCount, setDeleteTicketCount] = useState(0);
    const [transferCustomerId, setTransferCustomerId] = useState("");
    const [editTarget, setEditTarget] = useState<any>(null);
    const [form, setForm] = useState({ full_name: "", phone: "", email: "", address: "", notes: "" });
    const [editForm, setEditForm] = useState({ full_name: "", phone: "", email: "", address: "", notes: "" });
    const [submitting, setSubmitting] = useState(false);

    type SortField = "full_name" | "phone" | "created_at";
    type SortDir = "asc" | "desc";
    const [sortField, setSortField] = useState<SortField>("full_name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchCustomers = async () => {
        const { data } = await supabase.from("customers").select("*").order("full_name");
        setCustomers(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchCustomers();
        const channel = supabase
            .channel('customers-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => { fetchCustomers(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { error } = await supabase.from("customers").insert(form);
        if (error) toast.error(error.message);
        else { toast.success("Customer added"); setDialogOpen(false); setForm({ full_name: "", phone: "", email: "", address: "", notes: "" }); fetchCustomers(); }
        setSubmitting(false);
    };

    const openEdit = (customer: any) => {
        setEditTarget(customer);
        setEditForm({ full_name: customer.full_name, phone: customer.phone, email: customer.email || "", address: customer.address || "", notes: customer.notes || "" });
        setEditOpen(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setSubmitting(true);
        const { error } = await supabase.from("customers").update({
            full_name: editForm.full_name,
            phone: editForm.phone,
            email: editForm.email || null,
            address: editForm.address || null,
            notes: editForm.notes || null,
        }).eq("id", editTarget.id);
        if (error) toast.error(error.message);
        else { toast.success("Customer updated"); setEditOpen(false); fetchCustomers(); }
        setSubmitting(false);
    };

    const initiateDelete = async (customer: any) => {
        const { count } = await supabase.from("service_tickets").select("id", { count: "exact", head: true }).eq("customer_id", customer.id);
        setDeleteTicketCount(count || 0);
        setTransferCustomerId("");
        setDeleteTarget(customer);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSubmitting(true);

        if (deleteTicketCount > 0) {
            if (!transferCustomerId) {
                toast.error("Please select a customer to transfer tickets to");
                setSubmitting(false);
                return;
            }
            const { error: transferError } = await supabase.from("service_tickets").update({ customer_id: transferCustomerId }).eq("customer_id", deleteTarget.id);
            if (transferError) { toast.error("Failed to transfer tickets: " + transferError.message); setSubmitting(false); return; }
        }

        const { error } = await supabase.from("customers").delete().eq("id", deleteTarget.id);
        if (error) toast.error(error.message);
        else { toast.success("Customer deleted"); setDeleteTarget(null); fetchCustomers(); }
        setSubmitting(false);
    };

    const filtered = customers
        .filter((c) => search === "" || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
        .sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "full_name": cmp = a.full_name.localeCompare(b.full_name); break;
                case "phone": cmp = (a.phone || "").localeCompare(b.phone || ""); break;
                case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortField(field); setSortDir("asc"); }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
        return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
    };

    const exportExcel = () => {
        exportToXlsx({
            filename: "customers.xlsx",
            sheetName: "Customers",
            headers: ["Name", "Phone", "Email", "Address", "Added"],
            rows: filtered.map((c) => [
                c.full_name,
                c.phone,
                c.email || "",
                c.address || "",
                new Date(c.created_at).toLocaleDateString(),
            ]),
        });
    };

    const renderForm = (values: typeof form, onChange: (v: typeof form) => void, onSubmit: (e: React.FormEvent) => void, buttonLabel: string) => (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={values.full_name} onChange={(e) => onChange({ ...values, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
                <Label>Phone *</Label>
                <Input value={values.phone} onChange={(e) => onChange({ ...values, phone: e.target.value })} required />
            </div>
            <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={values.email} onChange={(e) => onChange({ ...values, email: e.target.value })} />
            </div>
            <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={values.address} onChange={(e) => onChange({ ...values, address: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={values.notes} onChange={(e) => onChange({ ...values, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving..." : buttonLabel}
            </Button>
        </form>
    );

    return (
        <ProtectedRoute adminOnly>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Customers</h1>
                        <p className="text-muted-foreground">{customers.length} customers</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Customer</DialogTitle>
                                    <DialogDescription>Create a new customer record.</DialogDescription>
                                </DialogHeader>
                                {renderForm(form, setForm, handleCreate, "Add Customer")}
                            </DialogContent>
                        </Dialog>
                        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={exportExcel} disabled={filtered.length === 0}>
                            <Download className="h-4 w-4 mr-2" /> Export Excel
                        </Button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <PageSpinner label="Loading customers..." />
                        ) : filtered.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No customers found.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                                                <span className="flex items-center">Name <SortIcon field="full_name" /></span>
                                            </TableHead>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("phone")}>
                                                <span className="flex items-center">Phone <SortIcon field="phone" /></span>
                                            </TableHead>
                                            <TableHead className="hide-mobile">Email</TableHead>
                                            <TableHead className="hide-mobile">Address</TableHead>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                                                <span className="flex items-center">Added <SortIcon field="created_at" /></span>
                                            </TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.slice((page - 1) * pageSize, page * pageSize).map((c) => (
                                            <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/customers/${c.id}`)}>
                                                <TableCell className="font-medium">{c.full_name}</TableCell>
                                                <TableCell>{c.phone}</TableCell>
                                                <TableCell className="text-muted-foreground hide-mobile">{c.email || "—"}</TableCell>
                                                <TableCell className="text-muted-foreground max-w-[200px] truncate hide-mobile">{c.address || "—"}</TableCell>
                                                <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => router.push(`/tickets?customer=${c.id}`)} title="View Tickets">
                                                            <Wrench className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => router.push(`/customers/${c.id}`)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => initiateDelete(c)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                    <TablePagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
                </Card>

                {/* Edit Dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Customer</DialogTitle>
                            <DialogDescription>Update customer information.</DialogDescription>
                        </DialogHeader>
                        {renderForm(editForm, setEditForm, handleEdit, "Save Changes")}
                    </DialogContent>
                </Dialog>

                {/* Delete / Transfer Dialog */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setTransferCustomerId(""); } }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                {deleteTicketCount > 0 && <AlertTriangle className="h-5 w-5 text-warning" />}
                                Delete Customer
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    {deleteTicketCount > 0 ? (
                                        <>
                                            <p>
                                                <strong>{deleteTarget?.full_name}</strong> has <strong>{deleteTicketCount}</strong> linked ticket{deleteTicketCount > 1 ? "s" : ""}. You must transfer them to another customer before deleting.
                                            </p>
                                            <div className="space-y-2">
                                                <Label>Transfer tickets to *</Label>
                                                <Select value={transferCustomerId} onValueChange={setTransferCustomerId}>
                                                    <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {customers.filter((c) => c.id !== deleteTarget?.id).map((c) => (
                                                            <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.phone}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </>
                                    ) : (
                                        <p>Are you sure you want to permanently delete <strong>{deleteTarget?.full_name}</strong>? This action cannot be undone.</p>
                                    )}
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={submitting || (deleteTicketCount > 0 && !transferCustomerId)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {submitting ? "Processing..." : deleteTicketCount > 0 ? "Transfer & Delete" : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </ProtectedRoute>
    );
}
