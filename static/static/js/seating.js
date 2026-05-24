let seatingAreas = [];
let seatingAssignments = [];
let currentPriorityTab = 'position';

let seatingState = {
    conferenceId: null,
    participants: [],
    draggedParticipantId: null,
    sourceSeatId: null,
    draggedFromAssignmentId: null,
    resizingArea: null,
    draggingArea: null,
    resizeStartX: 0,
    resizeStartY: 0,
    resizeStartScale: 1,
    dragStartX: 0,
    dragStartY: 0,
    dragStartAreaX: 0,
    dragStartAreaY: 0,
    showSeatingDetail: false
};

async function loadSeating(conferenceId) {
    seatingState.conferenceId = conferenceId;
    
    try {
        const partResp = await get(`/participants/${conferenceId}`);
        if (partResp) {
            seatingState.participants = partResp;
        }
        
        const data = await get(`/seating/${conferenceId}/assignments`);
        seatingAreas = data?.area_seats || {};
        seatingAssignments = data?.assignments || [];
        window._seatingAssignments = seatingAssignments;
        
        renderSeatingAreas(data);
    } catch (e) {
        console.error('加载排座数据失败', e);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize, seatDisplayNum) {
    const key = `${area.id}-${seat.seat_number}`;
    const assignment = assignedMap[key];
    const seatId = `${area.id}-${seat.seat_number}`;
    const displayNum = seatDisplayNum || seat.seat_number;
    const showDetail = seatingState.showSeatingDetail;
    const detailWidth = showDetail ? Math.max(seatWidth, 100) : seatWidth;
    const detailHeight = showDetail ? Math.max(seatHeight, 70) : seatHeight;

    if (assignment) {
        const participant = (seatingState.participants || []).find(p => p.id === assignment.participant_id);
        const company = participant ? (participant.company || '') : '';
        const position = participant ? (participant.position || '') : '';
        
        if (showDetail) {
            return `<div class="seat occupied" data-seat-id="${seatId}" data-assignment-id="${assignment.id}" data-participant-id="${assignment.participant_id}" draggable="true" ondragstart="handleSeatDragStart(event)" ondragend="this.style.opacity='1'" ondragover="handleSeatDragOver(event)" ondrop="handleSeatDrop(event)" onclick="unassignSeat(${assignment.id})" style="width:${detailWidth}px;height:auto;min-height:${detailHeight}px;background:#4a90d9;color:#fff;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;flex-shrink:0;padding:4px;" title="${escapeHtml(assignment.participant_name)}">
                <span style="font-size:${fontSize}px;font-weight:500;">${escapeHtml(assignment.participant_name || '')}</span>
                ${company ? `<span style="font-size:10px;opacity:0.9;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(company)}</span>` : ''}
                ${position ? `<span style="font-size:10px;opacity:0.8;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(position)}</span>` : ''}
                <span style="font-size:${subFontSize}px;opacity:0.7;">${displayNum}</span>
            </div>`;
        } else {
            return `<div class="seat occupied" data-seat-id="${seatId}" data-assignment-id="${assignment.id}" data-participant-id="${assignment.participant_id}" draggable="true" ondragstart="handleSeatDragStart(event)" ondragend="this.style.opacity='1'" ondragover="handleSeatDragOver(event)" ondrop="handleSeatDrop(event)" onclick="unassignSeat(${assignment.id})" style="width:${seatWidth}px;height:${seatHeight}px;background:#4a90d9;color:#fff;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;flex-shrink:0;" title="${escapeHtml(assignment.participant_name)}">
                <span style="font-size:${fontSize}px;font-weight:500;">${escapeHtml(assignment.participant_name || '')}</span>
                <span style="font-size:${subFontSize}px;opacity:0.8;">${displayNum}</span>
            </div>`;
        }
    } else {
        if (showDetail) {
            return `<div class="seat empty" data-seat-id="${seatId}" data-area-id="${area.id}" data-seat-number="${seat.seat_number}" ondragover="handleSeatDragOver(event)" ondrop="handleSeatDrop(event)" onclick="showAssignModal(${area.id}, '${seat.seat_number}')" style="width:${detailWidth}px;height:auto;min-height:${detailHeight}px;background:#e8e8e8;color:#999;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:4px;">
                <span style="font-size:${fontSize}px;">空座</span>
                <span style="font-size:${subFontSize}px;">${displayNum}</span>
            </div>`;
        } else {
            return `<div class="seat empty" data-seat-id="${seatId}" data-area-id="${area.id}" data-seat-number="${seat.seat_number}" ondragover="handleSeatDragOver(event)" ondrop="handleSeatDrop(event)" onclick="showAssignModal(${area.id}, '${seat.seat_number}')" style="width:${seatWidth}px;height:${seatHeight}px;background:#e8e8e8;color:#999;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;">
                <span style="font-size:${fontSize}px;">空座</span>
                <span style="font-size:${subFontSize}px;">${displayNum}</span>
            </div>`;
        }
    }
}

function renderSeatingAreas(data) {
    const areas = data?.area_seats || {};
    const assignments = data?.assignments || [];
    const assignedMap = {};
    assignments.forEach(a => {
        const key = `${a.area_id}-${a.seat_number}`;
        assignedMap[key] = a;
    });

    let totalSeats = 0;
    let html = '';
    
    for (const [areaId, areaData] of Object.entries(areas)) {
        const area = areaData.area;
        const seats = areaData.seats || [];
        totalSeats += seats.length;
        const scale = area.scale || 1;
        const posX = area.position_x || 0;
        const posY = area.position_y || 0;

        const rows_config = area.config?.rows || '';
        let rowCounts = [];
        if (typeof rows_config === 'string' && rows_config) {
            const normalizedConfig = rows_config.replace(/，/g, ',');
            rowCounts = normalizedConfig.split(',').map(x => parseInt(x.trim())).filter(x => x > 0);
        } else if (Array.isArray(rows_config)) {
            rowCounts = rows_config;
        }
        if (rowCounts.length === 0) {
            rowCounts = [10];
        }

        const baseSeatWidth = 70;
        const baseSeatHeight = 50;
        const baseGap = 6;
        const seatWidth = Math.round(baseSeatWidth * scale);
        const seatHeight = Math.round(baseSeatHeight * scale);
        const gap = Math.round(baseGap * scale);
        const fontSize = Math.round(11 * scale);
        const subFontSize = Math.round(9 * scale);

        const areaType = area.area_type || 'rect';
        let seatHtml = '';

        if (areaType === 'hollow') {
            const top = area.config?.top || 5;
            const bottom = area.config?.bottom || 5;
            const left = area.config?.left || 3;
            const right = area.config?.right || 3;
            const seatSize = Math.min(seatWidth, seatHeight);
            const totalWidth = Math.max(top, bottom) * (seatSize + gap);
            const tableWidth = top * (seatSize + gap) - seatSize;
            const tableHeight = Math.max(left, right) * (seatSize + gap) - seatSize;

            const topSeats = seats.filter(s => s.seat_number.startsWith('T'));
            const bottomSeats = seats.filter(s => s.seat_number.startsWith('B'));
            const leftSeats = seats.filter(s => s.seat_number.startsWith('L'));
            const rightSeats = seats.filter(s => s.seat_number.startsWith('R'));

            seatHtml = `<div class="hollow-layout" style="display:flex;flex-direction:column;align-items:center;gap:${gap}px;padding:10px;min-width:${totalWidth + gap * 2}px;">
                <div class="hollow-top" style="display:flex;gap:${gap}px;justify-content:center;width:100%;">
                    ${topSeats.map((seat, i) => renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize, seat.seat_number)).join('')}
                </div>
                <div class="hollow-middle" style="display:flex;gap:${gap}px;align-items:center;justify-content:center;width:100%;">
                    <div class="hollow-left" style="display:flex;flex-direction:column;gap:${gap}px;align-items:flex-end;">
                        ${leftSeats.map((seat, i) => renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize, seat.seat_number)).join('')}
                    </div>
                    <div class="hollow-table" style="width:${tableWidth}px;height:${tableHeight}px;background:#f5f5f5;border:3px solid #999;border-radius:8px;flex-shrink:0;"></div>
                    <div class="hollow-right" style="display:flex;flex-direction:column;gap:${gap}px;align-items:flex-start;">
                        ${rightSeats.map((seat, i) => renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize, seat.seat_number)).join('')}
                    </div>
                </div>
                <div class="hollow-bottom" style="display:flex;gap:${gap}px;justify-content:center;width:100%;">
                    ${bottomSeats.map((seat, i) => renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize, seat.seat_number)).join('')}
                </div>
            </div>`;
        } else if (areaType === 'face') {
            const leftSeats = seats.filter(s => s.seat_number.startsWith('L'));
            const rightSeats = seats.filter(s => s.seat_number.startsWith('R'));
            seatHtml = `<div class="face-layout" style="display:flex;gap:${gap * 4}px;justify-content:center;padding:10px;min-width:400px;">
                <div class="face-left" style="display:flex;flex-direction:column;gap:${gap}px;">
                    ${leftSeats.map((seat, i) => renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize, 'L' + (i+1))).join('')}
                </div>
                <div class="face-table" style="width:120px;height:${seatHeight * leftSeats.length + gap * 2}px;background:#f5f5f5;border:3px solid #999;border-radius:30px;flex-shrink:0;"></div>
                <div class="face-right" style="display:flex;flex-direction:column;gap:${gap}px;">
                    ${rightSeats.map((seat, i) => renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize, 'R' + (i+1))).join('')}
                </div>
            </div>`;
        } else {
            seatHtml = `<div class="seats-container" style="padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px;">`;
            let seatIdx = 0;
            rowCounts.forEach((count, rowIdx) => {
                seatHtml += `<div class="seat-row" style="display:flex;gap:${gap}px;justify-content:center;width:100%;">`;
                for (let col = 0; col < count; col++) {
                    const seat = seats[seatIdx++];
                    if (!seat) continue;
                    seatHtml += renderSeatHtml(seat, area, assignedMap, seatWidth, seatHeight, fontSize, subFontSize);
                }
                seatHtml += `</div>`;
            });
            seatHtml += `</div>`;
        }

        html += `<div class="seating-area" data-area-id="${area.id}" data-scale="${scale}" style="position:absolute;left:${posX}px;top:${posY}px;border:1px solid #ddd;border-radius:8px;background:#fff;transform-origin:top left;">
            <div class="area-content">
                <div class="area-header" style="background:#f8f9fa;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;cursor:move;" onmousedown="startDragArea(event, ${area.id})">
                    <div>
                        <strong style="font-size:13px;">${escapeHtml(area.name)}</strong>
                        <span style="color:#666;margin-left:6px;font-size:11px;">${seats.length}个座位</span>
                    </div>
                    <div class="no-export">
                        <button class="btn btn-primary" style="padding:4px 8px;font-size:11px;margin-right:4px;" onclick="event.stopPropagation();editArea(${area.id}, '${escapeHtml(area.name).replace(/'/g, "\\'")}', '${area.area_type}', '${encodeURIComponent(JSON.stringify(area.config || {}))}')">编辑</button>
                        <button class="btn btn-danger" style="padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();deleteArea(${area.id})">删除</button>
                    </div>
                </div>
                ${seatHtml}
            </div>
            <div class="resize-handle" style="position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,#ccc 50%);" onmousedown="startResizeArea(event, ${area.id})"></div>
        </div>`;
    }

    if (Object.keys(areas).length === 0) {
        html = '<div class="empty-tip">暂无座位区域，请先添加</div>';
    }

    document.getElementById('seatingAreas').innerHTML = html;
    
    const areaCount = Object.keys(areas).length;
    const assignedCnt = assignments.length;
    const availableSeats = totalSeats - assignedCnt;
    const attendingParticipants = (seatingState.participants || []).filter(p => p.is_attending !== false).length;
    const unassignedSeats = attendingParticipants - assignedCnt;
    
    document.getElementById('areaCount').textContent = areaCount;
    document.getElementById('seatCount').textContent = totalSeats;
    document.getElementById('seatingAvailableCount').textContent = availableSeats;
    document.getElementById('participantCount').textContent = attendingParticipants;
    document.getElementById('seatingAssignedCount').textContent = assignedCnt;
    document.getElementById('seatingUnassignedCount').textContent = unassignedSeats > 0 ? unassignedSeats : 0;
    
    setTimeout(adjustSeatingCanvasHeight, 100);
}

function adjustSeatingCanvasHeight() {
    const container = document.getElementById('seatingAreas');
    const canvas = document.getElementById('seatingCanvas');
    const areas = container.querySelectorAll('.seating-area');
    if (areas.length === 0) return;

    let maxBottom = 0;
    areas.forEach(area => {
        const rect = area.getBoundingClientRect();
        if (rect.bottom > maxBottom) maxBottom = rect.bottom;
    });

    const canvasRect = canvas.getBoundingClientRect();
    const requiredHeight = maxBottom - canvasRect.top + 40;

    if (canvasRect.height < requiredHeight) {
        canvas.style.height = requiredHeight + 'px';
    }
}

function handleSeatDragStart(e) {
    const seat = e.target.closest('.seat');
    if (!seat) return;
    seatingState.draggedParticipantId = seat.dataset.participantId;
    seatingState.sourceSeatId = seat.dataset.seatId;
    seatingState.draggedFromAssignmentId = seat.dataset.assignmentId;
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
}

function handleSeatDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

async function handleSeatDrop(e) {
    e.preventDefault();
    const targetSeat = e.target.closest('.seat');
    if (!targetSeat) return;

    const targetSeatId = targetSeat.dataset.seatId;
    if (!seatingState.draggedParticipantId || !seatingState.sourceSeatId) return;
    if (seatingState.sourceSeatId === targetSeatId) return;

    const sourceParts = seatingState.sourceSeatId.split('-');
    const targetParts = targetSeatId.split('-');
    const sourceAreaId = parseInt(sourceParts[0]);
    const targetAreaId = parseInt(targetParts[0]);
    const sourceSeatNum = sourceParts.slice(1).join('-');
    const targetSeatNum = targetParts.slice(1).join('-');

    const assignments = window._seatingAssignments || [];
    const sourceAssign = assignments.find(a => a.area_id === sourceAreaId && a.seat_number === sourceSeatNum);
    const targetAssign = assignments.find(a => a.area_id === targetAreaId && a.seat_number === targetSeatNum);

    try {
        if (sourceAssign && targetAssign) {
            await post('/seating/swap', {
                assignment_id_1: sourceAssign.id,
                assignment_id_2: targetAssign.id
            });
        } else if (sourceAssign && !targetAssign) {
            await del(`/seating/assignments/${sourceAssign.id}`);
            await post(`/seating/${seatingState.conferenceId}/assignments`, {
                area_id: targetAreaId,
                seat_number: targetSeatNum,
                participant_id: parseInt(seatingState.draggedParticipantId)
            });
        }
        loadSeating(seatingState.conferenceId);
    } catch (err) {
        showToast(err.message || '操作失败');
    }
}

function startResizeArea(e, areaId) {
    e.preventDefault();
    e.stopPropagation();
    const el = document.querySelector(`[data-area-id="${areaId}"]`);
    if (!el) return;
    seatingState.resizingArea = el;
    seatingState.resizeStartX = e.clientX;
    seatingState.resizeStartY = e.clientY;
    seatingState.resizeStartScale = parseFloat(el.dataset.scale) || 1;
}

function startDragArea(e, areaId) {
    if (e.target.closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    const el = document.querySelector(`[data-area-id="${areaId}"]`);
    if (!el) return;
    seatingState.draggingArea = el;
    seatingState.dragStartX = e.clientX;
    seatingState.dragStartY = e.clientY;
    const currentLeft = parseInt(el.style.left) || 0;
    const currentTop = parseInt(el.style.top) || 0;
    seatingState.dragStartAreaX = currentLeft;
    seatingState.dragStartAreaY = currentTop;
}

document.addEventListener('mousemove', function(e) {
    if (seatingState.resizingArea) {
        const delta = Math.min(e.clientX - seatingState.resizeStartX, e.clientY - seatingState.resizeStartY);
        const scaleChange = delta / 500;
        let newScale = seatingState.resizeStartScale + scaleChange;
        newScale = Math.max(0.5, Math.min(2, newScale));
        seatingState.resizingArea.dataset.scale = newScale;
        seatingState.resizingArea.style.transform = `scale(${newScale})`;
    } else if (seatingState.draggingArea) {
        const deltaX = e.clientX - seatingState.dragStartX;
        const deltaY = e.clientY - seatingState.dragStartY;
        seatingState.draggingArea.style.left = (seatingState.dragStartAreaX + deltaX) + 'px';
        seatingState.draggingArea.style.top = (seatingState.dragStartAreaY + deltaY) + 'px';
    }
});

document.addEventListener('mouseup', async function(e) {
    if (seatingState.resizingArea) {
        const areaId = seatingState.resizingArea.dataset.areaId;
        const scale = parseFloat(seatingState.resizingArea.dataset.scale) || 1;
        const x = parseInt(seatingState.resizingArea.style.left) || 0;
        const y = parseInt(seatingState.resizingArea.style.top) || 0;
        try {
            await put(`/seating/areas/${areaId}`, {position_x: x, position_y: y, scale: scale});
        } catch (err) {
            console.error(err);
        }
        seatingState.resizingArea = null;
    } else if (seatingState.draggingArea) {
        const areaId = seatingState.draggingArea.dataset.areaId;
        const scale = parseFloat(seatingState.draggingArea.dataset.scale) || 1;
        const x = parseInt(seatingState.draggingArea.style.left) || 0;
        const y = parseInt(seatingState.draggingArea.style.top) || 0;
        try {
            await put(`/seating/areas/${areaId}`, {position_x: x, position_y: y, scale: scale});
        } catch (err) {
            console.error(err);
        }
        seatingState.draggingArea = null;
    }
});

let pendingAssignSeat = null;
let pendingAssignArea = null;

async function showAssignModal(areaId, seatNumber) {
    const participantsResp = await get(`/participants/${seatingState.conferenceId}`);
    const participants = participantsResp || [];
    const assignResp = await get(`/seating/${seatingState.conferenceId}/assignments`);
    const assignments = assignResp?.assignments || [];
    const assignedIds = assignments.map(a => a.participant_id);
    const attendingParticipants = participants.filter(p => p.is_attending !== false);
    const available = attendingParticipants.filter(p => !assignedIds.includes(p.id));

    if (available.length === 0) {
        showToast('所有参会人已分配完毕');
        return;
    }

    let html = '<div style="max-height:300px;overflow-y:auto;">';
    available.forEach(p => {
        html += `<div style="padding:8px;border-bottom:1px solid #eee;cursor:pointer;" onclick="assignSeat(${p.id})">${escapeHtml(p.name)} - ${escapeHtml(p.company || '')}</div>`;
    });
    html += '</div>';

    const modal = document.createElement('div');
    modal.id = 'assignModal';
    modal.className = 'modal active';
    modal.style.cssText = 'display:flex;position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;">
            <div class="modal-header">
                <h3>分配座位给</h3>
                <button class="modal-close" onclick="closeAssignModal()">&times;</button>
            </div>
            <div class="modal-body">${html}</div>
        </div>
    `;
    document.body.appendChild(modal);
    pendingAssignSeat = seatNumber;
    pendingAssignArea = areaId;
}

