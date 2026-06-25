// Global State Management
const state = {
  user: null, // { id, name, email, role }
  activeTab: '', // Depends on user role
  employees: [], // Loaded directory list
  reimbursements: [], // Current view's claims
  subordinateClaims: null, // Subordinate history for modal
  activeSubordinate: null, // Subordinate record for modal
  loading: false
};

// --- Toast notification engine ---
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Choose icon based on type
  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Close trigger
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  });

  // Self-destruction
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }
  }, 4000);
}

// --- Global Loader controls ---
function showLoader() {
  state.loading = true;
  document.getElementById('global-loader')?.classList.remove('hidden');
}

function hideLoader() {
  state.loading = false;
  document.getElementById('global-loader')?.classList.add('hidden');
}

// --- Fetch client helper ---
async function request(url, options = {}) {
  showLoader();
  try {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    const res = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    const data = await res.json();

    if (!res.ok) {
      // Automatic logout on authorization failure
      if (res.status === 401 || res.status === 403) {
        if (state.user) {
          localStorage.removeItem('user');
          state.user = null;
          showToast('Session Expired', 'Please login again to continue.', 'warning');
          renderApp();
        }
      }
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    showToast('Operation Failed', err.message, 'error');
    throw err;
  } finally {
    hideLoader();
  }
}

// --- Router and View controller ---
function setTab(tabName) {
  state.activeTab = tabName;
  // Update active status in sidebar UI
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.dataset.tab === tabName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Pull data on tab switch
  refreshTabContent();
}

// Clear state on logout
async function handleLogout() {
  try {
    await request('/rest/onboardings/logout', { method: 'POST' });
    localStorage.removeItem('user');
    state.user = null;
    showToast('Logged Out', 'Successfully logged out of the session.', 'success');
    renderApp();
  } catch (err) {
    // If it fails, force clear locally
    localStorage.removeItem('user');
    state.user = null;
    renderApp();
  }
}

// Refresh active tab views
async function refreshTabContent() {
  const container = document.getElementById('main-workspace');
  if (!container) return;

  container.innerHTML = `<div style="display:flex; justify-content:center; padding:40px;"><div class="spinner"></div></div>`;

  try {
    if (state.activeTab === 'my-claims' || state.activeTab === 'pending-approvals' || state.activeTab === 'ape-pipeline' || state.activeTab === 'cfo-pipeline') {
      const res = await request('/rest/reimbursements');
      state.reimbursements = res.data.reimbursements || [];
      renderActiveTab();
    } else if (state.activeTab === 'employees-directory') {
      const res = await request('/rest/employees');
      state.employees = res.data.users || [];
      renderActiveTab();
    } else if (state.activeTab === 'raise-claim') {
      renderActiveTab();
    } else if (state.activeTab === 'role-management') {
      // For CFO dashboard role assignment forms, load directory first to populate selectors
      const res = await request('/rest/employees');
      state.employees = res.data.users || [];
      renderActiveTab();
    }
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="alert-octagon" class="empty-state-icon" style="color:var(--color-rejected)"></i>
        <h3>Failed to load content</h3>
        <p>${err.message}</p>
        <button class="btn btn-primary" onclick="refreshTabContent()" style="margin-top:16px;">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

// --- Application Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
  // Check for saved session
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    try {
      state.user = JSON.parse(savedUser);
    } catch (e) {
      localStorage.removeItem('user');
    }
  }
  renderApp();
});

// Render the high level frame
function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  if (!state.user) {
    renderAuthScreen(root);
  } else {
    renderDashboard(root);
  }
  lucide.createIcons();
}

