import { getDB } from '../db/mongodb'

export interface ActivityLog {
  userId: string
  userName: string
  userEmail: string
  action: string
  description: string
  ipAddress?: string
  userAgent?: string
  targetUserId?: string
  targetUserName?: string
  metadata?: any
  createdAt: Date
}

export async function createActivityLog(log: Omit<ActivityLog, 'createdAt'>) {
  try {
    const db = await getDB()
    
    const logEntry: ActivityLog = {
      ...log,
      createdAt: new Date()
    }

    await db.collection('activity_logs').insertOne(logEntry)
    console.log(`📝 Activity logged: ${log.action} by ${log.userName}`)
  } catch (error) {
    console.error('Failed to create activity log:', error)
  }
}

export async function getUserActivityLogs(userId: string, limit: number = 10) {
  try {
    const db = await getDB()
    
    const logs = await db.collection('activity_logs')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return logs
  } catch (error) {
    console.error('Failed to get user activity logs:', error)
    return []
  }
}

export async function getAllActivityLogs(limit: number = 50) {
  try {
    const db = await getDB()
    
    const logs = await db.collection('activity_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return logs
  } catch (error) {
    console.error('Failed to get all activity logs:', error)
    return []
  }
}

export async function getActivityLogsByAction(action: string, limit: number = 20) {
  try {
    const db = await getDB()
    
    const logs = await db.collection('activity_logs')
      .find({ action })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return logs
  } catch (error) {
    console.error('Failed to get activity logs by action:', error)
    return []
  }
}
