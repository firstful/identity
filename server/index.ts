import 'dotenv/config'
import express from 'express'
import { toNodeHandler } from './auth.js'
import { auth } from './auth.js'
import { fromNodeHeaders } from './auth.js'

const PORT = Number(process.env.PORT || 3002)
const app = express()

app.disable('x-powered-by')

// Better-Auth — must be before express.json() for raw body access.
app.all('/api/auth/*', toNodeHandler(auth))

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'identity', auth: '/api/auth' }))

// Tiny landing page for humans hitting identity.ffilt.us directly.
app.get('/', async (req, res) => {
  let email: string | null = null
  try {
    const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    email = s?.user?.email ?? null
  } catch { /* not signed in */ }
  res.set('Content-Type', 'text/html')
  res.send(`<!doctype html><meta charset="utf-8"><title>identity</title>
<body style="font-family:system-ui;background:#111;color:#eee;padding:3rem">
<h1>identity.ffilt.us</h1>
<p>User/pass auth service (better-auth). No email verification.</p>
${email ? `<p>✅ Signed in as <b>${escapeHtml(email)}</b></p>` : '<p>Not signed in.</p>'}
<p>Endpoints: <code>/api/auth/sign-up/email</code>, <code>/api/auth/sign-in/email</code>, <code>/api/auth/get-session</code>, <code>/api/auth/sign-out</code></p>
</body>`)
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

app.listen(PORT, () => console.log(`identity server on :${PORT}`))