// --- Renders Authorization screen (Login/Signup) ---
let authActiveTab = 'login'; // 'login' or 'register'
function renderAuthScreen(root) {
  root.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="brand-wrapper" style="justify-content: center; margin-bottom: 30px;">
          <div class="brand-logo">R</div>
          <span class="brand-name">RazorPay Claims</span>
        </div>
        
        <div class="auth-tabs">
          <div class="auth-tab ${authActiveTab === 'login' ? 'active' : ''}" id="tab-login-select">LOG IN</div>
          <div class="auth-tab ${authActiveTab === 'register' ? 'active' : ''}" id="tab-register-select">REGISTER</div>
        </div>

        <div id="auth-form-container">
          ${authActiveTab === 'login' ? renderLoginForm() : renderRegisterForm()}
        </div>
      </div>
    </div>
  `;

  // Attach tab events
  document.getElementById('tab-login-select').addEventListener('click', () => {
    authActiveTab = 'login';
    renderApp();
  });
  document.getElementById('tab-register-select').addEventListener('click', () => {
    authActiveTab = 'register';
    renderApp();
  });

  // Attach form handlers
  if (authActiveTab === 'login') {
    document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
  } else {
    document.getElementById('register-form').addEventListener('submit', handleRegisterSubmit);
  }
}

function renderLoginForm() {
  return `
    <form id="login-form" class="auth-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="login-email">Corporate Email (@org.com)</label>
        <input class="form-input" type="email" id="login-email" placeholder="you@org.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label" for="login-password">Password</label>
        <input class="form-input" type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password">
      </div>
      <button class="btn btn-primary" type="submit" id="login-btn" style="justify-content: center; margin-top: 10px;">
        <i data-lucide="log-in"></i> Sign In
      </button>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form id="register-form" class="auth-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="register-name">Full Name</label>
        <input class="form-input" type="text" id="register-name" placeholder="John Doe" required autocomplete="name">
      </div>
      <div class="form-group">
        <label class="form-label" for="register-email">Corporate Email (@org.com)</label>
        <input class="form-input" type="email" id="register-email" placeholder="username@org.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label" for="register-password">Password</label>
        <input class="form-input" type="password" id="register-password" placeholder="••••••••" required autocomplete="new-password">
      </div>
      <button class="btn btn-primary" type="submit" id="register-btn" style="justify-content: center; margin-top: 10px;">
        <i data-lucide="user-plus"></i> Create Account
      </button>
    </form>
  `;
}

// Auth submission logic
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Validation Error', 'Email and password fields are required.', 'error');
    return;
  }

  if (!email.endsWith('@org.com')) {
    showToast('Validation Error', 'Only organization domain (@org.com) emails allowed.', 'error');
    return;
  }

  try {
    const res = await request('/rest/onboardings/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.user = res.data.user;
    localStorage.setItem('user', JSON.stringify(res.data.user));
    showToast('Access Granted', `Welcome back, ${state.user.name}!`, 'success');

    // Default route mapping per roles
    if (state.user.role === 'EMP') state.activeTab = 'my-claims';
    else if (state.user.role === 'RM') state.activeTab = 'pending-approvals';
    else if (state.user.role === 'APE') state.activeTab = 'ape-pipeline';
    else if (state.user.role === 'CFO') state.activeTab = 'cfo-pipeline';

    renderApp();
  } catch (err) {
    // Already handled by requesting handler
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (!name || !email || !password) {
    showToast('Validation Error', 'All fields are mandatory.', 'error');
    return;
  }

  if (!email.endsWith('@org.com')) {
    showToast('Validation Error', 'Corporate registration requires an @org.com domain email.', 'error');
    return;
  }

  try {
    await request('/rest/onboardings/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    showToast('Registration Successful', 'Account created cleanly. You can login now!', 'success');
    authActiveTab = 'login';
    renderApp();
  } catch (err) {
    // Exception handled
  }
}

// --- Renders main corporate portal frame ---
function renderDashboard(root) {
  root.innerHTML = `
    <header class="app-header">
      <div class="brand-wrapper">
        <div class="brand-logo">R</div>
        <h1 class="brand-name">RazorPay Expense Hub</h1>
      </div>
      <div class="user-profile">
        <div class="user-meta">
          <div class="user-name">${state.user.name}</div>
          <span class="user-role-badge ${state.user.role.toLowerCase()}">${state.user.role}</span>
        </div>
        <button class="btn" id="logout-btn">
          <i data-lucide="log-out"></i> Sign Out
        </button>
      </div>
    </header>

    <div class="dashboard-grid">
      <aside class="sidebar-panel">
        <nav class="sidebar-nav" aria-label="Main Navigation">
          ${renderSidebarNav()}
        </nav>
      </aside>
      
      <main class="content-panel" id="main-workspace">
        <!-- Rendered Tab Content goes here -->
      </main>
    </div>

    <!-- Subordinate lookup history modal -->
    <div id="subordinate-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title-text">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title-text">Subordinate Claim History</h3>
          <button class="modal-close-btn" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body" id="subordinate-modal-body">
          <!-- Claims listing dynamically loaded -->
        </div>
        <div class="modal-footer">
          <button class="btn" id="modal-close-action-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  // Attach global logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Set up modal closures
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-close-action-btn').addEventListener('click', closeModal);

  // Set default tab if not set
  if (!state.activeTab) {
    if (state.user.role === 'EMP') state.activeTab = 'my-claims';
    else if (state.user.role === 'RM') state.activeTab = 'pending-approvals';
    else if (state.user.role === 'APE') state.activeTab = 'ape-pipeline';
    else if (state.user.role === 'CFO') state.activeTab = 'cfo-pipeline';
  }

  // Sidebar events mapping
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.tab;
      setTab(tab);
    });
  });

  // Load content
  setTab(state.activeTab);
}

