import { v4 as uuidv4 } from 'uuid'
import type { DataPayload } from '../../../shared/schema'

const MAX_ACTIVITY_LOGS = 200

export function appendActivityLog(
  data: DataPayload,
  summary: string,
  entityType: string,
  entityId?: string | null,
  action = 'update'
): DataPayload {
  const entry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId: entityId ?? null,
    summary
  }

  const activityLogs = [entry, ...data.activityLogs].slice(0, MAX_ACTIVITY_LOGS)
  return { ...data, activityLogs }
}