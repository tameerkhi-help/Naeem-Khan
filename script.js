// Firebase Configuration (Replace with your own config)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Global Variables
let currentUser = null;
let userRole = null;
const ADMIN_PIN = '7860'; // Hardcoded PIN for admin actions
let pendingAction = null; // Stores the action to perform after PIN verification

// DOM Elements
const pinModal = document.getElementById('pinModal');
const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize based on current page
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    const page = path.split('/').pop();
    
    // Check if user is logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            initializePage(page);
        } else if (page !== 'index.html' && !page.endsWith('/')) {
            // Redirect to login if not authenticated
            window.location.href = 'index.html';
        }
    });
    
    // Initialize login page
    if (page === 'index.html' || page === '' || page.endsWith('/')) {
        initializeLoginPage();
    }
});

// Initialize specific page
function initializePage(page) {
    switch(page) {
        case 'dashboard.html':
            initializeDashboard();
            break;
        case 'add-customer.html':
            initializeAddCustomer();
            break;
        case 'customer-profile.html':
            initializeCustomerProfile();
            break;
    }
}

// ==================== AUTHENTICATION ====================
function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const userTypeSelect = document.getElementById('userType');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Set default date for start date field
    const startDateField = document.getElementById('startDate');
    if (startDateField) {
        const today = new Date().toISOString().split('T')[0];
        startDateField.value = today;
        startDateField.min = today;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const userType = document.getElementById('userType').value;
    
    showLoading();
    
    try {
        // For demo purposes, we'll use hardcoded credentials
        // In production, you would use Firebase Authentication
        if ((email === 'admin@naeemkhan.com' && password === 'admin123') ||
            (email === 'staff@naeemkhan.com' && password === 'staff123')) {
            
            // Simulate successful login
            userRole = userType;
            localStorage.setItem('userRole', userRole);
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userName', email.split('@')[0]);
            
            // Redirect to dashboard
            setTimeout(() => {
                hideLoading();
                window.location.href = 'dashboard.html';
            }, 1000);
            
        } else {
            throw new Error('Invalid credentials');
        }
    } catch (error) {
        hideLoading();
        alert('Login failed: ' + error.message);
    }
}

