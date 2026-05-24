let restaurants = [];
let restaurantParticipants = [];
let restaurantAssignments = [];
let pendingSeatIndex = null;
let restaurantDragState = { tableId: null, seatIndex: null, participantId: null, assignmentId: null };
let restaurantState = {
    conferenceId: null,
    showRestaurantDetail: false,
    mealType: 'lunch'
};

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function loadRestaurant(conferenceId) {
    restaurantState.conferenceId = conferenceId;
    
    try {
        const data = await get(`/restaurant/${conferenceId}/summary?meal_type=${restaurantState.mealType}`);

        if (data.restaurants && data.restaurants.length > 0) {
            document.getElementById('restaurantSummary').style.display = 'block';
            document.getElementById('restaurantCount').textContent = data.restaurants.length;
            document.getElementById('restaurantTableCount').textContent = data.table_count;
            document.getElementById('restaurantTotalCapacity').textContent = data.total_capacity;
            document.getElementById('restaurantAvailableCount').textContent = data.total_capacity - data.assigned_count;
            document.getElementById('restaurantParticipantCount').textContent = data.meal_participants || 0;
            document.getElementById('restaurantAssignedCount').textContent = data.assigned_count;
            document.getElementById('restaurantUnassignedCount').textContent = data.unassigned_count;

            restaurants = data.restaurants;
            
            let html = '';
            for (const r of data.restaurants) {
                html += `<div class="restaurant-card" style="border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:15px;background:#fff;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <h4 style="margin:0;">🍽️ ${escapeHtml(r.name)}</h4>
                        <div class="no-export">
                            <button class="btn btn-primary" style="padding:4px 8px;font-size:12px;margin-right:4px;" onclick="showTableModal(${r.id})">➕ 添加桌位</button>
                            <button class="btn btn-danger" style="padding:4px 8px;font-size:12px;" onclick="deleteRestaurant(${r.id})">🗑️ 删除</button>
                        </div>
                    </div>
                    <p style="margin:0 0 10px 0;color:#666;font-size:12px;">地址: ${escapeHtml(r.address || '未设置')} | 容量: ${r.capacity}人</p>
                    <div id="restaurant-tables-${r.id}"></div>
                </div>`;
            }
            document.getElementById('restaurantList').innerHTML = html;

            for (const r of data.restaurants) {
                loadRestaurantTables(r.id);
            }
        } else {
            document.getElementById('restaurantSummary').style.display = 'none';
            document.getElementById('restaurantList').innerHTML = '<div style="text-align:center;color:#999;padding:40px;">暂无餐厅，请添加</div>';
        }
    } catch (e) {
        console.error('加载餐厅数据失败', e);
    }
}

