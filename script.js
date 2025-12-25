import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

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
const analytics = getAnalytics(app);
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

// --- Login Logic ---
window.handleLogin = async (e) => {
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
};

window.handleLogout = () => {
    if(confirm("Logout?")) signOut(auth).then(() => window.location.href = 'index.html');
};

// --- Dashboard & Search ---
let allCustomers = [];

window.loadDashboard = async () => {
    const list = document.getElementById('customer-list');
    if(!list) return;

    list.innerHTML = '<tr><td colspan="5" class="text-center p-4">Fetching Records...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        allCustomers = []; 
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { if(i.status === 'Paid') paid += (i.amount || 0); });
            }
            const remaining = (data.productTotal || 0) - paid;
            allCustomers.push({ id: doc.id, ...data, remaining });
        });

        document.getElementById('total-due').innerText = allCustomers.reduce((acc, c) => acc + (c.remaining > 0 ? c.remaining : 0), 0).toLocaleString();
        document.getElementById('total-customers').innerText = allCustomers.length;
        
        renderTable(allCustomers);

    } catch (error) {
        list.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Error loading data.</td></tr>';
    }
};

// ** SEARCH ENGINE LOGIC **
window.filterCustomers = () => {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if(!query) {
        renderTable(allCustomers);
        return;
    }

    const filtered = allCustomers.filter(c => {
        const cid = c.customId ? c.customId.toString().toLowerCase() : "";
        const name = c.name ? c.name.toLowerCase() : "";
        return cid.includes(query) || name.includes(query);
    });
    renderTable(filtered);
};

function renderTable(data) {
    const list = document.getElementById('customer-list');
    list.innerHTML = '';

    if(data.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="text-center p-4">No match found.</td></tr>';
        return;
    }

    data.forEach(c => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-700 hover:bg-gray-800 transition";
        row.innerHTML = `
            <td class="p-4 text-purple-400 font-mono font-bold">${c.customId || 'N/A'}</td>
            <td class="p-4 flex items-center">
                <img src="${c.imageUrl || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full object-cover mr-3 border border-gray-600">
                <span class="font-medium text-white">${c.name}</span>
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

// --- Add Customer (Sab Optional) ---
window.submitCustomer = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        // Required Fields
        const customId = document.getElementById('customId').value.trim(); // A-999
        const name = document.getElementById('name').value;
        const total = Number(document.getElementById('total').value);
        const advance = Number(document.getElementById('advance').value);
        const monthly = Number(document.getElementById('monthly').value);

        if(advance >= total) throw new Error("Advance total se zyada nahi ho sakta.");

        // Optional Fields (Safe Checks)
        const phone = document.getElementById('phone').value || "";
        const address = document.getElementById('address').value || "";
        const cnic = document.getElementById('cnic').value || "";
        const gName = document.getElementById('g-name').value || "";
        const gPhone = document.getElementById('g-phone').value || "";

        // Image Uploads (Optional)
        let imageUrl = "";
        let cnicUrl = "";
        
        const photoFile = document.getElementById('photo').files[0];
        if(photoFile) {
            const ref1 = ref(storage, `customers/${customId}_p_${Date.now()}`);
            await uploadBytes(ref1, photoFile);
            imageUrl = await getDownloadURL(ref1);
        }

        const cnicFile = document.getElementById('cnicPhoto').files[0];
        if(cnicFile) {
            const ref2 = ref(storage, `customers/${customId}_c_${Date.now()}`);
            await uploadBytes(ref2, cnicFile);
            cnicUrl = await getDownloadURL(ref2);
        }

        // Installment Logic
        const installments = [];
        installments.push({
            name: "Advance", amount: advance, date: new Date().toISOString().split('T')[0], status: "Paid"
        });

        let remaining = total - advance;
        let nextDate = new Date();
        let count = 1;
        while(remaining > 0) {
            nextDate.setMonth(nextDate.getMonth() + 1);
            let amount = (remaining < monthly) ? remaining : monthly;
            installments.push({
                name: `Inst #${count}`, amount: amount, date: nextDate.toISOString().split('T')[0], status: "Pending"
            });
            remaining -= amount;
            count++;
        }

        await addDoc(collection(db, "customers"), {
            customId, name, phone, address, cnic, imageUrl, cnicUrl,
            productTotal: total, advance, monthly,
            guarantor: { name: gName, phone: gPhone },
            installments,
            createdAt: new Date().toISOString()
        });

        alert("✅ Saved Successfully!");
        window.location.href = 'dashboard.html';

    } catch (error) {
        alert("Error: " + error.message);
        btn.disabled = false;
        btn.innerText = "Save Record";
    }
};

// --- Profile Page ---
window.loadProfile = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if(!id) return;

    try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Basic Info
            document.getElementById('p-custom-id').innerText = data.customId || '---';
            document.getElementById('p-name').innerText = data.name;
            document.getElementById('p-phone').innerText = data.phone || 'N/A';
            document.getElementById('p-address').innerText = data.address || 'N/A';
            document.getElementById('p-g-name').innerText = data.guarantor.name || 'N/A';
            
            // Images
            if(data.imageUrl) document.getElementById('p-img').src = data.imageUrl;
            else document.getElementById('p-img').src = "https://via.placeholder.com/100";

            if(data.cnicUrl) {
                document.getElementById('p-cnic-img').src = data.cnicUrl;
            } else {
                document.getElementById('p-cnic-img').parentElement.style.display = 'none';
            }

            // Math
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { if(i.status === 'Paid') paid += (i.amount || 0); });
            }
            const remaining = (data.productTotal || 0) - paid;
            const percentage = (paid / data.productTotal) * 100;

            document.getElementById('p-total').innerText = data.productTotal.toLocaleString();
            document.getElementById('p-paid').innerText = paid.toLocaleString();
            document.getElementById('p-remaining').innerText = remaining.toLocaleString();
            document.getElementById('p-bar').style.width = `${percentage}%`;

            // Table
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

            // Buttons
            const msg = `*Naeem Khan Traders*\nID: ${data.customId}\nName: ${data.name}\nDue: ${remaining}\nLink: ${window.location.href}`;
            document.getElementById('whatsapp-btn').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');

        }
    } catch (e) { console.error(e); }
};

window.markPaid = async (customerId, index) => {
    const pin = prompt("Enter Admin PIN (134047):");
    if (pin !== ADMIN_PIN) { alert("❌ Wrong PIN!"); return; }
    
    try {
        const customerRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(customerRef);
        const data = docSnap.data();
        data.installments[index].status = "Paid";
        await updateDoc(customerRef, { installments: data.installments });
        location.reload();
    } catch (e) { alert(e.message); }
};

window.downloadPDF = () => {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('profile-content');
    html2canvas(element, { scale: 2, backgroundColor: "#0F172A", useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('Customer-Profile.pdf');
    });
};