function closeAssignModal() {
    const modal = document.getElementById('assignModal');
    if (modal) modal.remove();
    pendingAssignSeat = null;
    pendingAssignArea = null;
}

async function assignSeat(participantId) {
    try {
        await post(`/seating/${seatingState.conferenceId}/assignments`, {
            area_id: pendingAssignArea,
            participant_id: participantId,
            seat_number: pendingAssignSeat
        });
        closeAssignModal();
        loadSeating(seatingState.conferenceId);
    } catch (e) {
        showToast(e.message || '分配失败');
    }
}

async function unassignSeat(assignmentId) {
    const confirmed = await showConfirm('确定要取消该座位分配吗？');
    if (!confirmed) return;
    
    try {
        await del(`/seating/assignments/${assignmentId}`);
        showToast('已取消分配');
        loadSeating(seatingState.conferenceId);
    } catch (e) {
        showToast('操作失败');
    }
}

function showAddAreaModal() {
    document.getElementById('areaModalTitle').textContent = '添加区域';
    document.getElementById('editAreaId').value = '';
    document.getElementById('areaName').value = '';
    document.getElementById('areaType').value = 'rect';
    document.getElementById('areaRows').value = '';
    onAreaTypeChange('rect');
    document.getElementById('areaModal').classList.add('active');
}

