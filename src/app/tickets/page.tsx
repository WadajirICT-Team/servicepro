"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TicketsSkeleton } from "@/components/ui/page-skeletons";
import { Plus, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Trash2, CalendarIcon } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ProtectedRoute } from "@/components/RouteGuards";

const STATUSES = ["new", "diagnosed", "in_progress", "completed", "invoiced"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const DEFAULT_APPLIANCE_TYPES = [
    { value: "washing_machine", label: "Washing Machine" },
    { value: "refrigerator", label: "Refrigerator" },
    { value: "air_conditioner", label: "Air Conditioner" },
    { value: "dishwasher", label: "Dishwasher" },
    { value: "microwave", label: "Microwave" },
    { value: "oven", label: "Oven" },
    { value: "dryer", label: "Dryer" },
    { value: "other", label: "Other" },
] as const;

const statusColors: Record<string, string> = {
    new: "bg-info/10 text-info border-info/20",
    diagnosed: "bg-purple-100 text-purple-700 border-purple-200",
    in_progress: "bg-warning/10 text-warning border-warning/20",
    completed: "bg-success/10 text-success border-success/20",
    invoiced: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-info/10 text-info",
    high: "bg-warning/10 text-warning",
    urgent: "bg-destructive/10 text-destructive",
};

type SortField = "ticket_number" | "created_at" | "status" | "priority" | "total_cost";
type SortDir = "asc" | "desc";

import { Suspense } from "react";

export default function TicketsPage() {
    return (
        <Suspense fallback={<TicketsSkeleton />}>
            <TicketsContent />
        </Suspense>
    );
}

function TicketsContent() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [techFilter, setTechFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<string>("");
    const [bulkTech, setBulkTech] = useState<string>("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [sortField, setSortField] = useState<SortField>("ticket_number");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, role } = useAuth();
    const isAdmin = role === "admin";
    const [applianceTypes, setApplianceTypes] = useState<{ value: string; label: string }[]>([...DEFAULT_APPLIANCE_TYPES]);

    const [form, setForm] = useState({
        customer_id: "",
        appliance_type: "other" as string,
        appliance_brand: "",
        appliance_model: "",
        issue_description: "",
        priority: "medium" as string,
        estimated_completion: undefined as Date | undefined,
        created_at: new Date() as Date | undefined,
        labor_cost: "",
    });
    const [formTechIds, setFormTechIds] = useState<string[]>([]);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const clearError = (field: string) => {
        setFormErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    };

    useEffect(() => {
        if (searchParams.get("new") === "true") setDialogOpen(true);
        const customerParam = searchParams.get("customer");
        if (customerParam) setSearch(customerParam);
    }, [searchParams]);

    const fetchTickets = async () => {
        const [ticketsRes, techAssignRes] = await Promise.all([
            supabase.from("service_tickets").select("*, customers(full_name, phone)").order("created_at", { ascending: false }),
            supabase.from("ticket_technicians" as any).select("ticket_id, technician_id, profiles:technician_id(full_name)"),
        ]);
        const assignments = techAssignRes.data || [];
        const ticketsData = (ticketsRes.data || []).map((t: any) => ({
            ...t,
            _techNames: assignments.filter((a: any) => a.ticket_id === t.id).map((a: any) => a.profiles?.full_name || "Unknown"),
            _techIds: assignments.filter((a: any) => a.ticket_id === t.id).map((a: any) => a.technician_id),
        }));
        setTickets(ticketsData);
        setLoading(false);
    };

    const fetchDropdowns = async () => {
        const [c, t] = await Promise.all([
            supabase.from("customers").select("id, full_name, phone").order("full_name"),
            supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
        ]);
        setCustomers(c.data || []);
        setTechnicians(t.data || []);
    };

    useEffect(() => {
        fetchTickets();
        fetchDropdowns();
        const loadConfig = async () => {
            const { data } = await supabase.from("app_config").select("value").eq("key", "appliance_types").single();
            if (data?.value) {
                let parsed = data.value;
                if (typeof parsed === 'string') {
                    const strVal = parsed;
                    try { parsed = JSON.parse(strVal); } catch (e) {}
                }
                if (Array.isArray(parsed)) {
                    setApplianceTypes(parsed as { value: string; label: string }[]);
                }
            }
        };
        loadConfig();
        const channel = supabase
            .channel('tickets-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => { fetchTickets(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!form.customer_id) errors.customer_id = "Customer is required";
        if (!form.appliance_type) errors.appliance_type = "Appliance type is required";
        if (!form.appliance_brand.trim()) errors.appliance_brand = "Brand is required";
        if (!form.appliance_model.trim()) errors.appliance_model = "Model is required";
        if (!form.issue_description.trim()) errors.issue_description = "Issue description is required";
        if (!form.priority) errors.priority = "Priority is required";
        if (!form.created_at) errors.created_at = "Creation date is required";
        if (!form.estimated_completion) errors.estimated_completion = "Estimated completion date is required";
        if (form.labor_cost === "" || form.labor_cost === undefined || form.labor_cost === null) errors.labor_cost = "Labor cost is required";
        if (formTechIds.length === 0) errors.technicians = "At least 1 technician must be assigned";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        const { data: newTicket, error } = await supabase.from("service_tickets").insert({
            customer_id: form.customer_id || null,
            appliance_type: form.appliance_type as any,
            appliance_brand: form.appliance_brand || null,
            appliance_model: form.appliance_model || null,
            issue_description: form.issue_description,
            priority: form.priority as any,
            created_by: user?.id,
            estimated_completion: form.estimated_completion ? format(form.estimated_completion, "yyyy-MM-dd") : null,
            created_at: form.created_at ? form.created_at.toISOString() : undefined,
            labor_cost: form.labor_cost ? Number(form.labor_cost) : 0,
        }).select("id").single();
        if (error) {
            toast.error(error.message);
        } else {
            if (formTechIds.length > 0 && newTicket) {
                await supabase.from("ticket_technicians" as any).insert(
                    formTechIds.map((tid) => ({ ticket_id: newTicket.id, technician_id: tid }))
                );
            }
            toast.success("Ticket created");
            setDialogOpen(false);
            setForm({ customer_id: "", appliance_type: "other", appliance_brand: "", appliance_model: "", issue_description: "", priority: "medium", estimated_completion: undefined, created_at: new Date(), labor_cost: "" });
            setFormTechIds([]);
            setFormErrors({});
            fetchTickets();
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const { error } = await supabase.from("service_tickets").delete().eq("id", deleteTarget.id);
        if (error) toast.error(error.message);
        else { toast.success("Ticket deleted"); setDeleteTarget(null); fetchTickets(); }
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
        return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
    };

    const priorityOrder = { low: 0, medium: 1, high: 2, urgent: 3 };
    const statusOrder = { new: 0, diagnosed: 1, in_progress: 2, completed: 3, invoiced: 4 };

    const filtered = tickets
        .filter((t) => {
            const matchesSearch = search === "" || t.issue_description?.toLowerCase().includes(search.toLowerCase()) || t.customers?.full_name?.toLowerCase().includes(search.toLowerCase()) || String(t.ticket_number).includes(search) || t.customer_id === search;
            const matchesStatus = statusFilter === "all" || t.status === statusFilter;
            const matchesTech = techFilter === "all" || (techFilter === "__unassigned__" ? (t._techIds || []).length === 0 : (t._techIds || []).includes(techFilter));
            const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
            return matchesSearch && matchesStatus && matchesTech && matchesPriority;
        })
        .sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "ticket_number": cmp = a.ticket_number - b.ticket_number; break;
                case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
                case "status": cmp = (statusOrder[a.status as keyof typeof statusOrder] ?? 0) - (statusOrder[b.status as keyof typeof statusOrder] ?? 0); break;
                case "priority": cmp = (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 0) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 0); break;
                case "total_cost": cmp = Number(a.total_cost || 0) - Number(b.total_cost || 0); break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });



    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
    const allPageSelected = pageItems.length > 0 && pageItems.every((t) => selected.has(t.id));

    const handleBulkStatusUpdate = async () => {
        if (!bulkStatus || selected.size === 0) return;
        const { error } = await supabase.from("service_tickets").update({ status: bulkStatus as any }).in("id", Array.from(selected));
        if (error) toast.error(error.message);
        else { toast.success(`${selected.size} ticket(s) updated`); setSelected(new Set()); setBulkStatus(""); fetchTickets(); }
    };

    const handleBulkAssign = async () => {
        if (!bulkTech || selected.size === 0) return;
        if (bulkTech === "__unassign__") {
            const { error } = await supabase.from("ticket_technicians" as any).delete().in("ticket_id", Array.from(selected));
            if (error) toast.error(error.message);
            else { toast.success(`${selected.size} ticket(s) unassigned`); setSelected(new Set()); setBulkTech(""); fetchTickets(); }
        } else {
            const inserts = Array.from(selected).map((tid) => ({ ticket_id: tid, technician_id: bulkTech }));
            const { error } = await supabase.from("ticket_technicians" as any).upsert(inserts, { onConflict: "ticket_id,technician_id" });
            if (error) toast.error(error.message);
            else { toast.success(`Technician added to ${selected.size} ticket(s)`); setSelected(new Set()); setBulkTech(""); fetchTickets(); }
        }
    };

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Service Tickets</h1>
                        <p className="text-muted-foreground">{filtered.length} tickets</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {isAdmin && (
                            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setFormErrors({}); }}>
                                <DialogTrigger asChild>
                                    <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> New Ticket</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Create Service Ticket</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleCreate} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Customer *</Label>
                                            <Select value={form.customer_id} onValueChange={(v) => { setForm({ ...form, customer_id: v }); clearError("customer_id"); }}>
                                                <SelectTrigger className={formErrors.customer_id ? "border-destructive" : ""}><SelectValue placeholder="Select customer" /></SelectTrigger>
                                                <SelectContent>
                                                    {customers.map((c) => (
                                                        <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.phone}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {formErrors.customer_id && <p className="text-xs text-destructive">{formErrors.customer_id}</p>}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Appliance Type *</Label>
                                                <Select value={form.appliance_type} onValueChange={(v) => { setForm({ ...form, appliance_type: v }); clearError("appliance_type"); }}>
                                                    <SelectTrigger className={formErrors.appliance_type ? "border-destructive" : ""}><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {(Array.isArray(applianceTypes) ? applianceTypes : DEFAULT_APPLIANCE_TYPES).map((a) => (
                                                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {formErrors.appliance_type && <p className="text-xs text-destructive">{formErrors.appliance_type}</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Priority *</Label>
                                                <Select value={form.priority} onValueChange={(v) => { setForm({ ...form, priority: v }); clearError("priority"); }}>
                                                    <SelectTrigger className={formErrors.priority ? "border-destructive" : ""}><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {PRIORITIES.map((p) => (
                                                            <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {formErrors.priority && <p className="text-xs text-destructive">{formErrors.priority}</p>}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Brand *</Label>
                                                <Input value={form.appliance_brand} onChange={(e) => { setForm({ ...form, appliance_brand: e.target.value }); clearError("appliance_brand"); }} placeholder="e.g. Samsung" className={formErrors.appliance_brand ? "border-destructive" : ""} />
                                                {formErrors.appliance_brand && <p className="text-xs text-destructive">{formErrors.appliance_brand}</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Model *</Label>
                                                <Input value={form.appliance_model} onChange={(e) => { setForm({ ...form, appliance_model: e.target.value }); clearError("appliance_model"); }} placeholder="e.g. WF45R" className={formErrors.appliance_model ? "border-destructive" : ""} />
                                                {formErrors.appliance_model && <p className="text-xs text-destructive">{formErrors.appliance_model}</p>}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Issue Description *</Label>
                                            <Textarea value={form.issue_description} onChange={(e) => { setForm({ ...form, issue_description: e.target.value }); clearError("issue_description"); }} rows={3} placeholder="Describe the issue..." className={formErrors.issue_description ? "border-destructive" : ""} />
                                            {formErrors.issue_description && <p className="text-xs text-destructive">{formErrors.issue_description}</p>}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Creation Date *</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.created_at && "text-muted-foreground", formErrors.created_at && "border-destructive")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {form.created_at ? format(form.created_at, "PPP") : "Pick a date"}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={form.created_at} onSelect={(d) => { setForm({ ...form, created_at: d }); clearError("created_at"); }} initialFocus className="p-3 pointer-events-auto" />
                                                    </PopoverContent>
                                                </Popover>
                                                {formErrors.created_at && <p className="text-xs text-destructive">{formErrors.created_at}</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Estimated Completion *</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.estimated_completion && "text-muted-foreground", formErrors.estimated_completion && "border-destructive")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {form.estimated_completion ? format(form.estimated_completion, "PPP") : "Pick a date"}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={form.estimated_completion} onSelect={(d) => { setForm({ ...form, estimated_completion: d }); clearError("estimated_completion"); }} initialFocus className="p-3 pointer-events-auto" />
                                                    </PopoverContent>
                                                </Popover>
                                                {formErrors.estimated_completion && <p className="text-xs text-destructive">{formErrors.estimated_completion}</p>}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Labor Cost ($) *</Label>
                                            <Input type="number" step="0.01" min={0} value={form.labor_cost} onChange={(e) => { setForm({ ...form, labor_cost: e.target.value }); clearError("labor_cost"); }} placeholder="0.00" className={formErrors.labor_cost ? "border-destructive" : ""} />
                                            {formErrors.labor_cost && <p className="text-xs text-destructive">{formErrors.labor_cost}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Assign Technicians * <span className="text-xs text-muted-foreground font-normal">(at least 1)</span></Label>
                                            <div className={cn("space-y-1 max-h-[120px] overflow-y-auto border rounded p-2", formErrors.technicians && "border-destructive")}>
                                                {technicians.map((t) => (
                                                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                                        <Checkbox
                                                            checked={formTechIds.includes(t.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) setFormTechIds([...formTechIds, t.id]);
                                                                else setFormTechIds(formTechIds.filter((x) => x !== t.id));
                                                                clearError("technicians");
                                                            }}
                                                        />
                                                        {t.full_name}
                                                    </label>
                                                ))}
                                            </div>
                                            {formErrors.technicians && <p className="text-xs text-destructive">{formErrors.technicians}</p>}
                                        </div>
                                        <Button type="submit" className="w-full">Create Ticket</Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}

                    </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search tickets..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full lg:w-[160px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isAdmin && (
                        <Select value={techFilter} onValueChange={setTechFilter}>
                            <SelectTrigger className="w-full lg:w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Technicians</SelectItem>
                                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                {technicians.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-full lg:w-[150px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priority</SelectItem>
                            {PRIORITIES.map((p) => (
                                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground self-center mr-1">Sort by:</span>
                    {([["ticket_number", "#"], ["created_at", "Date"], ["status", "Status"], ["priority", "Priority"], ["total_cost", "Cost"]] as [SortField, string][]).map(([field, label]) => (
                        <Button key={field} variant={sortField === field ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => toggleSort(field)}>
                            {label}<SortIcon field={field} />
                        </Button>
                    ))}
                </div>

                {isAdmin && selected.size > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 flex-wrap">
                        <span className="text-sm font-medium">{selected.size} selected</span>
                        <Select value={bulkStatus} onValueChange={setBulkStatus}>
                            <SelectTrigger className="w-[150px] h-8">
                                <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="secondary" onClick={handleBulkStatusUpdate} disabled={!bulkStatus}>Apply Status</Button>
                        <Select value={bulkTech} onValueChange={setBulkTech}>
                            <SelectTrigger className="w-[160px] h-8">
                                <SelectValue placeholder="Assign tech" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__unassign__">Unassigned</SelectItem>
                                {technicians.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="secondary" onClick={handleBulkAssign} disabled={!bulkTech}>Assign</Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                    </div>
                )}

                {isAdmin && !loading && filtered.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={allPageSelected}
                            onCheckedChange={() => {
                                if (allPageSelected) setSelected(new Set());
                                else setSelected(new Set(pageItems.map((t) => t.id)));
                            }}
                        />
                        <span className="text-xs text-muted-foreground">Select all on page</span>
                    </div>
                )}

                <div className="space-y-3">
                    {loading ? (
                        <TicketsSkeleton />
                    ) : filtered.length === 0 ? (
                        <Card><CardContent className="py-8 text-center text-muted-foreground">No tickets found.</CardContent></Card>
                    ) : (
                        filtered.slice((page - 1) * pageSize, page * pageSize).map((ticket) => (
                            <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow group">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        {isAdmin && (
                                            <div className="mr-3 pt-1" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox checked={selected.has(ticket.id)} onCheckedChange={() => toggleSelect(ticket.id)} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-sm font-semibold">#{ticket.ticket_number}</span>
                                                <Badge className={statusColors[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
                                                <Badge variant="outline" className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                                                <Badge variant="outline">{(Array.isArray(applianceTypes) ? applianceTypes : DEFAULT_APPLIANCE_TYPES).find((a) => a.value === ticket.appliance_type)?.label || ticket.appliance_type}</Badge>
                                            </div>
                                            <p className="text-sm mt-2 text-foreground">{ticket.issue_description}</p>
                                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                                <span>Customer: {ticket.customers?.full_name || "—"}</span>
                                                <span>Tech: {(ticket._techNames || []).length > 0 ? ticket._techNames.join(", ") : "Unassigned"}</span>
                                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                                            {ticket.total_cost > 0 && (
                                                <span className="text-sm font-semibold">${Number(ticket.total_cost).toFixed(2)}</span>
                                            )}
                                            {isAdmin && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(ticket); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <TablePagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />

                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete ticket <strong>#{deleteTarget?.ticket_number}</strong>? This will permanently remove the ticket along with all its notes and parts records. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </ProtectedRoute>
    );
}
