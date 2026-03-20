"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import { Wrench, Clock, CheckCircle, DollarSign, Plus, ArrowRight, Trophy, Medal, Award } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/RouteGuards";

interface Stats {
    newTickets: number;
    inProgress: number;
    completedToday: number;
    monthRevenue: number;
}

interface StatusCount {
    label: string;
    value: number;
    color: string;
}

const STATUS_COLORS: Record<string, { label: string; color: string }> = {
    new: { label: "New", color: "#3b82f6" },
    diagnosed: { label: "Diagnosed", color: "#a855f7" },
    in_progress: { label: "In Progress", color: "#f59e0b" },
    completed: { label: "Completed", color: "#22c55e" },
    invoiced: { label: "Invoiced", color: "#94a3b8" },
};

function DonutChart({ data }: { data: StatusCount[] }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <p className="text-sm text-muted-foreground text-center py-8">No tickets yet</p>;
    const r = 60;
    const cx = 80;
    const cy = 80;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div className="flex items-center gap-6">
            <svg width="160" height="160" viewBox="0 0 160 160">
                {data.filter(d => d.value > 0).map((d, i) => {
                    const pct = d.value / total;
                    const dash = circumference * pct;
                    const gap = circumference - dash;
                    const el = (
                        <circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke={d.color}
                            strokeWidth="24"
                            strokeDasharray={`${dash} ${gap}`}
                            strokeDashoffset={-offset}
                            transform={`rotate(-90 ${cx} ${cy})`}
                        />
                    );
                    offset += dash;
                    return el;
                })}
                <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-2xl font-bold">{total}</text>
                <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground text-xs">tickets</text>
            </svg>
            <div className="space-y-2">
                {data.filter(d => d.value > 0).map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="font-medium ml-auto">{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats>({ newTickets: 0, inProgress: 0, completedToday: 0, monthRevenue: 0 });
    const [recentTickets, setRecentTickets] = useState<any[]>([]);
    const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
    const [topTechs, setTopTechs] = useState<{ name: string; completed: number; active: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { role } = useAuth();

    useEffect(() => {
        const fetchStats = async () => {
            const today = new Date().toISOString().split("T")[0];
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

            const [newRes, progressRes, completedRes, revenueRes, recentRes] = await Promise.all([
                supabase.from("service_tickets").select("id", { count: "exact", head: true }).eq("status", "new"),
                supabase.from("service_tickets").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
                supabase.from("service_tickets").select("id", { count: "exact", head: true }).eq("status", "completed").gte("updated_at", today),
                supabase.from("service_tickets").select("total_cost").in("status", ["completed", "invoiced"]).gte("updated_at", monthStart),
                supabase.from("service_tickets").select("*, customers(full_name)").order("created_at", { ascending: false }).limit(5),
            ]);

            const revenue = (revenueRes.data || []).reduce((sum, t) => sum + Number(t.total_cost || 0), 0);
            setStats({
                newTickets: newRes.count || 0,
                inProgress: progressRes.count || 0,
                completedToday: completedRes.count || 0,
                monthRevenue: revenue,
            });
            setRecentTickets(recentRes.data || []);

            // Status breakdown for chart
            const { data: allTickets } = await supabase.from("service_tickets").select("status");
            const counts: Record<string, number> = {};
            (allTickets || []).forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
            setStatusCounts(
                Object.entries(STATUS_COLORS).map(([key, { label, color }]) => ({ label, color, value: counts[key] || 0 }))
            );

            // Top 3 technicians via junction table
            const [profilesRes, assignmentsRes] = await Promise.all([
                supabase.from("profiles").select("id, full_name"),
                supabase.from("ticket_technicians" as any).select("technician_id, ticket_id, service_tickets:ticket_id(status)"),
            ]);
            const techStats = (profilesRes.data || []).map((p) => {
                const techAssigns = (assignmentsRes.data || []).filter((a: any) => a.technician_id === p.id);
                return {
                    name: p.full_name || "Unnamed",
                    completed: techAssigns.filter((a: any) => ["completed", "invoiced"].includes(a.service_tickets?.status)).length,
                    active: techAssigns.filter((a: any) => ["new", "diagnosed", "in_progress"].includes(a.service_tickets?.status)).length,
                };
            }).filter((t) => t.completed > 0 || t.active > 0).sort((a, b) => b.completed - a.completed).slice(0, 3);
            setTopTechs(techStats);

            setLoading(false);
        };
        fetchStats();
        const channel = supabase
            .channel('dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => { fetchStats(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const statCards = [
        { title: "New Tickets", value: stats.newTickets, icon: Wrench, color: "text-info" },
        { title: "In Progress", value: stats.inProgress, icon: Clock, color: "text-warning" },
        { title: "Completed Today", value: stats.completedToday, icon: CheckCircle, color: "text-success" },
        { title: "Revenue (Month)", value: `$${stats.monthRevenue.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
    ];

    const statusColors: Record<string, string> = {
        new: "bg-info/10 text-info",
        diagnosed: "bg-purple-100 text-purple-700",
        in_progress: "bg-warning/10 text-warning",
        completed: "bg-success/10 text-success",
        invoiced: "bg-muted text-muted-foreground",
    };

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                        <p className="text-muted-foreground">Overview of your service operations</p>
                    </div>
                    <Button className="w-full sm:w-auto" onClick={() => router.push("/tickets?new=true")}>
                        <Plus className="h-4 w-4 mr-2" /> New Ticket
                    </Button>
                </div>

                {loading ? (
                    <PageSpinner label="Loading dashboard..." />
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {statCards.map((card) => (
                                <Card key={card.title}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                                        <card.icon className={`h-4 w-4 ${card.color}`} />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{card.value}</div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Ticket Status Breakdown</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <DonutChart data={statusCounts} />
                                    </CardContent>
                                </Card>

                                {topTechs.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Top Technicians</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {topTechs.map((tech, i) => {
                                                const Icon = [Trophy, Medal, Award][i] || Award;
                                                const iconColor = ["text-yellow-500", "text-muted-foreground", "text-amber-700"][i];
                                                return (
                                                    <div key={tech.name} className="flex items-center gap-3">
                                                        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                                                        <span className="text-sm font-medium flex-1 truncate">{tech.name}</span>
                                                        <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                                                            <span className="text-success font-medium">{tech.completed} done</span>
                                                            <span className="text-warning font-medium">{tech.active} active</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Recent Tickets</CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => router.push("/tickets")}>
                                        View All <ArrowRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {recentTickets.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">No tickets yet. Create your first service ticket.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {recentTickets.map((ticket) => (
                                                <div
                                                    key={ticket.id}
                                                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium">#{ticket.ticket_number}</span>
                                                            <Badge variant="secondary" className={statusColors[ticket.status] || ""}>
                                                                {ticket.status.replace("_", " ")}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground truncate mt-1">{ticket.issue_description}</p>
                                                    </div>
                                                    <div className="text-right ml-4 shrink-0">
                                                        <p className="text-xs text-muted-foreground">{ticket.customers?.full_name || "—"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
