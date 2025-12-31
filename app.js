// ==============================================
// 1. FIREBASE CONFIGURATION
// ==============================================
const firebaseConfig = {
    apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
    authDomain: "naeemjan-c7f46.firebaseapp.com",
    projectId: "naeemjan-c7f46",
    storageBucket: "naeemjan-c7f46.firebasestorage.app",
    messagingSenderId: "319489849314",
    appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.log("Firebase already initialized");
}

const auth = firebase.auth();
const db = firebase.firestore();

// ==============================================
// 2. GLOBAL VARIABLES
// ==============================================
let currentLanguage = 'en'; // Default to English
let currentCustomerId = null;
let allCustomers = [];
let customerToDelete = null;
let currentPaymentCustomerId = null;

// ==============================================
// 3. INITIALIZATION
// ==============================================
document.addEventListener('DOMContentLoaded', function() {
    // Force logout on page load for security
    sessionStorage.removeItem('userLoggedIn');
    
    // Initialize language toggle
    document.getElementById('langToggle').addEventListener('click', toggleLanguage);
    updateLanguage();
    
    // Initialize image uploads
    initImageUploads();
    
    // Initialize form
    initForm();
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
    document.getElementById('payment-date').value = today;
    
    // Check auth state
    auth.onAuthStateChanged(handleAuthStateChange);
    
    // Initialize search functionality
    initSearch();
});

function handleAuthStateChange(user) {
    if (user && sessionStorage.getItem('userLoggedIn') === 'true') {
        // User is logged in and session is valid
        showDashboard();
        loadDashboardStats();
        loadDueCustomers();
    } else {
        // User is not logged in or session expired
        showLogin();
        // Force sign out to clear any Firebase persistence
        auth.signOut().catch(() => {});
    }
}

// ==============================================
// 4. LANGUAGE MANAGEMENT
// ==============================================
function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'ur' : 'en';
    updateLanguage();
    
    // Update HTML direction
    document.getElementById('htmlRoot').dir = currentLanguage === 'ur' ? 'rtl' : 'ltr';
    document.getElementById('htmlRoot').lang = currentLanguage;
    
    // Update language button text
    document.getElementById('langText').textContent = currentLanguage === 'ur' ? 'English' : 'اردو';
}

function updateLanguage() {
    const elements = document.querySelectorAll('[data-en], [data-ur]');
    
    elements.forEach(element => {
        if (currentLanguage === 'ur') {
            const urduText = element.getAttribute('data-ur');
            if (urduText) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                    element.placeholder = urduText;
                } else if (element.tagName === 'OPTION') {
                    element.textContent = urduText;
                } else {
                    element.textContent = urduText;
                }
            }
        } else {
            const englishText = element.getAttribute('data-en');
            if (englishText) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                    element.placeholder = englishText;
                } else if (element.tagName === 'OPTION') {
                    element.textContent = englishText;
                } else {
                    element.textContent = englishText;
                }
            }
        }
    });
}

// ==============================================
// 5. AUTHENTICATION
// ==============================================
function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    // Clear login form
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('login-error').textContent = '';
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
}

async function login() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorElement = document.getElementById('login-error');
    
    errorElement.textContent = '';
    
    if (!email || !password) {
        errorElement.textContent = currentLanguage === 'ur' 
            ? 'براہ کرم ای میل اور پاس ورڈ درج کریں' 
            : 'Please enter email and password';
        return;
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        // Set session storage to track login
        sessionStorage.setItem('userLoggedIn', 'true');
        showMessage(currentLanguage === 'ur' ? 'کامیابی سے لاگ ان ہو گیا' : 'Login successful', 'success');
        
        // Show dashboard
        showDashboard();
        loadDashboardStats();
        loadDueCustomers();
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = currentLanguage === 'ur' 
            ? 'لاگ ان ناکام: غلط ای میل یا پاس ورڈ' 
            : 'Login failed: Invalid email or password';
        
        if (error.code === 'auth/invalid-email') {
            errorMessage = currentLanguage === 'ur' 
                ? 'غلط ای میل فارمیٹ' 
                : 'Invalid email format';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = currentLanguage === 'ur' 
                ? 'صارف نہیں ملا' 
                : 'User not found';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = currentLanguage === 'ur' 
                ? 'غلط پاس ورڈ' 
                : 'Wrong password';
        }
        
        errorElement.textContent = errorMessage;
    }
}

function logout() {
    sessionStorage.removeItem('userLoggedIn');
    auth.signOut().then(() => {
        showMessage(currentLanguage === 'ur' ? 'لاگ آؤٹ ہو گیا' : 'Logged out successfully', 'success');
        showLogin();
    }).catch(error => {
        console.error('Logout error:', error);
    });
}

