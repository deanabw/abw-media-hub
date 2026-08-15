// ============================================================
// Shape A server route — STATIC-PROPERTY VARIANT
// card: widget-static-property-route-variant
// ------------------------------------------------------------
// packages/feedback-widget/README.md says this property has "nowhere to put the
// route" because it is a single static index.html.html with no framework. The
// SHAPE observation is right; the CONCLUSION is what this file tests. Vercel
// deploys any file under /api as a Serverless Function regardless of framework,
// including a project with no package.json and no build step — so the route has
// somewhere to live after all, it just cannot be the Next App Router file.
//
// DIFFERENCES FROM src/route.reference.ts, all forced by the environment:
//   • CommonJS `module.exports = (req, res)`, not `export async function POST`.
//     There is no package.json, so there is no "type":"module" and no build.
//   • Plain JS. No TypeScript, no `@/*` alias — nothing compiles here.
//   • submitFeedback is inlined rather than imported: with no bundler, an import
//     of src/lib/... would not resolve at runtime.
//
// ⛔ UNCHANGED, because these are the contract, not the implementation:
//   • The token is read from process.env server-side and NEVER reaches a browser.
//   • A failed upstream POST returns 502, never 2xx. The widget only says
//     "Thanks — that's on the board" on 2xx, and that sentence must be true.
//   • The failure log carries the user's own words so it can be re-filed by hand.
// ============================================================

const VALID_TYPES = ['bug', 'enhancement'];
const MAX_MESSAGE = 4000;
const OPERATOR_TENANT = 'dean';

function deriveTitle(message) {
  const firstLine = String(message).split('\n')[0].trim();
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '...' : firstLine;
}

async function submitFeedback(report) {
  const url = process.env.TENFOLD_FEEDBACK_INGEST_URL || null;
  const token = process.env.TENFOLD_FEEDBACK_INGEST_TOKEN || null;
  const sourceTool = process.env.TENFOLD_FEEDBACK_SOURCE_TOOL || null;

  if (!url || !token || !sourceTool) {
    console.error(
      '[feedback-widget] SUBMIT FAILED — NOT CONFIGURED. Need ' +
        'TENFOLD_FEEDBACK_INGEST_URL, TENFOLD_FEEDBACK_INGEST_TOKEN and ' +
        'TENFOLD_FEEDBACK_SOURCE_TOOL. Report was: ' + JSON.stringify(report),
    );
    return { ok: false, reason: 'not_configured' };
  }

  const payload = {
    source_tool: sourceTool,
    tenant_id: OPERATOR_TENANT,
    type: report.type,
    title: deriveTitle(report.message),
    body: report.message,
    context: {
      reporter: report.reporter || null,
      page_url: report.pageUrl || null,
      user_agent: report.userAgent || null,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        '[feedback-widget] SUBMIT FAILED http=' + res.status + ' — report was: ' + JSON.stringify(report),
      );
      return { ok: false, reason: 'http_error', status: res.status };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, id: json.id || null };
  } catch (err) {
    console.error(
      '[feedback-widget] SUBMIT FAILED network — ' + (err && err.message) +
        ' — report was: ' + JSON.stringify(report),
    );
    return { ok: false, reason: 'network_error' };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // Vercel's Node runtime parses JSON bodies, but fall back for safety.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'bad_json' }); return; }
  }
  if (!body || typeof body !== 'object') { res.status(400).json({ error: 'bad_json' }); return; }

  const type = body.type;
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  // Validated here too: this route is reachable by anything on our own origin.
  if (!VALID_TYPES.includes(type)) { res.status(400).json({ error: 'type must be bug or enhancement' }); return; }
  if (!message) { res.status(400).json({ error: 'message is required' }); return; }
  if (message.length > MAX_MESSAGE) { res.status(400).json({ error: 'message too long' }); return; }

  const outcome = await submitFeedback({
    type,
    message,
    reporter: typeof body.reporter === 'string' ? body.reporter.slice(0, 200) : null,
    pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 2000) : null,
    userAgent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null,
  });

  if (!outcome.ok) {
    res.status(502).json({ error: 'submit_failed', reason: outcome.reason });
    return;
  }
  res.status(201).json({ ok: true, id: outcome.id });
};
