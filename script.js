// --- Firebase Config & Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// YOUR REAL CONFIGURATION
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

// --- SECURITY PIN ---
const ADMIN_PIN = "134047";

// --- AUTH CHECK ---
// Check login status on every page except index.html
if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });
}

// --- LOGIN FUNCTION ---
window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert("Login Failed: " + error.message);
        btn.innerHTML = 'Secure Login';
    }
};

// --- LOGOUT FUNCTION ---
window.handleLogout = () => {
    if(confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        });
    }
};

// --- DASHBOARD: LOAD CUSTOMERS ---
window.loadDashboard = async () => {
    const list = document.getElementById('customer-list');
    const totalDueEl = document.getElementById('total-due');
    const totalCustEl = document.getElementById('total-customers');
    
    if(!list) return; // Not on dashboard page

    list.innerHTML = '<tr><td colspan="4"><div class="loader"></div></td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        list.innerHTML = '';
        
        let totalDue = 0;
        let customerCount = 0;

        if (querySnapshot.empty) {
            list.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">No customers found.</td></tr>';
            totalDueEl.innerText = "0";
            totalCustEl.innerText = "0";
            return;
        }

        querySnapshot.forEach((doc) => {
            customerCount++;
            const data = doc.data();
            const id = doc.id;
            
            // Calculate Due
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(ins => {
                    if(ins.status === 'Paid') paid += (ins.amount || 0);
                });
            }
            const remaining = (data.productTotal || 0) - paid;
            if(remaining > 0) totalDue += remaining;

            const row = document.createElement('tr');
            row.className = "border-b border-gray-700 hover:bg-gray-800 transition duration-200 group";
            row.innerHTML = `
                <td class="p-4 flex items-center">
                    <img src="${data.imageUrl || 'https://via.placeholder.com/50/8B5CF6/FFFFFF?text=User'}" class="w-10 h-10 rounded-full object-cover mr-3 border border-purple-500">
                    <div>
                        <span class="font-medium text-white block">${data.name}</span>
                        <span class="text-xs text-gray-500">ID: ${id.substr(0, 5)}...</span>
                    </div>
                </td>
                <td class="p-4 hidden md:table-cell text-gray-300">${data.phone}</td>
                <td class="p-4 font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-400'}">
                    ${remaining.toLocaleString()} PKR
                </td>
                <td class="p-4 text-center">
                    <a href="customer-profile.html?id=${id}" class="inline-block bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-lg text-sm shadow hover:shadow-lg transition transform hover:-translate-y-0.5">
                        <i class="fas fa-eye mr-1"></i> View
                    </a>
                </td>
            `;
            list.appendChild(row);
        });

        totalDueEl.innerText = totalDue.toLocaleString();
        totalCustEl.innerText = customerCount;

    } catch (error) {
        console.error(error);
        list.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Error loading data. Check internet connection.</td></tr>';
    }
};

// --- ADD CUSTOMER FUNCTION ---
window.submitCustomer = async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';

    try {
        // 1. Data Collection
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const cnic = document.getElementById('cnic').value;
        const address = document.getElementById('address').value;
        const productTotal = Number(document.getElementById('total').value);
        const advance = Number(document.getElementById('advance').value);
        const monthly = Number(document.getElementById('monthly').value);
        const guarantorName = document.getElementById('g-name').value;
        const guarantorPhone = document.getElementById('g-phone').value;

        // Validation
        if(advance >= productTotal) {
            throw new Error("Advance payment cannot be equal to or more than total price.");
        }

        // 2. Image Upload
        const file = document.getElementById('photo').files[0];
        let imageUrl = "";
        if(file) {
            const storageRef = ref(storage, `customers/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        }

        // 3. Create Installment Schedule
        const installments = [];
        // Add Advance
        installments.push({
            name: "Advance Payment",
            amount: advance,
            date: new Date().toISOString().split('T')[0],
            status: "Paid",
            paidAt: new Date().toISOString()
        });

        // Generate Future Installments
        let remaining = productTotal - advance;
        let nextDate = new Date();
        let monthCount = 1;
        
        while(remaining > 0) {
            nextDate.setMonth(nextDate.getMonth() + 1);
            let amount = (remaining < monthly) ? remaining : monthly;
            installments.push({
                name: `Installment #${monthCount}`,
                amount: amount,
                date: nextDate.toISOString().split('T')[0],
                status: "Pending",
                paidAt: null
            });
            remaining -= amount;
            monthCount++;
        }

        // 4. Save to Firestore
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
        btn.innerHTML = 'Save Customer & Generate Schedule';
    }
};

