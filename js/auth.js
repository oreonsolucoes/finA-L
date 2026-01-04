import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const popup = document.getElementById('errorPopup');
const errorMsg = document.getElementById('errorMessage');

// Função para mostrar o pop-up
function mostrarErro(mensagem) {
    errorMsg.innerText = mensagem;
    popup.className = "popup-error show";
    setTimeout(() => { popup.className = popup.className.replace("show", ""); }, 3000);
}

loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passInput.value.trim();

    // 1. Validação de Campos Vazios
    if (!email || !password) {
        mostrarErro("⚠️ Preencha e-mail e senha!");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error(error.code);

        // 2. Tratamento de erros do Firebase
        switch (error.code) {
            case 'auth/invalid-email':
                mostrarErro("📧 E-mail com formato inválido!");
                break;
            case 'auth/user-not-found':
            case 'auth/invalid-credential': // Novo erro padrão do Firebase para segurança
                mostrarErro("❌ E-mail ou senha incorretos!");
                break;
            case 'auth/wrong-password':
                mostrarErro("🔑 Senha incorreta!");
                break;
            case 'auth/too-many-requests':
                mostrarErro("🚫 Muitas tentativas falhas. Tente mais tarde!");
                break;
            default:
                mostrarErro("🚨 Erro ao entrar. Tente novamente!");
        }
    }
});
