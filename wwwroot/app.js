// Globally intercept fetch to redirect to login on 401 Unauthorized responses
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    
    // Check if the request failed with 401 Unauthorized and was NOT an authentication check/login attempt
    if (response.status === 401 && 
        !url.includes('/api/auth/me') && 
        !url.includes('/api/auth/login') && 
        !url.includes('/api/auth/register')) {
        window.location.href = '/login.html';
    }
    return response;
};

// --- State & Constants ---
let transactions = [];
let budgets = [];
let reminders = [];
let categories = [];
let chartInstance = null;
let barChartInstance = null;
let editMode = false;

// SVGs for transaction categories (fallback defaults)
const CATEGORY_ICONS = {
    Food: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    Shopping: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    Housing: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    Entertainment: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    Salary: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="10" x2="12" y2="10"/><path d="M8 14h8"/></svg>`,
    Investments: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    Other: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

// --- DOM Elements ---
const balanceEl = document.getElementById('val-balance');
const incomeEl = document.getElementById('val-income');
const expenseEl = document.getElementById('val-expense');
const listEl = document.getElementById('transactions-list');
const emptyStateEl = document.getElementById('list-empty');
const chartEmptyEl = document.getElementById('chart-empty');
const canvasEl = document.getElementById('expenseChart');
const dateBadgeEl = document.getElementById('date-badge');

// Budget Elements
const budgetListEl = document.getElementById('budget-list');
const budgetEmptyEl = document.getElementById('budget-empty');
const btnTriggerBudgets = document.getElementById('btn-trigger-budgets');
const budgetModalOverlay = document.getElementById('budget-modal');
const budgetForm = document.getElementById('budget-form');
const btnCloseBudgetModal = document.getElementById('btn-close-budget-modal');
const btnCancelBudgetModal = document.getElementById('btn-cancel-budget-modal');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetLimitInput = document.getElementById('budget-limit');

// Bill Reminders Elements
const remindersListEl = document.getElementById('reminders-list');
const remindersEmptyEl = document.getElementById('reminders-empty');
const btnTriggerReminders = document.getElementById('btn-trigger-reminders');
const reminderModalOverlay = document.getElementById('reminder-modal');
const reminderForm = document.getElementById('reminder-form');
const btnCloseReminderModal = document.getElementById('btn-close-reminder-modal');
const btnCancelReminderModal = document.getElementById('btn-cancel-reminder-modal');
const reminderTitleInput = document.getElementById('reminder-title');
const reminderAmountInput = document.getElementById('reminder-amount');
const reminderDueDateInput = document.getElementById('reminder-duedate');
const reminderCategoryInput = document.getElementById('reminder-category');

// Category Manager Elements
const navCategoriesTrigger = document.getElementById('nav-categories-trigger');
const categoryModalOverlay = document.getElementById('category-modal');
const categoryMgrList = document.getElementById('category-mgr-list');
const categoryAddForm = document.getElementById('category-add-form');
const btnCloseCategoryModal = document.getElementById('btn-close-category-modal');
const newCatNameInput = document.getElementById('new-cat-name');
const newCatColorInput = document.getElementById('new-cat-color');

// Change Password Elements
const navPasswordTrigger = document.getElementById('nav-password-trigger');
const passwordModalOverlay = document.getElementById('password-modal');
const passwordChangeForm = document.getElementById('password-change-form');
const btnClosePasswordModal = document.getElementById('btn-close-password-modal');
const btnCancelPasswordModal = document.getElementById('btn-cancel-password-modal');
const pwdOldInput = document.getElementById('pwd-old');
const pwdNewInput = document.getElementById('pwd-new');

// CSV Exporter
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportPdf = document.getElementById('btn-export-pdf');

// Filter Inputs
const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const filterMonth = document.getElementById('filter-month');
const filterYear = document.getElementById('filter-year');
const btnClearFilters = document.getElementById('btn-clear-filters');

// Modal Elements (Transactions)
const modalOverlay = document.getElementById('transaction-modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('transaction-form');
const btnTriggerAdd = document.getElementById('btn-trigger-add');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const typeTabs = document.querySelectorAll('.type-tab');

// Form Inputs (Transactions)
const txIdInput = document.getElementById('tx-id');
const txDescriptionInput = document.getElementById('tx-description');
const txAmountInput = document.getElementById('tx-amount');
const txDateInput = document.getElementById('tx-date');
const txCategoryInput = document.getElementById('tx-category');

// Theme Switcher
const themeToggleBtn = document.getElementById('theme-toggle');

// Logout Button
const btnLogout = document.getElementById('btn-logout');

// --- Helper Functions ---
function formatCurrency(amount) {
    const formatted = Math.abs(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return amount < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function getCategoryColor(name) {
    const cat = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    return cat ? cat.color : '#6b7280';
}

// Show toast notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'none';
        toast.offsetHeight; // Trigger reflow
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Set initial current date in header
function updateHeaderDate() {
    const now = new Date();
    dateBadgeEl.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// --- API Integrations ---

// Check Authentication Status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/login.html';
            return false;
        }
        const data = await response.json();
        
        // Update user display UI
        const usernameEl = document.getElementById('user-name-display');
        const avatarEl = document.getElementById('user-avatar');
        
        if (usernameEl) usernameEl.textContent = data.username;
        if (avatarEl && data.username) {
            avatarEl.textContent = data.username.substring(0, 2).toUpperCase();
        }
        return true;
    } catch (err) {
        console.error('Authentication check failed:', err);
        window.location.href = '/login.html';
        return false;
    }
}

// Log Out Handler
async function handleLogout() {
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login.html';
        } else {
            showToast('Failed to log out', 'error');
        }
    } catch (err) {
        console.error('Logout error:', err);
        showToast('Error logging out', 'error');
    }
}

// Fetch summary totals and render Chart
async function fetchSummary() {
    try {
        const response = await fetch('/api/expenses/summary');
        if (!response.ok) throw new Error('Failed to load summary');
        const data = await response.json();

        // Update cards
        balanceEl.textContent = formatCurrency(data.totalBalance);
        incomeEl.textContent = formatCurrency(data.totalIncome);
        expenseEl.textContent = formatCurrency(data.totalExpense);

        // Update Balance card text styling based on value
        if (data.totalBalance < 0) {
            balanceEl.className = 'metric-value text-danger';
        } else if (data.totalBalance > 0) {
            balanceEl.className = 'metric-value text-success';
        } else {
            balanceEl.className = 'metric-value';
        }

        renderChart(data.categoryBreakdown);
    } catch (error) {
        console.error(error);
        showToast('Error loading financial summary', 'error');
    }
}

// Fetch all categories
async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Failed to load categories');
        categories = await response.json();
        
        populateCategorySelectors();
        renderCategoryManagerList();
    } catch (error) {
        console.error(error);
        showToast('Error loading categories', 'error');
    }
}

// Populate Category selectors dynamically
function populateCategorySelectors() {
    // Save current selected values to restore them after rebuild
    const prevFilterVal = filterCategory.value;
    const prevTxVal = txCategoryInput.value;
    const prevBudgetVal = budgetCategoryInput.value;
    const prevReminderVal = reminderCategoryInput.value;

    // 1. Transaction Filter Category Dropdown
    filterCategory.innerHTML = '<option value="All">All Categories</option>';
    categories.forEach(c => {
        filterCategory.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    filterCategory.value = prevFilterVal || 'All';

    // 2. Transaction Add/Edit Form Category Dropdown
    txCategoryInput.innerHTML = '<option value="" disabled selected>Select Category</option>';
    categories.forEach(c => {
        txCategoryInput.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    txCategoryInput.value = prevTxVal || '';

    // 3. Budgets Category Dropdown
    budgetCategoryInput.innerHTML = '<option value="" disabled selected>Select Category</option>';
    categories.forEach(c => {
        budgetCategoryInput.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    budgetCategoryInput.value = prevBudgetVal || '';

    // 4. Reminders Category Dropdown
    reminderCategoryInput.innerHTML = '<option value="" disabled selected>Select Category</option>';
    categories.forEach(c => {
        reminderCategoryInput.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    reminderCategoryInput.value = prevReminderVal || '';
}

// Fetch all transactions from database
async function fetchTransactions() {
    try {
        const response = await fetch('/api/expenses');
        if (!response.ok) throw new Error('Failed to load transactions');
        transactions = await response.json();
        renderTransactions();
        renderBudgets(); // Recalculate budgeting progress on transaction updates
        renderBarChart(); // Update Monthly trend comparison bar chart
    } catch (error) {
        console.error(error);
        showToast('Error loading transactions', 'error');
    }
}

// Fetch all budgets from database
async function fetchBudgets() {
    try {
        const response = await fetch('/api/budgets');
        if (!response.ok) throw new Error('Failed to load budgets');
        budgets = await response.json();
        renderBudgets();
    } catch (error) {
        console.error(error);
        showToast('Error loading budgets', 'error');
    }
}

// Fetch all bill reminders
async function fetchReminders() {
    try {
        const response = await fetch('/api/reminders');
        if (!response.ok) throw new Error('Failed to load reminders');
        reminders = await response.json();
        renderReminders();
    } catch (error) {
        console.error(error);
        showToast('Error loading bill reminders', 'error');
    }
}

// Submit add/edit form
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = txIdInput.value;
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const description = txDescriptionInput.value.trim();
    const amount = parseFloat(txAmountInput.value);
    const date = new Date(txDateInput.value).toISOString();
    const category = txCategoryInput.value;

    const payload = { description, amount, date, category, type };

    try {
        let response;
        if (editMode) {
            response = await fetch(`/api/expenses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, id: parseInt(id) })
            });
        } else {
            response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || 'Failed to save transaction');
        }

        showToast(editMode ? 'Transaction updated successfully' : 'Transaction added successfully', 'success');
        closeModal();
        
        // Refresh dashboard data
        await fetchSummary();
        await fetchTransactions();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Error saving transaction', 'error');
    }
}

