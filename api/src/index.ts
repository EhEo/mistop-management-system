import { createActivityLog, getUserActivityLogs, getAllActivityLogs, getActivityLogsByAction } from './utils/activityLog'
import { validatePassword } from './utils/passwordValidator'
import { checkLoginAttempts, recordFailedLogin, clearLoginAttempts } from './utils/loginAttempts'
import { generateResetToken, hashResetToken } from './utils/resetToken'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { connectDB, getDB } from './db/mongodb'
import { ObjectId } from 'mongodb'
import 'dotenv/config'
import { hashPassword, comparePassword } from './utils/password'
import { generateToken } from './utils/jwt'
import { authMiddleware, adminMiddleware } from './middleware/auth'

const app = new Hono()

// MongoDB 연결 초기화
connectDB().catch(console.error)

// ===== 인증 라우트 (public) =====

// 회원가입
app.post('/auth/register', async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()
    
    // 이메일 중복 확인
    const existingUser = await db.collection('users').findOne({ email: body.email })
    if (existingUser) {
      return c.json({ error: 'Email already exists' }, 400)
    }

    // 비밀번호 강도 검증
    const passwordCheck = validatePassword(body.password)
    if (!passwordCheck.isValid) {
      return c.json({ 
        error: '비밀번호가 보안 요구사항을 충족하지 않습니다',
        feedback: passwordCheck.feedback
      }, 400)
    }
    
    // 비밀번호 해싱
    const hashedPassword = await hashPassword(body.password)
    
    const newUser = {
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: body.role || 'user',
      country: body.country,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('users').insertOne(newUser)
    
    // JWT 토큰 생성
    const token = generateToken({
      userId: result.insertedId.toString(),
      email: newUser.email,
      role: newUser.role
    })
    
    return c.json({ 
      message: 'User registered successfully',
      token,
      user: {
        id: result.insertedId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    }, 201)
  } catch (error) {
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// 로그인
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()
    const ipAddress = c.req.header('x-real-ip') || c.req.header('x-forwarded-for') || 'unknown'

    // 로그인 시도 횟수 확인
    const attemptCheck = await checkLoginAttempts(body.email, ipAddress)
    if (!attemptCheck.allowed) {
      return c.json({ error: attemptCheck.message }, 429) // 429 Too Many Requests
    }

    // 사용자 찾기
    const user = await db.collection('users').findOne({ email: body.email })
    if (!user) {
      // 실패 기록
      const remainingAttempts = await recordFailedLogin(body.email, ipAddress)
      return c.json({ 
        error: 'Invalid credentials',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : undefined
      }, 401)
    }

    // 비밀번호 확인
    const isValid = await comparePassword(body.password, user.password)
    if (!isValid) {
      // 실패 기록
      const remainingAttempts = await recordFailedLogin(body.email, ipAddress)
      return c.json({ 
        error: 'Invalid credentials',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : undefined,
        message: remainingAttempts > 0 ? `${remainingAttempts}번의 시도가 남았습니다.` : undefined
      }, 401)
    }

    // 로그인 성공 - 시도 횟수 초기화
    await clearLoginAttempts(body.email, ipAddress)

    // JWT 토큰 생성
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    })

    // 활동 로그 기록
    await createActivityLog({
      userId: user._id.toString(),
      userName: user.name,
      userEmail: user.email,
      action: 'LOGIN',
      description: '로그인했습니다',
      ipAddress: ipAddress,
      userAgent: c.req.header('user-agent') || 'unknown'
    })

    return c.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country
      }
    })
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500)
  }
})





// 현재 사용자 정보 (보호된 라우트)
app.get('/auth/me', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as any
    const db = await getDB()
    
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(currentUser.userId) 
    })
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    return c.json({ error: 'Failed to fetch user info' }, 500)
  }
})


// 기본 경로
app.get('/', (c) => {
  return c.json({ 
    message: 'Welcome to API Service with MongoDB',
    timestamp: new Date().toISOString(),
    service: 'api',
    database: 'connected'
  })
})

// 상태 확인
app.get('/status', (c) => {
  return c.json({ 
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'MongoDB'
  })
})

// ===== Users CRUD =====

