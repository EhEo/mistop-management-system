import { getDB } from '../db/mongodb'

interface LoginAttempt {
  email: string
  ipAddress: string
  attempts: number
  lockedUntil?: Date
  lastAttempt: Date
}

const MAX_ATTEMPTS = 5
const LOCK_TIME = 15 * 60 * 1000 // 15분

export async function checkLoginAttempts(email: string, ipAddress: string): Promise<{ allowed: boolean; message?: string; remainingAttempts?: number }> {
  try {
    const db = await getDB()
    const collection = db.collection('login_attempts')

    const attempt = await collection.findOne({ email, ipAddress })

    if (!attempt) {
      return { allowed: true }
    }

    // 잠금 시간이 지났는지 확인
    if (attempt.lockedUntil && new Date() < attempt.lockedUntil) {
      const remainingMinutes = Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60000)
      return {
        allowed: false,
        message: `계정이 잠겼습니다. ${remainingMinutes}분 후 다시 시도하세요.`
      }
    }

    // 잠금이 풀렸으면 초기화
    if (attempt.lockedUntil && new Date() >= attempt.lockedUntil) {
      await collection.deleteOne({ email, ipAddress })
      return { allowed: true }
    }

    // 시도 횟수 확인
    if (attempt.attempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_TIME)
      await collection.updateOne(
        { email, ipAddress },
        { $set: { lockedUntil, lastAttempt: new Date() } }
      )
      return {
        allowed: false,
        message: '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도하세요.'
      }
    }

    const remainingAttempts = MAX_ATTEMPTS - attempt.attempts
    return { allowed: true, remainingAttempts }
  } catch (error) {
    console.error('로그인 시도 확인 오류:', error)
    return { allowed: true } // 에러 시 로그인 허용 (안전 장치)
  }
}

export async function recordFailedLogin(email: string, ipAddress: string): Promise<number> {
  try {
    const db = await getDB()
    const collection = db.collection('login_attempts')

    const attempt = await collection.findOne({ email, ipAddress })

    if (!attempt) {
      await collection.insertOne({
        email,
        ipAddress,
        attempts: 1,
        lastAttempt: new Date()
      })
      return MAX_ATTEMPTS - 1 // 남은 시도 횟수
    }

    const newAttempts = attempt.attempts + 1
    await collection.updateOne(
      { email, ipAddress },
      {
        $set: {
          attempts: newAttempts,
          lastAttempt: new Date()
        }
      }
    )

    return Math.max(0, MAX_ATTEMPTS - newAttempts)
  } catch (error) {
    console.error('실패한 로그인 기록 오류:', error)
    return 0
  }
}

export async function clearLoginAttempts(email: string, ipAddress: string): Promise<void> {
  try {
    const db = await getDB()
    await db.collection('login_attempts').deleteOne({ email, ipAddress })
  } catch (error) {
    console.error('로그인 시도 초기화 오류:', error)
  }
}

export async function cleanupOldAttempts(): Promise<void> {
  try {
    const db = await getDB()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    await db.collection('login_attempts').deleteMany({
      lastAttempt: { $lt: oneDayAgo },
      lockedUntil: { $exists: false }
    })
  } catch (error) {
    console.error('오래된 로그인 시도 정리 오류:', error)
  }
}
