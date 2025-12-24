// ===== FIREBASE CONFIGURATION (MANDATORY) =====
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase Configuration (Replace with your own if needed)
const firebaseConfig = {
  apiKey: "AIzaSyCujiWEwr3657z7L6mI9xmIwMZjYJchoJc",
  authDomain: "naeem-khan-f7d4f.firebaseapp.com",
  projectId: "naeem-khan-f7d4f",
  storageBucket: "naeem-khan-f7d4f.firebasestorage.app",
  messagingSenderId: "20329827636",
  appId: "1:20329827636:web:6bc934919ca09e683f2961",
  measurementId: "G-DHCVE17PDS"
};

// Initialize Services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ===== GLOBAL VARIABLES =====
let currentUserRole = 'staff';
let currentCustomerId = null;

// ===== SESSION MANAGEMENT =====
function checkLogin() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const role = localStorage.getItem('userRole');
    
    if (!isLoggedIn && !window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html';
        return false;
    }
    
    if (role) {
        currentUserRole = role;
    }
    
    return true;
}

function loadNavigation() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    const role = localStorage.getItem('userRole') || 'staff';
    const isAdmin = role === 'admin';
    
    navbar.innerHTML = `
        <nav class="navbar">
            <div class="nav-container">
                <a href="dashboard.html" class="nav-brand">
                    <i class="fas fa-hand-holding-usd"></i>
                    <span>Naeem Khan Traders</span>
                </a>
                <div class="nav-links">
                    <a href="dashboard.html" class="nav-link ${window.location.pathname.includes('dashboard') ? 'active' : ''}">
                        <i class="fas fa-tachometer-alt"></i> Dashboard
                    </a>
                    <a href="add_customer.html" class="nav-link ${window.location.pathname.includes('add_customer') ? 'active' : ''}">
                        <i class="fas fa-user-plus"></i> Add Customer
                    </a>
                    <div class="user-info ${isAdmin ? 'admin-badge' : ''}">
                        <i class="fas fa-user"></i>
                        <span>${isAdmin ? 'Admin' : 'Staff'}</span>
                        <button onclick="logout()" class="btn-logout">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    `;
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    window.location.href = 'index.html';
}

