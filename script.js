import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- YAHAN APNI CONFIG DALEIN ---
const firebaseConfig = {
  apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
  authDomain: "naeemjan-c7f46.firebaseapp.com",
  projectId: "naeemjan-c7f46",
  storageBucket: "naeemjan-c7f46.firebasestorage.app",
  messagingSenderId: "319489849314",
  appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_PIN = "134047";

// --- GLOBAL EXPORTS ---
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.submitCustomer = submitCustomer;
window.filterCustomers = filterCustomers;
window.markPaid = markPaid;
window.downloadPDF = downloadPDF;

// --- AUTH ---
if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    onAuthStateChanged(auth, (user) => { if (!user) window.location.href = 'index.html'; });
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    try {
        btn.innerHTML = 'Verifying...';
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert("Login Failed: " + error.message);
        btn.innerHTML = 'Login';
    }
}

function handleLogout() {
    if(confirm("Logout?")) signOut(auth).then(() => window.location.href = 'index.html');
}

// --- IMAGE COMPRESSION (No Storage) ---
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // Resize to max 600px width (Perfect for DB)
                const scaleFactor = 600 / img.width;
                canvas.width = 600;
                canvas.height = img.height * scaleFactor;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Convert to JPEG string
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
        reader.onerror = (error) => reject(error);
    });
}

// --- ADD CUSTOMER ---
async function submitCustomer(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const customId = document.getElementById('customId').value.trim();
        const name = document.getElementById('name').value;
        const total = Number(document.getElementById('total').value);
        const advance = Number(document.getElementById('advance').value);
        const monthly = Number(document.getElementById('monthly').value);
        const purchaseDate = document.getElementById('date').value;

        if(!customId) throw new Error("ID Required");
        if(advance >= total) throw new Error("Advance total se zyada nahi ho sakta");

        // Image Handling (Direct DB)
        let imageUrl = "";
        let cnicUrl = "";
        
        const photoFile = document.getElementById('photo').files[0];
        if(photoFile) {
            btn.innerText = "Compressing Photo...";
            imageUrl = await compressImage(photoFile);
        }

        const cnicFile = document.getElementById('cnicPhoto').files[0];
        if(cnicFile) {
            btn.innerText = "Compressing CNIC...";
            cnicUrl = await compressImage(cnicFile);
        }

        // Installments
        btn.innerText = "Saving...";
        const installments = [];
        installments.push({ name: "Advance", amount: advance, date: purchaseDate, status: "Paid" });
        let remaining = total - advance;
        let nextDate = new Date(purchaseDate);
        let count = 1;
        while(remaining > 0) {
            nextDate.setMonth(nextDate.getMonth() + 1);
            let amount = (remaining < monthly) ? remaining : monthly;
            installments.push({ name: `Inst #${count}`, amount: amount, date: nextDate.toISOString().split('T')[0], status: "Pending" });
            remaining -= amount;
            count++;
        }

        // Save to DB
        await addDoc(collection(db, "customers"), {
            customId, name,
            fatherName: document.getElementById('fatherName').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            workAddress: document.getElementById('workAddress').value,
            cnic: document.getElementById('cnic').value,
            productName: document.getElementById('productName').value,
            productTotal: total, advance, monthly, purchaseDate,
            guarantor: {
                name: document.getElementById('g-name').value,
                phone: document.getElementById('g-phone').value,
                cnic: document.getElementById('g-cnic').value,
                address: document.getElementById('g-address').value
            },
            imageUrl, cnicUrl, installments,
            createdAt: new Date().toISOString()
        });

        alert("✅ Success! Customer Saved.");
        window.location.href = 'dashboard.html';

    } catch (error) {
        alert("Error: " + error.message);
        btn.disabled = false;
        btn.innerText = "Save Record";
    }
}

// --- DASHBOARD LOAD ---
export async function loadDashboard() {
    const list = document.getElementById('customer-list');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="5" class="text-center p-4">Loading...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        let allCustomers = [];
        let totalDue = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { if(i.status === 'Paid') paid += (i.amount || 0); });
            }
            const remaining = (data.productTotal || 0) - paid;
            if(remaining > 0) totalDue += remaining;
            allCustomers.push({ id: doc.id, ...data, remaining });
        });

        allCustomers.sort((a, b) => a.customId.toString().localeCompare(b.customId.toString()));
        document.getElementById('total-due').innerText = totalDue.toLocaleString();
        document.getElementById('total-customers').innerText = allCustomers.length;
        
        window.allCustomersData = allCustomers; // Store globally for search
        renderTable(allCustomers);

    } catch (error) {
        list.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">Error: ${error.message}</td></tr>`;
    }
}