function getRestaurantSeatContent(p, seatIndex, isAssigned) {
    if (!isAssigned) {
        return `<span style="font-size:9px;">${seatIndex + 1}</span>`;
    }
    const showDetail = restaurantState.showRestaurantDetail;
    if (showDetail) {
        const company = p.company || '';
        const position = p.position || '';
        return `<span style="font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:38px;">${escapeHtml(p.name)}</span>
            ${company ? `<span style="font-size:7px;opacity:0.9;max-width:38px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(company)}</span>` : ''}
            ${position ? `<span style="font-size:7px;opacity:0.8;max-width:38px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(position)}</span>` : ''}`;
    }
    return `<span style="font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:38px;">${escapeHtml(p.name)}</span>`;
}

function getRestaurantSeatContentShort(p, seatIndex, isAssigned) {
    if (!isAssigned) {
        return seatIndex + 1;
    }
    const showDetail = restaurantState.showRestaurantDetail;
    if (showDetail) {
        const company = p.company || '';
        return `<span style="font-size:8px;">${escapeHtml(p.name.substring(0, 2))}</span>
            ${company ? `<br><span style="font-size:6px;opacity:0.9;">${escapeHtml(company.substring(0, 4))}</span>` : ''}`;
    }
    return escapeHtml(p.name.substring(0, 2));
}

async function loadRestaurantTables(restaurantId) {
    try {
        const tables = await get(`/restaurant/${restaurantState.conferenceId}/tables?restaurant_id=${restaurantId}`);
        const assignments = await get(`/restaurant/${restaurantState.conferenceId}/assignments?meal_type=${restaurantState.mealType}`);
        restaurantAssignments = assignments || [];
        
        const participants = await get(`/participants/${restaurantState.conferenceId}`);
        restaurantParticipants = participants || [];

        let html = '<div style="display:flex;flex-wrap:wrap;gap:15px;margin-top:10px;">';
        for (const t of tables) {
            const tableAssignments = assignments.filter(a => a.table_id === t.id && a.meal_type === restaurantState.mealType);

            const typeName = t.table_type === 'round' ? '包间' : (t.table_type === 'room' ? '包间' : (t.table_type === 'long' ? '长桌' : '大厅'));

            let seatHtml = '';
            if (t.table_type === 'round' || t.table_type === 'hall') {
                const containerSize = 240;
                const tableDiameter = 100;
                const tableRadius = tableDiameter / 2;
                const seatRadius = 85;
                const seatSize = 44;
                const center = containerSize / 2;

                seatHtml = `<div style="position:relative;width:${containerSize}px;height:${containerSize}px;margin:0 auto;">`;
                seatHtml += `<div style="position:absolute;left:${center - tableRadius}px;top:${center - tableRadius}px;width:${tableDiameter}px;height:${tableDiameter}px;background:#f8f8f8;border:4px solid #888;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;color:#555;font-weight:500;">${escapeHtml(t.name)}</div>`;

                for (let i = 0; i < t.capacity; i++) {
                    const angle = (360 / t.capacity) * i - 90;
                    const rad = angle * Math.PI / 180;
                    const x = center + seatRadius * Math.cos(rad) - seatSize / 2;
                    const y = center + seatRadius * Math.sin(rad) - seatSize / 2;
                    const seatAssignment = tableAssignments.find(a => a.seat_index === i);
                    const p = seatAssignment ? participants.find(pp => pp.id === seatAssignment.participant_id) : null;
                    const isAssigned = !!p;
                    const bgColor = isAssigned ? '#4a90d9' : '#fff';
                    const textColor = isAssigned ? '#fff' : '#666';
                    const borderColor = isAssigned ? '#3a7bc8' : '#ddd';
                    const assignmentId = seatAssignment ? seatAssignment.id : '';
                    const detailSize = restaurantState.showRestaurantDetail ? 55 : seatSize;
                    seatHtml += `<div class="restaurant-seat ${isAssigned ? 'occupied' : 'empty'}"
                        data-table-id="${t.id}"
                        data-seat-index="${i}"
                        data-assignment-id="${assignmentId}"
                        data-participant-id="${isAssigned ? p.id : ''}"
                        ${isAssigned ? 'draggable="true"' : ''}
                        ondragstart="handleRestaurantDragStart(event)"
                        ondragover="handleRestaurantDragOver(event)"
                        ondrop="handleRestaurantDrop(event)"
                        ondragend="handleRestaurantDragEnd(event)"
                        style="position:absolute;left:${x}px;top:${y}px;width:${detailSize}px;height:${detailSize}px;background:${bgColor};border:2px solid ${borderColor};border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:${textColor};cursor:pointer;box-shadow:${isAssigned ? '0 2px 4px rgba(74,144,217,0.4)' : '0 1px 3px rgba(0,0,0,0.1)'};"
                        onclick="${isAssigned ? `clearRestaurantSeat(${assignmentId}, ${t.id})` : `showRestaurantAssignModal(${t.id}, ${i})`}"
                        title="${isAssigned ? '点击取消分配' : '点击分配'}">
                        ${getRestaurantSeatContent(p, i, isAssigned)}
                    </div>`;
                }
                seatHtml += '</div>';
            } else if (t.table_type === 'long') {
                const tableWidth = 160;
                const tableHeight = 50;
                const seatsPerSide = Math.ceil(t.capacity / 2);
                const seatSize = 42;
                const seatGap = 8;
                const topGap = 8;
                const totalSeatsWidth = seatsPerSide * seatSize + (seatsPerSide - 1) * seatGap;
                const containerWidth = Math.max(200, totalSeatsWidth + 20);
                const startX = (containerWidth - totalSeatsWidth) / 2;
                const centerY = 120;
                const tableTop = centerY - tableHeight / 2;
                seatHtml = `<div style="position:relative;width:${containerWidth}px;height:240px;margin:0 auto;">`;
                seatHtml += `<div style="position:absolute;left:${(containerWidth - tableWidth) / 2}px;top:${tableTop}px;width:${tableWidth}px;height:${tableHeight}px;background:#f5f5f5;border:3px solid #999;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#666;">${escapeHtml(t.name)}</div>`;

                for (let i = 0; i < seatsPerSide && i < t.capacity; i++) {
                    const seatAssignment = tableAssignments.find(a => a.seat_index === i);
                    const p = seatAssignment ? participants.find(pp => pp.id === seatAssignment.participant_id) : null;
                    const isAssigned = !!p;
                    const assignmentId = seatAssignment ? seatAssignment.id : '';
                    const seatX = startX + i * (seatSize + seatGap);
                    const topSeatTop = tableTop - topGap - seatSize;
                    const detailSize = restaurantState.showRestaurantDetail ? 50 : seatSize;
                    seatHtml += `<div class="restaurant-seat ${isAssigned ? 'occupied' : 'empty'}"
                        data-table-id="${t.id}" data-seat-index="${i}" data-assignment-id="${assignmentId}"
                        data-participant-id="${isAssigned ? p.id : ''}"
                        ${isAssigned ? 'draggable="true"' : ''}
                        ondragstart="handleRestaurantDragStart(event)" ondragover="handleRestaurantDragOver(event)"
                        ondrop="handleRestaurantDrop(event)" ondragend="handleRestaurantDragEnd(event)"
                        style="position:absolute;left:${seatX}px;top:${topSeatTop}px;width:${detailSize}px;height:${detailSize}px;background:${isAssigned ? '#4a90d9' : '#fff'};border:2px solid ${isAssigned ? '#3a7bc8' : '#ddd'};border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:${isAssigned ? '#fff' : '#666'};cursor:pointer;"
                        onclick="${isAssigned ? `clearRestaurantSeat(${assignmentId}, ${t.id})` : `showRestaurantAssignModal(${t.id}, ${i})`}">${getRestaurantSeatContentShort(p, i, isAssigned)}</div>`;
                }
                for (let i = 0; i < seatsPerSide && (seatsPerSide + i) < t.capacity; i++) {
                    const seatAssignment = tableAssignments.find(a => a.seat_index === (seatsPerSide + i));
                    const p = seatAssignment ? participants.find(pp => pp.id === seatAssignment.participant_id) : null;
                    const isAssigned = !!p;
                    const assignmentId = seatAssignment ? seatAssignment.id : '';
                    const seatX = startX + i * (seatSize + seatGap);
                    const bottomSeatTop = tableTop + tableHeight + topGap;
                    const detailSize = restaurantState.showRestaurantDetail ? 50 : seatSize;
                    seatHtml += `<div class="restaurant-seat ${isAssigned ? 'occupied' : 'empty'}"
                        data-table-id="${t.id}" data-seat-index="${seatsPerSide + i}" data-assignment-id="${assignmentId}"
                        data-participant-id="${isAssigned ? p.id : ''}"
                        ${isAssigned ? 'draggable="true"' : ''}
                        ondragstart="handleRestaurantDragStart(event)" ondragover="handleRestaurantDragOver(event)"
                        ondrop="handleRestaurantDrop(event)" ondragend="handleRestaurantDragEnd(event)"
                        style="position:absolute;left:${seatX}px;top:${bottomSeatTop}px;width:${detailSize}px;height:${detailSize}px;background:${isAssigned ? '#4a90d9' : '#fff'};border:2px solid ${isAssigned ? '#3a7bc8' : '#ddd'};border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:${isAssigned ? '#fff' : '#666'};cursor:pointer;"
                        onclick="${isAssigned ? `clearRestaurantSeat(${assignmentId}, ${t.id})` : `showRestaurantAssignModal(${t.id}, ${seatsPerSide + i})`}">${getRestaurantSeatContentShort(p, seatsPerSide + i, isAssigned)}</div>`;
                }
                seatHtml += '</div>';
            } else {
                seatHtml = `<div style="position:relative;width:160px;min-height:100px;margin:0 auto;text-align:center;">`;
                seatHtml += `<div style="width:140px;height:50px;background:#f5f5f5;border:3px solid #999;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;color:#666;margin-top:25px;">${escapeHtml(t.name)}</div>`;
                seatHtml += `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:3px;margin-top:10px;max-width:160px;">`;
                for (let i = 0; i < t.capacity; i++) {
                    const seatAssignment = tableAssignments.find(a => a.seat_index === i);
                    const p = seatAssignment ? participants.find(pp => pp.id === seatAssignment.participant_id) : null;
                    const isAssigned = !!p;
                    const assignmentId = seatAssignment ? seatAssignment.id : '';
                    const detailWidth = restaurantState.showRestaurantDetail ? 45 : 35;
                    const detailHeight = restaurantState.showRestaurantDetail ? 35 : 26;
                    seatHtml += `<div class="restaurant-seat ${isAssigned ? 'occupied' : 'empty'}"
                        data-table-id="${t.id}" data-seat-index="${i}" data-assignment-id="${assignmentId}"
                        data-participant-id="${isAssigned ? p.id : ''}"
                        ${isAssigned ? 'draggable="true"' : ''}
                        ondragstart="handleRestaurantDragStart(event)" ondragover="handleRestaurantDragOver(event)"
                        ondrop="handleRestaurantDrop(event)" ondragend="handleRestaurantDragEnd(event)"
                        style="width:${detailWidth}px;height:${detailHeight}px;background:${isAssigned ? '#4a90d9' : '#fff'};border:2px solid ${isAssigned ? '#3a7bc8' : '#ddd'};border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:${isAssigned ? '#fff' : '#666'};cursor:pointer;"
                        onclick="${isAssigned ? `clearRestaurantSeat(${assignmentId}, ${t.id})` : `showRestaurantAssignModal(${t.id}, ${i})`}">${getRestaurantSeatContentShort(p, i, isAssigned)}</div>`;
                }
                seatHtml += '</div></div>';
            }

            html += `<div id="restaurant-table-${t.id}" style="border:1px solid #ddd;border-radius:8px;padding:15px;width:280px;background:#fff;flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:600;">🍽️ ${escapeHtml(t.name)} <span style="color:#666;font-weight:normal;font-size:12px;">(${typeName})</span></div>
                    <div style="font-size:11px;color:#999;">容量: ${t.capacity}座 | 已坐: ${tableAssignments.length}</div>
                </div>
                ${seatHtml}
                <div class="no-export" style="text-align:center;margin-top:8px;">
                    <button class="btn btn-primary" style="padding:2px 8px;font-size:11px;" onclick="showRestaurantAssignModal(${t.id})">分配</button>
                    <button class="btn btn-warning" style="padding:2px 8px;font-size:11px;" onclick="clearTableAssignments(${t.id})">清空</button>
                    <button class="btn btn-danger" style="padding:2px 8px;font-size:11px;" onclick="deleteTable(${t.id})">删除</button>
                </div>
            </div>`;
        }
        html += '</div>';
        document.getElementById(`restaurant-tables-${restaurantId}`).innerHTML = html;
    } catch (e) {
        console.error('加载桌位数据失败', e);
    }
}

