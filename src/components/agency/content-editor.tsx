"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  addBenefit,
  addFaq,
  addIngredient,
  deleteBenefit,
  deleteFaq,
  deleteIngredient,
  deleteProductImage,
  setContentStatus,
  setPrimaryImage,
  updateBenefit,
  updateContentFields,
  updateFaq,
  updateIngredient,
  updateSeoMetadata,
  uploadProductImage,
} from "@/app/agency/actions";
import type { AgencyProductDetail } from "@/lib/products/agency-queries";
import { Badge, buttonStyles, Card, cx, inputStyles, Spinner } from "@/components/admin/ui";

type Role = "agency_admin" | "seo_editor" | "content_editor";

const ALL_TABS = [
  { id: "overview", label: "Overview", group: "content" },
  { id: "benefits", label: "Benefits", group: "content" },
  { id: "ingredients", label: "Ingredients", group: "content" },
  { id: "faqs", label: "FAQs", group: "content" },
  { id: "images", label: "Images", group: "content" },
  { id: "seo", label: "SEO", group: "seo" },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

// A role only sees the tabs for sections it can actually write — e.g.
// seo_editor has no path to product content at all, not even read-only, so
// those tabs aren't rendered rather than shown disabled. RLS is still the
// real boundary; this just keeps controls a role can't use off the screen.
function tabsForRole(role: Role) {
  if (role === "seo_editor") return ALL_TABS.filter((t) => t.group === "seo");
  if (role === "content_editor") return ALL_TABS.filter((t) => t.group === "content");
  return ALL_TABS;
}

export function ContentEditor({ product, role }: { product: AgencyProductDetail; role: Role }) {
  const tabs = tabsForRole(role);
  const [tab, setTab] = useState<TabId>(tabs[0].id);
  const canEditContent = role === "agency_admin" || role === "content_editor";
  const canEditSeo = role === "agency_admin" || role === "seo_editor";

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-line px-2">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Content sections">
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
          <PublishControl productId={product.id} status={product.content?.status ?? null} canPublish={canEditContent} />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {tab === "overview" && <OverviewForm product={product} readOnly={!canEditContent} />}
        {tab === "benefits" && <BenefitsPanel productId={product.id} items={product.benefits} readOnly={!canEditContent} />}
        {tab === "ingredients" && <IngredientsPanel productId={product.id} items={product.ingredients} readOnly={!canEditContent} />}
        {tab === "faqs" && <FaqsPanel productId={product.id} items={product.faqs} readOnly={!canEditContent} />}
        {tab === "images" && <ImagesPanel productId={product.id} items={product.images} readOnly={!canEditContent} />}
        {tab === "seo" && <SeoForm productId={product.id} seo={product.seo} readOnly={!canEditSeo} />}
      </div>
    </Card>
  );
}

