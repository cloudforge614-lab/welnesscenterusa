"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setProductCategoriesAction } from "@/app/admin/actions";
import { buttonStyles, cx, Spinner } from "./ui";

export type CategoryOption = { id: string; name: string; slug: string };

/**
 * A plain checkbox group. Uncontrolled when `name` is used inside a <form>
 * (Add Product posts the checked ids as repeated `categoryIds` fields);
 * controlled through `checked`/`onToggle` on the product page.
 */
export function CategoryCheckboxes({
  categories,
  name,
  checked,
  onToggle,
  disabled,
  legend,
}: {
  categories: CategoryOption[];
  name?: string;
  checked?: Set<string>;
  onToggle?: (id: string) => void;
  disabled?: boolean;
  legend: string;
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-ink-muted">No categories exist yet.</p>;
  }
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-ink hover:bg-sunken">
              <input
                type="checkbox"
                name={name}
                value={c.id}
                {...(checked ? { checked: checked.has(c.id), onChange: () => onToggle?.(c.id) } : {})}
                className="size-4 rounded border-line-strong accent-brand-700"
              />
              <span className="[overflow-wrap:anywhere]">{c.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Owner category management on a product's page: tick, then save. */
export function ProductCategoryEditor({
  productId,
  categories,
  assignedIds,
}: {
  productId: string;
  categories: CategoryOption[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(() => new Set(assignedIds));
  const [checked, setChecked] = useState(() => new Set(assignedIds));

  const dirty = checked.size !== saved.size || [...checked].some((id) => !saved.has(id));

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await setProductCategoriesAction({ id: productId, categoryIds: [...checked] });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(new Set(checked));
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <CategoryCheckboxes categories={categories} checked={checked} onToggle={toggle} disabled={pending} legend="Categories" />
      <div className="flex items-center gap-3">
        <button type="button" className={cx(buttonStyles.primary)} onClick={save} disabled={pending || !dirty}>
          {pending && <Spinner />}
          {pending ? "Saving…" : "Save categories"}
        </button>
        {dirty && !pending && <span className="text-xs text-ink-subtle">Unsaved changes</span>}
      </div>
    </div>
  );
}
