let participants = [];
let selectedIds = new Set();
let currentPage = 1;
let pageSize = 20;
let searchKeyword = '';
let validationResults = null;
let participantsConferenceId = null;

async function loadParticipants(conferenceId) {
    participantsConferenceId = conferenceId;
    try {
        const data = await get(`/participants/${conferenceId}`);
        participants = data || [];
        selectedIds.clear();
        currentPage = 1;
        validationResults = null;
        renderParticipantsTable();
        updateButtons();
        updateParticipantsSummary();
    } catch (e) {
        console.error('加载参会人数据失败', e);
        const tbody = document.getElementById('participantsTable');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;">加载失败</td></tr>';
        }
    }
}

function updateParticipantsSummary() {
    const total = participants.length;
    const attending = participants.filter(p => p.is_attending !== false).length;
    const hotel = participants.filter(p => p.has_hotel === true).length;
    const meal = participants.filter(p => p.has_meal === true).length;
    const transport = participants.filter(p => p.has_transport === true).length;
    
    const totalEl = document.getElementById('totalParticipantCount');
    const attendingEl = document.getElementById('attendingCount');
    const hotelEl = document.getElementById('hotelNeedCount');
    const mealEl = document.getElementById('mealNeedCount');
    const transportEl = document.getElementById('transportNeedCount');
    
    if (totalEl) totalEl.textContent = total;
    if (attendingEl) attendingEl.textContent = attending;
    if (hotelEl) hotelEl.textContent = hotel;
    if (mealEl) mealEl.textContent = meal;
    if (transportEl) transportEl.textContent = transport;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderParticipantsTable() {
    const filtered = participants.filter(p => {
        if (!searchKeyword) return true;
        const kw = searchKeyword.toLowerCase();
        return (p.name && p.name.toLowerCase().includes(kw)) ||
               (p.company && p.company.toLowerCase().includes(kw)) ||
               (p.department && p.department.toLowerCase().includes(kw)) ||
               (p.position && p.position.toLowerCase().includes(kw)) ||
               (p.title && p.title.toLowerCase().includes(kw)) ||
               (p.phone && p.phone.includes(kw));
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = filtered.slice(start, end);

    const tbody = document.getElementById('participantsTable');
    if (!tbody) return;

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;">暂无数据</td></tr>';
    } else {
        tbody.innerHTML = pageData.map(p => {
            const validation = validationResults ? validationResults.find(v => v.id === p.id) : null;
            return `
            <tr data-id="${p.id}">
                <td><input type="checkbox" class="participant-checkbox" value="${p.id}" 
                    ${selectedIds.has(p.id) ? 'checked' : ''} 
                    onchange="toggleSelect(${p.id})"></td>
                <td>${p.id}</td>
                <td>${escapeHtml(p.name || '')}</td>
                <td>${escapeHtml(p.phone || '')}</td>
                <td>${escapeHtml(p.company || '')}</td>
                <td>${escapeHtml(p.department || '')}</td>
                <td>${escapeHtml(p.position || '')}</td>
                <td>${escapeHtml(p.title || '')}</td>
                ${getStatusCell(p.is_attending !== false, validation ? validation.attending_valid : true, p.id)}
                ${getStatusCell(p.has_meal === true, validation ? validation.meal_valid : true, p.id)}
                ${getStatusCell(p.has_hotel === true, validation ? validation.hotel_valid : true, p.id)}
                ${getStatusCell(p.has_transport === true, validation ? validation.transport_valid : true, p.id)}
            </tr>`;
        }).join('');
    }

    document.getElementById('pageInfo').textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

function getStatusCell(value, isValid, participantId) {
    if (!validationResults) {
        return `<td>${value ? '✓' : '✗'}</td>`;
    }
    if (value && !isValid) {
        return `<td><span style="display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border:2px solid #e74c3c;border-radius:3px;color:#e74c3c;font-weight:bold;">✓</span></td>`;
    }
    return `<td>${value ? '✓' : '✗'}</td>`;
}

function toggleSelect(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    updateButtons();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.participant-checkbox');
    
    checkboxes.forEach(cb => {
        const id = parseInt(cb.value);
        if (selectAll.checked) {
            selectedIds.add(id);
        } else {
            selectedIds.delete(id);
        }
        cb.checked = selectAll.checked;
    });
    
    updateButtons();
}

function updateButtons() {
    const count = selectedIds.size;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('deleteBtn').disabled = count === 0;
    document.getElementById('editBtn').disabled = count !== 1;
}

function searchParticipants() {
    searchKeyword = document.getElementById('searchInput').value;
    currentPage = 1;
    renderParticipantsTable();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderParticipantsTable();
    }
}

function nextPage() {
    const filtered = participants.filter(p => {
        if (!searchKeyword) return true;
        const kw = searchKeyword.toLowerCase();
        return (p.name && p.name.toLowerCase().includes(kw)) ||
               (p.company && p.company.toLowerCase().includes(kw)) ||
               (p.department && p.department.toLowerCase().includes(kw)) ||
               (p.position && p.position.toLowerCase().includes(kw)) ||
               (p.title && p.title.toLowerCase().includes(kw)) ||
               (p.phone && p.phone.includes(kw));
    });
    const totalPages = Math.ceil(filtered.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderParticipantsTable();
    }
}

function showAddParticipantModal() {
    document.getElementById('participantModalTitle').textContent = '添加参会人';
    document.getElementById('editParticipantId').value = '';
    document.getElementById('participantName').value = '';
    document.getElementById('participantPhone').value = '';
    document.getElementById('participantCompany').value = '';
    document.getElementById('participantDepartment').value = '';
    document.getElementById('participantPosition').value = '';
    document.getElementById('participantTitle').value = '';
    document.getElementById('participantAttending').checked = true;
    document.getElementById('participantMeal').checked = false;
    document.getElementById('participantHotel').checked = false;
    document.getElementById('participantTransport').checked = false;
    document.getElementById('participantModal').classList.add('active');
}

function closeParticipantModal() {
    document.getElementById('participantModal').classList.remove('active');
}

async function saveParticipant() {
    if (!participantsConferenceId) {
        showToast('请先选择会议');
        return;
    }
    
    const editId = document.getElementById('editParticipantId').value;
    const name = document.getElementById('participantName').value.trim();
    
    if (!name) {
        showToast('请输入姓名');
        return;
    }
    
    const data = {
        conference_id: participantsConferenceId,
        name: name,
        phone: document.getElementById('participantPhone').value.trim(),
        company: document.getElementById('participantCompany').value.trim(),
        department: document.getElementById('participantDepartment').value.trim(),
        position: document.getElementById('participantPosition').value.trim(),
        title: document.getElementById('participantTitle').value.trim(),
        is_attending: document.getElementById('participantAttending').checked,
        has_meal: document.getElementById('participantMeal').checked,
        has_hotel: document.getElementById('participantHotel').checked,
        has_transport: document.getElementById('participantTransport').checked
    };
    
    try {
        let result;
        if (editId) {
            result = await put(`/participants/${editId}`, data);
        } else {
            result = await post(`/participants/`, data);
        }
        
        showToast(editId ? '保存成功' : '添加成功');
        closeParticipantModal();
        loadParticipants(participantsConferenceId);
    } catch (e) {
        showToast('操作失败，请稍后重试');
    }
}

function editSelectedParticipants() {
    if (selectedIds.size !== 1) {
        showToast('请选择一个参会人进行编辑');
        return;
    }
    
    const id = [...selectedIds][0];
    const participant = participants.find(p => p.id === id);
    if (!participant) return;
    
    document.getElementById('participantModalTitle').textContent = '编辑参会人';
    document.getElementById('editParticipantId').value = participant.id;
    document.getElementById('participantName').value = participant.name || '';
    document.getElementById('participantPhone').value = participant.phone || '';
    document.getElementById('participantCompany').value = participant.company || '';
    document.getElementById('participantDepartment').value = participant.department || '';
    document.getElementById('participantPosition').value = participant.position || '';
    document.getElementById('participantTitle').value = participant.title || '';
    document.getElementById('participantAttending').checked = participant.is_attending !== false;
    document.getElementById('participantMeal').checked = participant.has_meal === true;
    document.getElementById('participantHotel').checked = participant.has_hotel === true;
    document.getElementById('participantTransport').checked = participant.has_transport === true;
    document.getElementById('participantModal').classList.add('active');
}

async function deleteSelectedParticipants() {
    if (selectedIds.size === 0) {
        showToast('请选择要删除的参会人');
        return;
    }
    
    if (!participantsConferenceId) return;
    
    const confirmed = await showConfirm(`确定要删除选中的 ${selectedIds.size} 个参会人吗？`);
    if (!confirmed) return;
    
    try {
        const result = await del(`/participants/batch`, { ids: Array.from(selectedIds) });
        showToast(`删除成功，共删除 ${result.deleted || selectedIds.size} 条`);
        selectedIds.clear();
        loadParticipants(participantsConferenceId);
    } catch (e) {
        showToast('删除失败，请稍后重试');
    }
}

function downloadTemplate() {
    window.open('/api/participants/template/download', '_blank');
}

function showImportModal() {
    document.getElementById('importFile').value = '';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importModal').classList.add('active');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (file) {
        document.getElementById('importPreview').style.display = 'block';
        document.getElementById('importPreviewContent').innerHTML = `
            <div style="padding: 10px; background: #f5f5f5; border-radius: 6px;">
                <div style="font-weight: 500;">${file.name}</div>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">
                    大小: ${(file.size / 1024).toFixed(1)} KB
                </div>
            </div>
        `;
    }
}

async function confirmImport() {
    await importParticipants();
}

async function importParticipants() {
    if (!participantsConferenceId) {
        showToast('请先选择会议');
        return;
    }
    
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    if (!file) {
        showToast('请选择文件');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        showToast('正在导入...');
        const result = await postForm(`/participants/import?conference_id=${participantsConferenceId}`, formData);
        
        if (result.imported !== undefined) {
            showToast(`成功导入 ${result.imported} 条数据`);
            closeImportModal();
            loadParticipants(participantsConferenceId);
        } else {
            showToast(result.detail || '导入失败');
        }
    } catch (e) {
        showToast('导入失败: ' + (e.message || '请稍后重试'));
    }
}

async function validateParticipants() {
    if (!participantsConferenceId) {
        showToast('请先选择会议');
        return;
    }
    
    try {
        const result = await get(`/participants/${participantsConferenceId}/validate`);
        validationResults = result;
        
        let invalidCount = 0;
        validationResults.forEach(v => {
            if (!v.attending_valid || !v.meal_valid || !v.hotel_valid || !v.transport_valid) {
                invalidCount++;
            }
        });
        
        if (invalidCount > 0) {
            showToast(`校验完成，发现 ${invalidCount} 位参会人存在未安排的项目（已标红显示）`);
        } else {
            showToast('校验通过，所有参会人的安排都已就绪');
        }
        
        renderParticipantsTable();
    } catch (e) {
        showToast('校验失败: ' + (e.message || '请稍后重试'));
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

window.loadParticipants = loadParticipants;
window.searchParticipants = searchParticipants;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.toggleSelectAll = toggleSelectAll;
window.toggleSelect = toggleSelect;
window.showAddParticipantModal = showAddParticipantModal;
window.closeParticipantModal = closeParticipantModal;
window.saveParticipant = saveParticipant;
window.editSelectedParticipants = editSelectedParticipants;
window.deleteSelectedParticipants = deleteSelectedParticipants;
window.downloadTemplate = downloadTemplate;
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.handleFileSelect = handleFileSelect;
window.confirmImport = confirmImport;
window.importParticipants = importParticipants;
window.validateParticipants = validateParticipants;
