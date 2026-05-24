let conferenceId = null;
let transportState = {
    currentDate: new Date(),
    vehicles: [],
    participants: [],
    tasks: [],
    selectedPassengers: [],
    editingTaskId: null,
    editingVehicleId: null,
    currentTab: 'timeline'
};

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function loadTransport(confId) {
    conferenceId = confId;
    
    await Promise.all([
        loadVehicles(),
        loadTransportParticipants(),
        loadTasks()
    ]);
    
    renderTimeline();
    updateDateDisplay();
}

async function loadVehicles() {
    try {
        const data = await get(`/transport/${conferenceId}/vehicles`);
        transportState.vehicles = data.vehicles || [];
    } catch (e) {
        console.error('加载车辆失败', e);
        transportState.vehicles = [];
    }
}

async function loadTransportParticipants() {
    try {
        const data = await get(`/participants/${conferenceId}`);
        transportState.participants = Array.isArray(data) ? data.filter(p => p.has_transport === true) : [];
    } catch (e) {
        console.error('加载参会人失败', e);
        transportState.participants = [];
    }
}

async function loadTasks() {
    try {
        const dateStr = formatDate(transportState.currentDate);
        const data = await get(`/transport/${conferenceId}/tasks?date=${dateStr}`);
        transportState.tasks = data.tasks || [];
    } catch (e) {
        console.error('加载行程失败', e);
        transportState.tasks = [];
    }
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function updateDateDisplay() {
    const today = new Date();
    const current = transportState.currentDate;
    const isToday = formatDate(current) === formatDate(today);
    const dateEl = document.getElementById('transportDate');
    if (dateEl) {
        dateEl.textContent = isToday ? '今天' : `${current.getMonth() + 1}/${current.getDate()}`;
    }
}

function changeDate(offset) {
    transportState.currentDate.setDate(transportState.currentDate.getDate() + offset);
    updateDateDisplay();
    loadTasks().then(() => renderTimeline());
}

function switchTransportTab(tab) {
    transportState.currentTab = tab;
    document.querySelectorAll('.transport-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.style.borderColor = '#4a90d9';
            btn.style.background = '#e8f4fd';
            btn.style.color = '#4a90d9';
        } else {
            btn.style.borderColor = '#e0e0e0';
            btn.style.background = '#fff';
            btn.style.color = '#666';
        }
    });
    document.querySelectorAll('.transport-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `transport-tab-${tab}`);
    });

    if (tab === 'timeline') renderTimeline();
    if (tab === 'vehicles') renderVehicleList();
}

function renderTimeline() {
    const header = document.getElementById('transportVehiclesHeader');
    const timeColumn = document.getElementById('transportTimeColumn');
    const schedule = document.getElementById('transportTimelineContent');

    if (!header || !timeColumn || !schedule) return;

    header.innerHTML = transportState.vehicles.map(v => `
        <div class="vehicle-col-header">
            <div class="v-plate">${escapeHtml(v.plate || '')}</div>
            <div class="v-info">${escapeHtml(v.model || '')} · ${v.seats || 0}座</div>
            <div class="v-driver">${escapeHtml(v.driver_name || '')} ${escapeHtml(v.driver_phone || '')}</div>
        </div>
    `).join('');

    let timeHtml = '';
    let scheduleHtml = '';
    for (let hour = 5; hour <= 24; hour++) {
        const timeStr = String(hour).padStart(2, '0') + ':00';
        timeHtml += `<div class="time-cell">${timeStr}</div>`;
        scheduleHtml += `
            <div class="timeline-row" data-hour="${hour}">
                <div class="vehicle-cells">
                    ${transportState.vehicles.map(v => renderTimeCell(v, hour)).join('')}
                </div>
            </div>
        `;
    }
    timeColumn.innerHTML = timeHtml;
    schedule.innerHTML = scheduleHtml;

    renderFloatingTaskBlocks();
    setupTimelineScrollSync();
}

function setupTimelineScrollSync() {
    const headerScroll = document.getElementById('transportHeaderScroll');
    const timeScroll = document.getElementById('transportTimeScroll');
    const scheduleScroll = document.getElementById('transportScheduleScroll');
    
    if (!headerScroll || !timeScroll || !scheduleScroll) return;
    
    scheduleScroll.addEventListener('scroll', () => {
        headerScroll.scrollLeft = scheduleScroll.scrollLeft;
        timeScroll.scrollTop = scheduleScroll.scrollTop;
    });
}

