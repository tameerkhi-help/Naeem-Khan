// ==========================================
// 1. CONFIGURATION
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

// Global State
let allData = [];
let currentProfileId = null; // Important for Delete

// ==========================================
// 2. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Set default date
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('inp-date')) document.getElementById('inp-date').value = today;

    // Check Login State
    auth.onAuthStateChanged(user => {
        if (user) {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            loadData();
        } else {
            document.getElementById('login-section').classList.remove('hidden');
            document.getElementById('dashboard-section').classList.add('hidden');
        }
    });
});

// ==========================================
// 3. CORE FUNCTIONS (Login/Load)
// ==========================================
function handleLogin() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    showLoading(true, "Logging in...");
    
    auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
        showLoading(false);
    })
    .catch(err => {
        showLoading(false);
        document.getElementById('login-error').innerText = err.message;
    });
}

function handleLogout() {
    auth.signOut().then(() => location.reload());
}

async function loadData() {
    showLoading(true, "Loading Data...");
    try {
        const snap = await db.collection('customers').orderBy('updatedAt', 'desc').get();
        allData = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        updateStats();
        renderDueList();
        showLoading(false);
    } catch(e) {
        console.error(e);
        showLoading(false);
    }
}

// ==========================================
// 4. RENDERING LISTS
// ==========================================
function renderDueList() {
    const container = document.getElementById('due-list-container');
    container.innerHTML = "";
    const today = new Date();
    today.setHours(0,0,0,0);

    const dueList = allData.filter(c => {
        if(c.balance <= 0) return false;
        let d = new Date(c.nextDueDate);
        d.setHours(0,0,0,0);
        return d <= today;
    });

    document.getElementById('no-due-msg').classList.toggle('hidden', dueList.length > 0);

    dueList.forEach(c => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            <div class="card-info">
                <h4>${c.name} <small>(${c.accountId})</small></h4>
                <p>Phone: ${c.phone}</p>
                <p>Balance: <b style="color:red">Rs. ${c.balance}</b></p>
            </div>
            <div class="card-actions">
                <button class="btn-quick-pay" onclick="quickPay('${c.id}', ${c.installment})">
                    <i class="fas fa-check"></i> Pay 1
                </button>
                <button class="btn-view" onclick="openProfile('${c.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function performSearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const container = document.getElementById('search-results');
    container.innerHTML = "";
    
    if(q.length < 1) return;

    const results = allData.filter(c => {
        return c.name.toLowerCase().includes(q) || 
               c.accountId.toString().toLowerCase().includes(q) || 
               c.phone.includes(q);
    });

    results.forEach(c => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            <div class="card-info">
                <h4>${c.name}</h4>
                <p>Bal: Rs. ${c.balance}</p>
            </div>
            <button class="btn-view" onclick="openProfile('${c.id}')">View</button>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 5. PROFILE & DELETE (FIXED)
// ==========================================
function openProfile(id) {
    currentProfileId = id; // Store ID globally for delete
    const c = allData.find(x => x.id === id);
    if(!c) return;

    // Set Images (Contain Mode is in CSS)
    document.getElementById('img-cust-display').src = c.photoCustomer || '';
    document.getElementById('img-cnic-display').src = c.photoCnic || '';

    // Set Info
    const paidTotal = (c.oldPaid * c.installment) + c.advance;
    document.getElementById('profile-details').innerHTML = `
        <div class="profile-row"><span>Name:</span> <b>${c.name}</b></div>
        <div class="profile-row"><span>ID:</span> <b>${c.accountId}</b></div>
        <div class="profile-row"><span>Phone:</span> <a href="tel:${c.phone}">${c.phone}</a></div>
        <div class="profile-row"><span>Address:</span> <span>${c.address || '-'}</span></div>
        <div class="profile-row"><span>Total Price:</span> <b>${c.totalPrice}</b></div>
        <div class="profile-row"><span>Paid (Adv+Old):</span> <b style="color:green">${paidTotal}</b></div>
        <div class="profile-row"><span>Remaining:</span> <b style="color:red">${c.balance}</b></div>
    `;

    // Load History
    const hList = document.getElementById('history-list');
    hList.innerHTML = `
        <div class="history-item"><span>Start (Advance)</span> <span>${c.advance}</span></div>
    `;
    
    // Fetch Payments
    db.collection('customers').doc(id).collection('payments').orderBy('date', 'desc').get()
    .then(snap => {
        snap.forEach(doc => {
            const p = doc.data();
            hList.innerHTML += `
                <div class="history-item paid">
                    <span>${p.date}</span> <span>Rec: ${p.amount}</span>
                </div>
            `;
        });
    });

    document.getElementById('profile-modal').classList.remove('hidden');
}

// DELETE FUNCTION
async function deleteCustomer() {
    if(!currentProfileId) {
        alert("Error: No customer selected");
        return;
    }

    if(!confirm("Are you sure? This will delete the customer permanently!")) return;

    showLoading(true, "Deleting...");
    
    try {
        await db.collection('customers').doc(currentProfileId).delete();
        showLoading(false);
        closeModal();
        loadData(); // Refresh list
        alert("Customer Deleted Successfully!");
    } catch(e) {
        showLoading(false);
        alert("Delete Failed! Check Database Rules. Error: " + e.message);
    }
}

// ==========================================
// 6. SAVE & UPDATE (Fast Loading)
// ==========================================
async function saveCustomer() {
    const btn = document.querySelector('button[type="submit"]');
    btn.disabled = true;
    showLoading(true, "Saving & Compressing...");

    const id = document.getElementById('edit-id').value || db.collection('customers').doc().id;
    const isEdit = document.getElementById('edit-id').value ? true : false;

    // Get Inputs
    const data = {
        accountId: document.getElementById('inp-id').value,
        name: document.getElementById('inp-name').value,
        phone: document.getElementById('inp-phone').value,
        father: document.getElementById('inp-father').value,
        address: document.getElementById('inp-address').value,
        item: document.getElementById('inp-item').value,
        totalPrice: Number(document.getElementById('inp-total').value),
        advance: Number(document.getElementById('inp-advance').value),
        installment: Number(document.getElementById('inp-monthly').value),
        oldPaid: Number(document.getElementById('inp-old').value),
        balance: Number(document.getElementById('inp-balance').value),
        issueDate: document.getElementById('inp-date').value,
        nextDueDate: getNextDate(document.getElementById('inp-date').value),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Handle Images
    const fileCust = document.getElementById('file-customer').files[0];
    const fileCnic = document.getElementById('file-cnic').files[0];

    if(fileCust) data.photoCustomer = await compressImage(fileCust);
    else if(isEdit && currentProfileId) {
        const old = allData.find(x => x.id === currentProfileId);
        if(old) data.photoCustomer = old.photoCustomer;
    }

    if(fileCnic) data.photoCnic = await compressImage(fileCnic);
    else if(isEdit && currentProfileId) {
        const old = allData.find(x => x.id === currentProfileId);
        if(old) data.photoCnic = old.photoCnic;
    }

    try {
        await db.collection('customers').doc(id).set(data, {merge: true});
        showLoading(false);
        resetForm();
        switchView('due-view');
        loadData();
    } catch(e) {
        showLoading(false);
        alert("Error: " + e.message);
        btn.disabled = false;
    }
}

// FAST COMPRESSION
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 600; // Smaller size for speed
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // 0.6 quality is good enough for records
                resolve(canvas.toDataURL('image/jpeg', 0.6)); 
            };
        };
    });
}