// ==============================================
// 6. DASHBOARD FUNCTIONS
// ==============================================
async function loadDashboardStats() {
    try {
        const snapshot = await db.collection('customers').get();
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCustomers = customers;
        
        // Update statistics
        document.getElementById('total-customers').textContent = customers.length;
        
        // Calculate due today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueToday = customers.filter(customer => {
            if (!customer.nextDueDate) return false;
            const dueDate = new Date(customer.nextDueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime() && (customer.currentBalance || 0) > 0;
        }).length;
        
        document.getElementById('due-today').textContent = dueToday;
        
        // Calculate total balance
        const totalBalance = customers.reduce((sum, customer) => sum + (customer.currentBalance || 0), 0);
        document.getElementById('total-balance').textContent = formatCurrency(totalBalance);
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showMessage(currentLanguage === 'ur' ? 'شماریات لوڈ کرنے میں مسئلہ' : 'Error loading statistics', 'error');
    }
}

function showView(viewId) {
    // Hide all views
    document.querySelectorAll('.content-view').forEach(view => view.classList.add('hidden'));
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active-nav'));
    
    // Show selected view and activate its nav button
    document.getElementById(viewId).classList.remove('hidden');
    const activeBtn = document.querySelector(`button[onclick="showView('${viewId}')"]`);
    if (activeBtn) activeBtn.classList.add('active-nav');
    
    // Load data for specific views
    switch(viewId) {
        case 'due-list-view':
            loadDueCustomers();
            break;
        case 'all-customers-view':
            loadAllCustomers();
            break;
        case 'search-view':
            clearSearchResults();
            break;
        case 'add-customer-view':
            resetForm();
            break;
    }
}

