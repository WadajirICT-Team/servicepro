"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Plus, Trash2, Printer, CalendarIcon, Undo2, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import InvoicePrint from "@/components/InvoicePrint";
import { ProtectedRoute } from "@/components/RouteGuards";

const STATUSES = ["new", "diagnosed", "in_progress", "completed", "invoiced"] as const;

export default function TicketDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { user, role } = useAuth();
    const isAdmin = role === "admin";
    const [ticket, setTicket] = useState<any>(null);
    const [notes, setNotes] = useState<any[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [assignedTechIds, setAssignedTechIds] = useState<string[]>([]);
    const [newNote, setNewNote] = useState("");
    const [newPart, setNewPart] = useState({ part_name: "", quantity: 1, unit_cost: 0 });
    const [showInvoice, setShowInvoice] = useState(false);

    // Buffered edits
    const [draft, setDraft] = useState<Record<string, any>>({});
    const [originalValues, setOriginalValues] = useState<Record<string, any>>({});

    const fetchAll = async () => {
        if (!id) return;
        const [ticketRes, notesRes, partsRes, techRes, assignedRes] = await Promise.all([
            supabase.from("service_tickets").select("*, customers(*)").eq("id", id).single(),
            supabase.from("ticket_notes").select("*, profiles:user_id(full_name)").eq("ticket_id", id).order("created_at", { ascending: false }),
            supabase.from("parts_used").select("*").eq("ticket_id", id).order("created_at"),
            supabase.from("profiles").select("id, full_name").eq("is_active", true),
            supabase.from("ticket_technicians" as any).select("technician_id").eq("ticket_id", id),
        ]);
        if (ticketRes.data) {
            setTicket(ticketRes.data);
            setOriginalValues({
                status: ticketRes.data.status,
                diagnosis: ticketRes.data.diagnosis || "",
                labor_cost: ticketRes.data.labor_cost || 0,
                estimated_completion: ticketRes.data.estimated_completion || "",
            });
            setDraft({
                status: ticketRes.data.status,
                diagnosis: ticketRes.data.diagnosis || "",
                labor_cost: ticketRes.data.labor_cost || 0,
                estimated_completion: ticketRes.data.estimated_completion || "",
            });
        }
        setNotes(notesRes.data || []);
        setParts(partsRes.data || []);
        setTechnicians(techRes.data || []);
        setAssignedTechIds((assignedRes.data || []).map((r: any) => r.technician_id));
    };

    useEffect(() => {
        fetchAll();
        if (!id) return;
        const channel = supabase
            .channel(`ticket-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `id=eq.${id}` }, () => { fetchAll(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'parts_used', filter: `ticket_id=eq.${id}` }, () => { fetchAll(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id]);

    const hasChanges = useMemo(() => {
        return Object.keys(originalValues).some(k => String(draft[k]) !== String(originalValues[k]));
    }, [draft, originalValues]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (hasChanges) { e.preventDefault(); }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [hasChanges]);

    const handleCancel = () => {
        setDraft({ ...originalValues });
    };

    const handleUpdate = async () => {
        const updates: Record<string, any> = {};
        for (const k of Object.keys(originalValues)) {
            if (String(draft[k]) !== String(originalValues[k])) {
                updates[k] = draft[k] || null;
            }
        }
        // Recalculate total_cost if labor changed
        if ('labor_cost' in updates) {
            updates.total_cost = Number(updates.labor_cost || 0) + partsTotal;
        }
        const { error } = await supabase.from("service_tickets").update(updates).eq("id", id!);
        if (error) toast.error(error.message);
        else { toast.success("Ticket updated"); fetchAll(); }
    };

    const toggleTechnician = async (techId: string) => {
        if (assignedTechIds.includes(techId)) {
            const { error } = await supabase.from("ticket_technicians" as any).delete().eq("ticket_id", id!).eq("technician_id", techId);
            if (error) toast.error(error.message);
            else { setAssignedTechIds((prev) => prev.filter((t) => t !== techId)); toast.success("Technician removed"); }
        } else {
            const { error } = await supabase.from("ticket_technicians" as any).insert({ ticket_id: id!, technician_id: techId });
            if (error) toast.error(error.message);
            else { setAssignedTechIds((prev) => [...prev, techId]); toast.success("Technician assigned"); }
        }
    };

    const addNote = async () => {
        if (!newNote.trim()) return;
        const { error } = await supabase.from("ticket_notes").insert({ ticket_id: id!, user_id: user!.id, content: newNote });
        if (error) toast.error(error.message);
        else { setNewNote(""); fetchAll(); }
    };

    const addPart = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from("parts_used").insert({ ticket_id: id!, ...newPart });
        if (error) toast.error(error.message);
        else {
            setNewPart({ part_name: "", quantity: 1, unit_cost: 0 });
            // Recalculate total cost
            const { data: updatedParts } = await supabase.from("parts_used").select("total_cost").eq("ticket_id", id!);
            const newPartsTotal = (updatedParts || []).reduce((s, p) => s + Number(p.total_cost || 0), 0);
            await supabase.from("service_tickets").update({ total_cost: Number(draft.labor_cost || 0) + newPartsTotal }).eq("id", id!);
            fetchAll();
        }
    };

    const deletePart = async (partId: string) => {
        await supabase.from("parts_used").delete().eq("id", partId);
        // Recalculate total cost
        const { data: updatedParts } = await supabase.from("parts_used").select("total_cost").eq("ticket_id", id!);
        const newPartsTotal = (updatedParts || []).reduce((s, p) => s + Number(p.total_cost || 0), 0);
        await supabase.from("service_tickets").update({ total_cost: Number(draft.labor_cost || 0) + newPartsTotal }).eq("id", id!);
        fetchAll();
    };

    if (!ticket) return <ProtectedRoute><div className="p-6 text-muted-foreground">Loading...</div></ProtectedRoute>;

    const partsTotal = parts.reduce((sum, p) => sum + Number(p.total_cost || 0), 0);

    if (showInvoice) {
        return <ProtectedRoute><InvoicePrint ticket={ticket} parts={parts} partsTotal={partsTotal} onBack={() => setShowInvoice(false)} /></ProtectedRoute>;
    }

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/tickets")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold truncate">Ticket #{ticket.ticket_number}</h1>
                            <p className="text-muted-foreground truncate">{ticket.customers?.full_name || "No customer"}</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {(ticket.status === "completed" || ticket.status === "invoiced") && (
                            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowInvoice(true)}>
                                <Printer className="h-4 w-4 mr-2" /> Invoice
                            </Button>
                        )}
                        {hasChanges && (
                            <>
                                <Button className="w-full sm:w-auto" variant="outline" onClick={handleCancel}>
                                    <Undo2 className="h-4 w-4 mr-2" /> Cancel
                                </Button>
                                <Button className="w-full sm:w-auto" onClick={handleUpdate}>
                                    <Save className="h-4 w-4 mr-2" /> Update
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Status</Label>
                                        <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Assigned Technicians</Label>
                                        {assignedTechIds.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {assignedTechIds.map((tid) => {
                                                    const t = technicians.find((x) => x.id === tid);
                                                    return t ? <Badge key={tid} variant="secondary">{t.full_name}</Badge> : null;
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground mt-1">No technicians assigned</p>
                                        )}
                                        {isAdmin && (
                                            <div className="mt-2 space-y-1 max-h-[150px] overflow-y-auto">
                                                {technicians.map((t) => (
                                                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                                        <Checkbox checked={assignedTechIds.includes(t.id)} onCheckedChange={() => toggleTechnician(t.id)} />
                                                        {t.full_name}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Appliance</Label>
                                    <p className="text-sm">{ticket.appliance_type?.replace("_", " ")} {ticket.appliance_brand && `— ${ticket.appliance_brand}`} {ticket.appliance_model && ticket.appliance_model}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Issue Description</Label>
                                    <p className="text-sm">{ticket.issue_description}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Diagnosis</Label>
                                    <Textarea
                                        value={draft.diagnosis}
                                        onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })}
                                        placeholder="Add diagnosis..."
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Estimated Completion</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !draft.estimated_completion && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {draft.estimated_completion ? format(new Date(draft.estimated_completion), "PPP") : "Pick a date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={draft.estimated_completion ? new Date(draft.estimated_completion) : undefined}
                                                onSelect={(d) => setDraft({ ...draft, estimated_completion: d ? format(d, "yyyy-MM-dd") : "" })}
                                                initialFocus
                                                className="p-3 pointer-events-auto"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Parts */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Parts Used</CardTitle>
                                <span className="text-sm font-semibold">Total: ${partsTotal.toFixed(2)}</span>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {parts.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                                        <span>{p.part_name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-muted-foreground">{p.quantity} × ${Number(p.unit_cost).toFixed(2)}</span>
                                            <span className="font-medium">${Number(p.total_cost).toFixed(2)}</span>
                                            {isAdmin && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deletePart(p.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>}
                                        </div>
                                    </div>
                                ))}
                                <form onSubmit={addPart} className="flex gap-2 items-end">
                                    <Input placeholder="Part name" className="flex-1" value={newPart.part_name} onChange={(e) => setNewPart({ ...newPart, part_name: e.target.value })} required />
                                    <Input type="number" placeholder="Qty" className="w-16" min={1} value={newPart.quantity} onChange={(e) => setNewPart({ ...newPart, quantity: Number(e.target.value) })} />
                                    <Input type="number" placeholder="Cost" className="w-24" step="0.01" min={0} value={newPart.unit_cost} onChange={(e) => setNewPart({ ...newPart, unit_cost: Number(e.target.value) })} />
                                    <Button type="submit" size="sm"><Plus className="h-4 w-4" /></Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card>
                            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Textarea placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} className="flex-1" />
                                    <Button onClick={addNote} disabled={!newNote.trim()} className="self-end">Add</Button>
                                </div>
                                <Separator />
                                {notes.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No notes yet.</p>
                                ) : (
                                    notes.map((note) => (
                                        <div key={note.id} className="border rounded-md p-3">
                                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                <span className="font-medium">{(note as any).profiles?.full_name || "Unknown"}</span>
                                                <span>{new Date(note.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm">{note.content}</p>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Costs</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Parts</span>
                                    <span>${partsTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-muted-foreground">Labor</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="w-24 text-right h-7"
                                        value={draft.labor_cost}
                                        onChange={(e) => setDraft({ ...draft, labor_cost: Number(e.target.value) })}
                                    />
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold">
                                    <span>Total</span>
                                    <span>${(Number(draft.labor_cost || 0) + partsTotal).toFixed(2)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Customer Info</CardTitle></CardHeader>
                            <CardContent className="space-y-1 text-sm">
                                {ticket.customers ? (
                                    <>
                                        <p className="font-medium">{ticket.customers.full_name}</p>
                                        <p className="text-muted-foreground">{ticket.customers.phone}</p>
                                        {ticket.customers.email && <p className="text-muted-foreground">{ticket.customers.email}</p>}
                                        {ticket.customers.address && <p className="text-muted-foreground">{ticket.customers.address}</p>}
                                    </>
                                ) : (
                                    <p className="text-muted-foreground">No customer linked</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
                            <CardContent className="space-y-1 text-sm text-muted-foreground">
                                <p>Created: {new Date(ticket.created_at).toLocaleString()}</p>
                                <p>Updated: {new Date(ticket.updated_at).toLocaleString()}</p>
                                {draft.estimated_completion && <p>Est. Completion: {new Date(draft.estimated_completion).toLocaleDateString()}</p>}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
