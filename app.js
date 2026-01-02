// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
    authDomain: "naeemjan-c7f46.firebaseapp.com",
    projectId: "naeemjan-c7f46",
    storageBucket: "naeemjan-c7f46.firebasestorage.app",
    messagingSenderId: "319489849314",
    appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global Variables
let currentLang = 'en';
let allData = [];
let currentDetailId = null;

// ==========================================
// 2. SECURITY & AUTH (STRICT)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // SECURITY FIX: Set persistence to NONE. 
    // This ensures logout on refresh/tab close.
    auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
    .then(() => {
        // Only check state if already in memory, otherwise force login screen
        auth.onAuthStateChanged(user => {
            if (user) {
                showDashboard();
                loadData();
            } else {
                showLogin();
            }
        });
    });

    // Language
    document.getElementById('langToggle').addEventListener('click', toggleLanguage);
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('issueDate')) document.getElementById('issueDate').value = today;
    if(document.getElementById('pay-date')) document.getElementById('pay-date').value = today;
});

function handleLogin() {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    err.innerText = "";

    auth.signInWithEmailAndPassword(email, pass)
    .catch(error => {
        btn.disabled = false;
        btn.innerText = currentLang === 'ur' ? "لاگ ان" : "Login";
        err.innerText = "Error: " + error.message;
    });
}

function handleLogout() {
    auth.signOut().then(() => {
        window.location.reload(); // Force reload to clear memory
    });
}

function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
}

// ==========================================
// 3. NAVIGATION
// ==========================================
function switchView(viewId) {
    document.querySelectorAll('.content-view').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    // Update Bottom Nav Active State
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(viewId === 'due-view') document.getElementById('nav-due').classList.add('active');
    if(viewId === 'search-view') document.getElementById('nav-search').classList.add('active');
    if(viewId === 'add-view') document.getElementById('nav-add').classList.add('active');
    if(viewId === 'list-view') document.getElementById('nav-list').classList.add('active');

    if(viewId === 'due-view') loadDueCustomers();
    if(viewId === 'list-view') loadAllCustomers();
}

// ==========================================
// 4. DATA HANDLING
// ==========================================
async function loadData() {
    try {
        const snapshot = await db.collection('customers').orderBy('updatedAt', 'desc').get();
        allData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        updateStats();
        loadDueCustomers();
    } catch (e) { console.error(e); }
}

function updateStats() {
    document.getElementById('total-customers').innerText = allData.length;
    
    let totalBal = 0;
    let dueCount = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    allData.forEach(c => {
        totalBal += (c.currentBalance || 0);
        if(c.currentBalance > 0 && c.nextDueDate) {
            let dd = new Date(c.nextDueDate);
            dd.setHours(0,0,0,0);
            if(dd <= today) dueCount++;
        }
    });

    document.getElementById('total-balance').innerText = "Rs. " + totalBal.toLocaleString();
    document.getElementById('due-today').innerText = dueCount;
}