function onAreaTypeChange(type) {
    document.getElementById('rectConfig').style.display = type === 'rect' ? 'block' : 'none';
    document.getElementById('hollowConfig').style.display = type === 'hollow' ? 'block' : 'none';
    document.getElementById('faceConfig').style.display = type === 'face' ? 'block' : 'none';
}

function closeAreaModal() {
    document.getElementById('areaModal').classList.remove('active');
}

async function saveArea() {
    const name = document.getElementById('areaName').value.trim();
    if (!name) {
        showToast('请输入区域名称');
        return;
    }

    const editId = document.getElementById('editAreaId').value;
    const areaType = document.getElementById('areaType').value;

    let config = {};
    if (areaType === 'hollow') {
        config = {
            top: parseInt(document.getElementById('hollowTop').value) || 5,
            bottom: parseInt(document.getElementById('hollowBottom').value) || 5,
            left: parseInt(document.getElementById('hollowLeft').value) || 3,
            right: parseInt(document.getElementById('hollowRight').value) || 3
        };
    } else if (areaType === 'face') {
        const faceSeats = parseInt(document.getElementById('faceSeats').value) || 8;
        config = {
            left_count: faceSeats,
            right_count: faceSeats
        };
    } else {
        const rows = document.getElementById('areaRows').value.trim();
        config = { rows: rows };
    }

    try {
        if (editId) {
            await put(`/seating/areas/${editId}`, {
                name: name,
                area_type: areaType,
                config: config
            });
            showToast('区域已更新');
        } else {
            const container = document.getElementById('seatingAreas');
            const containerRect = container.getBoundingClientRect();
            let positionY = 20;
            document.querySelectorAll('.seating-area').forEach(area => {
                const rect = area.getBoundingClientRect();
                const bottom = rect.bottom;
                if (bottom - containerRect.top > positionY) {
                    positionY = bottom - containerRect.top + 20;
                }
            });
            
            await post(`/seating/${seatingState.conferenceId}/areas`, {
                name: name,
                area_type: areaType,
                config: config,
                position_x: 20,
                position_y: Math.round(positionY),
                scale: 1
            });
            showToast('区域已添加');
        }
        closeAreaModal();
        loadSeating(seatingState.conferenceId);
    } catch (e) {
        showToast(e.message || '保存失败');
    }
}

