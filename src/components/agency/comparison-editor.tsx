"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  addComparisonProduct,
  moveComparisonProduct,
  removeComparisonProduct,
  searchProductsForComparison,
  setComparisonStatus,
  updateComparisonContent,
  updateComparisonSeo,
} from "@/app/agency/comparisons-actions";
import type { AgencyComparisonDetail } from "@/lib/comparisons/agency-queries";
import { Badge, buttonStyles, Card, cx, inputStyles, Spinner } from "@/components/admin/ui";

type Role = "agency_admin" | "seo_editor" | "content_editor";

const ALL_TABS = [
  { id: "content", label: "Content", group: "content" },
  { id: "products", label: "Products", group: "content" },
  { id: "seo", label: "SEO", group: "seo" },
] as const;
type TabId = (typeof ALL_TABS)[number]["id"];

function tabsForRole(role: Role) {
  if (role === "seo_editor") return ALL_TABS.filter((t) => t.group === "seo");
  if (role === "content_editor") return ALL_TABS.filter((t) => t.group === "content");
  return ALL_TABS;
}

export function ComparisonEditor({ comparison, role }: { comparison: AgencyComparisonDetail; role: Role }) {
  const tabs = tabsForRole(role);
  const [tab, setTab] = useState<TabId>(tabs[0].id);
  const canEditContent = role === "agency_admin" || role === "content_editor";
  const canEditSeo = role === "agency_admin" || role === "seo_editor";

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-line px-2">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Comparison sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cx(
                "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition",
                tab === t.id ? "border-brand-700 text-brand-700" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="pr-3">
          <PublishControl comparisonId={comparison.id} status={comparison.status} canPublish={canEditContent} />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {tab === "content" && <ContentForm comparison={comparison} readOnly={!canEditContent} />}
        {tab === "products" && <ProductsPanel comparison={comparison} readOnly={!canEditContent} />}
        {tab === "seo" && <SeoForm comparison={comparison} readOnly={!canEditSeo} />}
      </div>
    </Card>
  );
}

function PublishControl({ comparisonId, status, canPublish }: { comparisonId: string; status: "draft" | "published"; canPublish: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!canPublish) return status === "published" ? <Badge tone="brand">Published</Badge> : <Badge tone="sky">Draft</Badge>;

  const target = status === "published" ? "draft" : "published";
  return (
    <button
      type="button"
      disabled={pending}
      className={status === "published" ? buttonStyles.secondary : buttonStyles.primary}
      onClick={() =>
        startTransition(async () => {
          const result = await setComparisonStatus({ comparisonId, status: target });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(result.message);
        })
      }
    >
      {pending && <Spinner />}
      {status === "published" ? "Unpublish" : "Publish"}
    </button>
  );
}

function ContentForm({ comparison, readOnly }: { comparison: AgencyComparisonDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateComparisonContent({ comparisonId: comparison.id, content: form.get("content") });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset disabled={readOnly || pending}>
        <div className="space-y-1.5">
          <label htmlFor="content" className="block text-sm font-medium text-ink">
            Comparison body (Markdown)
          </label>
          <textarea
            id="content"
            name="content"
            defaultValue={comparison.content ?? ""}
            rows={18}
            maxLength={20000}
            className={cx(inputStyles, "resize-y font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60")}
            placeholder={"## Overview\n\nWrite the comparison here using Markdown — headings, **bold**, lists, and links are supported."}
          />
          <p className="text-xs text-ink-subtle">Supports headings, bold/italic, links, lists, quotes, and code. No raw HTML.</p>
        </div>
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <button type="submit" className={buttonStyles.primary} disabled={pending}>
            {pending && <Spinner />}
            Save
          </button>
        </div>
      )}
      {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to comparison content.</p>}
    </form>
  );
}

