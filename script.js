// ===== FIREBASE CONFIGURATION & INITIALIZATION =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where, orderBy, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyCujiWEwr3657z7L6mI9xmIwMZjYJchoJc",
    authDomain: "naeem-khan-f7d4f.firebaseapp.com",
    projectId: "naeem-khan-f7d4f",
    storageBucket: "naeem-khan-f7d4f.firebasestorage.app",
    messagingSenderId: "20329827636",
    appId: "1:20329827636:web:6bc934919ca09e683f2961",
    measurementId: "G-DHCVE17PDS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ===== GLOBAL STATE & CONSTANTS =====
const ADMIN_PIN = "134047";
let currentUserRole = "staff"; // 'staff' or 'admin'
let currentCustomerId = null;
let allCustomers = [];

// ===== UTILITY FUNCTIONS =====
function formatCurrency(amount) {
    return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function generateTrackingId() {
    const prefix = "NKT";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <div>${message}</div>
    `;
    
    document.querySelector('.container').prepend(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function calculateRemainingBalance(customer) {
    const totalPrice = parseFloat(customer.totalPrice) || 0;
    const advancePayment = parseFloat(customer.advancePayment) || 0;
    const totalPaid = parseFloat(customer.totalPaid) || 0;
    
    return totalPrice - advancePayment - totalPaid;
}

// ===== AUTHENTICATION & ROLE MANAGEMENT =====
function initializeAuth() {
    const loginAdminBtn = document.getElementById('loginAdminBtn');
    const loginStaffBtn = document.getElementById('loginStaffBtn');
    const pinInput = document.getElementById('pinInput');
    
    if (loginAdminBtn) {
        loginAdminBtn.addEventListener('click', () => {
            const enteredPin = pinInput ? pinInput.value : '';
            
            if (enteredPin === ADMIN_PIN) {
                currentUserRole = "admin";
                localStorage.setItem('nkt_user_role', 'admin');
                showAlert("Admin access granted!", "success");
                setTimeout(() => window.location.href = "dashboard.html", 1000);
            } else {
                showAlert("Incorrect PIN. Entering as Staff.", "error");
                currentUserRole = "staff";
                localStorage.setItem('nkt_user_role', 'staff');
                setTimeout(() => window.location.href = "dashboard.html", 1500);
            }
        });
    }
    
    if (loginStaffBtn) {
        loginStaffBtn.addEventListener('click', () => {
            currentUserRole = "staff";
            localStorage.setItem('nkt_user_role', 'staff');
            window.location.href = "dashboard.html";
        });
    }
    
    // Check existing session
    const savedRole = localStorage.getItem('nkt_user_role');
    if (savedRole && window.location.pathname.includes('index.html')) {
        currentUserRole = savedRole;
        window.location.href = "dashboard.html";
    }
}

function applyRoleBasedUI() {
    const isAdmin = currentUserRole === "admin";
    
    // Update badge in dashboard
    const accessBadge = document.getElementById('accessBadge');
    if (accessBadge) {
        accessBadge.textContent = isAdmin ? "Admin Mode" : "Staff Mode";
        accessBadge.className = isAdmin ? "badge admin-badge" : "badge staff-badge";
    }
    
    // Enable/disable admin buttons
    const adminButtons = document.querySelectorAll('[data-requires-admin="true"]');
    adminButtons.forEach(btn => {
        btn.disabled = !isAdmin;
    });
    
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    if (addCustomerBtn) {
        addCustomerBtn.disabled = !isAdmin;
    }
    
    const adminActionsCard = document.getElementById('adminActionsCard');
    if (adminActionsCard) {
        adminActionsCard.style.display = isAdmin ? "block" : "none";
    }
    
    const paymentEntryForm = document.getElementById('paymentEntryForm');
    if (paymentEntryForm) {
        paymentEntryForm.style.display = isAdmin ? "block" : "none";
    }
}

// ===== CUSTOMER MANAGEMENT =====
async function saveCustomer(customerData, images = {}) {
    try {
        // Generate tracking ID if not exists
        if (!customerData.trackingId) {
            customerData.trackingId = generateTrackingId();
        }
        
        // Set timestamps
        customerData.createdAt = Timestamp.now();
        customerData.updatedAt = Timestamp.now();
        
        // Upload images to Firebase Storage
        const imageUrls = {};
        for (const [key, file] of Object.entries(images)) {
            if (file) {
                const storageRef = ref(storage, `customers/${customerData.trackingId}/${key}`);
                await uploadBytes(storageRef, file);
                imageUrls[key] = await getDownloadURL(storageRef);
            }
        }
        
        // Merge image URLs with customer data
        const completeData = { ...customerData, ...imageUrls };
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, "customers"), completeData);
        
        showAlert(`Customer ${customerData.fullName} saved successfully! Tracking ID: ${customerData.trackingId}`, "success");
        
        // Redirect to dashboard after delay
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 2000);
        
        return docRef.id;
    } catch (error) {
        console.error("Error saving customer:", error);
        showAlert("Error saving customer. Please try again.", "error");
        throw error;
    }
}

async function loadCustomers() {
    try {
        const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        allCustomers = [];
        const customersList = [];
        
        querySnapshot.forEach((doc) => {
            const customer = { id: doc.id, ...doc.data() };
            allCustomers.push(customer);
            customersList.push(customer);
        });
        
        return customersList;
    } catch (error) {
        console.error("Error loading customers:", error);
        showAlert("Error loading customers.", "error");
        return [];
    }
}

async function searchCustomers(searchTerm) {
    if (!searchTerm.trim()) {
        return allCustomers;
    }
    
    const term = searchTerm.toLowerCase();
    return allCustomers.filter(customer => {
        return (
            (customer.fullName && customer.fullName.toLowerCase().includes(term)) ||
            (customer.cnicNumber && customer.cnicNumber.toLowerCase().includes(term)) ||
            (customer.trackingId && customer.trackingId.toLowerCase().includes(term)) ||
            (customer.phone1 && customer.phone1.includes(term))
        );
    });
}

async function getCustomerById(customerId) {
    try {
        const docRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            showAlert("Customer not found.", "error");
            return null;
        }
    } catch (error) {
        console.error("Error getting customer:", error);
        showAlert("Error loading customer details.", "error");
        return null;
    }
}

async function updateCustomer(customerId, updateData) {
    try {
        const docRef = doc(db, "customers", customerId);
        updateData.updatedAt = Timestamp.now();
        await updateDoc(docRef, updateData);
        
        showAlert("Customer updated successfully!", "success");
        return true;
    } catch (error) {
        console.error("Error updating customer:", error);
        showAlert("Error updating customer.", "error");
        return false;
    }
}

async function deleteCustomer(customerId) {
    if (!confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
        return false;
    }
    
    try {
        const docRef = doc(db, "customers", customerId);
        await deleteDoc(docRef);
        
        showAlert("Customer deleted successfully.", "success");
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1500);
        return true;
    } catch (error) {
        console.error("Error deleting customer:", error);
        showAlert("Error deleting customer.", "error");
        return false;
    }
}

// ===== PAYMENT MANAGEMENT =====
async function recordPayment(customerId, paymentData) {
    try {
        // Get current customer
        const customer = await getCustomerById(customerId);
        if (!customer) return false;
        
        // Create payment record
        const paymentRecord = {
            customerId,
            customerName: customer.fullName,
            amount: parseFloat(paymentData.amount),
            date: paymentData.date || new Date().toISOString().split('T')[0],
            method: paymentData.method || "Cash",
            notes: paymentData.notes || "",
            recordedAt: Timestamp.now(),
            recordedBy: currentUserRole
        };
        
        // Save payment to subcollection
        const paymentsRef = collection(db, "customers", customerId, "payments");
        await addDoc(paymentsRef, paymentRecord);
        
        // Update customer's total paid
        const currentTotal = parseFloat(customer.totalPaid) || 0;
        const newTotal = currentTotal + paymentRecord.amount;
        
        await updateDoc(doc(db, "customers", customerId), {
            totalPaid: newTotal,
            lastPaymentDate: paymentRecord.date,
            updatedAt: Timestamp.now()
        });
        
        showAlert(`Payment of ${formatCurrency(paymentRecord.amount)} recorded successfully!`, "success");
        return true;
    } catch (error) {
        console.error("Error recording payment:", error);
        showAlert("Error recording payment.", "error");
        return false;
    }
}

async function loadPayments(customerId) {
    try {
        const paymentsRef = collection(db, "customers", customerId, "payments");
        const q = query(paymentsRef, orderBy("recordedAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        const payments = [];
        querySnapshot.forEach((doc) => {
            payments.push({ id: doc.id, ...doc.data() });
        });
        
        return payments;
    } catch (error) {
        console.error("Error loading payments:", error);
        return [];
    }
}

// ===== DASHBOARD FUNCTIONS =====
function updateDashboardStats(customers) {
    const totalCustomers = customers.length;
    const totalPending = customers.reduce((sum, customer) => sum + calculateRemainingBalance(customer), 0);
    const dueThisMonth = customers.filter(customer => {
        const remaining = calculateRemainingBalance(customer);
        const monthly = parseFloat(customer.monthlyInstallment) || 0;
        return remaining > 0 && monthly > 0;
    }).length;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthReceived = customers.reduce((sum, customer) => {
        // This would need actual payment data by month
        return sum + (parseFloat(customer.totalPaid) || 0);
    }, 0) * 0.1; // Simplified for demo
    
    document.getElementById('totalCustomers').textContent = totalCustomers;
    document.getElementById('totalPending').textContent = formatCurrency(totalPending);
    document.getElementById('dueThisMonth').textContent = dueThisMonth;
    document.getElementById('monthReceived').textContent = formatCurrency(monthReceived);
}

function renderDuePayments(customers) {
    const dueList = document.getElementById('dueList');
    if (!dueList) return;
    
    const dueCustomers = customers.filter(customer => {
        const remaining = calculateRemainingBalance(customer);
        const monthly = parseFloat(customer.monthlyInstallment) || 0;
        return remaining > 0 && monthly > 0;
    }).slice(0, 10); // Show top 10
    
    if (dueCustomers.length === 0) {
        dueList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>No due payments found for this month.</p>
            </div>
        `;
        return;
    }
    
    dueList.innerHTML = dueCustomers.map(customer => {
        const remaining = calculateRemainingBalance(customer);
        const monthly = parseFloat(customer.monthlyInstallment) || 0;
        const dueMonths = Math.ceil(remaining / monthly);
        
        return `
            <div class="due-item" data-customer-id="${customer.id}">
                <div class="due-info">
                    <h4>${customer.fullName || "Unnamed Customer"}</h4>
                    <div class="due-meta">
                        <span>ID: ${customer.trackingId || "N/A"}</span>
                        <span>Due: ${dueMonths} month${dueMonths !== 1 ? 's' : ''}</span>
                        <span>Installment: ${formatCurrency(monthly)}</span>
                    </div>
                </div>
                <div class="due-actions">
                    <div class="due-amount">${formatCurrency(remaining)}</div>
                    ${currentUserRole === 'admin' ? 
                        `<button class="receive-payment-btn" onclick="quickReceivePayment('${customer.id}')">
                            <i class="fas fa-money-bill-wave"></i> Receive
                        </button>` : 
                        ''
                    }
                </div>
            </div>
        `;
    }).join('');
}