function editArea(areaId, name, areaType, configStr) {
    document.getElementById('areaModalTitle').textContent = '编辑区域';
    document.getElementById('editAreaId').value = areaId;
    document.getElementById('areaName').value = name;
    document.getElementById('areaType').value = areaType;
    
    let config = {};
    try {
        config = JSON.parse(decodeURIComponent(configStr));
    } catch (e) {
        config = {};
    }
    
    onAreaTypeChange(areaType);
    
    if (areaType === 'hollow') {
        document.getElementById('hollowTop').value = config.top || 5;
        document.getElementById('hollowBottom').value = config.bottom || 5;
        document.getElementById('hollowLeft').value = config.left || 3;
        document.getElementById('hollowRight').value = config.right || 3;
    } else if (areaType === 'face') {
        document.getElementById('faceSeats').value = config.left_count || 8;
    } else {
        document.getElementById('areaRows').value = config.rows || '';
    }
    
    document.getElementById('areaModal').classList.add('active');
}

async function deleteArea(areaId) {
    const confirmed = await showConfirm('确定要删除该区域吗？');
    if (!confirmed) return;
    
    try {
        await del(`/seating/areas/${areaId}`);
        showToast('区域已删除');
        loadSeating(seatingState.conferenceId);
    } catch (e) {
        showToast('删除失败');
    }
}

