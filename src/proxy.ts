import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /agency has its own login page (separate from /admin/login) since the two
// areas gate on different roles; signed-out visitors are bounced to whichever
// one matches the section they tried to reach.
function loginPathFor(pathname: string) {
  return pathname.startsWith("/agency") ? "/agency/login" : "/admin/login";
}

// Refreshes the Supabase session cookie and bounces signed-out visitors away
// from the admin/agency areas. This is a convenience layer only: owner/agency
// authorization is enforced again in the respective layout and every server
// action.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;
  const loginPath = loginPathFor(pathname);

  if (!signedIn && pathname !== loginPath) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/agency", "/agency/:path*"],
};
