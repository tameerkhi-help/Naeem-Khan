// Firebase Config (Replace with your own keys if needed, using same as provided)
const firebaseConfig = {
    apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
    authDomain: "naeemjan-c7f46.firebaseapp.com",
    projectId: "naeemjan-c7f46",
    storageBucket: "naeemjan-c7f46.firebasestorage.app",
    messagingSenderId: "319489849314",
    appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Global State
let currentLang = 'en';
let allCustomersData = [];
let customerToDeleteId = null;
let customerToPayId = null;
let currentDetailId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth State immediately
    auth.onAuthStateChanged(user => {
        if (user) {
            showDashboard();
            loadCustomers();
        } else {
            showLogin();
        }
    });

    // Set Default Dates
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('issueDate')) document.getElementById('issueDate').value = today;
    if(document.getElementById('payment-date')) document.getElementById('payment-date').value = today;

    // Language Toggle
    document.getElementById('langToggle').addEventListener('click', toggleLanguage);
});

// --- AUTHENTICATION ---
function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
}

function login() {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;
    const btn = document.getElementById('login-btn');
    const errorMsg = document.getElementById('login-error');

    // UI Feedback for speed
    btn.disabled = true;
    btn.innerText = "Processing...";
    errorMsg.innerText = "";

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        return auth.signInWithEmailAndPassword(email, pass);
    })
    .catch((error) => {
        btn.disabled = false;
        btn.innerText = currentLang === 'ur' ? "لاگ ان کریں" : "Login Now";
        errorMsg.innerText = error.message;
    });
}

function logout() {
    auth.signOut();
}

// --- CORE DATA HANDLING ---
async function loadCustomers() {
    try {
        const snapshot = await db.collection('customers').orderBy('updatedAt', 'desc').get();
        allCustomersData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        updateDashboardStats();
        renderDueList();
        renderAllCustomers();
    } catch (error) {
        console.error("Error loading data", error);
    }
}

function updateDashboardStats() {
    document.getElementById('total-customers').innerText = allCustomersData.length;
    
    // Calculate Due Today
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let dueCount = 0;
    let totalBalance = 0;

    allCustomersData.forEach(c => {
        totalBalance += (c.currentBalance || 0);
        if(c.nextDueDate && c.currentBalance > 0) {
            const dDate = new Date(c.nextDueDate);
            dDate.setHours(0,0,0,0);
            if(dDate <= today) dueCount++;
        }
    });

    document.getElementById('due-today').innerText = dueCount;
    document.getElementById('total-balance').innerText = "Rs. " + totalBalance.toLocaleString();
}

// --- ADD/EDIT CUSTOMER & CALCULATIONS ---
function calculateRemaining() {
    const total = parseFloat(document.getElementById('totalPrice').value) || 0;
    const advance = parseFloat(document.getElementById('advance').value) || 0;
    const monthly = parseFloat(document.getElementById('monthlyInstallment').value) || 0;
    const pastPaidMonths = parseFloat(document.getElementById('pastPaidInstallments').value) || 0;
    
    // Logic for Old Customers:
    // Remaining = Total - Advance - (Monthly * PastMonths)
    let alreadyPaidAmount = pastPaidMonths * monthly;
    let remaining = total - advance - alreadyPaidAmount;

    if(remaining < 0) remaining = 0;
    
    document.getElementById('initialRemaining').value = remaining;
}

document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const mode = document.getElementById('form-mode').value;
    const id = mode === 'edit' ? document.getElementById('original-account-id').value : document.getElementById('accountId').value;

    // Get Values
    const pastMonths = parseFloat(document.getElementById('pastPaidInstallments').value) || 0;
    const issueDateStr = document.getElementById('issueDate').value;
    
    // Calculate Next Due Date based on Past History
    // If user paid 6 months, next due date is IssueDate + 6 months + 1 month
    let nextDue = new Date(issueDateStr);
    nextDue.setMonth(nextDue.getMonth() + pastMonths + 1);

    const data = {
        accountId: document.getElementById('accountId').value,
        buyerName: document.getElementById('buyerName').value,
        phone: document.getElementById('phone').value,
        fatherName: document.getElementById('fatherName').value,
        homeAddress: document.getElementById('homeAddress').value,
        items: document.getElementById('items').value,
        totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
        advance: parseFloat(document.getElementById('advance').value) || 0,
        monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value) || 0,
        currentBalance: parseFloat(document.getElementById('initialRemaining').value) || 0,
        guarantor1: document.getElementById('g1Name').value,
        guarantor2: document.getElementById('g2Name').value,
        issueDate: issueDateStr,
        pastPaidMonths: pastMonths, // Save this to know history
        nextDueDate: nextDue.toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if(mode === 'add') {
            // Check if ID exists
            const exists = await db.collection('customers').doc(id).get();
            if(exists.exists) {
                alert("Account ID already exists!");
                btn.disabled = false;
                return;
            }
            await db.collection('customers').doc(id).set(data);
        } else {
            // Merge for update
            await db.collection('customers').doc(id).set(data, {merge: true});
        }
        
        resetForm();
        loadCustomers();
        showView('due-list-view');
        alert("Customer Saved!");
    } catch(err) {
        console.error(err);
        alert("Error saving");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Customer";
    }
});

