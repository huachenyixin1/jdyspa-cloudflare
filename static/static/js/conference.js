let conferences = [];

async function loadConferenceList() {
    try {
        conferences = await get('/conferences/');
        renderConferences();
    } catch (e) {
        console.error('加载会议列表失败', e);
        document.getElementById('conferenceList').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-text">加载失败，请刷新重试</div>
            </div>
        `;
    }
}

function getStatus(conference) {
    const today = new Date().toISOString().split('T')[0];
    const start = conference.start_date;
    const end = conference.end_date;
    
    if (end && end < today) {
        return { text: '已结束', class: 'status-ended' };
    } else if (start && start > today) {
        return { text: '未开始', class: 'status-upcoming' };
    } else {
        return { text: '进行中', class: 'status-active' };
    }
}

function renderConferences() {
    const container = document.getElementById('conferenceList');
    
    if (!conferences || conferences.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-text">暂无会议</div>
                <div class="empty-hint">点击右下角的 <span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;background:#4a90d9;color:white;border-radius:50%;font-size:28px;box-shadow:0 2px 8px rgba(74,144,217,0.4);">+</span> 按钮创建新会议</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = conferences.map(c => {
        const status = getStatus(c);
        return `
            <div class="conference-card">
                <div class="card-header-row">
                    <div>
                        <div class="card-title">${c.title}</div>
                        <div class="card-code">编码: ${c.code || '-'}</div>
                    </div>
                    <span class="card-status ${status.class}">${status.text}</span>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-icon">👥</span>
                        <span class="info-label">规模</span>
                        <span class="info-value">${c.scale || 0} 人</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">📅</span>
                        <span class="info-label">日期</span>
                        <span class="info-value">${c.start_date || '-'} 至 ${c.end_date || '-'}</span>
                    </div>
                    ${c.location ? `
                        <div class="info-row">
                            <span class="info-icon">📍</span>
                            <span class="info-label">地点</span>
                            <span class="info-value">${c.location}</span>
                        </div>
                    ` : ''}
                    <div class="info-row">
                        <span class="info-icon">⚙️</span>
                        <span class="info-label">服务</span>
                        <span class="info-value">
                            ${c.has_meal ? '🍽️用餐 ' : ''}
                            ${c.has_hotel ? '🏨住宿 ' : ''}
                            ${c.has_transport ? '🚗接送' : ''}
                            ${!c.has_meal && !c.has_hotel && !c.has_transport ? '无' : ''}
                        </span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-small" onclick="editConference(${c.id})">编辑</button>
                    <button class="btn btn-primary btn-small" onclick="enterConference(${c.id}, '${c.title}', '${c.code || ''}')">进入</button>
                    <button class="btn btn-danger btn-small" onclick="deleteConference(${c.id})">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

function showCreateModal() {
    document.getElementById('modalTitle').textContent = '新建会议';
    document.getElementById('conferenceForm').reset();
    document.getElementById('editId').value = '';
    document.getElementById('createModal').classList.add('active');
}

function closeModal(modalId) {
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    } else {
        document.getElementById('createModal').classList.remove('active');
    }
}

async function editConference(id) {
    const conference = conferences.find(c => c.id === id);
    if (!conference) return;
    
    document.getElementById('modalTitle').textContent = '编辑会议';
    document.getElementById('editId').value = id;
    document.getElementById('title').value = conference.title || '';
    document.getElementById('scale').value = conference.scale || '';
    document.getElementById('startDate').value = conference.start_date || '';
    document.getElementById('endDate').value = conference.end_date || '';
    document.getElementById('location').value = conference.location || '';
    document.getElementById('purpose').value = conference.purpose || '';
    document.getElementById('hasMeal').checked = conference.has_meal || false;
    document.getElementById('hasHotel').checked = conference.has_hotel || false;
    document.getElementById('hasTransport').checked = conference.has_transport || false;
    
    document.getElementById('createModal').classList.add('active');
}

async function saveConference() {
    const editId = document.getElementById('editId').value;
    const data = {
        title: document.getElementById('title').value,
        scale: parseInt(document.getElementById('scale').value) || 0,
        start_date: document.getElementById('startDate').value,
        end_date: document.getElementById('endDate').value,
        location: document.getElementById('location').value,
        purpose: document.getElementById('purpose').value,
        has_meal: document.getElementById('hasMeal').checked,
        has_hotel: document.getElementById('hasHotel').checked,
        has_transport: document.getElementById('hasTransport').checked
    };
    
    try {
        let result;
        if (editId) {
            result = await put(`/conferences/${editId}`, data);
        } else {
            result = await post('/conferences/', data);
        }
        
        if (result.id || result.code) {
            showToast(editId ? '保存成功' : '创建成功');
            closeModal();
            loadConferenceList();
        } else {
            showToast(result.detail || '操作失败');
        }
    } catch (e) {
        showToast('操作失败，请稍后重试');
    }
}

async function deleteConference(id) {
    const confirmed = await showConfirm('确定要删除这个会议吗？此操作不可恢复。');
    if (!confirmed) return;
    
    try {
        const result = await del(`/conferences/${id}`);
        if (result.success !== false) {
            showToast('删除成功');
            loadConferenceList();
        } else {
            showToast(result.detail || '删除失败');
        }
    } catch (e) {
        showToast('删除失败，请稍后重试');
    }
}

function enterConference(id, title, code) {
    selectConference(id, title, code);
    location.hash = `#conference/${id}`;
}

function initConferenceCreate() {
    document.getElementById('conferenceCreateForm')?.reset();
}

async function handleConferenceCreate() {
    const form = document.getElementById('conferenceCreateForm');
    const formData = new FormData(form);
    
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    
    if (new Date(endDate) < new Date(startDate)) {
        showCreateResult('error', '提交失败', '结束日期不能早于开始日期');
        return;
    }
    
    const data = {
        title: formData.get('title'),
        scale: parseInt(formData.get('scale')) || 0,
        start_date: startDate,
        end_date: endDate,
        purpose: formData.get('purpose') || '',
        has_meal: formData.get('hasMeal') === 'on',
        has_hotel: formData.get('hasHotel') === 'on',
        has_transport: formData.get('hasTransport') === 'on'
    };
    
    try {
        const result = await post('/conferences/', data);
        if (result.id || result.code) {
            showCreateResult('success', '创建成功', `
                <div class="info-row">
                    <span class="info-label">会议编码</span>
                    <span class="info-value">${result.code || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">会议名称</span>
                    <span class="info-value">${result.title || '-'}</span>
                </div>
            `);
        } else {
            showCreateResult('error', '创建失败', result.detail || '未知错误');
        }
    } catch (e) {
        showCreateResult('error', '网络错误', `请求失败: ${e.message}`);
    }
}

function showCreateResult(type, title, message) {
    const resultDiv = document.getElementById('createResult');
    if (resultDiv) {
        resultDiv.className = `result ${type}`;
        resultDiv.innerHTML = `<h4>${title}</h4>${message}`;
        resultDiv.style.display = 'block';
    }
}

async function loadConferenceManage(conferenceId, tab) {
    try {
        const conferences = await get('/conferences/');
        const conf = conferences.find(c => c.id == conferenceId);
        if (conf) {
            currentConference = { id: conferenceId, title: conf.title, code: conf.code || '' };
            localStorage.setItem('currentConference', JSON.stringify(currentConference));
            
            const nameEl = document.getElementById('conferenceName');
            const codeEl = document.getElementById('conferenceCode');
            if (nameEl) nameEl.textContent = conf.title;
            if (codeEl) codeEl.textContent = conf.code || '';
            
            const conferenceInfo = document.querySelector('.conference-info');
            if (conferenceInfo) {
                conferenceInfo.classList.remove('hidden');
            }
        } else {
            currentConference = { id: conferenceId };
        }
    } catch (e) {
        console.error('获取会议信息失败', e);
        currentConference = { id: conferenceId };
    }
    
    switch(tab) {
        case 'participants':
            if (typeof loadParticipants === 'function') loadParticipants(conferenceId);
            break;
        case 'seating':
            if (typeof loadSeating === 'function') loadSeating(conferenceId);
            break;
        case 'hotel':
            if (typeof loadHotel === 'function') loadHotel(conferenceId);
            break;
        case 'restaurant':
            if (typeof loadRestaurant === 'function') loadRestaurant(conferenceId);
            break;
    }
}

window.loadConferenceList = loadConferenceList;
window.showCreateModal = showCreateModal;
window.closeModal = closeModal;
window.editConference = editConference;
window.saveConference = saveConference;
window.deleteConference = deleteConference;
window.enterConference = enterConference;
window.initConferenceCreate = initConferenceCreate;
window.handleConferenceCreate = handleConferenceCreate;
window.loadConferenceManage = loadConferenceManage;
