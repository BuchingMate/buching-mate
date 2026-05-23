import { api } from "./api";

export type AttendanceRow = {
  registrationId: string;
  email: string;
  name: string;
  status: "registered" | "cancelled" | "attended" | "no_show";
  attended: boolean;
  durationSeconds: number | null;
  joinTime: string | null;
  leaveTime: string | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  networkType: string | null;
};

export type ListAttendanceResponse = { attendance: AttendanceRow[] };

export function listEventAttendance(eventId: string) {
  return api.get<ListAttendanceResponse>(`/api/video/events/${eventId}/attendance`);
}
