// ============================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ============================================

// 🔥 Firebase Configuration - YAHAN APNA CONFIG PASTE KARNA HAI
const firebaseConfig = {
  apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
  authDomain: "naeemjan-c7f46.firebaseapp.com",
  projectId: "naeemjan-c7f46",
  storageBucket: "naeemjan-c7f46.firebasestorage.app",
  messagingSenderId: "319489849314",
  appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Firebase Services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ============================================
// GLOBAL VARIABLES & STATE
// ============================================

let currentUser = null;
let allCustomers = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// Check authentication state on page load
function checkAuthState() {
    const currentPage = window.location.pathname.split('/').pop();
    
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        
        if (!user) {
            // Not logged in
            if (currentPage !== 'index.html') {
                window.location.href = 'index.html';
            }
        } else {
            // Logged in
            if (currentPage === 'index.html') {
                window.location.href = 'dashboard.html';
            }
            
            // Update admin email in navbar if element exists
            const adminEmailElement = document.getElementById('adminEmail');
            if (adminEmailElement) {
                adminEmailElement.textContent = user.email;
            }
        }
    });
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        showMessage('error', `Logout failed: ${error.message}`);
    });
}

// ============================================
// CUSTOMER ID GENERATOR
// ============================================

async function generateCustomerID(prefix = 'C') {
    try {
        const snapshot = await db.collection('customers')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return `${prefix}001`;
        }
        
        const lastCustomer = snapshot.docs[0].data();
        const lastID = lastCustomer.customerID || `${prefix}000`;
        const lastNumber = parseInt(lastID.substring(1)) || 0;
        const newNumber = lastNumber + 1;
        
        return `${prefix}${newNumber.toString().padStart(3, '0')}`;
        
    } catch (error) {
        console.error('Error generating ID:', error);
        // Fallback: generate based on timestamp
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 100);
        return `${prefix}${timestamp.toString().slice(-3)}${randomNum.toString().padStart(2, '0')}`;
    }
}

// ============================================
// FILE UPLOAD FUNCTIONS
// ============================================

// Upload photo to Firebase Storage
async function uploadPhoto(file, folder = 'customer_photos') {
    return new Promise(async (resolve, reject) => {
        try {
            // Validate file
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Please select a valid image file'));
                return;
            }
            
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                reject(new Error('File size must be less than 2MB'));
                return;
            }
            
            // Generate unique filename
            const timestamp = Date.now();
            const fileExtension = file.name.split('.').pop();
            const fileName = `${folder}/${timestamp}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
            
            // Create storage reference
            const storageRef = storage.ref(fileName);
            
            // Upload file
            const uploadTask = storageRef.put(file);
            
            // Monitor upload progress
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress tracking can be added here
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload is ${progress}% done`);
                },
                (error) => {
                    reject(new Error(`Upload failed: ${error.message}`));
                },
                async () => {
                    // Upload completed successfully
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(downloadURL);
                    } catch (error) {
                        reject(new Error(`Failed to get download URL: ${error.message}`));
                    }
                }
            );
            
        } catch (error) {
            reject(error);
        }
    });
}

// Preview image before upload
function previewImage(input, previewElementId) {
    const previewElement = document.getElementById(previewElementId);
    const file = input.files[0];
    
    if (!file) return;
    
    // Clear previous preview
    previewElement.innerHTML = '';
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showMessage('error', 'Please select an image file (JPG, PNG, etc.)');
        input.value = '';
        return;
    }
    
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
        showMessage('error', 'File size must be less than 2MB');
        input.value = '';
        return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.createElement('div');
        preview.className = 'preview-image';
        preview.innerHTML = `
            <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
            <button type="button" class="remove-preview" onclick="removePreview('${input.id}', '${previewElementId}')">
                &times;
            </button>
        `;
        previewElement.appendChild(preview);
    };
    reader.readAsDataURL(file);
}

// Remove image preview
function removePreview(inputId, previewElementId) {
    const input = document.getElementById(inputId);
    const previewElement = document.getElementById(previewElementId);
    
    if (input) input.value = '';
    if (previewElement) previewElement.innerHTML = '';
}