function renderCustomerTable(customers) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    if (customers.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state">
                        <i class="fas fa-user-plus"></i>
                        <p>No customers found. Add your first customer!</p>
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('resultsCount').textContent = '0';
        return;
    }
    
    tbody.innerHTML = customers.map(customer => {
        const remaining = calculateRemainingBalance(customer);
        const monthly = parseFloat(customer.monthlyInstallment) || 0;
        
        let status = "active";
        let statusText = "Active";
        if (remaining <= 0) {
            status = "completed";
            statusText = "Completed";
        } else if (remaining > monthly * 3) {
            status = "overdue";
            statusText = "Overdue";
        }
        
        return `
            <tr>
                <td><strong>${customer.trackingId || "N/A"}</strong></td>
                <td>
                    <div class="customer-name">${customer.fullName || "Unnamed Customer"}</div>
                    <div class="customer-meta">${customer.cnicNumber || "No CNIC"}</div>
                </td>
                <td><strong>${formatCurrency(remaining)}</strong></td>
                <td>${formatCurrency(monthly)}</td>
                <td><span class="status-badge status-${status}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="viewCustomerDetails('${customer.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${currentUserRole === 'admin' ? `
                            <button class="btn-icon" onclick="editCustomer('${customer.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('resultsCount').textContent = customers.length;
}

// ===== FORM HANDLING =====
function initializeCustomerForm() {
    const form = document.getElementById('customerForm');
    if (!form) return;
    
    // Section navigation
    const sections = document.querySelectorAll('.form-section');
    const sectionDots = document.querySelectorAll('.section-dot');
    let currentSectionIndex = 0;
    
    function showSection(index) {
        sections.forEach((section, i) => {
            section.classList.toggle('active', i === index);
        });
        
        sectionDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
        
        document.getElementById('prevSectionBtn').disabled = index === 0;
        document.getElementById('nextSectionBtn').disabled = index === sections.length - 1;
        
        currentSectionIndex = index;
    }
    
    // Section dot click handlers
    sectionDots.forEach((dot, index) => {
        dot.addEventListener('click', () => showSection(index));
    });
    
    document.getElementById('nextSectionBtn').addEventListener('click', () => {
        if (currentSectionIndex < sections.length - 1) {
            showSection(currentSectionIndex + 1);
        }
    });
    
    document.getElementById('prevSectionBtn').addEventListener('click', () => {
        if (currentSectionIndex > 0) {
            showSection(currentSectionIndex - 1);
        }
    });
    
    // Financial calculations
    const financialInputs = ['totalPrice', 'advancePayment', 'monthlyInstallment'];
    financialInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', updateFinancialPreview);
        }
    });
    
    function updateFinancialPreview() {
        const total = parseFloat(document.getElementById('totalPrice').value) || 0;
        const advance = parseFloat(document.getElementById('advancePayment').value) || 0;
        const monthly = parseFloat(document.getElementById('monthlyInstallment').value) || 0;
        const remaining = total - advance;
        
        document.getElementById('previewTotal').textContent = formatCurrency(total);
        document.getElementById('previewAdvance').textContent = formatCurrency(advance);
        document.getElementById('previewMonthly').textContent = formatCurrency(monthly);
        document.getElementById('previewRemaining').textContent = formatCurrency(remaining);
    }
    
    // Image preview handling
    const imageInputs = ['customerPhoto', 'cnicFront', 'cnicBack', 'guarantorPhoto'];
    imageInputs.forEach(id => {
        const input = document.getElementById(id);
        const previewId = `preview${id.charAt(0).toUpperCase() + id.slice(1)}`;
        const preview = document.getElementById(previewId);
        
        if (input && preview) {
            input.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });
    
    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const saveBtn = document.getElementById('saveCustomerBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            // Collect form data
            const customerData = {
                fullName: document.getElementById('fullName').value.trim(),
                fatherName: document.getElementById('fatherName').value.trim(),
                cnicNumber: document.getElementById('cnicNumber').value.trim(),
                phone1: document.getElementById('phone1').value.trim(),
                phone2: document.getElementById('phone2').value.trim(),
                residentialAddress: document.getElementById('residentialAddress').value.trim(),
                permanentAddress: document.getElementById('permanentAddress').value.trim(),
                googleMapsLink: document.getElementById('googleMapsLink').value.trim(),
                jobTitle: document.getElementById('jobTitle').value.trim(),
                workAddress: document.getElementById('workAddress').value.trim(),
                workPhone: document.getElementById('workPhone').value.trim(),
                guarantorName: document.getElementById('guarantorName').value.trim(),
                guarantorCnic: document.getElementById('guarantorCnic').value.trim(),
                guarantorPhone: document.getElementById('guarantorPhone').value.trim(),
                guarantorAddress: document.getElementById('guarantorAddress').value.trim(),
                productName: document.getElementById('productName').value.trim(),
                modelNumber: document.getElementById('modelNumber').value.trim(),
                totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
                advancePayment: parseFloat(document.getElementById('advancePayment').value) || 0,
                monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value) || 0,
                installmentStartDate: document.getElementById('installmentStartDate').value,
                totalPaid: 0,
                lastPaymentDate: null
            };
            
            // Validate at least name is provided
            if (!customerData.fullName) {
                showAlert("Please enter at least the customer's name.", "error");
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Customer Record';
                return;
            }
            
            // Collect image files
            const images = {};
            imageInputs.forEach(id => {
                const input = document.getElementById(id);
                if (input && input.files[0]) {
                    images[id] = input.files[0];
                }
            });
            
            // Save customer
            await saveCustomer(customerData, images);
            
        } catch (error) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Customer Record';
        }
    });
    
    // Form reset
    document.getElementById('resetFormBtn').addEventListener('click', function() {
        if (confirm("Are you sure you want to reset the form? All entered data will be lost.")) {
            form.reset();
            document.querySelectorAll('.image-preview').forEach(preview => {
                preview.innerHTML = '';
            });
            updateFinancialPreview();
            showSection(0);
        }
    });
}