function renderSidebarNav() {
  const role = state.user.role;
  let links = '';

  if (role === 'EMP') {
    links += `
      <div class="nav-item ${state.activeTab === 'my-claims' ? 'active' : ''}" data-tab="my-claims">
        <i data-lucide="wallet"></i> My Claims
      </div>
      <div class="nav-item ${state.activeTab === 'raise-claim' ? 'active' : ''}" data-tab="raise-claim">
        <i data-lucide="plus-circle"></i> File Voucher
      </div>
    `;
  } else if (role === 'RM') {
    links += `
      <div class="nav-item ${state.activeTab === 'pending-approvals' ? 'active' : ''}" data-tab="pending-approvals">
        <i data-lucide="file-check"></i> Direct Approvals
      </div>
      <div class="nav-item ${state.activeTab === 'subordinates' ? 'active' : ''}" data-tab="subordinates">
        <i data-lucide="users"></i> My Team
      </div>
    `;
  } else if (role === 'APE') {
    links += `
      <div class="nav-item ${state.activeTab === 'ape-pipeline' ? 'active' : ''}" data-tab="ape-pipeline">
        <i data-lucide="layers"></i> AP Pipeline
      </div>
      <div class="nav-item ${state.activeTab === 'employees-directory' ? 'active' : ''}" data-tab="employees-directory">
        <i data-lucide="users"></i> Corporate List
      </div>
    `;
  } else if (role === 'CFO') {
    links += `
      <div class="nav-item ${state.activeTab === 'cfo-pipeline' ? 'active' : ''}" data-tab="cfo-pipeline">
        <i data-lucide="award"></i> CFO Ledger
      </div>
      <div class="nav-item ${state.activeTab === 'role-management' ? 'active' : ''}" data-tab="role-management">
        <i data-lucide="shield-alert"></i> Access Control
      </div>
      <div class="nav-item ${state.activeTab === 'employees-directory' ? 'active' : ''}" data-tab="employees-directory">
        <i data-lucide="users"></i> Global Database
      </div>
    `;
  }

  return links;
}

