import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './lib/env'
import { authRouter } from './routes/auth.routes'
import { usersRouter } from './routes/users.routes'
import { clientsRouter } from './routes/clients.routes'
import { projectsRouter } from './routes/projects.routes'
import { tasksRouter } from './routes/tasks.routes'
import { timesheetsRouter } from './routes/timesheets.routes'
import { notificationsRouter } from './routes/notifications.routes'
import { dashboardRouter } from './routes/dashboard.routes'
import searchRouter from './routes/search.routes'
import leadsRouter from './routes/leads.routes'
import { milestonesRouter } from './routes/milestones.routes'
import { invoicesRouter } from './routes/invoices.routes'
import { reportsRouter } from './routes/reports.routes'
import { gitRouter } from './routes/git.routes'
import { webhookRouter } from './routes/webhook.routes'

const app = express()

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
)
app.use(cookieParser())

// Webhook route uses raw body for HMAC verification — must come before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRouter)

app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/timesheets', timesheetsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/search', searchRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/projects/:id/milestones', milestonesRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/tasks/:id/git', gitRouter)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

app.listen(env.PORT, () => {
  console.log(`DataFever Hub Backend running on http://localhost:${env.PORT}`)
})

export { app }
