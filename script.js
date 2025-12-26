// Firebase Configuration (YAHAN APNA CONFIG PASTE KAREIN)
const firebaseConfig = {
  apiKey: "AIzaSyBUSuozhIlEVuxf8zJAd4NAetRTt99fp_w",
  authDomain: "naeemjan-c7f46.firebaseapp.com",
  projectId: "naeemjan-c7f46",
  storageBucket: "naeemjan-c7f46.firebasestorage.app",
  messagingSenderId: "319489849314",
  appId: "1:319489849314:web:9dd18550ea3e0c0571abbb"
};

// Firebase Initialize
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Firebase Services
const auth = firebase.auth();
const db = firebase.firestore();

// Common Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// Check Authentication on Page Load (except login page)
if (!window.location.pathname.includes('index.html')) {
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });
}
