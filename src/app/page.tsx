"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import {
    Wrench,
    Clock,
    CheckCircle,
    DollarSign,
    Plus,
    ArrowRight,
    Trophy,
    Medal,
    Award,
} from "lucide-react";
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

interface TechnicianRanking {
    id: string;
    name: string;
    completed: number;
    active: number;
    rank: number;
    isMe: boolean;
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

    if (total === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-8">
                No tickets yet
            </p>
        );
    }

    const r = 60;
    const cx = 80;
    const cy = 80;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div className="flex items-center gap-6">
            <svg width="160" height="160" viewBox="0 0 160 160">
                {data
                    .filter((d) => d.value > 0)
                    .map((d, i) => {
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

                <text
                    x={cx}
                    y={cy - 6}
                    textAnchor="middle"
                    className="fill-foreground text-2xl font-bold"
                >
                    {total}
                </text>
                <text
                    x={cx}
                    y={cy + 14}
                    textAnchor="middle"
                    className="fill-muted-foreground text-xs"
                >
                    tickets
                </text>
            </svg>

            <div className="space-y-2">
                {data
                    .filter((d) => d.value > 0)
                    .map((d) => (
                        <div key={d.label} className="flex items-center gap-2 text-sm">
                            <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: d.color }}
                            />
                            <span className="text-muted-foreground">{d.label}</span>
                            <span className="font-medium ml-auto">{d.value}</span>
                        </div>
                    ))}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats>({
        newTickets: 0,
        inProgress: 0,
        completedToday: 0,
        monthRevenue: 0,
    });

    const [recentTickets, setRecentTickets] = useState<any[]>([]);
    const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
    const [topTechs, setTopTechs] = useState<TechnicianRanking[]>([]);
    const [loading, setLoading] = useState(true);

    const router = useRouter();
    const { role, user } = useAuth();

    useEffect(() => {
        const fetchStats = async () => {
            if (!role || !user?.id) return;

            setLoading(true);

            try {
                const today = new Date().toISOString().split("T")[0];
                const monthStart = new Date(
                    new Date().getFullYear(),
                    new Date().getMonth(),
                    1
                ).toISOString();

                // =========================
                // ADMIN DASHBOARD
                // =========================
                if (role === "admin") {
                    const [
                        newRes,
                        progressRes,
                        completedRes,
                        revenueRes,
                        recentRes,
                        rankingsRes,
                    ] = await Promise.all([
                        supabase
                            .from("service_tickets")
                            .select("id", { count: "exact", head: true })
                            .eq("status", "new"),

                        supabase
                            .from("service_tickets")
                            .select("id", { count: "exact", head: true })
                            .in("status", ["diagnosed", "in_progress"]),

                        supabase
                            .from("service_tickets")
                            .select("id", { count: "exact", head: true })
                            .in("status", ["completed", "invoiced"])
                            .gte("updated_at", today),

                        supabase
                            .from("service_tickets")
                            .select("total_cost")
                            .in("status", ["completed", "invoiced"])
                            .gte("updated_at", monthStart),

                        supabase
                            .from("service_tickets")
                            .select("*, customers(full_name)")
                            .order("created_at", { ascending: false })
                            .limit(5),

                        supabase.rpc("get_technician_rankings"),
                    ]);

                    const revenue = (revenueRes.data || []).reduce(
                        (sum, t) => sum + Number(t.total_cost || 0),
                        0
                    );

                    setStats({
                        newTickets: newRes.count || 0,
                        inProgress: progressRes.count || 0,
                        completedToday: completedRes.count || 0,
                        monthRevenue: revenue,
                    });

                    setRecentTickets(recentRes.data || []);

                    const { data: allTickets } = await supabase
                        .from("service_tickets")
                        .select("status");

                    const counts: Record<string, number> = {};
                    (allTickets || []).forEach((t) => {
                        counts[t.status] = (counts[t.status] || 0) + 1;
                    });

                    setStatusCounts(
                        Object.entries(STATUS_COLORS).map(([key, { label, color }]) => ({
                            label,
                            color,
                            value: counts[key] || 0,
                        }))
                    );

                    if (rankingsRes.error) {
                        console.error("Ranking RPC error:", rankingsRes.error);
                        setTopTechs([]);
                    } else {
                        const rankings = (rankingsRes.data || []) as TechnicianRanking[];
                        setTopTechs(rankings);
                    }
                }

                // =========================
                // TECHNICIAN DASHBOARD
                // =========================
                else if (role === "technician") {
                    const { data: profileData, error: profileError } = await supabase
                        .from("profiles")
                        .select("id, full_name")
                        .eq("user_id", user.id)
                        .single();

                    if (profileError || !profileData) {
                        console.error("Technician profile not found:", profileError);
                        setStats({
                            newTickets: 0,
                            inProgress: 0,
                            completedToday: 0,
                            monthRevenue: 0,
                        });
                        setRecentTickets([]);
                        setStatusCounts(
                            Object.entries(STATUS_COLORS).map(([key, { label, color }]) => ({
                                label,
                                color,
                                value: 0,
                            }))
                        );
                        setTopTechs([]);
                        setLoading(false);
                        return;
                    }

                    const technicianProfileId = profileData.id;

                    const [{ data: assignedRows, error: assignError }, rankingsRes] =
                        await Promise.all([
                            supabase
                                .from("ticket_technicians" as any)
                                .select("ticket_id")
                                .eq("technician_id", technicianProfileId),

                            supabase.rpc("get_technician_rankings"),
                        ]);

                    if (assignError) {
                        console.error("Assignment fetch error:", assignError);
                    }

                    if (rankingsRes.error) {
                        console.error("Ranking RPC error:", rankingsRes.error);
                        setTopTechs([]);
                    } else {
                        const rankings = (rankingsRes.data || []) as TechnicianRanking[];
                        setTopTechs(rankings);
                    }

                    const myTicketIds = (assignedRows || []).map((row: any) => row.ticket_id);

                    if (myTicketIds.length === 0) {
                        setStats({
                            newTickets: 0,
                            inProgress: 0,
                            completedToday: 0,
                            monthRevenue: 0,
                        });
                        setRecentTickets([]);
                        setStatusCounts(
                            Object.entries(STATUS_COLORS).map(([key, { label, color }]) => ({
                                label,
                                color,
                                value: 0,
                            }))
                        );
                        setLoading(false);
                        return;
                    }

                    const { data: myTickets, error: ticketsError } = await supabase
                        .from("service_tickets")
                        .select("*, customers(full_name)")
                        .in("id", myTicketIds)
                        .order("created_at", { ascending: false });

                    if (ticketsError) {
                        console.error("Technician tickets fetch error:", ticketsError);
                    }

                    const tickets = myTickets || [];

                    const newTickets = tickets.filter((t) => t.status === "new").length;

                    const inProgress = tickets.filter((t) =>
                        ["diagnosed", "in_progress"].includes(t.status)
                    ).length;

                    const completedToday = tickets.filter(
                        (t) =>
                            ["completed", "invoiced"].includes(t.status) &&
                            t.updated_at?.startsWith(today)
                    ).length;

                    const monthRevenue = tickets
                        .filter(
                            (t) =>
                                ["completed", "invoiced"].includes(t.status) &&
                                new Date(t.updated_at) >= new Date(monthStart)
                        )
                        .reduce((sum, t) => sum + Number(t.total_cost || 0), 0);

                    setStats({
                        newTickets,
                        inProgress,
                        completedToday,
                        monthRevenue,
                    });

                    setRecentTickets(tickets.slice(0, 5));

                    const counts: Record<string, number> = {};
                    tickets.forEach((t) => {
                        counts[t.status] = (counts[t.status] || 0) + 1;
                    });

                    setStatusCounts(
                        Object.entries(STATUS_COLORS).map(([key, { label, color }]) => ({
                            label,
                            color,
                            value: counts[key] || 0,
                        }))
                    );
                }
            } catch (error) {
                console.error("Dashboard fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();

        const channel = supabase
            .channel("dashboard-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "service_tickets" },
                () => {
                    fetchStats();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [role, user]);

    const statCards = [
        {
            title: role === "technician" ? "My New Tickets" : "New Tickets",
            value: stats.newTickets,
            icon: Wrench,
            color: "text-info",
        },
        {
            title: role === "technician" ? "My In Progress" : "In Progress",
            value: stats.inProgress,
            icon: Clock,
            color: "text-warning",
        },
        {
            title: role === "technician" ? "My Completed Today" : "Completed Today",
            value: stats.completedToday,
            icon: CheckCircle,
            color: "text-success",
        },
        {
            title: role === "technician" ? "My Revenue (Month)" : "Revenue (Month)",
            value: `$${stats.monthRevenue.toLocaleString()}`,
            icon: DollarSign,
            color: "text-primary",
        },
    ];

    const statusColors: Record<string, string> = {
        new: "bg-info/10 text-info",
        diagnosed: "bg-purple-100 text-purple-700",
        in_progress: "bg-warning/10 text-warning",
        completed: "bg-success/10 text-success",
        invoiced: "bg-muted text-muted-foreground",
    };

    const myRanking = topTechs.find((tech) => tech.isMe);

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {role === "technician" ? "My Dashboard" : "Dashboard"}
                        </h1>
                        <p className="text-muted-foreground">
                            {role === "technician"
                                ? "Overview of your assigned service work"
                                : "Overview of your service operations"}
                        </p>
                    </div>

                    <Button
                        className="w-full sm:w-auto"
                        onClick={() => router.push("/tickets?new=true")}
                    >
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
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            {card.title}
                                        </CardTitle>
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
                                        <CardTitle>
                                            {role === "technician"
                                                ? "My Ticket Status Breakdown"
                                                : "Ticket Status Breakdown"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <DonutChart data={statusCounts} />
                                    </CardContent>
                                </Card>

                                {role === "admin" && topTechs.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">
                                                Top Technicians
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {topTechs.slice(0, 3).map((tech, i) => {
                                                const Icon = [Trophy, Medal, Award][i] || Award;
                                                const iconColor = [
                                                    "text-yellow-500",
                                                    "text-muted-foreground",
                                                    "text-amber-700",
                                                ][i];

                                                return (
                                                    <div
                                                        key={tech.id}
                                                        className="flex items-center gap-3"
                                                    >
                                                        <Icon
                                                            className={`h-4 w-4 shrink-0 ${iconColor}`}
                                                        />
                                                        <span className="text-sm font-medium flex-1 truncate">
                                                            {tech.name}
                                                        </span>
                                                        <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                                                            <span className="text-success font-medium">
                                                                {tech.completed} done
                                                            </span>
                                                            <span className="text-warning font-medium">
                                                                {tech.active} active
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                )}

                                {role === "technician" && myRanking && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">My Ranking</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-4 rounded-lg border p-4">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                                                    #{myRanking.rank}
                                                </div>

                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold">{myRanking.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Your current technician ranking
                                                    </p>
                                                </div>

                                                <div className="flex gap-4 text-sm shrink-0">
                                                    <span className="text-success font-medium">
                                                        {myRanking.completed} done
                                                    </span>
                                                    <span className="text-warning font-medium">
                                                        {myRanking.active} active
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>
                                        {role === "technician" ? "My Recent Tickets" : "Recent Tickets"}
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push("/tickets")}
                                    >
                                        View All <ArrowRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </CardHeader>

                                <CardContent>
                                    {recentTickets.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">
                                            {role === "technician"
                                                ? "You have no assigned tickets yet."
                                                : "No tickets yet. Create your first service ticket."}
                                        </p>
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
                                                            <span className="text-sm font-medium">
                                                                #{ticket.ticket_number}
                                                            </span>
                                                            <Badge
                                                                variant="secondary"
                                                                className={statusColors[ticket.status] || ""}
                                                            >
                                                                {ticket.status.replace("_", " ")}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground truncate mt-1">
                                                            {ticket.issue_description}
                                                        </p>
                                                    </div>

                                                    <div className="text-right ml-4 shrink-0">
                                                        <p className="text-xs text-muted-foreground">
                                                            {ticket.customers?.full_name || "—"}
                                                        </p>
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