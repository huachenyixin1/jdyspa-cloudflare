let dashboardConferenceId = null;

function goToCreateConference() {
    showPage('main');
    showView('conference-list');
    if (typeof loadConferenceList === 'function') loadConferenceList();
    setTimeout(() => {
        if (typeof showCreateModal === 'function') showCreateModal();
    }, 150);
}

async function loadDashboard() {
    const conference = getCurrentConference();
    
    if (!conference || !conference.id) {
        document.getElementById('currentSection').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('alertBanner').classList.remove('show');
        document.querySelector('#emptyState .empty-state').innerHTML = `
            <div class="empty-icon">📊</div>
            <div>暂无会议</div>
            <a href="javascript:void(0);" onclick="goToCreateConference()" class="select-btn" style="text-decoration:none;display:inline-block;margin-top:12px;">创建会议</a>
        `;
        return;
    }
    
    dashboardConferenceId = conference.id;
    
    try {
        const data = await get(`/stats/conference/${conference.id}/overview`);
        renderConferenceStats(data);
    } catch (e) {
        console.error('加载统计数据失败', e);
    }
}

function getCurrentConference() {
    const saved = localStorage.getItem('currentConference');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function renderConferenceStats(data) {
    document.getElementById('currentSection').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    
    document.getElementById('confTitle').textContent = data.conference?.title || '-';
    document.getElementById('confDate').textContent = 
        data.conference?.start_date && data.conference?.end_date 
            ? `${data.conference.start_date} ~ ${data.conference.end_date}` 
            : '-';
    document.getElementById('confParticipants').textContent = (data.total_participants || 0) + '人';
    
    renderStatCard('seating', data.seating, data.total_participants);
    renderStatCard('hotel', data.hotel, data.hotel?.need_count);
    renderStatCard('restaurant', data.restaurant, data.restaurant?.need_count);
    renderStatCard('transport', data.transport, data.transport?.need_count);
    
    updateAlertBanner(data);
}

function renderStatCard(type, stats, total) {
    if (!stats) return;
    
    const rate = stats.rate || 0;
    const isComplete = rate >= 100;
    const hasWarning = stats.unassigned > 0;
    const isNoNeed = type === 'seating' 
        ? (stats.total || 0) === 0 
        : (stats.need_count || 0) === 0;
    
    const rateEl = document.getElementById(`${type}Rate`);
    const progressEl = document.getElementById(`${type}Progress`);
    const badgeEl = document.getElementById(`${type}Badge`);
    const cardEl = document.getElementById(`${type}Card`);
    
    if (rateEl) {
        if (isNoNeed) {
            rateEl.textContent = '0.0';
        } else {
            rateEl.textContent = rate.toFixed(1);
        }
    }
    if (progressEl) {
        if (isNoNeed) {
            progressEl.style.width = '0%';
            progressEl.style.background = '#e0e0e0';
        } else {
            progressEl.style.width = rate + '%';
            progressEl.style.background = '';
        }
    }
    
    if (badgeEl) {
        if (isNoNeed) {
            badgeEl.className = 'stat-badge';
            badgeEl.textContent = '无需安排';
        } else {
            badgeEl.className = 'stat-badge ' + (isComplete ? 'success' : 'warning');
            badgeEl.textContent = isComplete ? '已完成' : '进行中';
        }
    }
    
    if (cardEl) {
        if (isNoNeed) {
            cardEl.className = 'stat-card';
        } else {
            cardEl.className = 'stat-card ' + (isComplete ? 'success' : (hasWarning ? 'warning' : ''));
        }
    }
    
    const assignedEl = document.getElementById(`${type}Assigned`);
    const needEl = document.getElementById(`${type}Need`);
    const totalEl = document.getElementById(`${type}Total`);
    const unassignedEl = document.getElementById(`${type}Unassigned`);
    
    if (type === 'seating') {
        if (assignedEl) assignedEl.textContent = stats.assigned || 0;
        if (totalEl) totalEl.textContent = stats.total || 0;
        if (unassignedEl) {
            unassignedEl.innerHTML = 
                (stats.total || 0) === 0 
                    ? '无需安排' 
                    : ((stats.unassigned || 0) > 0 
                        ? `<span class="highlight">⚠️ 未分配：${stats.unassigned}人</span>` 
                        : '✅ 全部已分配');
        }
    } else {
        if (assignedEl) assignedEl.textContent = stats.assigned || 0;
        if (needEl) needEl.textContent = stats.need_count || 0;
        if (unassignedEl) {
            unassignedEl.innerHTML = 
                (stats.need_count || 0) === 0 
                    ? '无需安排' 
                    : ((stats.unassigned || 0) > 0 
                        ? `<span class="highlight">⚠️ 未分配：${stats.unassigned}人</span>` 
                        : '✅ 全部已分配');
        }
    }
}

function updateAlertBanner(data) {
    const alerts = [];
    
    if (data.seating?.unassigned > 0) {
        alerts.push(`排座 ${data.seating.unassigned}人未分配`);
    }
    if (data.hotel?.need_count > 0 && data.hotel?.unassigned > 0) {
        alerts.push(`住宿 ${data.hotel.unassigned}人未分配`);
    }
    if (data.restaurant?.need_count > 0 && data.restaurant?.unassigned > 0) {
        alerts.push(`餐厅 ${data.restaurant.unassigned}人未分配`);
    }
    if (data.transport?.need_count > 0 && data.transport?.unassigned > 0) {
        alerts.push(`接送 ${data.transport.unassigned}人未分配`);
    }
    
    const alertBanner = document.getElementById('alertBanner');
    const alertText = document.getElementById('alertText');
    
    if (alerts.length > 0 && alertBanner && alertText) {
        alertText.textContent = '⚠️ 待处理：' + alerts.join('、');
        alertBanner.classList.add('show');
    } else if (alertBanner) {
        alertBanner.classList.remove('show');
    }
}

function goToSeating() {
    const conference = getCurrentConference();
    if (conference && conference.id) {
        location.hash = `#conference/${conference.id}/seating`;
    }
}

function goToHotel() {
    const conference = getCurrentConference();
    if (conference && conference.id) {
        location.hash = `#conference/${conference.id}/hotel`;
    }
}

function goToRestaurant() {
    const conference = getCurrentConference();
    if (conference && conference.id) {
        location.hash = `#conference/${conference.id}/restaurant`;
    }
}

function goToTransport() {
    location.hash = '#transport';
}

window.loadDashboard = loadDashboard;
window.goToSeating = goToSeating;
window.goToHotel = goToHotel;
window.goToRestaurant = goToRestaurant;
window.goToTransport = goToTransport;