// ===== IMAGE UPLOAD HANDLING =====
async function uploadImage(file, customerId, imageType) {
    if (!file) return null;
    
    try {
        // Create a unique filename
        const fileName = `${customerId}_${imageType}_${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `customer_images/${customerId}/${fileName}`);
        
        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image. Please try again.');
        return null;
    }
}

// ===== CUSTOMER MANAGEMENT =====
async function saveCustomer(customerData) {
    try {
        // Generate Tracking ID if not provided
        if (!customerData.trackingId || customerData.trackingId.trim() === '') {
            customerData.trackingId = 'NK' + Date.now().toString().slice(-6);
        }
        
        // Calculate remaining balance
        customerData.remainingBalance = customerData.totalPrice - customerData.advancePayment;
        customerData.status = customerData.remainingBalance > 0 ? 'active' : 'completed';
        
        // Add timestamps
        customerData.createdAt = serverTimestamp();
        customerData.updatedAt = serverTimestamp();
        customerData.paymentHistory = [{
            date: new Date().toISOString().split('T')[0],
            amount: customerData.advancePayment,
            type: 'advance',
            balanceAfter: customerData.remainingBalance
        }];
        
        // Save to Firestore
        const customerRef = doc(db, 'customers', customerData.trackingId);
        await setDoc(customerRef, customerData);
        
        return { success: true, trackingId: customerData.trackingId };
    } catch (error) {
        console.error('Error saving customer:', error);
        return { success: false, error: error.message };
    }
}

async function loadCustomers() {
    try {
        const customersRef = collection(db, 'customers');
        const q = query(customersRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const customers = [];
        querySnapshot.forEach((doc) => {
            customers.push({ id: doc.id, ...doc.data() });
        });
        
        return customers;
    } catch (error) {
        console.error('Error loading customers:', error);
        return [];
    }
}

async function recordPayment(customerId, paymentData) {
    try {
        const customerRef = doc(db, 'customers', customerId);
        const customerSnap = await getDoc(customerRef);
        
        if (!customerSnap.exists()) {
            throw new Error('Customer not found');
        }
        
        const customer = customerSnap.data();
        const newBalance = customer.remainingBalance - paymentData.amount;
        
        // Update customer record
        await updateDoc(customerRef, {
            remainingBalance: newBalance,
            status: newBalance <= 0 ? 'completed' : 'active',
            updatedAt: serverTimestamp(),
            paymentHistory: [...(customer.paymentHistory || []), {
                date: paymentData.date,
                amount: paymentData.amount,
                type: 'installment',
                notes: paymentData.notes,
                balanceAfter: newBalance
            }]
        });
        
        return { success: true, newBalance };
    } catch (error) {
        console.error('Error recording payment:', error);
        return { success: false, error: error.message };
    }
}

async function deleteCustomer(customerId) {
    // SECURITY: Check for Admin PIN before deletion
    const pin = prompt('Enter Admin PIN to delete customer:');
    if (pin !== '134047') {
        alert('Access Denied. Incorrect PIN.');
        return { success: false, error: 'Access denied' };
    }
    
    try {
        const customerRef = doc(db, 'customers', customerId);
        await deleteDoc(customerRef);
        return { success: true };
    } catch (error) {
        console.error('Error deleting customer:', error);
        return { success: false, error: error.message };
    }
}

// ===== DASHBOARD FUNCTIONALITY =====
function renderCustomerCards(customers) {
    const container = document.getElementById('customerList');
    if (!container) return;
    
    if (customers.length === 0) {
        container.innerHTML = '<div class="empty-state">No customers found. Add your first customer!</div>';
        return;
    }
    
    let html = '';
    
    customers.forEach(customer => {
        const isCompleted = customer.remainingBalance <= 0;
        const cardClass = isCompleted ? 'customer-card paid-completed' : 'customer-card';
        
        html += `
            <div class="${cardClass}" data-id="${customer.id}">
                <div class="customer-photo">
                    ${customer.photoUrl ? 
                        `<img src="${customer.photoUrl}" alt="${customer.customerName}">` : 
                        `<i class="fas fa-user-circle"></i>`
                    }
                </div>
                <div class="customer-info">
                    <div class="customer-name">${customer.customerName}</div>
                    <div class="customer-meta">
                        <span><i class="fas fa-id-card"></i> ${customer.id}</span>
                        ${customer.cnic ? `<span><i class="fas fa-address-card"></i> ${customer.cnic}</span>` : ''}
                        <span><i class="fas fa-phone"></i> ${customer.phone}</span>
                    </div>
                    <div class="financial-details">
                        <div class="financial-item">
                            <div class="label">Total Price</div>
                            <div class="value">${customer.totalPrice} PKR</div>
                        </div>
                        <div class="financial-item">
                            <div class="label">Paid</div>
                            <div class="value paid">${customer.totalPrice - customer.remainingBalance} PKR</div>
                        </div>
                        <div class="financial-item">
                            <div class="label">Remaining</div>
                            <div class="value remaining">${customer.remainingBalance} PKR</div>
                        </div>
                    </div>
                </div>
                <div class="customer-actions">
                    <button onclick="viewCustomerDetails('${customer.id}')" class="btn-outline" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="openPaymentModal('${customer.id}')" class="btn-secondary" title="Pay Installment">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                    <button onclick="deleteCustomerPrompt('${customer.id}', '${customer.customerName}')" class="btn-danger" title="Delete Customer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    updateDashboardStats(customers);
}

function updateDashboardStats(customers) {
    const totalCustomers = customers.length;
    const activeLoans = customers.filter(c => c.remainingBalance > 0).length;
    const completedLoans = customers.filter(c => c.remainingBalance <= 0).length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalPrice - c.remainingBalance), 0);
    
    // Update DOM elements if they exist
    if (document.getElementById('totalCustomers')) {
        document.getElementById('totalCustomers').textContent = totalCustomers;
    }
    if (document.getElementById('activeLoans')) {
        document.getElementById('activeLoans').textContent = activeLoans;
    }
    if (document.getElementById('completedLoans')) {
        document.getElementById('completedLoans').textContent = completedLoans;
    }
    if (document.getElementById('totalRevenue')) {
        document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString() + ' PKR';
    }
}

// ===== EVENT LISTENERS & INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Check login status on all pages except login
    if (!window.location.pathname.includes('index.html')) {
        checkLogin();
        loadNavigation();
    }
    
    // Initialize page-specific functionality
    if (window.location.pathname.includes('add_customer.html')) {
        initAddCustomerPage();
    } else if (window.location.pathname.includes('dashboard.html')) {
        initDashboardPage();
    }
});

function initAddCustomerPage() {
    // Set today's date as default for start date
    document.getElementById('startDate').valueAsDate = new Date();
    
    // Calculate balance when financial inputs change
    document.getElementById('totalPrice')?.addEventListener('input', updateBalance);
    document.getElementById('advancePayment')?.addEventListener('input', updateBalance);
    
    // Form submission
    document.getElementById('customerForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleFormSubmit();
    });
    
    // Image preview
    document.getElementById('customerPhoto')?.addEventListener('change', function(e) {
        previewImage(e.target, 'photoPreview');
    });
}

