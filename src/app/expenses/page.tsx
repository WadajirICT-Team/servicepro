"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, DollarSign, TrendingDown, Pencil, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableSkeleton } from "@/components/ui/page-skeletons";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/RouteGuards";

const DEFAULT_CATEGORIES = ["parts", "fuel", "tools", "office", "utilities", "salary", "marketing", "general"];

const emptyForm = { description: "", amount: "", category: "general", expense_date: new Date().toISOString().split("T")[0] };

export default function ExpensesPage() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [form, setForm] = useState({ ...emptyForm });
    const [editForm, setEditForm] = useState({ ...emptyForm });
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

    type SortField = "expense_date" | "amount" | "category";
    type SortDir = "asc" | "desc";
    const [sortField, setSortField] = useState<SortField>("expense_date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [dateRange, setDateRange] = useState<string>("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchExpenses = async () => {
        const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
        setExpenses(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchExpenses();
        const loadConfig = async () => {
            const { data } = await supabase.from("app_config").select("value").eq("key", "expense_categories").single();
            if (data?.value) {
                let parsed = data.value;
                if (typeof parsed === 'string') {
                    const stringValue = parsed;
                    try {
                        parsed = JSON.parse(stringValue);
                    } catch (e) {
                        parsed = stringValue.split(',').map((s: string) => s.trim());
                    }
                }
                if (Array.isArray(parsed)) {
                    setCategories(parsed as string[]);
                }
            }
        };
        loadConfig();
        const channel = supabase
            .channel('expenses-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => { fetchExpenses(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleCreate = async () => {
        if (!form.description || !form.amount) { toast.error("Description and amount are required"); return; }
        const today = new Date().toISOString().split("T")[0];
        if (form.expense_date > today) { toast.error("Expense date cannot be in the future"); return; }
        setSubmitting(true);
        const { error } = await supabase.from("expenses").insert({
            description: form.description,
            amount: parseFloat(form.amount),
            category: form.category,
            expense_date: form.expense_date,
            created_by: user?.id || null,
        });
        if (error) toast.error(error.message);
        else { toast.success("Expense added"); setCreateOpen(false); setForm({ ...emptyForm }); fetchExpenses(); }
        setSubmitting(false);
    };

    const openEdit = (expense: any) => {
        setEditTarget(expense);
        setEditForm({
            description: expense.description,
            amount: String(expense.amount),
            category: expense.category,
            expense_date: expense.expense_date,
        });
        setEditOpen(true);
    };

    const handleEdit = async () => {
        if (!editTarget || !editForm.description || !editForm.amount) { toast.error("Description and amount are required"); return; }
        const today = new Date().toISOString().split("T")[0];
        if (editForm.expense_date > today) { toast.error("Expense date cannot be in the future"); return; }
        setSubmitting(true);
        const { error } = await supabase.from("expenses").update({
            description: editForm.description,
            amount: parseFloat(editForm.amount),
            category: editForm.category,
            expense_date: editForm.expense_date,
        }).eq("id", editTarget.id);
        if (error) toast.error(error.message);
        else { toast.success("Expense updated"); setEditOpen(false); fetchExpenses(); }
        setSubmitting(false);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSubmitting(true);
        const { error } = await supabase.from("expenses").delete().eq("id", deleteTarget.id);
        if (error) toast.error(error.message);
        else { toast.success("Expense deleted"); setDeleteTarget(null); fetchExpenses(); }
        setSubmitting(false);
    };

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const thisMonth = expenses
        .filter((e) => new Date(e.expense_date).getMonth() === new Date().getMonth() && new Date(e.expense_date).getFullYear() === new Date().getFullYear())
        .reduce((s, e) => s + Number(e.amount || 0), 0);

    const filtered = expenses
        .filter((e) => {
            const matchSearch = search === "" || e.description.toLowerCase().includes(search.toLowerCase());
            const matchCategory = filterCategory === "all" || e.category === filterCategory;
            let matchDate = true;
            const expDate = new Date(e.expense_date);
            if (dateRange === "this_month") {
                const now = new Date();
                matchDate = expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
            } else if (dateRange === "last_month") {
                const last = new Date(); last.setMonth(last.getMonth() - 1);
                matchDate = expDate.getMonth() === last.getMonth() && expDate.getFullYear() === last.getFullYear();
            } else if (dateRange === "custom") {
                if (dateFrom) matchDate = matchDate && expDate >= new Date(dateFrom);
                if (dateTo) matchDate = matchDate && expDate <= new Date(dateTo + "T23:59:59");
            }
            return matchSearch && matchCategory && matchDate;
        })
        .sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "expense_date": cmp = new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime(); break;
                case "amount": cmp = Number(a.amount) - Number(b.amount); break;
                case "category": cmp = (a.category || "").localeCompare(b.category || ""); break;
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



    const categoryColor: Record<string, string> = {
        parts: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        fuel: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        tools: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
        salary: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
        general: "bg-muted text-muted-foreground",
    };

    const renderForm = (values: typeof form, onChange: (v: typeof form) => void) => (
        <div className="space-y-4">
            <div>
                <Label>Description *</Label>
                <Textarea value={values.description} onChange={(e) => onChange({ ...values, description: e.target.value })} placeholder="e.g. Purchased replacement compressor" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Amount ($) *</Label>
                    <Input type="number" step="0.01" value={values.amount} onChange={(e) => onChange({ ...values, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                    <Label>Category</Label>
                    <Select value={values.category} onValueChange={(v) => onChange({ ...values, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {(Array.isArray(categories) ? categories : DEFAULT_CATEGORIES).map((c) => <SelectItem key={String(c)} value={String(c)}>{String(c).charAt(0).toUpperCase() + String(c).slice(1)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div>
                <Label>Date</Label>
                <Input type="date" value={values.expense_date} onChange={(e) => onChange({ ...values, expense_date: e.target.value })} max={new Date().toISOString().split("T")[0]} />
            </div>
        </div>
    );

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Expenses</h1>
                        <p className="text-muted-foreground">Track and manage business expenses</p>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>New Expense</DialogTitle>
                                <DialogDescription>Record a new business expense.</DialogDescription>
                            </DialogHeader>
                            {renderForm(form, setForm)}
                            <DialogFooter>
                                <Button onClick={handleCreate} disabled={submitting}>{submitting ? "Saving..." : "Save Expense"}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                            <DollarSign className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold text-destructive">${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                            <TrendingDown className="h-4 w-4 text-warning" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">${thisMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></CardContent>
                    </Card>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-full lg:w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {(Array.isArray(categories) ? categories : DEFAULT_CATEGORIES).map((c) => <SelectItem key={String(c)} value={String(c)}>{String(c).charAt(0).toUpperCase() + String(c).slice(1)}</SelectItem>)}
                        </SelectContent>
                    </Select>

                </div>

                {/* Date range filter */}
                <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-xs text-muted-foreground mr-1">Period:</span>
                    {(["all", "this_month", "last_month", "custom"] as const).map((v) => (
                        <Button
                            key={v}
                            variant={dateRange === v ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setDateRange(v)}
                        >
                            {v === "all" ? "All Time" : v === "this_month" ? "This Month" : v === "last_month" ? "Last Month" : "Custom"}
                        </Button>
                    ))}
                    {dateRange === "custom" && (
                        <>
                            <Input type="date" className="w-[140px] h-7 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input type="date" className="w-[140px] h-7 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </>
                    )}
                </div>
                <Card>
                    <CardHeader><CardTitle>All Expenses</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <TableSkeleton columns={5} rows={6} />
                        ) : filtered.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No expenses found.</p>
                        ) : (
                            <div className="table-responsive">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("expense_date")}>
                                                <span className="flex items-center">Date <SortIcon field="expense_date" /></span>
                                            </TableHead>
                                            <TableHead className="hide-mobile">Description</TableHead>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("category")}>
                                                <span className="flex items-center">Category <SortIcon field="category" /></span>
                                            </TableHead>
                                            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                                                <span className="flex items-center justify-end">Amount <SortIcon field="amount" /></span>
                                            </TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.slice((page - 1) * pageSize, page * pageSize).map((e) => (
                                            <TableRow key={e.id}>
                                                <TableCell className="text-sm">{new Date(e.expense_date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-sm max-w-[300px] truncate hide-mobile">{e.description}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={categoryColor[e.category] || categoryColor.general}>
                                                        {e.category}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(e)}>
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
                            <DialogTitle>Edit Expense</DialogTitle>
                            <DialogDescription>Update expense details.</DialogDescription>
                        </DialogHeader>
                        {renderForm(editForm, setEditForm)}
                        <DialogFooter>
                            <Button onClick={handleEdit} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this expense: <strong>{deleteTarget?.description}</strong>? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {submitting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </ProtectedRoute>
    );
}