// ===== CUSTOMER DETAILS PAGE =====
async function loadCustomerDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('id') || document.getElementById('customerId').value;
    
    if (!customerId) {
        showAlert("No customer specified.", "error");
        setTimeout(() => window.location.href = "dashboard.html", 2000);
        return;
    }
    
    currentCustomerId = customerId;
    
    const customer = await getCustomerById(customerId);
    if (!customer) return;
    
    // Update header
    document.getElementById('customerName').textContent = customer.fullName || "Unnamed Customer";
    document.getElementById('customerCnic').textContent = customer.cnicNumber || "N/A";
    document.getElementById('customerPhone').textContent = customer.phone1 || "N/A";
    document.getElementById('joinDate').textContent = formatDate(customer.createdAt?.toDate());
    document.getElementById('trackingIdDisplay').textContent = `ID: ${customer.trackingId || "N/A"}`;
    
    // Update financial summary
    const remaining = calculateRemainingBalance(customer);
    const monthly = parseFloat(customer.monthlyInstallment) || 0;
    const totalPaid = parseFloat(customer.totalPaid) || 0;
    
    document.getElementById('remainingBalance').textContent = formatCurrency(remaining);
    document.getElementById('monthlyAmount').textContent = formatCurrency(monthly);
    document.getElementById('totalPaid').textContent = formatCurrency(totalPaid);
    
    // Update product information
    document.getElementById('detailProductName').textContent = customer.productName || "N/A";
    document.getElementById('detailModelNumber').textContent = customer.modelNumber || "N/A";
    document.getElementById('detailTotalPrice').textContent = formatCurrency(customer.totalPrice);
    document.getElementById('detailAdvance').textContent = formatCurrency(customer.advancePayment);
    document.getElementById('detailStartDate').textContent = formatDate(customer.installmentStartDate);
    
    // Update contact information
    document.getElementById('detailResidential').textContent = customer.residentialAddress || "N/A";
    document.getElementById('detailPermanent').textContent = customer.permanentAddress || "N/A";
    document.getElementById('detailPhone1').textContent = customer.phone1 || "N/A";
    document.getElementById('detailPhone2').textContent = customer.phone2 || "N/A";
    
    if (customer.googleMapsLink) {
        document.getElementById('googleMapsRow').style.display = 'flex';
        document.getElementById('detailMapsLink').href = customer.googleMapsLink;
    }
    
    // Update guarantor information
    document.getElementById('detailGuarantorName').textContent = customer.guarantorName || "N/A";
    document.getElementById('detailGuarantorCnic').textContent = customer.guarantorCnic || "N/A";
    document.getElementById('detailGuarantorPhone').textContent = customer.guarantorPhone || "N/A";
    document.getElementById('detailGuarantorAddress').textContent = customer.guarantorAddress || "N/A";
    
    // Load and display payments
    const payments = await loadPayments(customerId);
    renderPayments(payments);
    
    // Update payment stats
    if (payments.length > 0) {
        const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        const lastPayment = payments[0];
        
        document.getElementById('paymentTotal').textContent = formatCurrency(totalPaid);
        document.getElementById('lastPaymentDate').textContent = formatDate(lastPayment.date);
    }
    
    // Load profile image if exists
    if (customer.customerPhoto) {
        const profileImg = document.getElementById('profileImage');
        profileImg.innerHTML = `<img src="${customer.customerPhoto}" alt="${customer.fullName}">`;
    }
}