// ==============================================
// 7. CUSTOMER MANAGEMENT - DUE LIST
// ==============================================
async function loadDueCustomers() {
    const tbody = document.getElementById('due-customers-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    
    try {
        const snapshot = await db.collection('customers')
            .where('currentBalance', '>', 0)
            .get();
        
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort by next due date
        customers.sort((a, b) => {
            const dateA = a.nextDueDate ? new Date(a.nextDueDate) : new Date(0);
            const dateB = b.nextDueDate ? new Date(b.nextDueDate) : new Date(0);
            return dateA - dateB;
        });
        
        tbody.innerHTML = '';
        
        if (customers.length === 0) {
            document.getElementById('no-due-msg').classList.remove('hidden');
            return;
        }
        
        document.getElementById('no-due-msg').classList.add('hidden');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        customers.forEach(customer => {
            const dueDate = customer.nextDueDate ? new Date(customer.nextDueDate) : new Date();
            const isOverdue = dueDate < today;
            const isToday = dueDate.getTime() === today.getTime();
            
            let statusClass = 'status-pending';
            let statusText = currentLanguage === 'ur' ? 'زیر التواء' : 'Pending';
            
            if (isOverdue) {
                statusClass = 'status-overdue';
                statusText = currentLanguage === 'ur' ? 'تاخیر' : 'Overdue';
            } else if (isToday) {
                statusClass = 'status-paid';
                statusText = currentLanguage === 'ur' ? 'آج' : 'Today';
            }
            
            const row = `
                <tr>
                    <td><strong>${escapeHtml(customer.accountId || customer.id)}</strong></td>
                    <td>${escapeHtml(customer.buyerName || 'N/A')}</td>
                    <td>${escapeHtml(customer.phone || 'N/A')}</td>
                    <td>Rs. ${formatCurrency(customer.monthlyInstallment || 0)}</td>
                    <td class="balance-cell">Rs. ${formatCurrency(customer.currentBalance || 0)}</td>
                    <td>${dueDate.toLocaleDateString()}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-pay" onclick="openPaymentModal('${customer.id}')">
                                <i class="fas fa-money-check-alt"></i>
                                ${currentLanguage === 'ur' ? 'ادائیگی' : 'Pay'}
                            </button>
                            <button class="btn-view" onclick="viewCustomerDetails('${customer.id}')">
                                <i class="fas fa-eye"></i>
                                ${currentLanguage === 'ur' ? 'دیکھیں' : 'View'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
        
    } catch (error) {
        console.error('Error loading due customers:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center error">Error loading data</td></tr>';
        showMessage(currentLanguage === 'ur' ? 'ڈیٹا لوڈ کرنے میں مسئلہ' : 'Error loading data', 'error');
    }
}

function refreshDueList() {
    loadDueCustomers();
    loadDashboardStats();
    showMessage(currentLanguage === 'ur' ? 'تازہ کاری مکمل ہو گئی' : 'Refresh completed', 'success');
}

// ==============================================
// 8. CUSTOMER MANAGEMENT - ALL CUSTOMERS
// ==============================================
async function loadAllCustomers() {
    const tbody = document.getElementById('all-customers-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    
    try {
        const snapshot = await db.collection('customers').orderBy('accountId').get();
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        tbody.innerHTML = '';
        
        if (customers.length === 0) {
            document.getElementById('no-customers-msg').classList.remove('hidden');
            return;
        }
        
        document.getElementById('no-customers-msg').classList.add('hidden');
        
        customers.forEach(customer => {
            const dueDate = customer.nextDueDate ? new Date(customer.nextDueDate) : new Date();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let statusClass = 'status-pending';
            let statusText = currentLanguage === 'ur' ? 'اچھا' : 'Good';
            
            if (customer.currentBalance <= 0) {
                statusClass = 'status-paid';
                statusText = currentLanguage === 'ur' ? 'ادا شدہ' : 'Paid';
            } else if (dueDate < today) {
                statusClass = 'status-overdue';
                statusText = currentLanguage === 'ur' ? 'تاخیر' : 'Overdue';
            }
            
            const row = `
                <tr>
                    <td><strong>${escapeHtml(customer.accountId || customer.id)}</strong></td>
                    <td>${escapeHtml(customer.buyerName || 'N/A')}</td>
                    <td>${escapeHtml(customer.phone || 'N/A')}</td>
                    <td>Rs. ${formatCurrency(customer.monthlyInstallment || 0)}</td>
                    <td class="balance-cell">Rs. ${formatCurrency(customer.currentBalance || 0)}</td>
                    <td>${dueDate.toLocaleDateString()}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-view" onclick="viewCustomerDetails('${customer.id}')" title="${currentLanguage === 'ur' ? 'تفصیلات' : 'View Details'}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-edit" onclick="editCustomer('${customer.id}')" title="${currentLanguage === 'ur' ? 'ترمیم' : 'Edit'}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-pay" onclick="openPaymentModal('${customer.id}')" title="${currentLanguage === 'ur' ? 'ادائیگی' : 'Payment'}">
                                <i class="fas fa-money-check-alt"></i>
                            </button>
                            <button class="btn-delete" onclick="openDeleteModal('${customer.id}')" title="${currentLanguage === 'ur' ? 'حذف' : 'Delete'}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
        
        // Add filter functionality
        const filterInput = document.getElementById('filter-customers');
        filterInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
        
    } catch (error) {
        console.error('Error loading all customers:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center error">Error loading data</td></tr>';
        showMessage(currentLanguage === 'ur' ? 'ڈیٹا لوڈ کرنے میں مسئلہ' : 'Error loading data', 'error');
    }
}

// ==============================================
// 9. CUSTOMER MANAGEMENT - SEARCH
// ==============================================
function initSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchCustomer();
        }
    });
}

async function searchCustomer() {
    const searchInput = document.getElementById('search-input').value.trim();
    const searchType = document.querySelector('input[name="search-type"]:checked').value;
    const resultContainer = document.getElementById('search-result-container');
    
    if (!searchInput) {
        showMessage(
            currentLanguage === 'ur' ? 'براہ کرم تلاش کے لیے کچھ درج کریں' : 'Please enter something to search',
            'error'
        );
        return;
    }
    
    resultContainer.innerHTML = '<div class="text-center">Searching...</div>';
    
    try {
        let query;
        
        switch(searchType) {
            case 'id':
                query = await db.collection('customers').where('accountId', '==', searchInput).get();
                break;
            case 'name':
                // Case-insensitive search for name
                const allCustomersSnapshot = await db.collection('customers').get();
                const allCustomers = allCustomersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const filteredCustomers = allCustomers.filter(customer => 
                    customer.buyerName && customer.buyerName.toLowerCase().includes(searchInput.toLowerCase())
                );
                resultContainer.innerHTML = '';
                
                if (filteredCustomers.length === 0) {
                    showNoResults();
                    return;
                }
                
                displaySearchResults(filteredCustomers);
                return;
                
            case 'phone':
                query = await db.collection('customers').where('phone', '==', searchInput).get();
                break;
        }
        
        if (query.empty) {
            showNoResults();
            return;
        }
        
        const customers = query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displaySearchResults(customers);
        
    } catch (error) {
        console.error('Error searching customers:', error);
        resultContainer.innerHTML = '<div class="text-center error">Error searching customers</div>';
        showMessage(currentLanguage === 'ur' ? 'تلاش میں مسئلہ' : 'Search error', 'error');
    }
}