function ProductsPanel({ comparison, readOnly }: { comparison: AgencyComparisonDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; status: string }[]>([]);
  const [searching, startSearch] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const result = await searchProductsForComparison(value);
      setResults(result.ok ? (result.data ?? []).filter((p) => !comparison.products.some((r) => r.id === p.id)) : []);
    });
  }

  const sorted = [...comparison.products].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-5">
      <ol className="space-y-2">
        {sorted.map((p, i) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 text-sm">
            <span className="text-ink">
              <span className="mr-2 text-ink-subtle">{i + 1}.</span>
              {p.name}
            </span>
            {!readOnly && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-ink-subtle hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${p.name} up`}
                  disabled={pending || i === 0}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await moveComparisonProduct({ comparisonId: comparison.id, productId: p.id, direction: "up" });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(result.message);
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-ink-subtle hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${p.name} down`}
                  disabled={pending || i === sorted.length - 1}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await moveComparisonProduct({ comparisonId: comparison.id, productId: p.id, direction: "down" });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(result.message);
                    })
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-rose-ink hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeComparisonProduct({ comparisonId: comparison.id, productId: p.id });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(result.message);
                    })
                  }
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
        {sorted.length === 0 && <p className="text-sm text-ink-muted">No products added yet.</p>}
      </ol>

      {!readOnly && (
        <div className="space-y-1.5">
          <label htmlFor="comparison-product-search" className="block text-sm font-medium text-ink">
            Add a product
          </label>
          <input id="comparison-product-search" value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search products by name" className={inputStyles} autoComplete="off" />
          {query.trim() && (
            <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-line">
              {searching ? (
                <li className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink-muted">
                  <Spinner /> Searching…
                </li>
              ) : results.length > 0 ? (
                results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-sunken"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await addComparisonProduct({ comparisonId: comparison.id, productId: p.id });
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success(result.message);
                          setQuery("");
                          setResults([]);
                        })
                      }
                    >
                      <span className="text-ink">{p.name}</span>
                      <span className="text-xs text-ink-subtle">{p.status}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3.5 py-2.5 text-sm text-ink-muted">No matching products.</li>
              )}
            </ul>
          )}
        </div>
      )}
      {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to compared products.</p>}
    </div>
  );
}

function SeoForm({ comparison, readOnly }: { comparison: AgencyComparisonDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateComparisonSeo({
        comparisonId: comparison.id,
        title: form.get("title"),
        metaDescription: form.get("metaDescription"),
        ogTitle: form.get("ogTitle"),
        ogDescription: form.get("ogDescription"),
        robotsIndex: form.get("robotsIndex") === "on",
        robotsFollow: form.get("robotsFollow") === "on",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={readOnly || pending} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="title" className="block text-sm font-medium text-ink">
            Page title
          </label>
          <input id="title" name="title" defaultValue={comparison.seo?.title ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="metaDescription" className="block text-sm font-medium text-ink">
            Meta description
          </label>
          <textarea id="metaDescription" name="metaDescription" defaultValue={comparison.seo?.metaDescription ?? ""} maxLength={160} rows={2} className={cx(inputStyles, "resize-y disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ogTitle" className="block text-sm font-medium text-ink">
            Social share title
          </label>
          <input id="ogTitle" name="ogTitle" defaultValue={comparison.seo?.ogTitle ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ogDescription" className="block text-sm font-medium text-ink">
            Social share description
          </label>
          <textarea id="ogDescription" name="ogDescription" defaultValue={comparison.seo?.ogDescription ?? ""} maxLength={160} rows={2} className={cx(inputStyles, "resize-y disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsIndex" defaultChecked={comparison.seo?.robotsIndex ?? true} />
            Allow search engines to index this page
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsFollow" defaultChecked={comparison.seo?.robotsFollow ?? true} />
            Allow following links on this page
          </label>
        </div>
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <button type="submit" className={buttonStyles.primary} disabled={pending}>
            {pending && <Spinner />}
            Save
          </button>
        </div>
      )}
      {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to SEO metadata.</p>}
    </form>
  );
}
