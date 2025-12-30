// ==============================================
// 1. FIREBASE CONFIG (Paste your own here)
// ==============================================
const firebaseConfig = {
  apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
  authDomain: "naeemjan-c7f46.firebaseapp.com",
  projectId: "naeemjan-c7f46",
  storageBucket: "naeemjan-c7f46.firebasestorage.app",
  messagingSenderId: "319489849314",
  appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==============================================
// 2. AUTH & NAVIGATION
// ==============================================
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        loadDueCustomers(); // Load the list immediately on login
    } else {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    }
});

function login() {
    const e = document.getElementById('admin-email').value;
    const p = document.getElementById('admin-password').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert("Login Failed: " + err.message));
}
function logout() { auth.signOut(); }

function showView(viewId) {
    document.querySelectorAll('.content-view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    // Update nav buttons
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active-nav'));
    const btn = document.querySelector(`button[onclick="showView('${viewId}')"]`);
    if(btn) btn.classList.add('active-nav');

    if(viewId === 'due-list-view') loadDueCustomers();
}

// ==============================================
// 3. IMAGE COMPRESSION (Crucial for Database Storage)
// ==============================================
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 400; // Limit width to 400px
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Convert to JPEG at 0.6 quality (High compression)
                resolve(canvas.toDataURL('image/jpeg', 0.6)); 
            };
        };
        reader.onerror = error => reject(error);
    });
}

// ==============================================
// 4. ADD CUSTOMER
// ==============================================
function calculateRemaining() {
    const price = parseFloat(document.getElementById('totalPrice').value) || 0;
    const adv = parseFloat(document.getElementById('advance').value) || 0;
    document.getElementById('initialRemaining').value = price - adv;
}

document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true; saveBtn.textContent = "Processing...";

    const accountId = document.getElementById('accountId').value.trim();

    // Handle Images
    let photoBase64 = "";
    let cnicBase64 = "";
    const pInput = document.getElementById('customerPhotoInput');
    const cInput = document.getElementById('cnicPhotoInput');

    try {
        if(pInput.files.length > 0) photoBase64 = await compressImage(pInput.files[0]);
        if(cInput.files.length > 0) cnicBase64 = await compressImage(cInput.files[0]);
    } catch(err) {
        alert("Image Error: " + err);
        saveBtn.disabled = false;
        return;
    }

    // Set Next Due Date (1 month from today)
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + 1);

    const data = {
        accountId: accountId,
        buyerName: document.getElementById('buyerName').value,
        phone: document.getElementById('phone').value,
        fatherName: document.getElementById('fatherName').value,
        profession: document.getElementById('profession').value,
        homeAddress: document.getElementById('homeAddress').value,
        officeAddress: document.getElementById('officeAddress').value,
        
        photo: photoBase64,
        cnic: cnicBase64,
        
        totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
        advance: parseFloat(document.getElementById('advance').value) || 0,
        currentBalance: parseFloat(document.getElementById('initialRemaining').value) || 0,
        monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value) || 0,
        items: document.getElementById('items').value,
        modelNumber: document.getElementById('modelNumber').value,
        
        guarantor1: document.getElementById('g1Name').value,
        guarantor2: document.getElementById('g2Name').value,
        
        nextDueDate: nextDue.toISOString(), // For sorting
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('customers').doc(accountId).set(data)
        .then(() => {
            alert("Customer Saved Successfully!");
            document.getElementById('customer-form').reset();
            showView('due-list-view');
        })
        .catch(err => alert("Error: " + err.message))
        .finally(() => { saveBtn.disabled = false; saveBtn.textContent = "Save Customer"; });
});

