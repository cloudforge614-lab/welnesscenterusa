"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type InputHTMLAttributes } from "react";
import { toast } from "sonner";
import { createProduct, type FieldErrors } from "@/app/admin/actions";
import { AFFILIATE_URL_MAX, PRODUCT_NAME_MAX, validateAffiliateUrl, validateProductName } from "@/lib/products/validation";
import { ALLOWED_IMAGE_ACCEPT, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/products/image-constants";
import { Modal } from "./modal";
import { buttonStyles, cx, inputStyles, Spinner } from "./ui";

function validateImageFile(file: File | undefined): string | undefined {
  if (!file || file.size === 0) return "Choose a product image.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 5 MB or smaller.";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "Only JPEG, PNG, or WebP images are allowed.";
  return undefined;
}

export function AddProductButton({ label = "Add product", className }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  // Remounting the form on each open resets fields and errors without extra state.
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <button
        type="button"
        className={cx(buttonStyles.primary, className)}
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        {label}
      </button>
      <AddProductDialog key={formKey} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nameInput = form.get("name");
    const urlInput = form.get("affiliateUrl");
    const imageFile = form.get("image");
    const file = imageFile instanceof File ? imageFile : undefined;

    const name = validateProductName(nameInput);
    const url = validateAffiliateUrl(urlInput);
    const imageError = validateImageFile(file);
    const clientErrors: FieldErrors = {
      name: name.ok ? undefined : name.error,
      affiliateUrl: url.ok ? undefined : url.error,
      image: imageError,
    };
    setErrors(clientErrors);
    setFormError(null);
    if (!name.ok || !url.ok || imageError) return;

    startTransition(async () => {
      // The image travels as a File, so the whole submission goes through
      // FormData rather than a plain object — Server Actions can only carry
      // a File inside FormData.
      const result = await createProduct(form);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      const product = result.data!;
      toast.success(result.message, {
        description: `/products/${product.slug} · Live on the homepage · Awaiting agency content`,
        action: { label: "View", onClick: () => router.push(`/admin/products/${product.id}`) },
      });
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Add a product"
      description="Name, main image, and your affiliate link. It goes live on the homepage right away — the agency adds everything else."
    >
      <form onSubmit={handleSubmit} noValidate encType="multipart/form-data" className="space-y-5">
        <Field
          id="product-name"
          name="name"
          label="Product name"
          placeholder="e.g. ProDentim"
          maxLength={PRODUCT_NAME_MAX}
          autoComplete="off"
          error={errors.name}
          autoFocus
        />
        <ImageField
          id="product-image"
          name="image"
          label="Product image"
          error={errors.image}
          hint="The main photo shown on the homepage card. JPEG, PNG, or WebP, up to 5 MB."
        />
        <Field
          id="product-affiliate-url"
          name="affiliateUrl"
          label="Affiliate URL"
          placeholder="https://"
          type="url"
          inputMode="url"
          maxLength={AFFILIATE_URL_MAX}
          autoComplete="off"
          spellCheck={false}
          error={errors.affiliateUrl}
          hint="Visitors reach this link only through your tracked “View official offer” button."
        />

        {formError && (
          <p role="alert" className="rounded-lg bg-rose-soft px-3.5 py-2.5 text-sm text-rose-ink">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" className={buttonStyles.secondary} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className={buttonStyles.primary} disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Adding…" : "Add product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImageField({
  id,
  name,
  label,
  error,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept={ALLOWED_IMAGE_ACCEPT}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          inputStyles,
          "file:mr-3 file:rounded-md file:border-0 file:bg-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-line",
        )}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-rose-ink">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-ink-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  ...inputProps
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputStyles}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-rose-ink">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-ink-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
