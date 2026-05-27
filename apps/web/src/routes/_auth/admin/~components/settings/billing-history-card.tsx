import { useQuery } from "@tanstack/react-query";
import type { BillingHistoryItem } from "@workspace/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoiceUrl } from "@/lib/billing";
import { billingHistoryQueryOptions } from "@/queries/billing";

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

async function downloadInvoice(id: string) {
  const url = await getInvoiceUrl(id);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    toast("Invoice is generating — try again in a few seconds.");
  }
}

export function BillingHistoryCard() {
  const historyQuery = useQuery(billingHistoryQueryOptions);
  const items = historyQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing history</CardTitle>
        <CardDescription>Past charges on your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {historyQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No charges yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ item }: { item: BillingHistoryItem }) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2.5">{new Date(item.date).toLocaleDateString()}</td>
      <td className="px-4 py-2.5 tabular-nums">{money(item.amountCents, item.currency)}</td>
      <td className="px-4 py-2.5 text-muted-foreground capitalize">{item.status}</td>
      <td className="px-4 py-2.5 text-right">
        {item.invoiceAvailable && (
          <Button size="sm" variant="outline" onClick={() => downloadInvoice(item.id)}>
            Invoice
          </Button>
        )}
      </td>
    </tr>
  );
}