function toggleSeatingDetail() {
    seatingState.showSeatingDetail = !seatingState.showSeatingDetail;
    const btn = document.getElementById('toggleSeatingDetailBtn');
    if (seatingState.showSeatingDetail) {
        btn.textContent = '📋 隐藏详情';
        btn.classList.remove('btn-info');
        btn.classList.add('btn-warning');
    } else {
        btn.textContent = '📋 显示详情';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-info');
    }
    loadSeating(seatingState.conferenceId).then(() => {
        if (seatingState.showSeatingDetail) {
            setTimeout(() => {
                autoArrangeAreas();
            }, 300);
        }
    });
}

function autoArrangeAreas() {
    const container = document.getElementById('seatingAreas');
    const areas = container.querySelectorAll('.seating-area');
    if (areas.length === 0) return;

    container.offsetHeight;

    const containerRect = container.getBoundingClientRect();
    const gap = 30;
    let currentY = 20;
    let currentX = 20;
    let rowMaxHeight = 0;
    let maxRight = 0;

    areas.forEach((area, index) => {
        area.offsetHeight;
        
        const rect = area.getBoundingClientRect();
        const scaledWidth = rect.width;
        const scaledHeight = rect.height;

        if (currentX + scaledWidth + gap > containerRect.width && currentX > 20) {
            currentX = 20;
            currentY += rowMaxHeight + gap;
            rowMaxHeight = 0;
        }

        area.style.left = currentX + 'px';
        area.style.top = currentY + 'px';

        currentX += scaledWidth + gap;
        rowMaxHeight = Math.max(rowMaxHeight, scaledHeight);
        maxRight = Math.max(maxRight, currentX);
    });

    const totalHeight = currentY + rowMaxHeight + gap;
    const canvas = document.getElementById('seatingCanvas');
    if (canvas) {
        const minHeight = Math.max(totalHeight, 500);
        canvas.style.height = minHeight + 'px';
    }
}