function logout() {
    auth.signOut().then(() => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// ==================== ADMIN PIN MODAL ====================
function openPinModal(action, message = 'Please enter your 4-digit PIN to continue:') {
    pendingAction = action;
    document.getElementById('pinMessage').textContent = message;
    pinInput.value = '';
    pinError.classList.add('hidden');
    pinModal.classList.remove('hidden');
    pinInput.focus();
}

function closePinModal() {
    pinModal.classList.add('hidden');
    pendingAction = null;
}

function verifyPin() {
    const enteredPin = pinInput.value;
    
    if (enteredPin === ADMIN_PIN) {
        pinError.classList.add('hidden');
        closePinModal();
        
        // Execute pending action
        if (pendingAction && typeof pendingAction === 'function') {
            pendingAction();
        }
    } else {
        pinError.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
    }
}

// ==================== DASHBOARD PAGE ====================
function initializeDashboard() {
    // Set user info
    const userRole = localStorage.getItem('userRole') || 'staff';
    const userEmail = localStorage.getItem('userEmail') || 'user@example.com';
    const userName = localStorage.getItem('userName') || 'User';
    
    document.getElementById('userRoleBadge').textContent = userRole === 'admin' ? 'Admin' : 'Staff';
    document.getElementById('userEmail').textContent = userEmail;
    document.getElementById('userName').textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
    
    // Hide admin-only buttons for staff
    if (userRole === 'staff') {
        const addCustomerBtn = document.getElementById('addCustomerBtn');
        if (addCustomerBtn) addCustomerBtn.style.display = 'none';
    }
    
    // Load dashboard data
    loadDashboardData();
}

async function loadDashboardData() {
    showLoading();
    
    try {
        // For demo, we'll use mock data
        // In production, fetch from Firestore
        
        const mockData = {
            totalCustomers: 157,
            activeCustomers: 142,
            totalRevenue: 4500000,
            monthlyRevenue: 350000,
            pendingAmount: 850000,
            defaultersCount: 15,
            collectionRate: 85
        };
        
        // Update UI
        document.getElementById('totalCustomers').textContent = mockData.totalCustomers;
        document.getElementById('activeCustomers').textContent = mockData.activeCustomers;
        document.getElementById('totalRevenue').textContent = '₹' + mockData.totalRevenue.toLocaleString();
        document.getElementById('monthlyRevenue').textContent = '₹' + mockData.monthlyRevenue.toLocaleString();
        document.getElementById('pendingAmount').textContent = '₹' + mockData.pendingAmount.toLocaleString();
        document.getElementById('defaultersCount').textContent = mockData.defaultersCount;
        document.getElementById('collectionRate').textContent = mockData.collectionRate + '%';
        
        const progressBar = document.getElementById('collectionProgressBar');
        if (progressBar) {
            progressBar.style.width = mockData.collectionRate + '%';
        }
        
        // Load recent customers
        loadRecentCustomers();
        
        // Load defaulters
        loadDefaulters();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Failed to load dashboard data');
    } finally {
        hideLoading();
    }
}

function loadRecentCustomers() {
    const container = document.getElementById('recentCustomers');
    if (!container) return;
    
    const mockCustomers = [
        { id: '1', name: 'Ahmed Khan', phone: '0300-1234567', amount: 15000, status: 'active' },
        { id: '2', name: 'Fatima Ali', phone: '0312-7654321', amount: 20000, status: 'active' },
        { id: '3', name: 'Usman Shah', phone: '0333-9876543', amount: 18000, status: 'active' },
        { id: '4', name: 'Zainab Malik', phone: '0345-4567890', amount: 25000, status: 'active' },
        { id: '5', name: 'Bilal Ahmed', phone: '0301-1122334', amount: 12000, status: 'active' }
    ];
    
    container.innerHTML = '';
    
    mockCustomers.forEach(customer => {
        const customerElement = document.createElement('div');
        customerElement.className = 'flex items-center justify-between p-3 bg-gray-800/50 rounded-lg';
        customerElement.innerHTML = `
            <div>
                <h4 class="font-bold text-white">${customer.name}</h4>
                <p class="text-sm text-gray-400">${customer.phone}</p>
            </div>
            <div class="text-right">
                <p class="text-gold font-bold">₹${customer.amount.toLocaleString()}</p>
                <a href="customer-profile.html?id=${customer.id}" 
                   class="text-sm text-purple-400 hover:text-purple-300">View Profile</a>
            </div>
        `;
        container.appendChild(customerElement);
    });
}

function loadDefaulters() {
    const container = document.getElementById('defaultersList');
    if (!container) return;
    
    const mockDefaulters = [
        { id: '6', name: 'Kamran Javed', phone: '0321-2233445', overdue: 2, amount: 15000 },
        { id: '7', name: 'Sadia Noor', phone: '0334-5566778', overdue: 1, amount: 20000 },
        { id: '8', name: 'Imran Butt', phone: '0305-6677889', overdue: 3, amount: 18000 }
    ];
    
    container.innerHTML = '';
    
    mockDefaulters.forEach(defaulter => {
        const defaulterElement = document.createElement('div');
        defaulterElement.className = 'flex items-center justify-between p-3 bg-red-900/20 rounded-lg border border-red-800/30';
        defaulterElement.innerHTML = `
            <div>
                <h4 class="font-bold text-white">${defaulter.name}</h4>
                <p class="text-sm text-gray-400">${defaulter.phone}</p>
                <span class="text-xs text-red-400">${defaulter.overdue} month(s) overdue</span>
            </div>
            <div class="text-right">
                <p class="text-red-400 font-bold">₹${defaulter.amount.toLocaleString()}</p>
                <a href="customer-profile.html?id=${defaulter.id}" 
                   class="text-sm text-purple-400 hover:text-purple-300">Contact</a>
            </div>
        `;
        container.appendChild(defaulterElement);
    });
}

function refreshData() {
    loadDashboardData();
}

// ==================== ADD CUSTOMER PAGE ====================
function initializeAddCustomer() {
    const userRole = localStorage.getItem('userRole') || 'staff';
    document.getElementById('userRoleBadge').textContent = userRole === 'admin' ? 'Admin' : 'Staff';
    
    // Initialize calculations
    calculateInstallments();
    
    // Handle form submission
    const form = document.getElementById('customerForm');
    if (form) {
        form.addEventListener('submit', handleAddCustomer);
    }
}

function formatCNIC(input) {
    let value = input.value.replace(/\D/g, '');
    
    if (value.length > 13) {
        value = value.substring(0, 13);
    }
    
    if (value.length > 5) {
        value = value.substring(0, 5) + '-' + value.substring(5);
    }
    if (value.length > 13) {
        value = value.substring(0, 13) + '-' + value.substring(13);
    }
    
    input.value = value;
}

function calculateInstallments() {
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const advance = parseFloat(document.getElementById('advancePayment').value) || 0;
    const monthly = parseFloat(document.getElementById('monthlyInstallment').value) || 0;
    
    const remaining = price - advance;
    document.getElementById('remainingBalance').textContent = '₹' + remaining.toLocaleString();
    
    if (monthly > 0) {
        const installments = Math.ceil(remaining / monthly);
        document.getElementById('installmentsRequired').textContent = installments;
        document.getElementById('completionTime').textContent = installments + ' months';
    } else {
        document.getElementById('installmentsRequired').textContent = '0';
        document.getElementById('completionTime').textContent = '0 months';
    }
}

function calculateRemaining() {
    calculateInstallments();
}

async function handleAddCustomer(e) {
    e.preventDefault();
    
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
        alert('Only administrators can add new customers.');
        return;
    }
    
    // Collect form data
    const customerData = {
        name: document.getElementById('customerName').value,
        cnic: document.getElementById('cnic').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        productName: document.getElementById('productName').value,
        productPrice: parseFloat(document.getElementById('productPrice').value),
        advancePayment: parseFloat(document.getElementById('advancePayment').value),
        monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value),
        guarantorName: document.getElementById('guarantorName').value,
        guarantorPhone: document.getElementById('guarantorPhone').value,
        guarantorCNIC: document.getElementById('guarantorCNIC').value,
        guarantorAddress: document.getElementById('guarantorAddress').value,
        notes: document.getElementById('notes').value,
        startDate: document.getElementById('startDate').value,
        remainingBalance: parseFloat(document.getElementById('productPrice').value) - 
                         parseFloat(document.getElementById('advancePayment').value),
        status: 'active',
        createdAt: new Date().toISOString(),
        installments: [],
        totalPaid: parseFloat(document.getElementById('advancePayment').value)
    };
    
    // Calculate installments required
    if (customerData.monthlyInstallment > 0) {
        customerData.installmentsRequired = Math.ceil(customerData.remainingBalance / customerData.monthlyInstallment);
    }
    
    showLoading();
    
    try {
        // In production, save to Firestore
        // For demo, simulate success
        setTimeout(() => {
            hideLoading();
            showSuccessModal();
        }, 1500);
        
    } catch (error) {
        hideLoading();
        alert('Failed to add customer: ' + error.message);
    }
}

function showSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('customerForm').reset();
        calculateInstallments();
    }
}

// ==================== CUSTOMER PROFILE PAGE ====================
function initializeCustomerProfile() {
    const userRole = localStorage.getItem('userRole') || 'staff';
    document.getElementById('userRoleBadge').textContent = userRole === 'admin' ? 'Admin' : 'Staff';
    
    // Hide admin-only buttons for staff
    if (userRole === 'staff') {
        const adminButtons = ['markPaidBtn', 'editCustomerBtn', 'deleteCustomerBtn'];
        adminButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.style.display = 'none';
        });
    }
    
    // Load customer data from URL parameter
    loadCustomerData();
}

function getCustomerIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

async function loadCustomerData() {
    const customerId = getCustomerIdFromURL();
    
    if (!customerId) {
        showErrorState('No customer ID provided');
        return;
    }
    
    showLoading();
    
    try {
        // For demo, use mock data
        // In production, fetch from Firestore
        
        const mockCustomer = {
            id: customerId,
            name: 'Ahmed Khan',
            cnic: '42101-1234567-8',
            phone: '0300-1234567',
            address: 'House #123, Street 45, Lahore',
            productName: 'iPhone 14 Pro Max',
            productPrice: 350000,
            advancePayment: 50000,
            monthlyInstallment: 10000,
            remainingBalance: 250000,
            totalPaid: 100000,
            startDate: '2024-01-15',
            status: 'active',
            guarantorName: 'Ali Raza',
            guarantorCNIC: '42101-7654321-0',
            guarantorPhone: '0312-9876543',
            guarantorAddress: 'House #456, Street 78, Lahore',
            notes: 'Good customer, pays on time',
            installments: [
                { month: 'January', amount: 10000, date: '2024-01-15', status: 'paid' },
                { month: 'February', amount: 10000, date: '2024-02-15', status: 'paid' },
                { month: 'March', amount: 10000, date: '2024-03-15', status: 'paid' },
                { month: 'April', amount: 10000, date: '2024-04-15', status: 'paid' },
                { month: 'May', amount: 10000, date: '2024-05-15', status: 'paid' },
                { month: 'June', amount: 10000, date: '2024-06-15', status: 'pending' },
                { month: 'July', amount: 10000, date: '2024-07-15', status: 'pending' }
            ]
        };
        
        // Update UI with customer data
        updateProfileUI(mockCustomer);
        
        // Hide loading, show data
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('profileData').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading customer:', error);
        showErrorState('Failed to load customer data');
    } finally {
        hideLoading();
    }
}