function updateBalance() {
    const totalPrice = parseFloat(document.getElementById('totalPrice').value) || 0;
    const advancePayment = parseFloat(document.getElementById('advancePayment').value) || 0;
    const remaining = totalPrice - advancePayment;
    
    document.getElementById('remainingBalance').value = remaining.toFixed(2);
    document.getElementById('displayTotal').textContent = totalPrice.toFixed(2) + ' PKR';
    document.getElementById('displayAdvance').textContent = advancePayment.toFixed(2) + ' PKR';
    document.getElementById('displayRemaining').textContent = remaining.toFixed(2) + ' PKR';
    
    // Update color based on remaining balance
    const remainingElement = document.getElementById('displayRemaining');
    if (remaining <= 0) {
        remainingElement.style.color = '#28a745';
    } else {
        remainingElement.style.color = '#dc3545';
    }
}

async function handleFormSubmit() {
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    // Collect form data
    const customerData = {
        trackingId: document.getElementById('trackingId').value.trim(),
        customerName: document.getElementById('customerName').value,
        phone: document.getElementById('phone').value,
        cnic: document.getElementById('cnic').value,
        address: document.getElementById('address').value,
        guarantorName: document.getElementById('guarantorName').value,
        guarantorPhone: document.getElementById('guarantorPhone').value,
        guarantorAddress: document.getElementById('guarantorAddress').value,
        productName: document.getElementById('productName').value,
        totalPrice: parseFloat(document.getElementById('totalPrice').value),
        advancePayment: parseFloat(document.getElementById('advancePayment').value),
        monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value),
        startDate: document.getElementById('startDate').value
    };
    
    // Get image files
    const photoFile = document.getElementById('customerPhoto').files[0];
    const cnicFrontFile = document.getElementById('cnicFront').files[0];
    const cnicBackFile = document.getElementById('cnicBack').files[0];
    
    // Generate customer ID for image storage
    const customerId = customerData.trackingId || ('NK' + Date.now().toString().slice(-6));
    
    try {
        // Upload images
        if (photoFile) {
            customerData.photoUrl = await uploadImage(photoFile, customerId, 'photo');
        }
        if (cnicFrontFile) {
            customerData.cnicFrontUrl = await uploadImage(cnicFrontFile, customerId, 'cnic_front');
        }
        if (cnicBackFile) {
            customerData.cnicBackUrl = await uploadImage(cnicBackFile, customerId, 'cnic_back');
        }
        
        // Save customer data
        const result = await saveCustomer(customerData);
        
        if (result.success) {
            alert(`Customer saved successfully! Tracking ID: ${result.trackingId}`);
            document.getElementById('customerForm').reset();
            document.getElementById('startDate').valueAsDate = new Date();
            updateBalance(); // Reset balance display
        } else {
            alert('Error saving customer: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Customer Record';
    }
}

function initDashboardPage() {
    // Load and display customers
    loadCustomers().then(customers => {
        renderCustomerCards(customers);
        
        // Set up search functionality
        document.getElementById('searchInput')?.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = customers.filter(c => 
                c.customerName.toLowerCase().includes(searchTerm) ||
                c.cnic?.toLowerCase().includes(searchTerm) ||
                c.id.toLowerCase().includes(searchTerm)
            );
            renderCustomerCards(filtered);
        });
    });
    
    // Set up payment modal
    setupPaymentModal();
}

function openPaymentModal(customerId) {
    // Load customer data and populate modal
    // Implementation depends on your Firestore structure
    currentCustomerId = customerId;
    document.getElementById('paymentModal').style.display = 'flex';
}

function deleteCustomerPrompt(customerId, customerName) {
    if (confirm(`Are you sure you want to delete customer "${customerName}"? This action requires Admin PIN.`)) {
        deleteCustomer(customerId).then(result => {
            if (result.success) {
                alert('Customer deleted successfully.');
                // Refresh the customer list
                initDashboardPage();
            }
        });
    }
}

// ===== EXPORT FUNCTIONS FOR HTML USE =====
// Make functions available globally for onclick attributes
window.viewCustomerDetails = function(customerId) {
    window.location.href = `customer_details.html?id=${customerId}`;
};

window.openPaymentModal = openPaymentModal;
window.deleteCustomerPrompt = deleteCustomerPrompt;
window.logout = logout;
window.shareReceipt = function() {
    // Implementation for WhatsApp sharing
    const customerName = document.getElementById('invoiceCustomerName')?.textContent;
    const message = `*Customer Receipt - Naeem Khan Traders*%0A%0ACustomer: ${customerName}%0AView full details: ${window.location.href}`;
    window.open(`https://wa.me/?text=${message}`, '_blank');
};

// Additional helper functions would continue here...
