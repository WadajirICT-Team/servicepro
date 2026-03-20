import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase admin keys");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Verify the caller is an admin by reading the Bearer token from the
 * Authorization header. The token is the Supabase access_token that the
 * client-side Supabase SDK stores in localStorage.
 */
async function verifyAdmin(req: NextRequest): Promise<boolean> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return false;

    const token = authHeader.replace("Bearer ", "");
    const adminClient = createAdminClient();

    // Validate the JWT and get the user
    const { data: { user }, error } = await adminClient.auth.getUser(token);
    if (error || !user) return false;

    // Check the user's role
    const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    return roleData?.role === "admin";
}

// ─── POST: Create a new user ───
export async function POST(req: NextRequest) {
    try {
        const isAdmin = await verifyAdmin(req);
        if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

        const { email, password, full_name, role } = await req.json();
        if (!email || !password || !full_name || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const adminClient = createAdminClient();

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name },
        });

        if (authError || !authData.user) {
            return NextResponse.json({ error: authError?.message || "Failed to create user" }, { status: 400 });
        }

        const userId = authData.user.id;

        // Upsert profile (bypasses RLS via service role)
        await adminClient.from("profiles").upsert({
            id: userId,
            user_id: userId,
            full_name,
            is_active: true,
        });

        // Set role
        await adminClient.from("user_roles").upsert({
            user_id: userId,
            role: role,
        });

        return NextResponse.json({ user: authData.user });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}

// ─── PATCH: Change a user's password ───
export async function PATCH(req: NextRequest) {
    try {
        const isAdmin = await verifyAdmin(req);
        if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

        const { user_id, new_password } = await req.json();
        if (!user_id || !new_password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const adminClient = createAdminClient();
        const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}

// ─── DELETE: Delete a user ───
export async function DELETE(req: NextRequest) {
    try {
        const isAdmin = await verifyAdmin(req);
        if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

        const { user_id } = await req.json();
        if (!user_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const adminClient = createAdminClient();
        const { error } = await adminClient.auth.admin.deleteUser(user_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