function renderPayments(payments) {
    const paymentList = document.getElementById('paymentList');
    
    if (!payments || payments.length === 0) {
        paymentList.innerHTML = `
            <div class="empty-payments">
                <i class="fas fa-file-invoice-dollar"></i>
                <h4>No Payments Recorded</h4>
                <p>Click "Record Payment" to add the first payment.</p>
            </div>
        `;
        return;
    }
    
    paymentList.innerHTML = payments.map(payment => {
        return `
            <div class="payment-item">
                <div class="payment-item-header">
                    <div class="payment-date">${formatDate(payment.date)}</div>
                    <span class="payment-method">${payment.method}</span>
                </div>
                <div class="payment-amount">${formatCurrency(payment.amount)}</div>
                ${payment.notes ? `<div class="payment-notes">${payment.notes}</div>` : ''}
            </div>
        `;
    }).join('');
}

function initializePaymentForm() {
    const form = document.getElementById('paymentEntryForm');
    if (!form) return;
    
    // Set default date to today
    document.getElementById('paymentDate').valueAsDate = new Date();
    
    // Payment submission
    document.getElementById('submitPaymentBtn').addEventListener('click', async function() {
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const date = document.getElementById('paymentDate').value;
        const method = document.getElementById('paymentMethod').value;
        const notes = document.getElementById('paymentNotes').value;
        
        if (!amount || amount <= 0) {
            showAlert("Please enter a valid payment amount.", "error");
            return;
        }
        
        if (!date) {
            showAlert("Please select a payment date.", "error");
            return;
        }
        
        const paymentData = { amount, date, method, notes };
        const success = await recordPayment(currentCustomerId, paymentData);
        
        if (success) {
            // Reset form
            document.getElementById('paymentAmount').value = '';
            document.getElementById('paymentDate').valueAsDate = new Date();
            document.getElementById('paymentMethod').value = 'Cash';
            document.getElementById('paymentNotes').value = '';
            
            // Reload customer details
            setTimeout(() => loadCustomerDetails(), 1000);
        }
    });
    
    // Cancel payment
    document.getElementById('cancelPaymentBtn').addEventListener('click', function() {
        document.getElementById('paymentAmount').value = '';
        document.getElementById('paymentNotes').value = '';
    });
}

