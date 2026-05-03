const socket = io();

const canvas = document.getElementById('checkbox-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const authStatus = document.getElementById('auth-status');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const checkedCountEl = document.getElementById('checked-count');
const toastEl = document.getElementById('toast');
const scrollContainer = document.getElementById('scroll-container');

const COLS = 1000;
const ROWS = 1000;
const CELL_SIZE = 20;
const TOTAL = COLS * ROWS;

const byteCount = Math.ceil(TOTAL / 8);
const stateBuffer = new Uint8Array(byteCount);

let isAuthenticated = false;
let globalCheckedCount = 0;

function resizeCanvas() {
    canvas.width = scrollContainer.clientWidth;
    canvas.height = scrollContainer.clientHeight;
    drawVisible();
}
window.addEventListener('resize', resizeCanvas);

async function checkAuth() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        isAuthenticated = data.authenticated;

        if (isAuthenticated) {
            authStatus.textContent = `Welcome, ${data.user.name}`;
            authStatus.classList.add('authenticated');
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
        } else {
            authStatus.textContent = 'Spectator Mode (Read-Only)';
            authStatus.classList.remove('authenticated');
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
        }
    } catch (err) {
        authStatus.textContent = 'Spectator Mode';
        loginBtn.classList.remove('hidden');
    }
}
checkAuth();

loginBtn.addEventListener('click', () => {
    const width = 500;
    const height = 700;
    const left = (window.innerWidth / 2) - (width / 2);
    const top = (window.innerHeight / 2) - (height / 2);
    const popup = window.open('/auth/login', 'KonohaLogin', `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`);
    
    // Fallback: Poll popup to see if it closed, then check auth
    const pollTimer = setInterval(async () => {
        try {
            if (!popup || popup.closed) {
                clearInterval(pollTimer);
                // Verify auth and auto-refresh
                const res = await fetch('/auth/me');
                const data = await res.json();
                if (data.authenticated && !isAuthenticated) {
                    showToast('Login Successful! Chakra restored. Reconnecting...');
                    setTimeout(() => window.location.reload(), 1500);
                }
            }
        } catch (e) {
            // Cross-origin errors are expected during OAuth redirects
        }
    }, 500);
});

// Listen for message from popup
window.addEventListener('message', (event) => {
    if (event.data === 'konoha_login_success') {
        showToast('Login Successful! Chakra restored. Reconnecting...');
        checkAuth();
        // Reload page to re-establish WebSocket connection with the new session cookie
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }
});

function getBit(index) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    return (stateBuffer[byteIndex] & (1 << bitIndex)) !== 0;
}

function setBit(index, value) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    
    const wasChecked = (stateBuffer[byteIndex] & (1 << bitIndex)) !== 0;
    if (value && !wasChecked) globalCheckedCount++;
    else if (!value && wasChecked) globalCheckedCount--;

    if (value) {
        stateBuffer[byteIndex] |= (1 << bitIndex);
    } else {
        stateBuffer[byteIndex] &= ~(1 << bitIndex);
    }
    updateCountUI();
}

function updateCountUI() {
    checkedCountEl.textContent = globalCheckedCount.toLocaleString();
}

function countAllChecked() {
    globalCheckedCount = 0;
    for (let i = 0; i < TOTAL; i++) {
        if (getBit(i)) globalCheckedCount++;
    }
    updateCountUI();
}

// ─────────────────────────────────────────────
// Virtual Rendering Logic
// ─────────────────────────────────────────────

// Draw an X/Shuriken shape instead of a solid box
function drawShuriken(x, y, size) {
    ctx.strokeStyle = '#FF6B00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + size - 4, y + size - 4);
    
    ctx.moveTo(x + size - 4, y + 4);
    ctx.lineTo(x + 4, y + size - 4);
    
    ctx.stroke();
    
    ctx.fillStyle = '#DF0000';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, 2, 0, Math.PI * 2);
    ctx.fill();
}

const AKATSUKI_QUOTES = [
    "Art is an explosion! 💥",
    "Feel pain, contemplate pain, accept pain. 🩸",
    "People's lives don't end when they die. It ends when they lose faith. 🦇",
    "Even the strongest of opponents always has a weakness. 👁️",
    "Money is the only thing you can trust. 💰",
    "True art is fleeting... 💣",
    "Those who do not understand true pain can never understand true peace. 🌧️"
];

function drawVisible() {
    // Clear canvas instead of solid fill to let the Akatsuki background show through
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scrollLeft = scrollContainer.scrollLeft;
    const scrollTop = scrollContainer.scrollTop;

    // Calculate which rows and cols are currently visible
    const startCol = Math.floor(scrollLeft / CELL_SIZE);
    const endCol = Math.min(COLS - 1, Math.ceil((scrollLeft + canvas.width) / CELL_SIZE));
    
    const startRow = Math.floor(scrollTop / CELL_SIZE);
    const endRow = Math.min(ROWS - 1, Math.ceil((scrollTop + canvas.height) / CELL_SIZE));

    // Render only visible cells
    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const index = row * COLS + col;
            const isChecked = getBit(index);

            const x = (col * CELL_SIZE) - scrollLeft;
            const y = (row * CELL_SIZE) - scrollTop;

            if (isChecked) {
                ctx.fillStyle = 'rgba(255, 107, 0, 0.15)';
                ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                drawShuriken(x, y, CELL_SIZE);
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            }
        }
    }
}

let ticking = false;
scrollContainer.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            drawVisible();
            ticking = false;
        });
        ticking = true;
    }
});

scrollContainer.addEventListener('click', (e) => {
    if (!isAuthenticated) {
        showToast("You lack the Chakra to do this! Login first.");
        return;
    }

    const rect = scrollContainer.getBoundingClientRect();
    
    const absoluteX = e.clientX - rect.left + scrollContainer.scrollLeft;
    const absoluteY = e.clientY - rect.top + scrollContainer.scrollTop;

    const col = Math.floor(absoluteX / CELL_SIZE);
    const row = Math.floor(absoluteY / CELL_SIZE);
    
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        const index = row * COLS + col;
        const newState = !getBit(index);

        setBit(index, newState);
        drawVisible();
        
        socket.emit('client:toggle', { index, checked: newState });

        if (newState && Math.random() > 0.6) {
            const quote = AKATSUKI_QUOTES[Math.floor(Math.random() * AKATSUKI_QUOTES.length)];
            showToast(quote);
        }
    }
});

socket.on('server:state', (base64String) => {
    if (base64String) { 
        const binaryString = atob(base64String);
        for (let i = 0; i < binaryString.length; i++) {
            stateBuffer[i] = binaryString.charCodeAt(i);
        }
        countAllChecked();
    }
    resizeCanvas();
});

socket.on('server:toggle', (data) => {
    const { index, checked } = data;
    setBit(index, checked);
    drawVisible();
});

socket.on('server:error', (msg) => {
    showToast(msg);
});

let toastTimeout;
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3000);
}
