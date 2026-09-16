import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/agency/article-editor";
import { Badge } from "@/components/admin/ui";
import { getAgencyArticle } from "@/lib/articles/agency-queries";
import { getAgencySession } from "@/lib/auth/agency";
import { contentMeta } from "@/lib/products/status";

export async function generateMetadata(props: PageProps<"/agency/articles/[id]">) {
  const { id } = await props.params;
  const article = await getAgencyArticle(id);
  return { title: article?.title ?? "Article" };
}

export default async function AgencyArticlePage(props: PageProps<"/agency/articles/[id]">) {
  const { id } = await props.params;
  const [article, session] = await Promise.all([getAgencyArticle(id), getAgencySession()]);
  if (!article) notFound();
  if (session.state !== "agency") notFound();

  const meta = contentMeta(article.status);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <Link href="/agency/articles" className="text-sm font-medium text-ink-muted hover:text-ink">
          ← Articles
        </Link>
        <div className="mt-3 min-w-0">
          <h1 className="break-words font-display text-3xl text-ink">{article.title}</h1>
          {article.category && <p className="mt-1 text-sm text-ink-subtle">{article.category.name}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-muted">
          Publishing here makes this article visible at /blog immediately. Related products only appear publicly
          while they&apos;re themselves eligible.
        </p>
      </div>

      <ArticleEditor article={article} role={session.role} />
    </div>
  );
}
