"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Activity, Trophy, Medal, Award } from "lucide-react";
import { ProtectedRoute } from "@/components/RouteGuards";

const COLORS = ["hsl(215, 80%, 50%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)"];

export default function ReportsPage() {
    const [period, setPeriod] = useState("30");
    const [tickets, setTickets] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const since = new Date();
            since.setDate(since.getDate() - Number(period));
            const sinceStr = since.toISOString();

            const [ticketRes, expenseRes, profileRes, assignRes] = await Promise.all([
                supabase.from("service_tickets").select("*").gte("created_at", sinceStr),
                supabase.from("expenses").select("*").gte("expense_date", since.toISOString().split("T")[0]),
                supabase.from("profiles").select("*"),
                supabase.from("ticket_technicians" as any).select("technician_id, ticket_id"),
            ]);
            setTickets(ticketRes.data || []);
            setExpenses(expenseRes.data || []);
            setProfiles(profileRes.data || []);
            setAssignments(assignRes.data || []);
        };
        fetchData();
    }, [period]);

    // Financial calculations
    const completedTickets = tickets.filter((t) => ["completed", "invoiced"].includes(t.status));
    const totalRevenue = completedTickets.reduce((sum, t) => sum + Number(t.total_cost || 0), 0);
    const totalLaborRevenue = completedTickets.reduce((sum, t) => sum + Number(t.labor_cost || 0), 0);
    const totalPartsRevenue = totalRevenue - totalLaborRevenue;
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const profit = totalRevenue - totalExpenses;

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    expenses.forEach((e) => {
        expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount || 0);
    });

    // Status distribution
    const statusCounts = ["new", "diagnosed", "in_progress", "completed", "invoiced"]
        .map((s) => ({ name: s.replace("_", " "), value: tickets.filter((t) => t.status === s).length }))
        .filter((s) => s.value > 0);

    // Appliance type distribution
    const applianceCounts: Record<string, number> = {};
    tickets.forEach((t) => {
        const label = (t.appliance_type || "other").replace("_", " ");
        applianceCounts[label] = (applianceCounts[label] || 0) + 1;
    });
    const applianceData = Object.entries(applianceCounts).map(([name, value]) => ({ name, value }));

    // Revenue by week
    const revenueByWeek: Record<string, number> = {};
    completedTickets.forEach((t) => {
        const week = new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        revenueByWeek[week] = (revenueByWeek[week] || 0) + Number(t.total_cost || 0);
    });
    const revenueChartData = Object.entries(revenueByWeek).map(([date, revenue]) => ({ date, revenue }));

    // Technician rankings via junction table
    const techRankings = profiles.map((p) => {
        const techTicketIds = assignments.filter((a: any) => a.technician_id === p.id).map((a: any) => a.ticket_id);
        const techTickets = tickets.filter((t) => techTicketIds.includes(t.id));
        const completed = techTickets.filter((t) => ["completed", "invoiced"].includes(t.status));
        const revenue = completed.reduce((s, t) => s + Number(t.total_cost || 0), 0);
        const avgTime = completed.length > 0
            ? completed.reduce((s, t) => {
                const created = new Date(t.created_at).getTime();
                const updated = new Date(t.updated_at).getTime();
                return s + (updated - created) / (1000 * 60 * 60 * 24);
            }, 0) / completed.length
            : 0;
        return {
            id: p.id,
            name: p.full_name,
            totalAssigned: techTickets.length,
            completed: completed.length,
            revenue,
            avgDays: Math.round(avgTime * 10) / 10,
            completionRate: techTickets.length > 0 ? Math.round((completed.length / techTickets.length) * 100) : 0,
        };
    }).filter((t) => t.totalAssigned > 0).sort((a, b) => b.completed - a.completed);

    const rankIcons = [Trophy, Medal, Award];
    const rankColors = ["text-yellow-500", "text-muted-foreground", "text-amber-700"];
    const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <ProtectedRoute adminOnly>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
                        <p className="text-muted-foreground">Financial reports, analytics, and team performance</p>
                    </div>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                            <SelectItem value="365">Last year</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                            <TrendingUp className="h-4 w-4 text-success" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold text-success">{fmt(totalRevenue)}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
                            <TrendingDown className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold text-destructive">{fmt(totalExpenses)}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent><div className={`text-2xl font-bold ${profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(profit)}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
                            <Activity className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{tickets.length}</div></CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="income">Income Statement</TabsTrigger>
                        <TabsTrigger value="rankings">Technician Rankings</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card>
                                <CardHeader><CardTitle>Revenue Over Time</CardTitle></CardHeader>
                                <CardContent>
                                    {revenueChartData.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">No revenue data for this period.</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={revenueChartData}>
                                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                                <YAxis tick={{ fontSize: 12 }} />
                                                <Tooltip />
                                                <Bar dataKey="revenue" fill="hsl(215, 80%, 50%)" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Tickets by Status</CardTitle></CardHeader>
                                <CardContent>
                                    {statusCounts.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">No ticket data.</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie data={statusCounts} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                                                    {statusCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                            <Card className="lg:col-span-2">
                                <CardHeader><CardTitle>Tickets by Appliance Type</CardTitle></CardHeader>
                                <CardContent>
                                    {applianceData.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">No data.</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={applianceData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                                <XAxis type="number" />
                                                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                                <Tooltip />
                                                <Bar dataKey="value" fill="hsl(152, 60%, 42%)" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Income Statement Tab */}
                    <TabsContent value="income" className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Income Statement</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60%]">Item</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="font-semibold bg-muted/30">
                                            <TableCell>Revenue</TableCell>
                                            <TableCell className="text-right text-success">{fmt(totalRevenue)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="pl-8">Labor Revenue</TableCell>
                                            <TableCell className="text-right">{fmt(totalLaborRevenue)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="pl-8">Parts & Materials Revenue</TableCell>
                                            <TableCell className="text-right">{fmt(totalPartsRevenue)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="pl-8">Completed Jobs</TableCell>
                                            <TableCell className="text-right">{completedTickets.length}</TableCell>
                                        </TableRow>

                                        <TableRow className="font-semibold bg-muted/30">
                                            <TableCell>Expenses</TableCell>
                                            <TableCell className="text-right text-destructive">{fmt(totalExpenses)}</TableCell>
                                        </TableRow>
                                        {Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                                            <TableRow key={cat}>
                                                <TableCell className="pl-8 capitalize">{cat}</TableCell>
                                                <TableCell className="text-right">{fmt(amount)}</TableCell>
                                            </TableRow>
                                        ))}

                                        <TableRow className="font-bold text-lg border-t-2">
                                            <TableCell>Net Profit</TableCell>
                                            <TableCell className={`text-right ${profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(profit)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="text-muted-foreground">Profit Margin</TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {totalRevenue > 0 ? `${Math.round((profit / totalRevenue) * 100)}%` : "N/A"}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Technician Rankings Tab */}
                    <TabsContent value="rankings" className="space-y-6">
                        {techRankings.length === 0 ? (
                            <Card><CardContent className="py-8 text-center text-muted-foreground">No technician data for this period.</CardContent></Card>
                        ) : (
                            <>
                                {/* Top 3 Podium */}
                                <div className="grid gap-4 md:grid-cols-3">
                                    {techRankings.slice(0, 3).map((tech, i) => {
                                        const Icon = rankIcons[i] || Award;
                                        return (
                                            <Card key={tech.id} className={i === 0 ? "border-yellow-400/50 bg-yellow-50/30 dark:bg-yellow-900/10" : ""}>
                                                <CardContent className="pt-6 text-center space-y-2">
                                                    <Icon className={`h-8 w-8 mx-auto ${rankColors[i]}`} />
                                                    <h3 className="font-semibold text-lg">{tech.name}</h3>
                                                    <p className="text-sm text-muted-foreground">#{i + 1} Ranked</p>
                                                    <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground">Completed</p>
                                                            <p className="font-bold text-lg">{tech.completed}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Revenue</p>
                                                            <p className="font-bold text-lg">{fmt(tech.revenue)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Avg Days</p>
                                                            <p className="font-bold">{tech.avgDays}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Rate</p>
                                                            <p className="font-bold">{tech.completionRate}%</p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>

                                {/* Full Rankings Table */}
                                <Card>
                                    <CardHeader><CardTitle>Full Rankings</CardTitle></CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">#</TableHead>
                                                    <TableHead>Technician</TableHead>
                                                    <TableHead className="text-center">Assigned</TableHead>
                                                    <TableHead className="text-center">Completed</TableHead>
                                                    <TableHead className="text-center">Rate</TableHead>
                                                    <TableHead className="text-center">Avg Days</TableHead>
                                                    <TableHead className="text-right">Revenue</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {techRankings.map((tech, i) => (
                                                    <TableRow key={tech.id}>
                                                        <TableCell className="font-bold">{i + 1}</TableCell>
                                                        <TableCell className="font-medium">{tech.name}</TableCell>
                                                        <TableCell className="text-center">{tech.totalAssigned}</TableCell>
                                                        <TableCell className="text-center">{tech.completed}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary" className={tech.completionRate >= 80 ? "bg-success/10 text-success" : tech.completionRate >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}>
                                                                {tech.completionRate}%
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">{tech.avgDays}d</TableCell>
                                                        <TableCell className="text-right font-medium">{fmt(tech.revenue)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </ProtectedRoute>
    );
}
