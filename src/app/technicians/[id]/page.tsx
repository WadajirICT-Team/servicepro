"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { ArrowLeft, Phone, Mail, Pencil, Save, Undo2, Wrench, CheckCircle, Clock, Trophy } from "lucide-react";
import { TechnicianDetailSkeleton } from "@/components/ui/page-skeletons";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/RouteGuards";

const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    diagnosed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    invoiced: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function TechnicianDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { role } = useAuth();
    const isAdmin = role === "admin";
    const [profile, setProfile] = useState<any>(null);
    const [userRole, setUserRole] = useState<string>("");
    const [tickets, setTickets] = useState<any[]>([]);
    const [ranking, setRanking] = useState<{ byCompleted: number; byRevenue: number; total: number } | null>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ full_name: "", phone: "" });
    const [submitting, setSubmitting] = useState(false);
    const [ticketPage, setTicketPage] = useState(1);
    const [ticketPageSize, setTicketPageSize] = useState(10);

    const fetchData = async () => {
        if (!id) return;
        const [profileRes, assignsRes, allAssignsRes, allTicketsRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", id).single(),
            supabase.from("ticket_technicians" as any).select("ticket_id").eq("technician_id", id),
            supabase.from("ticket_technicians" as any).select("technician_id, ticket_id"),
            supabase.from("service_tickets").select("*, customers(full_name)").order("created_at", { ascending: false }),
        ]);
        if (profileRes.data) {
            setProfile(profileRes.data);
            setDraft({ full_name: profileRes.data.full_name, phone: profileRes.data.phone || "" });
            const { data: specificRole } = await supabase.from("user_roles").select("role").eq("user_id", profileRes.data.user_id).single();
            if (specificRole) setUserRole(specificRole.role);
        }
        // Get tickets assigned to this tech
        const myTicketIds = (assignsRes.data || []).map((a: any) => a.ticket_id);
        setTickets((allTicketsRes.data || []).filter((t: any) => myTicketIds.includes(t.id)));

        // Compute ranking among all technicians
        const allAssigns = allAssignsRes.data || [];
        const allTickets = allTicketsRes.data || [];
        const techStats: Record<string, { completed: number; revenue: number }> = {};
        for (const a of allAssigns as any[]) {
            const t = allTickets.find((tk: any) => tk.id === a.ticket_id);
            if (!t) continue;
            if (!techStats[a.technician_id]) techStats[a.technician_id] = { completed: 0, revenue: 0 };
            if (["completed", "invoiced"].includes(t.status)) techStats[a.technician_id].completed++;
            techStats[a.technician_id].revenue += Number(t.total_cost || 0);
        }
        if (!techStats[id]) techStats[id] = { completed: 0, revenue: 0 };
        const allIds = Object.keys(techStats);
        const sortedByCompleted = [...allIds].sort((a, b) => techStats[b].completed - techStats[a].completed);
        const sortedByRevenue = [...allIds].sort((a, b) => techStats[b].revenue - techStats[a].revenue);
        setRanking({
            byCompleted: sortedByCompleted.indexOf(id) + 1,
            byRevenue: sortedByRevenue.indexOf(id) + 1,
            total: allIds.length,
        });
    };

    useEffect(() => { fetchData(); }, [id]);

    const handleSave = async () => {
        setSubmitting(true);
        const { error } = await supabase.from("profiles").update({
            full_name: draft.full_name,
            phone: draft.phone || null,
        }).eq("id", id!);
        if (error) toast.error(error.message);
        else { toast.success("Profile updated"); setEditing(false); fetchData(); }
        setSubmitting(false);
    };

    const handleCancel = () => {
        if (profile) setDraft({ full_name: profile.full_name, phone: profile.phone || "" });
        setEditing(false);
    };

    if (!profile) return <ProtectedRoute><TechnicianDetailSkeleton /></ProtectedRoute>;

    const activeTickets = tickets.filter(t => ["new", "diagnosed", "in_progress"].includes(t.status));
    const completedTickets = tickets.filter(t => ["completed", "invoiced"].includes(t.status));
    const totalRevenue = tickets.reduce((sum, t) => sum + Number(t.total_cost || 0), 0);

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/technicians")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                                <Badge variant={profile.is_active ? "default" : "destructive"} className="text-xs">
                                    {profile.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {userRole && (
                                    <Badge variant={userRole === "admin" ? "default" : "secondary"} className="capitalize text-xs">
                                        {userRole}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground">Member since {new Date(profile.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    {isAdmin && (
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
                    )}
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Profile */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {editing ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Full Name *</Label>
                                            <Input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone</Label>
                                            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {profile.phone && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{profile.phone}</span>
                                            </div>
                                        )}
                                        {!profile.phone && (
                                            <p className="text-sm text-muted-foreground">No phone number</p>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="h-4 w-4" /> Active Jobs
                                    </span>
                                    <span className="font-semibold">{activeTickets.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <CheckCircle className="h-4 w-4" /> Completed
                                    </span>
                                    <span className="font-semibold">{completedTickets.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Wrench className="h-4 w-4" /> Total Tickets
                                    </span>
                                    <span className="font-semibold">{tickets.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total Revenue</span>
                                    <span className="font-semibold">${totalRevenue.toFixed(2)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {ranking && (
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Ranking</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">By Completed Jobs</span>
                                        <Badge variant="secondary" className="font-semibold">
                                            #{ranking.byCompleted} / {ranking.total}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">By Revenue</span>
                                        <Badge variant="secondary" className="font-semibold">
                                            #{ranking.byRevenue} / {ranking.total}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Assigned Tickets */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader><CardTitle>Assigned Tickets</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                {tickets.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">No tickets assigned yet.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>#</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Appliance</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Cost</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tickets.slice((ticketPage - 1) * ticketPageSize, ticketPage * ticketPageSize).map((t) => (
                                                <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/tickets/${t.id}`)}>
                                                    <TableCell className="font-medium">#{t.ticket_number}</TableCell>
                                                    <TableCell>{t.customers?.full_name || "—"}</TableCell>
                                                    <TableCell className="capitalize">{t.appliance_type?.replace("_", " ")}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={statusColors[t.status] || ""}>
                                                            {t.status?.replace("_", " ")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>${Number(t.total_cost || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                            <TablePagination currentPage={ticketPage} totalItems={tickets.length} pageSize={ticketPageSize} onPageChange={setTicketPage} onPageSizeChange={setTicketPageSize} />
                        </Card>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
