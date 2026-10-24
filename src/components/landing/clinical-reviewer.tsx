import Image from "next/image";

// The named clinical reviewer shown on every landing page. One reviewer for
// the whole site, so the details live here rather than in each product's
// content. Only state what the reviewer has confirmed about themselves.
export const REVIEWER = {
  name: "James Willson",
  credentials: "PharmD",
  title: "Clinical Pharmacist",
  image: "/team/james-willson.jpg",
  bio: [
    "James Willson is a clinical pharmacist with a Doctor of Pharmacy (PharmD) qualification and six years of professional experience in clinical pharmacy and the review of health-related information.",
    "He reviews health and wellness content on Wellness Center USA for accuracy, clarity, appropriate terminology and responsible presentation of product information — including ingredient details, usage instructions, precautions and references to scientific research, where applicable.",
    "His goal is to help readers understand health and wellness information clearly, tell product claims apart from established evidence, and make better-informed decisions.",
  ],
} as const;

/** One-line byline for the hero. */
export function ReviewerByline() {
  return (
    <p className="mt-4 flex items-center justify-center gap-2.5 text-xs text-[var(--lp-muted)]">
      <Image src={REVIEWER.image} alt="" width={28} height={28} className="size-7 rounded-full object-cover" />
      <span>
        Clinical review by{" "}
        <a href="#clinical-reviewer" className="font-semibold text-[var(--lp-text)] underline underline-offset-2">
          {REVIEWER.name}, {REVIEWER.credentials}
        </a>
      </span>
    </p>
  );
}

/** Full reviewer card with photo and bio. */
export function ReviewerCard() {
  return (
    <section id="clinical-reviewer" aria-labelledby="clinical-reviewer-heading" className="lp-glass rounded-[20px] p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Image
          src={REVIEWER.image}
          alt={`${REVIEWER.name}, ${REVIEWER.credentials}, ${REVIEWER.title}`}
          width={160}
          height={160}
          className="size-28 shrink-0 rounded-2xl object-cover sm:size-36"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lp-muted)]">Clinical reviewer</p>
          <h2 id="clinical-reviewer-heading" className="font-display mt-1 text-2xl font-extrabold leading-tight text-[var(--lp-primary)]">
            {REVIEWER.name}, {REVIEWER.credentials}
          </h2>
          <p className="mt-1 text-sm font-medium text-[var(--lp-muted)]">
            {REVIEWER.title} · Health content reviewer · Six years&rsquo; professional experience
          </p>
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[var(--lp-muted)]">
            {REVIEWER.bio.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
