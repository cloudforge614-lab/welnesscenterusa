"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  addArticleRelatedProduct,
  deleteArticleImage,
  removeArticleRelatedProduct,
  searchProductsForArticle,
  setArticleStatus,
  updateArticleContent,
  updateArticleSeo,
  uploadArticleImage,
} from "@/app/agency/articles-actions";
import type { AgencyArticleDetail } from "@/lib/articles/agency-queries";
import { Badge, buttonStyles, Card, cx, inputStyles, Spinner } from "@/components/admin/ui";

type Role = "agency_admin" | "seo_editor" | "content_editor";

const ALL_TABS = [
  { id: "content", label: "Content", group: "content" },
  { id: "related", label: "Related products", group: "content" },
  { id: "seo", label: "SEO", group: "seo" },
] as const;
type TabId = (typeof ALL_TABS)[number]["id"];

function tabsForRole(role: Role) {
  if (role === "seo_editor") return ALL_TABS.filter((t) => t.group === "seo");
  if (role === "content_editor") return ALL_TABS.filter((t) => t.group === "content");
  return ALL_TABS;
}

export function ArticleEditor({ article, role }: { article: AgencyArticleDetail; role: Role }) {
  const tabs = tabsForRole(role);
  const [tab, setTab] = useState<TabId>(tabs[0].id);
  const canEditContent = role === "agency_admin" || role === "content_editor";
  const canEditSeo = role === "agency_admin" || role === "seo_editor";

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-line px-2">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Article sections">
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
          <PublishControl articleId={article.id} status={article.status} canPublish={canEditContent} />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {tab === "content" && <ContentForm article={article} readOnly={!canEditContent} />}
        {tab === "related" && <RelatedProductsPanel article={article} readOnly={!canEditContent} />}
        {tab === "seo" && <SeoForm article={article} readOnly={!canEditSeo} />}
      </div>
    </Card>
  );
}

function PublishControl({ articleId, status, canPublish }: { articleId: string; status: "draft" | "published"; canPublish: boolean }) {
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
          const result = await setArticleStatus({ articleId, status: target });
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

function ContentForm({ article, readOnly }: { article: AgencyArticleDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const [uploadPending, startUpload] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateArticleContent({ articleId: article.id, content: form.get("content"), categoryId: article.category?.id ?? null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    });
  }

  function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startUpload(async () => {
      const result = await uploadArticleImage(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      form.reset();
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Featured image</p>
        {article.featuredImagePath ? (
          <div className="relative w-48 overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- external public Storage URL */}
            <img src={article.featuredImagePath} alt="" className="aspect-video w-full object-cover" />
            {!readOnly && (
              <button
                type="button"
                className="absolute right-1.5 top-1.5 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-rose-ink hover:bg-white"
                onClick={() =>
                  startUpload(async () => {
                    const result = await deleteArticleImage({ articleId: article.id, storagePath: article.featuredImagePath });
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
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No featured image yet.</p>
        )}
        {!readOnly && (
          <form onSubmit={handleUpload} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="articleId" value={article.id} />
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className={cx(inputStyles, "max-w-xs py-2")} />
            <button type="submit" className={buttonStyles.secondary} disabled={uploadPending}>
              {uploadPending && <Spinner />}
              Upload
            </button>
          </form>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={readOnly || pending}>
          <div className="space-y-1.5">
            <label htmlFor="content" className="block text-sm font-medium text-ink">
              Article body (Markdown)
            </label>
            <textarea
              id="content"
              name="content"
              defaultValue={article.content ?? ""}
              rows={18}
              maxLength={20000}
              className={cx(inputStyles, "resize-y font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60")}
              placeholder={"## Introduction\n\nWrite the article here using Markdown — headings, **bold**, lists, and links are supported."}
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
        {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to article content.</p>}
      </form>
    </div>
  );
}

function RelatedProductsPanel({ article, readOnly }: { article: AgencyArticleDetail; readOnly: boolean }) {
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
      const result = await searchProductsForArticle(value);
      setResults(result.ok ? (result.data ?? []).filter((p) => !article.relatedProducts.some((r) => r.id === p.id)) : []);
    });
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {article.relatedProducts.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 text-sm">
            <span className="text-ink">{p.name}</span>
            {!readOnly && (
              <button
                type="button"
                className="text-sm font-medium text-rose-ink hover:underline"
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeArticleRelatedProduct({ articleId: article.id, productId: p.id });
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(result.message);
                  })
                }
                disabled={pending}
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {article.relatedProducts.length === 0 && <p className="text-sm text-ink-muted">No related products yet.</p>}
      </ul>

      {!readOnly && (
        <div className="space-y-1.5">
          <label htmlFor="related-product-search" className="block text-sm font-medium text-ink">
            Add a related product
          </label>
          <input id="related-product-search" value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search products by name" className={inputStyles} autoComplete="off" />
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
                          const result = await addArticleRelatedProduct({ articleId: article.id, productId: p.id });
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
      {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to related products.</p>}
    </div>
  );
}

function SeoForm({ article, readOnly }: { article: AgencyArticleDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateArticleSeo({
        articleId: article.id,
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
          <input id="title" name="title" defaultValue={article.seo?.title ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="metaDescription" className="block text-sm font-medium text-ink">
            Meta description
          </label>
          <textarea id="metaDescription" name="metaDescription" defaultValue={article.seo?.metaDescription ?? ""} maxLength={160} rows={2} className={cx(inputStyles, "resize-y disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ogTitle" className="block text-sm font-medium text-ink">
            Social share title
          </label>
          <input id="ogTitle" name="ogTitle" defaultValue={article.seo?.ogTitle ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ogDescription" className="block text-sm font-medium text-ink">
            Social share description
          </label>
          <textarea id="ogDescription" name="ogDescription" defaultValue={article.seo?.ogDescription ?? ""} maxLength={160} rows={2} className={cx(inputStyles, "resize-y disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsIndex" defaultChecked={article.seo?.robotsIndex ?? true} />
            Allow search engines to index this page
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsFollow" defaultChecked={article.seo?.robotsFollow ?? true} />
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
