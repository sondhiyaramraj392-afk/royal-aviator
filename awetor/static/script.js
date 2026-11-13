function switchAuth(type) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabReg = document.getElementById('tabReg');
    const authTitle = document.getElementById('authTitle');

    if (!loginForm || !registerForm) return;

    if (type === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        if (tabLogin) tabLogin.classList.add('active');
        if (tabReg) tabReg.classList.remove('active');
        if (authTitle) authTitle.innerText = 'Welcome back';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        if (tabReg) tabReg.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (authTitle) authTitle.innerText = 'Create account';
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById('view-' + tab);
    const targetNav = document.getElementById('nav-' + tab);

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');
    if (tab === 'game' && typeof resizeCanvas === 'function') resizeCanvas();
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'flex';
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
}

let userBalance = 0;
let bets = {
    1: { active: false, cashedOut: false, amount: 0 },
    2: { active: false, cashedOut: false, amount: 0 }
};

function updateBalanceUI(newBal) {
    userBalance = newBal;
    const gBal = document.getElementById('globalBalance');
    const wBal = document.getElementById('walletBalance');
    if (gBal) gBal.innerText = userBalance.toFixed(2);
    if (wBal) wBal.innerText = userBalance.toFixed(2);
}

function adjustBet(panel, delta) {
    const inp = document.getElementById('betInput' + panel);
    if (!inp) return;
    let val = Math.max(10, (parseFloat(inp.value) || 10) + delta);
    inp.value = val;
    const btnAmt = document.getElementById('btnAmt' + panel);
    if (btnAmt) btnAmt.innerText = val.toFixed(2) + ' INR';
}

function setBet(panel, val) {
    const inp = document.getElementById('betInput' + panel);
    if (!inp) return;
    inp.value = val;
    const btnAmt = document.getElementById('btnAmt' + panel);
    if (btnAmt) btnAmt.innerText = val.toFixed(2) + ' INR';
}

function handleBetClick(panel) {
    const b = bets[panel];
    const inpVal = parseFloat(document.getElementById('betInput' + panel).value);

    if (state === 'WAITING' && !b.active) {
        if (isNaN(inpVal) || inpVal < 10 || inpVal > userBalance) {
            alert('Insufficient balance ya minimum ₹10 bet lagayein!');
            return;
        }
        fetch('/place_bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: inpVal })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                updateBalanceUI(data.new_balance);
                b.active = true;
                b.amount = inpVal;
                refreshBetButtons();
            } else alert(data.msg);
        });
    } else if (state === 'FLYING' && b.active && !b.cashedOut) {
        const winAmt = b.amount * multiplier;
        fetch('/cashout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ win_amount: winAmt })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                updateBalanceUI(data.new_balance);
                b.cashedOut = true;
                refreshBetButtons();
            }
        });
    }
}

let state = 'WAITING';
let multiplier = 1.00;
let crashPoint = 1.00;
let startTime = 0;
let canvas, ctx, multEl, flewEl, waitEl;

function resizeCanvas() {
    if (canvas && canvas.parentElement.clientWidth > 0) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
}

function getCrashPoint() {
    const r = Math.random();
    if (r < 0.12) return 1.00;
    return Math.min(Math.max(1.02, 0.94 / (1 - r)), 12.00);
}

function refreshBetButtons() {
    [1, 2].forEach(p => {
        const btn = document.getElementById('betBtn' + p);
        if (!btn) return;
        const b = bets[p];
        const inpVal = parseFloat(document.getElementById('betInput' + p).value) || 10;

        if (state === 'WAITING') {
            if (b.active) {
                btn.className = 'big-bet-btn red';
                btn.innerHTML = `BET PLACED<br><span>${b.amount.toFixed(2)} INR</span>`;
            } else {
                btn.className = 'big-bet-btn green';
                btn.innerHTML = `Bet<br><span>${inpVal.toFixed(2)} INR</span>`;
            }
        } else if (state === 'FLYING') {
            if (b.active && !b.cashedOut) {
                btn.className = 'big-bet-btn orange';
                btn.innerHTML = `CASH OUT<br><span>${(b.amount * multiplier).toFixed(2)} INR</span>`;
            } else if (b.cashedOut) {
                btn.className = 'big-bet-btn disabled';
                btn.innerHTML = `WON ✅<br><span>Cashed Out</span>`;
            } else {
                btn.className = 'big-bet-btn disabled';
                btn.innerHTML = `WAITING<br><span>Next Round</span>`;
            }
        } else {
            btn.className = 'big-bet-btn disabled';
            btn.innerHTML = `FLEW AWAY<br><span>Wait...</span>`;
        }
    });
}

