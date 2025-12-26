import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc,
    query,
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- APNA FIREBASE CONFIG YAHAN DALEN ---
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

// --- AUTHENTICATION CHECK ---
if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    onAuthStateChanged(auth, (user) => { 
        if (!user) window.location.href = 'index.html'; 
    });
}

// --- LOGIN FUNCTION ---
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    try {
        btn.innerHTML = 'Verifying...';
        btn.disabled = true;
        await signInWithEmailAndPassword(
            auth, 
            document.getElementById('email').value, 
            document.getElementById('password').value
        );
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert("Login Failed: " + error.message);
        btn.innerHTML = 'Login';
        btn.disabled = false;
    }
}

// --- LOGOUT FUNCTION ---
function handleLogout() {
    if(confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        });
    }
}

// --- IMAGE COMPRESSION FUNCTION (NO STORAGE NEEDED) ---
function compressImage(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve("");
            return;
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 800px width)
                let width = img.width;
                let height = img.height;
                const maxWidth = 800;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to base64 string (JPEG format with 0.7 quality)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(compressedBase64);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// --- SUBMIT CUSTOMER FORM ---
async function submitCustomer(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        // Get form values
        const customId = document.getElementById('customId').value.trim();
        const name = document.getElementById('name').value.trim();
        const total = Number(document.getElementById('total').value);
        const advance = Number(document.getElementById('advance').value);
        const monthly = Number(document.getElementById('monthly').value);
        const purchaseDate = document.getElementById('date').value;

        // Validation
        if(!customId || !name) throw new Error("Customer ID and Name are required");
        if(total <= 0) throw new Error("Total price must be greater than 0");
        if(advance > total) throw new Error("Advance cannot be more than total price");
        if(monthly <= 0) throw new Error("Monthly installment must be greater than 0");

        // Image compression
        btn.innerText = "Compressing Images...";
        const photoFile = document.getElementById('photo').files[0];
        const cnicFile = document.getElementById('cnicPhoto').files[0];
        
        const [imageUrl, cnicUrl] = await Promise.all([
            compressImage(photoFile),
            compressImage(cnicFile)
        ]);

        // Calculate installments
        btn.innerText = "Calculating Installments...";
        const installments = [];
        
        // Add advance as first installment
        if (advance > 0) {
            installments.push({ 
                name: "Advance Payment", 
                amount: advance, 
                date: purchaseDate, 
                status: "Paid" 
            });
        }
        
        // Calculate remaining installments
        let remaining = total - advance;
        let installmentCount = 1;
        let currentDate = new Date(purchaseDate);
        
        while (remaining > 0) {
            currentDate.setMonth(currentDate.getMonth() + 1);
            const installmentAmount = Math.min(monthly, remaining);
            
            installments.push({
                name: `Installment #${installmentCount}`,
                amount: installmentAmount,
                date: currentDate.toISOString().split('T')[0],
                status: "Pending"
            });
            
            remaining -= installmentAmount;
            installmentCount++;
        }

        // Prepare customer data
        btn.innerText = "Saving to Database...";
        const customerData = {
            customId,
            name,
            fatherName: document.getElementById('fatherName').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            cnic: document.getElementById('cnic').value.trim(),
            address: document.getElementById('address').value.trim(),
            workAddress: document.getElementById('workAddress').value.trim(),
            productName: document.getElementById('productName').value.trim(),
            productTotal: total,
            advance,
            monthly,
            purchaseDate,
            guarantor: {
                name: document.getElementById('g-name').value.trim(),
                phone: document.getElementById('g-phone').value.trim(),
                cnic: document.getElementById('g-cnic').value.trim(),
                address: document.getElementById('g-address').value.trim()
            },
            imageUrl,
            cnicUrl,
            installments,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        // Save to Firestore
        await addDoc(collection(db, "customers"), customerData);

        alert("✅ Customer record saved successfully!");
        window.location.href = 'dashboard.html';

    } catch (error) {
        alert("Error: " + error.message);
        btn.disabled = false;
        btn.innerText = "Save Record";
    }
}

