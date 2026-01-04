let xp = parseInt(localStorage.getItem('xp')) || 0;
let level = parseInt(localStorage.getItem('level')) || 1;

export function addXP(v) {
    xp += v;

    // Dispara a celebração visual
    celebrarXP();

    if (xp >= 100) {
        level++;
        xp = 0;
        celebrarLevelUp(); // Celebração especial para novo nível
        alert(`🎉 Parabéns! Vocês subiram para o nível ${level}!`);
    }

    localStorage.setItem('xp', xp);
    localStorage.setItem('level', level);
    updateXPBar();
}

function celebrarXP() {
    const emojis = ['⭐', '✨', '💰', '🎯', '🚀', '💎'];
    const bar = document.getElementById('xpBar');
    if (!bar) return;

    const rect = bar.getBoundingClientRect();

    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'xp-particle';
        particle.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];

        // Posiciona no centro da barra de XP
        particle.style.left = `${rect.left + rect.width / 2}px`;
        particle.style.top = `${rect.top}px`;

        // Define direções aleatórias para a animação CSS
        const destX = (Math.random() - 0.5) * 200;
        const destY = -Math.random() * 150 - 50;

        particle.style.setProperty('--x', `${destX}px`);
        particle.style.setProperty('--y', `${destY}px`);

        document.body.appendChild(particle);

        // Remove do DOM após a animação
        setTimeout(() => particle.remove(), 1500);
    }
}

function celebrarLevelUp() {
    // Uma explosão maior de emojis para quando subirem de nível
    for (let i = 0; i < 5; i++) {
        setTimeout(celebrarXP, i * 300);
    }
}

export function updateXPBar() {
    const xpEl = document.getElementById('xp');
    const lvlEl = document.getElementById('level');
    const progEl = document.getElementById('xpProgress');

    if (xpEl) xpEl.innerText = xp;
    if (lvlEl) lvlEl.innerText = level;
    if (progEl) progEl.style.width = `${xp}%`;
}