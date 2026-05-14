import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { attendeeSessionQueryOptions } from "@/queries/auth";

const ALL_CATEGORIES = "__all__";

type SearchProps = {
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  categories: string[];
};

export function PublicBrandBar({
  orgName,
  logo,
  contactEmail,
  searchProps,
}: {
  orgName: string;
  logo: string | null;
  contactEmail: string | null;
  searchProps?: SearchProps;
}) {
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link to="/events" className="flex items-center gap-3 hover:opacity-90">
          {logo ? (
            <img
              src={logo}
              alt={orgName}
              className="h-10 w-10 rounded-md object-cover ring-1 ring-white/30"
            />
          ) : null}
          <div className="font-heading text-lg font-semibold uppercase tracking-[-0.01em]">
            {orgName}
          </div>
        </Link>
        <div className="flex items-center gap-4">
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              className="hidden text-sm text-primary-foreground/85 hover:underline sm:inline"
            >
              {contactEmail}
            </a>
          ) : null}
          <AttendeeAuthSlot />
        </div>
      </div>

      {searchProps ? <PublicSearchRow {...searchProps} /> : null}
    </div>
  );
}

function PublicSearchRow({ search, setSearch, category, setCategory, categories }: SearchProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 pb-5">
      <div className="flex flex-col gap-2 rounded-lg bg-background p-2 text-foreground shadow-sm sm:flex-row sm:items-stretch">
        <div className="flex items-center gap-3 border-b px-3 py-1 sm:w-60 sm:border-b-0 sm:border-r">
          <CalendarDays className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v ?? ALL_CATEGORIES)}>
              <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-3 px-3 py-1">
          <Search className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Event, artist, or venue"
              className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <button
          type="button"
          className="rounded-md bg-primary px-8 text-base font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Search
        </button>
      </div>
    </div>
  );
}

function AttendeeAuthSlot() {
  const { data: session, isPending } = useQuery(attendeeSessionQueryOptions);

  if (isPending) {
    return <span className="text-sm text-primary-foreground/60">…</span>;
  }

  if (session) {
    return (
      <Link
        to="/me"
        className="inline-flex items-center gap-1.5 rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-white/10"
      >
        <UserRound className="size-4" />
        <span className="hidden max-w-[160px] truncate sm:inline">
          {session.user.email}
        </span>
        <span className="sm:hidden">Account</span>
      </Link>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-white/20"
    >
      <UserRound className="size-4" />
      Sign in
    </Link>
  );
}

export const PUBLIC_ALL_CATEGORIES = ALL_CATEGORIES;