// --- LOAD DASHBOARD DATA ---
export async function loadDashboard() {
    const list = document.getElementById('customer-list');
    if(!list) return;
    
    try {
        const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        let allCustomers = [];
        let totalDue = 0;
        let totalCustomers = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            totalCustomers++;
            
            // Calculate paid amount
            let paid = 0;
            if(data.installments && Array.isArray(data.installments)) {
                data.installments.forEach(inst => {
                    if(inst.status === 'Paid') paid += (inst.amount || 0);
                });
            }
            
            const remaining = (data.productTotal || 0) - paid;
            if(remaining > 0) totalDue += remaining;
            
            allCustomers.push({ 
                id: doc.id, 
                ...data, 
                paid, 
                remaining 
            });
        });

        // Update dashboard counters
        const totalDueElem = document.getElementById('total-due');
        const totalCustomersElem = document.getElementById('total-customers');
        
        if(totalDueElem) totalDueElem.textContent = totalDue.toLocaleString();
        if(totalCustomersElem) totalCustomersElem.textContent = totalCustomers;
        
        // Store globally for search
        window.allCustomersData = allCustomers;
        
        // Render table
        renderTable(allCustomers);

    } catch (error) {
        console.error("Error loading dashboard:", error);
        list.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">Error loading data: ${error.message}</td></tr>`;
    }
}

// --- RENDER CUSTOMER TABLE ---
function renderTable(customers) {
    const list = document.getElementById('customer-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if(customers.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">No customers found. Add your first customer!</td></tr>';
        return;
    }
    
    customers.forEach(customer => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-700 hover:bg-gray-800 transition";
        
        // Default image if no photo
        const profileImage = customer.imageUrl || 'https://via.placeholder.com/40';
        
        row.innerHTML = `
            <td class="p-4 text-purple-400 font-mono font-bold">${customer.customId}</td>
            <td class="p-4 flex items-center">
                <img src="${profileImage}" 
                     class="w-10 h-10 rounded-full object-cover mr-3 border border-gray-600"
                     onerror="this.src='https://via.placeholder.com/40'">
                <div>
                    <span class="block font-medium text-white">${customer.name}</span>
                    <span class="text-xs text-gray-400">${customer.productName || 'No product'}</span>
                </div>
            </td>
            <td class="p-4 hidden md:table-cell text-gray-400">${customer.phone || '-'}</td>
            <td class="p-4">
                <span class="font-bold ${customer.remaining > 0 ? 'text-red-400' : 'text-green-400'}">
                    ${customer.remaining.toLocaleString()} PKR
                </span>
                <div class="text-xs text-gray-400">${customer.paid.toLocaleString()} paid</div>
            </td>
            <td class="p-4">
                <a href="customer-profile.html?id=${customer.id}" 
                   class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition">
                    View
                </a>
            </td>
        `;
        list.appendChild(row);
    });
}

// --- FILTER CUSTOMERS FOR SEARCH ---
function filterCustomers() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase().trim();
    const customers = window.allCustomersData || [];
    
    if(!query) {
        renderTable(customers);
        return;
    }
    
    const filtered = customers.filter(customer => 
        customer.customId.toLowerCase().includes(query) ||
        customer.name.toLowerCase().includes(query) ||
        (customer.phone && customer.phone.includes(query)) ||
        (customer.cnic && customer.cnic.includes(query))
    );
    
    renderTable(filtered);
}