// ===== PRINT RECEIPT FUNCTIONALITY =====
function printReceipt(payment) {
    const receipt = document.getElementById('whatsappReceipt');
    const customerId = currentCustomerId;
    
    // Get customer data
    getCustomerById(customerId).then(customer => {
        if (!customer) return;
        
        // Update receipt content
        const now = new Date();
        document.getElementById('receiptDate').textContent = now.toLocaleDateString('en-IN');
        document.getElementById('receiptNumber').textContent = `NKT${now.getTime().toString().slice(-8)}`;
        document.getElementById('receiptCustomerName').textContent = customer.fullName;
        document.getElementById('receiptCustomerCnic').textContent = customer.cnicNumber || "N/A";
        document.getElementById('receiptCustomerPhone').textContent = customer.phone1 || "N/A";
        document.getElementById('receiptProduct').textContent = customer.productName || "N/A";
        document.getElementById('receiptTotalPrice').textContent = formatCurrency(customer.totalPrice);
        document.getElementById('receiptAdvance').textContent = formatCurrency(customer.advancePayment);
        
        const remaining = calculateRemainingBalance(customer);
        document.getElementById('receiptRemaining').textContent = formatCurrency(remaining);
        
        if (payment) {
            document.getElementById('receiptAmount').textContent = payment.amount.toLocaleString();
            document.getElementById('receiptMethod').textContent = payment.method;
            document.getElementById('receiptPaymentDate').textContent = formatDate(payment.date);
        } else {
            document.getElementById('receiptAmount').textContent = "0";
            document.getElementById('receiptMethod').textContent = "N/A";
            document.getElementById('receiptPaymentDate').textContent = formatDate(new Date());
        }
        
        // Show receipt and print
        receipt.style.display = 'block';
        window.print();
        receipt.style.display = 'none';
    });
}

