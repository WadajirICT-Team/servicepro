import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ─── Dashboard Skeleton ───

export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-20" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts + Recent Tickets */}
            <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                    {/* Donut chart card */}
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-48" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-6">
                                <Skeleton className="h-[160px] w-[160px] rounded-full" />
                                <div className="space-y-3 flex-1">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Skeleton className="h-3 w-3 rounded-full" />
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-3 w-6 ml-auto" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top technicians card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <Skeleton className="h-5 w-36" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent tickets card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-8 w-20" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-10" />
                                            <Skeleton className="h-5 w-20 rounded-full" />
                                        </div>
                                        <Skeleton className="h-3 w-3/4" />
                                    </div>
                                    <Skeleton className="h-3 w-20 ml-4" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ─── Tickets List Skeleton ───

export function TicketsSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Skeleton className="h-4 w-12" />
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                    <Skeleton className="h-5 w-24 rounded-full" />
                                </div>
                                <Skeleton className="h-4 w-5/6" />
                                <div className="flex gap-4 mt-2">
                                    <Skeleton className="h-3 w-28" />
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                            <Skeleton className="h-6 w-16 ml-4" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ─── Table Skeleton (Customers, Expenses, Technicians) ───

export function TableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
    return (
        <div className="table-responsive">
            <div className="w-full">
                {/* Header */}
                <div className="flex items-center border-b px-4 py-3 gap-4">
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" style={{ maxWidth: i === 0 ? 180 : 120 }} />
                    ))}
                </div>
                {/* Rows */}
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex items-center border-b px-4 py-3 gap-4">
                        {Array.from({ length: columns }).map((_, c) => (
                            <Skeleton key={c} className="h-4 flex-1" style={{ maxWidth: c === 0 ? 180 : 120 }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Expenses Page Skeleton ───

export function ExpensesSkeleton() {
    return (
        <>
            {/* Stat cards at top */}
            <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-24" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table card */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-28" />
                </CardHeader>
                <CardContent className="p-0">
                    <TableSkeleton columns={5} rows={6} />
                </CardContent>
            </Card>
        </>
    );
}

// ─── Reports Page Skeleton ───

export function ReportsSkeleton() {
    return (
        <>
            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-24" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <div className="space-y-4">
                <Skeleton className="h-10 w-80 rounded-md" />
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-40" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[300px] w-full rounded-md" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-36" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[300px] w-full rounded-md" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

// ─── Settings Tab Skeleton ───

export function SettingsTabSkeleton() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-10 w-full rounded-md" />
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Technician Detail Skeleton ───

export function TechnicianDetailSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-28" />
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="pt-6 text-center space-y-2">
                            <Skeleton className="h-8 w-12 mx-auto" />
                            <Skeleton className="h-4 w-20 mx-auto" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-36" />
                </CardHeader>
                <CardContent className="p-0">
                    <TableSkeleton columns={4} rows={5} />
                </CardContent>
            </Card>
        </div>
    );
}