// 사용자 목록 조회
app.get('/users', authMiddleware, async (c) => {
  try {
    const db = await getDB()
    const users = await db.collection('users').find().toArray()
    return c.json({ 
      users: users.map(u => ({
        _id: u._id,
       name: u.name,
        email: u.email,
        role: u.role,
        country: u.country,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      })),
      total: users.length
    })
  } catch (error) {
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

// 사용자 단일 조회
app.get('/users/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDB()
    const user = await db.collection('users').findOne({ _id: new ObjectId(id) })
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({ user })
  } catch (error) {
    return c.json({ error: 'Invalid user ID' }, 400)
  }
})

// 사용자 생성
app.post('/users', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()
    
    const newUser = {
      name: body.name,
      email: body.email,
      role: body.role || 'user',
      country: body.country,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('users').insertOne(newUser)
    
    return c.json({ 
      message: 'User created successfully',
      userId: result.insertedId,
      user: newUser
    }, 201)
  } catch (error) {
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

// 사용자 수정
app.put('/users/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const db = await getDB()
    
    const updateData = {
      ...body,
      updatedAt: new Date()
    }
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({ 
      message: 'User updated successfully',
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

// 사용자 삭제
app.delete('/users/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const db = await getDB()

    // 삭제 전 사용자 정보 조회
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(id) })
    
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) })
    
    if (result.deletedCount === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    // 활동 로그 기록
    const currentUser = c.get('user') as any
    if (targetUser) {
      await createActivityLog({
        userId: currentUser.userId,
        userName: currentUser.email,
        userEmail: currentUser.email,
        action: 'USER_DELETE',
        description: `${targetUser.name} 사용자를 삭제했습니다`,
        targetUserId: targetUser._id.toString(),
        targetUserName: targetUser.name
      })
    }    
    return c.json({ 
      message: 'User deleted successfully'
    })
  } catch (error) {
    return c.json({ error: 'Failed to delete user' }, 500)
  }
})

// 비밀번호 재설정 요청
app.post('/auth/forgot-password', async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()
    
    // 사용자 찾기
    const user = await db.collection('users').findOne({ email: body.email })
    if (!user) {
      // 보안상 사용자가 없어도 성공 메시지 반환
      return c.json({ 
        message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.' 
      })
    }
    
    // 재설정 토큰 생성
    const resetToken = generateResetToken()
    const hashedToken = hashResetToken(resetToken)
    
    // 토큰 저장 (1시간 유효)
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() + 3600000) // 1시간
        } 
      }
    )
    
    // 실제로는 이메일로 전송해야 하지만, 지금은 토큰을 반환
    // 프로덕션에서는 이메일 서비스 연동 필요
    return c.json({ 
      message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.',
      // 개발용으로만 토큰 반환 (프로덕션에서는 제거)
      resetToken: resetToken,
      resetUrl: `https://www.mistop.org/reset-password.html?token=${resetToken}`
    })
  } catch (error) {
    return c.json({ error: '비밀번호 재설정 요청에 실패했습니다.' }, 500)
  }
})

// 비밀번호 재설정 실행
app.post('/auth/reset-password', async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()
    
    // 토큰 해싱
    const hashedToken = hashResetToken(body.token)
    
    // 토큰으로 사용자 찾기 (만료 시간 확인)
    const user = await db.collection('users').findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    })
    
    if (!user) {
      return c.json({ 
        error: '유효하지 않거나 만료된 토큰입니다.' 
      }, 400)
    }

    // 비밀번호 강도 검증
    const passwordCheck = validatePassword(body.password)
    if (!passwordCheck.isValid) {
      return c.json({ 
        error: '비밀번호가 보안 요구사항을 충족하지 않습니다',
        feedback: passwordCheck.feedback
      }, 400)
    }
    
    // 새 비밀번호 해싱
    const hashedPassword = await hashPassword(body.password)
    
    // 비밀번호 업데이트 및 토큰 제거
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        },
        $unset: {
          resetPasswordToken: '',
          resetPasswordExpires: ''
        }
      }
    )
    
    return c.json({ 
      message: '비밀번호가 성공적으로 재설정되었습니다.' 
    })
  } catch (error) {
    return c.json({ error: '비밀번호 재설정에 실패했습니다.' }, 500)
  }
})

// 프로필 업데이트
app.put('/auth/profile', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as any
    const body = await c.req.json()
    const db = await getDB()

    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: '이름을 입력해주세요' }, 400)
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(currentUser.userId) },
      {
        $set: {
          name: body.name.trim(),
          updatedAt: new Date()
        }
      }
    )

    if (result.matchedCount === 0) {
      return c.json({ error: '사용자를 찾을 수 없습니다' }, 404)
    }

    const updatedUser = await db.collection('users').findOne({
      _id: new ObjectId(currentUser.userId)
    })

    if (!updatedUser) {
       return c.json({ error: '사용자를 찾을 수 없습니다' }, 404)
    }

 // 활동 로그 기록
    await createActivityLog({
      userId: currentUser.userId,
      userName: updatedUser.name,
      userEmail: updatedUser.email,
      action: 'PROFILE_UPDATE',
      description: '프로필 정보를 수정했습니다',
      metadata: { newName: body.name.trim() }
    })

    return c.json({
      message: '프로필이 업데이트되었습니다',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    })
  } catch (error) {
    return c.json({ error: '프로필 업데이트에 실패했습니다' }, 500)
  }
})

