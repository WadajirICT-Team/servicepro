"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Phone, Mail, MapPin, FileText, Pencil, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/RouteGuards";

const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    diagnosed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    invoiced: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function CustomerDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [customer, setCustomer] = useState<any>(null);
    const [tickets, setTickets] = useState<any[]>([]);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ full_name: "", phone: "", email: "", address: "", notes: "" });
    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const clearError = (field: string) => {
        setFormErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        const name = draft.full_name.trim();
        if (!name) {
            errors.full_name = "Full name is required";
        } else if (!/^[a-zA-Z\s]+$/.test(name)) {
            errors.full_name = "Name must contain letters only (no numbers or special characters)";
        } else if (name.length < 2 || name.length > 50) {
            errors.full_name = "Name must be 2–50 characters";
        } else if (/\s{2,}/.test(name)) {
            errors.full_name = "Name cannot have consecutive spaces";
        }
        const phone = draft.phone.trim();
        if (!phone) {
            errors.phone = "Phone number is required";
        } else if (!/^[0-9+\-\s()]+$/.test(phone)) {
            errors.phone = "Phone must contain numbers only";
        }
        if (!draft.address.trim()) {
            errors.address = "Address is required";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const fetchData = async () => {
        if (!id) return;
        const [custRes, ticketsRes] = await Promise.all([
            supabase.from("customers").select("*").eq("id", id).single(),
            supabase.from("service_tickets").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
        ]);
        if (custRes.data) {
            setCustomer(custRes.data);
            setDraft({
                full_name: custRes.data.full_name,
                phone: custRes.data.phone,
                email: custRes.data.email || "",
                address: custRes.data.address || "",
                notes: custRes.data.notes || "",
            });
        }

        const rawTickets = ticketsRes.data || [];
        if (rawTickets.length > 0) {
            const ticketIds = rawTickets.map((t: any) => t.id);
            const { data: assigns } = await supabase
                .from("ticket_technicians" as any)
                .select("ticket_id, technician_id, profiles:technician_id(full_name)")
                .in("ticket_id", ticketIds);

            const assignments = assigns || [];
            setTickets(
                rawTickets.map((t: any) => ({
                    ...t,
                    _techNames: assignments
                        .filter((a: any) => a.ticket_id === t.id)
                        .map((a: any) => a.profiles?.full_name || "Unknown"),
                })),
            );
        } else {
            setTickets([]);
        }
    };

    useEffect(() => { fetchData(); }, [id]);

    const handleSave = async () => {
        if (!validateForm()) return;
        setSubmitting(true);
        const { error } = await supabase.from("customers").update({
            full_name: draft.full_name.trim(),
            phone: draft.phone.trim(),
            email: draft.email || null,
            address: draft.address.trim() || null,
            notes: draft.notes || null,
        }).eq("id", id!);
        if (error) toast.error(error.message);
        else { toast.success("Customer updated"); setEditing(false); setFormErrors({}); fetchData(); }
        setSubmitting(false);
    };

    const handleCancel = () => {
        if (customer) {
            setDraft({
                full_name: customer.full_name,
                phone: customer.phone,
                email: customer.email || "",
                address: customer.address || "",
                notes: customer.notes || "",
            });
        }
        setEditing(false);
        setFormErrors({});
    };

    if (!customer) return <ProtectedRoute adminOnly><div className="p-6 text-muted-foreground">Loading...</div></ProtectedRoute>;

    const activeTickets = tickets.filter(t => ["new", "diagnosed", "in_progress"].includes(t.status)).length;
    const totalSpent = tickets.reduce((sum, t) => sum + Number(t.total_cost || 0), 0);

    return (
        <ProtectedRoute adminOnly>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/customers")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">{customer.full_name}</h1>
                            <p className="text-muted-foreground">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {editing ? (
                            <>
                                <Button variant="outline" onClick={handleCancel} disabled={submitting}>
                                    <Undo2 className="h-4 w-4 mr-2" /> Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={submitting}>
                                    <Save className="h-4 w-4 mr-2" /> {submitting ? "Saving..." : "Save"}
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => setEditing(true)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Profile Info */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {editing ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Full Name * <span className="text-xs text-muted-foreground font-normal">(letters only, 2–50 chars)</span></Label>
                                            <Input value={draft.full_name} onChange={(e) => { setDraft({ ...draft, full_name: e.target.value }); clearError("full_name"); }} className={formErrors.full_name ? "border-destructive" : ""} />
                                            {formErrors.full_name && <p className="text-xs text-destructive">{formErrors.full_name}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone * <span className="text-xs text-muted-foreground font-normal">(numbers only)</span></Label>
                                            <Input value={draft.phone} onChange={(e) => { setDraft({ ...draft, phone: e.target.value }); clearError("phone"); }} className={formErrors.phone ? "border-destructive" : ""} />
                                            {formErrors.phone && <p className="text-xs text-destructive">{formErrors.phone}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Address *</Label>
                                            <Textarea value={draft.address} onChange={(e) => { setDraft({ ...draft, address: e.target.value }); clearError("address"); }} rows={2} className={formErrors.address ? "border-destructive" : ""} />
                                            {formErrors.address && <p className="text-xs text-destructive">{formErrors.address}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Notes</Label>
                                            <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <span>{customer.phone}</span>
                                        </div>
                                        {customer.email && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <span>{customer.email}</span>
                                            </div>
                                        )}
                                        {customer.address && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                <span>{customer.address}</span>
                                            </div>
                                        )}
                                        {customer.notes && (
                                            <div className="flex items-start gap-2 text-sm">
                                                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <span className="text-muted-foreground">{customer.notes}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Tickets</span>
                                    <span className="font-semibold">{tickets.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Active Tickets</span>
                                    <span className="font-semibold">{activeTickets}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Spent</span>
                                    <span className="font-semibold">${totalSpent.toFixed(2)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tickets */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader><CardTitle>Service History</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                {tickets.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">No service tickets yet.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>#</TableHead>
                                                <TableHead>Appliance</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Technician</TableHead>
                                                <TableHead>Cost</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tickets.map((t) => (
                                                <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/tickets/${t.id}`)}>
                                                    <TableCell className="font-medium">#{t.ticket_number}</TableCell>
                                                    <TableCell className="capitalize">{t.appliance_type?.replace("_", " ")}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={statusColors[t.status] || ""}>
                                                            {t.status?.replace("_", " ")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {(t._techNames || []).length > 0 ? (t._techNames || []).join(", ") : "Unassigned"}
                                                    </TableCell>
                                                    <TableCell>${Number(t.total_cost || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