function updateProfileUI(customer) {
    // Basic Info
    document.getElementById('profileCustomerName').textContent = customer.name;
    document.getElementById('profileCnic').textContent = 'CNIC: ' + customer.cnic;
    document.getElementById('profilePhone').textContent = 'Phone: ' + customer.phone;
    
    // Payment Progress
    const progressPercent = Math.round((customer.totalPaid / customer.productPrice) * 100);
    document.getElementById('progressPercent').textContent = progressPercent + '%';
    document.getElementById('paidAmount').textContent = '₹' + customer.totalPaid.toLocaleString();
    document.getElementById('remainingAmount').textContent = '₹' + customer.remainingBalance.toLocaleString();
    document.getElementById('totalAmount').textContent = '₹' + customer.productPrice.toLocaleString();
    
    // Update progress circle
    const circle = document.getElementById('progressCircle');
    if (circle) {
        const circumference = 100; // Simplified for demo
        const offset = circumference - (progressPercent * circumference / 100);
        circle.style.strokeDashoffset = offset;
    }
    
    // Installment Summary
    document.getElementById('monthlyInstallmentAmount').textContent = '₹' + customer.monthlyInstallment.toLocaleString();
    const paidInstallments = customer.installments.filter(i => i.status === 'paid').length;
    const totalInstallments = customer.installments.length;
    document.getElementById('installmentsPaid').textContent = `${paidInstallments}/${totalInstallments}`;
    
    // Calculate next due date (next pending installment)
    const pendingInstallments = customer.installments.filter(i => i.status === 'pending');
    const nextDueDate = pendingInstallments.length > 0 ? pendingInstallments[0].date : 'N/A';
    document.getElementById('nextDueDate').textContent = formatDate(nextDueDate);
    
    // Product Info
    document.getElementById('productInfoName').textContent = customer.productName;
    document.getElementById('startDateInfo').textContent = formatDate(customer.startDate);
    document.getElementById('guarantorInfo').textContent = customer.guarantorName;
    
    // Customer Details
    document.getElementById('detailName').textContent = customer.name;
    document.getElementById('detailCnic').textContent = customer.cnic;
    document.getElementById('detailPhone').textContent = customer.phone;
    document.getElementById('detailAddress').textContent = customer.address;
    
    // Guarantor Details
    document.getElementById('detailGuarantorName').textContent = customer.guarantorName;
    document.getElementById('detailGuarantorCnic').textContent = customer.guarantorCNIC;
    document.getElementById('detailGuarantorPhone').textContent = customer.guarantorPhone;
    document.getElementById('detailGuarantorAddress').textContent = customer.guarantorAddress;
    
    // Installment History
    const historyContainer = document.getElementById('installmentHistory');
    if (historyContainer) {
        historyContainer.innerHTML = '';
        
        customer.installments.forEach(installment => {
            const installmentElement = document.createElement('div');
            installmentElement.className = 'flex items-center justify-between p-3 bg-gray-800/50 rounded-lg';
            
            let statusClass = 'status-pending';
            if (installment.status === 'paid') statusClass = 'status-paid';
            if (installment.status === 'overdue') statusClass = 'status-overdue';
            
            installmentElement.innerHTML = `
                <div>
                    <h4 class="font-bold text-white">${installment.month} Installment</h4>
                    <p class="text-sm text-gray-400">Due: ${formatDate(installment.date)}</p>
                </div>
                <div class="text-right">
                    <p class="text-gold font-bold">₹${installment.amount.toLocaleString()}</p>
                    <span class="${statusClass}">${installment.status.charAt(0).toUpperCase() + installment.status.slice(1)}</span>
                </div>
            `;
            historyContainer.appendChild(installmentElement);
        });
    }
}

function showErrorState(message) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('profileData').classList.add('hidden');
    const errorState = document.getElementById('errorState');
    if (errorState) {
        errorState.classList.remove('hidden');
        if (message) {
            const errorMessage = errorState.querySelector('p');
            if (errorMessage) {
                errorMessage.textContent = message;
            }
        }
    }
}

