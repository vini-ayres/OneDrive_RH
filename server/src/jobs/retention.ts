import { env } from '../env.js'
import { purgeAuditLogsOlderThan } from '../services/auditQueries.js'

async function runRetentionJob() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - env.auditRetentionDays)

  console.log(`Purging audit logs older than ${cutoff.toISOString()} (${env.auditRetentionDays} days)...`)

  const deleted = await purgeAuditLogsOlderThan(cutoff)
  console.log(`Purged ${deleted} audit log records.`)
}

runRetentionJob().catch((err) => {
  console.error('Retention job failed:', err)
  process.exit(1)
})