// Submit budget limits form
async function handleBudgetFormSubmit(e) {
    e.preventDefault();
    
    const category = budgetCategoryInput.value;
    const limitAmount = parseFloat(budgetLimitInput.value);

    try {
        const response = await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, limitAmount })
        });

        if (!response.ok) throw new Error('Failed to update budget limit');
        
        showToast(`Budget limit updated for ${category}`, 'success');
        closeBudgetModal();
        await fetchBudgets();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Error setting budget limit', 'error');
    }
}

// Submit new reminder form
async function handleReminderFormSubmit(e) {
    e.preventDefault();

    const title = reminderTitleInput.value.trim();
    const amount = parseFloat(reminderAmountInput.value);
    const dueDate = new Date(reminderDueDateInput.value).toISOString();
    const category = reminderCategoryInput.value;

    try {
        const response = await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, amount, dueDate, category })
        });

        if (!response.ok) throw new Error('Failed to save reminder');

        showToast(`Bill reminder for ${title} saved!`, 'success');
        closeReminderModal();
        await fetchReminders();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Error saving reminder', 'error');
    }
}

// Submit custom category add form
async function handleCategoryAddFormSubmit(e) {
    e.preventDefault();
    
    const name = newCatNameInput.value.trim();
    const color = newCatColorInput.value;

    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color })
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || 'Failed to save category');
        }

        newCatNameInput.value = '';
        showToast(`Category "${name}" created!`, 'success');
        await fetchCategories();
        
        // Refresh charts/summary with new categorization colors
        await fetchSummary();
        await fetchTransactions();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Error saving category', 'error');
    }
}