function showRestaurantModal(editId) {
    document.getElementById('restaurantModalTitle').textContent = editId ? '编辑餐厅' : '添加餐厅';
    document.getElementById('editRestaurantId').value = editId || '';
    document.getElementById('restaurantName').value = '';
    document.getElementById('restaurantAddress').value = '';
    document.getElementById('restaurantCapacity').value = '0';
    document.getElementById('restaurantNote').value = '';
    document.getElementById('restaurantModal').classList.add('active');
}

function closeRestaurantModal() {
    document.getElementById('restaurantModal').classList.remove('active');
}

async function saveRestaurant() {
    const editId = document.getElementById('editRestaurantId').value;
    const name = document.getElementById('restaurantName').value.trim();
    if (!name) {
        showToast('请输入餐厅名称');
        return;
    }
    const address = document.getElementById('restaurantAddress').value.trim();
    const capacity = parseInt(document.getElementById('restaurantCapacity').value) || 0;
    const note = document.getElementById('restaurantNote').value.trim();

    try {
        if (editId) {
            await put(`/restaurant/restaurants/${editId}`, {name, address, capacity, note});
        } else {
            await post(`/restaurant/${restaurantState.conferenceId}/restaurants`, {name, address, capacity, note});
        }
        showToast('保存成功');
        closeRestaurantModal();
        loadRestaurant(restaurantState.conferenceId);
    } catch (e) {
        showToast(e.message || '保存失败');
    }
}

