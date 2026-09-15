import Link from "next/link";
import { buttonStyles, Card } from "@/components/admin/ui";

export default function ProductNotFound() {
  return (
    <Card className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="font-display text-2xl text-ink">Product not found</h1>
      <p className="mt-2 text-sm text-ink-muted">It may have been deleted, or the link is incorrect.</p>
      <Link href="/admin/products" className={`${buttonStyles.secondary} mt-6`}>
        Back to products
      </Link>
    </Card>
  );
}
