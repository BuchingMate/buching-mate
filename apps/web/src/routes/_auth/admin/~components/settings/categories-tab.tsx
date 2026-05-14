import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryConfigs } from "@workspace/contracts";
import { CategoriesEditor } from "@/components/categories-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrgSettings } from "@/lib/org";
import { orgKeys, orgSettingsQueryOptions } from "@/queries/org";

export function CategoriesTab() {
  const settingsQuery = useQuery(orgSettingsQueryOptions);
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<string[]>([]);
  const [configs, setConfigs] = useState<CategoryConfigs>({});

  useEffect(() => {
    if (!settingsQuery.data) return;
    setCategories(settingsQuery.data.settings.categories ?? []);
    setConfigs(settingsQuery.data.settings.categoryConfigs ?? {});
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: { categories: string[]; categoryConfigs: CategoryConfigs }) =>
      updateOrgSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.settings() });
    },
  });

  const handleChange = (next: { categories: string[]; configs: CategoryConfigs }) => {
    setCategories(next.categories);
    setConfigs(next.configs);
    mutation.mutate({ categories: next.categories, categoryConfigs: next.configs });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event categories</CardTitle>
        <CardDescription>
          Add categories with a color and icon. Calendar and event lists use these.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settingsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <CategoriesEditor categories={categories} configs={configs} onChange={handleChange} />
        )}
        {mutation.isError && (
          <p className="mt-3 text-xs text-destructive">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Couldn't save categories. Try again."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