// ============================================
// CUSTOMER MANAGEMENT FUNCTIONS
// ============================================

// Load all customers
async function loadAllCustomers() {
    try {
        showLoading('customersTableBody', 'Loading customers...');
        
        const snapshot = await db.collection('customers')
            .orderBy('createdAt', 'desc')
            .get();
        
        allCustomers = [];
        snapshot.forEach(doc => {
            allCustomers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return allCustomers;
        
    } catch (error) {
        console.error('Error loading customers:', error);
        showMessage('error', `Failed to load customers: ${error.message}`);
        return [];
    }
}

// Search customers with filters
function searchCustomers(filters = {}) {
    if (!allCustomers.length) return [];
    
    return allCustomers.filter(customer => {
        // Search by ID
        if (filters.id && !customer.customerID?.toLowerCase().includes(filters.id.toLowerCase())) {
            return false;
        }
        
        // Search by name
        if (filters.name && !customer.name?.toLowerCase().includes(filters.name.toLowerCase())) {
            return false;
        }
        
        // Search by phone
        if (filters.phone && !customer.phone?.includes(filters.phone)) {
            return false;
        }
        
        // Search by product
        if (filters.product && !customer.productName?.toLowerCase().includes(filters.product.toLowerCase())) {
            return false;
        }
        
        // Filter by status
        if (filters.status && customer.status !== filters.status) {
            return false;
        }
        
        // Filter by date range
        if (filters.dateFrom && customer.createdAt) {
            const customerDate = new Date(customer.createdAt).setHours(0, 0, 0, 0);
            const fromDate = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
            if (customerDate < fromDate) return false;
        }
        
        if (filters.dateTo && customer.createdAt) {
            const customerDate = new Date(customer.createdAt).setHours(0, 0, 0, 0);
            const toDate = new Date(filters.dateTo).setHours(0, 0, 0, 0);
            if (customerDate > toDate) return false;
        }
        
        return true;
    });
}

// Get customer by ID
async function getCustomerById(customerId) {
    try {
        const doc = await db.collection('customers').doc(customerId).get();
        
        if (doc.exists) {
            return {
                id: doc.id,
                ...doc.data()
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('Error getting customer:', error);
        showMessage('error', `Failed to load customer: ${error.message}`);
        return null;
    }
}

// Save customer to Firestore
async function saveCustomer(customerData) {
    try {
        // Generate customer ID if not provided
        if (!customerData.customerID) {
            const prefix = customerData.productCategory === 'electronics' ? 'E' : 
                          customerData.productCategory === 'vehicle' ? 'V' : 'C';
            customerData.customerID = await generateCustomerID(prefix);
        }
        
        // Add timestamps
        customerData.createdAt = customerData.createdAt || new Date().toISOString();
        customerData.updatedAt = new Date().toISOString();
        customerData.createdBy = currentUser?.email || 'Unknown';
        
        // Calculate remaining amount
        const total = parseFloat(customerData.totalAmount) || 0;
        const paid = parseFloat(customerData.paidAmount) || 0;
        customerData.remainingAmount = total - paid;
        
        // Set default status if not provided
        if (!customerData.status) {
            customerData.status = customerData.remainingAmount > 0 ? 'Active' : 'Completed';
        }
        
        // Save to Firestore
        const docRef = await db.collection('customers').add(customerData);
        
        return {
            success: true,
            customerId: docRef.id,
            customerData: customerData
        };
        
    } catch (error) {
        console.error('Error saving customer:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Update customer
async function updateCustomer(customerId, updateData) {
    try {
        updateData.updatedAt = new Date().toISOString();
        
        await db.collection('customers').doc(customerId).update(updateData);
        
        return {
            success: true,
            message: 'Customer updated successfully'
        };
        
    } catch (error) {
        console.error('Error updating customer:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Delete customer
async function deleteCustomer(customerId) {
    try {
        await db.collection('customers').doc(customerId).delete();
        
        return {
            success: true,
            message: 'Customer deleted successfully'
        };
        
    } catch (error) {
        console.error('Error deleting customer:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================
// PAYMENT & INSTALLMENT FUNCTIONS
// ============================================

// Calculate payment summary
function calculatePaymentSummary(totalAmount, downPayment, installmentCount) {
    totalAmount = parseFloat(totalAmount) || 0;
    downPayment = parseFloat(downPayment) || 0;
    installmentCount = parseInt(installmentCount) || 0;
    
    const remainingAmount = totalAmount - downPayment;
    const monthlyInstallment = installmentCount > 0 ? remainingAmount / installmentCount : 0;
    
    return {
        totalAmount: totalAmount,
        downPayment: downPayment,
        remainingAmount: remainingAmount,
        monthlyInstallment: monthlyInstallment,
        installmentCount: installmentCount
    };
}

// Check if payment is overdue
function isPaymentOverdue(dueDate) {
    if (!dueDate) return false;
    
    const today = new Date();
    const due = new Date(dueDate);
    
    // Set both dates to midnight for accurate comparison
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    return due < today;
}

// Calculate days overdue
function calculateDaysOverdue(dueDate) {
    if (!dueDate) return 0;
    
    const today = new Date();
    const due = new Date(dueDate);
    
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
}

// Add payment to customer
async function addPayment(customerId, paymentData) {
    try {
        // Get current customer
        const customerDoc = await db.collection('customers').doc(customerId).get();
        if (!customerDoc.exists) {
            throw new Error('Customer not found');
        }
        
        const customer = customerDoc.data();
        const currentPaid = parseFloat(customer.paidAmount) || 0;
        const paymentAmount = parseFloat(paymentData.amount) || 0;
        
        // Update paid amount
        const newPaidAmount = currentPaid + paymentAmount;
        const remainingAmount = parseFloat(customer.totalAmount) - newPaidAmount;
        
        // Update customer record
        await db.collection('customers').doc(customerId).update({
            paidAmount: newPaidAmount,
            remainingAmount: remainingAmount,
            lastPaymentDate: new Date().toISOString(),
            lastPaymentAmount: paymentAmount,
            updatedAt: new Date().toISOString()
        });
        
        // Create payment record
        const paymentRecord = {
            customerId: customerId,
            customerName: customer.name,
            amount: paymentAmount,
            paymentMethod: paymentData.method || 'Cash',
            paymentDate: new Date().toISOString(),
            receivedBy: currentUser?.email || 'Unknown',
            notes: paymentData.notes || '',
            createdAt: new Date().toISOString()
        };
        
        await db.collection('payments').add(paymentRecord);
        
        return {
            success: true,
            newPaidAmount: newPaidAmount,
            remainingAmount: remainingAmount
        };
        
    } catch (error) {
        console.error('Error adding payment:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================
// DASHBOARD STATISTICS
// ============================================

// Get dashboard statistics
async function getDashboardStats() {
    try {
        const snapshot = await db.collection('customers').get();
        
        let totalCustomers = 0;
        let totalRevenue = 0;
        let totalPaid = 0;
        let activeCustomers = 0;
        let overdueCustomers = 0;
        let recentCustomers = [];
        
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        snapshot.forEach(doc => {
            const customer = doc.data();
            totalCustomers++;
            
            const total = parseFloat(customer.totalAmount) || 0;
            const paid = parseFloat(customer.paidAmount) || 0;
            
            totalRevenue += total;
            totalPaid += paid;
            
            // Check if active
            if (customer.status !== 'Completed' && (total - paid) > 0) {
                activeCustomers++;
            }
            
            // Check if overdue
            if (customer.dueDate && isPaymentOverdue(customer.dueDate)) {
                overdueCustomers++;
            }
            
            // Get recent customers (last 7 days)
            const createdAt = new Date(customer.createdAt || now);
            if (createdAt >= oneWeekAgo) {
                recentCustomers.push({
                    id: doc.id,
                    ...customer
                });
            }
        });
        
        // Sort recent customers by date
        recentCustomers.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        }).slice(0, 5);
        
        const pendingAmount = totalRevenue - totalPaid;
        const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue * 100) : 0;
        
        return {
            totalCustomers,
            totalRevenue,
            totalPaid,
            pendingAmount,
            activeCustomers,
            overdueCustomers,
            collectionRate,
            recentCustomers: recentCustomers.slice(0, 5)
        };
        
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        return {
            totalCustomers: 0,
            totalRevenue: 0,
            totalPaid: 0,
            pendingAmount: 0,
            activeCustomers: 0,
            overdueCustomers: 0,
            collectionRate: 0,
            recentCustomers: []
        };
    }
}

// ============================================
// REPORT GENERATION
// ============================================

// Generate financial report
async function generateFinancialReport(startDate, endDate) {
    try {
        let query = db.collection('customers');
        
        // Add date filters if provided
        if (startDate) {
            query = query.where('createdAt', '>=', startDate);
        }
        if (endDate) {
            query = query.where('createdAt', '<=', endDate);
        }
        
        const snapshot = await query.get();
        
        const report = {
            summary: {
                totalCustomers: 0,
                totalRevenue: 0,
                totalPaid: 0,
                totalPending: 0,
                activeAccounts: 0,
                completedAccounts: 0,
                overdueAccounts: 0
            },
            customers: [],
            monthlyData: {}
        };
        
        snapshot.forEach(doc => {
            const customer = doc.data();
            report.customers.push({
                id: doc.id,
                ...customer
            });
            
            // Update summary
            report.summary.totalCustomers++;
            
            const total = parseFloat(customer.totalAmount) || 0;
            const paid = parseFloat(customer.paidAmount) || 0;
            const pending = total - paid;
            
            report.summary.totalRevenue += total;
            report.summary.totalPaid += paid;
            report.summary.totalPending += pending;
            
            // Count status
            if (customer.status === 'Completed') {
                report.summary.completedAccounts++;
            } else if (customer.status === 'Overdue' || isPaymentOverdue(customer.dueDate)) {
                report.summary.overdueAccounts++;
            } else if (pending > 0) {
                report.summary.activeAccounts++;
            }
            
            // Group by month
            if (customer.createdAt) {
                const date = new Date(customer.createdAt);
                const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                
                if (!report.monthlyData[monthYear]) {
                    report.monthlyData[monthYear] = {
                        newCustomers: 0,
                        revenue: 0,
                        collections: 0
                    };
                }
                
                report.monthlyData[monthYear].newCustomers++;
                report.monthlyData[monthYear].revenue += total;
                report.monthlyData[monthYear].collections += paid;
            }
        });
        
        return report;
        
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

// Export to CSV
function exportToCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
        showMessage('warning', 'No data to export');
        return;
    }
    
    try {
        // Get headers from first object
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        data.forEach(item => {
            const row = headers.map(header => {
                let value = item[header];
                
                // Handle special cases
                if (value === null || value === undefined) {
                    value = '';
                } else if (typeof value === 'string') {
                    // Escape quotes and wrap in quotes if contains commas
                    value = value.replace(/"/g, '""');
                    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                        value = `"${value}"`;
                    }
                }
                
                return value;
            }).join(',');
            
            csvContent += row + '\n';
        });
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showMessage('success', `CSV exported successfully: ${filename}`);
        }
        
    } catch (error) {
        console.error('Export error:', error);
        showMessage('error', `Export failed: ${error.message}`);
    }
}

// Export customers to CSV
async function exportCustomersToCSV(filters = {}) {
    try {
        let customers;
        
        if (filters.searchTerm || filters.status || filters.dateFrom || filters.dateTo) {
            customers = searchCustomers(filters);
        } else {
            customers = await loadAllCustomers();
        }
        
        if (customers.length === 0) {
            showMessage('warning', 'No customers found to export');
            return;
        }
        
        // Prepare data for CSV
        const csvData = customers.map(customer => ({
            'Customer ID': customer.customerID || '',
            'Name': customer.name || '',
            'Phone': customer.phone || '',
            'Email': customer.email || '',
            'Product': customer.productName || '',
            'Total Amount': customer.totalAmount || 0,
            'Paid Amount': customer.paidAmount || 0,
            'Remaining Amount': customer.remainingAmount || 0,
            'Down Payment': customer.downPayment || 0,
            'Installment Amount': customer.installmentAmount || 0,
            'Installment Count': customer.installmentCount || 0,
            'Start Date': customer.startDate || '',
            'Due Date': customer.dueDate || '',
            'Status': customer.status || 'Active',
            'Created Date': formatDate(customer.createdAt),
            'Address': customer.address || '',
            'NIC Number': customer.nicNumber || ''
        }));
        
        const date = new Date().toISOString().split('T')[0];
        const filename = `customers_${date}.csv`;
        
        exportToCSV(csvData, filename);
        
    } catch (error) {
        console.error('Export error:', error);
        showMessage('error', `Export failed: ${error.message}`);
    }
}

// Generate PDF for single customer
async function generateCustomerPDF(customerId) {
    try {
        const customer = await getCustomerById(customerId);
        
        if (!customer) {
            showMessage('error', 'Customer not found');
            return;
        }
        
        // Create PDF using jsPDF (if available)
        if (typeof window.jspdf !== 'undefined') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Add content to PDF
            doc.setFontSize(20);
            doc.text('Installment Customer Receipt', 105, 20, { align: 'center' });
            
            doc.setFontSize(12);
            doc.text(`Customer ID: ${customer.customerID || 'N/A'}`, 20, 40);
            doc.text(`Name: ${customer.name || 'N/A'}`, 20, 50);
            doc.text(`Phone: ${customer.phone || 'N/A'}`, 20, 60);
            doc.text(`Product: ${customer.productName || 'N/A'}`, 20, 70);
            doc.text(`Total Amount: ₹${parseFloat(customer.totalAmount || 0).toFixed(2)}`, 20, 80);
            doc.text(`Paid Amount: ₹${parseFloat(customer.paidAmount || 0).toFixed(2)}`, 20, 90);
            doc.text(`Remaining Amount: ₹${parseFloat(customer.remainingAmount || 0).toFixed(2)}`, 20, 100);
            doc.text(`Due Date: ${formatDate(customer.dueDate)}`, 20, 110);
            doc.text(`Status: ${customer.status || 'Active'}`, 20, 120);
            
            // Add footer
            doc.setFontSize(10);
            doc.text('Generated on: ' + new Date().toLocaleString('en-IN'), 105, 280, { align: 'center' });
            
            // Save PDF
            const filename = `Customer_${customer.customerID || customer.name}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(filename);
            
            showMessage('success', `PDF generated: ${filename}`);
            
        } else {
            // Fallback: Create printable HTML page
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Customer Receipt - ${customer.name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .section { margin-bottom: 20px; }
                        .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                        .info-item { margin-bottom: 8px; }
                        .info-label { font-weight: bold; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Installment Customer Receipt</h1>
                        <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
                    </div>
                    
                    <div class="section">
                        <h3>Customer Information</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Customer ID:</span>
                                <span>${customer.customerID || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Name:</span>
                                <span>${customer.name || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Phone:</span>
                                <span>${customer.phone || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Email:</span>
                                <span>${customer.email || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">NIC Number:</span>
                                <span>${customer.nicNumber || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Address:</span>
                                <span>${customer.address || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>Product Information</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Product Name:</span>
                                <span>${customer.productName || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Category:</span>
                                <span>${customer.productCategory || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Model:</span>
                                <span>${customer.productModel || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Serial:</span>
                                <span>${customer.productSerial || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>Payment Information</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Total Amount:</span>
                                <span>₹${parseFloat(customer.totalAmount || 0).toFixed(2)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Down Payment:</span>
                                <span>₹${parseFloat(customer.downPayment || 0).toFixed(2)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Paid Amount:</span>
                                <span>₹${parseFloat(customer.paidAmount || 0).toFixed(2)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Remaining Amount:</span>
                                <span>₹${parseFloat(customer.remainingAmount || 0).toFixed(2)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Monthly Installment:</span>
                                <span>₹${parseFloat(customer.installmentAmount || 0).toFixed(2)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Installment Count:</span>
                                <span>${customer.installmentCount || 0}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Start Date:</span>
                                <span>${formatDate(customer.startDate)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Due Date:</span>
                                <span>${formatDate(customer.dueDate)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>Warranty Information</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Warranty Type:</span>
                                <span>${customer.warrantyType || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Warranty Period:</span>
                                <span>${customer.warrantyPeriod || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Start Date:</span>
                                <span>${formatDate(customer.warrantyStart)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">End Date:</span>
                                <span>${formatDate(customer.warrantyEnd)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section no-print">
                        <button onclick="window.print()">Print Receipt</button>
                        <button onclick="window.close()">Close</button>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
        
    } catch (error) {
        console.error('PDF generation error:', error);
        showMessage('error', `PDF generation failed: ${error.message}`);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format date to readable string
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        
    } catch (error) {
        console.error('Date formatting error:', error);
        return 'Invalid Date';
    }
}

// Format currency
function formatCurrency(amount) {
    amount = parseFloat(amount) || 0;
    return '₹' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// Show loading state
function showLoading(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
}

// Show message
function showMessage(type, message, duration = 5000) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.system-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `system-message message-${type}`;
    messageElement.innerHTML = `
        <div class="message-content">
            <span class="message-icon">${getMessageIcon(type)}</span>
            <span class="message-text">${message}</span>
            <button class="message-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    // Add styles if not already present
    if (!document.querySelector('#message-styles')) {
        const styles = document.createElement('style');
        styles.id = 'message-styles';
        styles.textContent = `
            .system-message {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                min-width: 300px;
                max-width: 500px;
                animation: slideInRight 0.3s ease;
            }
            
            .message-content {
                padding: 15px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .message-success {
                background: #10B981;
                color: white;
            }
            
            .message-error {
                background: #EF4444;
                color: white;
            }
            
            .message-warning {
                background: #F59E0B;
                color: white;
            }
            
            .message-info {
                background: #3B82F6;
                color: white;
            }
            
            .message-icon {
                font-size: 20px;
            }
            
            .message-text {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .message-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }
            
            .message-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add to document
    document.body.appendChild(messageElement);
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (messageElement.parentElement) {
                messageElement.remove();
            }
        }, duration);
    }
}

// Get icon for message type
function getMessageIcon(type) {
    switch(type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '💡';
    }
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone number (Indian format)
function validatePhone(phone) {
    const re = /^[6-9]\d{9}$/;
    return re.test(phone);
}

// Validate NIC/Aadhaar
function validateNIC(nic) {
    // Accepts both old 10-digit and new 12-digit Aadhaar
    const re = /^[0-9]{10,12}$/;
    return re.test(nic);
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Calculate age from date of birth
function calculateAge(dob) {
    if (!dob) return null;
    
    const birthDate = new Date(dob);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize on DOM loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuthState();
    
    // Set current year in footer if exists
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    // Set current date in date inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]:not([value])').forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
    
    // Set next month as default due date
    const dueDateInputs = document.querySelectorAll('input[type="date"][id*="due"]');
    dueDateInputs.forEach(input => {
        if (!input.value) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            input.value = nextMonth.toISOString().split('T')[0];
        }
    });
    
    // Initialize logout buttons
    document.querySelectorAll('.logout-btn, #logoutBtn').forEach(btn => {
        if (btn) {
            btn.addEventListener('click', logout);
        }
    });
    
    // Initialize print buttons
    document.querySelectorAll('.print-btn').forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function() {
                window.print();
            });
        }
    });
    
    // Initialize tooltips
    initializeTooltips();
    
    // Initialize form validations
    initializeFormValidations();
});

// Initialize tooltips
function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[title]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

// Show tooltip
function showTooltip(event) {
    const element = event.target;
    const title = element.getAttribute('title');
    
    if (!title) return;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = title;
    
    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = rect.left + (rect.width / 2) + 'px';
    tooltip.style.top = rect.top - 40 + 'px';
    tooltip.style.transform = 'translateX(-50%)';
    
    // Add styles if not already present
    if (!document.querySelector('#tooltip-styles')) {
        const styles = document.createElement('style');
        styles.id = 'tooltip-styles';
        styles.textContent = `
            .custom-tooltip {
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 10000;
                pointer-events: none;
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add to document
    document.body.appendChild(tooltip);
    
    // Remove title to prevent default tooltip
    element.removeAttribute('title');
    element.dataset.originalTitle = title;
}

// Hide tooltip
function hideTooltip(event) {
    const element = event.target;
    const tooltip = document.querySelector('.custom-tooltip');
    
    if (tooltip) {
        tooltip.remove();
    }
    
    // Restore title
    if (element.dataset.originalTitle) {
        element.setAttribute('title', element.dataset.originalTitle);
        delete element.dataset.originalTitle;
    }
}

// Initialize form validations
function initializeFormValidations() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!validateForm(this)) {
                event.preventDefault();
                event.stopPropagation();
            }
        });
    });
    
    // Add real-time validation
    const inputs = document.querySelectorAll('input[required], select[required], textarea[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
    });
}

// Validate form
function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    
    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Validate field
function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.getAttribute('name') || field.id;
    
    // Clear previous errors
    field.classList.remove('invalid');
    const errorElement = document.getElementById(`${field.id}-error`);
    if (errorElement) {
        errorElement.remove();
    }
    
    // Check if required field is empty
    if (field.hasAttribute('required') && !value) {
        showFieldError(field, `${getFieldLabel(field)} is required`);
        return false;
    }
    
    // Special validations based on field type
    if (field.type === 'email' && value && !validateEmail(value)) {
        showFieldError(field, 'Please enter a valid email address');
        return false;
    }
    
    if (field.type === 'tel' && value && !validatePhone(value)) {
        showFieldError(field, 'Please enter a valid 10-digit phone number');
        return false;
    }
    
    if ((field.id.includes('nic') || field.name.includes('nic')) && value && !validateNIC(value)) {
        showFieldError(field, 'Please enter a valid NIC/Aadhaar number (10-12 digits)');
        return false;
    }
    
    if (field.type === 'number' && field.hasAttribute('min')) {
        const min = parseFloat(field.getAttribute('min'));
        if (value && parseFloat(value) < min) {
            showFieldError(field, `Value must be at least ${min}`);
            return false;
        }
    }
    
    if (field.type === 'number' && field.hasAttribute('max')) {
        const max = parseFloat(field.getAttribute('max'));
        if (value && parseFloat(value) > max) {
            showFieldError(field, `Value must not exceed ${max}`);
            return false;
        }
    }
    
    // All validations passed
    field.classList.add('valid');
    return true;
}

// Show field error
function showFieldError(field, message) {
    field.classList.add('invalid');
    field.classList.remove('valid');
    
    const errorElement = document.createElement('div');
    errorElement.id = `${field.id}-error`;
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.color = '#EF4444';
    errorElement.style.fontSize = '12px';
    errorElement.style.marginTop = '4px';
    
    field.parentNode.appendChild(errorElement);
}

// Get field label
function getFieldLabel(field) {
    const label = field.parentNode.querySelector('label');
    if (label) {
        return label.textContent.replace('*', '').trim();
    }
    
    // Try to get from placeholder
    if (field.placeholder) {
        return field.placeholder;
    }
    
    // Try to get from name/id
    return field.name || field.id;
}

// ============================================
// GLOBAL EXPORTS (for browser console debugging)
// ============================================

// Make functions available globally for debugging
window.firebaseApp = firebase.app();
window.auth = auth;
window.db = db;
window.storage = storage;
window.getCustomerById = getCustomerById;
window.loadAllCustomers = loadAllCustomers;
window.generateCustomerID = generateCustomerID;
window.saveCustomer = saveCustomer;
window.exportCustomersToCSV = exportCustomersToCSV;
window.generateCustomerPDF = generateCustomerPDF;
window.showMessage = showMessage;
window.logout = logout;

console.log('Installment Management System loaded successfully!');
console.log('Available global functions:');
console.log('- getCustomerById(customerId)');
console.log('- loadAllCustomers()');
console.log('- generateCustomerID(prefix)');
console.log('- saveCustomer(customerData)');
console.log('- exportCustomersToCSV(filters)');
console.log('- generateCustomerPDF(customerId)');
console.log('- showMessage(type, message)');
console.log('- logout()');
