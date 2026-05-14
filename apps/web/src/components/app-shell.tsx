import { Link, useLocation, useNavigate, type LinkProps } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { BUSINESS_NAME } from "@/lib/branding";
import { currentOrgQueryOptions, sessionQueryOptions } from "@/queries/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeft,
  Settings,
  Ticket,
  User,
  Users,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: string;
  /** Actions rendered on the right side of the page header. Passed from the main content component. */
  headerActions?: React.ReactNode;
}

const workspaceNavItems = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Events", to: "/admin/events", icon: Ticket },
  { label: "Calendar", to: "/admin/calendar", icon: CalendarDays },
  { label: "Resources", to: "/admin/resources", icon: ListChecks },
  { label: "Attendees", to: "/admin/attendees", icon: Users },
] as const;

function navItemClasses(collapsed: boolean, itemHeight: string, active: boolean) {
  const base = `flex items-center gap-3 rounded-lg text-sm transition-colors ${itemHeight} ${
    collapsed ? "justify-center px-2" : "px-3"
  }`;
  const state = active
    ? "border border-ring bg-background text-foreground shadow-xs"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";
  return `${base} ${state}`;
}

interface SidebarBodyProps {
  collapsed: boolean;
  itemHeight: "h-9" | "h-11";
  pathname: string;
  orgSlug: string | null;
  email: string | null;
  onSignOut: () => void;
}

function SidebarBody({
  collapsed,
  itemHeight,
  pathname,
  orgSlug,
  email,
  onSignOut,
}: SidebarBodyProps) {
  const settingsPath = orgSlug ? `/admin/${orgSlug}/settings` : null;

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
        {workspaceNavItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={navItemClasses(collapsed, itemHeight, active)}
            >
              <Icon className="size-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {orgSlug && (
          <Link
            to="/admin/$orgSlug/settings"
            params={{ orgSlug }}
            title="Organization settings"
            aria-label={collapsed ? "Organization settings" : undefined}
            aria-current={pathname === settingsPath ? "page" : undefined}
            className={navItemClasses(collapsed, itemHeight, pathname === settingsPath)}
          >
            <Settings className="size-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">Organization settings</span>}
          </Link>
        )}
      </nav>

      <div className="flex flex-col gap-2 border-t px-2 py-3">
        <Link
          to="/settings"
          title={email ?? "User settings"}
          aria-label={collapsed ? "User settings" : undefined}
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={navItemClasses(collapsed, itemHeight, pathname === "/settings")}
        >
          <span className="flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-3xs text-background">
            {email ? email[0]?.toUpperCase() : <User className="size-3" />}
          </span>
          {!collapsed && <span className="truncate">User settings</span>}
        </Link>
        <Button
          variant="ghost"
          title="Sign out"
          aria-label="Sign out"
          onClick={onSignOut}
          className={`${itemHeight} gap-3 px-3 text-muted-foreground hover:text-foreground ${
            collapsed ? "justify-center" : "justify-start"
          }`}
        >
          <LogOut className="size-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">Sign out</span>}
        </Button>
      </div>
    </>
  );
}

