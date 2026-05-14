import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";

const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3456";

export const attendeeAuthClient = createAuthClient({
  baseURL: `${serverUrl}/api/public/auth`,
  plugins: [magicLinkClient()],
  fetchOptions: {
    credentials: "include",
  },
});
