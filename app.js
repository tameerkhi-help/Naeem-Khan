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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==============================================
// 2. GLOBAL VARIABLES
// ==============================================
let currentLanguage = 'ur'; // 'ur' or 'en'
let currentCustomerId = null;
let allCustomers = [];

// ==============================================
// 3. LANGUAGE MANAGEMENT
// ==============================================
document.addEventListener('DOMContentLoaded', function() {
    // Language toggle button
    document.getElementById('langToggle').addEventListener('click', toggleLanguage);
    
    // Set Urdu as default
    updateLanguage();
    
    // Initialize image upload previews
    initImageUploads();
});

function toggleLanguage() {
    currentLanguage = currentLanguage === 'ur' ? 'en' : 'ur';
    updateLanguage();
    
    // Update HTML direction
    document.getElementById('htmlRoot').dir = currentLanguage === 'ur' ? 'rtl' : 'ltr';
    
    // Update language button text
    document.getElementById('langText').textContent = currentLanguage === 'ur' ? 'English' : 'اردو';
}

function updateLanguage() {
    // Get all elements with data attributes for translation
    const elements = document.querySelectorAll('[data-ur], [data-en]');
    
    elements.forEach(element => {
        if (currentLanguage === 'ur') {
            if (element.getAttribute('data-ur')) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = element.getAttribute('data-ur');
                } else {
                    element.textContent = element.getAttribute('data-ur');
                }
            }
        } else {
            if (element.getAttribute('data-en')) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = element.getAttribute('data-en');
                } else {
                    element.textContent = element.getAttribute('data-en');
                }
            }
        }
    });
}

// ==============================================
// 4. IMAGE HANDLING
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
}

function handleImageUpload(file, previewElement) {
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        alert(currentLanguage === 'ur' ? 'براہ کرم صرف تصاویر اپ لوڈ کریں' : 'Please upload only images');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert(currentLanguage === 'ur' ? 'تصویر کا سائز 5MB سے زیادہ نہیں ہونا چاہیے' : 'Image size should not exceed 5MB');
        return;
    }
    
    compressImage(file).then(compressedImage => {
        const img = document.createElement('img');
        img.src = compressedImage;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        previewElement.innerHTML = '';
        previewElement.appendChild(img);
    }).catch(error => {
        console.error('Image compression error:', error);
        alert(currentLanguage === 'ur' ? 'تصویر اپ لوڈ کرنے میں مسئلہ پیش آیا' : 'Error uploading image');
    });
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 400;
                const maxHeight = 400;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
        reader.onerror = error => reject(error);
    });
}

// ==============================================
// 5. AUTHENTICATION
// ==============================================
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        loadDashboardStats();
        loadDueCustomers();
    } else {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    }
});

function login() {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    if (!email || !password) {
        showMessage(currentLanguage === 'ur' ? 'براہ کرم ای میل اور پاس ورڈ درج کریں' : 'Please enter email and password', 'error');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
            console.error('Login error:', err);
            showMessage(
                currentLanguage === 'ur' ? 'لاگ ان ناکام: غلط ای میل یا پاس ورڈ' : 'Login failed: Invalid email or password',
                'error'
            );
        });
}

function logout() {
    auth.signOut();
    showMessage(currentLanguage === 'ur' ? 'لاگ آؤٹ ہو گیا' : 'Logged out successfully', 'success');
}