function runWaiting() {
    state = 'WAITING';
    bets[1] = { active: false, cashedOut: false, amount: 0 };
    bets[2] = { active: false, cashedOut: false, amount: 0 };
    multiplier = 1.00;
    if (flewEl) flewEl.style.display = 'none';
    if (multEl) { multEl.style.color = '#ffffff'; multEl.innerText = '1.00x'; }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    refreshBetButtons();

    let sec = 5;
    if (waitEl) { waitEl.style.display = 'block'; waitEl.innerText = `NEXT ROUND IN ${sec}s`; }
    const iv = setInterval(() => {
        sec--;
        if (sec > 0) {
            if (waitEl) waitEl.innerText = `NEXT ROUND IN ${sec}s`;
        } else {
            clearInterval(iv);
            runFlying();
        }
    }, 1000);
}

function runFlying() {
    state = 'FLYING';
    if (waitEl) waitEl.style.display = 'none';
    crashPoint = getCrashPoint();
    startTime = performance.now();
    refreshBetButtons();

    function frame(now) {
        const elapsed = (now - startTime) / 1000;
        multiplier = Math.pow(Math.E, 0.11 * elapsed);

        if (multiplier >= crashPoint) {
            multiplier = crashPoint;
            runCrash();
            return;
        }
        if (multEl) multEl.innerText = multiplier.toFixed(2) + 'x';
        refreshBetButtons();
        drawGraph(elapsed);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function drawGraph(elapsed) {
    if (!canvas || !ctx) return;
    if (!canvas.width) resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width, h = canvas.height;
    const prog = Math.min(elapsed / 6.5, 0.85);
    const x = 30 + prog * (w - 80);
    const y = h - 30 - Math.pow(prog, 1.35) * (h - 80);

    ctx.beginPath();
    ctx.moveTo(15, h - 15);
    ctx.quadraticCurveTo(x * 0.5, h - 15, x, y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e50914';
    ctx.stroke();

    ctx.lineTo(x, h - 15);
    ctx.closePath();
    ctx.fillStyle = 'rgba(229, 9, 20, 0.22)';
    ctx.fill();

    ctx.font = '28px Arial';
    ctx.fillText('✈️', x - 14, y + 10);
}

function runCrash() {
    state = 'CRASHED';
    if (flewEl) flewEl.style.display = 'block';
    if (multEl) { multEl.style.color = '#e50914'; multEl.innerText = crashPoint.toFixed(2) + 'x'; }
    refreshBetButtons();

    const pills = document.getElementById('historyPills');
    if (pills) {
        const span = document.createElement('span');
        span.className = 'pill ' + (crashPoint >= 2 ? 'purple' : 'blue');
        span.innerText = crashPoint.toFixed(2) + 'x';
        pills.prepend(span);
        if (pills.children.length > 6) pills.lastChild.remove();
    }

    setTimeout(runWaiting, 3000);
}

window.addEventListener('DOMContentLoaded', () => {
    const balAttr = document.body.getAttribute('data-balance');
    if (balAttr) userBalance = parseFloat(balAttr) || 0;

    const bInp1 = document.getElementById('betInput1');
    if (bInp1) {
        bInp1.addEventListener('input', e => {
            const bAmt1 = document.getElementById('btnAmt1');
            if (bAmt1) bAmt1.innerText = (parseFloat(e.target.value) || 0).toFixed(2) + ' INR';
        });
    }

    const bInp2 = document.getElementById('betInput2');
    if (bInp2) {
        bInp2.addEventListener('input', e => {
            const bAmt2 = document.getElementById('btnAmt2');
            if (bAmt2) bAmt2.innerText = (parseFloat(e.target.value) || 0).toFixed(2) + ' INR';
        });
    }

    canvas = document.getElementById('gameCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        multEl = document.getElementById('multiplierDisplay');
        flewEl = document.getElementById('flewText');
        waitEl = document.getElementById('waitTimerText');
        window.addEventListener('resize', resizeCanvas);
        runWaiting();
    }
});