"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";

export function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
    const { user, loading, role } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.replace("/login");
            } else if (adminOnly && role === "technician") {
                router.replace("/tickets");
            }
        }
    }, [user, loading, role, adminOnly, router]);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
    if (!user) return null;
    if (adminOnly && role === "technician") return null;

    return <AppLayout>{children}</AppLayout>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.replace("/");
        }
    }, [user, loading, router]);

    if (loading) return null;
    if (user) return null;

    return <>{children}</>;
}
