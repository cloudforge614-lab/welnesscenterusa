// Deliberately separate from src/components/admin/ui.tsx: public code should
// never import from the admin component tree, even for trivial formatting
// helpers, so the owner/public boundary stays mechanically enforced, not
// just conventional.
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
