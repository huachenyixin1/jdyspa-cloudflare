const API_BASE = 'https://huiwu.j3713212.workers.dev';

async function request(url, options = {}) {
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {}
    };
    
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (!(options.body instanceof FormData)) {
        defaultOptions.headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(`${API_BASE}${url}`, {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    });
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (response.status === 401 && url !== '/auth/login') {
            localStorage.removeItem('token');
            localStorage.removeItem('token_type');
            location.hash = '#login';
            throw new Error(data.detail || '登录已过期');
        }
        return data;
    }
    
    if (response.status === 401 && url !== '/auth/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('token_type');
        location.hash = '#login';
        throw new Error('登录已过期');
    }
    
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
}

async function get(url) {
    const result = await request(url);
    if (result instanceof Error) throw result;
    return result;
}

async function post(url, data) {
    const result = await request(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    if (result instanceof Error) throw result;
    return result;
}

async function postForm(url, formData) {
    const result = await request(url, {
        method: 'POST',
        body: formData
    });
    if (result instanceof Error) throw result;
    return result;
}

async function put(url, data) {
    return await request(url, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function del(url, data) {
    const options = {
        method: 'DELETE'
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    return await request(url, options);
}

function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}