// ===== PAGE INITIALIZATION =====
function initializePage() {
    // Get user role from localStorage
    const savedRole = localStorage.getItem('nkt_user_role');
    if (savedRole) {
        currentUserRole = savedRole;
    }
    
    // Apply role-based UI
    applyRoleBasedUI();
    
    // Initialize based on current page
    const currentPage = window.location.pathname.split('/').pop();
    
    switch (currentPage) {
        case 'index.html':
            initializeAuth();
            break;
            
        case 'dashboard.html':
            initializeDashboard();
            break;
            
        case 'add_customer.html':
            initializeCustomerForm();
            initializeNavigation();
            break;
            
        case 'customer_details.html':
            initializeCustomerDetailsPage();
            break;
    }
    
    // Initialize common navigation
    initializeNavigation();
}

function initializeDashboard() {
    // Load and display customers
    loadCustomers().then(customers => {
        updateDashboardStats(customers);
        renderCustomerTable(customers);
        renderDuePayments(customers);
    });
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput && searchBtn) {
        const performSearch = () => {
            const searchTerm = searchInput.value.trim();
            searchCustomers(searchTerm).then(filteredCustomers => {
                renderCustomerTable(filteredCustomers);
            });
        };
        
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    // Add customer button
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', () => {
            window.location.href = "add_customer.html";
        });
    }
    
    // Refresh due payments
    const refreshDueBtn = document.getElementById('refreshDueBtn');
    if (refreshDueBtn) {
        refreshDueBtn.addEventListener('click', () => {
            loadCustomers().then(customers => {
                renderDuePayments(customers);
                showAlert("Due payments refreshed.", "success");
            });
        });
    }
}

