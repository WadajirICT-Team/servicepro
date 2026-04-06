"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/page-skeletons";
import { UserPlus, Pencil, Trash2, Phone, Eye, AlertTriangle, KeyRound, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/RouteGuards";

interface Technician {
    id: string;
    user_id: string;
    full_name: string;
    phone: string | null;
    is_active: boolean;
    specializations: string[] | null;
    user_roles: { role: string }[];
    activeJobs: number;
    completedJobs: number;
}

export default function TechniciansPage() {
    const router = useRouter();
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Technician | null>(null);
    const [deleteTicketCount, setDeleteTicketCount] = useState(0);
    const [transferTechId, setTransferTechId] = useState("");
    const [editTarget, setEditTarget] = useState<Technician | null>(null);
    const [passwordTarget, setPasswordTarget] = useState<Technician | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "" });
    const [editForm, setEditForm] = useState({ full_name: "", phone: "", is_active: true });
    const [submitting, setSubmitting] = useState(false);
    const { role } = useAuth();
    const isAdmin = role === "admin";
    const [search, setSearch] = useState("");

    type SortField = "full_name" | "activeJobs" | "completedJobs";
    type SortDir = "asc" | "desc";
    const [sortField, setSortField] = useState<SortField>("full_name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortField(field); setSortDir("asc"); }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
        return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
    };



    const getAuthHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
        };
    };

    const handleChangePassword = async () => {
        if (!passwordTarget || !newPassword) return;
        if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        setSubmitting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers,
                body: JSON.stringify({ user_id: passwordTarget.user_id, new_password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to change password");
                return;
            }
            toast.success("Password changed successfully!");
            setPasswordTarget(null);
            setNewPassword("");
        } catch (err: any) {
            toast.error(err.message || "Failed to change password");
        } finally {
            setSubmitting(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        const [profilesRes, rolesRes, assignRes, ticketsRes] = await Promise.all([
            supabase.from("profiles").select("*").order("full_name"),
            supabase.from("user_roles").select("user_id, role"),
            supabase.from("ticket_technicians" as any).select("technician_id, ticket_id"),
            supabase.from("service_tickets").select("id, status"),
        ]);

        const profiles = profilesRes.data || [];
        const roles = rolesRes.data || [];
        const assigns = assignRes.data || [];
        const tickets = ticketsRes.data || [];

        const techWithCounts = profiles.map((p: any) => {
            const userRoles = roles.filter((r: any) => r.user_id === p.user_id);
            const techTicketIds = assigns.filter((a: any) => a.technician_id === p.id).map((a: any) => a.ticket_id);
            const techTickets = tickets.filter((t: any) => techTicketIds.includes(t.id));
            return {
                ...p,
                user_roles: userRoles.map((r: any) => ({ role: r.role })),
                activeJobs: techTickets.filter((t: any) => ["new", "diagnosed", "in_progress"].includes(t.status)).length,
                completedJobs: techTickets.filter((t: any) => ["completed", "invoiced"].includes(t.status)).length,
            };
        }).filter((t) => t.user_roles.some((r: { role: string }) => r.role === "technician") && !t.user_roles.some((r: { role: string }) => r.role === "admin"));
        setTechnicians(techWithCounts);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers,
                body: JSON.stringify({ email: createForm.email, password: createForm.password, full_name: createForm.full_name, role: "technician" }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to create user");
                return;
            }
            toast.success("Technician created successfully!");
            setCreateOpen(false);
            setCreateForm({ email: "", password: "", full_name: "" });
            setTimeout(fetchData, 1000);
        } catch (err: any) {
            toast.error(err.message || "Failed to create user");
        } finally {
            setSubmitting(false);
        }
    };

    const openEdit = (tech: Technician) => {
        setEditTarget(tech);
        setEditForm({ full_name: tech.full_name, phone: tech.phone || "", is_active: tech.is_active });
        setEditOpen(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .update({ full_name: editForm.full_name, phone: editForm.phone || null, is_active: editForm.is_active })
                .eq("id", editTarget.id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error("No rows updated – please refresh and try again");
            toast.success("Technician updated successfully!");
            setEditOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        } finally {
            setSubmitting(false);
        }
    };

    const initiateDelete = async (tech: Technician) => {
        const { data: assigns } = await supabase.from("ticket_technicians" as any).select("id").eq("technician_id", tech.id);
        setDeleteTicketCount((assigns || []).length);
        setTransferTechId("");
        setDeleteTarget(tech);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSubmitting(true);
        try {
            if (deleteTicketCount > 0) {
                if (!transferTechId) {
                    toast.error("Please select a technician to transfer tickets to");
                    setSubmitting(false);
                    return;
                }
                // Transfer: update technician_id in ticket_technicians
                const { error: transferError } = await supabase.from("ticket_technicians" as any).update({ technician_id: transferTechId }).eq("technician_id", deleteTarget.id);
                if (transferError) { toast.error("Failed to transfer tickets: " + transferError.message); setSubmitting(false); return; }
            }

            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/users", {
                method: "DELETE",
                headers,
                body: JSON.stringify({ user_id: deleteTarget.user_id }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to delete user");
                return;
            }
            toast.success("User deleted successfully!");
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete user");
        } finally {
            setSubmitting(false);
        }
    };

    const getRoleBadge = (roles: { role: string }[]) => {
        return roles.map((r, i) => (
            <Badge key={i} variant={r.role === "admin" ? "default" : "secondary"} className="capitalize text-xs">
                {r.role}
            </Badge>
        ));
    };


    return (
        <ProtectedRoute adminOnly>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Technicians</h1>
                        <p className="text-muted-foreground">{technicians.length} team members</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                        {isAdmin && (
                            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full sm:w-auto"><UserPlus className="h-4 w-4 mr-2" /> Add Technician</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Technician</DialogTitle>
                                        <DialogDescription>Add a new technician to the team.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleCreate} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Full Name *</Label>
                                            <Input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email *</Label>
                                            <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Password *</Label>
                                            <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required minLength={6} />
                                        </div>
                                        <Button type="submit" className="w-full" disabled={submitting}>
                                            {submitting ? "Creating..." : "Add Technician"}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <TableSkeleton columns={7} rows={6} />
                        ) : technicians.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">No team members yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                                                <span className="flex items-center">Name <SortIcon field="full_name" /></span>
                                            </TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead className="hide-mobile">Role</TableHead>
                                            <TableHead className="hide-mobile">Status</TableHead>
                                            <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("activeJobs")}>
                                                <span className="flex items-center justify-center">Active Jobs <SortIcon field="activeJobs" /></span>
                                            </TableHead>
                                            <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("completedJobs")}>
                                                <span className="flex items-center justify-center">Completed <SortIcon field="completedJobs" /></span>
                                            </TableHead>
                                            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {technicians
                                            .filter((tech) => {
                                                if (!search) return true;
                                                const q = search.toLowerCase();
                                                return tech.full_name?.toLowerCase().includes(q) || tech.phone?.toLowerCase().includes(q);
                                            })
                                            .sort((a, b) => {
                                                let cmp = 0;
                                                switch (sortField) {
                                                    case "full_name": cmp = (a.full_name || "").localeCompare(b.full_name || ""); break;
                                                    case "activeJobs": cmp = a.activeJobs - b.activeJobs; break;
                                                    case "completedJobs": cmp = a.completedJobs - b.completedJobs; break;
                                                }
                                                return sortDir === "asc" ? cmp : -cmp;
                                            })
                                            .slice((page - 1) * pageSize, page * pageSize)
                                            .map((tech) => (
                                                <TableRow key={tech.id} className="cursor-pointer" onClick={() => router.push(`/technicians/${tech.id}`)}>
                                                    <TableCell className="font-medium">{tech.full_name || "Unnamed"}</TableCell>
                                                    <TableCell>
                                                        {tech.phone ? (
                                                            <span className="flex items-center gap-1 text-sm">
                                                                <Phone className="h-3 w-3 text-muted-foreground" />
                                                                {tech.phone}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="hide-mobile">
                                                        <div className="flex gap-1 flex-wrap">{getRoleBadge(tech.user_roles || [])}</div>
                                                    </TableCell>
                                                    <TableCell className="hide-mobile">
                                                        <Badge variant={tech.is_active ? "default" : "destructive"} className="text-xs">
                                                            {tech.is_active ? "Active" : "Inactive"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold text-warning">{tech.activeJobs}</TableCell>
                                                    <TableCell className="text-center font-semibold text-success">{tech.completedJobs}</TableCell>
                                                    {isAdmin && (
                                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex justify-end gap-1">
                                                                <Button variant="ghost" size="icon" onClick={() => router.push(`/technicians/${tech.id}`)}>
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => openEdit(tech)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => { setPasswordTarget(tech); setNewPassword(""); }}>
                                                                    <KeyRound className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => initiateDelete(tech)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                    <TablePagination currentPage={page} totalItems={technicians.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
                </Card>

                {/* Edit Dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Technician</DialogTitle>
                            <DialogDescription>Update technician details.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Full Name *</Label>
                                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={editForm.is_active ? "active" : "inactive"} onValueChange={(v) => setEditForm({ ...editForm, is_active: v === "active" })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? "Saving..." : "Save Changes"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Delete / Transfer Dialog */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setTransferTechId(""); } }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                {deleteTicketCount > 0 && <AlertTriangle className="h-5 w-5 text-warning" />}
                                Delete User
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    {deleteTicketCount > 0 ? (
                                        <>
                                            <p>
                                                <strong>{deleteTarget?.full_name}</strong> has <strong>{deleteTicketCount}</strong> assigned ticket{deleteTicketCount > 1 ? "s" : ""}. You must transfer them to another technician before deleting.
                                            </p>
                                            <div className="space-y-2">
                                                <Label>Transfer tickets to *</Label>
                                                <Select value={transferTechId} onValueChange={setTransferTechId}>
                                                    <SelectTrigger><SelectValue placeholder="Select technician..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {technicians.filter((t) => t.id !== deleteTarget?.id && t.is_active).map((t) => (
                                                            <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
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
                                disabled={submitting || (deleteTicketCount > 0 && !transferTechId)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {submitting ? "Processing..." : deleteTicketCount > 0 ? "Transfer & Delete" : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Change Password Dialog */}
                <Dialog open={!!passwordTarget} onOpenChange={(open) => { if (!open) { setPasswordTarget(null); setNewPassword(""); } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                            <DialogDescription>Set a new password for <strong>{passwordTarget?.full_name}</strong>.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>New Password *</Label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 6 characters"
                                    minLength={6}
                                />
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleChangePassword}
                                disabled={submitting || newPassword.length < 6}
                            >
                                {submitting ? "Changing..." : "Change Password"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedRoute>
    );
}