// --- LOAD CUSTOMER PROFILE ---
export async function loadProfile() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if(!id) {
        alert("No customer ID provided");
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            alert("Customer not found");
            window.location.href = 'dashboard.html';
            return;
        }
        
        const data = docSnap.data();
        
        // Update profile information
        document.getElementById('p-custom-id').textContent = data.customId || '-';
        document.getElementById('p-name').textContent = data.name || '-';
        document.getElementById('p-phone').textContent = data.phone || '-';
        document.getElementById('p-cnic').textContent = data.cnic || '-';
        document.getElementById('p-address').textContent = data.address || '-';
        document.getElementById('p-g-name').textContent = data.guarantor?.name || '-';
        document.getElementById('p-g-phone').textContent = data.guarantor?.phone || '-';
        
        // Set images
        const profileImg = document.getElementById('p-img');
        const cnicImg = document.getElementById('p-cnic-img');
        
        if (data.imageUrl) {
            profileImg.src = data.imageUrl;
        }
        
        if (data.cnicUrl) {
            cnicImg.src = data.cnicUrl;
        } else {
            cnicImg.style.display = 'none';
            document.querySelector('#cnic-container p').textContent = 'No CNIC photo available';
        }
        
        // Calculate payment summary
        let paid = 0;
        if(data.installments && Array.isArray(data.installments)) {
            data.installments.forEach(inst => {
                if(inst.status === 'Paid') paid += (inst.amount || 0);
            });
        }
        
        const total = data.productTotal || 0;
        const remaining = total - paid;
        const percentage = total > 0 ? Math.round((paid / total) * 100) : 0;
        
        // Update payment summary
        document.getElementById('p-total').textContent = total.toLocaleString() + ' PKR';
        document.getElementById('p-paid').textContent = paid.toLocaleString() + ' PKR';
        document.getElementById('p-remaining').textContent = remaining.toLocaleString() + ' PKR';
        document.getElementById('p-bar').style.width = `${percentage}%`;
        
        // Render installments table
        const tbody = document.getElementById('installment-rows');
        tbody.innerHTML = '';
        
        if(data.installments && Array.isArray(data.installments)) {
            data.installments.forEach((inst, index) => {
                const isPaid = inst.status === 'Paid';
                const row = document.createElement('tr');
                row.className = "border-b border-gray-700";
                row.innerHTML = `
                    <td class="p-2 text-xs text-gray-400">${inst.date || '-'}</td>
                    <td class="p-2 font-bold">${inst.amount ? inst.amount.toLocaleString() + ' PKR' : '-'}</td>
                    <td class="p-2">
                        <span class="${isPaid ? 'text-green-400' : 'text-red-400'} text-xs font-bold">
                            ${inst.status}
                        </span>
                    </td>
                    <td class="p-2 no-print">
                        ${!isPaid ? 
                            `<button onclick="markPaid('${id}', ${index})" 
                                     class="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs text-white transition">
                                Mark Paid
                            </button>` 
                            : '<span class="text-green-500">✓</span>'
                        }
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-400">No installments found</td></tr>';
        }
        
        // Setup WhatsApp button
        const whatsappBtn = document.getElementById('whatsapp-btn');
        const message = `*Naeem Khan Traders - Customer Summary*\n\n` +
                       `*Name:* ${data.name}\n` +
                       `*ID:* ${data.customId}\n` +
                       `*Total:* ${total.toLocaleString()} PKR\n` +
                       `*Paid:* ${paid.toLocaleString()} PKR\n` +
                       `*Due:* ${remaining.toLocaleString()} PKR\n` +
                       `*Product:* ${data.productName || 'Not specified'}\n\n` +
                       `View full profile: ${window.location.href}`;
        
        whatsappBtn.onclick = () => {
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        };
        
    } catch (error) {
        console.error("Error loading profile:", error);
        alert("Error loading customer profile: " + error.message);
        window.location.href = 'dashboard.html';
    }
}

// --- MARK INSTALLMENT AS PAID ---
async function markPaid(customerId, index) {
    const pin = prompt("Enter admin PIN to mark as paid:");
    if (pin !== ADMIN_PIN) {
        alert("❌ Wrong PIN! Access denied.");
        return;
    }
    
    try {
        const docRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            alert("Customer not found");
            return;
        }
        
        const data = docSnap.data();
        if (!data.installments || !Array.isArray(data.installments)) {
            alert("No installments found");
            return;
        }
        
        if (index >= data.installments.length) {
            alert("Invalid installment index");
            return;
        }
        
        // Update the installment status
        data.installments[index].status = "Paid";
        data.installments[index].paidDate = new Date().toISOString().split('T')[0];
        data.lastUpdated = new Date().toISOString();
        
        // Save back to Firestore
        await updateDoc(docRef, {
            installments: data.installments,
            lastUpdated: data.lastUpdated
        });
        
        alert("✅ Installment marked as paid!");
        location.reload();
        
    } catch (error) {
        console.error("Error marking as paid:", error);
        alert("Error: " + error.message);
    }
}

// --- DOWNLOAD PDF FUNCTION ---
function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('profile-content');
    
    html2canvas(element, { 
        scale: 2, 
        backgroundColor: "#0F172A",
        useCORS: true,
        logging: false 
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate image dimensions to fit the page
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgHeight / imgWidth;
        const pdfWidth = pageWidth - 20; // 10mm margins on each side
        const pdfHeight = pdfWidth * ratio;
        
        // Add image to PDF
        pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
        
        // Generate filename
        const customerId = document.getElementById('p-custom-id').textContent;
        const customerName = document.getElementById('p-name').textContent;
        const filename = `Customer_${customerId}_${customerName.replace(/\s+/g, '_')}.pdf`;
        
        // Save PDF
        pdf.save(filename);
    }).catch(error => {
        console.error("PDF generation error:", error);
        alert("Error generating PDF: " + error.message);
    });
}