// Submit profile password change form
async function handlePasswordChangeFormSubmit(e) {
    e.preventDefault();

    const oldPassword = pwdOldInput.value;
    const newPassword = pwdNewInput.value;

    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || 'Incorrect current password');
        }

        showToast('Password changed successfully!', 'success');
        closePasswordModal();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Error changing password', 'error');
    }
}

// Pay a bill reminder (auto logs transaction and sets paid status)
async function payReminder(id) {
    try {
        const response = await fetch(`/api/reminders/${id}/pay`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to process payment');

        showToast('Bill paid and transaction auto-logged!', 'success');
        await fetchSummary();
        await fetchTransactions();
        await fetchReminders();
    } catch (error) {
        console.error(error);
        showToast('Error processing payment', 'error');
    }
}

// Delete a bill reminder
async function deleteReminder(id) {
    if (!confirm('Are you sure you want to delete this bill reminder?')) return;

    try {
        const response = await fetch(`/api/reminders/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete reminder');

        showToast('Bill reminder deleted', 'success');
        await fetchReminders();
    } catch (error) {
        console.error(error);
        showToast('Error deleting reminder', 'error');
    }
}

// Delete a custom category
async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category? All related budgets will be deleted and transactions will reset to "Other".')) return;

    try {
        const response = await fetch(`/api/categories/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || 'Failed to delete category');
        }

        showToast('Category deleted', 'success');
        await fetchCategories();
        await fetchSummary();
        await fetchTransactions();
        await fetchBudgets();
        await fetchReminders();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Error deleting category', 'error');
    }
}

