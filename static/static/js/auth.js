async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    if (!username || !password) {
        errorMessage.textContent = '请输入用户名和密码';
        errorMessage.style.display = 'block';
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';
    errorMessage.style.display = 'none';
    
    try {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        
        const response = await postForm('/auth/login', formData);
        
        if (response.access_token) {
            localStorage.setItem('token', response.access_token);
            localStorage.setItem('token_type', response.token_type || 'bearer');
            const savedConference = localStorage.getItem('currentConference');
            if (savedConference) {
                try {
                    const conf = JSON.parse(savedConference);
                    if (conf && conf.id) {
                        try {
                            const check = await fetch(`https://huiwu.j3713212.workers.dev/conferences/${conf.id}`, {
                                headers: { 'Authorization': `Bearer ${response.access_token}` }
                            });
                            if (check.ok) {
                                location.hash = `#conference/${conf.id}`;
                                return;
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
            }
            location.hash = '#dashboard';
        } else {
            errorMessage.textContent = response.detail || '登录失败，请检查用户名和密码';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        errorMessage.textContent = error.message || '网络错误，请稍后重试';
        errorMessage.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
    }
}

async function handleRegister() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirmPassword').value;
    const registerBtn = document.getElementById('registerBtn');
    const errorMessage = document.getElementById('reg-errorMessage');
    const successMessage = document.getElementById('reg-successMessage');
    
    if (password !== confirmPassword) {
        errorMessage.textContent = '两次输入的密码不一致';
        errorMessage.style.display = 'block';
        return;
    }
    
    registerBtn.disabled = true;
    registerBtn.textContent = '注册中...';
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    try {
        const response = await post('/auth/register', {
            username: username,
            email: email,
            password: password
        });
        
        if (response.id) {
            successMessage.textContent = '注册成功，即将跳转到登录页面...';
            successMessage.style.display = 'block';
            setTimeout(() => {
                location.hash = '#login';
            }, 1500);
        } else {
            errorMessage.textContent = response.detail || '注册失败，请稍后重试';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        errorMessage.textContent = '网络错误，请稍后重试';
        errorMessage.style.display = 'block';
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = '注册';
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value;
    const forgotBtn = document.getElementById('forgotBtn');
    const forgotMessage = document.getElementById('forgotMessage');
    
    if (!email) {
        forgotMessage.textContent = '请输入邮箱地址';
        forgotMessage.className = 'message error';
        forgotMessage.style.display = 'block';
        return;
    }
    
    forgotBtn.disabled = true;
    forgotBtn.textContent = '处理中...';
    forgotMessage.style.display = 'none';
    
    try {
        const response = await post('/auth/forgot-password', { email: email });
        
        forgotMessage.textContent = response.message || '密码已重置，请查收邮件';
        forgotMessage.className = 'message success';
        forgotMessage.style.display = 'block';
        
        document.getElementById('forgot-email').value = '';
        
        setTimeout(() => {
            location.hash = '#login';
        }, 3000);
    } catch (error) {
        const data = error.data || {};
        forgotMessage.textContent = data.detail || '操作失败，请稍后重试';
        forgotMessage.className = 'message error';
        forgotMessage.style.display = 'block';
    } finally {
        forgotBtn.disabled = false;
        forgotBtn.textContent = '重置密码';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('token_type');
    location.hash = '#login';
}

function isLoggedIn() {
    return !!localStorage.getItem('token');
}

window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleForgotPassword = handleForgotPassword;
window.logout = logout;
window.isLoggedIn = isLoggedIn;

function checkAuth() {
    if (!isLoggedIn()) {
        location.hash = '#login';
        return false;
    }
    return true;
}
