"use client";

import { useEffect, useState } from "react";
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
import { UserPlus, Pencil, Trash2, KeyRound, Search, ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck, Mail, Phone } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/RouteGuards";

interface AppUser {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    is_active: boolean;
    role: string;
    profile_id: string | null;
    created_at: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
    const [editTarget, setEditTarget] = useState<AppUser | null>(null);
    const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "", role: "technician" });
    const [editForm, setEditForm] = useState({ full_name: "", phone: "", is_active: true });
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState("");
    const { user: currentUser } = useAuth();

    type SortField = "full_name" | "email" | "role" | "created_at";
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

    const fetchUsers = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/users", { headers });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to load users");
                setLoading(false);
                return;
            }
            setUsers(data.users || []);
        } catch (err: any) {
            toast.error(err.message || "Failed to load users");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
        // Real-time subscription for profile changes
        const channel = supabase
            .channel("users-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { fetchUsers(); })
            .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => { fetchUsers(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    email: createForm.email,
                    password: createForm.password,
                    full_name: createForm.full_name,
                    role: createForm.role,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to create user");
                return;
            }
            toast.success("User created successfully!");
            setCreateOpen(false);
            setCreateForm({ email: "", password: "", full_name: "", role: "technician" });
            setTimeout(fetchUsers, 1000);
        } catch (err: any) {
            toast.error(err.message || "Failed to create user");
        } finally {
            setSubmitting(false);
        }
    };

    const openEdit = (user: AppUser) => {
        setEditTarget(user);
        setEditForm({
            full_name: user.full_name,
            phone: user.phone || "",
            is_active: user.is_active,
        });
        setEditOpen(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setSubmitting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    user_id: editTarget.id,
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                    is_active: editForm.is_active,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to update user");
                return;
            }
            toast.success("User updated successfully!");
            setEditOpen(false);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || "Failed to update user");
        } finally {
            setSubmitting(false);
        }
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
                body: JSON.stringify({ user_id: passwordTarget.id, new_password: newPassword }),
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

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSubmitting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/users", {
                method: "DELETE",
                headers,
                body: JSON.stringify({ user_id: deleteTarget.id }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to delete user");
                return;
            }
            toast.success("User deleted successfully!");
            setDeleteTarget(null);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete user");
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = users
        .filter((u) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                u.full_name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.phone?.toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "full_name": cmp = (a.full_name || "").localeCompare(b.full_name || ""); break;
                case "email": cmp = (a.email || "").localeCompare(b.email || ""); break;
                case "role": cmp = (a.role || "").localeCompare(b.role || ""); break;
                case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });

    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    const getRoleBadge = (role: string) => {
        if (role === "admin") return <Badge variant="default" className="capitalize text-xs">Admin</Badge>;
        return <Badge variant="secondary" className="capitalize text-xs">Technician</Badge>;
    };

    const getStatusBadge = (active: boolean) => {
        return <Badge variant={active ? "default" : "destructive"} className="text-xs">{active ? "Active" : "Inactive"}</Badge>;
    };

    return (
        <ProtectedRoute adminOnly>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Users</h1>
                        <p className="text-muted-foreground">{users.length} system users</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full sm:w-auto"><UserPlus className="h-4 w-4 mr-2" /> Add User</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add User</DialogTitle>
                                    <DialogDescription>Create a new system user account.</DialogDescription>
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
                                    <div className="space-y-2">
                                        <Label>Role *</Label>
                                        <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="technician">Technician</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={submitting}>
                                        {submitting ? "Creating..." : "Add User"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name, email, or phone..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>

                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <TableSkeleton columns={7} rows={6} />
                        ) : filtered.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No users found.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("full_name")}>
                                                <span className="flex items-center">Name <SortIcon field="full_name" /></span>
                                            </TableHead>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")}>
                                                <span className="flex items-center">Email <SortIcon field="email" /></span>
                                            </TableHead>
                                            <TableHead className="hide-mobile">Phone</TableHead>
                                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("role")}>
                                                <span className="flex items-center">Role <SortIcon field="role" /></span>
                                            </TableHead>
                                            <TableHead className="hide-mobile">Status</TableHead>
                                            <TableHead className="cursor-pointer select-none hide-mobile" onClick={() => toggleSort("created_at")}>
                                                <span className="flex items-center">Created <SortIcon field="created_at" /></span>
                                            </TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paged.map((u) => {
                                            const isSelf = u.id === currentUser?.id;
                                            return (
                                                <TableRow key={u.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {u.full_name || "Unnamed"}
                                                            {isSelf && <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                                            <Mail className="h-3 w-3 shrink-0" />
                                                            <span className="truncate max-w-[180px]">{u.email}</span>
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="hide-mobile">
                                                        {u.phone ? (
                                                            <span className="flex items-center gap-1 text-sm">
                                                                <Phone className="h-3 w-3 text-muted-foreground" />
                                                                {u.phone}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                                                    <TableCell className="hide-mobile">{getStatusBadge(u.is_active)}</TableCell>
                                                    <TableCell className="text-muted-foreground hide-mobile">
                                                        {new Date(u.created_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Edit user">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => { setPasswordTarget(u); setNewPassword(""); }} title="Reset password">
                                                                <KeyRound className="h-4 w-4" />
                                                            </Button>
                                                            {!isSelf && (
                                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(u)} title="Delete user">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
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
                            <DialogTitle>Edit User</DialogTitle>
                            <DialogDescription>Update user details.</DialogDescription>
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

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to permanently delete <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email})? This action cannot be undone and will remove their profile, role, and authentication data.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={submitting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {submitting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Change Password Dialog */}
                <Dialog open={!!passwordTarget} onOpenChange={(open) => { if (!open) { setPasswordTarget(null); setNewPassword(""); } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reset Password</DialogTitle>
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
                                {submitting ? "Changing..." : "Reset Password"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedRoute>
    );
}
