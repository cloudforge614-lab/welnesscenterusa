"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { createGuide, listCategories } from "@/app/agency/guides-actions";
import { Modal } from "@/components/admin/modal";
import { buttonStyles, inputStyles, Spinner } from "@/components/admin/ui";

export function AddGuideButton() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <button
        type="button"
        className={buttonStyles.primary}
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Add guide
      </button>
      <AddGuideDialog key={formKey} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    listCategories().then((result) => {
      if (result.ok) setCategories(result.data ?? []);
    });
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError("Enter a guide title.");
    setError(null);

    startTransition(async () => {
      const result = await createGuide({ title, categoryId: categoryId || null });
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      onClose();
      router.push(`/agency/guides/${result.data!.id}`);
    });
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!pending} title="Add a guide" description="Give the guide a title and, optionally, a category. You'll write the rest in the editor.">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="guide-title" className="block text-sm font-medium text-ink">
            Guide title
          </label>
          <input id="guide-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. A Complete Guide to Better Sleep" className={inputStyles} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="guide-category" className="block text-sm font-medium text-ink">
            Category (optional)
          </label>
          <select id="guide-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputStyles}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-soft px-3.5 py-2.5 text-sm text-rose-ink">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" className={buttonStyles.secondary} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className={buttonStyles.primary} disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Creating…" : "Create guide"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