// ==========================================
// 5. FORM & SAVING (With Photo & Old Logic)
// ==========================================
function previewImage(input, previewId) {
    const container = document.getElementById(previewId);
    container.innerHTML = "";
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            container.innerHTML = `<img src="${e.target.result}">`;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function calculateBalance() {
    const total = parseFloat(document.getElementById('totalPrice').value) || 0;
    const adv = parseFloat(document.getElementById('advance').value) || 0;
    const monthly = parseFloat(document.getElementById('monthlyInstallment').value) || 0;
    const oldMonths = parseFloat(document.getElementById('pastPaidMonths').value) || 0;
    
    // NEW LOGIC: Deduct Advance AND Old Paid Installments
    let oldPaidAmount = oldMonths * monthly;
    let remaining = total - adv - oldPaidAmount;
    
    if(remaining < 0) remaining = 0;
    document.getElementById('currentBalance').value = remaining;
}

async function saveCustomer() {
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    const mode = document.getElementById('form-mode').value;
    const id = mode === 'edit' ? document.getElementById('original-id').value : document.getElementById('accountId').value;

    // Validation
    if(!id || !document.getElementById('buyerName').value) {
        alert("Account ID and Name are required");
        btn.disabled = false; return;
    }

    // Image Handling (Base64)
    let photoCust = null;
    let photoCnic = null;

    const fileCust = document.getElementById('photo-customer').files[0];
    const fileCnic = document.getElementById('photo-cnic').files[0];

    // Helper to read file
    const readFile = (file) => new Promise((resolve) => {
        if(!file) resolve(null);
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });

    if(fileCust) photoCust = await readFile(fileCust);
    if(fileCnic) photoCnic = await readFile(fileCnic);

    // If editing, keep old photos if no new ones selected
    if(mode === 'edit') {
        const oldData = allData.find(x => x.id === id);
        if(!photoCust && oldData.photoCustomer) photoCust = oldData.photoCustomer;
        if(!photoCnic && oldData.photoCnic) photoCnic = oldData.photoCnic;
    }

    // Logic for Dates
    const issueDate = document.getElementById('issueDate').value;
    const oldMonths = parseFloat(document.getElementById('pastPaidMonths').value) || 0;
    
    // Calculate Next Due Date: Issue Date + Old Months + 1
    let nextDue = new Date(issueDate);
    nextDue.setMonth(nextDue.getMonth() + oldMonths + 1);

    const customerData = {
        accountId: id,
        issueDate: issueDate,
        buyerName: document.getElementById('buyerName').value,
        fatherName: document.getElementById('fatherName').value,
        phone: document.getElementById('phone').value,
        profession: document.getElementById('profession').value,
        homeAddress: document.getElementById('homeAddress').value,
        officeAddress: document.getElementById('officeAddress').value,
        items: document.getElementById('items').value,
        modelNumber: document.getElementById('modelNumber').value,
        totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
        advance: parseFloat(document.getElementById('advance').value) || 0,
        monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value) || 0,
        pastPaidMonths: oldMonths, // Important for history
        currentBalance: parseFloat(document.getElementById('currentBalance').value) || 0,
        g1Name: document.getElementById('g1Name').value,
        g2Name: document.getElementById('g2Name').value,
        photoCustomer: photoCust,
        photoCnic: photoCnic,
        nextDueDate: nextDue.toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('customers').doc(id).set(customerData, {merge: true});
        alert("Success!");
        resetForm();
        loadData();
        switchView('due-view');
    } catch(e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Customer";
    }
}

function resetForm() {
    document.getElementById('customer-form').reset();
    document.getElementById('form-mode').value = 'add';
    document.getElementById('form-heading').innerText = currentLang === 'ur' ? 'نیا کسٹمر شامل کریں' : 'Add New Customer';
    document.getElementById('preview-customer').innerHTML = "";
    document.getElementById('preview-cnic').innerHTML = "";
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
}