async function deleteRestaurant(restaurantId) {
    const confirmed = await showConfirm('确定要删除该餐厅吗？');
    if (!confirmed) return;
    try {
        await del(`/restaurant/restaurants/${restaurantId}`);
        showToast('删除成功');
        loadRestaurant(restaurantState.conferenceId);
    } catch (e) {
        showToast(e.message || '删除失败');
    }
}

function updateTableNamePrefix() {
    const type = document.getElementById('tableType').value;
    const prefixMap = {'round': '包间', 'long': '长桌', 'hall': '大厅'};
    document.getElementById('tableNamePrefix').value = prefixMap[type] || '桌位';
}

function showTableModal(restaurantId) {
    document.getElementById('tableRestaurantId').value = restaurantId;
    document.getElementById('tableType').value = 'round';
    document.getElementById('tableCapacity').value = '10';
    document.getElementById('tableQuantity').value = '1';
    document.getElementById('tableNamePrefix').value = '包间';
    document.getElementById('tableModal').classList.add('active');
}

function closeTableModal() {
    document.getElementById('tableModal').classList.remove('active');
}

async function saveTables() {
    const restaurantId = document.getElementById('tableRestaurantId').value;
    const tableType = document.getElementById('tableType').value;
    const capacity = parseInt(document.getElementById('tableCapacity').value) || 10;
    const quantity = parseInt(document.getElementById('tableQuantity').value) || 1;
    const namePrefix = document.getElementById('tableNamePrefix').value.trim() || '桌位';

    try {
        await post(`/restaurant/${restaurantState.conferenceId}/tables/batch`, {
            restaurant_id: parseInt(restaurantId),
            table_type: tableType,
            capacity_per_table: capacity,
            quantity: quantity,
            name_prefix: namePrefix
        });
        showToast('保存成功');
        closeTableModal();
        loadRestaurant(restaurantState.conferenceId);
    } catch (e) {
        showToast(e.message || '保存失败');
    }
}

