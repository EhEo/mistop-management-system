export interface PasswordStrength {
  isValid: boolean
  score: number // 0-5
  feedback: string[]
  strength: 'very-weak' | 'weak' | 'medium' | 'strong' | 'very-strong'
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  // 최소 길이 확인
  if (password.length < 8) {
    feedback.push('비밀번호는 최소 8자 이상이어야 합니다')
    return {
      isValid: false,
      score: 0,
      feedback,
      strength: 'very-weak'
    }
  }

  // 길이 점수
  if (password.length >= 8) score++
  if (password.length >= 12) score++

  // 대문자 포함
  if (/[A-Z]/.test(password)) {
    score++
  } else {
    feedback.push('대문자를 포함하세요')
  }

  // 소문자 포함
  if (/[a-z]/.test(password)) {
    score++
  } else {
    feedback.push('소문자를 포함하세요')
  }

  // 숫자 포함
  if (/[0-9]/.test(password)) {
    score++
  } else {
    feedback.push('숫자를 포함하세요')
  }

  // 특수문자 포함
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score++
  } else {
    feedback.push('특수문자를 포함하세요')
  }

  // 연속된 문자 체크
  if (/(.)\1{2,}/.test(password)) {
    score--
    feedback.push('연속된 문자는 피하세요')
  }

  // 일반적인 패턴 체크
  const commonPatterns = ['password', '123456', 'qwerty', 'admin', 'letmein']
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    score = Math.max(0, score - 2)
    feedback.push('너무 흔한 비밀번호입니다')
  }

  // 강도 결정
  let strength: PasswordStrength['strength']
  if (score <= 1) strength = 'very-weak'
  else if (score === 2) strength = 'weak'
  else if (score === 3) strength = 'medium'
  else if (score === 4) strength = 'strong'
  else strength = 'very-strong'

  // 최소 요구사항: 대소문자, 숫자, 특수문자 중 3가지 이상
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
  const typesCount = [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length
  const isValid = password.length >= 8 && typesCount >= 3

  if (!isValid && feedback.length === 0) {
    feedback.push('대소문자, 숫자, 특수문자 중 3가지 이상을 포함해야 합니다')
  }

  return {
    isValid,
    score: Math.max(0, Math.min(5, score)),
    feedback,
    strength
  }
}

export function getPasswordStrengthColor(strength: PasswordStrength['strength']): string {
  const colors = {
    'very-weak': '#f44336',
    'weak': '#ff9800',
    'medium': '#ffc107',
    'strong': '#8bc34a',
    'very-strong': '#4caf50'
  }
  return colors[strength]
}

export function getPasswordStrengthText(strength: PasswordStrength['strength']): string {
  const texts = {
    'very-weak': '매우 약함',
    'weak': '약함',
    'medium': '보통',
    'strong': '강함',
    'very-strong': '매우 강함'
  }
  return texts[strength]
}