function PublishControl({
  productId,
  status,
  canPublish,
}: {
  productId: string;
  status: "draft" | "published" | null;
  canPublish: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (!canPublish) return status === "published" ? <Badge tone="brand">Published</Badge> : <Badge tone="sky">Draft</Badge>;

  const target = status === "published" ? "draft" : "published";
  return (
    <button
      type="button"
      disabled={pending || !status}
      title={!status ? "Add content before publishing" : undefined}
      className={status === "published" ? buttonStyles.secondary : buttonStyles.primary}
      onClick={() =>
        startTransition(async () => {
          const result = await setContentStatus({ productId, status: target });
          if (!result.ok) { toast.error(result.error); return; }
          toast.success(result.message);
        })
      }
    >
      {pending && <Spinner />}
      {status === "published" ? "Unpublish" : "Publish"}
    </button>
  );
}

function TextArea({
  id,
  label,
  defaultValue,
  rows = 4,
  maxLength,
  disabled,
}: {
  id: string;
  label: string;
  defaultValue: string;
  rows?: number;
  maxLength: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        defaultValue={defaultValue}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className={cx(inputStyles, "resize-y disabled:cursor-not-allowed disabled:opacity-60")}
      />
    </div>
  );
}

function OverviewForm({ product, readOnly }: { product: AgencyProductDetail; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateContentFields({
        productId: product.id,
        overview: form.get("overview"),
        howItWorks: form.get("howItWorks"),
        usage: form.get("usage"),
        whoItsFor: form.get("whoItsFor"),
        considerations: form.get("considerations"),
      });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={readOnly || pending} className="space-y-5">
        <TextArea id="overview" label="Overview" defaultValue={product.content?.overview ?? ""} maxLength={4000} rows={5} />
        <TextArea id="howItWorks" label="How it works" defaultValue={product.content?.howItWorks ?? ""} maxLength={4000} rows={5} />
        <TextArea id="usage" label="Usage" defaultValue={product.content?.usage ?? ""} maxLength={4000} rows={3} />
        <TextArea id="whoItsFor" label="Who it's for" defaultValue={product.content?.whoItsFor ?? ""} maxLength={2000} rows={3} />
        <TextArea id="considerations" label="Considerations" defaultValue={product.content?.considerations ?? ""} maxLength={2000} rows={3} />
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <button type="submit" className={buttonStyles.primary} disabled={pending}>
            {pending && <Spinner />}
            Save
          </button>
        </div>
      )}
      {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to product content.</p>}
    </form>
  );
}

function BenefitsPanel({
  productId,
  items,
  readOnly,
}: {
  productId: string;
  items: AgencyProductDetail["benefits"];
  readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((item) => (
          <EditableRow
            key={item.id}
            readOnly={readOnly}
            title={item.title}
            description={item.description}
            titleLabel="Title"
            onSave={(title, description) =>
              startTransition(async () => {
                const result = await updateBenefit({ productId, id: item.id, title, description });
                if (!result.ok) { toast.error(result.error); return; }
                toast.success(result.message);
              })
            }
            onDelete={() =>
              startTransition(async () => {
                const result = await deleteBenefit({ productId, id: item.id });
                if (!result.ok) { toast.error(result.error); return; }
                toast.success(result.message);
              })
            }
          />
        ))}
        {items.length === 0 && <p className="text-sm text-ink-muted">No benefits added yet.</p>}
      </ul>
      {!readOnly &&
        (adding ? (
          <NewRowForm
            titleLabel="Title"
            titlePlaceholder="e.g. Supports better sleep"
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(title, description) =>
              startTransition(async () => {
                const result = await addBenefit({ productId, title, description });
                if (!result.ok) { toast.error(result.error); return; }
                toast.success(result.message);
                setAdding(false);
              })
            }
          />
        ) : (
          <button type="button" className={buttonStyles.secondary} onClick={() => setAdding(true)}>
            Add benefit
          </button>
        ))}
    </div>
  );
}

function IngredientsPanel({
  productId,
  items,
  readOnly,
}: {
  productId: string;
  items: AgencyProductDetail["ingredients"];
  readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((item) => (
          <EditableRow
            key={item.id}
            readOnly={readOnly}
            title={item.name}
            description={item.description}
            titleLabel="Name"
            onSave={(name, description) =>
              startTransition(async () => {
                const result = await updateIngredient({ productId, id: item.id, name, description });
                if (!result.ok) { toast.error(result.error); return; }
                toast.success(result.message);
              })
            }
            onDelete={() =>
              startTransition(async () => {
                const result = await deleteIngredient({ productId, id: item.id });
                if (!result.ok) { toast.error(result.error); return; }
                toast.success(result.message);
              })
            }
          />
        ))}
        {items.length === 0 && <p className="text-sm text-ink-muted">No ingredients added yet.</p>}
      </ul>
      {!readOnly &&
        (adding ? (
          <NewRowForm
            titleLabel="Name"
            titlePlaceholder="e.g. Magnesium glycinate"
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(name, description) =>
              startTransition(async () => {
                const result = await addIngredient({ productId, name, description });
                if (!result.ok) { toast.error(result.error); return; }
                toast.success(result.message);
                setAdding(false);
              })
            }
          />
        ) : (
          <button type="button" className={buttonStyles.secondary} onClick={() => setAdding(true)}>
            Add ingredient
          </button>
        ))}
    </div>
  );
}