function renderTimeCell(vehicle, hour) {
    const hourStr = String(hour).padStart(2, '0');
    const taskStartingHere = transportState.tasks.find(t => 
        t.vehicle_id === vehicle.id && t.start_time.startsWith(hourStr + ':')
    );

    const taskInProgress = transportState.tasks.find(t => {
        if (t.vehicle_id !== vehicle.id) return false;
        const startHour = parseInt(t.start_time.split(':')[0]);
        const endHour = parseInt(t.end_time.split(':')[0]);
        return hour > startHour && hour < endHour;
    });

    if (taskStartingHere || taskInProgress) {
        return `<div class="task-cell occupied"></div>`;
    } else {
        return `<div class="task-cell empty" onclick="openTaskModal(null, '${vehicle.id}', '${hourStr}:00')"></div>`;
    }
}

function renderFloatingTaskBlocks() {
    document.querySelectorAll('.task-block-floating').forEach(el => el.remove());

    const container = document.getElementById('transportTimelineContent');
    if (!container) return;

    transportState.tasks.forEach(task => {
        const vehicle = transportState.vehicles.find(v => v.id === task.vehicle_id);
        if (!vehicle) return;

        const vehicleIndex = transportState.vehicles.findIndex(v => v.id === vehicle.id);
        const startHour = parseInt(task.start_time.split(':')[0]);
        const endHour = parseInt(task.end_time.split(':')[0]);
        const duration = endHour - startHour;

        if (startHour < 5 || startHour > 24) return;

        const people = task.passengers || [];
        const mainName = people[0]?.name || '未知';
        const moreCount = people.length > 1 ? `+${people.length - 1}` : '';
        const typeLabel = task.task_type === 'pickup' ? '接' : '送';

        const topOffset = (startHour - 5) * 55;
        const height = duration * 55 - 1;
        const leftOffset = vehicleIndex * 110;

        const block = document.createElement('div');
        block.className = `task-block-floating ${task.status}`;
        block.style.cssText = `top:${topOffset}px;left:${leftOffset}px;height:${height}px;`;
        block.innerHTML = `
            <div class="block-content">
                <div class="block-names">${escapeHtml(mainName)}${moreCount}</div>
                <div class="block-type">${typeLabel} · ${people.length}/${vehicle.seats}座</div>
                <div class="block-time">${escapeHtml(task.start_time)}-${escapeHtml(task.end_time)}</div>
                <div class="block-dest">→${shorten(task.to_location)}</div>
            </div>
        `;
        block.onclick = () => openDetailModal(task.id);

        container.appendChild(block);
    });
}

function shorten(text) {
    if (!text) return '';
    return text.length > 4 ? text.substring(0, 4) : text;
}