// 비밀번호 변경
app.post('/auth/change-password', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as any
    const body = await c.req.json()
    const db = await getDB()

    if (!body.currentPassword || !body.newPassword) {
      return c.json({ error: '모든 필드를 입력해주세요' }, 400)
    }

    // 비밀번호 강도 검증
    const passwordCheck = validatePassword(body.newPassword)
    if (!passwordCheck.isValid) {
      return c.json({ 
        error: '비밀번호가 보안 요구사항을 충족하지 않습니다',
        feedback: passwordCheck.feedback,
        strength: passwordCheck.strength
      }, 400)
    }

    // 현재 사용자 찾기
    const user = await db.collection('users').findOne({
      _id: new ObjectId(currentUser.userId)
    })

    if (!user) {
      return c.json({ error: '사용자를 찾을 수 없습니다' }, 404)
    }

    // 현재 비밀번호 확인
    const isValid = await comparePassword(body.currentPassword, user.password)
    if (!isValid) {
      return c.json({ error: '현재 비밀번호가 일치하지 않습니다' }, 401)
    }

    // 새 비밀번호 해싱
    const hashedPassword = await hashPassword(body.newPassword)

    // 비밀번호 업데이트
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    )

    // 활동 로그 기록
    await createActivityLog({
      userId: currentUser.userId,
      userName: user.name,
      userEmail: user.email,
      action: 'PASSWORD_CHANGE',
      description: '비밀번호를 변경했습니다',
      ipAddress: c.req.header('x-real-ip') || c.req.header('x-forwarded-for') || 'unknown'
    })

    return c.json({ message: '비밀번호가 변경되었습니다' })
  } catch (error) {
    return c.json({ error: '비밀번호 변경에 실패했습니다' }, 500)
  }
})

// 계정 삭제
app.delete('/auth/delete-account', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as any
    const body = await c.req.json()
    const db = await getDB()

    if (!body.password) {
      return c.json({ error: '비밀번호를 입력해주세요' }, 400)
    }

    // 사용자 찾기
    const user = await db.collection('users').findOne({
      _id: new ObjectId(currentUser.userId)
    })

    if (!user) {
      return c.json({ error: '사용자를 찾을 수 없습니다' }, 404)
    }

    // 비밀번호 확인
    const isValid = await comparePassword(body.password, user.password)
    if (!isValid) {
      return c.json({ error: '비밀번호가 일치하지 않습니다' }, 401)
    }

    // 사용자 삭제
    await db.collection('users').deleteOne({ _id: user._id })

    return c.json({ message: '계정이 삭제되었습니다' })
  } catch (error) {
    return c.json({ error: '계정 삭제에 실패했습니다' }, 500)
  }
})

// 사용자 역할 변경 (관리자 전용)
app.put('/users/:id/role', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const db = await getDB()

    if (!body.role || !['user', 'admin'].includes(body.role)) {
      return c.json({ error: '유효하지 않은 역할입니다' }, 400)
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          role: body.role,
          updatedAt: new Date()
        }
      }
    )

    if (result.matchedCount === 0) {
      return c.json({ error: '사용자를 찾을 수 없습니다' }, 404)
    }

    // 대상 사용자 정보 조회 및 활동 로그 기록
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(id) })
    const currentUser = c.get('user') as any

    if (targetUser) {
      await createActivityLog({
        userId: currentUser.userId,
        userName: currentUser.email,
        userEmail: currentUser.email,
        action: 'ROLE_CHANGE',
        description: `${targetUser.name}의 역할을 ${body.role}로 변경했습니다`,
        targetUserId: targetUser._id.toString(),
        targetUserName: targetUser.name,
        metadata: { newRole: body.role }
      })
    }


    return c.json({ 
      message: '역할이 변경되었습니다',
      role: body.role 
    })
  } catch (error) {
    return c.json({ error: '역할 변경에 실패했습니다' }, 500)
  }
})

