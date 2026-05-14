import type { OrgPlan, OrgRole } from "@workspace/contracts";
import type { auth } from "../auth";
import type { attendeeAuth } from "../auth/attendee";

export type SessionUser = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session.session;
export type AttendeeSessionUser = typeof attendeeAuth.$Infer.Session.user;
export type AttendeeSession = typeof attendeeAuth.$Infer.Session.session;

export type AttendeeEnv = {
  Variables: {
    attendeeUser: AttendeeSessionUser;
    attendeeSession: AttendeeSession;
  };
};

export type { OrgPlan } from "@workspace/contracts";

export interface AuthOrg {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  plan: OrgPlan;
}

export type ApiEnv = {
  Variables: {
    user: SessionUser;
    session: Session;
    orgId: string;
    memberRole: OrgRole;
    org: AuthOrg;
  };
};