async function deleteTable(tableId) {
    const confirmed = await showConfirm('确定要删除该桌位吗？');
    if (!confirmed) return;
    try {
        await del(`/restaurant/tables/${tableId}`);
        showToast('删除成功');
        loadRestaurant(restaurantState.conferenceId);
    } catch (e) {
        showToast(e.message || '删除失败');
    }
}

async function clearTableAssignments(tableId) {
    const confirmed = await showConfirm('确定要清空该桌位的所有分配吗？');
    if (!confirmed) return;
    try {
        await del(`/restaurant/${restaurantState.conferenceId}/assignments/table/${tableId}`);
        showToast('已清空');
        loadRestaurant(restaurantState.conferenceId);
    } catch (e) {
        showToast(e.message || '清空失败');
    }
}

async function clearRestaurantSeat(assignmentId, tableId) {
    try {
        await del(`/restaurant/assignments/${assignmentId}`);
        showToast('已取消分配');
        loadRestaurant(restaurantState.conferenceId);
    } catch (e) {
        showToast(e.message || '取消失败');
    }
}

function showRestaurantAssignModal(tableId, seatIndex = null) {
    document.getElementById('assignTableId').value = tableId;
    pendingSeatIndex = seatIndex;
    loadCompanyFilter();
    loadParticipantsForAssign();
    document.getElementById('restaurantAssignModal').classList.add('active');
}

async function loadCompanyFilter() {
    try {
        const participants = await get(`/participants/${restaurantState.conferenceId}`);
        const mealParticipants = participants.filter(p => p.has_meal === true);
        const companies = [...new Set(mealParticipants.map(p => p.company).filter(c => c))];
        companies.sort();

        const select = document.getElementById('assignCompanyFilter');
        select.innerHTML = '<option value="">全部公司</option>';
        for (const company of companies) {
            select.innerHTML += `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`;
        }
    } catch (e) {
        console.error('加载公司列表失败', e);
    }
}

function onCompanyFilterChange(company) {
    loadParticipantsForAssign(company);
}

function closeRestaurantAssignModal() {
    document.getElementById('restaurantAssignModal').classList.remove('active');
    pendingSeatIndex = null;
}

async function loadParticipantsForAssign(companyFilter = '') {
    try {
        const participants = await get(`/participants/${restaurantState.conferenceId}`);
        const mealParticipants = participants.filter(p => p.has_meal === true);

        const assignments = await get(`/restaurant/${restaurantState.conferenceId}/assignments?meal_type=${restaurantState.mealType}`);
        const assignedIds = [...new Set(assignments.map(a => a.participant_id))];
        let available = mealParticipants.filter(p => !assignedIds.includes(p.id));

        if (companyFilter) {
            available = available.filter(p => p.company === companyFilter);
        }

        const container = document.getElementById('participantCheckboxes');
        if (available.length === 0) {
            container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">所有参会人已分配完毕</div>';
            return;
        }

        const inputType = 'checkbox';
        const inputClass = 'participant-checkbox';

        let html = `<div style="margin-bottom:10px;color:#666;font-size:12px;">${pendingSeatIndex !== null ? '请选择一位参会人分配到该座位：' : '请选择参会人（可多选）：'}</div>`;
        html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">';
        for (const p of available) {
            html += `<label style="display:flex;align-items:center;gap:6px;padding:6px;border:1px solid #eee;border-radius:4px;cursor:pointer;">
                <input type="${inputType}" class="${inputClass}" name="participant-select" value="${p.id}">
                <span style="font-size:13px;">${escapeHtml(p.name)}</span>
                <span style="font-size:11px;color:#999;">${escapeHtml(p.company || '')}</span>
            </label>`;
        }
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error('加载参会人失败', e);
    }
}

async function saveAssignment() {
    const tableId = parseInt(document.getElementById('assignTableId').value);
    const mealType = restaurantState.mealType;

    const checkboxes = document.querySelectorAll('.participant-checkbox:checked');
    if (checkboxes.length === 0) {
        showToast('请选择参会人');
        return;
    }
    const selectedParticipants = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (pendingSeatIndex !== null) {
        const participantId = selectedParticipants[0];
        try {
            await post(`/restaurant/${restaurantState.conferenceId}/assignments`, {
                table_id: tableId,
                seat_index: pendingSeatIndex,
                participant_id: participantId,
                meal_type: mealType
            });
            showToast('分配成功');
        } catch (e) {
            showToast(e.message || '分配失败');
            return;
        }
        closeRestaurantAssignModal();
        loadRestaurant(restaurantState.conferenceId);
        return;
    }

    let successCount = 0;
    for (const participantId of selectedParticipants) {
        try {
            await post(`/restaurant/${restaurantState.conferenceId}/assignments`, {
                table_id: tableId,
                participant_id: participantId,
                meal_type: mealType
            });
            successCount++;
        } catch (e) {
            console.error('分配失败', e);
        }
    }

    showToast(`成功分配 ${successCount} 人`);
    closeRestaurantAssignModal();
    loadRestaurant(restaurantState.conferenceId);
}