// ==============================================
// 5. DASHBOARD: AUTOMATIC DUE LIST
// ==============================================
function loadDueCustomers() {
    const tbody = document.getElementById('due-customers-body');
    tbody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

    // Get all customers (Client side sorting is easier for small number of users)
    db.collection('customers').get().then(snapshot => {
        tbody.innerHTML = "";
        let customers = [];
        
        snapshot.forEach(doc => customers.push(doc.data()));

        // Sort: Customers with balance > 0 first, then by Next Due Date
        customers.sort((a, b) => {
            if(a.nextDueDate < b.nextDueDate) return -1;
            if(a.nextDueDate > b.nextDueDate) return 1;
            return 0;
        });

        if(customers.length === 0) {
            document.getElementById('no-due-msg').classList.remove('hidden');
        } else {
            document.getElementById('no-due-msg').classList.add('hidden');
            customers.forEach(c => {
                if(c.currentBalance > 0) {
                    // Check if due date is passed or today
                    const dueDate = new Date(c.nextDueDate);
                    const today = new Date();
                    const isDue = dueDate <= today; 

                    // Row HTML
                    const row = `
                        <tr style="${isDue ? 'background-color:#fff3cd;' : ''}">
                            <td><b>${c.accountId}</b></td>
                            <td>${c.buyerName}</td>
                            <td>${c.phone || '-'}</td>
                            <td>${c.monthlyInstallment}</td>
                            <td style="color:red; font-weight:bold;">${c.currentBalance}</td>
                            <td>
                                <button class="btn-pay-tick" onclick="quickPay('${c.accountId}', ${c.monthlyInstallment})">
                                    <i class="fa fa-check"></i> Pay ${c.monthlyInstallment}
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                }
            });
        }
    });
}

// ==============================================
// 6. QUICK PAY (TICK BUTTON)
// ==============================================
function quickPay(id, amount) {
    if(!confirm(`Confirm payment of ${amount} for Account ${id}?`)) return;

    const customerRef = db.collection('customers').doc(id);

    db.runTransaction(async (transaction) => {
        const doc = await transaction.get(customerRef);
        if (!doc.exists) throw "Document does not exist!";
        
        const data = doc.data();
        const newBalance = data.currentBalance - amount;
        
        // Calculate new Due Date (Add 1 Month to current NextDueDate)
        let nextDate = new Date(data.nextDueDate);
        nextDate.setMonth(nextDate.getMonth() + 1);

        transaction.update(customerRef, {
            currentBalance: newBalance,
            nextDueDate: nextDate.toISOString()
        });

        // Add to history sub-collection
        const payRef = customerRef.collection('payments').doc();
        transaction.set(payRef, {
            amount: amount,
            date: new Date(),
            type: 'Monthly Installment'
        });

    }).then(() => {
        alert("Payment Received! List updated.");
        loadDueCustomers(); // Refresh list to move customer down
    }).catch(err => {
        console.error(err);
        alert("Transaction failed: " + err);
    });
}

// ==============================================
// 7. SEARCH LOGIC (Simple)
// ==============================================
function searchCustomer() {
    const id = document.getElementById('search-id').value.trim();
    if(!id) return;
    
    db.collection('customers').doc(id).get().then(doc => {
        const div = document.getElementById('search-result');
        div.classList.remove('hidden');
        if(!doc.exists) {
            div.innerHTML = "<p>Customer not found.</p>";
            return;
        }
        const d = doc.data();
        
        // Logic to show images only if they exist
        const userImg = d.photo ? `<img src="${d.photo}">` : '<div style="padding:20px; border:1px solid #ccc">No Photo</div>';
        const cnicImg = d.cnic ? `<img src="${d.cnic}">` : '';

        div.innerHTML = `
            <div class="profile-header">
                <div class="profile-images">
                    ${userImg}
                    ${cnicImg}
                </div>
                <div>
                    <h2>${d.buyerName} <small>(${d.accountId})</small></h2>
                    <p><strong>Mobile:</strong> ${d.phone}</p>
                    <p><strong>Balance:</strong> ${d.currentBalance} | <strong>Installment:</strong> ${d.monthlyInstallment}</p>
                    <p><strong>Next Due:</strong> ${d.nextDueDate.split('T')[0]}</p>
                    <hr>
                    <p><strong>Item:</strong> ${d.items} (${d.modelNumber})</p>
                    <p><strong>Home:</strong> ${d.homeAddress}</p>
                </div>
            </div>
        `;
    });
}