function renderVehicleList() {
    const container = document.getElementById('transportVehicleList');
    if (!container) return;
    
    container.innerHTML = transportState.vehicles.map(v => `
        <div class="list-item">
            <div class="item-main">
                <div class="item-title">${escapeHtml(v.plate)}</div>
                <div class="item-sub">${escapeHtml(v.model)} · ${v.seats}座</div>
                <div class="item-sub">${escapeHtml(v.driver_name || '')} ${escapeHtml(v.driver_phone || '')}</div>
            </div>
            <div class="item-actions">
                <button class="btn-icon" onclick="editVehicle(${v.id})">✏️</button>
                <button class="btn-icon" onclick="deleteVehicle(${v.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function openTaskModal(taskId, vehicleId, startTime) {
    transportState.editingTaskId = taskId;
    transportState.selectedPassengers = [];

    const title = document.getElementById('taskModalTitle');
    const vehicleSelect = document.getElementById('taskVehicle');
    const personSelector = document.getElementById('personSelector');
    const companySelect = document.getElementById('companySelect');

    if (!vehicleSelect || !personSelector) return;

    vehicleSelect.innerHTML = '<option value="">车辆</option>' + 
        transportState.vehicles.map(v => `<option value="${v.id}">${escapeHtml(v.plate)} (${escapeHtml(v.model)})</option>`).join('');
    
    const assignedPassengerIds = new Set();
    transportState.tasks.forEach(task => {
        if (task.id !== transportState.editingTaskId) {
            (task.passengers || []).forEach(p => assignedPassengerIds.add(p.id));
        }
    });

    const availableParticipants = transportState.participants.filter(p => !assignedPassengerIds.has(p.id));

    const companies = [...new Set(availableParticipants.map(p => p.company).filter(c => c))];
    if (companySelect) {
        companySelect.innerHTML = '<option value="">按公司选择</option>' + 
            companies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }

    personSelector.innerHTML = availableParticipants.map(p => `
        <div class="person-tag" data-id="${p.id}" data-company="${escapeHtml(p.company || '')}" onclick="togglePerson(${p.id})">
            <div class="p-name">${escapeHtml(p.name)}</div>
            <div class="p-company">${escapeHtml(p.company || '')}</div>
        </div>
    `).join('');

    document.getElementById('taskDate').value = formatDate(transportState.currentDate);
    if (startTime) {
        document.getElementById('taskStartTime').value = startTime;
        const endHour = parseInt(startTime.split(':')[0]) + 2;
        document.getElementById('taskEndTime').value = String(endHour).padStart(2, '0') + ':00';
    }
    if (vehicleId) {
        document.getElementById('taskVehicle').value = vehicleId;
    }

    document.getElementById('taskFrom').value = '';
    document.getElementById('taskTo').value = '';
    document.getElementById('taskFromLat').value = '';
    document.getElementById('taskFromLng').value = '';
    document.getElementById('taskToLat').value = '';
    document.getElementById('taskToLng').value = '';
    document.getElementById('escortName').value = '';
    document.getElementById('escortPhone').value = '';
    document.getElementById('taskNote').value = '';
    
    const pickupRadio = document.querySelector('input[name="taskType"][value="pickup"]');
    if (pickupRadio) pickupRadio.checked = true;

    updateSelectionInfo();
    if (title) title.textContent = '新建行程';
    
    const modal = document.getElementById('taskModal');
    if (modal) modal.classList.add('active');
}

function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    if (modal) modal.classList.remove('active');
}

function togglePerson(id) {
    const vehicleId = document.getElementById('taskVehicle').value;
    if (!vehicleId) {
        showToast('请先选择车辆');
        return;
    }

    const idx = transportState.selectedPassengers.indexOf(id);
    if (idx > -1) {
        transportState.selectedPassengers.splice(idx, 1);
    } else {
        const availableSeats = getAvailableSeats();
        if (availableSeats <= 0) {
            showToast('座位已满');
            return;
        }
        transportState.selectedPassengers.push(id);
    }
    document.querySelectorAll('.person-tag').forEach(tag => {
        tag.classList.toggle('selected', transportState.selectedPassengers.includes(parseInt(tag.dataset.id)));
    });
    updateSelectionInfo();
}

function updateSelectionInfo() {
    const vehicleId = document.getElementById('taskVehicle').value;
    const infoEl = document.getElementById('selectionInfo');
    let info = `已选 ${transportState.selectedPassengers.length} 人`;
    
    if (vehicleId) {
        const vehicle = transportState.vehicles.find(v => v.id === parseInt(vehicleId));
        if (vehicle) {
            let maxSeats = vehicle.seats || 0;
            const escortName = document.getElementById('escortName').value.trim();
            const escortPhone = document.getElementById('escortPhone').value.trim();
            if (escortName || escortPhone) {
                maxSeats -= 1;
            }
            info += ` / 最多 ${maxSeats} 人`;
        }
    }
    
    if (infoEl) infoEl.textContent = info;
}

function getAvailableSeats() {
    const vehicleId = document.getElementById('taskVehicle').value;
    if (!vehicleId) return 0;
    
    const vehicle = transportState.vehicles.find(v => v.id === parseInt(vehicleId));
    if (!vehicle) return 0;
    
    let availableSeats = vehicle.seats || 0;
    
    const escortName = document.getElementById('escortName').value.trim();
    const escortPhone = document.getElementById('escortPhone').value.trim();
    if (escortName || escortPhone) {
        availableSeats -= 1;
    }
    
    availableSeats -= transportState.selectedPassengers.length;
    
    return Math.max(0, availableSeats);
}

function checkSeatsLimit() {
    const vehicleId = document.getElementById('taskVehicle').value;
    if (!vehicleId) return;
    
    const vehicle = transportState.vehicles.find(v => v.id === parseInt(vehicleId));
    if (!vehicle) return;
    
    let maxSeats = vehicle.seats || 0;
    
    const escortName = document.getElementById('escortName').value.trim();
    const escortPhone = document.getElementById('escortPhone').value.trim();
    if (escortName || escortPhone) {
        maxSeats -= 1;
    }
    
    while (transportState.selectedPassengers.length > maxSeats && transportState.selectedPassengers.length > 0) {
        const removedId = transportState.selectedPassengers.pop();
        const tag = document.querySelector(`.person-tag[data-id="${removedId}"]`);
        if (tag) tag.classList.remove('selected');
    }
    
    updateSelectionInfo();
}

function selectByCompany() {
    const vehicleId = document.getElementById('taskVehicle').value;
    if (!vehicleId) {
        showToast('请先选择车辆');
        document.getElementById('companySelect').value = '';
        return;
    }

    const company = document.getElementById('companySelect').value;
    if (!company) return;

    const availableSeats = getAvailableSeats();
    if (availableSeats <= 0) {
        showToast('座位已满');
        document.getElementById('companySelect').value = '';
        return;
    }

    let added = 0;
    document.querySelectorAll('.person-tag').forEach(tag => {
        if (added >= availableSeats) return;
        if (tag.dataset.company === company) {
            const id = parseInt(tag.dataset.id);
            if (!transportState.selectedPassengers.includes(id)) {
                transportState.selectedPassengers.push(id);
                tag.classList.add('selected');
                added++;
            }
        }
    });
    
    if (added > 0) {
        updateSelectionInfo();
    } else {
        showToast('该公司人员已全部选中或座位不足');
    }
    document.getElementById('companySelect').value = '';
}

async function saveTask() {
    const taskType = document.querySelector('input[name="taskType"]:checked')?.value || 'pickup';
    const taskDate = document.getElementById('taskDate').value;
    const startTime = document.getElementById('taskStartTime').value;
    const endTime = document.getElementById('taskEndTime').value;
    const fromLocation = document.getElementById('taskFrom').value;
    const toLocation = document.getElementById('taskTo').value;
    const vehicleId = document.getElementById('taskVehicle').value;
    const escortName = document.getElementById('escortName').value;
    const escortPhone = document.getElementById('escortPhone').value;
    const note = document.getElementById('taskNote').value;

    if (!taskDate || !startTime || !endTime || !fromLocation || !toLocation || !vehicleId) {
        showToast('请填写完整信息');
        return;
    }

    if (escortPhone && !/^1[3-9]\d{9}$/.test(escortPhone)) {
        showToast('请输入正确的手机号');
        return;
    }

    const data = {
        vehicle_id: parseInt(vehicleId),
        task_type: taskType,
        task_date: taskDate,
        start_time: startTime,
        end_time: endTime,
        from_location: fromLocation,
        from_lat: parseFloat(document.getElementById('taskFromLat')?.value) || null,
        from_lng: parseFloat(document.getElementById('taskFromLng')?.value) || null,
        to_location: toLocation,
        to_lat: parseFloat(document.getElementById('taskToLat')?.value) || null,
        to_lng: parseFloat(document.getElementById('taskToLng')?.value) || null,
        participant_ids: transportState.selectedPassengers,
        escort_name: escortName || null,
        escort_phone: escortPhone || null,
        note: note || null
    };

    try {
        if (transportState.editingTaskId) {
            await put(`/transport/tasks/${transportState.editingTaskId}`, data);
        } else {
            await post(`/transport/${conferenceId}/tasks`, data);
        }
        
        closeTaskModal();
        await loadTasks();
        renderTimeline();
        showToast('保存成功');
    } catch (e) {
        showToast('保存失败: ' + (e.message || ''));
    }
}

function openDetailModal(taskId) {
    const task = transportState.tasks.find(t => t.id === taskId);
    if (!task) return;

    transportState.editingTaskId = taskId;

    const vehicle = transportState.vehicles.find(v => v.id === task.vehicle_id);
    const typeLabel = task.task_type === 'pickup' ? '接' : '送';

    let passengersHtml = '';
    (task.passengers || []).forEach(p => {
        passengersHtml += `
            <div class="person-detail">
                <div class="pd-name">${escapeHtml(p.name)}</div>
                <div class="pd-info">${escapeHtml(p.company || '')} ${escapeHtml(p.title || '')}</div>
            </div>
        `;
    });

    const detailBody = document.getElementById('detailBody');
    if (detailBody) {
        detailBody.innerHTML = `
            <div class="detail-section">
                <div class="section-title">基本信息</div>
                <div class="detail-row"><span class="label">类型</span><span class="value">${typeLabel}</span></div>
                <div class="detail-row"><span class="label">日期</span><span class="value">${escapeHtml(task.task_date)}</span></div>
                <div class="detail-row"><span class="label">时间</span><span class="value">${escapeHtml(task.start_time)} - ${escapeHtml(task.end_time)}</span></div>
                <div class="detail-row"><span class="label">车辆</span><span class="value">${escapeHtml(vehicle?.plate || '')} (${escapeHtml(vehicle?.model || '')})</span></div>
                <div class="detail-row"><span class="label">司机</span><span class="value">${escapeHtml(vehicle?.driver_name || '')} ${escapeHtml(vehicle?.driver_phone || '')}</span></div>
            </div>
            <div class="detail-section">
                <div class="section-title">路线</div>
                <div class="detail-row"><span class="label">出发地</span><span class="value">${escapeHtml(task.from_location)}</span></div>
                <div class="detail-row"><span class="label">目的地</span><span class="value">${escapeHtml(task.to_location)}</span></div>
            </div>
            <div class="detail-section">
                <div class="section-title">乘客 (${(task.passengers || []).length}人)</div>
                ${passengersHtml}
            </div>
            ${task.escort_name ? `<div class="detail-section"><div class="section-title">陪同人员</div><div class="detail-row"><span class="label">${escapeHtml(task.escort_name)}</span><span class="value">${escapeHtml(task.escort_phone || '')}</span></div></div>` : ''}
            ${task.note ? `<div class="detail-section"><div class="section-title">备注</div><div class="detail-row"><span class="value">${escapeHtml(task.note)}</span></div></div>` : ''}
        `;
    }

    const statusActions = document.getElementById('statusActions');
    if (statusActions) statusActions.innerHTML = '';

    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.add('active');
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.remove('active');
}

async function updateStatus(status) {
    if (!transportState.editingTaskId) return;

    try {
        await put(`/transport/tasks/${transportState.editingTaskId}/status`, { status });

        closeDetailModal();
        await loadTasks();
        renderTimeline();
        showToast('状态已更新');
    } catch (e) {
        showToast('更新失败: ' + (e.message || ''));
    }
}

function editTask() {
    closeDetailModal();
    const task = transportState.tasks.find(t => t.id === transportState.editingTaskId);
    if (!task) return;

    openTaskModal(task.id, task.vehicle_id, task.start_time);

    const title = document.getElementById('taskModalTitle');
    if (title) title.textContent = '编辑行程';
    document.getElementById('taskDate').value = task.task_date;
    document.getElementById('taskStartTime').value = task.start_time;
    document.getElementById('taskEndTime').value = task.end_time;
    document.getElementById('taskFrom').value = task.from_location;
    document.getElementById('taskTo').value = task.to_location;
    document.getElementById('taskVehicle').value = task.vehicle_id;
    document.getElementById('escortName').value = task.escort_name || '';
    document.getElementById('escortPhone').value = task.escort_phone || '';
    document.getElementById('taskNote').value = task.note || '';
    
    const taskTypeRadio = document.querySelector(`input[name="taskType"][value="${task.task_type}"]`);
    if (taskTypeRadio) taskTypeRadio.checked = true;

    transportState.selectedPassengers = (task.passengers || []).map(p => p.id);
    document.querySelectorAll('.person-tag').forEach(tag => {
        tag.classList.toggle('selected', transportState.selectedPassengers.includes(parseInt(tag.dataset.id)));
    });
    updateSelectionInfo();
}

async function deleteTask() {
    if (!transportState.editingTaskId) return;
    const confirmed = await showConfirm('确定删除此行程？');
    if (!confirmed) return;

    try {
        await del(`/transport/tasks/${transportState.editingTaskId}`);

        closeDetailModal();
        await loadTasks();
        renderTimeline();
        showToast('已删除');
    } catch (e) {
        showToast('删除失败: ' + (e.message || ''));
    }
}

function openVehicleModal(vehicleId) {
    transportState.editingVehicleId = vehicleId;
    const modal = document.getElementById('vehicleModal');
    const title = document.getElementById('vehicleModalTitle');

    if (vehicleId) {
        const v = transportState.vehicles.find(v => v.id === vehicleId);
        if (v) {
            if (title) title.textContent = '编辑车辆';
            document.getElementById('vehicleId').value = v.id;
            document.getElementById('vehiclePlate').value = v.plate || '';
            document.getElementById('vehicleModel').value = v.model || '';
            document.getElementById('vehicleSeats').value = v.seats || '';
            document.getElementById('vehicleDriverName').value = v.driver_name || '';
            document.getElementById('vehicleDriverPhone').value = v.driver_phone || '';
        }
    } else {
        if (title) title.textContent = '添加车辆';
        const form = document.getElementById('vehicleForm');
        if (form) form.reset();
        document.getElementById('vehicleId').value = '';
    }

    if (modal) modal.classList.add('active');
}

function closeVehicleModal() {
    const modal = document.getElementById('vehicleModal');
    if (modal) modal.classList.remove('active');
}

function editVehicle(id) {
    openVehicleModal(id);
}

async function saveVehicle() {
    const plate = document.getElementById('vehiclePlate').value;
    const model = document.getElementById('vehicleModel').value;
    const seats = document.getElementById('vehicleSeats').value;
    const driverName = document.getElementById('vehicleDriverName').value;
    const driverPhone = document.getElementById('vehicleDriverPhone').value;

    if (!plate || !model || !seats) {
        showToast('请填写完整信息');
        return;
    }
    
    if (driverPhone && !/^1[3-9]\d{9}$/.test(driverPhone)) {
        showToast('请输入正确的手机号');
        return;
    }

    const data = {
        plate,
        model,
        seats: parseInt(seats),
        driver_name: driverName || null,
        driver_phone: driverPhone || null
    };

    try {
        if (transportState.editingVehicleId) {
            await put(`/transport/vehicles/${transportState.editingVehicleId}`, data);
        } else {
            await post(`/transport/${conferenceId}/vehicles`, data);
        }

        closeVehicleModal();
        await loadVehicles();
        renderVehicleList();
        renderTimeline();
        showToast('保存成功');
    } catch (e) {
        showToast('保存失败: ' + (e.message || ''));
    }
}

async function deleteVehicle(id) {
    const confirmed = await showConfirm('确定删除此车辆？');
    if (!confirmed) return;

    try {
        await del(`/transport/vehicles/${id}`);

        await loadVehicles();
        renderVehicleList();
        renderTimeline();
        showToast('已删除');
    } catch (e) {
        showToast('删除失败: ' + (e.message || ''));
    }
}

async function checkUnassignedParticipants() {
    try {
        const allParticipants = await get(`/participants/${conferenceId}`);
        
        const needTransport = allParticipants.filter(p => p.has_transport === true);
        
        const assignedIds = new Set();
        transportState.tasks.forEach(task => {
            (task.passengers || []).forEach(p => assignedIds.add(p.id));
        });
        
        const unassigned = needTransport.filter(p => !assignedIds.has(p.id));
        return unassigned;
    } catch (e) {
        console.error('检查未分配参会人失败', e);
        return [];
    }
}

async function exportTransportPDF() {
    const unassignedParticipants = await checkUnassignedParticipants();
    if (unassignedParticipants.length > 0) {
        const names = unassignedParticipants.slice(0, 5).map(p => p.name).join('、');
        const more = unassignedParticipants.length > 5 ? `等${unassignedParticipants.length}人` : '';
        const confirmed = await showConfirm(`以下参会人需要接送但未分配行程：\n${names}${more}\n\n是否继续导出？`);
        if (!confirmed) return;
    }

    if (transportState.tasks.length === 0) {
        showToast('暂无行程数据可导出');
        return;
    }

    const btn = document.querySelector('.btn-export');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 导出中...';
    }

    try {
        const script1 = document.createElement('script');
        script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script1);
        await new Promise(resolve => script1.onload = resolve);

        const script2 = document.createElement('script');
        script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        document.head.appendChild(script2);
        await new Promise(resolve => script2.onload = resolve);

        const { jsPDF } = window.jspdf;

        const container = document.createElement('div');
        container.className = 'pdf-export-container';

        const dateStr = formatDate(transportState.currentDate);
        const isToday = formatDate(new Date()) === dateStr;
        const displayDate = isToday ? '今天' : dateStr;

        let tasksHtml = transportState.tasks.map(task => {
            const vehicle = transportState.vehicles.find(v => v.id === task.vehicle_id);
            const typeLabel = task.task_type === 'pickup' ? '🛬 接' : '🛫 送';
            const passengers = task.passengers || [];
            const passengersHtml = passengers.map(p => 
                `<span class="pdf-passenger-tag">${escapeHtml(p.name)}${p.company ? ' (' + escapeHtml(p.company) + ')' : ''}</span>`
            ).join('');

            return `
                <div class="pdf-task-item">
                    <div class="pdf-task-header">
                        <span class="pdf-task-type">${typeLabel}</span>
                        <span class="pdf-task-time">${escapeHtml(task.start_time)}</span>
                        <span class="pdf-task-placeholder"></span>
                    </div>
                    <div class="pdf-task-row" style="display: flex; justify-content: space-between;">
                        <span style="flex:1;"><span class="pdf-task-label">司机：</span><span class="pdf-task-value">${escapeHtml(vehicle?.driver_name || '')} ${escapeHtml(vehicle?.driver_phone || '')}</span></span>
                        <span style="flex:1;"><span class="pdf-task-label">车辆：</span><span class="pdf-task-value">${escapeHtml(vehicle?.plate || '')}(${escapeHtml(vehicle?.model || '')})</span></span>
                        <span style="flex:1;"><span class="pdf-task-label">陪同：</span><span class="pdf-task-value">${escapeHtml(task.escort_name || '')} ${escapeHtml(task.escort_phone || '')}</span></span>
                    </div>
                    <div class="pdf-task-row">
                        <span class="pdf-task-label">路线：</span>
                        <span class="pdf-task-value">${escapeHtml(task.from_location)} → ${escapeHtml(task.to_location)}</span>
                    </div>
                    ${passengers.length > 0 ? `
                    <div class="pdf-passengers">
                        <div class="pdf-task-row">
                            <span class="pdf-task-label">乘客：</span>
                            <span class="pdf-task-value">${passengersHtml}</span>
                        </div>
                    </div>
                    ` : ''}
                    ${task.note ? `
                    <div class="pdf-task-row">
                        <span class="pdf-task-label">备注：</span>
                        <span class="pdf-task-value">${escapeHtml(task.note)}</span>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="pdf-title">接送行程安排</div>
            <div class="pdf-date">日期：${displayDate}</div>
            ${tasksHtml}
        `;

        document.body.appendChild(container);

        const htmlCanvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        document.body.removeChild(container);

        const imgData = htmlCanvas.toDataURL('image/png');
        const pdf = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 20;
        const imgHeight = (htmlCanvas.height * imgWidth) / htmlCanvas.width;
        const pages = Math.ceil(imgHeight / (pageHeight - 20));

        for (let i = 0; i < pages; i++) {
            if (i > 0) pdf.addPage();
            const yOffset = -i * (pageHeight - 20);
            pdf.addImage(imgData, 'PNG', 10, yOffset + 10, imgWidth, imgHeight);
        }

        pdf.save(`接送行程_${dateStr}.pdf`);
        showToast('导出成功');
    } catch (e) {
        console.error(e);
        showToast('导出失败: ' + (e.message || ''));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📄 导出';
        }
    }
}

window.loadTransport = loadTransport;
window.changeDate = changeDate;
window.switchTransportTab = switchTransportTab;
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.saveTask = saveTask;
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.updateStatus = updateStatus;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.openVehicleModal = openVehicleModal;
window.closeVehicleModal = closeVehicleModal;
window.editVehicle = editVehicle;
window.saveVehicle = saveVehicle;
window.deleteVehicle = deleteVehicle;
window.togglePerson = togglePerson;
window.selectByCompany = selectByCompany;
window.checkSeatsLimit = checkSeatsLimit;
window.exportTransportPDF = exportTransportPDF;
window.handleTransportFab = handleTransportFab;

function handleTransportFab() {
    if (transportState.currentTab === 'vehicles') {
        openVehicleModal();
    } else {
        openTaskModal();
    }
}