function showAssignRulesModal() {
    loadAssignRules();
    document.getElementById('assignRulesModal').classList.add('active');
}

function closeAssignRulesModal() {
    document.getElementById('assignRulesModal').classList.remove('active');
}

async function loadAssignRules() {
    try {
        const resp = await get(`/seating/${seatingState.conferenceId}/priority`);
        if (resp) {
            document.getElementById('arrangeMode').value = resp.arrange_mode || 'middle';
            const fields = resp.priority_fields || [];
            if (fields.length >= 1) document.getElementById('priority1').value = fields[0];
            if (fields.length >= 2) document.getElementById('priority2').value = fields[1];
            if (fields.length >= 3) document.getElementById('priority3').value = fields[2];
        }
    } catch (e) {
        console.error('加载分配规则失败', e);
    }
}

async function saveAssignRules() {
    const arrangeMode = document.getElementById('arrangeMode').value;
    const priority1 = document.getElementById('priority1').value;
    const priority2 = document.getElementById('priority2').value;
    const priority3 = document.getElementById('priority3').value;
    const priority_fields = [priority1, priority2, priority3];

    try {
        await put(`/seating/${seatingState.conferenceId}/priority`, {
            arrange_mode: arrangeMode,
            priority_fields: priority_fields
        });
        closeAssignRulesModal();
        showToast('分配规则已保存');
    } catch (e) {
        showToast(e.message || '保存失败');
    }
}

