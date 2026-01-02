// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
// Yahan apni Configuration wapis check karein ke theek hai
const firebaseConfig = {
    apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
    authDomain: "naeemjan-c7f46.firebaseapp.com",
    projectId: "naeemjan-c7f46",
    storageBucket: "naeemjan-c7f46.firebasestorage.app",
    messagingSenderId: "319489849314",
    appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};

// Initialize Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global Variables
let currentLang = 'en';
let allData = [];
let currentDetailId = null;

// ==========================================
// 2. SECURITY & LOGIN LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Page load hote hi logout kar do (Security)
    auth.signOut().then(() => {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    });

    document.getElementById('langToggle').addEventListener('click', toggleLanguage);
    
    // Dates set karo
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('issueDate')) document.getElementById('issueDate').value = today;
});

function handleLogin() {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');

    if(!email || !pass) {
        err.innerText = "Email aur Password likhein";
        return;
    }

    btn.disabled = true;
    btn.innerText = "Checking...";
    err.innerText = "";

    // Persistence NONE rakha hai taake refresh par logout ho jaye
    auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
    .then(() => {
        return auth.signInWithEmailAndPassword(email, pass);
    })
    .then((userCredential) => {
        // Login Kamyab
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        loadData(); // <--- AB DATA LOAD HOGA
    })
    .catch((error) => {
        btn.disabled = false;
        btn.innerText = "Login Securely";
        err.innerText = "Login Failed: " + error.message;
    });
}

function handleLogout() {
    auth.signOut().then(() => {
        window.location.reload();
    });
}

// ==========================================
// 3. IMAGE AUTO-COMPRESS (FIXED FOR DATABASE)
// ==========================================
function compressAndPreview(input, previewId) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function () {
            const canvas = document.createElement('canvas');
            // Hum size ko 500px tak chota kar rahe hain taake Database mein save ho sake
            const maxWidth = 500; 
            const scaleSize = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Quality 0.6 kar di hai (Low size, Good visibility)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

            document.getElementById(previewId).innerHTML = `<img src="${dataUrl}">`;
            input.dataset.compressed = dataUrl;
        }
    }
}

// ==========================================
// 4. DATA LOADING (FIXED - NO SORTING ISSUE)
// ==========================================
async function loadData() {
    try {
        // Maine .orderBy hata diya hai taake "Index" ka error na aaye aur data foran dikhe
        const snapshot = await db.collection('customers').get();
        
        allData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        // Data aane ke baad UI update karo
        updateStats();
        loadDueCustomers(); 
        loadAllCustomers(); 
        
    } catch (e) { 
        console.error("Data Load Error:", e);
        alert("Data load nahi hua: " + e.message);
    }
}

function updateStats() {
    document.getElementById('total-customers').innerText = allData.length;
    
    let dueCount = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    allData.forEach(c => {
        if(c.currentBalance > 0 && c.nextDueDate) {
            let dd = new Date(c.nextDueDate);
            dd.setHours(0,0,0,0);
            if(dd <= today) dueCount++;
        }
    });
    document.getElementById('due-today').innerText = dueCount;
}

// ==========================================
// 5. BUTTONS & ACTIONS (FIXED)
// ==========================================

