import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// YAHAN APNE *NAYE* PROJECT KI KEYS DALEIN
const firebaseConfig = {
  apiKey: "AIzaSyCujiWEwr3657z7L6mI9xmIwMZjYJchoJc",
  authDomain: "naeem-khan-f7d4f.firebaseapp.com",
  databaseURL: "https://naeem-khan-f7d4f-default-rtdb.firebaseio.com",
  projectId: "naeem-khan-f7d4f",
  storageBucket: "naeem-khan-f7d4f.firebasestorage.app",
  messagingSenderId: "20329827636",
  appId: "1:20329827636:web:6bc934919ca09e683f2961",
  measurementId: "G-DHCVE17PDS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const ADMIN_PIN = "134047";

// --- Auth Redirect ---
if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = 'index.html';
    });
}

// --- Login ---
window.handleLogin = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    try {
        btn.innerHTML = 'Verifying...';
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert("Login Failed: " + error.message);
        btn.innerHTML = 'Login System';
    }
};

window.handleLogout = () => {
    if(confirm("Logout?")) signOut(auth).then(() => window.location.href = 'index.html');
};

// --- Dashboard & Search (Manual ID Logic) ---
let allCustomers = [];

window.loadDashboard = async () => {
    const list = document.getElementById('customer-list');
    if(!list) return;

    list.innerHTML = '<tr><td colspan="5" class="text-center p-4">Loading Records...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        allCustomers = []; 
        let totalDue = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { if(i.status === 'Paid') paid += (i.amount || 0); });
            }
            const remaining = (data.productTotal || 0) - paid;
            if(remaining > 0) totalDue += remaining;

            // Use Manual ID for search
            allCustomers.push({ id: doc.id, ...data, remaining });
        });

        // Sort by ID (optional, simple sort)
        allCustomers.sort((a, b) => a.customId.toString().localeCompare(b.customId.toString()));

        renderTable(allCustomers);

    } catch (error) {
        console.error(error);
        list.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Error: ' + error.message + '</td></tr>';
    }
};

window.filterCustomers = () => {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if(!query) {
        renderTable(allCustomers);
        return;
    }
    const filtered = allCustomers.filter(c => {
        const cid = c.customId ? c.customId.toString().toLowerCase() : "";
        return cid.includes(query); // Searches only by ID as requested
    });
    renderTable(filtered);
};

function renderTable(data) {
    const list = document.getElementById('customer-list');
    list.innerHTML = '';
    if(data.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="text-center p-4">No record found.</td></tr>';
        return;
    }
    data.forEach(c => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-700 hover:bg-gray-800 transition";
        row.innerHTML = `
            <td class="p-4 text-purple-400 font-mono font-bold text-lg">${c.customId}</td>
            <td class="p-4 flex items-center">
                <img src="${c.imageUrl || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full object-cover mr-3 border border-gray-600">
                <div>
                    <span class="block font-medium text-white">${c.name}</span>
                    <span class="text-xs text-gray-500">${c.productName || ''}</span>
                </div>
            </td>
            <td class="p-4 hidden md:table-cell text-gray-400">${c.phone || '-'}</td>
            <td class="p-4 font-bold ${c.remaining > 0 ? 'text-red-400' : 'text-green-400'}">${c.remaining.toLocaleString()}</td>
            <td class="p-4">
                <a href="customer-profile.html?id=${c.id}" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm">View</a>
            </td>
        `;
        list.appendChild(row);
    });
}

// --- ADD CUSTOMER (With Upload Handling) ---
window.submitCustomer = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const customId = document.getElementById('customId').value.trim();
        if(!customId) throw new Error("Manual Customer ID is required!");

        const name = document.getElementById('name').value;
        const total = Number(document.getElementById('total').value);
        const advance = Number(document.getElementById('advance').value);
        const monthly = Number(document.getElementById('monthly').value);
        const purchaseDate = document.getElementById('date').value;

        // Collect all optional fields
        const fatherName = document.getElementById('fatherName').value;
        const phone = document.getElementById('phone').value;
        const cnic = document.getElementById('cnic').value;
        const address = document.getElementById('address').value;
        const workAddress = document.getElementById('workAddress').value;
        const productName = document.getElementById('productName').value;
        
        const guarantor = {
            name: document.getElementById('g-name').value,
            phone: document.getElementById('g-phone').value,
            cnic: document.getElementById('g-cnic').value,
            address: document.getElementById('g-address').value
        };

        // Image Upload Logic (Safe)
        let imageUrl = "";
        let cnicUrl = "";
        
        const photoFile = document.getElementById('photo').files[0];
        if(photoFile) {
            btn.innerText = "Uploading Photo...";
            const ref1 = ref(storage, `customers/${customId}_p_${Date.now()}`);
            await uploadBytes(ref1, photoFile);
            imageUrl = await getDownloadURL(ref1);
        }

        const cnicFile = document.getElementById('cnicPhoto').files[0];
        if(cnicFile) {
            btn.innerText = "Uploading CNIC...";
            const ref2 = ref(storage, `customers/${customId}_c_${Date.now()}`);
            await uploadBytes(ref2, cnicFile);
            cnicUrl = await getDownloadURL(ref2);
        }

        btn.innerText = "Saving Data...";

        // Installment Logic
        const installments = [];
        installments.push({ name: "Advance", amount: advance, date: purchaseDate, status: "Paid" });

        let remaining = total - advance;
        let nextDate = new Date(purchaseDate);
        let count = 1;
        while(remaining > 0) {
            nextDate.setMonth(nextDate.getMonth() + 1);
            let amount = (remaining < monthly) ? remaining : monthly;
            installments.push({
                name: `Inst #${count}`,
                amount: amount,
                date: nextDate.toISOString().split('T')[0],
                status: "Pending"
            });
            remaining -= amount;
            count++;
        }

        await addDoc(collection(db, "customers"), {
            customId, name, fatherName, phone, address, cnic, workAddress,
            productName, productTotal: total, advance, monthly, purchaseDate,
            guarantor, imageUrl, cnicUrl, installments,
            createdAt: new Date().toISOString()
        });

        alert("✅ Success! Customer Added.");
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
        btn.disabled = false;
        btn.innerText = "Save Record";
    }
};

// --- Profile Load ---
window.loadProfile = async () => {
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

            document.getElementById('p-total').innerText = (data.productTotal || 0).toLocaleString();
            document.getElementById('p-paid').innerText = paid.toLocaleString();
            document.getElementById('p-remaining').innerText = remaining.toLocaleString();
            
            // Percentage bar logic
            const percentage = (data.productTotal > 0) ? (paid / data.productTotal) * 100 : 0;
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
            
            const msg = `*Naeem Khan Traders*\nID: ${data.customId}\nName: ${data.name}\nDue: ${remaining}\nLink: ${window.location.href}`;
            document.getElementById('whatsapp-btn').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        }
    } catch (e) { console.error(e); }
};

window.markPaid = async (customerId, index) => {
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
};

window.downloadPDF = () => {
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
};
