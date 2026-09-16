import type { Instrumentation } from "next";
import { reportServerError } from "@/lib/monitoring/report";

// Next.js calls onRequestError for every server-side error it catches:
// Server Component renders, Server Actions, Route Handlers (which includes
// /go/[slug]), and the proxy. This is the framework's own hook — stable since
// v15 — so there is nothing to patch or wrap to get full server coverage.
//
// The handler deliberately does almost nothing itself. All of the judgement
// lives in reportServerError, which redacts before anything is emitted; the
// documented example for this hook POSTs `request` wholesale, and `request`
// includes the cookie header.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await reportServerError(err, request, context);
};