function EditableRow({
  title,
  description,
  titleLabel,
  readOnly,
  onSave,
  onDelete,
}: {
  title: string;
  description: string | null;
  titleLabel: string;
  readOnly: boolean;
  onSave: (title: string, description: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-xl border border-line p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            onSave(String(form.get("title") ?? ""), String(form.get("description") ?? ""));
            setEditing(false);
          }}
          className="space-y-3"
        >
          <input name="title" defaultValue={title} maxLength={200} className={inputStyles} aria-label={titleLabel} />
          <textarea name="description" defaultValue={description ?? ""} maxLength={2000} rows={2} className={cx(inputStyles, "resize-y")} aria-label="Description" />
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonStyles.ghost} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonStyles.primary}>
              Save
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {!readOnly && (
        <div className="flex shrink-0 gap-2">
          <button type="button" className={buttonStyles.ghost} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className={buttonStyles.ghost} onClick={onDelete}>
            <span className="text-rose-ink">Delete</span>
          </button>
        </div>
      )}
    </li>
  );
}

function NewRowForm({
  titleLabel,
  titlePlaceholder,
  pending,
  onSubmit,
  onCancel,
}: {
  titleLabel: string;
  titlePlaceholder: string;
  pending: boolean;
  onSubmit: (title: string, description: string) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        onSubmit(String(form.get("title") ?? ""), String(form.get("description") ?? ""));
      }}
      className="space-y-3 rounded-xl border border-dashed border-line-strong p-4"
    >
      <input name="title" placeholder={titlePlaceholder} maxLength={200} className={inputStyles} aria-label={titleLabel} required />
      <textarea name="description" placeholder="Description (optional)" maxLength={2000} rows={2} className={cx(inputStyles, "resize-y")} aria-label="Description" />
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonStyles.ghost} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={buttonStyles.primary} disabled={pending}>
          {pending && <Spinner />}
          Add
        </button>
      </div>
    </form>
  );
}

function FaqsPanel({ productId, items, readOnly }: { productId: string; items: AgencyProductDetail["faqs"]; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="rounded-xl border border-line p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  startTransition(async () => {
                    const result = await updateFaq({
                      productId,
                      id: item.id,
                      question: form.get("question"),
                      answer: form.get("answer"),
                    });
                    if (!result.ok) { toast.error(result.error); return; }
                    toast.success(result.message);
                    setEditingId(null);
                  });
                }}
                className="space-y-3"
              >
                <input name="question" defaultValue={item.question} maxLength={300} className={inputStyles} aria-label="Question" />
                <textarea name="answer" defaultValue={item.answer} maxLength={3000} rows={3} className={cx(inputStyles, "resize-y")} aria-label="Answer" />
                <div className="flex justify-end gap-2">
                  <button type="button" className={buttonStyles.ghost} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button type="submit" className={buttonStyles.primary}>
                    Save
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{item.question}</p>
                <p className="mt-1 text-sm text-ink-muted">{item.answer}</p>
              </div>
              {!readOnly && (
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={buttonStyles.ghost} onClick={() => setEditingId(item.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={buttonStyles.ghost}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteFaq({ productId, id: item.id });
                        if (!result.ok) { toast.error(result.error); return; }
                        toast.success(result.message);
                      })
                    }
                  >
                    <span className="text-rose-ink">Delete</span>
                  </button>
                </div>
              )}
            </li>
          ),
        )}
        {items.length === 0 && <p className="text-sm text-ink-muted">No FAQs added yet.</p>}
      </ul>
      {!readOnly &&
        (adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await addFaq({ productId, question: form.get("question"), answer: form.get("answer") });
                if (!result.ok) { toast.error(result.error); return; }
                toast.success(result.message);
                setAdding(false);
              });
            }}
            className="space-y-3 rounded-xl border border-dashed border-line-strong p-4"
          >
            <input name="question" placeholder="Question" maxLength={300} className={inputStyles} aria-label="Question" required />
            <textarea name="answer" placeholder="Answer" maxLength={3000} rows={3} className={cx(inputStyles, "resize-y")} aria-label="Answer" required />
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonStyles.ghost} onClick={() => setAdding(false)} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className={buttonStyles.primary} disabled={pending}>
                {pending && <Spinner />}
                Add
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className={buttonStyles.secondary} onClick={() => setAdding(true)}>
            Add FAQ
          </button>
        ))}
    </div>
  );
}