// 대량 사용자 삭제 (관리자 전용)
app.post('/users/bulk-delete', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()

    if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
      return c.json({ error: '삭제할 사용자를 선택해주세요' }, 400)
    }

    const objectIds = body.userIds.map((id: string) => new ObjectId(id))
    const result = await db.collection('users').deleteMany({
      _id: { $in: objectIds }
    })

    // 활동 로그 기록
    const currentUser = c.get('user') as any
    await createActivityLog({
      userId: currentUser.userId,
      userName: currentUser.email,
      userEmail: currentUser.email,
      action: 'BULK_DELETE',
      description: `${result.deletedCount}명의 사용자를 삭제했습니다`,
      metadata: { userIds: body.userIds, count: result.deletedCount }
    })

    return c.json({ 
      message: `${result.deletedCount}명의 사용자가 삭제되었습니다`,
      deletedCount: result.deletedCount
    })
  } catch (error) {
    return c.json({ error: '사용자 삭제에 실패했습니다' }, 500)
  }
})

// 사용자 활동 로그 조회 (본인)
app.get('/auth/activity-logs', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as any
    const limit = parseInt(c.req.query('limit') || '10')
    
    const logs = await getUserActivityLogs(currentUser.userId, limit)
    
    return c.json({ logs, total: logs.length })
  } catch (error) {
    return c.json({ error: '활동 로그 조회에 실패했습니다' }, 500)
  }
})

// 전체 활동 로그 조회 (관리자 전용)
app.get('/admin/activity-logs', authMiddleware, adminMiddleware, async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50')
    
    const logs = await getAllActivityLogs(limit)
    
    return c.json({ logs, total: logs.length })
  } catch (error) {
    return c.json({ error: '활동 로그 조회에 실패했습니다' }, 500)
  }
})

// 특정 액션별 로그 조회 (관리자 전용)
app.get('/admin/activity-logs/:action', authMiddleware, adminMiddleware, async (c) => {
  try {
    const action = c.req.param('action')
    const limit = parseInt(c.req.query('limit') || '20')
    
    const logs = await getActivityLogsByAction(action, limit)
    
    return c.json({ logs, total: logs.length })
  } catch (error) {
    return c.json({ error: '활동 로그 조회에 실패했습니다' }, 500)
  }
})



// 대량 역할 변경 (관리자 전용)
app.post('/users/bulk-role', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()

    if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
      return c.json({ error: '변경할 사용자를 선택해주세요' }, 400)
    }

    if (!body.role || !['user', 'admin'].includes(body.role)) {
      return c.json({ error: '유효하지 않은 역할입니다' }, 400)
    }

    const objectIds = body.userIds.map((id: string) => new ObjectId(id))
    const result = await db.collection('users').updateMany(
      { _id: { $in: objectIds } },
      {
        $set: {
          role: body.role,
          updatedAt: new Date()
        }
      }
    )

    // 활동 로그 기록
    const currentUser = c.get('user') as any
    await createActivityLog({
      userId: currentUser.userId,
      userName: currentUser.email,
      userEmail: currentUser.email,
      action: 'BULK_ROLE_CHANGE',
      description: `${result.modifiedCount}명의 사용자 역할을 ${body.role}로 변경했습니다`,
      metadata: { userIds: body.userIds, newRole: body.role, count: result.modifiedCount }
    })


    return c.json({ 
      message: `${result.modifiedCount}명의 역할이 변경되었습니다`,
      modifiedCount: result.modifiedCount,
      role: body.role
    })
  } catch (error) {
    return c.json({ error: '역할 변경에 실패했습니다' }, 500)
  }
})



// ===== Projects CRUD =====

// 프로젝트 목록 조회
app.get('/projects', async (c) => {
  try {
    const db = await getDB()
    const projects = await db.collection('projects').find().toArray()
    return c.json({ 
      projects,
      total: projects.length
    })
  } catch (error) {
    return c.json({ error: 'Failed to fetch projects' }, 500)
  }
})

// 프로젝트 생성
app.post('/projects', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const db = await getDB()
    
    const newProject = {
      name: body.name,
      description: body.description,
      status: body.status || 'planning',
      country: body.country,
      progress: body.progress || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('projects').insertOne(newProject)
    
    return c.json({ 
      message: 'Project created successfully',
      projectId: result.insertedId,
      project: newProject
    }, 201)
  } catch (error) {
    return c.json({ error: 'Failed to create project' }, 500)
  }
})

const port = parseInt(process.env.PORT || '3000')

console.log(`🚀 API Service starting on port ${port}`)

serve({
  fetch: app.fetch,
  port: port
})