function initializeCustomerDetailsPage() {
    loadCustomerDetails();
    initializePaymentForm();
    applyRoleBasedUI();
    
    // Action buttons
    const recordPaymentBtn = document.getElementById('recordPaymentBtn');
    if (recordPaymentBtn) {
        recordPaymentBtn.addEventListener('click', () => {
            document.getElementById('paymentEntryForm').scrollIntoView({ behavior: 'smooth' });
            document.getElementById('paymentAmount').focus();
        });
    }
    
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    if (editCustomerBtn) {
        editCustomerBtn.addEventListener('click', () => {
            showAlert("Edit feature will be implemented in the next version.", "info");
        });
    }
    
    const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');
    if (deleteCustomerBtn) {
        deleteCustomerBtn.addEventListener('click', async () => {
            if (currentCustomerId) {
                await deleteCustomer(currentCustomerId);
            }
        });
    }
    
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', () => {
            printReceipt(null);
        });
    }
}

function initializeNavigation() {
    // Dashboard button
    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.location.href = "dashboard.html";
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('nkt_user_role');
            window.location.href = "index.html";
        });
    }
}

// ===== GLOBAL FUNCTIONS FOR HTML EVENT HANDLERS =====
window.viewCustomerDetails = function(customerId) {
    window.location.href = `customer_details.html?id=${customerId}`;
};

window.editCustomer = function(customerId) {
    if (currentUserRole !== 'admin') {
        showAlert("Only admins can edit customers.", "error");
        return;
    }
    window.location.href = `add_customer.html?edit=${customerId}`;
};

window.quickReceivePayment = async function(customerId) {
    if (currentUserRole !== 'admin') {
        showAlert("Only admins can receive payments.", "error");
        return;
    }
    
    const customer = await getCustomerById(customerId);
    if (!customer) return;
    
    const monthly = parseFloat(customer.monthlyInstallment) || 0;
    if (monthly <= 0) {
        showAlert("This customer has no monthly installment set.", "error");
        return;
    }
    
    const paymentData = {
        amount: monthly,
        date: new Date().toISOString().split('T')[0],
        method: "Cash",
        notes: "Quick payment via dashboard"
    };
    
    const success = await recordPayment(customerId, paymentData);
    if (success) {
        // Update dashboard
        loadCustomers().then(customers => {
            renderDuePayments(customers);
            renderCustomerTable(customers);
            updateDashboardStats(customers);
        });
    }
};

// ===== INITIALIZE APPLICATION =====
document.addEventListener('DOMContentLoaded', initializePage);

// Export for use in HTML event handlers
window.currentUserRole = currentUserRole;
window.calculateRemainingBalance = calculateRemainingBalance;
window.formatCurrency = formatCurrency;
