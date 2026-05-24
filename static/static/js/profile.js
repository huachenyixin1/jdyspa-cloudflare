async function loadProfile() {
    console.log('Loading profile...');
}

function openRenewModal() {
    const modal = document.getElementById('renewModal');
    if (modal) modal.classList.add('active');
}

function openUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.classList.add('active');
}

function openInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) modal.classList.add('active');
}

function openOrderModal() {
    const modal = document.getElementById('orderModal');
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    } else {
        const createModal = document.getElementById('createModal');
        if (createModal) createModal.classList.remove('active');
    }
}

function selectPackage(element, type) {
    const container = element.parentElement;
    container.querySelectorAll('.package-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    
    if (type === 'renew') {
        const months = element.dataset.months;
        const prices = { 1: 99, 3: 79, 12: 59 };
        const total = months * prices[months];
        const amountEl = document.getElementById('renewAmount');
        if (amountEl) amountEl.value = `¥${total}`;
    }
}

async function submitRenew() {
    const selected = document.querySelector('#renewOptions .package-option.selected');
    if (!selected) {
        showToast('请选择续费时长');
        return;
    }
    
    const months = selected.dataset.months;
    showToast('续费功能开发中');
}

async function submitUpgrade() {
    const selected = document.querySelector('#upgradeOptions .package-option.selected');
    if (!selected) {
        showToast('请选择套餐');
        return;
    }
    
    const type = selected.dataset.type;
    showToast('升级功能开发中');
}

async function submitInvoice() {
    const orderId = document.getElementById('invoiceOrder').value;
    const type = document.getElementById('invoiceType').value;
    const title = document.getElementById('invoiceTitle').value;
    const taxId = document.getElementById('invoiceTaxId').value;
    
    if (!orderId || !title || !taxId) {
        showToast('请填写完整信息');
        return;
    }
    
    showToast('发票申请功能开发中');
}

window.loadProfile = loadProfile;
window.openRenewModal = openRenewModal;
window.openUpgradeModal = openUpgradeModal;
window.openInvoiceModal = openInvoiceModal;
window.openOrderModal = openOrderModal;
window.closeModal = closeModal;
window.selectPackage = selectPackage;
window.submitRenew = submitRenew;
window.submitUpgrade = submitUpgrade;
window.submitInvoice = submitInvoice;
