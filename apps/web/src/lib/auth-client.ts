import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { polarClient } from "@polar-sh/better-auth";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:3456",
  plugins: [organizationClient(), polarClient()],
});