export function AppShell({ children, title, description, headerActions }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQueryOptions);
  const { data: orgContext } = useQuery(currentOrgQueryOptions);
  const email = session?.user.email ?? null;
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("sidebar-collapsed", String(next));
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20 text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <aside
        aria-label="Workspace navigation"
        className={`hidden md:flex ${collapsed ? "w-14" : "w-64"} flex-shrink-0 flex-col border-r bg-sidebar transition-all duration-200`}
      >
        {/** @philosophy The sidebar header never has a bottom border. Visual separation from nav items is handled by whitespace. Never add border-bottom here. */}
        {!collapsed ? (
          <div className="flex h-12 w-full items-center justify-between px-3">
            <Link
              to="/admin"
              title="Dashboard"
              className="flex size-8 items-center justify-center rounded-lg border bg-background text-sm font-semibold shadow-xs transition-colors hover:bg-muted"
            >
              B
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tracking-[-0.02em]">{BUSINESS_NAME}</p>
              {orgContext?.org.name && (
                <p className="truncate text-xs text-muted-foreground">{orgContext.org.name}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              aria-expanded={true}
            >
              <PanelLeft className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex h-12 w-full items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={toggleSidebar}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              aria-expanded={false}
            >
              <PanelLeft className="size-4" />
            </Button>
          </div>
        )}

        <SidebarBody
          collapsed={collapsed}
          itemHeight="h-9"
          pathname={location.pathname}
          orgSlug={orgContext?.org.slug ?? null}
          email={email}
          onSignOut={handleSignOut}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <div className="flex h-12 w-full items-center gap-2 px-3">
              <Link
                to="/admin"
                title="Dashboard"
                className="flex size-8 items-center justify-center rounded-lg border bg-background text-sm font-semibold shadow-xs transition-colors hover:bg-muted"
              >
                B
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-[-0.02em]">{BUSINESS_NAME}</p>
                {orgContext?.org.name && (
                  <p className="truncate text-xs text-muted-foreground">{orgContext.org.name}</p>
                )}
              </div>
            </div>

            <SidebarBody
              collapsed={false}
              itemHeight="h-11"
              pathname={location.pathname}
              orgSlug={orgContext?.org.slug ?? null}
              email={email}
              onSignOut={handleSignOut}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/** @philosophy The main page header never has a bottom border. The separation between header and content is created by whitespace and visual hierarchy, not lines. Never add border-bottom here. */}
        <header className="flex h-12 flex-shrink-0 items-center justify-between bg-background/90 px-3 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="size-5" />
            </Button>
            <div className="flex min-w-0 items-center">
              {title && (
                <h1 className="flex min-w-0 items-center text-sm font-medium tracking-[-0.02em]">
                  {title}
                </h1>
              )}
              {description && <p className="sr-only">{description}</p>}
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </header>

        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-4 pb-10 sm:px-8 lg:pt-6 lg:pb-14"
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

/**
 * @philosophy Page header pattern.
 *
 * Detail/sub-pages render their breadcrumb trail in the AppShell `title` slot
 * using these helpers. The convention is:
 *
 *   [circular back button] [parent links] / [parent links] / [current page]
 *
 * Rules:
 *   1. The back button is a small circular icon-only `PageBackButton` placed
 *      at the very start. It points to the immediate parent, not always the
 *      list root. The browser back button is not a substitute — back must be
 *      a deterministic in-app navigation.
 *   2. Intermediate items are real `<Link>`s using the default header text
 *      style (medium weight). They must be navigable.
 *   3. The trailing/current item uses `PageBreadcrumbCurrent` which renders
 *      muted, regular-weight text. It is never a link. Marking the current
 *      page bold is redundant — the page itself is the heading.
 *   4. The org name is never appended to the trail. Org context lives in the
 *      sidebar header and on the user/org switcher; repeating it here is
 *      noise.
 *   5. Top-level pages (Events list, Attendees list, etc.) pass a plain
 *      string `title` instead of a breadcrumb — no back button, no trail.
 *
 * Render order in title:
 *   <PageBreadcrumb>
 *     <PageBackButton to="..." label="..." />
 *     <Link to="...">Parent</Link>
 *     <PageBreadcrumbSeparator />
 *     <PageBreadcrumbCurrent>Current page</PageBreadcrumbCurrent>
 *   </PageBreadcrumb>
 */
export function PageBreadcrumb({ children }: { children: ReactNode }) {
  return <span className="flex min-w-0 items-center gap-2">{children}</span>;
}

export function PageBreadcrumbSeparator() {
  return <span className="shrink-0 text-muted-foreground">/</span>;
}

/**
 * Trailing/current breadcrumb item. Muted and non-bold to differentiate from
 * upstream parent links.
 */
export function PageBreadcrumbCurrent({ children }: { children: ReactNode }) {
  return <span className="min-w-0 truncate font-normal text-muted-foreground">{children}</span>;
}

/**
 * Circular back button rendered before breadcrumbs on detail pages.
 */
export function PageBackButton({ label = "Back", ...linkProps }: LinkProps & { label?: string }) {
  return (
    <Button
      render={<Link {...linkProps} />}
      variant="outline"
      size="icon-sm"
      className="shrink-0 rounded-full shadow-sm"
      aria-label={label}
    >
      <ArrowLeft className="size-3.5" />
    </Button>
  );
}