function ImagesPanel({ productId, items, readOnly }: { productId: string; items: AgencyProductDetail["images"]; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await uploadProductImage(formData);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(result.message);
      form.reset();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((img) => (
          <div key={img.id} className="group relative overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- external public Storage URL, not a local asset */}
            <img src={img.url} alt={img.altText ?? ""} className="aspect-square w-full object-cover" />
            {img.isPrimary && (
              <span className="absolute left-2 top-2 rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-medium text-white">
                Primary
              </span>
            )}
            {!readOnly && (
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-ink/70 p-1.5 opacity-0 transition group-hover:opacity-100">
                {!img.isPrimary && (
                  <button
                    type="button"
                    className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-ink hover:bg-white"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await setPrimaryImage({ productId, id: img.id });
                        if (!result.ok) { toast.error(result.error); return; }
                        toast.success(result.message);
                      })
                    }
                  >
                    Set primary
                  </button>
                )}
                <button
                  type="button"
                  className="ml-auto rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-rose-ink hover:bg-white"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteProductImage({ productId, id: img.id, storagePath: img.url });
                      if (!result.ok) { toast.error(result.error); return; }
                      toast.success(result.message);
                    })
                  }
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="col-span-full text-sm text-ink-muted">No images uploaded yet.</p>}
      </div>

      {!readOnly && (
        <form onSubmit={handleUpload} className="space-y-3 rounded-xl border border-dashed border-line-strong p-4">
          <input type="hidden" name="productId" value={productId} />
          <div className="space-y-1.5">
            <label htmlFor="file" className="block text-sm font-medium text-ink">
              Upload an image
            </label>
            <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className={inputStyles} />
            <p className="text-xs text-ink-subtle">JPEG, PNG, or WebP. 5 MB max.</p>
          </div>
          <input name="altText" placeholder="Alt text (optional, for accessibility and SEO)" maxLength={200} className={inputStyles} />
          <div className="flex justify-end">
            <button type="submit" className={buttonStyles.primary} disabled={pending}>
              {pending && <Spinner />}
              Upload
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SeoForm({ productId, seo, readOnly }: { productId: string; seo: AgencyProductDetail["seo"]; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateSeoMetadata({
        productId,
        title: form.get("title"),
        metaDescription: form.get("metaDescription"),
        ogTitle: form.get("ogTitle"),
        ogDescription: form.get("ogDescription"),
        robotsIndex: form.get("robotsIndex") === "on",
        robotsFollow: form.get("robotsFollow") === "on",
      });
      if (!result.ok) { toast.error(result.error); return; }
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
          <input id="title" name="title" defaultValue={seo?.title ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <TextArea id="metaDescription" label="Meta description" defaultValue={seo?.metaDescription ?? ""} maxLength={160} rows={2} />
        <div className="space-y-1.5">
          <label htmlFor="ogTitle" className="block text-sm font-medium text-ink">
            Social share title
          </label>
          <input id="ogTitle" name="ogTitle" defaultValue={seo?.ogTitle ?? ""} maxLength={70} className={cx(inputStyles, "disabled:cursor-not-allowed disabled:opacity-60")} />
        </div>
        <TextArea id="ogDescription" label="Social share description" defaultValue={seo?.ogDescription ?? ""} maxLength={160} rows={2} />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsIndex" defaultChecked={seo?.robotsIndex ?? true} />
            Allow search engines to index this page
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="robotsFollow" defaultChecked={seo?.robotsFollow ?? true} />
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
