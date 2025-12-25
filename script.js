// --- Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// --- YOUR CONFIGURATION ---
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

// --- Initialization ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- SECURITY PIN ---
const ADMIN_PIN = "134047";

// --- Auth Check ---
if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });
}

// --- 1. Login Function ---
window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    
    try {
        btn.innerHTML = 'Verifying...';
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert("Login Failed: " + error.message);
        btn.innerHTML = 'Secure Login';
    }
};

// --- 2. Logout Function ---
window.handleLogout = () => {
    if(confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => window.location.href = 'index.html');
    }
};

// --- 3. Dashboard Load ---
window.loadDashboard = async () => {
    const list = document.getElementById('customer-list');
    const totalDueEl = document.getElementById('total-due');
    const totalCustEl = document.getElementById('total-customers');
    
    if(!list) return;

    list.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading data...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        list.innerHTML = '';
        
        let totalDue = 0;
        let customerCount = 0;

        if (querySnapshot.empty) {
            list.innerHTML = '<tr><td colspan="4" class="text-center p-4">No customers found.</td></tr>';
            totalDueEl.innerText = "0";
            totalCustEl.innerText = "0";
            return;
        }

        querySnapshot.forEach((doc) => {
            customerCount++;
            const data = doc.data();
            const id = doc.id;
            
            // Calculate Remaining
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(ins => {
                    if(ins.status === 'Paid') paid += (ins.amount || 0);
                });
            }
            const remaining = (data.productTotal || 0) - paid;
            if(remaining > 0) totalDue += remaining;

            const row = document.createElement('tr');
            row.className = "border-b border-gray-700 hover:bg-gray-800 transition";
            row.innerHTML = `
                <td class="p-4 flex items-center">
                    <img src="${data.imageUrl || 'https://via.placeholder.com/50'}" class="w-10 h-10 rounded-full object-cover mr-3 border border-purple-500">
                    <div>
                        <span class="block font-medium text-white">${data.name}</span>
                        <span class="text-xs text-gray-400">ID: ${id.slice(0,5)}..</span>
                    </div>
                </td>
                <td class="p-4 text-gray-300">${data.phone}</td>
                <td class="p-4 font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-400'}">
                    ${remaining.toLocaleString()} PKR
                </td>
                <td class="p-4">
                    <a href="customer-profile.html?id=${id}" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition shadow">View</a>
                </td>
            `;
            list.appendChild(row);
        });

        totalDueEl.innerText = totalDue.toLocaleString();
        totalCustEl.innerText = customerCount;

    } catch (error) {
        console.error(error);
        list.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Error loading data.</td></tr>';
    }
};

// --- 4. Add Customer ---
window.submitCustomer = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const cnic = document.getElementById('cnic').value;
        const address = document.getElementById('address').value;
        const productTotal = Number(document.getElementById('total').value);
        const advance = Number(document.getElementById('advance').value);
        const monthly = Number(document.getElementById('monthly').value);
        const guarantorName = document.getElementById('g-name').value;
        const guarantorPhone = document.getElementById('g-phone').value;
        const file = document.getElementById('photo').files[0];

        if(advance >= productTotal) throw new Error("Advance total se zyada nahi ho sakta.");

        // Image Upload
        let imageUrl = "";
        if(file) {
            const storageRef = ref(storage, `customers/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        }

        // Installment Array
        const installments = [];
        installments.push({
            name: "Advance Payment",
            amount: advance,
            date: new Date().toISOString().split('T')[0],
            status: "Paid"
        });

        let remaining = productTotal - advance;
        let nextDate = new Date();
        let count = 1;
        
        while(remaining > 0) {
            nextDate.setMonth(nextDate.getMonth() + 1);
            let amount = (remaining < monthly) ? remaining : monthly;
            installments.push({
                name: `Installment #${count}`,
                amount: amount,
                date: nextDate.toISOString().split('T')[0],
                status: "Pending"
            });
            remaining -= amount;
            count++;
        }

        await addDoc(collection(db, "customers"), {
            name, phone, cnic, address, imageUrl,
            productTotal, advance, monthly,
            guarantor: { name: guarantorName, phone: guarantorPhone },
            installments,
            createdAt: new Date().toISOString()
        });

        alert("✅ Customer Added Successfully!");
        window.location.href = 'dashboard.html';

    } catch (error) {
        alert("Error: " + error.message);
        btn.disabled = false;
        btn.innerText = "Save Customer";
    }
};

// --- 5. Load Profile ---
window.loadProfile = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if(!id) return;

    try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // UI Fill
            document.getElementById('p-name').innerText = data.name;
            document.getElementById('p-phone').innerText = data.phone;
            document.getElementById('p-cnic').innerText = data.cnic || '-';
            document.getElementById('p-address').innerText = data.address || '-';
            document.getElementById('p-g-name').innerText = data.guarantor.name || '-';
            document.getElementById('p-g-phone').innerText = data.guarantor.phone || '-';
            document.getElementById('p-img').src = data.imageUrl || "https://via.placeholder.com/150";

            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { if(i.status === 'Paid') paid += (i.amount || 0); });
            }
            const remaining = data.productTotal - paid;
            const percentage = (paid / data.productTotal) * 100;

            document.getElementById('p-total').innerText = data.productTotal.toLocaleString();
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
                        <td class="p-3 text-sm">${inst.date}</td>
                        <td class="p-3 font-bold">${inst.amount.toLocaleString()}</td>
                        <td class="p-3"><span class="${isPaid ? 'text-green-400' : 'text-red-400'}">${inst.status}</span></td>
                        <td class="p-3 no-print">
                            ${!isPaid ? `<button onclick="markPaid('${id}', ${index})" class="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-xs text-white transition shadow">Pay</button>` : '✓'}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // WhatsApp Share
            const msg = `*Naeem Khan Traders*\nCustomer: ${data.name}\nRemaining: ${remaining}\nLink: ${window.location.href}`;
            document.getElementById('whatsapp-btn').onclick = () => {
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            };

        } else {
            alert("Customer not found");
        }
    } catch (error) {
        console.error(error);
    }
};

// --- 6. Mark Paid (With PIN) ---
window.markPaid = async (customerId, index) => {
    const pin = prompt("Enter Admin PIN (134047):");
    if (pin !== ADMIN_PIN) {
        alert("❌ Wrong PIN!");
        return;
    }

    try {
        const customerRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(customerRef);
        const data = docSnap.data();
        
        data.installments[index].status = "Paid";
        
        await updateDoc(customerRef, {
            installments: data.installments
        });

        alert("✅ Payment Updated!");
        location.reload();

    } catch (error) {
        alert("Error: " + error.message);
    }
};

// --- 7. Download PDF ---
window.downloadPDF = () => {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('profile-content');
    
    html2canvas(element, { scale: 2, backgroundColor: "#0F172A" }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('Customer-Profile.pdf');
    });
};