function handleRestaurantDragStart(e) {
    const seat = e.target.closest('.restaurant-seat');
    if (!seat || !seat.classList.contains('occupied')) {
        e.preventDefault();
        return;
    }
    restaurantDragState = {
        tableId: parseInt(seat.dataset.tableId),
        seatIndex: parseInt(seat.dataset.seatIndex),
        participantId: parseInt(seat.dataset.participantId),
        assignmentId: parseInt(seat.dataset.assignmentId)
    };
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
}

function handleRestaurantDragOver(e) {
    const seat = e.target.closest('.restaurant-seat');
    if (!seat) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const isOccupied = seat.classList.contains('occupied');
    seat.style.background = isOccupied ? '#3a7bc8' : '#e3f2fd';
    seat.style.borderColor = '#4a90d9';
}

function handleRestaurantDragLeave(e) {
    const seat = e.target.closest('.restaurant-seat');
    if (seat) {
        const isOccupied = seat.classList.contains('occupied');
        seat.style.background = isOccupied ? '#4a90d9' : '#fff';
        seat.style.borderColor = isOccupied ? '#3a7bc8' : '#ddd';
    }
}

function handleRestaurantDragEnd(e) {
    const seat = e.target.closest('.restaurant-seat');
    if (seat) {
        const isOccupied = seat.classList.contains('occupied');
        seat.style.background = isOccupied ? '#4a90d9' : '#fff';
        seat.style.borderColor = isOccupied ? '#3a7bc8' : '#ddd';
    }
}

async function handleRestaurantDrop(e) {
    e.preventDefault();
    const targetSeat = e.target.closest('.restaurant-seat');
    if (!targetSeat || !restaurantDragState.participantId) return;

    const targetTableId = parseInt(targetSeat.dataset.tableId);
    const targetAssignmentId = targetSeat.dataset.assignmentId ? parseInt(targetSeat.dataset.assignmentId) : null;

    if (targetAssignmentId === restaurantDragState.assignmentId) {
        return;
    }

    const sourceTableId = restaurantDragState.tableId;

    try {
        if (targetAssignmentId) {
            await post(`/restaurant/${restaurantState.conferenceId}/assignments/swap`, {
                source_assignment_id: restaurantDragState.assignmentId,
                target_assignment_id: targetAssignmentId
            });
        } else {
            await post(`/restaurant/${restaurantState.conferenceId}/assignments/move`, {
                assignment_id: restaurantDragState.assignmentId,
                target_table_id: targetTableId,
                target_seat_index: parseInt(targetSeat.dataset.seatIndex)
            });
        }
        showToast('操作成功');
        await loadRestaurantTablesForIds([sourceTableId, targetTableId]);
    } catch (e) {
        showToast(e.message || '操作失败');
        loadRestaurant(restaurantState.conferenceId);
    }
}

