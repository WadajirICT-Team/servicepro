"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { PageSpinner } from "@/components/ui/spinner";
import { Building2, Palette, User, Cog, Save, Plus, X, KeyRound, Sun, Moon, Monitor } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/RouteGuards";

const CURRENCY_OPTIONS = [
    { value: "$", label: "$ — USD" },
    { value: "€", label: "€ — EUR" },
    { value: "£", label: "£ — GBP" },
    { value: "د.إ", label: "د.إ — AED" },
    { value: "¥", label: "¥ — JPY/CNY" },
    { value: "₹", label: "₹ — INR" },
    { value: "₺", label: "₺ — TRY" },
    { value: "R", label: "R — ZAR" },
];

// ─── Business Profile Tab ───

function BusinessProfileTab() {
    const [settings, setSettings] = useState({
        id: "",
        company_name: "",
        company_phone: "",
        company_email: "",
        company_address: "",
        currency_symbol: "$",
        tax_rate: "0",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase.from("business_settings").select("*").limit(1).single();
            if (data) {
                setSettings({
                    id: data.id,
                    company_name: data.company_name || "",
                    company_phone: data.company_phone || "",
                    company_email: data.company_email || "",
                    company_address: data.company_address || "",
                    currency_symbol: data.currency_symbol || "$",
                    tax_rate: String(data.tax_rate ?? 0),
                });
            }
            setLoading(false);
        };
        fetch();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from("business_settings")
            .update({
                company_name: settings.company_name,
                company_phone: settings.company_phone,
                company_email: settings.company_email,
                company_address: settings.company_address,
                currency_symbol: settings.currency_symbol,
                tax_rate: parseFloat(settings.tax_rate) || 0,
            })
            .eq("id", settings.id);
        if (error) toast.error(error.message);
        else toast.success("Business settings saved");
        setSaving(false);
    };

    if (loading) return <PageSpinner label="Loading business settings..." />;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                    <CardDescription>This information appears on printed invoices.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} placeholder="e.g. ServicePro Repairs" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={settings.company_phone} onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })} placeholder="+1 555-1234" />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={settings.company_email} onChange={(e) => setSettings({ ...settings, company_email: e.target.value })} placeholder="info@company.com" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Address</Label>
                        <Textarea value={settings.company_address} onChange={(e) => setSettings({ ...settings, company_address: e.target.value })} placeholder="Street, City, Country" rows={2} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Financial Defaults</CardTitle>
                    <CardDescription>Currency and tax settings used across the application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Currency Symbol</Label>
                            <Select value={settings.currency_symbol} onValueChange={(v) => setSettings({ ...settings, currency_symbol: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CURRENCY_OPTIONS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tax Rate (%)</Label>
                            <Input type="number" step="0.01" min={0} max={100} value={settings.tax_rate} onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })} placeholder="0" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Business Settings"}
            </Button>
        </div>
    );
}

// ─── Appearance Tab ───

