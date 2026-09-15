"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  changeAffiliateUrl,
  deleteProduct,
  renameProduct,
  setProductStatus,
  type ActionResult,
  type FieldErrors,
} from "@/app/admin/actions";
import type { ProductStatus } from "@/lib/products/status";
import { AFFILIATE_URL_MAX, PRODUCT_NAME_MAX, validateAffiliateUrl, validateProductName } from "@/lib/products/validation";
import { Field } from "./add-product-dialog";
import { Modal } from "./modal";
import { buttonStyles, Spinner } from "./ui";

type Confirmable = "pause" | "archive" | "delete" | null;

const CONFIRM_COPY = {
  pause: {
    title: "Pause this product?",
    body: "It disappears from the public site and its “View official offer” link stops redirecting until you activate it again.",
    confirm: "Pause product",
    danger: false,
  },
  archive: {
    title: "Archive this product?",
    body: "Archived products are hidden from the public site and moved out of your main list. You can restore it later from the Archived filter.",
    confirm: "Archive product",
    danger: false,
  },
  delete: {
    title: "Delete this product?",
    body: "It will be removed from your admin and the public site, and its affiliate link will stop working. Click history and agency content are kept for your records, but this can't be undone from the dashboard.",
    confirm: "Delete product",
    danger: true,
  },
} as const;

export function ProductStatusControls({
  id,
  name,
  status,
  hasPublishedContent,
}: {
  id: string;
  name: string;
  status: ProductStatus;
  hasPublishedContent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Confirmable>(null);

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      setConfirming(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      after?.();
    });
  }

  const activate = () =>
    run(
      () => setProductStatus({ id, status: "active" }),
      () => {
        if (!hasPublishedContent) toast.info("It goes live on the site once the agency publishes its content.");
      },
    );

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "new" || status === "paused") && (
        <button type="button" className={buttonStyles.primary} disabled={pending} onClick={activate}>
          {pending && confirming === null && <Spinner />}
          Activate
        </button>
      )}
      {(status === "active" || status === "new") && (
        <button type="button" className={buttonStyles.secondary} disabled={pending} onClick={() => setConfirming("pause")}>
          Pause
        </button>
      )}
      {status === "archived" ? (
        <button
          type="button"
          className={buttonStyles.secondary}
          disabled={pending}
          onClick={() => run(() => setProductStatus({ id, status: "paused" }))}
        >
          Restore (as paused)
        </button>
      ) : (
        <button type="button" className={buttonStyles.secondary} disabled={pending} onClick={() => setConfirming("archive")}>
          Archive
        </button>
      )}
      <button type="button" className={buttonStyles.ghost} disabled={pending} onClick={() => setConfirming("delete")}>
        <span className="text-rose-ink">Delete</span>
      </button>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(null)}
          dismissible={!pending}
          title={CONFIRM_COPY[confirming].title}
          description={
            <>
              <span className="font-medium text-ink">{name}</span>
              <span className="mt-2 block">{CONFIRM_COPY[confirming].body}</span>
            </>
          }
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={buttonStyles.secondary} onClick={() => setConfirming(null)} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              className={CONFIRM_COPY[confirming].danger ? buttonStyles.danger : buttonStyles.primary}
              disabled={pending}
              onClick={() => {
                if (confirming === "pause") run(() => setProductStatus({ id, status: "paused" }));
                if (confirming === "archive") run(() => setProductStatus({ id, status: "archived" }));
                if (confirming === "delete") run(() => deleteProduct({ id }), () => router.replace("/admin/products"));
              }}
            >
              {pending && <Spinner />}
              {CONFIRM_COPY[confirming].confirm}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function useInlineEdit() {
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  return { editing, setEditing, errors, setErrors, pending, startTransition };
}

export function EditNameForm({ id, name }: { id: string; name: string }) {
  const { editing, setEditing, errors, setErrors, pending, startTransition } = useInlineEdit();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("name");
    const check = validateProductName(value);
    if (!check.ok) return setErrors({ name: check.error });
    if (check.value === name) return setEditing(false);

    startTransition(async () => {
      const result = await renameProduct({ id, name: value });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success(result.message, { description: "The page URL stays the same, so existing links and rankings keep working." });
      setErrors({});
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Product name</p>
          <p className="mt-1 break-words text-[15px] text-ink">{name}</p>
        </div>
        <button type="button" className={buttonStyles.secondary} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field
        id="edit-name"
        name="name"
        label="Product name"
        defaultValue={name}
        maxLength={PRODUCT_NAME_MAX}
        error={errors.name}
        autoFocus
        hint="Renaming doesn't change the product's URL."
      />
      <div className="flex gap-2">
        <button type="submit" className={buttonStyles.primary} disabled={pending}>
          {pending && <Spinner />}
          Save name
        </button>
        <button
          type="button"
          className={buttonStyles.ghost}
          disabled={pending}
          onClick={() => {
            setErrors({});
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function EditAffiliateUrlForm({ id, url }: { id: string; url: string | null }) {
  const { editing, setEditing, errors, setErrors, pending, startTransition } = useInlineEdit();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("affiliateUrl");
    const check = validateAffiliateUrl(value);
    if (!check.ok) return setErrors({ affiliateUrl: check.error });

    startTransition(async () => {
      const result = await changeAffiliateUrl({ id, affiliateUrl: value });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setErrors({});
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Affiliate URL</p>
          {url ? (
            <p className="mt-1 break-all font-mono text-[13px] text-ink">{url}</p>
          ) : (
            <p className="mt-1 text-sm text-rose-ink">No active affiliate link — visitors can&apos;t be redirected.</p>
          )}
        </div>
        <button type="button" className={buttonStyles.secondary} onClick={() => setEditing(true)}>
          {url ? "Change" : "Add link"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field
        id="edit-affiliate-url"
        name="affiliateUrl"
        label="Affiliate URL"
        type="url"
        inputMode="url"
        spellCheck={false}
        defaultValue={url ?? ""}
        maxLength={AFFILIATE_URL_MAX}
        error={errors.affiliateUrl}
        autoFocus
        hint="The previous link is kept in the history below. Only the new link receives traffic."
      />
      <div className="flex gap-2">
        <button type="submit" className={buttonStyles.primary} disabled={pending}>
          {pending && <Spinner />}
          Save URL
        </button>
        <button
          type="button"
          className={buttonStyles.ghost}
          disabled={pending}
          onClick={() => {
            setErrors({});
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
