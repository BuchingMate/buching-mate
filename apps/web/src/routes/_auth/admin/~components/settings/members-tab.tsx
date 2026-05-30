import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrgRole } from "@workspace/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { canInviteMembers } from "@/lib/permissions";
import { authKeys, currentOrgQueryOptions } from "@/queries/auth";
import { orgKeys, orgSeatUsageQueryOptions } from "@/queries/org";

const INVITE_ROLES: OrgRole[] = ["admin", "manager", "viewer"];

// Roles that consume a paid seat. Kept in sync with the server's SEATED_ROLES.
const SEATED_ROLES: OrgRole[] = ["owner", "admin"];

export function MembersTab({ role }: { role: OrgRole }) {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(currentOrgQueryOptions);
  const seatsQuery = useQuery(orgSeatUsageQueryOptions);
  const orgId = orgQuery.data?.org.id;
  const canInvite = canInviteMembers(role);

  const seats = seatsQuery.data;
  const seatsFull = seats != null && seats.cap != null && seats.used >= seats.cap;

  const [members, setMembers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("manager");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<OrgRole | "all">("all");

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    const res = await authClient.organization.getFullOrganization({
      query: { organizationId: orgId },
    });
    setMembers(res.data?.members ?? []);
    setLoaded(true);
  }, [orgId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) {
      setError("Organization not loaded");
      return;
    }
    setLoading(true);
    setError("");

    const result = await authClient.organization.inviteMember({
      email: inviteEmail,
      role: inviteRole as "owner" | "admin" | "member",
      organizationId: orgId,
    });

    if (result.error) {
      setError(result.error.message ?? "Unable to send invitation");
    } else {
      setInviteEmail("");
      setInviteRole("manager");
      void loadMembers();
      void queryClient.invalidateQueries({ queryKey: authKeys.currentOrg });
      void queryClient.invalidateQueries({ queryKey: orgKeys.seats() });
    }

    setLoading(false);
  };

  const filtered = members.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.user.email ?? "").toLowerCase().includes(q) ||
      (m.user.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Invite teammates and manage their roles.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {seats && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {seats.cap == null
              ? `${seats.used} admin seats used`
              : `${seats.used} of ${seats.cap} admin seats used`}
          </p>
        )}
        {canInvite && (
          <form onSubmit={handleInvite} className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="flex-1"
                aria-label="Invite email"
              />
              <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as OrgRole)}>
                <SelectTrigger aria-label="Invite role" className="sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} disabled={seatsFull && SEATED_ROLES.includes(r)}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send invite"}
              </Button>
            </div>
            {seatsFull && (
              <p className="text-xs text-muted-foreground">
                No admin seats left ({seats?.used} of {seats?.cap}). Manager and viewer invites are
                always free; buy more seats to add another admin.
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name"
            className="flex-1"
            aria-label="Search members"
          />
          <Select
            value={roleFilter}
            onValueChange={(v) => v && setRoleFilter(v as OrgRole | "all")}
          >
            <SelectTrigger aria-label="Filter by role" className="sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              {INVITE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members match.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.user.email}</p>
                  {member.user.name && (
                    <p className="truncate text-sm text-muted-foreground">{member.user.name}</p>
                  )}
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-xs">{member.role}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