// Delete a transaction
async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
        const response = await fetch(`/api/expenses/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete transaction');

        showToast('Transaction deleted', 'success');
        await fetchSummary();
        await fetchTransactions();
    } catch (error) {
        console.error(error);
        showToast('Error deleting transaction', 'error');
    }
}

// Edit transaction trigger
async function openEditModal(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    editMode = true;
    modalTitle.textContent = 'Edit Transaction';
    txIdInput.value = tx.id;
    txDescriptionInput.value = tx.description;
    txAmountInput.value = tx.amount;
    txDateInput.value = new Date(tx.date).toISOString().split('T')[0];
    txCategoryInput.value = tx.category;

    // Set Active type tab
    document.querySelector(`input[name="tx-type"][value="${tx.type}"]`).checked = true;
    typeTabs.forEach(tab => {
        const radio = tab.querySelector('input');
        if (radio.value === tx.type) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    openModal();
}

// --- Render Functions ---

// Render Transaction List (with filter logic)
function renderTransactions() {
    listEl.innerHTML = '';

    const searchText = searchInput.value.toLowerCase().trim();
    const selectedType = filterType.value;
    const selectedCategory = filterCategory.value;
    const selectedMonth = filterMonth.value;
    const selectedYear = filterYear.value;

    const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        
        const matchSearch = t.description.toLowerCase().includes(searchText);
        const matchType = selectedType === 'All' || t.type === selectedType;
        const matchCategory = selectedCategory === 'All' || t.category === selectedCategory;
        const matchMonth = selectedMonth === 'All' || tDate.getMonth().toString() === selectedMonth;
        const matchYear = selectedYear === 'All' || tDate.getFullYear().toString() === selectedYear;

        return matchSearch && matchType && matchCategory && matchMonth && matchYear;
    });

    if (filtered.length === 0) {
        emptyStateEl.style.display = 'flex';
        listEl.style.display = 'none';
        return;
    }

    emptyStateEl.style.display = 'none';
    listEl.style.display = 'flex';

    filtered.forEach(tx => {
        const li = document.createElement('li');
        li.className = 'transaction-item';

        const catColor = getCategoryColor(tx.category);
        const catIcon = CATEGORY_ICONS[tx.category] || CATEGORY_ICONS.Other;
        const amountSign = tx.type === 'Income' ? '+' : '-';
        const amountClass = tx.type === 'Income' ? 'income' : 'expense';

        li.innerHTML = `
            <div class="tx-left">
                <div class="tx-icon-wrapper" style="background: ${catColor}15; color: ${catColor}">
                    ${catIcon}
                </div>
                <div class="tx-details">
                    <span class="tx-desc">${escapeHtml(tx.description)}</span>
                    <span class="tx-meta">
                        <span class="tx-cat-badge" style="color: ${catColor}">${tx.category}</span>
                        <div class="tx-dot"></div>
                        <span>${formatDate(tx.date)}</span>
                    </span>
                </div>
            </div>
            <div class="tx-right">
                <span class="tx-amount ${amountClass}">${amountSign}${formatCurrency(tx.amount)}</span>
                <div class="tx-actions">
                    <button class="btn-icon edit" onclick="openEditModal(${tx.id})" title="Edit Transaction">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon delete" onclick="deleteTransaction(${tx.id})" title="Delete Transaction">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        listEl.appendChild(li);
    });
}