// Ye function "Due List" ko render karta hai
function loadDueCustomers() {
    const tbody = document.getElementById('due-body');
    tbody.innerHTML = "";
    const today = new Date();
    today.setHours(0,0,0,0);

    const dueList = allData.filter(c => {
        if(c.currentBalance <= 0 || !c.nextDueDate) return false;
        let d = new Date(c.nextDueDate);
        d.setHours(0,0,0,0);
        return d <= today; // Jo aaj ya pehle ki dates hain
    });

    if(dueList.length === 0) document.getElementById('no-due-msg').classList.remove('hidden');
    else document.getElementById('no-due-msg').classList.add('hidden');

    dueList.forEach(c => {
        // BUTTON FIX: Single quotes ka khayal rakha gaya hai
        const btnHtml = `
        <button class="btn-quick-pay" type="button" onclick="quickPay('${c.id}', ${c.monthlyInstallment})">
            <i class="fas fa-check-circle"></i> 
            ${currentLang === 'ur' ? '1 مہینہ ادا کریں' : '1 Month Paid'}
        </button>`;

        let row = `<tr>
            <td data-en="ID" data-ur="آئی ڈی"><b>${c.accountId}</b></td>
            <td data-en="Name" data-ur="نام">${c.buyerName}</td>
            <td data-en="Phone" data-ur="فون"><a href="tel:${c.phone}">${c.phone}</a></td>
            <td data-en="Inst." data-ur="قسط">Rs. ${c.monthlyInstallment}</td>
            <td data-en="Action" data-ur="ایکشن">${btnHtml}</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// Ye function "Green Button" dabane par chalta hai
async function quickPay(id, amount) {
    // Confirmation alert
    if(!confirm("Kya Payment Wasool Ho Gayi Hai? Rs. " + amount)) return;

    const c = allData.find(x => x.id === id);
    if (!c) { alert("Customer not found in memory"); return; }

    const newBal = parseFloat(c.currentBalance) - parseFloat(amount);
    
    // Date ko 1 mahina agay barha do
    let nextDate = new Date(c.nextDueDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    const todayStr = new Date().toISOString().split('T')[0];

    try {
        // Database update karo
        await db.collection('customers').doc(id).update({
            currentBalance: newBal,
            nextDueDate: nextDate.toISOString(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // History mein likho
        await db.collection('customers').doc(id).collection('payments').add({
            amount: parseFloat(amount),
            date: todayStr,
            note: "Quick Pay Button Clicked"
        });

        alert("Payment Jama Ho Gayi!");
        loadData(); // Screen refresh karo
    } catch(e) {
        alert("Error: " + e.message);
        console.error(e);
    }
}

// ==========================================
// 6. SEARCH & ALL LIST
// ==========================================
function performSearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const grid = document.getElementById('search-results');
    grid.innerHTML = "";

    const results = allData.filter(c => {
        return c.accountId.toString().toLowerCase().includes(q) || 
               c.buyerName.toLowerCase().includes(q) || 
               (c.phone && c.phone.includes(q));
    });

    results.forEach(c => {
        // Search mein bhi Green Button lagaya hai
        const btnHtml = c.currentBalance > 0 ? `
        <button class="btn-quick-pay" style="width:100%; justify-content:center; margin-top:10px;" onclick="quickPay('${c.id}', ${c.monthlyInstallment})">
            <i class="fas fa-check-circle"></i> 1 Month Paid (Rs. ${c.monthlyInstallment})
        </button>` : '<p style="color:green; text-align:center;">Fully Paid</p>';

        let card = `<div class="stat-box" style="display:block; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between;">
                <h4>${c.buyerName}</h4>
                <span class="status-badge">${c.accountId}</span>
            </div>
            <p>Phone: ${c.phone}</p>
            <p>Balance: <b>Rs. ${c.currentBalance}</b></p>
            ${btnHtml}
            <button class="btn-secondary" style="width:100%; margin-top:5px;" onclick="openDetails('${c.id}')">View Details</button>
        </div>`;
        grid.innerHTML += card;
    });
    
    if(results.length === 0) grid.innerHTML = "<p>Koi customer nahi mila.</p>";
}

function loadAllCustomers() {
    const tbody = document.getElementById('all-body');
    tbody.innerHTML = "";
    
    allData.forEach(c => {
        let row = `<tr>
            <td data-en="ID" data-ur="آئی ڈی">${c.accountId}</td>
            <td data-en="Name" data-ur="نام">${c.buyerName}</td>
            <td data-en="Balance" data-ur="بقایا">Rs. ${c.currentBalance}</td>
            <td data-en="Action" data-ur="ایکشن">
                <button class="btn-edit" onclick="openDetails('${c.id}')">View</button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// ==========================================
// 7. SAVE CUSTOMER
// ==========================================
function calculateBalance() {
    const total = parseFloat(document.getElementById('totalPrice').value) || 0;
    const adv = parseFloat(document.getElementById('advance').value) || 0;
    const monthly = parseFloat(document.getElementById('monthlyInstallment').value) || 0;
    const oldMonths = parseFloat(document.getElementById('pastPaidMonths').value) || 0;
    
    let paid = (oldMonths * monthly) + adv;
    let bal = total - paid;
    if(bal < 0) bal = 0;
    document.getElementById('currentBalance').value = bal;
}

async function saveCustomer() {
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const mode = document.getElementById('form-mode').value;
    const id = mode === 'edit' ? document.getElementById('original-id').value : document.getElementById('accountId').value;

    if(!id || !document.getElementById('buyerName').value) {
        alert("ID aur Name likhna zaroori hai");
        btn.disabled = false; return;
    }

    // Images uthao (Compressed wali)
    const imgCustInput = document.getElementById('photo-customer');
    const imgCnicInput = document.getElementById('photo-cnic');
    
    let photoCust = imgCustInput.dataset.compressed || null;
    let photoCnic = imgCnicInput.dataset.compressed || null;

    if(mode === 'edit') {
        const old = allData.find(x => x.id === id);
        if(!photoCust && old) photoCust = old.photoCustomer;
        if(!photoCnic && old) photoCnic = old.photoCnic;
    }

    const issueDate = document.getElementById('issueDate').value;
    const oldMonths = parseFloat(document.getElementById('pastPaidMonths').value) || 0;
    let nextDue = new Date(issueDate);
    nextDue.setMonth(nextDue.getMonth() + oldMonths + 1);

    const data = {
        accountId: id,
        buyerName: document.getElementById('buyerName').value,
        phone: document.getElementById('phone').value,
        fatherName: document.getElementById('fatherName').value,
        homeAddress: document.getElementById('homeAddress').value,
        items: document.getElementById('items').value,
        totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
        advance: parseFloat(document.getElementById('advance').value) || 0,
        monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value) || 0,
        pastPaidMonths: oldMonths,
        currentBalance: parseFloat(document.getElementById('currentBalance').value) || 0,
        g1Name: document.getElementById('g1Name').value,
        g2Name: document.getElementById('g2Name').value,
        photoCustomer: photoCust,
        photoCnic: photoCnic,
        issueDate: issueDate,
        nextDueDate: nextDue.toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('customers').doc(id).set(data, {merge: true});
        alert("Customer Save Ho Gaya!");
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

// ==========================================
// 8. OTHER FUNCTIONS
// ==========================================
function switchView(viewId) {
    document.querySelectorAll('.content-view').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(viewId === 'due-view') document.getElementById('nav-due').classList.add('active');
    if(viewId === 'search-view') document.getElementById('nav-search').classList.add('active');
    if(viewId === 'add-view') document.getElementById('nav-add').classList.add('active');
    if(viewId === 'list-view') document.getElementById('nav-list').classList.add('active');
}

function resetForm() {
    document.getElementById('customer-form').reset();
    document.getElementById('form-mode').value = 'add';
    document.getElementById('preview-customer').innerHTML = "";
    document.getElementById('preview-cnic').innerHTML = "";
    delete document.getElementById('photo-customer').dataset.compressed;
    delete document.getElementById('photo-cnic').dataset.compressed;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
}

function openDetails(id) {
    currentDetailId = id;
    const c = allData.find(x => x.id === id);
    if(!c) return;

    let infoHtml = `
        <div class="info-row"><strong>ID:</strong> <span>${c.accountId}</span></div>
        <div class="info-row"><strong>Name:</strong> <span>${c.buyerName}</span></div>
        <div class="info-row"><strong>Phone:</strong> <span><a href="tel:${c.phone}">${c.phone}</a></span></div>
        <div class="info-row"><strong>Father:</strong> <span>${c.fatherName || '-'}</span></div>
        <div class="info-row"><strong>Address:</strong> <span>${c.homeAddress || '-'}</span></div>
        <div class="info-row"><strong>Total Price:</strong> <span>${c.totalPrice}</span></div>
        <div class="info-row"><strong>Paid (Adv+Old):</strong> <span>${(c.pastPaidMonths*c.monthlyInstallment)+c.advance}</span></div>
        <div class="info-row"><strong>Remaining:</strong> <span style="color:red; font-weight:bold;">${c.currentBalance}</span></div>
    `;
    document.getElementById('d-info').innerHTML = infoHtml;

    document.getElementById('d-img-cust').innerHTML = c.photoCustomer ? `<img src="${c.photoCustomer}">` : "No Photo";
    document.getElementById('d-img-cnic').innerHTML = c.photoCnic ? `<img src="${c.photoCnic}">` : "No Photo";

    const tbody = document.getElementById('ledger-body');
    tbody.innerHTML = "";
    tbody.innerHTML += `<tr><td>Start</td><td>Advance Paid (${c.advance})</td></tr>`;
    
    db.collection('customers').doc(id).collection('payments').orderBy('date', 'desc').get().then(snap => {
        if(snap.empty) {
            tbody.innerHTML += `<tr><td colspan="2">No recent payments</td></tr>`;
        }
        snap.forEach(doc => {
            const p = doc.data();
            tbody.innerHTML += `<tr><td>${p.date}</td><td style="color:green;">Received Rs. ${p.amount}</td></tr>`;
        });
    });

    document.getElementById('details-modal').classList.remove('hidden');
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
