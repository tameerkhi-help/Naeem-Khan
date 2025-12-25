import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Firebase Configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const ADMIN_PIN = "134047";

// ==================== AUTHENTICATION ====================

// Redirect to login if not authenticated
if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = 'index.html';
    });
}

// Login Function
window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Verifying...';
        btn.disabled = true;
        
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert("Login Failed: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Logout Function
window.handleLogout = () => {
    if(confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        });
    }
};

// ==================== DASHBOARD FUNCTIONS ====================

let allCustomers = [];

window.loadDashboard = async () => {
    const list = document.getElementById('customer-list');
    const totalDueEl = document.getElementById('total-due');
    const totalCustEl = document.getElementById('total-customers');
    
    if(!list) return;

    list.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="loading-pulse">Loading customers...</div></td></tr>';
    
    try {
        const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        allCustomers = [];
        let totalDue = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { 
                    if(i.status === 'Paid') paid += (i.amount || 0); 
                });
            }
            
            const productTotal = data.productTotal || 0;
            const remaining = productTotal - paid;
            if(remaining > 0) totalDue += remaining;

            allCustomers.push({ 
                id, 
                ...data, 
                remaining,
                paid,
                createdAt: data.createdAt || new Date().toISOString()
            });
        });

        totalDueEl.innerText = '₹' + totalDue.toLocaleString();
        totalCustEl.innerText = allCustomers.length.toLocaleString();
        
        renderTable(allCustomers);
        filterCustomers(); // Initialize search

    } catch (error) {
        console.error("Dashboard load error:", error);
        list.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Error loading data. Check console.</td></tr>';
    }
};

// Search Function - IMPROVED
window.filterCustomers = () => {
    const queryText = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const list = document.getElementById('customer-list');
    
    if (!list) return;
    
    if (!queryText.trim()) {
        renderTable(allCustomers);
        return;
    }

    const filtered = allCustomers.filter(c => {
        return (
            (c.name && c.name.toLowerCase().includes(queryText)) ||
            (c.customId && c.customId.toString().includes(queryText)) ||
            (c.phone && c.phone.includes(queryText)) ||
            (c.address && c.address.toLowerCase().includes(queryText)) ||
            (c.email && c.email.toLowerCase().includes(queryText))
        );
    });
    
    renderTable(filtered);
};

function renderTable(customers) {
    const list = document.getElementById('customer-list');
    if (!list) return;
    
    list.innerHTML = '';

    if (customers.length === 0) {
        list.innerHTML = `
            <tr>
                <td colspan="5" class="text-center p-8">
                    <i class="fas fa-search text-gray-500 text-2xl mb-2 block"></i>
                    <p class="text-gray-400">No customers found</p>
                </td>
            </tr>`;
        return;
    }

    customers.forEach(c => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-700 hover:bg-gray-800/50 transition";
        
        // Calculate remaining amount
        let paid = 0;
        if(c.installments) {
            c.installments.forEach(i => { 
                if(i.status === 'Paid') paid += (i.amount || 0); 
            });
        }
        const remaining = (c.productTotal || 0) - paid;
        
        row.innerHTML = `
            <td class="p-4">
                <span class="text-purple-400 font-bold">#${c.customId || 'N/A'}</span>
            </td>
            <td class="p-4">
                <div class="flex items-center">
                    <img src="${c.imageUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name || 'C') + '&background=7C3AED&color=fff'}" 
                         class="w-10 h-10 rounded-full object-cover mr-3 border border-purple-500/50">
                    <div>
                        <span class="block font-medium text-white">${c.name || 'No Name'}</span>
                        <span class="text-xs text-gray-500">${c.email || ''}</span>
                    </div>
                </div>
            </td>
            <td class="p-4 hidden md:table-cell text-gray-300">${c.phone || 'N/A'}</td>
            <td class="p-4">
                <div class="font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-400'}">
                    ₹${remaining.toLocaleString()}
                </div>
                <div class="text-xs text-gray-500">of ₹${(c.productTotal || 0).toLocaleString()}</div>
            </td>
            <td class="p-4">
                <a href="customer-profile.html?id=${c.id}" 
                   class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition inline-flex items-center">
                    <i class="fas fa-eye mr-1"></i> View
                </a>
            </td>
        `;
        list.appendChild(row);
    });
}

