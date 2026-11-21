import { waitUntil } from "@vercel/functions";
import app from "../server/index";
import { buildEnv, missingSettings } from "../server/env";

// One Vercel Function handles every /api/... request (see rewrites in vercel.json).
export default {
  async fetch(request: Request): Promise<Response> {
    const missing = missingSettings();
    if (missing.length) {
      return Response.json({ error: "Setup incomplete", missing }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return app.fetch(request, buildEnv(), { waitUntil, passThroughOnException() {} } as any);
  },
};