function displaySearchResults(customers) {
    const resultContainer = document.getElementById('search-result-container');
    resultContainer.innerHTML = '';
    
    customers.forEach(customer => {
        const dueDate = customer.nextDueDate ? new Date(customer.nextDueDate) : new Date();
        
        const card = `
            <div class="customer-card">
                <div class="customer-header">
                    <div>
                        <h4>${escapeHtml(customer.buyerName)}</h4>
                        <p class="customer-id">ID: ${escapeHtml(customer.accountId)}</p>
                    </div>
                    <div class="customer-actions">
                        <button class="btn-view" onclick="viewCustomerDetails('${customer.id}')" title="${currentLanguage === 'ur' ? 'تفصیلات' : 'View Details'}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-edit" onclick="editCustomer('${customer.id}')" title="${currentLanguage === 'ur' ? 'ترمیم' : 'Edit'}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-pay" onclick="openPaymentModal('${customer.id}')" title="${currentLanguage === 'ur' ? 'ادائیگی' : 'Payment'}">
                            <i class="fas fa-money-check-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="customer-body">
                    <div class="customer-info-row">
                        <span class="info-label">${currentLanguage === 'ur' ? 'فون' : 'Phone'}</span>
                        <span class="info-value">${escapeHtml(customer.phone || 'N/A')}</span>
                    </div>
                    <div class="customer-info-row">
                        <span class="info-label">${currentLanguage === 'ur' ? 'ماہانہ قسط' : 'Monthly Installment'}</span>
                        <span class="info-value">Rs. ${formatCurrency(customer.monthlyInstallment || 0)}</span>
                    </div>
                    <div class="customer-info-row">
                        <span class="info-label">${currentLanguage === 'ur' ? 'بقایا بیلنس' : 'Current Balance'}</span>
                        <span class="info-value">Rs. ${formatCurrency(customer.currentBalance || 0)}</span>
                    </div>
                    <div class="customer-info-row">
                        <span class="info-label">${currentLanguage === 'ur' ? 'اگلی تاریخ' : 'Next Due Date'}</span>
                        <span class="info-value">${dueDate.toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="customer-footer">
                    <div class="balance-info">
                        ${currentLanguage === 'ur' ? 'کل بقایا:' : 'Total Balance:'} Rs. ${formatCurrency(customer.currentBalance || 0)}
                    </div>
                    <button class="btn-pay-tick" onclick="openPaymentModal('${customer.id}')">
                        <i class="fas fa-money-check-alt"></i>
                        ${currentLanguage === 'ur' ? 'ادائیگی درج کریں' : 'Record Payment'}
                    </button>
                </div>
            </div>
        `;
        
        resultContainer.innerHTML += card;
    });
}