function showPriorityModal() {
    currentPriorityTab = 'position';
    loadPriorityData();
    document.getElementById('priorityModal').classList.add('active');
}

function closePriorityModal() {
    document.getElementById('priorityModal').classList.remove('active');
}

function switchPriorityTab(tab) {
    currentPriorityTab = tab;
    document.getElementById('tabPosition').style.background = tab === 'position' ? '#007bff' : '#6c757d';
    document.getElementById('tabCompany').style.background = tab === 'company' ? '#007bff' : '#6c757d';
    loadPriorityData();
}

async function loadPriorityData() {
    try {
        const fieldsResp = await get(`/seating/${seatingState.conferenceId}/participant-fields`);
        const priorityResp = await get(`/seating/${seatingState.conferenceId}/priority`);

        const items = currentPriorityTab === 'position'
            ? (fieldsResp?.positions || [])
            : (fieldsResp?.companies || []);
        const priorityMap = currentPriorityTab === 'position'
            ? (priorityResp?.position_priority || {})
            : (priorityResp?.company_priority || {});

        let html = '';
        items.forEach(item => {
            const val = priorityMap[item] || '';
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #dee2e6;">${item}</td>
                <td style="padding:8px;border-bottom:1px solid #dee2e6;">
                    <input type="number" class="priority-input" data-name="${item}" value="${val}"
                        style="width:80px;padding:6px;border:1px solid #ddd;border-radius:4px;" placeholder="1">
                </td>
            </tr>`;
        });
        document.getElementById('priorityTableBody').innerHTML = html;
    } catch (e) {
        console.error('加载优先级数据失败', e);
    }
}

async function savePriorityConfig() {
    const priorityMap = {};
    document.querySelectorAll('.priority-input').forEach(input => {
        const name = input.dataset.name;
        const val = input.value.trim();
        if (val) priorityMap[name] = parseInt(val);
    });

    try {
        const existing = await get(`/seating/${seatingState.conferenceId}/priority`);

        const position_priority = currentPriorityTab === 'position' ? priorityMap : (existing?.position_priority || {});
        const company_priority = currentPriorityTab === 'company' ? priorityMap : (existing?.company_priority || {});

        await put(`/seating/${seatingState.conferenceId}/priority`, {
            arrange_mode: existing?.arrange_mode || 'middle',
            priority_fields: existing?.priority_fields || [],
            position_priority: position_priority,
            company_priority: company_priority
        });
        closePriorityModal();
        showToast('优先级已保存');
    } catch (e) {
        showToast(e.message || '保存失败');
    }
}

async function autoAssignSeats() {
    const confirmed = await showConfirm('确定要自动分配座位吗？');
    if (!confirmed) return;
    try {
        const resp = await post(`/seating/${seatingState.conferenceId}/assignments/auto`, {});
        loadSeating(seatingState.conferenceId);
        showToast('自动分配完成');
    } catch (e) {
        showToast(e.message || '分配失败');
    }
}

async function clearAllSeats() {
    const confirmed = await showConfirm('确定要清空所有座位分配吗？');
    if (!confirmed) return;
    try {
        await del(`/seating/${seatingState.conferenceId}/assignments`);
        loadSeating(seatingState.conferenceId);
    } catch (e) {
        showToast(e.message || '清空失败');
    }
}

async function exportToPDF() {
    const canvas = document.getElementById('seatingCanvas');
    if (!canvas) {
        showToast('无法找到座位画布');
        return;
    }

    const attendingParticipants = (seatingState.participants || []).filter(p => p.is_attending !== false).length;
    const assignedCount = parseInt(document.getElementById('seatingAssignedCount').textContent) || 0;
    const unassignedCount = attendingParticipants - assignedCount;
    
    if (unassignedCount > 0) {
        showToast(`还有 ${unassignedCount} 位参会人待分配座位，请先完成座位分配后再导出。`);
        return;
    }

    try {
        const noExportElements = canvas.querySelectorAll('.no-export');
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
        const htmlCanvas = await html2canvas(canvas, {scale: 2, useCORS: true, backgroundColor: '#ffffff'});
        
        noExportElements.forEach(el => el.style.display = '');

        const imgData = htmlCanvas.toDataURL('image/png');
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 20;
        const imgHeight = (htmlCanvas.height * imgWidth) / htmlCanvas.width;
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20));
        pdf.save(`座位布局_${new Date().toLocaleDateString()}.pdf`);
    } catch (e) {
        console.error(e);
        const noExportElements = canvas.querySelectorAll('.no-export');
        noExportElements.forEach(el => el.style.display = '');
        showToast('导出PDF失败: ' + e.message);
    }
}

window.loadSeating = loadSeating;
window.showAddAreaModal = showAddAreaModal;
window.onAreaTypeChange = onAreaTypeChange;
window.closeAreaModal = closeAreaModal;
window.saveArea = saveArea;
window.editArea = editArea;
window.deleteArea = deleteArea;
window.toggleSeatingDetail = toggleSeatingDetail;
window.showAssignRulesModal = showAssignRulesModal;
window.closeAssignRulesModal = closeAssignRulesModal;
window.saveAssignRules = saveAssignRules;
window.showPriorityModal = showPriorityModal;
window.closePriorityModal = closePriorityModal;
window.switchPriorityTab = switchPriorityTab;
window.savePriorityConfig = savePriorityConfig;
window.autoAssignSeats = autoAssignSeats;
window.clearAllSeats = clearAllSeats;
window.exportToPDF = exportToPDF;
window.handleSeatDragStart = handleSeatDragStart;
window.handleSeatDragOver = handleSeatDragOver;
window.handleSeatDrop = handleSeatDrop;
window.startResizeArea = startResizeArea;
window.startDragArea = startDragArea;
window.showAssignModal = showAssignModal;
window.closeAssignModal = closeAssignModal;
window.assignSeat = assignSeat;
window.unassignSeat = unassignSeat;