// --- PROFILE: LOAD SINGLE CUSTOMER ---
window.loadProfile = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if(!id) { 
        document.body.innerHTML = '<h1 class="text-white text-center mt-10">No ID Provided</h1>';
        return; 
    }

    try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Fill Info
            document.getElementById('p-name').innerText = data.name;
            document.getElementById('p-phone').innerText = data.phone;
            document.getElementById('p-id').innerText = id;
            document.getElementById('p-address').innerText = data.address || 'N/A';
            document.getElementById('p-cnic').innerText = data.cnic || 'N/A';
            document.getElementById('p-img').src = data.imageUrl || "https://via.placeholder.com/150/8B5CF6/FFFFFF?text=User";
            
            // Guarantor
            document.getElementById('p-g-name').innerText = data.guarantor.name || 'N/A';
            document.getElementById('p-g-phone').innerText = data.guarantor.phone || 'N/A';

            // Financials
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { if(i.status === 'Paid') paid += (i.amount || 0); });
            }
            const total = data.productTotal || 0;
            const remaining = total - paid;
            const percentage = total > 0 ? (paid / total) * 100 : 0;

            document.getElementById('p-total').innerText = total.toLocaleString();
            document.getElementById('p-paid').innerText = paid.toLocaleString();
            document.getElementById('p-remaining').innerText = remaining.toLocaleString();
            document.getElementById('p-bar').style.width = `${percentage}%`;

            // Installment Table
            const tbody = document.getElementById('installment-rows');
            tbody.innerHTML = '';
            
            if(data.installments) {
                data.installments.forEach((inst, index) => {
                    const tr = document.createElement('tr');
                    const isPaid = inst.status === 'Paid';
                    const amount = inst.amount || 0;
                    
                    tr.className = "hover:bg-gray-800/50 transition";
                    tr.innerHTML = `
                        <td class="p-3 text-sm">${inst.date}</td>
                        <td class="p-3 font-bold">${amount.toLocaleString()}</td>
                        <td class="p-3 text-center">
                            <span class="px-2 py-1 rounded-full text-xs font-bold ${isPaid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                                ${inst.status}
                            </span>
                        </td>
                        <td class="p-3 text-center no-print">
                            ${!isPaid ? 
                                `<button onclick="markPaid('${id}', ${index})" class="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded shadow transition">
                                    <i class="fas fa-check mr-1"></i> Pay
                                </button>` : 
                                `<span class="text-green-500"><i class="fas fa-check-circle"></i></span>`
                            }
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Set WhatsApp Link
            const shareUrl = window.location.href; // Uses current URL (hosted link)
            const msg = `*Naeem Khan Traders*\nCustomer: ${data.name}\nTotal: ${total}\nRemaining: ${remaining}\n\nView Profile: ${shareUrl}`;
            document.getElementById('whatsapp-btn').onclick = () => {
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            };

        } else {
            alert("Customer not found!");
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error(error);
        alert("Error loading profile");
    }
};

// --- PIN PROTECTED: MARK PAID ---
window.markPaid = async (customerId, index) => {
    // 1. PIN Check
    const pin = prompt("🔐 Enter Admin PIN to confirm payment:");
    
    if (pin === null) return; // User cancelled
    
    if (pin !== ADMIN_PIN) {
        alert("❌ Access Denied! Incorrect PIN.");
        return;
    }

    // 2. If PIN Correct, Proceed
    try {
        const customerRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(customerRef);
        const data = docSnap.data();
        
        // Update status
        if(data.installments && data.installments[index]) {
            data.installments[index].status = "Paid";
            data.installments[index].paidAt = new Date().toISOString();

            await updateDoc(customerRef, {
                installments: data.installments
            });

            alert("✅ Payment Received & Updated!");
            location.reload(); // Refresh to see changes
        }

    } catch (error) {
        alert("Error updating: " + error.message);
    }
};

// --- PDF DOWNLOAD ---
window.downloadPDF = () => {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('profile-content');
    
    // Hide buttons temporarily (handled by .no-print class in css but safe to be sure)
    
    html2canvas(element, { 
        scale: 2,
        backgroundColor: "#0F172A", // Match theme
        useCORS: true // For images
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('Customer-Profile.pdf');
    });
};