// ==================== ADD CUSTOMER FUNCTIONS ====================

// Save as Draft Function
window.saveAsDraft = async () => {
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving Draft...';
        btn.disabled = true;
        
        // Get form data
        const formData = getFormData();
        formData.status = 'draft';
        formData.draftSavedAt = new Date().toISOString();
        
        await addDoc(collection(db, "customers"), formData);
        
        alert("✅ Draft saved successfully!");
        btn.innerHTML = originalText;
        btn.disabled = false;
        
    } catch (error) {
        alert("Error saving draft: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Submit Customer Function - FIXED (Images optional, no Firebase Storage errors)
window.submitCustomer = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving Customer...';
        btn.disabled = true;
        
        // Get form data
        const formData = getFormData();
        formData.status = 'active';
        
        // Generate sequential ID
        const querySnapshot = await getDocs(collection(db, "customers"));
        const nextId = 1000 + querySnapshot.size + 1;
        formData.customId = nextId.toString();
        
        // Handle image uploads (OPTIONAL - won't break if storage not setup)
        try {
            const photoFile = document.getElementById('photo').files[0];
            const cnicFile = document.getElementById('cnicPhoto').files[0];
            const cnicBackFile = document.getElementById('cnicBackPhoto').files[0];
            
            if (photoFile) {
                const photoRef = ref(storage, `customers/${formData.customId}_photo_${Date.now()}`);
                await uploadBytes(photoRef, photoFile);
                formData.imageUrl = await getDownloadURL(photoRef);
            }
            
            if (cnicFile) {
                const cnicRef = ref(storage, `customers/${formData.customId}_cnic_${Date.now()}`);
                await uploadBytes(cnicRef, cnicFile);
                formData.cnicUrl = await getDownloadURL(cnicRef);
            }
            
            if (cnicBackFile) {
                const cnicBackRef = ref(storage, `customers/${formData.customId}_cnic_back_${Date.now()}`);
                await uploadBytes(cnicBackRef, cnicBackFile);
                formData.cnicBackUrl = await getDownloadURL(cnicBackRef);
            }
        } catch (imageError) {
            console.warn("Image upload skipped (optional):", imageError.message);
            // Continue without images - they're optional
        }
        
        // Create installments if total > 0
        if (formData.productTotal > 0) {
            formData.installments = createInstallments(formData);
        }
        
        // Add timestamp
        formData.createdAt = new Date().toISOString();
        
        // Save to Firestore
        await addDoc(collection(db, "customers"), formData);
        
        alert(`✅ Customer Added Successfully!\nCustomer ID: ${formData.customId}\nName: ${formData.name}`);
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        console.error("Submit error:", error);
        alert("Error: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Helper function to get form data
function getFormData() {
    return {
        customId: document.getElementById('customId').value,
        name: document.getElementById('name').value.trim() || 'Unnamed Customer',
        phone: document.getElementById('phone').value.trim() || 'Not Provided',
        email: document.getElementById('email').value.trim() || '',
        address: document.getElementById('address').value.trim() || '',
        productTotal: Number(document.getElementById('total').value) || 0,
        advance: Number(document.getElementById('advance').value) || 0,
        monthly: Number(document.getElementById('monthly').value) || 0,
        guarantor: {
            name: document.getElementById('g-name').value.trim() || '',
            phone: document.getElementById('g-phone').value.trim() || '',
            relation: document.getElementById('g-relation').value.trim() || ''
        },
        notes: document.getElementById('notes').value.trim() || ''
    };
}

// Helper function to create installments
function createInstallments(data) {
    const installments = [];
    
    // Add advance payment as first installment
    if (data.advance > 0) {
        installments.push({
            name: "Advance Payment",
            amount: data.advance,
            date: new Date().toISOString().split('T')[0],
            status: "Paid",
            type: "advance"
        });
    }
    
    // Calculate remaining amount
    let remaining = data.productTotal - data.advance;
    
    // Create monthly installments if monthly amount specified
    if (data.monthly > 0 && remaining > 0) {
        let nextDate = new Date();
        let count = 1;
        
        while (remaining > 0) {
            nextDate.setMonth(nextDate.getMonth() + 1);
            let amount = Math.min(data.monthly, remaining);
            
            installments.push({
                name: `Installment #${count}`,
                amount: amount,
                date: nextDate.toISOString().split('T')[0],
                status: "Pending",
                type: "monthly"
            });
            
            remaining -= amount;
            count++;
            
            // Safety break
            if (count > 60) break; // Max 5 years of installments
        }
    } else if (remaining > 0) {
        // Single installment for remaining amount
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);
        
        installments.push({
            name: "Balance Payment",
            amount: remaining,
            date: nextDate.toISOString().split('T')[0],
            status: "Pending",
            type: "balance"
        });
    }
    
    return installments;
}

// ==================== PROFILE FUNCTIONS ====================

window.loadProfile = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if(!id) {
        document.getElementById('profile-content').innerHTML = `
            <div class="text-center p-8">
                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                <h2 class="text-xl font-bold text-white">Customer Not Found</h2>
                <p class="text-gray-400 mt-2">No customer ID specified in URL</p>
                <a href="dashboard.html" class="btn-primary inline-block mt-4 px-6 py-2 rounded-lg">Back to Dashboard</a>
            </div>`;
        return;
    }

    try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Set basic info
            document.getElementById('p-custom-id').innerText = data.customId || 'N/A';
            document.getElementById('p-name').innerText = data.name || 'Unnamed Customer';
            document.getElementById('p-phone').innerText = data.phone || 'Not Provided';
            document.getElementById('p-phone-full').innerText = data.phone || 'Not Provided';
            document.getElementById('p-email').innerText = data.email || 'Not provided';
            document.getElementById('p-email-full').innerText = data.email || 'Not provided';
            document.getElementById('p-address').innerText = data.address || 'Not provided';
            document.getElementById('p-g-name').innerText = data.guarantor?.name || 'Not provided';
            document.getElementById('p-g-phone').innerText = data.guarantor?.phone || 'Not provided';
            document.getElementById('p-g-relation').innerText = data.guarantor?.relation || 'Not provided';
            document.getElementById('p-notes-text').innerText = data.notes || 'No additional notes provided.';
            
            // Set images
            document.getElementById('p-img').src = data.imageUrl || 
                'https://ui-avatars.com/api/?name=' + encodeURIComponent(data.name || 'C') + '&background=7C3AED&color=fff&size=150';
            
            document.getElementById('p-cnic-img').src = data.cnicUrl || 
                'https://via.placeholder.com/300x200/1e293b/7C3AED?text=CNIC+Front+Not+Uploaded';
            
            if (data.cnicBackUrl) {
                document.getElementById('p-cnic-back-img').src = data.cnicBackUrl;
                document.getElementById('p-cnic-back-img').style.display = 'block';
            }
            
            // Calculate payment info
            let paid = 0;
            if(data.installments) {
                data.installments.forEach(i => { 
                    if(i.status === 'Paid') paid += (i.amount || 0); 
                });
            }
            
            const productTotal = data.productTotal || 0;
            const remaining = productTotal - paid;
            const percentage = productTotal > 0 ? (paid / productTotal) * 100 : 0;
            
            document.getElementById('p-total').innerText = '₹' + productTotal.toLocaleString();
            document.getElementById('p-paid').innerText = '₹' + paid.toLocaleString();
            document.getElementById('p-remaining').innerText = '₹' + remaining.toLocaleString();
            document.getElementById('p-bar').style.width = `${percentage}%`;
            
            // Set created date
            if (data.createdAt) {
                const date = new Date(data.createdAt);
                document.getElementById('p-created').innerText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            
            // Render installments
            const tbody = document.getElementById('installment-rows');
            tbody.innerHTML = '';
            
            if(data.installments && data.installments.length > 0) {
                data.installments.forEach((inst, index) => {
                    const tr = document.createElement('tr');
                    const isPaid = inst.status === 'Paid';
                    tr.className = "border-b border-gray-700 hover:bg-gray-800/30";
                    tr.innerHTML = `
                        <td class="p-3 text-sm">${inst.name || `Payment ${index+1}`}</td>
                        <td class="p-3 text-sm">${inst.date || 'Not set'}</td>
                        <td class="p-3 font-bold">₹${(inst.amount || 0).toLocaleString()}</td>
                        <td class="p-3">
                            <span class="px-2 py-1 rounded text-xs ${isPaid ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}">
                                ${inst.status || 'Pending'}
                            </span>
                        </td>
                        <td class="p-3 no-print">
                            ${!isPaid ? 
                                `<button onclick="markPaid('${id}', ${index})" class="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-xs text-white transition">
                                    <i class="fas fa-check mr-1"></i>Mark Paid
                                </button>` : 
                                '<span class="text-green-400"><i class="fas fa-check-circle"></i></span>'
                            }
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-4 text-center text-gray-400">
                            No installment schedule created.
                        </td>
                    </tr>`;
            }
            
            // Setup WhatsApp button
            const msg = `*Naeem Khan Traders - Customer Report*
📋 *Customer:* ${data.name}
🆔 *ID:* ${data.customId || 'N/A'}
📞 *Phone:* ${data.phone || 'N/A'}
💰 *Total:* ₹${productTotal.toLocaleString()}
✅ *Paid:* ₹${paid.toLocaleString()}
⏳ *Remaining:* ₹${remaining.toLocaleString()}
🔗 *Profile Link:* ${window.location.href}`;
            
            document.getElementById('whatsapp-btn').onclick = () => {
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            };
            
            // Show/hide notes section
            if (!data.notes) {
                document.getElementById('p-notes').style.display = 'none';
            }
            
        } else {
            document.getElementById('profile-content').innerHTML = `
                <div class="text-center p-8">
                    <i class="fas fa-user-slash text-red-500 text-4xl mb-4"></i>
                    <h2 class="text-xl font-bold text-white">Customer Not Found</h2>
                    <p class="text-gray-400 mt-2">The requested customer does not exist or has been deleted.</p>
                    <a href="dashboard.html" class="btn-primary inline-block mt-4 px-6 py-2 rounded-lg">Back to Dashboard</a>
                </div>`;
        }
    } catch (error) {
        console.error("Profile load error:", error);
        document.getElementById('profile-content').innerHTML = `
            <div class="text-center p-8">
                <i class="fas fa-exclamation-circle text-red-500 text-4xl mb-4"></i>
                <h2 class="text-xl font-bold text-white">Error Loading Profile</h2>
                <p class="text-gray-400 mt-2">${error.message}</p>
                <a href="dashboard.html" class="btn-primary inline-block mt-4 px-6 py-2 rounded-lg">Back to Dashboard</a>
            </div>`;
    }
};

window.markPaid = async (customerId, index) => {
    const pin = prompt("Enter Admin PIN to mark as paid:");
    if (pin !== ADMIN_PIN) { 
        alert("❌ Wrong PIN! Access denied."); 
        return; 
    }

    try {
        const customerRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(customerRef);
        const data = docSnap.data();
        
        if (data.installments && data.installments[index]) {
            data.installments[index].status = "Paid";
            data.installments[index].paidDate = new Date().toISOString().split('T')[0];
            
            await updateDoc(customerRef, { 
                installments: data.installments 
            });
            
            alert("✅ Installment marked as paid!");
            setTimeout(() => location.reload(), 500);
        } else {
            alert("❌ Installment not found!");
        }
    } catch (error) { 
        alert("Error: " + error.message); 
    }
};

window.downloadPDF = () => {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('profile-content');
    
    // Show loading
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating PDF...';
    btn.disabled = true;
    
    html2canvas(element, { 
        scale: 2, 
        backgroundColor: "#0F172A",
        useCORS: true,
        logging: false
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        // Get customer name for filename
        const customerName = document.getElementById('p-name').innerText.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `customer_${customerName}_${new Date().getTime()}.pdf`;
        
        pdf.save(filename);
        
        // Restore button
        btn.innerHTML = originalText;
        btn.disabled = false;
    }).catch(error => {
        console.error("PDF generation error:", error);
        alert("Error generating PDF: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Auto-generate customer ID for add-customer page
    const customIdField = document.getElementById('customId');
    if (customIdField) {
        customIdField.value = Math.floor(1000 + Math.random() * 9000);
    }
    
    // Add loading animation to all buttons with spinner class
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.innerHTML.includes('fa-spinner')) {
                this.disabled = true;
            }
        });
    });
});

// Make functions available globally
window.clearForm = () => {
    if (confirm("Clear all form data? This cannot be undone.")) {
        document.getElementById('customerForm').reset();
        document.getElementById('customId').value = Math.floor(1000 + Math.random() * 9000);
    }
};
