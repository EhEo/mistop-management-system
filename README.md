# MISTOP Management System

🏢 **MIS TOP 통합 관리 시스템**

## 📋 프로젝트 개요

사용자 인증, 권한 관리, 활동 로그를 포함한 종합 관리 시스템입니다.

## 🚀 주요 기능

### 🔐 인증 시스템
- 회원가입 (이메일 인증)
- 로그인 (JWT 토큰)
- 비밀번호 찾기/재설정
- 로그인 시도 제한 (5회 실패 시 15분 잠금)

### 👤 사용자 관리
- 프로필 조회/수정
- 비밀번호 변경
- 계정 삭제

### 📊 대시보드
- 사용자 통계
- 실시간 활동 로그
- 빠른 액션 버튼

### ⚙️ 관리자 기능
- 사용자 목록 조회
- 검색/필터링
- 역할 변경
- 대량 작업

### 🔒 보안 기능
- 로그인 시도 횟수 제한
- 세션 타임아웃 (30분)
- 비밀번호 복잡도 검증

## 🛠 기술 스택

**Backend:** Node.js, Hono, TypeScript  
**Database:** MongoDB  
**Frontend:** HTML5, CSS3, JavaScript  
**Server:** Nginx  
**Auth:** JWT

## 📁 프로젝트 구조

    mistop-management-system/
    ├── api/                    # 백엔드 API
    │   ├── src/               # TypeScript 소스
    │   ├── package.json
    │   └── tsconfig.json
    ├── frontend/              # 프론트엔드
    │   ├── login.html
    │   ├── dashboard.html
    │   └── admin.html
    ├── nginx/                 # Nginx 설정
    └── docs/                  # 문서

## 🚀 설치 및 실행

### 환경 변수 설정
    cd api
    cp .env.example .env

### 의존성 설치
    npm install

### 빌드 및 실행
    npm run build
    pm2 start ecosystem.config.cjs

## 👥 개발자

**Michael Kim** (EhEo)

## 📄 라이선스

MIT License

## 🔧 개발 환경

- VSCode Remote SSH로 원격 개발 중
- GitHub: https://github.com/EhEo/mistop-management-system
- VSCode Remote SSH로 원격 개발
- GitHub Actions Self-hosted Runner로 자동 배포
- 배포 테스트: 2025-10-28
1. VSCode에서 코드 수정
   ↓
2. Git Commit
   ↓
3. Git Push to GitHub
   ↓
4. GitHub Actions 자동 실행
   ↓
5. Self-hosted Runner가 서버에서 배포 실행
   - 최신 코드 가져오기
   - API/프론트엔드 업데이트
   - 빌드
   - PM2 재시작
   ↓
6. 배포 완료! ✅