// --- VIEWS & RENDERING ---
function renderDueList() {
    const tbody = document.getElementById('due-customers-body');
    tbody.innerHTML = "";
    
    const today = new Date();
    today.setHours(0,0,0,0);

    const dueList = allCustomersData.filter(c => {
        if(!c.nextDueDate || c.currentBalance <= 0) return false;
        const d = new Date(c.nextDueDate);
        d.setHours(0,0,0,0);
        return d <= today; // Overdue or Due Today
    });

    if(dueList.length === 0) {
        document.getElementById('no-due-msg').classList.remove('hidden');
    } else {
        document.getElementById('no-due-msg').classList.add('hidden');
        dueList.forEach(c => {
            const d = new Date(c.nextDueDate).toLocaleDateString();
            const row = `
                <tr>
                    <td data-en="Account ID" data-ur="آئی ڈی"><b>${c.accountId}</b></td>
                    <td data-en="Name" data-ur="نام">${c.buyerName}</td>
                    <td data-en="Phone" data-ur="فون"><a href="tel:${c.phone}">${c.phone}</a></td>
                    <td data-en="Installment" data-ur="قسط">Rs. ${c.monthlyInstallment}</td>
                    <td data-en="Due Date" data-ur="تاریخ" style="color:red; font-weight:bold;">${d}</td>
                    <td data-en="Actions" data-ur="ایکشن">
                        <button onclick="openPaymentModal('${c.id}')" class="btn-small btn-pay">Pay</button>
                        <button onclick="viewCustomerDetails('${c.id}')" class="btn-small btn-view">View</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }
}

function renderAllCustomers() {
    const tbody = document.getElementById('all-customers-body');
    tbody.innerHTML = "";
    
    allCustomersData.forEach(c => {
        const row = `
            <tr>
                <td data-en="ID" data-ur="آئی ڈی">${c.accountId}</td>
                <td data-en="Name" data-ur="نام">${c.buyerName}</td>
                <td data-en="Balance" data-ur="بقایا">Rs. ${c.currentBalance}</td>
                <td data-en="Actions" data-ur="ایکشن">
                    <button onclick="viewCustomerDetails('${c.id}')" class="btn-small btn-view"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- SEARCH & FILTER ---
function searchCustomer() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const type = document.querySelector('input[name="search-type"]:checked').value;
    const container = document.getElementById('search-result-container');
    container.innerHTML = "";

    const results = allCustomersData.filter(c => {
        if(type === 'id') return c.accountId.toString().toLowerCase().includes(query);
        if(type === 'name') return c.buyerName.toLowerCase().includes(query);
        if(type === 'phone') return c.phone && c.phone.includes(query);
    });

    results.forEach(c => {
        const card = `
            <div class="customer-card">
                <h4>${c.buyerName} <small>(${c.accountId})</small></h4>
                <p>Phone: ${c.phone}</p>
                <p>Balance: <b>Rs. ${c.currentBalance}</b></p>
                <div class="card-actions">
                    <button onclick="openPaymentModal('${c.id}')" class="btn-small btn-pay">Add Payment</button>
                    <button onclick="viewCustomerDetails('${c.id}')" class="btn-small btn-view">Details</button>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
    
    if(results.length === 0) container.innerHTML = "<p class='text-center'>No results found</p>";
}

// --- CUSTOMER DETAILS & LEDGER (The key fix) ---
function viewCustomerDetails(id) {
    currentDetailId = id;
    const c = allCustomersData.find(x => x.id === id);
    if(!c) return;

    // Fill Basic Info
    document.getElementById('detail-name').innerText = c.buyerName;
    document.getElementById('detail-id').innerText = c.accountId;
    document.getElementById('detail-phone').innerText = c.phone;
    document.getElementById('detail-item').innerText = c.items;
    document.getElementById('detail-address').innerText = c.homeAddress;

    // Fill Finance Info
    document.getElementById('detail-total').innerText = c.totalPrice;
    document.getElementById('detail-remaining').innerText = c.currentBalance;
    
    // Calculate Paid (Total - Remaining)
    const paid = c.totalPrice - c.currentBalance;
    document.getElementById('detail-paid').innerText = paid;

    // GENERATE LEDGER (HISTORY)
    const tbody = document.getElementById('ledger-body');
    tbody.innerHTML = "";

    let startDate = new Date(c.issueDate);
    let tempBalance = c.totalPrice - c.advance; // Starting debt
    let totalMonthsToPay = Math.ceil(tempBalance / c.monthlyInstallment);
    
    // We iterate roughly for the number of installments + buffer
    // Logic: We check how much has been paid (Total - CurrentBalance - Advance)
    // Then we see how many months that covers.
    
    let amountPaidSoFar = (c.totalPrice - c.advance) - c.currentBalance;
    
    // Add Past Installments (Old Customer Logic)
    // If we marked 6 months as paid in the form, treat them as paid.
    
    // Display Logic:
    for(let i = 1; i <= totalMonthsToPay + 2; i++) {
        // Calculate Month Date
        let monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + i);
        
        let status = "Due";
        let statusClass = "badge-due";

        // Logic to determine if this month is paid
        // If the amount needed for this month is covered by "amountPaidSoFar"
        if(amountPaidSoFar >= c.monthlyInstallment) {
            status = "Paid";
            statusClass = "badge-paid";
            amountPaidSoFar -= c.monthlyInstallment;
        } else if (amountPaidSoFar > 0) {
            status = "Partial"; // Just in case
            amountPaidSoFar = 0;
        }

        const row = `
            <tr>
                <td>${monthDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                <td>Rs. ${c.monthlyInstallment}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
            </tr>
        `;
        tbody.innerHTML += row;
        
        // Stop if balance is clear
        if(status === "Due" && i > totalMonthsToPay) break;
    }

    // Open Modal
    document.getElementById('customer-details-modal').classList.remove('hidden');
}

// --- PAYMENTS ---
function openPaymentModal(id) {
    customerToPayId = id;
    const c = allCustomersData.find(x => x.id === id);
    document.getElementById('pay-customer-name').innerText = c.buyerName;
    document.getElementById('pay-balance-info').innerText = `Current Balance: Rs. ${c.currentBalance}`;
    document.getElementById('payment-amount').value = c.monthlyInstallment;
    document.getElementById('payment-modal').classList.remove('hidden');
}

async function submitPayment() {
    if(!customerToPayId) return;
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const date = document.getElementById('payment-date').value;
    const notes = document.getElementById('payment-notes').value;

    const c = allCustomersData.find(x => x.id === customerToPayId);
    const newBalance = c.currentBalance - amount;

    // Calculate Next Due Date (Add 1 month to current due date)
    let nextDate = new Date(c.nextDueDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    try {
        await db.collection('customers').doc(customerToPayId).update({
            currentBalance: newBalance,
            nextDueDate: nextDate.toISOString(),
            lastPaymentDate: date,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add payment history record (Subcollection)
        await db.collection('customers').doc(customerToPayId).collection('payments').add({
            amount: amount,
            date: date,
            notes: notes
        });

        alert("Payment Recorded!");
        closeModal('payment-modal');
        loadCustomers();
    } catch(e) {
        console.error(e);
        alert("Error");
    }
}

// --- EDIT & DELETE ---
function editCurrentCustomer() {
    if(!currentDetailId) return;
    closeModal('customer-details-modal');
    
    const c = allCustomersData.find(x => x.id === currentDetailId);
    
    document.getElementById('form-mode').value = 'edit';
    document.getElementById('original-account-id').value = c.id;
    document.getElementById('form-title').innerText = "Edit Customer";
    
    // Fill Form
    document.getElementById('accountId').value = c.accountId;
    document.getElementById('buyerName').value = c.buyerName;
    document.getElementById('phone').value = c.phone;
    document.getElementById('issueDate').value = c.issueDate;
    document.getElementById('totalPrice').value = c.totalPrice;
    document.getElementById('monthlyInstallment').value = c.monthlyInstallment;
    document.getElementById('initialRemaining').value = c.currentBalance;
    // ... fill other fields
    
    document.getElementById('cancel-btn').classList.remove('hidden');
    showView('add-customer-view');
}

function openDeleteModal() {
    customerToDeleteId = currentDetailId;
    closeModal('customer-details-modal'); // Close detail modal first
    document.getElementById('delete-modal').classList.remove('hidden');
}

async function confirmDelete() {
    if(!customerToDeleteId) return;
    
    try {
        await db.collection('customers').doc(customerToDeleteId).delete();
        alert("Customer Deleted Successfully");
        closeModal('delete-modal');
        loadCustomers();
    } catch(e) {
        alert("Error deleting");
    }
}

// --- UTILS ---
function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ur' : 'en';
    const root = document.getElementById('htmlRoot');
    root.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
    
    document.getElementById('langText').innerText = currentLang === 'en' ? 'اردو' : 'English';

    // Update Text Content
    document.querySelectorAll('[data-en]').forEach(el => {
        el.innerText = el.getAttribute(`data-${currentLang}`);
    });
    // Update Placeholders
    document.querySelectorAll('input[placeholder]').forEach(el => {
        // Need to add data-en/ur to placeholders manually in HTML if needed strictly
    });
    
    // Re-render things with text
    login(); // Reset button text logic
}

function showView(viewName) {
    document.querySelectorAll('.content-view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-nav'));
    
    document.getElementById(viewName).classList.remove('hidden');
    // Highlight Nav
    // ... (Add active class logic)
}

function resetForm() {
    document.getElementById('customer-form').reset();
    document.getElementById('form-mode').value = 'add';
    document.getElementById('form-title').innerText = currentLang === 'ur' ? 'نیا کسٹمر شامل کریں' : 'Add New Customer';
    document.getElementById('cancel-btn').classList.add('hidden');
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}