// Render Doughnut Chart (Category allocation)
function renderChart(categoryData) {
    const categories = Object.keys(categoryData);
    const values = Object.values(categoryData);

    if (categories.length === 0) {
        chartEmptyEl.style.display = 'flex';
        canvasEl.style.display = 'none';
        return;
    }

    chartEmptyEl.style.display = 'none';
    canvasEl.style.display = 'block';

    const isDark = document.body.classList.contains('dark-theme');
    const backgroundColors = categories.map(cat => getCategoryColor(cat));
    const labelColor = isDark ? '#ffffff' : '#64748b';

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(canvasEl, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: values,
                backgroundColor: backgroundColors,
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#0f1524' : '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: labelColor,
                        font: {
                            family: 'Inter',
                            size: 11
                        },
                        padding: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ₹${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            cutout: '68%'
        }
    });
}

// Render Monthly Comparison Bar Chart (Last 6 Months)
function renderBarChart() {
    const canvas = document.getElementById('monthlyBarChart');
    if (!canvas) return;

    // Get last 6 months list labels
    const months = [];
    const monthSums = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            month: d.getMonth(),
            year: d.getFullYear()
        });
        monthSums.push(0);
    }

    transactions.forEach(t => {
        if (t.type === 'Expense') {
            const tDate = new Date(t.date);
            const tMonth = tDate.getMonth();
            const tYear = tDate.getFullYear();

            const idx = months.findIndex(m => m.month === tMonth && m.year === tYear);
            if (idx !== -1) {
                monthSums[idx] += t.amount;
            }
        }
    });

    const emptyState = document.getElementById('bar-chart-empty');
    const hasData = monthSums.some(s => s > 0);
    if (!hasData) {
        emptyState.style.display = 'flex';
        canvas.style.display = 'none';
        return;
    }
    emptyState.style.display = 'none';
    canvas.style.display = 'block';

    const isDark = document.body.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#ffffff' : '#64748b';

    if (barChartInstance) {
        barChartInstance.destroy();
    }

    barChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Monthly Expense (₹)',
                data: monthSums,
                backgroundColor: 'rgba(99, 102, 241, 0.85)',
                borderRadius: 6,
                borderWidth: 0,
                hoverBackgroundColor: 'rgba(99, 102, 241, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ₹${context.raw.toLocaleString('en-IN')}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) { return '₹' + value; }
                    }
                }
            }
        }
    });
}

