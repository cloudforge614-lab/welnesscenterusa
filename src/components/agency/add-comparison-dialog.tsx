"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { createComparison } from "@/app/agency/comparisons-actions";
import { Modal } from "@/components/admin/modal";
import { buttonStyles, inputStyles, Spinner } from "@/components/admin/ui";

export function AddComparisonButton() {
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
        Add comparison
      </button>
      <AddComparisonDialog key={formKey} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddComparisonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError("Enter a comparison title.");
    setError(null);

    startTransition(async () => {
      const result = await createComparison({ title });
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      onClose();
      router.push(`/agency/comparisons/${result.data!.id}`);
    });
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!pending} title="Add a comparison" description="Give it a title — you'll add the products and write the comparison in the editor.">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="comparison-title" className="block text-sm font-medium text-ink">
            Comparison title
          </label>
          <input id="comparison-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. ProDentim vs. Steel Bite Pro" className={inputStyles} autoComplete="off" />
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
            {pending ? "Creating…" : "Create comparison"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
