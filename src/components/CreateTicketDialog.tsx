"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
];

interface CreateTicketDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: () => void;
}

export function CreateTicketDialog({ open, onOpenChange, onCreated }: CreateTicketDialogProps) {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
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
        if (!open) return;
        const load = async () => {
            const [c, t, cfg] = await Promise.all([
                supabase.from("customers").select("id, full_name, phone").order("full_name"),
                supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
                supabase.from("app_config").select("value").eq("key", "appliance_types").single(),
            ]);
            setCustomers(c.data || []);
            setTechnicians(t.data || []);
            if (cfg.data?.value) {
                let parsed = cfg.data.value;
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                if (Array.isArray(parsed)) setApplianceTypes(parsed as { value: string; label: string }[]);
            }
        };
        load();
    }, [open]);

    const resetForm = () => {
        setForm({ customer_id: "", appliance_type: "other", appliance_brand: "", appliance_model: "", issue_description: "", priority: "medium", estimated_completion: undefined, created_at: new Date(), labor_cost: "" });
        setFormTechIds([]);
        setFormErrors({});
    };

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
            onOpenChange(false);
            resetForm();
            onCreated?.();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setFormErrors({}); }}>
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
    );
}