// --- Renders active tab template in workspace ---
function renderActiveTab() {
  const container = document.getElementById('main-workspace');
  if (!container) return;

  switch (state.activeTab) {
    case 'my-claims':
      renderMyClaims(container);
      break;
    case 'raise-claim':
      renderRaiseClaimForm(container);
      break;
    case 'pending-approvals':
      renderManagerApprovals(container);
      break;
    case 'subordinates':
      renderSubordinates(container);
      break;
    case 'ape-pipeline':
      renderAPEPipeline(container);
      break;
    case 'employees-directory':
      renderEmployeesDirectory(container);
      break;
    case 'cfo-pipeline':
      renderCFOPipeline(container);
      break;
    case 'role-management':
      renderCFORoleManagement(container);
      break;
  }
  lucide.createIcons();
}

// --- Render Helper Blocks ---

// 1. EMP: View Claims
function renderMyClaims(container) {
  const totalAmount = state.reimbursements.reduce((sum, item) => sum + item.amount, 0);
  const pendingCount = state.reimbursements.filter(item => item.status === 'PENDING').length;
  const approvedCount = state.reimbursements.filter(item => item.status === 'APPROVED').length;

  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">My Reimbursements</h2>
      <button class="btn btn-primary" onclick="refreshTabContent()">
        <i data-lucide="refresh-cw"></i> Refresh
      </button>
    </div>

    <!-- Quick Metrics -->
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-info">
          <span class="metric-title">Total Vouchers Filed</span>
          <span class="metric-value">${state.reimbursements.length}</span>
        </div>
        <div class="metric-icon"><i data-lucide="clipboard-list"></i></div>
      </div>
      <div class="metric-card">
        <div class="metric-info">
          <span class="metric-title">Total Amount Claimed</span>
          <span class="metric-value">₹${totalAmount.toLocaleString()}</span>
        </div>
        <div class="metric-icon"><i data-lucide="indian-rupee"></i></div>
      </div>
      <div class="metric-card">
        <div class="metric-info">
          <span class="metric-title">Pending Claims</span>
          <span class="metric-value" style="color:var(--color-pending)">${pendingCount}</span>
        </div>
        <div class="metric-icon"><i data-lucide="clock"></i></div>
      </div>
      <div class="metric-card">
        <div class="metric-info">
          <span class="metric-title">Approved Claims</span>
          <span class="metric-value" style="color:var(--color-approved)">${approvedCount}</span>
        </div>
        <div class="metric-icon"><i data-lucide="check-circle-2"></i></div>
      </div>
    </div>

    <div class="card-section">
      <div class="card-title"><i data-lucide="history"></i> Claim Records Pipeline</div>
      ${state.reimbursements.length === 0 ? `
        <div class="empty-state">
          <i data-lucide="folder-open" class="empty-state-icon"></i>
          <h3>No reimbursement claims found</h3>
          <p>You haven't filed any claims yet. Use the "File Voucher" option in the sidebar to start.</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Voucher ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Final Status</th>
              </tr>
            </thead>
            <tbody>
              ${state.reimbursements.map(c => `
                <tr>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${c.id}</td>
                  <td style="font-weight:600">${escapeHTML(c.title)}</td>
                  <td>${escapeHTML(c.description)}</td>
                  <td style="font-weight:700">₹${c.amount.toLocaleString()}</td>
                  <td><span class="status-badge ${c.status.toLowerCase()}">${c.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// 2. EMP: Raise Claim
function renderRaiseClaimForm(container) {
  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">File Expense Voucher</h2>
    </div>

    <div class="card-section" style="max-width: 650px;">
      <div class="card-title"><i data-lucide="file-plus"></i> Reimbursement Claim Form</div>
      <p style="color:var(--text-secondary); margin-top:-12px; font-size:14px;">Fill out all information accurately. Claims undergo manager and accounts payable audits prior to settlement.</p>
      
      <form id="raise-claim-form" class="auth-form" style="gap:24px;">
        <div class="form-group">
          <label class="form-label" for="claim-title">Voucher Title</label>
          <input class="form-input" type="text" id="claim-title" placeholder="e.g., Client dinner on 24th June" required>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="claim-desc">Detailed Description</label>
          <textarea class="form-input" id="claim-desc" placeholder="Explain the business purpose, attendees, items purchased, etc." style="min-height:120px; resize:vertical; font-family:inherit;" required></textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="claim-amount">Expense Amount (INR)</label>
          <input class="form-input" type="number" id="claim-amount" placeholder="e.g., 4500" min="1" required>
        </div>

        <button class="btn btn-primary" type="submit" id="claim-submit-btn" style="justify-content:center; padding:14px;">
          <i data-lucide="send"></i> Submit Voucher Claim
        </button>
      </form>
    </div>
  `;

  // Attach submission listener
  document.getElementById('raise-claim-form').addEventListener('submit', handleClaimSubmit);
}

async function handleClaimSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('claim-title').value.trim();
  const description = document.getElementById('claim-desc').value.trim();
  const amountStr = document.getElementById('claim-amount').value;

  if (!title || !description || !amountStr) {
    showToast('Validation Error', 'Please complete all form fields.', 'error');
    return;
  }

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) {
    showToast('Validation Error', 'Claim amount must be a positive integer.', 'error');
    return;
  }

  try {
    await request('/rest/reimbursements', {
      method: 'POST',
      body: JSON.stringify({ title, description, amount })
    });

    showToast('Claim Raised', 'Reimbursement voucher submitted for processing.', 'success');
    setTab('my-claims');
  } catch (err) {
    // Exception handled
  }
}

// 3. RM: Approvals
function renderManagerApprovals(container) {
  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">Direct Subordinate Approvals</h2>
      <button class="btn btn-primary" onclick="refreshTabContent()">
        <i data-lucide="refresh-cw"></i> Refresh
      </button>
    </div>

    <div class="card-section">
      <div class="card-title"><i data-lucide="clock"></i> Subordinate Claims Pending Manager Review</div>
      ${state.reimbursements.length === 0 ? `
        <div class="empty-state">
          <i data-lucide="check-square" class="empty-state-icon" style="color:var(--color-approved)"></i>
          <h3>All clear!</h3>
          <p>No claims currently pending your manager level approval.</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Voucher ID</th>
                <th>Employee ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.reimbursements.map(c => `
                <tr>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${c.id}</td>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${c.employee_id}</td>
                  <td style="font-weight:600">${escapeHTML(c.title)}</td>
                  <td>${escapeHTML(c.description)}</td>
                  <td style="font-weight:700">₹${c.amount.toLocaleString()}</td>
                  <td>
                    <div class="actions-cell">
                      <button class="btn btn-success" onclick="processStatusTransition('${c.id}', 'APPROVED')">
                        <i data-lucide="check"></i> Approve
                      </button>
                      <button class="btn btn-danger" onclick="processStatusTransition('${c.id}', 'REJECTED')">
                        <i data-lucide="x"></i> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// 4. RM: Subordinates list
function renderSubordinates(container) {
  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">My Subordinates Team</h2>
      <button class="btn btn-primary" onclick="refreshTabContent()">
        <i data-lucide="refresh-cw"></i> Refresh
      </button>
    </div>

    <div class="card-section">
      <div class="card-title"><i data-lucide="users"></i> Assigned Direct Subordinates</div>
      ${state.employees.length === 0 ? `
        <div class="empty-state">
          <i data-lucide="users" class="empty-state-icon"></i>
          <h3>No assigned subordinates</h3>
          <p>Contact the CFO to update your team assignments database.</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Full Name</th>
                <th>Corporate Email</th>
                <th>System Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.employees.map(e => `
                <tr>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${e.id}</td>
                  <td style="font-weight:600">${escapeHTML(e.name)}</td>
                  <td>${escapeHTML(e.email)}</td>
                  <td><span class="user-role-badge emp">${e.role}</span></td>
                  <td>
                    <button class="btn btn-primary" onclick="viewSubordinateHistory('${e.id}', '${escapeHTML(e.name)}')">
                      <i data-lucide="eye"></i> History Ledger
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// RM Subordinate Drilldown history modal loading
window.viewSubordinateHistory = async function(empId, empName) {
  try {
    const res = await request(`/rest/reimbursements/${empId}`);
    const claims = res.data.reimbursements || [];
    
    const body = document.getElementById('subordinate-modal-body');
    const modalTitle = document.getElementById('modal-title-text');
    
    modalTitle.textContent = `${empName}'s Expense History Ledger`;
    
    if (claims.length === 0) {
      body.innerHTML = `
        <div class="empty-state" style="margin:20px 0;">
          <i data-lucide="folder-open" class="empty-state-icon"></i>
          <h3>No voucher submissions</h3>
          <p>This user has not submitted any claims.</p>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Voucher ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${claims.map(c => `
                <tr>
                  <td style="font-family:monospace; font-size:11px; color:var(--text-secondary)">${c.id}</td>
                  <td style="font-weight:600">${escapeHTML(c.title)}</td>
                  <td>${escapeHTML(c.description)}</td>
                  <td style="font-weight:700">₹${c.amount.toLocaleString()}</td>
                  <td><span class="status-badge ${c.status.toLowerCase()}">${c.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    document.getElementById('subordinate-modal').classList.remove('hidden');
    lucide.createIcons();
  } catch (err) {
    // Exception handled
  }
};

function closeModal() {
  document.getElementById('subordinate-modal').classList.add('hidden');
}

// 5. APE: Approvals Pipeline
function renderAPEPipeline(container) {
  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">Accounts Payable Pipeline</h2>
      <button class="btn btn-primary" onclick="refreshTabContent()">
        <i data-lucide="refresh-cw"></i> Refresh
      </button>
    </div>

    <div class="card-section">
      <div class="card-title"><i data-lucide="file-check-2"></i> Vouchers Audited and Approved by Managers (Pending AP Verification)</div>
      ${state.reimbursements.length === 0 ? `
        <div class="empty-state">
          <i data-lucide="check-square" class="empty-state-icon" style="color:var(--color-approved)"></i>
          <h3>Pipeline is clear</h3>
          <p>No reimbursement claims currently awaiting Accounts Payable review.</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Voucher ID</th>
                <th>Employee ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.reimbursements.map(c => `
                <tr>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${c.id}</td>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${c.employee_id}</td>
                  <td style="font-weight:600">${escapeHTML(c.title)}</td>
                  <td>${escapeHTML(c.description)}</td>
                  <td style="font-weight:700">₹${c.amount.toLocaleString()}</td>
                  <td>
                    <div class="actions-cell">
                      <button class="btn btn-success" onclick="processStatusTransition('${c.id}', 'APPROVED')">
                        <i data-lucide="check"></i> AP Pass
                      </button>
                      <button class="btn btn-danger" onclick="processStatusTransition('${c.id}', 'REJECTED')">
                        <i data-lucide="x"></i> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// 6. APE / CFO: Employee Directory
function renderEmployeesDirectory(container) {
  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">Corporate Directory Database</h2>
      <button class="btn btn-primary" onclick="refreshTabContent()">
        <i data-lucide="refresh-cw"></i> Refresh
      </button>
    </div>

    <div class="card-section">
      <div class="card-title"><i data-lucide="users"></i> Registered Personnel</div>
      ${state.employees.length === 0 ? `
        <div class="empty-state">
          <i data-lucide="users" class="empty-state-icon"></i>
          <h3>No records found</h3>
          <p>Database system currently returned an empty personnel list.</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Corporate Email</th>
                <th>Security Role</th>
              </tr>
            </thead>
            <tbody>
              ${state.employees.map(u => `
                <tr>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${u.id}</td>
                  <td style="font-weight:600">${escapeHTML(u.name)}</td>
                  <td>${escapeHTML(u.email)}</td>
                  <td><span class="user-role-badge ${u.role.toLowerCase()}">${u.role}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// 7. CFO: Pipeline
function renderCFOPipeline(container) {
  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">Executive CFO Ledger</h2>
      <button class="btn btn-primary" onclick="refreshTabContent()">
        <i data-lucide="refresh-cw"></i> Refresh
      </button>
    </div>

    <div class="card-section">
      <div class="card-title"><i data-lucide="award"></i> Final Settlement Executive Audits (AP Approved)</div>
      ${state.reimbursements.length === 0 ? `
        <div class="empty-state">
          <i data-lucide="check-square" class="empty-state-icon" style="color:var(--color-approved)"></i>
          <h3>No pending audits</h3>
          <p>All AP-signed-off claims have been settled or rejected cleanly.</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Voucher ID</th>
                <th>Employee ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.reimbursements.map(c => `
                <tr>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${c.id}</td>
                  <td style="font-family:monospace; font-size:12px; color:var(--text-secondary)">${c.employee_id}</td>
                  <td style="font-weight:600">${escapeHTML(c.title)}</td>
                  <td>${escapeHTML(c.description)}</td>
                  <td style="font-weight:700">₹${c.amount.toLocaleString()}</td>
                  <td>
                    <div class="actions-cell">
                      <button class="btn btn-success" onclick="processStatusTransition('${c.id}', 'APPROVED')">
                        <i data-lucide="check"></i> Settle Payment
                      </button>
                      <button class="btn btn-danger" onclick="processStatusTransition('${c.id}', 'REJECTED')">
                        <i data-lucide="x"></i> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// 8. CFO: Access and Manager Management Page
function renderCFORoleManagement(container) {
  // Filter candidates lists
  const usersOptionHTML = state.employees.map(u => `
    <option value="${u.id}">${escapeHTML(u.name)} (${escapeHTML(u.email)} - Role: ${u.role})</option>
  `).join('');

  container.innerHTML = `
    <div class="page-title-block">
      <h2 class="page-title">Corporate Access Control Panel</h2>
      <button class="btn btn-primary" onclick="refreshTabContent()">
        <i data-lucide="refresh-cw"></i> Refresh Directory
      </button>
    </div>

    <div class="split-layout">
      <!-- Role Assignment Panel -->
      <div class="card-section">
        <div class="card-title"><i data-lucide="user-cog"></i> Modify User Security Role</div>
        <p style="color:var(--text-secondary); margin-top:-12px; font-size:13px;">Changes will grant instant operational authority and pipeline permissions access.</p>
        
        <form id="assign-role-form" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="assign-role-user-id">Target Employee</label>
            <select class="form-input form-select" id="assign-role-user-id" required>
              <option value="" disabled selected>Select user...</option>
              ${usersOptionHTML}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="assign-role-select">Target Authority Role</label>
            <select class="form-input form-select" id="assign-role-select" required>
              <option value="" disabled selected>Select security role...</option>
              <option value="EMP">EMP (Employee)</option>
              <option value="RM">RM (Reporting Manager)</option>
              <option value="APE">APE (Accounts Payable Executive)</option>
              <option value="CFO">CFO (Chief Financial Officer)</option>
            </select>
          </div>

          <button class="btn btn-primary" type="submit" id="assign-role-btn" style="justify-content:center;">
            <i data-lucide="shield-check"></i> Assign New Role
          </button>
        </form>
      </div>

      <!-- Manager Link/Unlink panel -->
      <div class="card-section">
        <div class="card-title"><i data-lucide="git-merge"></i> Reporting Manager Bindings</div>
        <p style="color:var(--text-secondary); margin-top:-12px; font-size:13px;">Map reporting links. An employee reporting line must bind to exactly one manager (RM).</p>
        
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- Binding assignment -->
          <form id="assign-manager-form" class="auth-form" style="gap:16px; border-bottom:1px solid var(--glass-border); padding-bottom:24px;">
            <div class="form-group">
              <label class="form-label" for="assign-mgr-emp-id">Employee (EMP)</label>
              <select class="form-input form-select" id="assign-mgr-emp-id" required>
                <option value="" disabled selected>Select employee...</option>
                ${usersOptionHTML}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="assign-mgr-id">Manager (RM)</label>
              <select class="form-input form-select" id="assign-mgr-id" required>
                <option value="" disabled selected>Select manager...</option>
                ${usersOptionHTML}
              </select>
            </div>

            <button class="btn btn-primary" type="submit" id="assign-mgr-btn" style="justify-content:center;">
              <i data-lucide="link"></i> Map Reporting Line
            </button>
          </form>

          <!-- Severing relationship -->
          <form id="remove-manager-form" class="auth-form" style="gap:16px;">
            <div class="form-group">
              <label class="form-label" for="remove-mgr-emp-id">Subordinate User</label>
              <select class="form-input form-select" id="remove-mgr-emp-id" required>
                <option value="" disabled selected>Select employee...</option>
                ${usersOptionHTML}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="remove-mgr-id">Active Manager</label>
              <select class="form-input form-select" id="remove-mgr-id" required>
                <option value="" disabled selected>Select manager...</option>
                ${usersOptionHTML}
              </select>
            </div>

            <button class="btn btn-danger" type="submit" id="remove-mgr-btn" style="justify-content:center; border: 1px solid rgba(239,68,68,0.4)">
              <i data-lucide="link-2-off"></i> Sever Manager Connection
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Attach submit listeners
  document.getElementById('assign-role-form').addEventListener('submit', handleAssignRoleSubmit);
  document.getElementById('assign-manager-form').addEventListener('submit', handleAssignManagerSubmit);
  document.getElementById('remove-manager-form').addEventListener('submit', handleRemoveManagerSubmit);
}

async function handleAssignRoleSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('assign-role-user-id').value;
  const role = document.getElementById('assign-role-select').value;

  if (!userId || !role) {
    showToast('Validation Error', 'Please select both fields.', 'error');
    return;
  }

  try {
    await request('/rest/roles/assign', {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    });
    showToast('Role Updated', 'Security access level changed successfully.', 'success');
    refreshTabContent();
  } catch (e) {
    // Handled
  }
}

async function handleAssignManagerSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('assign-mgr-emp-id').value;
  const managerId = document.getElementById('assign-mgr-id').value;

  if (!userId || !managerId) {
    showToast('Validation Error', 'Please select both the employee and manager.', 'error');
    return;
  }

  if (userId === managerId) {
    showToast('Validation Error', 'A user cannot report to themselves.', 'error');
    return;
  }

  try {
    await request('/rest/employees/assign', {
      method: 'POST',
      body: JSON.stringify({ userId, managerId })
    });
    showToast('Reporting Mapped', 'Subordinate manager link set cleanly.', 'success');
    refreshTabContent();
  } catch (e) {
    // Handled
  }
}

async function handleRemoveManagerSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('remove-mgr-emp-id').value;
  const managerId = document.getElementById('remove-mgr-id').value;

  if (!userId || !managerId) {
    showToast('Validation Error', 'Both employee and manager selection are required.', 'error');
    return;
  }

  try {
    await request('/rest/employees/assign', {
      method: 'DELETE',
      body: JSON.stringify({ userId, managerId })
    });
    showToast('Connection Severed', 'Subordinate reporting association deleted.', 'success');
    refreshTabContent();
  } catch (e) {
    // Handled
  }
}

// --- Common state transitions (Approvals / Rejections) ---
window.processStatusTransition = async function(reimbursementId, status) {
  try {
    await request('/rest/reimbursements', {
      method: 'PATCH',
      body: JSON.stringify({ reimbursementId, status })
    });
    showToast(`Claim ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`, `Voucher state updated cleanly.`, 'success');
    refreshTabContent();
  } catch (err) {
    // Handled
  }
};

// --- General HTML character escaping utility to prevent XSS ---
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
