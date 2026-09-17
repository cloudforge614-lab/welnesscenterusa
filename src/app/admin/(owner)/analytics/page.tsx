import Form from "next/form";
import Link from "next/link";
import { RankedList, SummaryStat, TrendChart } from "@/components/admin/analytics-charts";
import { Card, cx, EmptyState, formatDateTime, formatNumber, inputStyles } from "@/components/admin/ui";
import { getOwnerClickAnalytics } from "@/lib/analytics/owner-clicks";
import type { RangeKey } from "@/lib/analytics/date-range";

export const metadata = { title: "Click analytics" };

// Owner-only. Enforced three ways, independently: the /admin layout already
// redirects anyone who isn't signed in as the owner before this page ever
// renders; getOwnerClickAnalytics() calls assertOwner() itself rather than
// trusting the layout; and the database RPC it calls raises for any caller
// whose role isn't owner, on top of RLS confining affiliate_clicks to the
// owner regardless. See src/lib/analytics/owner-clicks.ts.
export const dynamic = "force-dynamic";

const PRESETS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

function presetHref(key: string) {
  return `/admin/analytics?range=${key}`;
}

export default async function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  const sp = await props.searchParams;
  const searchParams = {
    range: typeof sp.range === "string" ? sp.range : undefined,
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
  };

  const data = await getOwnerClickAnalytics(searchParams);
  const hasClicksInRange = data.totalClicks > 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl text-ink">Click analytics</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-ink-muted">
          Affiliate link clicks tracked by Wellness Center USA — when someone used a &ldquo;View official
          offer&rdquo; link. This is not the same as site-visit analytics, and it is not merchant sales or revenue:
          merchants track and report conversions separately, and that data isn&apos;t available here.
        </p>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryStat label="Total clicks (all time)" value={data.allTimeTotal} />
        <SummaryStat label="Clicks today" value={data.todayTotal} footnote="UTC calendar day" />
        <SummaryStat label={`Clicks · ${data.range.label}`} value={data.totalClicks} className="col-span-2 lg:col-span-1" />
        <SummaryStat
          label="Products clicked"
          value={data.byProduct.length}
          footnote={data.byProduct.length === 15 ? "showing top 15" : undefined}
        />
      </section>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <nav aria-label="Date range" className="-mx-1 flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <Link
                key={p.key}
                href={presetHref(p.key)}
                aria-current={data.range.key === p.key ? "page" : undefined}
                className={cx(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition",
                  data.range.key === p.key ? "bg-brand-700 text-white" : "text-ink-muted hover:bg-sunken hover:text-ink",
                )}
              >
                {p.label}
              </Link>
            ))}
          </nav>

          <Form action="/admin/analytics" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="range" value="custom" />
            <label className="sr-only" htmlFor="from-date">
              From
            </label>
            <input
              id="from-date"
              type="date"
              name="from"
              defaultValue={data.range.fromDate}
              className={cx(inputStyles, "w-[9.5rem] py-1.5 text-sm")}
            />
            <span className="text-sm text-ink-subtle">to</span>
            <label className="sr-only" htmlFor="to-date">
              To
            </label>
            <input
              id="to-date"
              type="date"
              name="to"
              defaultValue={data.range.toDate}
              className={cx(inputStyles, "w-[9.5rem] py-1.5 text-sm")}
            />
            <button
              type="submit"
              aria-current={data.range.key === "custom" ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                data.range.key === "custom" ? "bg-brand-700 text-white" : "border border-line-strong text-ink-muted hover:bg-sunken hover:text-ink",
              )}
            >
              Apply
            </button>
          </Form>
        </div>

        <div className="p-4 sm:p-5">
          {hasClicksInRange ? (
            <TrendChart points={data.trend} />
          ) : (
            <p className="py-8 text-center text-sm text-ink-subtle">No clicks in {data.range.label.toLowerCase()}.</p>
          )}
        </div>
      </Card>

      {hasClicksInRange ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="border-b border-line px-5 py-4 font-display text-lg text-ink">Clicks by product</h2>
            <RankedList
              items={data.byProduct}
              emptyMessage="No product clicks in this range."
              linkForProduct={(productId) => `/admin/products/${productId}`}
            />
          </Card>

          <Card>
            <h2 className="border-b border-line px-5 py-4 font-display text-lg text-ink">CTA location</h2>
            <RankedList items={data.byCta} emptyMessage="No CTA data in this range." />
          </Card>

          <Card>
            <h2 className="border-b border-line px-5 py-4 font-display text-lg text-ink">Device type</h2>
            <RankedList items={data.byDevice} emptyMessage="No device data in this range." />
          </Card>

          <Card>
            <h2 className="border-b border-line px-5 py-4 font-display text-lg text-ink">Referring site</h2>
            <RankedList items={data.byReferrer} emptyMessage="No external referrers in this range." />
          </Card>

          {(data.byUtmSource.length > 0 || data.byUtmMedium.length > 0 || data.byUtmCampaign.length > 0) && (
            <Card className="lg:col-span-2">
              <h2 className="border-b border-line px-5 py-4 font-display text-lg text-ink">Campaign attribution</h2>
              <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div>
                  <p className="px-5 pt-4 text-xs font-medium uppercase tracking-wide text-ink-subtle">UTM source</p>
                  <RankedList items={data.byUtmSource} emptyMessage="No UTM source data." />
                </div>
                <div>
                  <p className="px-5 pt-4 text-xs font-medium uppercase tracking-wide text-ink-subtle">UTM medium</p>
                  <RankedList items={data.byUtmMedium} emptyMessage="No UTM medium data." />
                </div>
                <div>
                  <p className="px-5 pt-4 text-xs font-medium uppercase tracking-wide text-ink-subtle">UTM campaign</p>
                  <RankedList items={data.byUtmCampaign} emptyMessage="No UTM campaign data." />
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No clicks in this range"
            description="Try a wider date range, or check back once your affiliate links start getting used."
          />
        </Card>
      )}

      <Card>
        <h2 className="border-b border-line px-5 py-4 font-display text-lg text-ink">Recent activity</h2>
        {data.recent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-5 py-2.5 font-medium">CTA</th>
                  <th className="px-5 py-2.5 font-medium">Device</th>
                  <th className="px-5 py-2.5 font-medium">Referrer</th>
                  <th className="px-5 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.recent.map((c) => (
                  <tr key={c.id}>
                    <td className="max-w-[12rem] truncate px-5 py-2.5 font-medium text-ink">
                      <Link href={`/admin/products/${c.productId}`} className="hover:text-brand-700" title={c.productName}>
                        {c.productName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{formatDateTime(c.clickedAt)}</td>
                    <td className="max-w-[10rem] truncate px-5 py-2.5 text-ink-muted" title={c.ctaLocation ?? undefined}>
                      {c.ctaLocation ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 capitalize text-ink-muted">{c.device}</td>
                    {/* Referrer is an external, caller-supplied value — rendered as
                        plain truncated text, never as a clickable href, so it can
                        never itself become a navigation target. */}
                    <td className="max-w-[12rem] truncate px-5 py-2.5 text-ink-muted" title={c.referrer ?? undefined}>
                      {c.referrer ?? (c.landingPage ? "(from this site)" : "—")}
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted">{c.utmSource ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-subtle">No activity in this range.</p>
        )}
      </Card>

      <p className="text-xs text-ink-subtle">{formatNumber(data.allTimeTotal)} clicks recorded in total.</p>
    </div>
  );
}