async function loadRestaurantTablesForIds(tableIds) {
    const uniqueIds = [...new Set(tableIds)];
    const assignments = await get(`/restaurant/${restaurantState.conferenceId}/assignments`);
    const participants = await get(`/participants/${restaurantState.conferenceId}`);

    for (const tableId of uniqueIds) {
        const tableEl = document.getElementById(`restaurant-table-${tableId}`);
        if (!tableEl) continue;

        const tableAssignments = assignments.filter(a => a.table_id === tableId);
        const allTables = await get(`/restaurant/${restaurantState.conferenceId}/tables?restaurant_id=0`);
        const t = allTables.find(tt => tt.id === tableId);
        if (!t) continue;

        const typeName = t.table_type === 'round' ? '包间' : (t.table_type === 'room' ? '包间' : (t.table_type === 'long' ? '长桌' : '大厅'));
        let seatHtml = '';

        if (t.table_type === 'round' || t.table_type === 'hall') {
            const containerSize = 240;
            const tableDiameter = 100;
            const tableRadius = tableDiameter / 2;
            const seatRadius = 85;
            const seatSize = 44;
            const center = containerSize / 2;

            seatHtml = `<div style="position:relative;width:${containerSize}px;height:${containerSize}px;margin:0 auto;">`;
            seatHtml += `<div style="position:absolute;left:${center - tableRadius}px;top:${center - tableRadius}px;width:${tableDiameter}px;height:${tableDiameter}px;background:#f8f8f8;border:4px solid #888;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;color:#555;font-weight:500;">${escapeHtml(t.name)}</div>`;

            for (let i = 0; i < t.capacity; i++) {
                const angle = (360 / t.capacity) * i - 90;
                const rad = angle * Math.PI / 180;
                const x = center + seatRadius * Math.cos(rad) - seatSize / 2;
                const y = center + seatRadius * Math.sin(rad) - seatSize / 2;
                const seatAssignment = tableAssignments.find(a => a.seat_index === i);
                const p = seatAssignment ? participants.find(pp => pp.id === seatAssignment.participant_id) : null;
                const isAssigned = !!p;
                const bgColor = isAssigned ? '#4a90d9' : '#fff';
                const textColor = isAssigned ? '#fff' : '#666';
                const borderColor = isAssigned ? '#3a7bc8' : '#ddd';
                const assignmentId = seatAssignment ? seatAssignment.id : '';
                const detailSize = restaurantState.showRestaurantDetail ? 55 : seatSize;
                seatHtml += `<div class="restaurant-seat ${isAssigned ? 'occupied' : 'empty'}"
                    data-table-id="${tableId}"
                    data-seat-index="${i}"
                    data-assignment-id="${assignmentId}"
                    data-participant-id="${isAssigned ? p.id : ''}"
                    ${isAssigned ? 'draggable="true"' : ''}
                    ondragstart="handleRestaurantDragStart(event)"
                    ondragover="handleRestaurantDragOver(event)"
                    ondrop="handleRestaurantDrop(event)"
                    ondragend="handleRestaurantDragEnd(event)"
                    style="position:absolute;left:${x}px;top:${y}px;width:${detailSize}px;height:${detailSize}px;background:${bgColor};border:2px solid ${borderColor};border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:${textColor};cursor:${isAssigned ? 'grab' : 'pointer'};box-shadow:${isAssigned ? '0 2px 4px rgba(74,144,217,0.4)' : '0 1px 3px rgba(0,0,0,0.1)'};"
                    onclick="${isAssigned ? `clearRestaurantSeat(${assignmentId}, ${tableId})` : `showRestaurantAssignModal(${tableId}, ${i})`}"
                    title="${isAssigned ? escapeHtml(p.name) : '点击分配'}">
                    ${getRestaurantSeatContent(p, i, isAssigned)}
                </div>`;
            }
            seatHtml += '</div>';
        }

        tableEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-weight:600;">🍽️ ${escapeHtml(t.name)} <span style="color:#666;font-weight:normal;font-size:12px;">(${typeName})</span></div>
                <div style="font-size:11px;color:#999;">容量: ${t.capacity}座 | 已坐: ${tableAssignments.length}</div>
            </div>
            ${seatHtml}
            <div class="no-export" style="text-align:center;margin-top:8px;">
                <button class="btn btn-primary" style="padding:2px 8px;font-size:11px;" onclick="showRestaurantAssignModal(${tableId})">➕ 分配</button>
                <button class="btn btn-warning" style="padding:2px 8px;font-size:11px;" onclick="clearTableAssignments(${tableId})">清空</button>
                <button class="btn btn-danger" style="padding:2px 8px;font-size:11px;" onclick="deleteTable(${tableId})">🗑️ 删除</button>
            </div>
        `;
    }
}

function toggleRestaurantDetail() {
    restaurantState.showRestaurantDetail = !restaurantState.showRestaurantDetail;
    const btn = document.getElementById('toggleRestaurantDetailBtn');
    if (btn) {
        btn.textContent = restaurantState.showRestaurantDetail ? '📋 隐藏详情' : '📋 显示详情';
    }
    loadRestaurant(restaurantState.conferenceId);
}

async function exportRestaurantPDF() {
    const restaurantList = document.getElementById('restaurantList');
    if (!restaurantList || restaurantList.children.length === 0) {
        showToast('暂无餐厅数据可导出');
        return;
    }

    const unassignedCount = parseInt(document.getElementById('restaurantUnassignedCount').textContent) || 0;
    if (unassignedCount > 0) {
        showToast(`还有 ${unassignedCount} 位参会人待分配餐厅，请先完成餐厅分配后再导出。`);
        return;
    }

    try {
        const noExportElements = restaurantList.querySelectorAll('.no-export');
        noExportElements.forEach(el => el.style.display = 'none');

        const script1 = document.createElement('script');
        script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script1);
        await new Promise(resolve => script1.onload = resolve);

        const script2 = document.createElement('script');
        script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        document.head.appendChild(script2);
        await new Promise(resolve => script2.onload = resolve);

        const { jsPDF } = window.jspdf;

        const tables = restaurantList.querySelectorAll('[id^="restaurant-table-"]');

        if (tables.length === 0) {
            noExportElements.forEach(el => el.style.display = '');
            showToast('暂无桌位数据可导出');
            return;
        }

        const rows = [];
        let currentRow = [];
        let lastTop = -1;

        tables.forEach(table => {
            const rect = table.getBoundingClientRect();
            const top = Math.round(rect.top);

            if (lastTop === -1 || Math.abs(top - lastTop) < 10) {
                currentRow.push(table);
                lastTop = top;
            } else {
                if (currentRow.length > 0) {
                    rows.push([...currentRow]);
                }
                currentRow = [table];
                lastTop = top;
            }
        });
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const rowsPerPage = 2;

        for (let i = 0; i < rows.length; i += rowsPerPage) {
            if (i > 0) {
                pdf.addPage();
            }

            const pageRows = rows.slice(i, Math.min(i + rowsPerPage, rows.length));

            const container = document.createElement('div');
            container.style.cssText = 'display:flex;flex-wrap:wrap;gap:20px;padding:20px;background:#fff;justify-content:flex-start;align-content:flex-start;';

            for (const row of pageRows) {
                for (const table of row) {
                    const clone = table.cloneNode(true);
                    clone.style.margin = '0';
                    container.appendChild(clone);
                }
            }

            document.body.appendChild(container);
            
            const htmlCanvas = await html2canvas(container, {scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false});
            
            document.body.removeChild(container);
            
            const imgData = htmlCanvas.toDataURL('image/png');
            const imgWidth = pageWidth - 20;
            const imgHeight = (htmlCanvas.height * imgWidth) / htmlCanvas.width;
            
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20));
        }
        
        noExportElements.forEach(el => el.style.display = '');
        pdf.save(`餐厅安排_${new Date().toLocaleDateString()}.pdf`);
        showToast('导出成功');
    } catch (e) {
        console.error(e);
        const noExportElements = restaurantList.querySelectorAll('.no-export');
        noExportElements.forEach(el => el.style.display = '');
        showToast('导出PDF失败: ' + e.message);
    }
}

async function autoAssignTables() {
    if (!restaurantState.conferenceId) {
        showToast('请先选择会议');
        return;
    }
    
    const confirmed = await showConfirm('确定要自动分配座位吗？这将根据优先级规则自动分配未分配的参会人。');
    if (!confirmed) return;
    
    try {
        const result = await post(`/restaurant/${restaurantState.conferenceId}/auto-assign?meal_type=${restaurantState.mealType}`, {});
        if (result.success || result.assigned_count !== undefined) {
            showToast(`自动分配完成，已分配 ${result.assigned_count || 0} 人`);
            loadRestaurant(restaurantState.conferenceId);
        } else {
            showToast(result.detail || '自动分配失败');
        }
    } catch (e) {
        console.error('自动分配失败', e);
        showToast('自动分配失败');
    }
}

async function clearAllTableAssignments() {
    if (!restaurantState.conferenceId) {
        showToast('请先选择会议');
        return;
    }
    
    const confirmed = await showConfirm('确定要清空所有餐厅分配吗？此操作不可恢复。');
    if (!confirmed) return;
    
    try {
        const result = await del(`/restaurant/${restaurantState.conferenceId}/assignments/all?meal_type=${restaurantState.mealType}`);
        if (result.success !== false) {
            showToast(result.message || '清空成功');
            loadRestaurant(restaurantState.conferenceId);
        } else {
            showToast(result.detail || '清空失败');
        }
    } catch (e) {
        console.error('清空失败', e);
        showToast('清空失败');
    }
}

window.loadRestaurant = loadRestaurant;
window.showRestaurantModal = showRestaurantModal;
window.closeRestaurantModal = closeRestaurantModal;
window.saveRestaurant = saveRestaurant;
window.deleteRestaurant = deleteRestaurant;
window.showTableModal = showTableModal;
window.closeTableModal = closeTableModal;
window.saveTables = saveTables;
window.deleteTable = deleteTable;
window.updateTableNamePrefix = updateTableNamePrefix;
window.showRestaurantAssignModal = showRestaurantAssignModal;
window.closeRestaurantAssignModal = closeRestaurantAssignModal;
window.saveAssignment = saveAssignment;
window.clearTableAssignments = clearTableAssignments;
window.clearRestaurantSeat = clearRestaurantSeat;
window.toggleRestaurantDetail = toggleRestaurantDetail;
window.exportRestaurantPDF = exportRestaurantPDF;
window.autoAssignTables = autoAssignTables;
window.clearAllTableAssignments = clearAllTableAssignments;
window.handleRestaurantDragStart = handleRestaurantDragStart;
window.handleRestaurantDragOver = handleRestaurantDragOver;
window.handleRestaurantDragLeave = handleRestaurantDragLeave;
window.handleRestaurantDragEnd = handleRestaurantDragEnd;
window.handleRestaurantDrop = handleRestaurantDrop;
