// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCujiWEwr3657z7L6mI9xmIwMZjYJchoJc",
  authDomain: "naeem-khan-f7d4f.firebaseapp.com",
  projectId: "naeem-khan-f7d4f",
  storageBucket: "naeem-khan-f7d4f.firebasestorage.app",
  messagingSenderId: "20329827636",
  appId: "1:20329827636:web:6bc934919ca09e683f2961",
  measurementId: "G-DHCVE17PDS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Security: Base64 encoding for PIN (NOT visible plain text in code)
const ADMIN_PIN_ENCODED = btoa("134047");

// Session Management
class SessionManager {
    static checkLogin() {
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        const currentPage = window.location.pathname.split('/').pop();
        
        if (!isLoggedIn && currentPage !== 'index.html') {
            window.location.href = 'index.html';
            return false;
        }
        
        return true;
    }

    static login(encodedPin, isStaff = false) {
        if (encodedPin === ADMIN_PIN_ENCODED) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('role', 'admin');
            return 'admin';
        } else if (isStaff) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('role', 'staff');
            return 'staff';
        }
        return false;
    }

    static logout() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('role');
        window.location.href = 'index.html';
    }

    static getRole() {
        return localStorage.getItem('role') || 'staff';
    }
}

// Database Operations
class Database {
    static customersCollection = collection(db, 'customers');
    static paymentsCollection = collection(db, 'payments');