// ==============================================
// 6. DASHBOARD FUNCTIONS
// ==============================================
async function loadDashboardStats() {
    try {
        const snapshot = await db.collection('customers').get();
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCustomers = customers;
        
        // Total customers
        document.getElementById('total-customers').textContent = customers.length;
        
        // Due today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dueToday = customers.filter(customer => {
            if (!customer.nextDueDate) return false;
            const dueDate = new Date(customer.nextDueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime() && customer.currentBalance > 0;
        }).length;
        
        document.getElementById('due-today').textContent = dueToday;
        
        // Total balance
        const totalBalance = customers.reduce((sum, customer) => sum + (customer.currentBalance || 0), 0);
        document.getElementById('total-balance').textContent = totalBalance.toFixed(0);
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function showView(viewId) {
    // Hide all views
    document.querySelectorAll('.content-view').forEach(v => v.classList.add('hidden'));
    
    // Show selected view
    document.getElementById(viewId).classList.remove('hidden');
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active-nav'));
    document.querySelector(`button[onclick="showView('${viewId}')"]`).classList.add('active-nav');
    
    // Load data for the view
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
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
    try {
        const snapshot = await db.collection('customers').get();
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter customers with balance > 0
        const dueCustomers = customers.filter(c => (c.currentBalance || 0) > 0);
        
        // Sort by next due date
        dueCustomers.sort((a, b) => {
            const dateA = a.nextDueDate ? new Date(a.nextDueDate) : new Date();
            const dateB = b.nextDueDate ? new Date(b.nextDueDate) : new Date();
            return dateA - dateB;
        });
        
        tbody.innerHTML = '';
        
        if (dueCustomers.length === 0) {
            document.getElementById('no-due-msg').classList.remove('hidden');
            return;
        }
        
        document.getElementById('no-due-msg').classList.add('hidden');
        
        dueCustomers.forEach(customer => {
            const dueDate = customer.nextDueDate ? new Date(customer.nextDueDate) : new Date();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Determine status
            let statusClass = 'status-pending';
            let statusText = currentLanguage === 'ur' ? 'زیر التواء' : 'Pending';
            
            if (dueDate < today) {
                statusClass = 'status-overdue';
                statusText = currentLanguage === 'ur' ? 'تاخیر' : 'Overdue';
            } else if (dueDate.getTime() === today.getTime()) {
                statusClass = 'status-paid';
                statusText = currentLanguage === 'ur' ? 'آج' : 'Today';
            }
            
            const row = `
                <tr>
                    <td><strong>${customer.accountId || customer.id}</strong></td>
                    <td>${customer.buyerName || 'N/A'}</td>
                    <td>${customer.phone || 'N/A'}</td>
                    <td>${customer.monthlyInstallment || 0}</td>
                    <td class="balance-cell">Rs. ${customer.currentBalance || 0}</td>
                    <td>${dueDate.toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <span class="status-badge ${statusClass}">${statusText}</span>
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center error">Error loading data</td></tr>';
    }
}

function refreshDueList() {
    loadDueCustomers();
    loadDashboardStats();
}

// ==============================================
// 8. CUSTOMER MANAGEMENT - ALL CUSTOMERS
// ==============================================
async function loadAllCustomers() {
    const tbody = document.getElementById('all-customers-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    
    try {
        const snapshot = await db.collection('customers').get();
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
            
            // Determine status
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
                    <td><strong>${customer.accountId || customer.id}</strong></td>
                    <td>${customer.buyerName || 'N/A'}</td>
                    <td>${customer.phone || 'N/A'}</td>
                    <td>${customer.monthlyInstallment || 0}</td>
                    <td class="balance-cell">Rs. ${customer.currentBalance || 0}</td>
                    <td>${dueDate.toLocaleDateString()}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-view" onclick="viewCustomerDetails('${customer.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-edit" onclick="editCustomer('${customer.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-pay" onclick="openPaymentModal('${customer.id}')">
                                <i class="fas fa-money-check-alt"></i>
                            </button>
                            <button class="btn-delete" onclick="openDeleteModal('${customer.id}')">
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
    }
}

// ==============================================
// 9. CUSTOMER MANAGEMENT - SEARCH
// ==============================================
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
                query = await db.collection('customers').where('buyerName', '>=', searchInput).where('buyerName', '<=', searchInput + '\uf8ff').get();
                break;
            case 'phone':
                query = await db.collection('customers').where('phone', '==', searchInput).get();
                break;
        }
        
        if (query.empty) {
            resultContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h4>${currentLanguage === 'ur' ? 'کوئی کسٹمر نہیں ملا' : 'No customer found'}</h4>
                    <p>${currentLanguage === 'ur' ? 'براہ کرم مختلف سرچ ٹرم استعمال کریں' : 'Please try a different search term'}</p>
                </div>
            `;
            return;
        }
        
        resultContainer.innerHTML = '';
        
        query.forEach(doc => {
            const customer = { id: doc.id, ...doc.data() };
            const dueDate = customer.nextDueDate ? new Date(customer.nextDueDate) : new Date();
            
            const card = `
                <div class="customer-card">
                    <div class="customer-header">
                        <div>
                            <h4>${customer.buyerName}</h4>
                            <p class="customer-id">ID: ${customer.accountId}</p>
                        </div>
                        <div class="customer-actions">
                            <button class="btn-view" onclick="viewCustomerDetails('${customer.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-edit" onclick="editCustomer('${customer.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="openDeleteModal('${customer.id}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="customer-body">
                        <div class="customer-info-row">
                            <span class="info-label">${currentLanguage === 'ur' ? 'فون' : 'Phone'}</span>
                            <span class="info-value">${customer.phone || 'N/A'}</span>
                        </div>
                        <div class="customer-info-row">
                            <span class="info-label">${currentLanguage === 'ur' ? 'ماہانہ قسط' : 'Monthly Installment'}</span>
                            <span class="info-value">Rs. ${customer.monthlyInstallment || 0}</span>
                        </div>
                        <div class="customer-info-row">
                            <span class="info-label">${currentLanguage === 'ur' ? 'بقایا بیلنس' : 'Current Balance'}</span>
                            <span class="info-value">Rs. ${customer.currentBalance || 0}</span>
                        </div>
                        <div class="customer-info-row">
                            <span class="info-label">${currentLanguage === 'ur' ? 'اگلی تاریخ' : 'Next Due Date'}</span>
                            <span class="info-value">${dueDate.toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="customer-footer">
                        <div class="balance-info">
                            ${currentLanguage === 'ur' ? 'کل بقایا:' : 'Total Balance:'} Rs. ${customer.currentBalance || 0}
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
        
    } catch (error) {
        console.error('Error searching customers:', error);
        resultContainer.innerHTML = '<div class="text-center error">Error searching customers</div>';
    }
}

function clearSearchResults() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-result-container').innerHTML = '';
}

// ==============================================
// 10. CUSTOMER MANAGEMENT - VIEW/EDIT/DELETE
// ==============================================
async function viewCustomerDetails(customerId) {
    try {
        const doc = await db.collection('customers').doc(customerId).get();
        if (!doc.exists) {
            showMessage(currentLanguage === 'ur' ? 'کسٹمر نہیں ملا' : 'Customer not found', 'error');
            return;
        }
        
        const customer = doc.data();
        showView('search-view');
        clearSearchResults();
        
        // Display customer details in search view
        const resultContainer = document.getElementById('search-result-container');
        
        // Get payment history
        const paymentsSnapshot = await db.collection('customers').doc(customerId).collection('payments').orderBy('date', 'desc').get();
        const payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let paymentHistoryHTML = '';
        if (payments.length > 0) {
            paymentHistoryHTML = `
                <h4>${currentLanguage === 'ur' ? 'ادائیگی کی تاریخ' : 'Payment History'}</h4>
                <div class="payment-history">
                    ${payments.map(payment => `
                        <div class="payment-item">
                            <span>${new Date(payment.date.seconds * 1000).toLocaleDateString()}</span>
                            <span>Rs. ${payment.amount}</span>
                            <span>${payment.method || 'Cash'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        resultContainer.innerHTML = `
            <div class="customer-card expanded">
                <div class="customer-header">
                    <div>
                        <h4>${customer.buyerName}</h4>
                        <p class="customer-id">ID: ${customer.accountId}</p>
                    </div>
                    <div class="customer-actions">
                        <button class="btn-edit" onclick="editCustomer('${customerId}')">
                            <i class="fas fa-edit"></i>
                            ${currentLanguage === 'ur' ? 'ترمیم' : 'Edit'}
                        </button>
                        <button class="btn-delete" onclick="openDeleteModal('${customerId}')">
                            <i class="fas fa-trash-alt"></i>
                            ${currentLanguage === 'ur' ? 'حذف' : 'Delete'}
                        </button>
                    </div>
                </div>
                <div class="customer-body">
                    <div class="customer-info-grid">
                        <div class="info-group">
                            <h5>${currentLanguage === 'ur' ? 'ذاتی معلومات' : 'Personal Information'}</h5>
                            <p><strong>${currentLanguage === 'ur' ? 'والد کا نام:' : 'Father Name:'}</strong> ${customer.fatherName || 'N/A'}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'پیشہ:' : 'Profession:'}</strong> ${customer.profession || 'N/A'}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'فون:' : 'Phone:'}</strong> ${customer.phone || 'N/A'}</p>
                        </div>
                        <div class="info-group">
                            <h5>${currentLanguage === 'ur' ? 'پتے' : 'Addresses'}</h5>
                            <p><strong>${currentLanguage === 'ur' ? 'گھر:' : 'Home:'}</strong> ${customer.homeAddress || 'N/A'}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'دفتر:' : 'Office:'}</strong> ${customer.officeAddress || 'N/A'}</p>
                        </div>
                        <div class="info-group">
                            <h5>${currentLanguage === 'ur' ? 'مالیت' : 'Financial Details'}</h5>
                            <p><strong>${currentLanguage === 'ur' ? 'کل قیمت:' : 'Total Price:'}</strong> Rs. ${customer.totalPrice || 0}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'ایڈوانس:' : 'Advance:'}</strong> Rs. ${customer.advance || 0}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'بقایا:' : 'Balance:'}</strong> Rs. ${customer.currentBalance || 0}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'ماہانہ قسط:' : 'Monthly Installment:'}</strong> Rs. ${customer.monthlyInstallment || 0}</p>
                        </div>
                        <div class="info-group">
                            <h5>${currentLanguage === 'ur' ? 'سامان کی تفصیلات' : 'Product Details'}</h5>
                            <p><strong>${currentLanguage === 'ur' ? 'سامان:' : 'Items:'}</strong> ${customer.items || 'N/A'}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'ماڈل:' : 'Model:'}</strong> ${customer.modelNumber || 'N/A'}</p>
                            <p><strong>${currentLanguage === 'ur' ? 'اگلی تاریخ:' : 'Next Due:'}</strong> ${customer.nextDueDate ? new Date(customer.nextDueDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                    </div>
                    <div class="guarantors-section">
                        <h5>${currentLanguage === 'ur' ? 'ضامن' : 'Guarantors'}</h5>
                        <p><strong>${currentLanguage === 'ur' ? 'پہلا ضامن:' : 'Guarantor 1:'}</strong> ${customer.guarantor1 || 'N/A'}</p>
                        <p><strong>${currentLanguage === 'ur' ? 'دوسرا ضامن:' : 'Guarantor 2:'}</strong> ${customer.guarantor2 || 'N/A'}</p>
                    </div>
                    ${paymentHistoryHTML}
                </div>
                <div class="customer-footer">
                    <div class="balance-info">
                        ${currentLanguage === 'ur' ? 'کل بقایا:' : 'Total Balance:'} Rs. ${customer.currentBalance || 0}
                    </div>
                    <button class="btn-pay-tick" onclick="openPaymentModal('${customerId}')">
                        <i class="fas fa-money-check-alt"></i>
                        ${currentLanguage === 'ur' ? 'ادائیگی درج کریں' : 'Record Payment'}
                    </button>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error viewing customer details:', error);
        showMessage(currentLanguage === 'ur' ? 'تفصیلات لوڈ کرنے میں مسئلہ' : 'Error loading details', 'error');
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
        document.getElementById('form-title').textContent = currentLanguage === 'ur' ? 'کسٹمر میں ترمیم کریں' : 'Edit Customer';
        document.getElementById('form-icon').className = 'fas fa-edit';
        document.getElementById('save-btn').innerHTML = `<i class="fas fa-save"></i> <span>${currentLanguage === 'ur' ? 'تبدیلیاں محفوظ کریں' : 'Save Changes'}</span>`;
        
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
            document.getElementById('customer-photo-preview').innerHTML = `<img src="${customer.photo}">`;
        }
        if (customer.cnic) {
            document.getElementById('cnic-photo-preview').innerHTML = `<img src="${customer.cnic}">`;
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

async function deleteCustomer(customerId) {
    try {
        // Delete customer document
        await db.collection('customers').doc(customerId).delete();
        
        // Delete associated payments subcollection
        const paymentsSnapshot = await db.collection('customers').doc(customerId).collection('payments').get();
        const batch = db.batch();
        paymentsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        showMessage(
            currentLanguage === 'ur' ? 'کسٹمر کامیابی سے حذف ہو گیا' : 'Customer deleted successfully',
            'success'
        );
        
        // Refresh views
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
// 11. CUSTOMER FORM HANDLING
// ==============================================
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
    
    // Reset preview images
    document.getElementById('customer-photo-preview').innerHTML = '';
    document.getElementById('cnic-photo-preview').innerHTML = '';
    
    // Reset form title and button
    document.getElementById('form-title').textContent = currentLanguage === 'ur' ? 'نیا کسٹمر شامل کریں' : 'Add New Customer';
    document.getElementById('form-icon').className = 'fas fa-user-plus';
    document.getElementById('save-btn').innerHTML = `<i class="fas fa-save"></i> <span>${currentLanguage === 'ur' ? 'کسٹمر محفوظ کریں' : 'Save Customer'}</span>`;
    
    // Hide cancel button
    document.getElementById('cancel-btn').classList.add('hidden');
    
    // Recalculate remaining
    calculateRemaining();
}

function cancelEdit() {
    resetForm();
    showView('due-list-view');
}

document.getElementById('customer-form').addEventListener('submit', async function(e) {
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
        const customerPhotoPreview = document.getElementById('customer-photo-preview');
        const cnicPhotoPreview = document.getElementById('cnic-photo-preview');
        
        let photoBase64 = '';
        let cnicBase64 = '';
        
        if (customerPhotoPreview.querySelector('img')) {
            photoBase64 = customerPhotoPreview.querySelector('img').src;
        }
        
        if (cnicPhotoPreview.querySelector('img')) {
            cnicBase64 = cnicPhotoPreview.querySelector('img').src;
        }
        
        // Calculate next due date (if adding new customer)
        let nextDueDate;
        if (formMode === 'add') {
            nextDueDate = new Date();
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }
        
        const customerData = {
            accountId: accountId,
            buyerName: document.getElementById('buyerName').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            fatherName: document.getElementById('fatherName').value.trim(),
            profession: document.getElementById('profession').value.trim(),
            homeAddress: document.getElementById('homeAddress').value.trim(),
            officeAddress: document.getElementById('officeAddress').value.trim(),
            
            photo: photoBase64,
            cnic: cnicBase64,
            
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
            customerData.nextDueDate = nextDueDate.toISOString();
        }
        
        // Save to Firestore
        const docId = formMode === 'edit' ? document.getElementById('original-account-id').value : accountId;
        await db.collection('customers').doc(docId).set(customerData, { merge: true });
        
        showMessage(
            currentLanguage === 'ur' 
                ? `کسٹمر ${formMode === 'add' ? 'کامیابی سے شامل ہو گیا' : 'کی معلومات کامیابی سے اپ ڈیٹ ہو گئیں'}`
                : `Customer ${formMode === 'add' ? 'added successfully' : 'information updated successfully'}`,
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
});

// ==============================================
// 12. PAYMENT MANAGEMENT
// ==============================================
let currentPaymentCustomerId = null;

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
        document.getElementById('payment-current-balance').textContent = customer.currentBalance || 0;
        document.getElementById('payment-installment-amount').textContent = customer.monthlyInstallment || 0;
        
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
    const notes = document.getElementById('payment-notes').value;
    
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
        // Get current customer data
        const customerRef = db.collection('customers').doc(currentPaymentCustomerId);
        const customerDoc = await customerRef.get();
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
        
        // Calculate next due date (add 1 month from now)
        const nextDueDate = new Date();
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
// 13. DELETE CONFIRMATION MODAL
// ==============================================
let customerToDelete = null;

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
        await deleteCustomer(customerToDelete);
        closeDeleteModal();
    } catch (error) {
        console.error('Error confirming delete:', error);
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

function exportCustomers() {
    // Create CSV content
    let csvContent = "Account ID,Name,Phone,Monthly Installment,Current Balance,Next Due Date,Status\n";
    
    allCustomers.forEach(customer => {
        const dueDate = customer.nextDueDate ? new Date(customer.nextDueDate).toLocaleDateString() : 'N/A';
        const status = customer.currentBalance <= 0 ? 'Paid' : 'Pending';
        
        csvContent += `"${customer.accountId}","${customer.buyerName}","${customer.phone}",${customer.monthlyInstallment},${customer.currentBalance},"${dueDate}","${status}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// ==============================================
// 15. INITIALIZATION
// ==============================================
// Set today's date as default in issue date field
window.onload = function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
    document.getElementById('payment-date').value = today;
};
