"use client";

import {
  LayoutDashboard,
  Wrench,
  Users,
  HardHat,
  BarChart3,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Service Tickets", url: "/tickets", icon: Wrench },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Technicians", url: "/technicians", icon: HardHat },
  { title: "Users", url: "/users", icon: ShieldCheck },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

const techNav = [
  { title: "My Tickets", url: "/tickets", icon: Wrench },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { signOut, fullName, role } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);
  const mainNav = role === "admin" ? adminNav : techNav;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
              SM
            </div>
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground">ServicePro</h2>
              <p className="text-xs text-sidebar-foreground/60">Management</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            S
          </div>
        )}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        className={cn("hover:bg-sidebar-accent/50", active && "bg-sidebar-accent text-sidebar-primary font-medium")}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="mb-2 rounded-md bg-sidebar-accent/50 p-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{fullName || "User"}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{role || "—"}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