function showNoResults() {
    const resultContainer = document.getElementById('search-result-container');
    resultContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h4>${currentLanguage === 'ur' ? 'کوئی کسٹمر نہیں ملا' : 'No customer found'}</h4>
            <p>${currentLanguage === 'ur' ? 'براہ کرم مختلف سرچ ٹرم استعمال کریں' : 'Please try a different search term'}</p>
        </div>
    `;
}

function clearSearchResults() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-result-container').innerHTML = '';
}

// ==============================================
// 10. CUSTOMER DETAILS MODAL
// ==============================================
let currentDetailCustomerId = null;

async function viewCustomerDetails(customerId) {
    try {
        const doc = await db.collection('customers').doc(customerId).get();
        if (!doc.exists) {
            showMessage(currentLanguage === 'ur' ? 'کسٹمر نہیں ملا' : 'Customer not found', 'error');
            return;
        }
        
        const customer = doc.data();
        currentDetailCustomerId = customerId;
        
        // Fill modal with customer information
        document.getElementById('detail-account-id').textContent = customer.accountId || 'N/A';
        document.getElementById('detail-name').textContent = customer.buyerName || 'N/A';
        document.getElementById('detail-father').textContent = customer.fatherName || 'N/A';
        document.getElementById('detail-phone').textContent = customer.phone || 'N/A';
        document.getElementById('detail-profession').textContent = customer.profession || 'N/A';
        document.getElementById('detail-home-address').textContent = customer.homeAddress || 'N/A';
        document.getElementById('detail-office-address').textContent = customer.officeAddress || 'N/A';
        document.getElementById('detail-total-price').textContent = `Rs. ${formatCurrency(customer.totalPrice || 0)}`;
        document.getElementById('detail-advance').textContent = `Rs. ${formatCurrency(customer.advance || 0)}`;
        document.getElementById('detail-balance').textContent = `Rs. ${formatCurrency(customer.currentBalance || 0)}`;
        document.getElementById('detail-installment').textContent = `Rs. ${formatCurrency(customer.monthlyInstallment || 0)}`;
        document.getElementById('detail-items').textContent = customer.items || 'N/A';
        document.getElementById('detail-model').textContent = customer.modelNumber || 'N/A';
        document.getElementById('detail-guarantor1').textContent = customer.guarantor1 || 'N/A';
        document.getElementById('detail-guarantor2').textContent = customer.guarantor2 || 'N/A';
        
        // Handle images
        const customerPhotoContainer = document.getElementById('detail-customer-photo');
        const cnicPhotoContainer = document.getElementById('detail-cnic-photo');
        
        if (customer.photo) {
            customerPhotoContainer.innerHTML = `<img src="${customer.photo}" alt="Customer Photo">`;
        } else {
            customerPhotoContainer.innerHTML = `<span>${currentLanguage === 'ur' ? 'تصویر دستیاب نہیں' : 'No photo available'}</span>`;
        }
        
        if (customer.cnic) {
            cnicPhotoContainer.innerHTML = `<img src="${customer.cnic}" alt="CNIC Photo">`;
        } else {
            cnicPhotoContainer.innerHTML = `<span>${currentLanguage === 'ur' ? 'تصویر دستیاب نہیں' : 'No photo available'}</span>`;
        }
        
        // Show modal
        document.getElementById('customer-details-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error viewing customer details:', error);
        showMessage(currentLanguage === 'ur' ? 'تفصیلات لوڈ کرنے میں مسئلہ' : 'Error loading details', 'error');
    }
}

function closeDetailsModal() {
    document.getElementById('customer-details-modal').classList.add('hidden');
    currentDetailCustomerId = null;
}

function editCurrentCustomer() {
    if (currentDetailCustomerId) {
        closeDetailsModal();
        editCustomer(currentDetailCustomerId);
    }
}

// ==============================================
// 11. CUSTOMER FORM HANDLING
// ==============================================
function initImageUploads() {
    const customerPhotoInput = document.getElementById('customerPhotoInput');
    const cnicPhotoInput = document.getElementById('cnicPhotoInput');
    const customerPhotoPreview = document.getElementById('customer-photo-preview');
    const cnicPhotoPreview = document.getElementById('cnic-photo-preview');
    
    customerPhotoInput.addEventListener('change', function(e) {
        handleImageUpload(e.target.files[0], customerPhotoPreview);
    });
    
    cnicPhotoInput.addEventListener('change', function(e) {
        handleImageUpload(e.target.files[0], cnicPhotoPreview);
    });
    
    // Make labels clickable
    document.querySelector('label[for="customerPhotoInput"]').addEventListener('click', function(e) {
        if (e.target.tagName !== 'INPUT') {
            customerPhotoInput.click();
        }
    });
    
    document.querySelector('label[for="cnicPhotoInput"]').addEventListener('click', function(e) {
        if (e.target.tagName !== 'INPUT') {
            cnicPhotoInput.click();
        }
    });
}

function handleImageUpload(file, previewElement) {
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showMessage(
            currentLanguage === 'ur' ? 'براہ کرم صرف تصاویر اپ لوڈ کریں' : 'Please upload only images',
            'error'
        );
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showMessage(
            currentLanguage === 'ur' ? 'تصویر کا سائز 5MB سے زیادہ نہیں ہونا چاہیے' : 'Image size should not exceed 5MB',
            'error'
        );
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewElement.innerHTML = `<img src="${e.target.result}" alt="Uploaded image">`;
    };
    reader.readAsDataURL(file);
}

function initForm() {
    const form = document.getElementById('customer-form');
    form.addEventListener('submit', handleFormSubmit);
    
    // Calculate remaining balance on input
    document.getElementById('totalPrice').addEventListener('input', calculateRemaining);
    document.getElementById('advance').addEventListener('input', calculateRemaining);
}

function calculateRemaining() {
    const totalPrice = parseFloat(document.getElementById('totalPrice').value) || 0;
    const advance = parseFloat(document.getElementById('advance').value) || 0;
    const remaining = totalPrice - advance;
    document.getElementById('initialRemaining').value = remaining > 0 ? remaining : 0;
}

function resetForm() {
    document.getElementById('customer-form').reset();
    document.getElementById('form-mode').value = 'add';
    document.getElementById('original-account-id').value = '';
    document.getElementById('accountId').disabled = false;
    
    // Reset image previews
    document.getElementById('customer-photo-preview').innerHTML = '';
    document.getElementById('cnic-photo-preview').innerHTML = '';
    
    // Reset form title and button
    const formTitle = document.getElementById('form-title');
    const formIcon = document.getElementById('form-icon');
    const saveBtn = document.getElementById('save-btn');
    
    formTitle.textContent = currentLanguage === 'ur' ? 'نیا کسٹمر شامل کریں' : 'Add New Customer';
    formIcon.className = 'fas fa-user-plus';
    saveBtn.innerHTML = `<i class="fas fa-save"></i> <span>${currentLanguage === 'ur' ? 'کسٹمر محفوظ کریں' : 'Save Customer'}</span>`;
    
    // Hide cancel button
    document.getElementById('cancel-btn').classList.add('hidden');
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
    
    // Calculate remaining
    calculateRemaining();
}

function cancelEdit() {
    resetForm();
    showView('due-list-view');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formMode = document.getElementById('form-mode').value;
    const saveBtn = document.getElementById('save-btn');
    const originalBtnText = saveBtn.innerHTML;
    
    // Disable save button and show loading
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        const accountId = document.getElementById('accountId').value.trim();
        
        if (!accountId) {
            showMessage(
                currentLanguage === 'ur' ? 'اکاؤنٹ آئی ڈی درکار ہے' : 'Account ID is required',
                'error'
            );
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
            return;
        }
        
        // Check if account ID already exists (for add mode only)
        if (formMode === 'add') {
            const existingDoc = await db.collection('customers').doc(accountId).get();
            if (existingDoc.exists) {
                showMessage(
                    currentLanguage === 'ur' ? 'یہ اکاؤنٹ آئی ڈی پہلے سے موجود ہے' : 'This Account ID already exists',
                    'error'
                );
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnText;
                return;
            }
        }
        
        // Get image data
        const customerPhotoImg = document.querySelector('#customer-photo-preview img');
        const cnicPhotoImg = document.querySelector('#cnic-photo-preview img');
        
        const customerData = {
            accountId: accountId,
            buyerName: document.getElementById('buyerName').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            fatherName: document.getElementById('fatherName').value.trim(),
            profession: document.getElementById('profession').value.trim(),
            homeAddress: document.getElementById('homeAddress').value.trim(),
            officeAddress: document.getElementById('officeAddress').value.trim(),
            
            photo: customerPhotoImg ? customerPhotoImg.src : '',
            cnic: cnicPhotoImg ? cnicPhotoImg.src : '',
            
            totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
            advance: parseFloat(document.getElementById('advance').value) || 0,
            currentBalance: parseFloat(document.getElementById('initialRemaining').value) || 0,
            monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value) || 0,
            items: document.getElementById('items').value.trim(),
            modelNumber: document.getElementById('modelNumber').value.trim(),
            
            guarantor1: document.getElementById('g1Name').value.trim(),
            guarantor2: document.getElementById('g2Name').value.trim(),
            
            issueDate: document.getElementById('issueDate').value || new Date().toISOString().split('T')[0],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // For new customers, set creation date and next due date
        if (formMode === 'add') {
            customerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            
            // Set next due date to one month from today
            const nextDueDate = new Date();
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            customerData.nextDueDate = nextDueDate.toISOString();
        }
        
        // Save to Firestore
        const docId = formMode === 'edit' ? document.getElementById('original-account-id').value : accountId;
        await db.collection('customers').doc(docId).set(customerData, { merge: true });
        
        showMessage(
            formMode === 'add' 
                ? (currentLanguage === 'ur' ? 'کسٹمر کامیابی سے شامل ہو گیا' : 'Customer added successfully')
                : (currentLanguage === 'ur' ? 'کسٹمر کی معلومات کامیابی سے اپ ڈیٹ ہو گئیں' : 'Customer information updated successfully'),
            'success'
        );
        
        // Reset form and switch to due list view
        resetForm();
        showView('due-list-view');
        
        // Refresh data
        loadDueCustomers();
        loadAllCustomers();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Error saving customer:', error);
        showMessage(
            currentLanguage === 'ur' ? 'کسٹمر محفوظ کرنے میں مسئلہ' : 'Error saving customer',
            'error'
        );
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

async function editCustomer(customerId) {
    try {
        const doc = await db.collection('customers').doc(customerId).get();
        if (!doc.exists) {
            showMessage(currentLanguage === 'ur' ? 'کسٹمر نہیں ملا' : 'Customer not found', 'error');
            return;
        }
        
        const customer = doc.data();
        
        // Switch to add/edit view
        showView('add-customer-view');
        
        // Update form mode
        document.getElementById('form-mode').value = 'edit';
        document.getElementById('original-account-id').value = customerId;
        
        // Update form title and button
        const formTitle = document.getElementById('form-title');
        const formIcon = document.getElementById('form-icon');
        const saveBtn = document.getElementById('save-btn');
        
        formTitle.textContent = currentLanguage === 'ur' ? 'کسٹمر میں ترمیم کریں' : 'Edit Customer';
        formIcon.className = 'fas fa-edit';
        saveBtn.innerHTML = `<i class="fas fa-save"></i> <span>${currentLanguage === 'ur' ? 'تبدیلیاں محفوظ کریں' : 'Save Changes'}</span>`;
        
        // Show cancel button
        document.getElementById('cancel-btn').classList.remove('hidden');
        
        // Fill form fields
        document.getElementById('accountId').value = customer.accountId || '';
        document.getElementById('accountId').disabled = true;
        document.getElementById('issueDate').value = customer.issueDate ? customer.issueDate.split('T')[0] : '';
        document.getElementById('buyerName').value = customer.buyerName || '';
        document.getElementById('phone').value = customer.phone || '';
        document.getElementById('fatherName').value = customer.fatherName || '';
        document.getElementById('profession').value = customer.profession || '';
        document.getElementById('homeAddress').value = customer.homeAddress || '';
        document.getElementById('officeAddress').value = customer.officeAddress || '';
        
        // Fill images
        if (customer.photo) {
            document.getElementById('customer-photo-preview').innerHTML = `<img src="${customer.photo}" alt="Customer Photo">`;
        }
        if (customer.cnic) {
            document.getElementById('cnic-photo-preview').innerHTML = `<img src="${customer.cnic}" alt="CNIC Photo">`;
        }
        
        // Fill financial details
        document.getElementById('totalPrice').value = customer.totalPrice || 0;
        document.getElementById('advance').value = customer.advance || 0;
        document.getElementById('initialRemaining').value = customer.currentBalance || 0;
        document.getElementById('monthlyInstallment').value = customer.monthlyInstallment || 0;
        document.getElementById('items').value = customer.items || '';
        document.getElementById('modelNumber').value = customer.modelNumber || '';
        
        // Fill guarantors
        document.getElementById('g1Name').value = customer.guarantor1 || '';
        document.getElementById('g2Name').value = customer.guarantor2 || '';
        
    } catch (error) {
        console.error('Error loading customer for edit:', error);
        showMessage(currentLanguage === 'ur' ? 'ترمیم کے لیے لوڈ کرنے میں مسئلہ' : 'Error loading for edit', 'error');
    }
}

// ==============================================
// 12. PAYMENT MANAGEMENT
// ==============================================
async function openPaymentModal(customerId) {
    try {
        const doc = await db.collection('customers').doc(customerId).get();
        if (!doc.exists) {
            showMessage(currentLanguage === 'ur' ? 'کسٹمر نہیں ملا' : 'Customer not found', 'error');
            return;
        }
        
        const customer = doc.data();
        currentPaymentCustomerId = customerId;
        
        // Fill modal with customer info
        document.getElementById('payment-customer-name').textContent = customer.buyerName;
        document.getElementById('payment-account-id').textContent = customer.accountId;
        document.getElementById('payment-current-balance').textContent = formatCurrency(customer.currentBalance || 0);
        document.getElementById('payment-installment-amount').textContent = formatCurrency(customer.monthlyInstallment || 0);
        
        // Set default payment amount to monthly installment
        document.getElementById('payment-amount').value = customer.monthlyInstallment || 0;
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('payment-date').value = today;
        
        // Show modal
        document.getElementById('payment-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error opening payment modal:', error);
        showMessage(currentLanguage === 'ur' ? 'پیمنٹ موڈل کھولنے میں مسئلہ' : 'Error opening payment modal', 'error');
    }
}

function closeModal() {
    document.getElementById('payment-modal').classList.add('hidden');
    currentPaymentCustomerId = null;
}

async function submitPayment() {
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const date = document.getElementById('payment-date').value;
    const method = document.getElementById('payment-method').value;
    const notes = document.getElementById('payment-notes').value.trim();
    
    if (!amount || amount <= 0) {
        showMessage(
            currentLanguage === 'ur' ? 'براہ کرم درست رقم درج کریں' : 'Please enter a valid amount',
            'error'
        );
        return;
    }
    
    if (!date) {
        showMessage(
            currentLanguage === 'ur' ? 'براہ کرم تاریخ درج کریں' : 'Please enter a date',
            'error'
        );
        return;
    }
    
    try {
        const customerRef = db.collection('customers').doc(currentPaymentCustomerId);
        const customerDoc = await customerRef.get();
        
        if (!customerDoc.exists) {
            showMessage(currentLanguage === 'ur' ? 'کسٹمر نہیں ملا' : 'Customer not found', 'error');
            return;
        }
        
        const customer = customerDoc.data();
        const currentBalance = customer.currentBalance || 0;
        
        if (amount > currentBalance) {
            showMessage(
                currentLanguage === 'ur' ? 'ادائیگی بقایا سے زیادہ نہیں ہو سکتی' : 'Payment cannot exceed current balance',
                'error'
            );
            return;
        }
        
        // Calculate new balance
        const newBalance = currentBalance - amount;
        
        // Calculate next due date (add 1 month from payment date)
        const nextDueDate = new Date(date);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        
        // Update customer balance and next due date
        await customerRef.update({
            currentBalance: newBalance,
            nextDueDate: nextDueDate.toISOString(),
            lastPaymentDate: new Date().toISOString(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add payment to history subcollection
        await customerRef.collection('payments').add({
            amount: amount,
            date: new Date(date),
            method: method,
            notes: notes,
            recordedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showMessage(
            currentLanguage === 'ur' ? 'ادائیگی کامیابی سے درج ہو گئی' : 'Payment recorded successfully',
            'success'
        );
        
        // Close modal
        closeModal();
        
        // Refresh data
        loadDueCustomers();
        loadAllCustomers();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Error recording payment:', error);
        showMessage(
            currentLanguage === 'ur' ? 'ادائیگی درج کرنے میں مسئلہ' : 'Error recording payment',
            'error'
        );
    }
}

// ==============================================
// 13. DELETE FUNCTIONALITY
// ==============================================
async function openDeleteModal(customerId) {
    try {
        const doc = await db.collection('customers').doc(customerId).get();
        if (!doc.exists) {
            showMessage(currentLanguage === 'ur' ? 'کسٹمر نہیں ملا' : 'Customer not found', 'error');
            return;
        }
        
        const customer = doc.data();
        customerToDelete = customerId;
        
        // Fill modal with customer info
        document.getElementById('delete-customer-name').textContent = customer.buyerName;
        document.getElementById('delete-account-id').textContent = customer.accountId;
        
        // Show modal
        document.getElementById('delete-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error opening delete modal:', error);
        showMessage(currentLanguage === 'ur' ? 'ڈیلیٹ موڈل کھولنے میں مسئلہ' : 'Error opening delete modal', 'error');
    }
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    customerToDelete = null;
}

async function confirmDelete() {
    if (!customerToDelete) return;
    
    try {
        // Delete customer document
        await db.collection('customers').doc(customerToDelete).delete();
        
        // Delete associated payments subcollection
        const paymentsSnapshot = await db.collection('customers').doc(customerToDelete).collection('payments').get();
        const batch = db.batch();
        paymentsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        showMessage(
            currentLanguage === 'ur' ? 'کسٹمر کامیابی سے حذف ہو گیا' : 'Customer deleted successfully',
            'success'
        );
        
        // Close modal
        closeDeleteModal();
        
        // Refresh data
        loadDueCustomers();
        loadAllCustomers();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Error deleting customer:', error);
        showMessage(
            currentLanguage === 'ur' ? 'کسٹمر حذف کرنے میں مسئلہ' : 'Error deleting customer',
            'error'
        );
    }
}

// ==============================================
// 14. UTILITY FUNCTIONS
// ==============================================
function showMessage(message, type) {
    const messageElement = document.getElementById('save-message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        messageElement.classList.add('hidden');
    }, 5000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PK').format(amount);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function exportCustomers() {
    if (allCustomers.length === 0) {
        showMessage(
            currentLanguage === 'ur' ? 'ایکسپورٹ کرنے کے لیے کوئی ڈیٹا نہیں' : 'No data to export',
            'error'
        );
        return;
    }
    
    // Create CSV content
    let csvContent = "Account ID,Name,Phone,Monthly Installment,Current Balance,Next Due Date,Status,Items,Total Price,Advance\n";
    
    allCustomers.forEach(customer => {
        const dueDate = customer.nextDueDate ? new Date(customer.nextDueDate).toLocaleDateString() : 'N/A';
        const status = customer.currentBalance <= 0 ? 'Paid' : 'Pending';
        
        csvContent += `"${customer.accountId}","${customer.buyerName}","${customer.phone}",${customer.monthlyInstallment},${customer.currentBalance},"${dueDate}","${status}","${customer.items || ''}",${customer.totalPrice || 0},${customer.advance || 0}\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showMessage(
        currentLanguage === 'ur' ? 'کسٹمرز کی فائل ڈاؤن لوڈ ہو گئی' : 'Customers file downloaded',
        'success'
    );
}
