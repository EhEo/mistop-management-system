// 세션 타임아웃 설정 (30분 = 1800000ms)
const SESSION_TIMEOUT = 30 * 60 * 1000;
let timeoutId = null;
let lastActivity = Date.now();

// 디버그 모드 (개발 중에만 true로 설정)
const DEBUG_MODE = false;

// 활동 감지 함수
function resetSessionTimer() {
    lastActivity = Date.now();
    
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
        // 타임아웃 발생
        handleSessionTimeout();
    }, SESSION_TIMEOUT);
    
    if (DEBUG_MODE) {
        console.log('⏱️ 세션 타이머 리셋됨. 30분 후 자동 로그아웃');
    }
}

// 세션 타임아웃 처리
function handleSessionTimeout() {
    const token = localStorage.getItem('token');
    
    if (token) {
        alert('⏰ 30분 동안 활동이 없어 자동 로그아웃되었습니다.');
        
        // 로그아웃 처리
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // 로그인 페이지로 이동
        window.location.href = '/auth/login.html';
    }
}

// 활동 감지 이벤트 리스너
function initSessionTimeout() {
    const token = localStorage.getItem('token');
    
    // 로그인 상태일 때만 타이머 시작
    if (token) {
        if (DEBUG_MODE) {
            console.log('✅ 세션 타임아웃 시스템 초기화됨 (30분)');
        }
        
        // 초기 타이머 설정
        resetSessionTimer();
        
        // 사용자 활동 감지
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                resetSessionTimer();
            }, true);
        });
        
        // 1분마다 세션 유효성 체크
        setInterval(() => {
            const elapsed = Date.now() - lastActivity;
            
            if (DEBUG_MODE) {
                const minutes = Math.floor(elapsed / 60000);
                console.log(`📊 비활성 시간: ${minutes}분`);
            }
            
            // 29분 경과 시 경고
            if (elapsed > 29 * 60 * 1000 && elapsed < SESSION_TIMEOUT) {
                const remaining = Math.ceil((SESSION_TIMEOUT - elapsed) / 1000);
                console.log(`⚠️ ${remaining}초 후 자동 로그아웃됩니다.`);
                
                // 선택: 알림 표시
                if (remaining <= 60) {
                    showWarningNotification(remaining);
                }
            }
        }, 60000); // 1분마다 체크
    } else {
        if (DEBUG_MODE) {
            console.log('ℹ️ 로그인 상태가 아님 - 세션 타임아웃 비활성화');
        }
    }
}

// 경고 알림 표시 (선택 사항)
function showWarningNotification(seconds) {
    // 기존 알림이 있으면 제거
    const existingWarning = document.getElementById('session-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    // 경고 메시지 생성
    const warning = document.createElement('div');
    warning.id = 'session-warning';
    warning.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff9800;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;
    warning.innerHTML = `
        ⏰ ${seconds}초 후 자동 로그아웃됩니다.
        <button onclick="resetSessionTimer(); this.parentElement.remove();" 
                style="margin-left: 10px; padding: 5px 10px; background: white; 
                       color: #ff9800; border: none; border-radius: 4px; cursor: pointer;">
            연장
        </button>
    `;
    
    document.body.appendChild(warning);
    
    // 10초 후 자동 제거
    setTimeout(() => {
        if (warning.parentElement) {
            warning.remove();
        }
    }, 10000);
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSessionTimeout);
} else {
    initSessionTimeout();
}