function renderTable(data) {
    const list = document.getElementById('customer-list');
    list.innerHTML = '';
    if(data.length === 0) { list.innerHTML = '<tr><td colspan="5" class="text-center p-4">No record found.</td></tr>'; return; }
    data.forEach(c => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-700 hover:bg-gray-800 transition";
        row.innerHTML = `
            <td class="p-4 text-purple-400 font-mono font-bold">${c.customId}</td>
            <td class="p-4 flex items-center">
                <img src="${c.imageUrl || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full object-cover mr-3 border border-gray-600">
                <div><span class="block font-medium text-white">${c.name}</span></div>
            </td>
            <td class="p-4 hidden md:table-cell text-gray-400">${c.phone || '-'}</td>
            <td class="p-4 font-bold ${c.remaining > 0 ? 'text-red-400' : 'text-green-400'}">${c.remaining.toLocaleString()}</td>
            <td class="p-4"><a href="customer-profile.html?id=${c.id}" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm">View</a></td>
        `;
        list.appendChild(row);
    });
}

function filterCustomers() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const data = window.allCustomersData || [];
    if(!query) { renderTable(data); return; }
    const filtered = data.filter(c => c.customId.toString().toLowerCase().includes(query));
    renderTable(filtered);
}

// --- PROFILE LOAD ---
export async function loadProfile() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if(!id) return;

    try {
        const docSnap = await getDoc(doc(db, "customers", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            document.getElementById('p-custom-id').innerText = data.customId || '-';
            document.getElementById('p-name').innerText = data.name || '-';
            document.getElementById('p-phone').innerText = data.phone || '-';
            document.getElementById('p-address').innerText = data.address || '-';
            document.getElementById('p-g-name').innerText = data.guarantor.name || '-';
            document.getElementById('p-g-phone').innerText = data.guarantor.phone || '-';
            
            if(data.imageUrl) document.getElementById('p-img').src = data.imageUrl;
            else document.getElementById('p-img').src = "https://via.placeholder.com/150";

            if(data.cnicUrl) document.getElementById('p-cnic-img').src = data.cnicUrl;
            else document.getElementById('cnic-container').style.display = 'none';

            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { if(i.status === 'Paid') paid += (i.amount || 0); });
            }
            const remaining = (data.productTotal || 0) - paid;
            const percentage = (data.productTotal > 0) ? (paid / data.productTotal) * 100 : 0;

            document.getElementById('p-total').innerText = (data.productTotal || 0).toLocaleString();
            document.getElementById('p-paid').innerText = paid.toLocaleString();
            document.getElementById('p-remaining').innerText = remaining.toLocaleString();
            document.getElementById('p-bar').style.width = `${percentage}%`;

            const tbody = document.getElementById('installment-rows');
            tbody.innerHTML = '';
            if(data.installments) {
                data.installments.forEach((inst, index) => {
                    const tr = document.createElement('tr');
                    const isPaid = inst.status === 'Paid';
                    tr.className = "border-b border-gray-700";
                    tr.innerHTML = `
                        <td class="p-2 text-xs text-gray-400">${inst.date}</td>
                        <td class="p-2 font-bold">${inst.amount.toLocaleString()}</td>
                        <td class="p-2"><span class="${isPaid ? 'text-green-400' : 'text-red-400'} text-xs">${inst.status}</span></td>
                        <td class="p-2 no-print">
                            ${!isPaid ? `<button onclick="markPaid('${id}', ${index})" class="bg-green-600 px-2 py-1 rounded text-xs text-white">Pay</button>` : '✓'}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            const msg = `*Naeem Khan Traders*\nID: ${data.customId}\nDue: ${remaining}\nLink: ${window.location.href}`;
            document.getElementById('whatsapp-btn').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        }
    } catch (e) { console.error(e); }
}

async function markPaid(customerId, index) {
    const pin = prompt("Enter PIN (134047):");
    if (pin !== ADMIN_PIN) { alert("Wrong PIN!"); return; }
    try {
        const ref = doc(db, "customers", customerId);
        const snap = await getDoc(ref);
        const data = snap.data();
        data.installments[index].status = "Paid";
        await updateDoc(ref, { installments: data.installments });
        location.reload();
    } catch (e) { alert(e.message); }
}

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('profile-content');
    html2canvas(element, { scale: 2, backgroundColor: "#0F172A", useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const w = pdf.internal.pageSize.getWidth();
        const h = (canvas.height * w) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, w, h);
        pdf.save('Customer-Profile.pdf');
    });
}