// ==========================================
// 7. UTILITIES
// ==========================================
async function quickPay(id, amount) {
    if(!confirm(`Receive Payment of Rs. ${amount}?`)) return;
    showLoading(true, "Processing...");
    
    const c = allData.find(x => x.id === id);
    const newBal = c.balance - amount;
    const nextDate = new Date(c.nextDueDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    try {
        await db.collection('customers').doc(id).update({
            balance: newBal,
            nextDueDate: nextDate.toISOString()
        });
        
        await db.collection('customers').doc(id).collection('payments').add({
            amount: amount,
            date: new Date().toISOString().split('T')[0]
        });
        
        showLoading(false);
        loadData();
    } catch(e) {
        showLoading(false);
        alert(e.message);
    }
}

function calcBalance() {
    const total = Number(document.getElementById('inp-total').value);
    const adv = Number(document.getElementById('inp-advance').value);
    const old = Number(document.getElementById('inp-old').value);
    const inst = Number(document.getElementById('inp-monthly').value);
    
    const paid = adv + (old * inst);
    document.getElementById('inp-balance').value = total - paid;
}

function getNextDate(dateStr) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
}

function previewImage(input, divId) {
    const file = input.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById(divId).innerHTML = `<img src="${e.target.result}">`;
        }
        reader.readAsDataURL(file);
    }
}

function switchView(id) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    if(id==='due-view') document.getElementById('btn-due').classList.add('active');
    if(id==='search-view') document.getElementById('btn-search').classList.add('active');
    if(id==='add-view') document.getElementById('btn-add').classList.add('active');
}

function updateStats() {
    document.getElementById('total-customers').innerText = allData.length;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = allData.filter(c => {
        let d = new Date(c.nextDueDate);
        d.setHours(0,0,0,0);
        return d <= today && c.balance > 0;
    }).length;
    document.getElementById('due-today').innerText = due;
}

function showLoading(show, text) {
    const el = document.getElementById('loading-overlay');
    if(show) {
        el.classList.remove('hidden');
        document.getElementById('loading-text').innerText = text || "Loading...";
    } else {
        el.classList.add('hidden');
    }
}

function closeModal() { document.getElementById('profile-modal').classList.add('hidden'); }
function resetForm() { 
    document.getElementById('customer-form').reset(); 
    document.getElementById('edit-id').value = "";
    document.getElementById('prev-cust').innerHTML = "";
    document.getElementById('prev-cnic').innerHTML = "";
}

function zoomImage(imgId) {
    const src = document.getElementById(imgId).src;
    if(src && src.includes('data:image')) {
        document.getElementById('zoomed-image').src = src;
        document.getElementById('zoom-modal').classList.remove('hidden');
    }
}