    static async addCustomer(customerData) {
        try {
            const docRef = await addDoc(this.customersCollection, {
                ...customerData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error adding customer:', error);
            return { success: false, error };
        }
    }

    static async getCustomers() {
        try {
            const q = query(this.customersCollection, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const customers = [];
            querySnapshot.forEach((doc) => {
                customers.push({ id: doc.id, ...doc.data() });
            });
            return customers;
        } catch (error) {
            console.error('Error getting customers:', error);
            return [];
        }
    }

    static async getCustomer(id) {
        try {
            const customers = await this.getCustomers();
            return customers.find(c => c.id === id);
        } catch (error) {
            console.error('Error getting customer:', error);
            return null;
        }
    }

    static async updateCustomer(id, data) {
        try {
            const customerRef = doc(db, 'customers', id);
            await updateDoc(customerRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
            return { success: true };
        } catch (error) {
            console.error('Error updating customer:', error);
            return { success: false, error };
        }
    }

    static async deleteCustomer(id) {
        try {
            await deleteDoc(doc(db, 'customers', id));
            return { success: true };
        } catch (error) {
            console.error('Error deleting customer:', error);
            return { success: false, error };
        }
    }

    static async addPayment(customerId, paymentData) {
        try {
            await addDoc(this.paymentsCollection, {
                customerId,
                ...paymentData,
                date: new Date().toISOString()
            });
            
            // Update customer's remaining balance
            const customer = await this.getCustomer(customerId);
            if (customer) {
                const newBalance = Math.max(0, (customer.remainingBalance || customer.totalPrice - customer.advancePaid) - paymentData.amount);
                await this.updateCustomer(customerId, {
                    remainingBalance: newBalance,
                    lastPaymentDate: new Date().toISOString()
                });
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error adding payment:', error);
            return { success: false, error };
        }
    }

    static async getPayments(customerId) {
        try {
            const q = query(this.paymentsCollection, 
                where('customerId', '==', customerId),
                orderBy('date', 'desc'));
            const querySnapshot = await getDocs(q);
            const payments = [];
            querySnapshot.forEach((doc) => {
                payments.push({ id: doc.id, ...doc.data() });
            });
            return payments;
        } catch (error) {
            console.error('Error getting payments:', error);
            return [];
        }
    }
}

// Image Upload
class ImageUploader {
    static async uploadImage(file, folder = 'customer_photos') {
        if (!file) return null;
        
        try {
            const timestamp = Date.now();
            const fileName = `${folder}_${timestamp}_${file.name}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading image:', error);
            return null;
        }
    }

    static previewImage(input, previewElementId) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById(previewElementId);
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    }
}

// Utility Functions
class Utils {
    static formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    }

    static formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN');
    }

    static generateTrackingId() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `NK${timestamp}${random}`;
    }

    static calculateRemainingBalance(total, advance) {
        const totalNum = parseFloat(total) || 0;
        const advanceNum = parseFloat(advance) || 0;
        return Math.max(0, totalNum - advanceNum);
    }
}

// Page-specific Initialization
class PageManager {
    static async init() {
        // Check login state
        if (!SessionManager.checkLogin()) return;

        const currentPage = window.location.pathname.split('/').pop();
        
        // Set user role display
        const role = SessionManager.getRole();
        const roleElements = document.querySelectorAll('#userRole');
        roleElements.forEach(el => {
            if (el) el.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        });

        // Setup logout button
        const logoutButtons = document.querySelectorAll('#logoutBtn');
        logoutButtons.forEach(btn => {
            if (btn) btn.addEventListener('click', (e) => {
                e.preventDefault();
                SessionManager.logout();
            });
        });

        // Page-specific initialization
        switch(currentPage) {
            case 'dashboard.html':
                await this.initDashboard();
                break;
            case 'add_customer.html':
                await this.initAddCustomer();
                break;
            case 'customer_details.html':
                await this.initCustomerDetails();
                break;
            case 'index.html':
                this.initLogin();
                break;
            default:
                if (currentPage.includes('customer_list')) {
                    await this.initCustomerList();
                }
        }
    }

    static initLogin() {
        const loginBtn = document.getElementById('loginBtn');
        const staffBtn = document.getElementById('staffBtn');
        const pinInput = document.getElementById('pin');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                const encodedPin = btoa(pinInput.value);
                const role = SessionManager.login(encodedPin);
                
                if (role === 'admin') {
                    window.location.href = 'dashboard.html';
                } else {
                    alert('Invalid PIN code!');
                }
            });
        }

        if (staffBtn) {
            staffBtn.addEventListener('click', () => {
                SessionManager.login('', true);
                window.location.href = 'dashboard.html';
            });
        }
    }

    static async initDashboard() {
        await this.loadDashboardStats();
        await this.loadCustomerTable();
        this.setupSearch();
        this.setupModals();
    }

    static async loadDashboardStats() {
        const customers = await Database.getCustomers();
        const totalCustomers = customers.length;
        const totalReceivables = customers.reduce((sum, customer) => {
            const balance = customer.remainingBalance || 
                          Utils.calculateRemainingBalance(customer.totalPrice, customer.advancePaid);
            return sum + balance;
        }, 0);
        const completedAccounts = customers.filter(customer => {
            const balance = customer.remainingBalance || 
                          Utils.calculateRemainingBalance(customer.totalPrice, customer.advancePaid);
            return balance === 0;
        }).length;

        document.getElementById('totalCustomers').textContent = totalCustomers;
        document.getElementById('totalReceivables').textContent = Utils.formatCurrency(totalReceivables);
        document.getElementById('completedAccounts').textContent = completedAccounts;
        document.getElementById('activeAccounts').textContent = totalCustomers - completedAccounts;
        document.getElementById('totalCount').textContent = totalCustomers;
    }

    static async loadCustomerTable() {
        const customers = await Database.getCustomers();
        const tableBody = document.getElementById('customerTableBody');
        const role = SessionManager.getRole();
        const isAdmin = role === 'admin';

        tableBody.innerHTML = '';

        customers.forEach(customer => {
            const balance = customer.remainingBalance || 
                          Utils.calculateRemainingBalance(customer.totalPrice, customer.advancePaid);
            const isCompleted = balance === 0;
            const rowClass = isCompleted ? 'status-completed' : '';

            const row = document.createElement('tr');
            row.className = rowClass;
            row.innerHTML = `
                <td>${customer.trackingId || customer.id.slice(-6)}</td>
                <td>
                    <img src="${customer.photo || 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\"><rect width=\"100%\" height=\"100%\" fill=\"%23004d7a\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"12\" fill=\"white\" text-anchor=\"middle\" dy=\".3em\">N/A</text></svg>'}" 
                         alt="Photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                </td>
                <td>${customer.customerName || 'N/A'}</td>
                <td>${Utils.formatCurrency(balance)}</td>
                <td>
                    <span class="status-badge ${isCompleted ? 'completed' : 'pending'}">
                        ${isCompleted ? 'COMPLETED' : 'PENDING'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary pay-btn" data-id="${customer.id}">
                        <i class="fas fa-money-bill"></i> Pay
                    </button>
                    <button class="btn btn-sm btn-success view-btn" data-id="${customer.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${isAdmin ? `
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${customer.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });

        document.getElementById('shownCount').textContent = customers.length;

        // Add event listeners
        this.setupTableButtons();
    }

    static setupTableButtons() {
        // Pay buttons
        document.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const customerId = e.target.closest('.pay-btn').dataset.id;
                this.openPaymentModal(customerId);
            });
        });

        // View buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const customerId = e.target.closest('.view-btn').dataset.id;
                window.location.href = `customer_details.html?id=${customerId}`;
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const customerId = e.target.closest('.delete-btn').dataset.id;
                this.openDeleteModal(customerId);
            });
        });
    }

    static setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', async (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const customers = await Database.getCustomers();
                const filtered = customers.filter(customer => 
                    customer.customerName?.toLowerCase().includes(searchTerm) ||
                    customer.trackingId?.toLowerCase().includes(searchTerm) ||
                    customer.cnic?.includes(searchTerm)
                );
                
                // Update table with filtered results
                const tableBody = document.getElementById('customerTableBody');
                tableBody.innerHTML = '';
                
                filtered.forEach(customer => {
                    const balance = customer.remainingBalance || 
                                  Utils.calculateRemainingBalance(customer.totalPrice, customer.advancePaid);
                    const isCompleted = balance === 0;
                    const rowClass = isCompleted ? 'status-completed' : '';

                    const row = document.createElement('tr');
                    row.className = rowClass;
                    row.innerHTML = `
                        <td>${customer.trackingId || customer.id.slice(-6)}</td>
                        <td>
                            <img src="${customer.photo || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzAwNGQ3YSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TkE8L3RleHQ+PC9zdmc+'}" 
                                 alt="Photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                        </td>
                        <td>${customer.customerName || 'N/A'}</td>
                        <td>${Utils.formatCurrency(balance)}</td>
                        <td>
                            <span class="status-badge ${isCompleted ? 'completed' : 'pending'}">
                                ${isCompleted ? 'COMPLETED' : 'PENDING'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary pay-btn" data-id="${customer.id}">
                                <i class="fas fa-money-bill"></i> Pay
                            </button>
                            <button class="btn btn-sm btn-success view-btn" data-id="${customer.id}">
                                <i class="fas fa-eye"></i> View
                            </button>
                            ${SessionManager.getRole() === 'admin' ? `
                                <button class="btn btn-sm btn-danger delete-btn" data-id="${customer.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </td>
                    `;

                    tableBody.appendChild(row);
                });

                document.getElementById('shownCount').textContent = filtered.length;
                this.setupTableButtons();
            });
        }
    }

    static setupModals() {
        const modals = document.querySelectorAll('.modal');
        const closeButtons = document.querySelectorAll('.close-modal');

        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                modals.forEach(modal => modal.classList.remove('active'));
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });
    }

    static async openPaymentModal(customerId) {
        const modal = document.getElementById('paymentModal');
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        
        // Set today's date as default
        document.getElementById('paymentDate').valueAsDate = new Date();
        
        // Clear previous event listener
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', async () => {
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            const date = document.getElementById('paymentDate').value;
            const notes = document.getElementById('paymentNotes').value;
            
            if (!amount || amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }
            
            const result = await Database.addPayment(customerId, {
                amount,
                date: new Date(date).toISOString(),
                notes,
                method: 'Cash' // Default payment method
            });
            
            if (result.success) {
                alert('Payment recorded successfully!');
                modal.classList.remove('active');
                await this.loadDashboardStats();
                await this.loadCustomerTable();
                
                // Clear form
                document.getElementById('paymentAmount').value = '';
                document.getElementById('paymentNotes').value = '';
            } else {
                alert('Error recording payment. Please try again.');
            }
        });
        
        modal.classList.add('active');
    }

    static openDeleteModal(customerId) {
        const modal = document.getElementById('deleteModal');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        // Clear previous event listener
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', async () => {
            const enteredPin = document.getElementById('deletePin').value;
            const encodedPin = btoa(enteredPin);
            
            if (encodedPin !== ADMIN_PIN_ENCODED) {
                alert('Incorrect PIN. Deletion cancelled.');
                modal.classList.remove('active');
                return;
            }
            
            const result = await Database.deleteCustomer(customerId);
            
            if (result.success) {
                alert('Customer deleted successfully!');
                modal.classList.remove('active');
                await this.loadDashboardStats();
                await this.loadCustomerTable();
                document.getElementById('deletePin').value = '';
            } else {
                alert('Error deleting customer. Please try again.');
            }
        });
        
        modal.classList.add('active');
    }

    static async initAddCustomer() {
        const form = document.getElementById('customerForm');
        
        // Set today's date as default for registration
        document.getElementById('registrationDate').valueAsDate = new Date();
        document.getElementById('startDate').valueAsDate = new Date();
        
        // Auto-generate tracking ID if empty
        document.getElementById('trackingId').addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.value = Utils.generateTrackingId();
            }
        });
        
        // Calculate remaining balance in real-time
        const calculateBalance = () => {
            const totalPrice = parseFloat(document.getElementById('totalPrice').value) || 0;
            const advancePaid = parseFloat(document.getElementById('advancePaid').value) || 0;
            const remaining = Utils.calculateRemainingBalance(totalPrice, advancePaid);
            
            document.getElementById('remainingBalance').value = Utils.formatCurrency(remaining);
            document.getElementById('statusDisplay').textContent = remaining === 0 ? 'COMPLETED' : 'PENDING';
            document.getElementById('statusDisplay').className = remaining === 0 ? 'status-completed' : 'status-pending';
        };
        
        document.getElementById('totalPrice').addEventListener('input', calculateBalance);
        document.getElementById('advancePaid').addEventListener('input', calculateBalance);
        
        // Image previews
        document.getElementById('customerPhoto').addEventListener('change', function() {
            ImageUploader.previewImage(this, 'photoPreview');
        });
        
        document.getElementById('cnicFront').addEventListener('change', function() {
            ImageUploader.previewImage(this, 'cnicFrontPreview');
        });
        
        document.getElementById('cnicBack').addEventListener('change', function() {
            ImageUploader.previewImage(this, 'cnicBackPreview');
        });
        
        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get all form values
            const formData = {
                trackingId: document.getElementById('trackingId').value || Utils.generateTrackingId(),
                registrationDate: document.getElementById('registrationDate').value,
                customerName: document.getElementById('customerName').value,
                fatherName: document.getElementById('fatherName').value,
                cnic: document.getElementById('cnic').value,
                phone1: document.getElementById('phone1').value,
                phone2: document.getElementById('phone2').value,
                address: document.getElementById('address').value,
                jobTitle: document.getElementById('jobTitle').value,
                guarantorName: document.getElementById('guarantorName').value,
                guarantorPhone: document.getElementById('guarantorPhone').value,
                guarantorCnic: document.getElementById('guarantorCnic').value,
                guarantorAddress: document.getElementById('guarantorAddress').value,
                productName: document.getElementById('productName').value,
                totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
                advancePaid: parseFloat(document.getElementById('advancePaid').value) || 0,
                monthlyInstallment: parseFloat(document.getElementById('monthlyInstallment').value) || 0,
                startDate: document.getElementById('startDate').value,
                remainingBalance: Utils.calculateRemainingBalance(
                    parseFloat(document.getElementById('totalPrice').value) || 0,
                    parseFloat(document.getElementById('advancePaid').value) || 0
                )
            };
            
            // Upload images
            const photoFile = document.getElementById('customerPhoto').files[0];
            const cnicFrontFile = document.getElementById('cnicFront').files[0];
            const cnicBackFile = document.getElementById('cnicBack').files[0];
            
            try {
                if (photoFile) formData.photo = await ImageUploader.uploadImage(photoFile, 'customer_photos');
                if (cnicFrontFile) formData.cnicFront = await ImageUploader.uploadImage(cnicFrontFile, 'cnic_front');
                if (cnicBackFile) formData.cnicBack = await ImageUploader.uploadImage(cnicBackFile, 'cnic_back');
                
                // Save to database
                const result = await Database.addCustomer(formData);
                
                if (result.success) {
                    alert('Customer added successfully!');
                    window.location.href = 'dashboard.html';
                } else {
                    alert('Error adding customer. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred. Please check your data and try again.');
            }
        });
    }

    static async initCustomerDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        const customerId = urlParams.get('id');
        
        if (!customerId) {
            alert('No customer selected. Redirecting to dashboard...');
            window.location.href = 'dashboard.html';
            return;
        }
        
        const customer = await Database.getCustomer(customerId);
        if (!customer) {
            alert('Customer not found. Redirecting to dashboard...');
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Display customer information
        this.displayCustomerDetails(customer);
        
        // Load payment history
        await this.loadPaymentHistory(customerId);
        
        // Setup buttons
        this.setupDetailButtons(customer);
    }

    static displayCustomerDetails(customer) {
        // Basic info
        document.getElementById('customerIdDisplay').textContent = `Tracking ID: ${customer.trackingId || 'N/A'}`;
        document.getElementById('detailName').textContent = customer.customerName || 'N/A';
        document.getElementById('detailFatherName').textContent = customer.fatherName || 'N/A';
        document.getElementById('detailCnic').textContent = customer.cnic || 'N/A';
        document.getElementById('detailPhone').textContent = customer.phone1 || 'N/A';
        document.getElementById('detailAddress').textContent = customer.address || 'N/A';
        document.getElementById('detailJob').textContent = customer.jobTitle || 'N/A';
        
        // Financial info
        document.getElementById('summaryProduct').textContent = customer.productName || 'N/A';
        document.getElementById('summaryTotal').textContent = Utils.formatCurrency(customer.totalPrice || 0);
        document.getElementById('summaryAdvance').textContent = Utils.formatCurrency(customer.advancePaid || 0);
        document.getElementById('summaryInstallment').textContent = Utils.formatCurrency(customer.monthlyInstallment || 0);
        document.getElementById('summaryStartDate').textContent = Utils.formatDate(customer.startDate);
        
        // Guarantor info
        document.getElementById('guarantorNameDetail').textContent = customer.guarantorName || 'N/A';
        document.getElementById('guarantorPhoneDetail').textContent = customer.guarantorPhone || 'N/A';
        document.getElementById('guarantorCnicDetail').textContent = customer.guarantorCnic || 'N/A';
        document.getElementById('guarantorAddressDetail').textContent = customer.guarantorAddress || 'N/A';
        
        // Balance and status
        const remainingBalance = customer.remainingBalance || 
                               Utils.calculateRemainingBalance(customer.totalPrice, customer.advancePaid);
        document.getElementById('remainingBalanceDisplay').textContent = Utils.formatCurrency(remainingBalance);
        
        const statusBadge = document.getElementById('statusBadge');
        if (remainingBalance === 0) {
            statusBadge.textContent = 'COMPLETED';
            statusBadge.className = 'status-badge completed';
        } else {
            statusBadge.textContent = 'PENDING';
            statusBadge.className = 'status-badge pending';
        }
        
        // Photo
        const photoElement = document.getElementById('detailCustomerPhoto');
        if (customer.photo) {
            photoElement.src = customer.photo;
        }
        
        // Invoice info
        document.getElementById('invoiceDate').textContent = Utils.formatDate(new Date());
        document.getElementById('invoiceNumber').textContent = `INV-${customer.trackingId || customer.id.slice(-6).toUpperCase()}`;
    }

    static async loadPaymentHistory(customerId) {
        const payments = await Database.getPayments(customerId);
        const tableBody = document.getElementById('paymentHistoryBody');
        let totalPaid = 0;
        
        tableBody.innerHTML = '';
        
        payments.forEach(payment => {
            totalPaid += payment.amount;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${Utils.formatDate(payment.date)}</td>
                <td>${Utils.formatCurrency(payment.amount)}</td>
                <td>${payment.method || 'Cash'}</td>
                <td>${payment.notes || '-'}</td>
                <td>-</td>
            `;
            tableBody.appendChild(row);
        });
        
        document.getElementById('totalPaidAmount').innerHTML = `<strong>${Utils.formatCurrency(totalPaid)}</strong>`;
        
        // If no payments, show message
        if (payments.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="5" class="text-center">No payments recorded yet</td>
            `;
            tableBody.appendChild(row);
        }
    }

    static setupDetailButtons(customer) {
        const printBtn = document.getElementById('printBtn');
        const whatsappBtn = document.getElementById('whatsappBtn');
        
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
        
        if (whatsappBtn) {
            whatsappBtn.addEventListener('click', () => {
                const remainingBalance = customer.remainingBalance || 
                                       Utils.calculateRemainingBalance(customer.totalPrice, customer.advancePaid);
                
                const message = `*Customer Ledger - Naeem Khan Traders*
                
*Customer:* ${customer.customerName}
*Tracking ID:* ${customer.trackingId}
*Remaining Balance:* ${Utils.formatCurrency(remainingBalance)}
*Status:* ${remainingBalance === 0 ? 'COMPLETED' : 'PENDING'}

*Product:* ${customer.productName}
*Total Price:* ${Utils.formatCurrency(customer.totalPrice)}
*Advance Paid:* ${Utils.formatCurrency(customer.advancePaid)}
*Monthly Installment:* ${Utils.formatCurrency(customer.monthlyInstallment)}

Please make payments on time.`;
                
                const encodedMessage = encodeURIComponent(message);
                const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
                window.open(whatsappUrl, '_blank');
            });
        }
    }

    static async initCustomerList() {
        // This would be similar to dashboard table but with all customers
        // For simplicity, redirect to dashboard for now
        window.location.href = 'dashboard.html';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    PageManager.init();
});