function formatDate(dateString) {
    if (!dateString || dateString === 'N/A') return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ==================== PROFILE ACTIONS ====================
function markPaid() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
        alert('Only administrators can mark installments as paid.');
        return;
    }
    
    openPinModal(() => {
        showLoading('Marking installment as paid...');
        
        // In production, update Firestore
        setTimeout(() => {
            hideLoading();
            alert('Installment marked as paid successfully!');
            // Refresh the page
            loadCustomerData();
        }, 1000);
    }, 'Enter PIN to mark installment as paid:');
}

function editCustomer() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
        alert('Only administrators can edit customer information.');
        return;
    }
    
    openPinModal(() => {
        // Redirect to edit page or open edit modal
        alert('Edit functionality would open here with PIN verified.');
    }, 'Enter PIN to edit customer information:');
}

function deleteCustomer() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
        alert('Only administrators can delete customers.');
        return;
    }
    
    openPinModal(() => {
        if (confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            showLoading('Deleting customer...');
            
            // In production, delete from Firestore
            setTimeout(() => {
                hideLoading();
                alert('Customer deleted successfully!');
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    }, 'Enter PIN to delete customer:');
}

function shareProfile() {
    const customerId = getCustomerIdFromURL();
    const profileUrl = window.location.href;
    const message = `Check out this customer profile: ${profileUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
}

async function downloadPDF() {
    showLoading('Generating PDF...');
    
    try {
        // Wait for libraries to load
        await waitForLibraries();
        
        const element = document.getElementById('profileContent');
        
        // Create a temporary clone for PDF generation
        const clone = element.cloneNode(true);
        clone.style.backgroundColor = 'white';
        clone.style.color = 'black';
        clone.style.padding = '20px';
        
        // Hide navigation and buttons in PDF
        const noPrintElements = clone.querySelectorAll('.no-print, nav, button');
        noPrintElements.forEach(el => el.style.display = 'none');
        
        document.body.appendChild(clone);
        
        // Generate PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const canvas = await html2canvas(clone, {
            scale: 2,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save(`customer-profile-${getCustomerIdFromURL()}.pdf`);
        
        // Clean up
        document.body.removeChild(clone);
        
    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        hideLoading();
    }
}

function waitForLibraries() {
    return new Promise((resolve) => {
        if (window.html2canvas && window.jspdf) {
            resolve();
        } else {
            setTimeout(() => waitForLibraries().then(resolve), 100);
        }
    });
}

// ==================== UTILITY FUNCTIONS ====================
function showLoading(message = 'Loading...') {
    if (loadingOverlay) {
        const messageElement = loadingOverlay.querySelector('p');
        if (messageElement && message) {
            messageElement.textContent = message;
        }
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

// Format currency
function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

// Get month name
function getMonthName(monthNumber) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1] || '';
}

// Calculate days between dates
function daysBetween(date1, date2) {
    const diffTime = Math.abs(new Date(date2) - new Date(date1));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== FIREBASE FUNCTIONS (Placeholders) ====================
// These functions would be implemented with actual Firebase calls in production

async function saveCustomerToFirestore(customerData) {
    // In production: return db.collection('customers').add(customerData);
    console.log('Saving to Firestore:', customerData);
    return { id: generateId() };
}

async function getCustomerFromFirestore(customerId) {
    // In production: return db.collection('customers').doc(customerId).get();
    console.log('Fetching from Firestore:', customerId);
    return { exists: true, data: () => ({}) };
}

async function updateCustomerInFirestore(customerId, updates) {
    // In production: return db.collection('customers').doc(customerId).update(updates);
    console.log('Updating in Firestore:', customerId, updates);
    return true;
}

async function deleteCustomerFromFirestore(customerId) {
    // In production: return db.collection('customers').doc(customerId).delete();
    console.log('Deleting from Firestore:', customerId);
    return true;
}

async function getAllCustomersFromFirestore() {
    // In production: return db.collection('customers').get();
    console.log('Fetching all customers from Firestore');
    return { docs: [] };
}

// Export functions for use in HTML
window.logout = logout;
window.closePinModal = closePinModal;
window.verifyPin = verifyPin;
window.refreshData = refreshData;
window.markPaid = markPaid;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.shareProfile = shareProfile;
window.downloadPDF = downloadPDF;
window.formatCNIC = formatCNIC;
window.calculateInstallments = calculateInstallments;
window.calculateRemaining = calculateRemaining;
window.closeSuccessModal = closeSuccessModal;