function AppearanceTab() {
    const { theme, setTheme } = useTheme();

    const themes = [
        { value: "light", label: "Light", icon: Sun, desc: "Clean and bright interface" },
        { value: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes" },
        { value: "system", label: "System", icon: Monitor, desc: "Match your device settings" },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Choose how the application looks.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {themes.map((t) => (
                        <button
                            key={t.value}
                            onClick={() => setTheme(t.value)}
                            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary/50 ${theme === t.value ? "border-primary bg-primary/5" : "border-border"
                                }`}
                        >
                            <t.icon className={`h-6 w-6 ${theme === t.value ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-sm font-medium ${theme === t.value ? "text-primary" : ""}`}>{t.label}</span>
                            <span className="text-xs text-muted-foreground text-center">{t.desc}</span>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── My Account Tab ───

function MyAccountTab() {
    const { user, fullName, profileId } = useAuth();
    const [draft, setDraft] = useState({ full_name: "", phone: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetch = async () => {
            const { data } = await supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).single();
            if (data) setDraft({ full_name: data.full_name || "", phone: data.phone || "" });
            setLoading(false);
        };
        fetch();
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from("profiles")
            .update({ full_name: draft.full_name, phone: draft.phone || null })
            .eq("user_id", user!.id);
        if (error) toast.error(error.message);
        else toast.success("Profile updated");
        setSaving(false);
    };

    if (loading) return <PageSpinner label="Loading profile..." />;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Update your personal information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={user?.email || ""} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Optional" />
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Profile"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Manage your account password.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline" onClick={() => setPwOpen(true)}>
                        <KeyRound className="h-4 w-4 mr-2" /> Change Password
                    </Button>
                    <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
                </CardContent>
            </Card>
        </div>
    );
}

// ─── System Configuration Tab ───

function SystemConfigTab() {
    const [categories, setCategories] = useState<string[]>([]);
    const [applianceTypes, setApplianceTypes] = useState<{ value: string; label: string }[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [newApplianceValue, setNewApplianceValue] = useState("");
    const [newApplianceLabel, setNewApplianceLabel] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase.from("app_config").select("key, value");
            if (data) {
                const catRow = data.find((d: any) => d.key === "expense_categories");
                const appRow = data.find((d: any) => d.key === "appliance_types");
                if (catRow) setCategories(catRow.value as unknown as string[]);
                if (appRow) setApplianceTypes(appRow.value as unknown as { value: string; label: string }[]);
            }
            setLoading(false);
        };
        fetch();
    }, []);

    const addCategory = () => {
        const trimmed = newCategory.trim().toLowerCase();
        if (!trimmed || categories.includes(trimmed)) return;
        setCategories([...categories, trimmed]);
        setNewCategory("");
    };

    const removeCategory = (cat: string) => {
        setCategories(categories.filter((c) => c !== cat));
    };

    const addApplianceType = () => {
        const val = newApplianceValue.trim().toLowerCase().replace(/\s+/g, "_");
        const lbl = newApplianceLabel.trim();
        if (!val || !lbl || applianceTypes.some((a) => a.value === val)) return;
        setApplianceTypes([...applianceTypes, { value: val, label: lbl }]);
        setNewApplianceValue("");
        setNewApplianceLabel("");
    };

    const removeApplianceType = (val: string) => {
        setApplianceTypes(applianceTypes.filter((a) => a.value !== val));
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = [
            supabase.from("app_config").update({ value: JSON.stringify(categories) }).eq("key", "expense_categories"),
            supabase.from("app_config").update({ value: JSON.stringify(applianceTypes) }).eq("key", "appliance_types"),
        ];
        const results = await Promise.all(updates);
        const error = results.find((r) => r.error)?.error;
        if (error) toast.error(error.message);
        else toast.success("Configuration saved");
        setSaving(false);
    };

    if (loading) return <PageSpinner label="Loading configuration..." />;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Expense Categories</CardTitle>
                    <CardDescription>Manage the categories available when recording expenses.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => (
                            <Badge key={cat} variant="secondary" className="gap-1 capitalize pr-1">
                                {cat}
                                <button onClick={() => removeCategory(cat)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="New category name..."
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addCategory()}
                            className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={addCategory} disabled={!newCategory.trim()}>
                            <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Appliance Types</CardTitle>
                    <CardDescription>Manage the appliance types available when creating service tickets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {applianceTypes.map((a) => (
                            <Badge key={a.value} variant="secondary" className="gap-1 pr-1">
                                {a.label}
                                <button onClick={() => removeApplianceType(a.value)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Display label (e.g. Water Heater)"
                            value={newApplianceLabel}
                            onChange={(e) => setNewApplianceLabel(e.target.value)}
                            className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={addApplianceType} disabled={!newApplianceLabel.trim()}>
                            <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Configuration"}
            </Button>
        </div>
    );
}

// ─── Main Settings Page ───

export default function SettingsPage() {
    const { role } = useAuth();
    const isAdmin = role === "admin";

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-muted-foreground">Manage your account, business profile, and application settings.</p>
                </div>

                <Tabs defaultValue={isAdmin ? "business" : "appearance"} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                        {isAdmin && (
                            <TabsTrigger value="business" className="gap-2">
                                <Building2 className="h-4 w-4" />
                                <span className="hidden sm:inline">Business</span>
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="appearance" className="gap-2">
                            <Palette className="h-4 w-4" />
                            <span className="hidden sm:inline">Appearance</span>
                        </TabsTrigger>
                        <TabsTrigger value="account" className="gap-2">
                            <User className="h-4 w-4" />
                            <span className="hidden sm:inline">My Account</span>
                        </TabsTrigger>
                        {isAdmin && (
                            <TabsTrigger value="system" className="gap-2">
                                <Cog className="h-4 w-4" />
                                <span className="hidden sm:inline">System</span>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {isAdmin && (
                        <TabsContent value="business">
                            <BusinessProfileTab />
                        </TabsContent>
                    )}

                    <TabsContent value="appearance">
                        <AppearanceTab />
                    </TabsContent>

                    <TabsContent value="account">
                        <MyAccountTab />
                    </TabsContent>

                    {isAdmin && (
                        <TabsContent value="system">
                            <SystemConfigTab />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </ProtectedRoute>
    );
}