// Render Category Budget Bars
function renderBudgets() {
    const container = document.getElementById('budget-list');
    
    // Calculate current month sums for each category
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlySpending = {};
    transactions.forEach(t => {
        if (t.type === 'Expense') {
            const d = new Date(t.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                monthlySpending[t.category] = (monthlySpending[t.category] || 0) + t.amount;
            }
        }
    });

    // Remove existing dynamic rows (keep empty template row)
    const items = container.querySelectorAll('.budget-item');
    items.forEach(el => el.remove());

    if (budgets.length === 0) {
        budgetEmptyEl.style.display = 'flex';
        return;
    }
    budgetEmptyEl.style.display = 'none';

    budgets.forEach(b => {
        const spent = monthlySpending[b.category] || 0;
        const pct = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
        
        let colorClass = 'normal';
        if (pct >= 100) {
            colorClass = 'danger';
        } else if (pct >= 85) {
            colorClass = 'warning';
        }

        const catColor = getCategoryColor(b.category);

        const item = document.createElement('div');
        item.className = 'budget-item';
        item.innerHTML = `
            <div class="budget-item-header">
                <span class="budget-item-name" style="color: ${catColor}">${b.category}</span>
                <span class="budget-item-vals">
                    <strong>${formatCurrency(spent)}</strong> of ${formatCurrency(b.limitAmount)} (${pct.toFixed(0)}%)
                </span>
            </div>
            <div class="budget-bar-container">
                <div class="budget-bar-fill ${colorClass}" style="width: ${Math.min(pct, 100)}%"></div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Render Bill Reminders list
function renderReminders() {
    const items = remindersListEl.querySelectorAll('.reminder-item');
    items.forEach(el => el.remove());

    if (reminders.length === 0) {
        remindersEmptyEl.style.display = 'flex';
        return;
    }
    remindersEmptyEl.style.display = 'none';

    reminders.forEach(r => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueDate = new Date(r.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let badgeClass = 'upcoming';
        let badgeText = `In ${diffDays} Days`;

        if (diffDays < 0) {
            badgeClass = 'overdue';
            badgeText = `${Math.abs(diffDays)} Days Overdue`;
        } else if (diffDays === 0) {
            badgeClass = 'due-today';
            badgeText = 'Due Today';
        } else if (diffDays === 1) {
            badgeText = 'Due Tomorrow';
        }

        const catColor = getCategoryColor(r.category);

        const item = document.createElement('div');
        item.className = 'reminder-item';
        item.innerHTML = `
            <div class="reminder-item-left">
                <span class="reminder-item-title">${escapeHtml(r.title)}</span>
                <div class="reminder-item-meta">
                    <span class="reminder-due-badge ${badgeClass}">${badgeText}</span>
                    <div class="tx-dot"></div>
                    <span class="tx-cat-badge" style="color: ${catColor}">${r.category}</span>
                </div>
            </div>
            <div class="reminder-item-right">
                <span class="reminder-item-amount">${formatCurrency(r.amount)}</span>
                <button class="btn-pay-reminder" onclick="payReminder(${r.id})" title="Pay bill and log transaction">Pay</button>
                <button class="btn-delete-reminder" onclick="deleteReminder(${r.id})" title="Delete Reminder">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        remindersListEl.appendChild(item);
    });
}

// Render dynamic rows in Category Manager
function renderCategoryManagerList() {
    categoryMgrList.innerHTML = '';
    
    categories.forEach(c => {
        const row = document.createElement('div');
        row.className = 'category-mgr-row';
        row.innerHTML = `
            <div class="category-mgr-left">
                <span class="category-color-dot" style="background-color: ${c.color}"></span>
                <span class="category-mgr-name">${escapeHtml(c.name)}</span>
            </div>
            <button class="btn-delete-reminder" onclick="deleteCategory(${c.id})" title="Delete Category">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        `;
        categoryMgrList.appendChild(row);
    });
}