// ==========================================
// 6. VIEWS & TABLES
// ==========================================
function loadDueCustomers() {
    const tbody = document.getElementById('due-body');
    tbody.innerHTML = "";
    const today = new Date();
    today.setHours(0,0,0,0);

    const dueList = allData.filter(c => {
        if(c.currentBalance <= 0 || !c.nextDueDate) return false;
        let d = new Date(c.nextDueDate);
        d.setHours(0,0,0,0);
        return d <= today;
    });

    if(dueList.length === 0) document.getElementById('no-due-msg').classList.remove('hidden');
    else document.getElementById('no-due-msg').classList.add('hidden');

    dueList.forEach(c => {
        let dDate = new Date(c.nextDueDate).toLocaleDateString();
        let row = `<tr>
            <td data-en="Account ID" data-ur="آئی ڈی"><b>${c.accountId}</b></td>
            <td data-en="Name" data-ur="نام">${c.buyerName}</td>
            <td data-en="Phone" data-ur="فون"><a href="tel:${c.phone}">${c.phone}</a></td>
            <td data-en="Inst." data-ur="قسط">Rs. ${c.monthlyInstallment}</td>
            <td data-en="Date" data-ur="تاریخ" class="text-red">${dDate}</td>
            <td>
                <button class="btn-action btn-pay" onclick="openPaymentModal('${c.id}')">Pay</button>
                <button class="btn-action btn-view" onclick="openDetails('${c.id}')">View</button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function loadAllCustomers() {
    const tbody = document.getElementById('all-body');
    tbody.innerHTML = "";
    const filter = document.getElementById('filter-input').value.toLowerCase();

    allData.forEach(c => {
        if(filter && !JSON.stringify(c).toLowerCase().includes(filter)) return;
        
        let row = `<tr>
            <td data-en="ID" data-ur="آئی ڈی">${c.accountId}</td>
            <td data-en="Name" data-ur="نام">${c.buyerName}</td>
            <td data-en="Phone" data-ur="فون">${c.phone}</td>
            <td data-en="Bal" data-ur="بقایا">Rs. ${c.currentBalance}</td>
            <td>
                <button class="btn-action btn-view" onclick="openDetails('${c.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn-action btn-delete" onclick="openDetails('${c.id}')"><i class="fas fa-edit"></i></button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
    
    document.getElementById('filter-input').onkeyup = loadAllCustomers;
}

// ==========================================
// 7. SEARCH & DETAILS
// ==========================================
function performSearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const type = document.querySelector('input[name="searchType"]:checked').value;
    const grid = document.getElementById('search-results');
    grid.innerHTML = "";

    const results = allData.filter(c => {
        if(type === 'id') return c.accountId.toString().toLowerCase() === q;
        if(type === 'name') return c.buyerName.toLowerCase().includes(q);
        if(type === 'phone') return c.phone && c.phone.includes(q);
    });

    if(results.length === 0) grid.innerHTML = "<p>No results found</p>";

    results.forEach(c => {
        let card = `<div class="stat-box" style="display:block;">
            <div style="display:flex; justify-content:space-between;">
                <h4>${c.buyerName}</h4>
                <span class="status-badge">${c.accountId}</span>
            </div>
            <p>Phone: ${c.phone}</p>
            <p>Balance: <b>Rs. ${c.currentBalance}</b></p>
            <div style="margin-top:10px; display:flex; gap:10px;">
                <button class="btn-action btn-pay" onclick="openPaymentModal('${c.id}')" style="flex:1;">Pay</button>
                <button class="btn-action btn-view" onclick="openDetails('${c.id}')" style="flex:1;">View</button>
            </div>
        </div>`;
        grid.innerHTML += card;
    });
}

function openDetails(id) {
    currentDetailId = id;
    const c = allData.find(x => x.id === id);
    if(!c) return;

    // Fill Info
    document.getElementById('d-id').innerText = c.accountId;
    document.getElementById('d-name').innerText = c.buyerName;
    document.getElementById('d-father').innerText = c.fatherName || '-';
    document.getElementById('d-phone').innerText = c.phone;
    document.getElementById('d-address').innerText = c.homeAddress || '-';
    document.getElementById('d-office').innerText = c.officeAddress || '-';
    document.getElementById('d-guarantors').innerText = `${c.g1Name || '-'} / ${c.g2Name || '-'}`;

    document.getElementById('d-total').innerText = c.totalPrice;
    document.getElementById('d-remaining').innerText = c.currentBalance;
    const paid = c.totalPrice - c.currentBalance;
    document.getElementById('d-paid').innerText = paid;

    // Images
    const imgC = document.getElementById('detail-photo-customer');
    const imgID = document.getElementById('detail-photo-cnic');
    imgC.innerHTML = c.photoCustomer ? `<img src="${c.photoCustomer}">` : "No Photo";
    imgID.innerHTML = c.photoCnic ? `<img src="${c.photoCnic}">` : "No Photo";

    // GENERATE HISTORY LEDGER (With Old Logic)
    const tbody = document.getElementById('ledger-body');
    tbody.innerHTML = "";
    
    // 1. Show Advance
    tbody.innerHTML += `<tr><td>Start</td><td><span class="status-badge">Advance</span></td><td>Rs. ${c.advance}</td></tr>`;

    // 2. Show Old Paid Months (if any)
    const oldMonths = c.pastPaidMonths || 0;
    if(oldMonths > 0) {
        tbody.innerHTML += `<tr>
            <td>Previous History</td>
            <td><span class="status-badge" style="background:purple;">Old Record</span></td>
            <td>${oldMonths} Months Paid</td>
        </tr>`;
    }

    // 3. Show Real Payments (From subcollection ideally, but simplified logic here)
    // Note: To show full history, we need to fetch the subcollection 'payments'
    db.collection('customers').doc(id).collection('payments').orderBy('date').get().then(snap => {
        snap.forEach(doc => {
            const p = doc.data();
            tbody.innerHTML += `<tr>
                <td>${p.date}</td>
                <td><span class="status-badge">Received</span></td>
                <td>Rs. ${p.amount}</td>
            </tr>`;
        });
    });

    document.getElementById('details-modal').classList.remove('hidden');
}

// ==========================================
// 8. PAYMENT & ACTIONS
// ==========================================
function openPaymentModal(id) {
    currentDetailId = id;
    const c = allData.find(x => x.id === id);
    document.getElementById('pay-name').innerText = c.buyerName;
    document.getElementById('pay-balance').innerText = c.currentBalance;
    document.getElementById('pay-amount').value = c.monthlyInstallment;
    document.getElementById('payment-modal').classList.remove('hidden');
}

function submitPayment() {
    const amt = parseFloat(document.getElementById('pay-amount').value);
    const date = document.getElementById('pay-date').value;
    const note = document.getElementById('pay-note').value;
    const c = allData.find(x => x.id === currentDetailId);

    if(!amt || amt <= 0) return alert("Invalid Amount");

    const newBal = c.currentBalance - amt;
    
    // Increment Due Date by 1 Month
    let nextDate = new Date(c.nextDueDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    db.collection('customers').doc(currentDetailId).update({
        currentBalance: newBal,
        nextDueDate: nextDate.toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        // Add Record
        return db.collection('customers').doc(currentDetailId).collection('payments').add({
            amount: amt, date: date, note: note
        });
    }).then(() => {
        alert("Payment Saved");
        closeModal('payment-modal');
        loadData();
    }).catch(e => alert(e.message));
}

function editCustomerFromModal() {
    closeModal('details-modal');
    const c = allData.find(x => x.id === currentDetailId);
    
    document.getElementById('form-mode').value = 'edit';
    document.getElementById('original-id').value = c.id;
    document.getElementById('form-heading').innerText = "Edit Customer";
    
    document.getElementById('accountId').value = c.accountId;
    document.getElementById('buyerName').value = c.buyerName;
    document.getElementById('phone').value = c.phone;
    // ... Fill rest of the fields similarly ...
    // Since you asked for COMPLETE code, I'm assuming you can map the rest 
    // based on the variable names above, but essential ones are here.
    document.getElementById('fatherName').value = c.fatherName || '';
    document.getElementById('profession').value = c.profession || '';
    document.getElementById('homeAddress').value = c.homeAddress || '';
    document.getElementById('officeAddress').value = c.officeAddress || '';
    document.getElementById('items').value = c.items || '';
    document.getElementById('modelNumber').value = c.modelNumber || '';
    document.getElementById('totalPrice').value = c.totalPrice;
    document.getElementById('advance').value = c.advance;
    document.getElementById('monthlyInstallment').value = c.monthlyInstallment;
    document.getElementById('pastPaidMonths').value = c.pastPaidMonths || 0;
    document.getElementById('currentBalance').value = c.currentBalance;
    document.getElementById('g1Name').value = c.g1Name || '';
    document.getElementById('g2Name').value = c.g2Name || '';
    document.getElementById('issueDate').value = c.issueDate;

    switchView('add-view');
}

function deleteCustomerFromModal() {
    if(confirm("Are you sure you want to delete this customer?")) {
        db.collection('customers').doc(currentDetailId).delete()
        .then(() => {
            alert("Deleted");
            closeModal('details-modal');
            loadData();
        });
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ur' : 'en';
    const root = document.getElementById('htmlRoot');
    root.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
    
    document.querySelectorAll('[data-en]').forEach(el => {
        el.innerText = el.getAttribute(`data-${currentLang}`);
    });
}
