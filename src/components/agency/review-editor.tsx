"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { setReviewStatus, updateReviewContent, updateReviewSeo } from "@/app/agency/reviews-actions";
import type { AgencyReviewDetail } from "@/lib/reviews/agency-queries";
import { Badge, buttonStyles, Card, cx, inputStyles, Spinner } from "@/components/admin/ui";

type Role = "agency_admin" | "seo_editor" | "content_editor";

const ALL_TABS = [
  { id: "content", label: "Content", group: "content" },
  { id: "seo", label: "SEO", group: "seo" },
] as const;
type TabId = (typeof ALL_TABS)[number]["id"];

function tabsForRole(role: Role) {
  if (role === "seo_editor") return ALL_TABS.filter((t) => t.group === "seo");
  if (role === "content_editor") return ALL_TABS.filter((t) => t.group === "content");
  return ALL_TABS;
}

export function ReviewEditor({ review, role }: { review: AgencyReviewDetail; role: Role }) {
  const tabs = tabsForRole(role);
  const [tab, setTab] = useState<TabId>(tabs[0].id);
  const canEditContent = role === "agency_admin" || role === "content_editor";
  const canEditSeo = role === "agency_admin" || role === "seo_editor";

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-line px-2">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Review sections">
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
          <PublishControl reviewId={review.id} status={review.status} canPublish={canEditContent} />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {tab === "content" && <ContentForm review={review} readOnly={!canEditContent} />}
        {tab === "seo" && <SeoForm review={review} readOnly={!canEditSeo} />}
      </div>
    </Card>
  );
}

function PublishControl({ reviewId, status, canPublish }: { reviewId: string; status: "draft" | "published"; canPublish: boolean }) {
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
          const result = await setReviewStatus({ reviewId, status: target });
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

function ListField({ label, name, values, placeholder }: { label: string; name: string; values: string[]; placeholder: string }) {
  const [items, setItems] = useState(values.length > 0 ? values : [""]);
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink">{label}</label>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              name={name}
              defaultValue={v}
              placeholder={placeholder}
              maxLength={200}
              className={inputStyles}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                setItems(next);
              }}
            />
            <button
              type="button"
              className={buttonStyles.ghost}
              onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${label.toLowerCase()} item ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="text-sm font-medium text-brand-700 hover:text-brand-800" onClick={() => setItems([...items, ""])}>
        + Add {label.toLowerCase().replace(/s$/, "")}
      </button>
    </div>
  );
}

function ContentForm({ review, readOnly }: { review: AgencyReviewDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateReviewContent({
        reviewId: review.id,
        content: form.get("content"),
        pros: form.getAll("pros").filter((v) => String(v).trim()),
        considerations: form.getAll("considerations").filter((v) => String(v).trim()),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={readOnly || pending} className="space-y-6">
        <div className="space-y-1.5">
          <label htmlFor="content" className="block text-sm font-medium text-ink">
            Review body (Markdown)
          </label>
          <textarea
            id="content"
            name="content"
            defaultValue={review.content ?? ""}
            rows={16}
            maxLength={20000}
            className={cx(inputStyles, "resize-y font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60")}
            placeholder={"## Overview\n\nWrite the review here using Markdown — headings, **bold**, lists, and links are supported."}
          />
          <p className="text-xs text-ink-subtle">Supports headings, bold/italic, links, lists, quotes, and code. No raw HTML.</p>
        </div>
        <ListField label="What stood out" name="pros" values={review.pros} placeholder="e.g. Noticeably easier to fall asleep" />
        <ListField label="Things to consider" name="considerations" values={review.considerations} placeholder="e.g. Takes a few nights to feel the effect" />
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <button type="submit" className={buttonStyles.primary} disabled={pending}>
            {pending && <Spinner />}
            Save
          </button>
        </div>
      )}
      {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to review content.</p>}
    </form>
  );
}

function SeoForm({ review, readOnly }: { review: AgencyReviewDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateReviewSeo({
        reviewId: review.id,
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
          <input id="title" name="title" defaultValue={review.seo?.title ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="metaDescription" className="block text-sm font-medium text-ink">
            Meta description
          </label>
          <textarea id="metaDescription" name="metaDescription" defaultValue={review.seo?.metaDescription ?? ""} maxLength={160} rows={2} className={cx(inputStyles, "resize-y disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ogTitle" className="block text-sm font-medium text-ink">
            Social share title
          </label>
          <input id="ogTitle" name="ogTitle" defaultValue={review.seo?.ogTitle ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ogDescription" className="block text-sm font-medium text-ink">
            Social share description
          </label>
          <textarea id="ogDescription" name="ogDescription" defaultValue={review.seo?.ogDescription ?? ""} maxLength={160} rows={2} className={cx(inputStyles, "resize-y disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsIndex" defaultChecked={review.seo?.robotsIndex ?? true} />
            Allow search engines to index this page
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsFollow" defaultChecked={review.seo?.robotsFollow ?? true} />
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