// Export Transactions to CSV File (uses Month/Year filter contexts)
function exportToCsv(e) {
    if (e) e.preventDefault();
    const searchText = searchInput.value.toLowerCase().trim();
    const selectedType = filterType.value;
    const selectedCategory = filterCategory.value;
    const selectedMonth = filterMonth.value;
    const selectedYear = filterYear.value;

    const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        
        const matchSearch = t.description.toLowerCase().includes(searchText);
        const matchType = selectedType === 'All' || t.type === selectedType;
        const matchCategory = selectedCategory === 'All' || t.category === selectedCategory;
        const matchMonth = selectedMonth === 'All' || tDate.getMonth().toString() === selectedMonth;
        const matchYear = selectedYear === 'All' || tDate.getFullYear().toString() === selectedYear;

        return matchSearch && matchType && matchCategory && matchMonth && matchYear;
    });

    if (filtered.length === 0) {
        showToast('No filtered transaction data to export', 'error');
        return;
    }

    // CSV header row (supports INR currency context)
    let csvRows = ['ID,Date,Description,Category,Type,Amount (INR)'];

    filtered.forEach(t => {
        const dateStr = new Date(t.date).toLocaleDateString('en-IN');
        const descEscaped = `"${t.description.replace(/"/g, '""')}"`;
        csvRows.push([t.id, dateStr, descEscaped, t.category, t.type, t.amount].join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const downloadLink = document.createElement('a');
    
    downloadLink.setAttribute('href', encodedUri);
    downloadLink.setAttribute('download', `SmartExpense_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadLink);
    
    downloadLink.click();
    document.body.removeChild(downloadLink);
    showToast('CSV transaction report downloaded!', 'success');
}

// Export Transactions to PDF Report File (uses jsPDF & current filter options)
function exportToPdf(e) {
    if (e) e.preventDefault();

    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('PDF Library failed to load. Check your internet connection.', 'error');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Enforce solid black text color for standard PDF pages
        doc.setTextColor(0, 0, 0);

        const searchText = searchInput.value.toLowerCase().trim();
        const selectedType = filterType.value;
        const selectedCategory = filterCategory.value;
        const selectedMonth = filterMonth.value;
        const selectedYear = filterYear.value;

        const filtered = transactions.filter(t => {
            const tDate = new Date(t.date);
            const matchSearch = t.description.toLowerCase().includes(searchText);
            const matchType = selectedType === 'All' || t.type === selectedType;
            const matchCategory = selectedCategory === 'All' || t.category === selectedCategory;
            const matchMonth = selectedMonth === 'All' || tDate.getMonth().toString() === selectedMonth;
            const matchYear = selectedYear === 'All' || tDate.getFullYear().toString() === selectedYear;
            return matchSearch && matchType && matchCategory && matchMonth && matchYear;
        });

        if (filtered.length === 0) {
            showToast('No filtered transaction data to export', 'error');
            return;
        }

        // Report Header Styling
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("Smart Expense Tracker System", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Financial Statement - Generated on ${new Date().toLocaleDateString('en-IN')}`, 14, 27);

        // Summary Totals
        let totalInc = 0;
        let totalExp = 0;
        filtered.forEach(t => {
            if (t.type === 'Income') totalInc += t.amount;
            else totalExp += t.amount;
        });
        const netBal = totalInc - totalExp;

        doc.setFont("helvetica", "bold");
        doc.text(`Total Income: INR ${totalInc.toLocaleString('en-IN')}`, 14, 37);
        doc.text(`Total Expenses: INR ${totalExp.toLocaleString('en-IN')}`, 14, 43);
        doc.text(`Net Balance: INR ${netBal.toLocaleString('en-IN')}`, 14, 49);

        // Document Table Layout Columns & Rows
        const headers = [["ID", "Date", "Description", "Category", "Type", "Amount (INR)"]];
        const data = filtered.map(t => [
            t.id,
            new Date(t.date).toLocaleDateString('en-IN'),
            t.description,
            t.category,
            t.type,
            t.amount.toLocaleString('en-IN')
        ]);

        doc.autoTable({
            head: headers,
            body: data,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }, // matching primary brand color #4f46e5
            styles: { font: "helvetica", fontSize: 9 }
        });

        doc.save(`SmartExpense_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('PDF transaction report downloaded!', 'success');
    } catch (err) {
        console.error('PDF Generation failed:', err);
        showToast('Error generating PDF report file', 'error');
    }
}

// Escapes raw HTML strings for security (XSS prevention)
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// --- Modal Handlers ---
function openModal() {
    modalOverlay.classList.add('open');
    if (!editMode) {
        modalTitle.textContent = 'New Transaction';
        modalForm.reset();
        txIdInput.value = '';
        txDateInput.value = new Date().toISOString().split('T')[0];
        
        // Reset tabs style
        typeTabs.forEach((tab, index) => {
            if (index === 0) tab.classList.add('active'); // Expense
            else tab.classList.remove('active');
        });
        document.querySelector('input[name="tx-type"][value="Expense"]').checked = true;
    }
}

function closeModal() {
    modalOverlay.classList.remove('open');
    editMode = false;
}

function openBudgetModal() {
    budgetModalOverlay.classList.add('open');
    budgetForm.reset();
}

function closeBudgetModal() {
    budgetModalOverlay.classList.remove('open');
}

function openReminderModal() {
    reminderModalOverlay.classList.add('open');
    reminderForm.reset();
    
    // Set default due date to 7 days from now
    const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    reminderDueDateInput.value = defaultDate.toISOString().split('T')[0];
}

function closeReminderModal() {
    reminderModalOverlay.classList.remove('open');
}

function openCategoryModal() {
    categoryModalOverlay.classList.add('open');
    renderCategoryManagerList();
}

function closeCategoryModal() {
    categoryModalOverlay.classList.remove('open');
}

function openPasswordModal() {
    passwordModalOverlay.classList.add('open');
    passwordChangeForm.reset();
}

function closePasswordModal() {
    passwordModalOverlay.classList.remove('open');
}

// --- Theme Toggler ---
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    }
}

themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    }
    // Redraw charts to update theme-dependent labels/borders
    if (transactions.length > 0) {
        fetchSummary();
        renderBarChart();
    }
});

// --- Event Listeners ---

// Type tabs in Modal form
typeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
        typeTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
    });
});

btnTriggerAdd.addEventListener('click', () => {
    editMode = false;
    openModal();
});
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

modalForm.addEventListener('submit', handleFormSubmit);

// Budget Modal Triggers
btnTriggerBudgets.addEventListener('click', openBudgetModal);
btnCloseBudgetModal.addEventListener('click', closeBudgetModal);
btnCancelBudgetModal.addEventListener('click', closeBudgetModal);
budgetModalOverlay.addEventListener('click', (e) => {
    if (e.target === budgetModalOverlay) closeBudgetModal();
});
budgetForm.addEventListener('submit', handleBudgetFormSubmit);

// Reminder Modal Triggers
btnTriggerReminders.addEventListener('click', openReminderModal);
btnCloseReminderModal.addEventListener('click', closeReminderModal);
btnCancelReminderModal.addEventListener('click', closeReminderModal);
reminderModalOverlay.addEventListener('click', (e) => {
    if (e.target === reminderModalOverlay) closeReminderModal();
});
reminderForm.addEventListener('submit', handleReminderFormSubmit);

// Category Modal Triggers
navCategoriesTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openCategoryModal();
});
btnCloseCategoryModal.addEventListener('click', closeCategoryModal);
categoryModalOverlay.addEventListener('click', (e) => {
    if (e.target === categoryModalOverlay) closeCategoryModal();
});
categoryAddForm.addEventListener('submit', handleCategoryAddFormSubmit);

// Password Change Modal Triggers
navPasswordTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openPasswordModal();
});
btnClosePasswordModal.addEventListener('click', closePasswordModal);
btnCancelPasswordModal.addEventListener('click', closePasswordModal);
passwordModalOverlay.addEventListener('click', (e) => {
    if (e.target === passwordModalOverlay) closePasswordModal();
});
passwordChangeForm.addEventListener('submit', handlePasswordChangeFormSubmit);

// CSV Export Click Event
btnExportCsv.addEventListener('click', exportToCsv);
btnExportPdf.addEventListener('click', exportToPdf);

// Instant Filter/Search listeners
searchInput.addEventListener('input', renderTransactions);
filterType.addEventListener('change', renderTransactions);
filterCategory.addEventListener('change', renderTransactions);
filterMonth.addEventListener('change', renderTransactions);
filterYear.addEventListener('change', renderTransactions);

btnClearFilters.addEventListener('click', () => {
    searchInput.value = '';
    filterType.value = 'All';
    filterCategory.value = 'All';
    filterMonth.value = 'All';
    filterYear.value = 'All';
    renderTransactions();
});

// Logout trigger
if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

// Global scope window methods for inline onclick triggers
window.payReminder = payReminder;
window.deleteReminder = deleteReminder;
window.openEditModal = openEditModal;
window.deleteTransaction = deleteTransaction;
window.deleteCategory = deleteCategory;
window.exportToCsv = exportToCsv;
window.exportToPdf = exportToPdf;

// Window startup initialization
window.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    updateHeaderDate();
    
    // Check if the user is authenticated first
    const authenticated = await checkAuth();
    if (authenticated) {
        await fetchCategories(); // Load custom categories first so other renders can map color accent details
        fetchSummary();
        fetchTransactions();
        fetchBudgets();
        fetchReminders();
    }
});
