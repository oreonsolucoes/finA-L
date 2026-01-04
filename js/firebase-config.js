// Importa os módulos necessários do Firebase v12
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

// Configuração do seu app Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC8hKLZ_pKHJ7DlS6OqvDvqzPk9FN3-8OM",
    authDomain: "financas-ael.firebaseapp.com",
    projectId: "financas-ael",
    storageBucket: "financas-ael.firebasestorage.app",
    messagingSenderId: "928624497972",
    appId: "1:928624497972:web:7204275e84d1ac40e84161",
    measurementId: "G-W4C2M8WL47"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exporta módulos para uso em outros scripts
export const auth = getAuth(app);
export const db = getFirestore(app);
export { analytics };


// Inicializa o Realtime Database
export const dbRT = getDatabase(app);
