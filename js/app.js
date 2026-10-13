/**
 * Print3D Studio Master ERP - Complete Application Suite
 * Full Spanish interface, dark glassmorphism, 3D WebGL, 
 * Advanced 3D Catalog with scale/batch calculations, Printer Financial Profiles,
 * Drag & Drop Kanban, Agenda/Calendar, Maintenance & Spares, PWA & offline support.
 */

// ==========================================================================
// 1. Initialization and State Management
// ==========================================================================
const STORAGE_KEY = 'PRINT3D_ERP_STATE_V7';

let state = {
    orders: [],
    filaments: [],
    printers: [],
    expenses: [],
    catalog: [],
    clients: [],
    spares: [],
    wastageLogs: [],
    electricityTariff: 0.18,
    lastBackupDate: null,
    monthlyProfitGoal: 1200,
    hourlyFixedCost: 0.00
};

let charts = {};
let scene, camera, renderer, mesh, wireframe;
let telemetryInterval;
let audioCtx = null;
let currentCalendarDate = new Date();
let currentOrdersView = 'kanban';
let currentAgendaView = 'month';

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkAutoSyncParam();
    if (state.filaments.length === 0) {
        seedDemoData(false);
    }
    
    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW reg failed:', err));
    }

    // Restore Dark/Light Mode
    const savedTheme = localStorage.getItem('PRINT3D_THEME');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        const btnTheme = document.getElementById('btn-dark-mode');
        if (btnTheme) btnTheme.innerHTML = '<i class="fa-solid fa-moon"></i> Modo Oscuro';
    }

    initEventListeners();
    initMeshBackground();
    init3DViewer();
    initDropzone();
    initCalculator();
    initSignaturePad();
    startTelemetrySimulation();
    
    renderAll();

    // Check automatic alerts
    setTimeout(() => {
        checkDeadlineAlerts();
        checkLowStockAlerts();
    }, 1200);

    // Recheck alerts every 30 minutes
    setInterval(checkDeadlineAlerts, 30 * 60 * 1000);
});

// Synthesized Audio Chime (Web Audio API)
function playChime(type = 'success') {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
            osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'alert') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.setValueAtTime(880, now + 0.15); // A5
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch(e) { console.log('Audio disabled or blocked:', e); }
}

function loadState() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            state = JSON.parse(stored);
            if (!state.spares) state.spares = [];
            if (!state.wastageLogs) state.wastageLogs = [];
            if (!state.electricityTariff) state.electricityTariff = 0.18;
            if (state.lastBackupDate === undefined) state.lastBackupDate = null;
            if (!state.monthlyProfitGoal) state.monthlyProfitGoal = 1200;
            if (state.hourlyFixedCost === undefined) state.hourlyFixedCost = 0.00;
            if (!state.minimumOrderFee) state.minimumOrderFee = 5.00;
            if (!state.paymentConfig) state.paymentConfig = { bizumPhone: '612 34 56 78', revolutTag: '', paypalUser: '' };
            if (state.printers) {
                for (let i = 0; i < state.printers.length; i++) {
                    if (state.printers[i].lastCleanHours === undefined) state.printers[i].lastCleanHours = 0;
                    if (state.printers[i].lastLubeHours === undefined) state.printers[i].lastLubeHours = 0;
                    if (state.printers[i].lastBeltHours === undefined) state.printers[i].lastBeltHours = 0;
                }
            }
            if (state.orders) {
                for (let i = 0; i < state.orders.length; i++) {
                    if (!state.orders[i].changelog) state.orders[i].changelog = [];
                    if (state.orders[i].depositPaid === undefined) state.orders[i].depositPaid = 0;
                    if (!state.orders[i].paymentMethod) state.orders[i].paymentMethod = 'Bizum';
                }
            }
            if (!state.catalog || state.catalog.length <= 2) {
                state.catalog = [
                    { id: generateId(), name: 'Casco Iron Man Mark 85', category: 'Cosplay & Props', material: 'PLA+', price: 175.00, weight: 850, time: 42.0, icon: 'fa-solid fa-mask', notes: 'Escala 1:1, soportes de árbol, 15% giroide' },
                    { id: generateId(), name: 'Dragón Articulado Cristal', category: 'Figuras & Miniaturas', material: 'PETG', price: 24.50, weight: 160, time: 7.5, icon: 'fa-solid fa-dragon', notes: 'Print-in-place sin soportes' },
                    { id: generateId(), name: 'Soporte Auriculares Hexagonal', category: 'Decoración & Hogar', material: 'PLA+', price: 19.90, weight: 120, time: 4.0, icon: 'fa-solid fa-headphones', notes: 'Diseño geométrico de escritorio' },
                    { id: generateId(), name: 'Engranaje Reductor Helicoidal', category: 'Mecánica & Utilidad', material: 'PETG', price: 16.00, weight: 85, time: 3.5, icon: 'fa-solid fa-gear', notes: 'Tolerancia 0.15mm, 4 perímetros' },
                    { id: generateId(), name: 'Busto Batman Dark Knight', category: 'Figuras & Miniaturas', material: 'Resina SLA', price: 45.00, weight: 280, time: 14.0, icon: 'fa-solid fa-chess-knight', notes: 'Ultra detalle capa 0.05mm' },
                    { id: generateId(), name: 'Litofanía Curva Personalizada', category: 'Litofanías & Regalos', material: 'PLA+', price: 22.00, weight: 95, time: 6.0, icon: 'fa-solid fa-lightbulb', notes: '100% relleno blanco vertical' }
                ];
            }
            if (!state.gallery || state.gallery.length === 0) {
                state.gallery = [
                    { id: 'gal-1', title: 'Casco Mandalorian Beskar', category: 'Cosplay', material: 'PLA Silk Plata', printer: 'Bambu Lab X1-Carbon', specs: 'Capa 0.16mm • 3 paredes • 24h', photo: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80', date: '2026-09-15' },
                    { id: 'gal-2', title: 'Soporte Motor Nema 17 Reforzado', category: 'Ingeniería', material: 'PETG Carbono Negro', printer: 'Prusa MK4', specs: '5 paredes • 40% giroide • 80ºC', photo: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80', date: '2026-09-20' },
                    { id: 'gal-3', title: 'Lámpara Luna Litofanía 3D', category: 'Litofanía', material: 'PLA Blanco Frío', printer: 'Bambu Lab X1-Carbon', specs: '100% relleno • Capa 0.12mm • Base LED', photo: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80', date: '2026-09-28' },
                    { id: 'gal-4', title: 'Macetero Geométrico Origami', category: 'Hogar', material: 'PLA Terracota Mate', printer: 'Ender 3 V3', specs: 'Modo Vaso espiral 0.8mm estanco', photo: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80', date: '2026-10-02' }
                ];
            }
            if (!state.filamentPurchases || state.filamentPurchases.length === 0) {
                state.filamentPurchases = [
                    { id: generateId(), date: '2026-09-10', provider: 'Sunlu Official Store', brand: 'Sunlu', material: 'PETG', quantityKg: 10, totalCost: 119.00, pricePerKg: 11.90, notes: 'Pack 10 bobinas oferta' },
                    { id: generateId(), date: '2026-09-22', provider: 'Amazon', brand: 'eSun', material: 'PLA', quantityKg: 3, totalCost: 59.70, pricePerKg: 19.90, notes: 'Compra rápida urgente' },
                    { id: generateId(), date: '2026-10-01', provider: 'AliExpress Choice', brand: 'Jayo', material: 'PLA', quantityKg: 5, totalCost: 67.50, pricePerKg: 13.50, notes: 'Oferta Choice 5 días' },
                    { id: generateId(), date: '2026-10-08', provider: '3DJake', brand: 'Prusament', material: 'ASA', quantityKg: 2, totalCost: 58.00, pricePerKg: 29.00, notes: 'Material técnico resistente UV' }
                ];
            }
        } catch (e) {
            console.error('Failed to parse state:', e);
        }
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedDemoData(showEffects = true) {
    state.minimumOrderFee = 5.00;
    state.filaments = [
        { id: generateId(), brand: 'eSun', material: 'PLA+', colorName: 'Negro Mate', hex: '#111827', maxWeight: 1000, currentWeight: 750, costPerKg: 19.90 },
        { id: generateId(), brand: 'Sunlu', material: 'PETG', colorName: 'Rojo Fuego', hex: '#ef4444', maxWeight: 1000, currentWeight: 420, costPerKg: 18.50 },
        { id: generateId(), brand: 'Prusament', material: 'ASA', colorName: 'Gris Galáctico', hex: '#64748b', maxWeight: 1000, currentWeight: 150, costPerKg: 29.00 },
        { id: generateId(), brand: 'Anycubic', material: 'Resina SLA', colorName: 'Gris Básico', hex: '#94a3b8', maxWeight: 1000, currentWeight: 890, costPerKg: 24.00 }
    ];
    
    state.printers = [
        { id: generateId(), name: 'Bambu Lab X1-Carbon', tech: 'FDM', nozzle: 0.4, power: 350, wear: 0.20, purchasePrice: 1450, amortMonths: 24, fixedCostMonth: 25, kwhPrice: 0.18, hours: 1420, nozzleHours: 85, status: 'Printing' },
        { id: generateId(), name: 'Prusa MK4', tech: 'FDM', nozzle: 0.4, power: 250, wear: 0.15, purchasePrice: 850, amortMonths: 36, fixedCostMonth: 15, kwhPrice: 0.18, hours: 680, nozzleHours: 210, status: 'Idle' },
        { id: generateId(), name: 'Elegoo Saturn 3 Ultra', tech: 'SLA', nozzle: 0.05, power: 120, wear: 0.25, purchasePrice: 480, amortMonths: 18, fixedCostMonth: 30, kwhPrice: 0.18, hours: 310, nozzleHours: 40, status: 'Idle' }
    ];

    const today = new Date();
    const dToday = today.toISOString().split('T')[0];
    const dPlus1 = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dPlus3 = new Date(Date.now() + 3*86400000).toISOString().split('T')[0];
    const dMinus2 = new Date(Date.now() - 2*86400000).toISOString().split('T')[0];

    state.orders = [
        { id: generateId(), title: 'Casco Iron Man Mark 85', client: 'Tony Stark', filamentId: state.filaments[0].id, printerId: state.printers[0].id, weight: 850, time: 42, price: 175.00, depositPaid: 80.00, paymentMethod: 'Bizum', deadline: dPlus1, status: 'Imprimiendo', date: new Date().toISOString(), changelog: [{ date: new Date().toISOString(), from: 'En Cola', to: 'Imprimiendo', note: 'Iniciada impresión en Bambu Lab' }] },
        { id: generateId(), title: 'Dragón Articulado Cristal', client: 'Elena Gomez', filamentId: state.filaments[1].id, printerId: state.printers[1].id, weight: 160, time: 7.5, price: 24.50, depositPaid: 10.00, paymentMethod: 'Efectivo', deadline: dToday, status: 'Post-Proceso', date: new Date().toISOString(), changelog: [] },
        { id: generateId(), title: 'Engranaje Helicoidal Reductor', client: 'Talleres Mecánicos Norte', filamentId: state.filaments[2].id, printerId: state.printers[1].id, weight: 85, time: 3.5, price: 16.00, deadline: dPlus3, status: 'En Cola', date: new Date().toISOString(), changelog: [] },
        { id: generateId(), title: 'Busto Batman Dark Knight', client: 'Bruce Wayne', filamentId: state.filaments[3].id, printerId: state.printers[2].id, weight: 280, time: 14, price: 45.00, deadline: dMinus2, status: 'Entregado', date: new Date(Date.now() - 2*86400000).toISOString(), changelog: [] }
    ];

    state.expenses = [
        { id: generateId(), date: dMinus2, concept: 'Factura Electricidad Taller', category: 'Electricidad', amount: 64.20 },
        { id: generateId(), date: dMinus2, concept: 'Pack 5 Boquillas Hardened Steel 0.4', category: 'Repuestos', amount: 28.50 },
        { id: generateId(), date: dToday, concept: 'Bobinas eSun PLA+ y Sunlu PETG', category: 'Filamento', amount: 76.80 }
    ];

    state.catalog = [
        { id: generateId(), name: 'Casco Iron Man Mark 85', category: 'Cosplay & Props', material: 'PLA+', price: 175.00, weight: 850, time: 42.0, icon: 'fa-solid fa-mask', notes: 'Escala 1:1, soportes de árbol, 15% giroide' },
        { id: generateId(), name: 'Dragón Articulado Cristal', category: 'Figuras & Miniaturas', material: 'PETG', price: 24.50, weight: 160, time: 7.5, icon: 'fa-solid fa-dragon', notes: 'Print-in-place sin soportes' },
        { id: generateId(), name: 'Soporte Auriculares Hexagonal', category: 'Decoración & Hogar', material: 'PLA+', price: 19.90, weight: 120, time: 4.0, icon: 'fa-solid fa-headphones', notes: 'Diseño geométrico de escritorio' },
        { id: generateId(), name: 'Engranaje Reductor Helicoidal', category: 'Mecánica & Utilidad', material: 'PETG', price: 16.00, weight: 85, time: 3.5, icon: 'fa-solid fa-gear', notes: 'Tolerancia 0.15mm, 4 perímetros' },
        { id: generateId(), name: 'Busto Batman Dark Knight', category: 'Figuras & Miniaturas', material: 'Resina SLA', price: 45.00, weight: 280, time: 14.0, icon: 'fa-solid fa-chess-knight', notes: 'Ultra detalle capa 0.05mm' },
        { id: generateId(), name: 'Litofanía Curva Personalizada', category: 'Litofanías & Regalos', material: 'PLA+', price: 22.00, weight: 95, time: 6.0, icon: 'fa-solid fa-lightbulb', notes: '100% relleno blanco vertical' }
    ];

    state.clients = [
        { id: generateId(), name: 'Tony Stark', email: 'tony@stark.com', phone: '+34 612 345 678', ordersCount: 4, totalSpent: 480.00, status: 'VIP' },
        { id: generateId(), name: 'Elena Gomez', email: 'elena.g@gmail.com', phone: '+34 689 112 233', ordersCount: 2, totalSpent: 54.50, status: 'Frecuente' },
        { id: generateId(), name: 'Talleres Mecánicos Norte', email: 'info@mecanicosnorte.es', phone: '+34 912 334 455', ordersCount: 6, totalSpent: 395.00, status: 'Empresa' },
        { id: generateId(), name: 'Bruce Wayne', email: 'bruce@wayne-enterprises.com', phone: '+34 600 000 001', ordersCount: 1, totalSpent: 45.00, status: 'Regular' }
    ];

    state.spares = [
        { id: generateId(), name: 'Boquilla Hardened Steel 0.4mm', category: 'Boquillas', qty: 4, minStock: 2 },
        { id: generateId(), name: 'Plancha PEI Texturizada Doble Cara', category: 'Camas PEI', qty: 2, minStock: 1 },
        { id: generateId(), name: 'Calentador Cerámico 24V 60W', category: 'Extrusores', qty: 1, minStock: 1 }
    ];

    state.gallery = [
        { id: 'gal-1', title: 'Casco Mandalorian Beskar', category: 'Cosplay', material: 'PLA Silk Plata', printer: 'Bambu Lab X1-Carbon', specs: 'Capa 0.16mm • 3 paredes • 24h', photo: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80', date: '2026-09-15' },
        { id: 'gal-2', title: 'Soporte Motor Nema 17 Reforzado', category: 'Ingeniería', material: 'PETG Carbono Negro', printer: 'Prusa MK4', specs: '5 paredes • 40% giroide • 80ºC', photo: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80', date: '2026-09-20' },
        { id: 'gal-3', title: 'Lámpara Luna Litofanía 3D', category: 'Litofanía', material: 'PLA Blanco Frío', printer: 'Bambu Lab X1-Carbon', specs: '100% relleno • Capa 0.12mm • Base LED', photo: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80', date: '2026-09-28' },
        { id: 'gal-4', title: 'Macetero Geométrico Origami', category: 'Hogar', material: 'PLA Terracota Mate', printer: 'Ender 3 V3', specs: 'Modo Vaso espiral 0.8mm estanco', photo: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80', date: '2026-10-02' }
    ];

    state.filamentPurchases = [
        { id: generateId(), date: '2026-09-10', provider: 'Sunlu Official Store', brand: 'Sunlu', material: 'PETG', quantityKg: 10, totalCost: 119.00, pricePerKg: 11.90, notes: 'Pack 10 bobinas oferta' },
        { id: generateId(), date: '2026-09-22', provider: 'Amazon', brand: 'eSun', material: 'PLA', quantityKg: 3, totalCost: 59.70, pricePerKg: 19.90, notes: 'Compra rápida urgente' },
        { id: generateId(), date: '2026-10-01', provider: 'AliExpress Choice', brand: 'Jayo', material: 'PLA', quantityKg: 5, totalCost: 67.50, pricePerKg: 13.50, notes: 'Oferta Choice 5 días' },
        { id: generateId(), date: '2026-10-08', provider: '3DJake', brand: 'Prusament', material: 'ASA', quantityKg: 2, totalCost: 58.00, pricePerKg: 29.00, notes: 'Material técnico resistente UV' }
    ];

    saveState();
    if (showEffects) {
        renderAll();
        showToast('¡Datos de demostración cargados con éxito!', 'success');
        if (typeof triggerConfetti === 'function') triggerConfetti();
        playChime('success');
    }
}

// ==========================================================================
// 2. Core UI Navigation & Interactions
// ==========================================================================
function initEventListeners() {
    // Navigation with clean preventDefault and mobile support
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = e.currentTarget.getAttribute('data-tab');
            if (tabId) {
                switchTab(tabId);
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Close mobile sidebar if open
                toggleSidebar(false);
            }
        });
    });

    // Quick Data Management Buttons
    document.getElementById('btn-seed-data')?.addEventListener('click', () => seedDemoData(true));
    document.getElementById('btn-export-json')?.addEventListener('click', exportStateJSON);
    
    const fileImportInput = document.getElementById('file-import-input');
    const btnImport = document.getElementById('btn-import-json');
    if (btnImport && fileImportInput) {
        btnImport.addEventListener('click', () => fileImportInput.click());
        fileImportInput.addEventListener('change', importStateJSON);
    }

    // Realtime Search & Filter Inputs
    document.getElementById('filter-orders-search')?.addEventListener('input', renderOrders);
    document.getElementById('filter-filament-search')?.addEventListener('input', renderFilaments);
    document.getElementById('filter-expense-category')?.addEventListener('change', renderExpenses);
    
    // Initialize Workshop Mode (simple by default)
    initWorkshopMode();
}

let currentWorkshopMode = localStorage.getItem('PRINT3D_WORKSHOP_MODE') || 'simple';

function initWorkshopMode() {
    applyWorkshopMode(currentWorkshopMode);
}

function toggleWorkshopMode() {
    currentWorkshopMode = currentWorkshopMode === 'simple' ? 'advanced' : 'simple';
    localStorage.setItem('PRINT3D_WORKSHOP_MODE', currentWorkshopMode);
    applyWorkshopMode(currentWorkshopMode);
    showToast(currentWorkshopMode === 'simple' ? '✨ Modo Taller activado (interfaz simplificada y clara)' : '🚀 Modo Completo activado (todas las herramientas visibles)', 'info');
}

function applyWorkshopMode(mode) {
    const isSimple = mode === 'simple';
    document.body.classList.toggle('mode-simple', isSimple);
    document.body.classList.toggle('mode-advanced', !isSimple);
    
    const modeBtnText = document.getElementById('workshop-mode-text');
    if (modeBtnText) {
        modeBtnText.textContent = isSimple ? 'Modo Taller' : 'Modo Avanzado';
    }
    const modeBtn = document.getElementById('btn-mode-toggle');
    if (modeBtn) {
        modeBtn.className = isSimple ? 'btn-outline btn-sm' : 'btn-primary btn-sm';
    }

    const advGroup = document.getElementById('nav-advanced-group');
    const advIcon = document.getElementById('nav-advanced-icon');
    if (advGroup) {
        if (isSimple) {
            advGroup.classList.add('collapsed');
            if (advIcon) advIcon.className = 'fa-solid fa-chevron-right text-dim';
        } else {
            advGroup.classList.remove('collapsed');
            if (advIcon) advIcon.className = 'fa-solid fa-chevron-down text-dim';
        }
    }
}

function toggleNavAdvancedGroup() {
    const advGroup = document.getElementById('nav-advanced-group');
    const advIcon = document.getElementById('nav-advanced-icon');
    if (!advGroup) return;
    const isCollapsed = advGroup.classList.toggle('collapsed');
    if (advIcon) {
        advIcon.className = isCollapsed ? 'fa-solid fa-chevron-right text-dim' : 'fa-solid fa-chevron-down text-dim';
    }
}

function shareCalcQuoteWhatsApp() {
    const itemName = document.getElementById('calc-item-name')?.value.trim() || 'Pieza 3D personalizada';
    const weight = document.getElementById('calc-weight')?.value || 0;
    const time = document.getElementById('calc-time')?.value || 0;
    const price = document.getElementById('calc-suggested-price')?.textContent || '0.00 €';
    const priceNum = parseFloat(price.replace('€', '').trim()) || 0;

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 15);
    const expiryFormatted = expiry.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const paymentText = typeof getPaymentLinksText === 'function' ? getPaymentLinksText(priceNum.toFixed(2), 'PRE-3D') : '';
    
    const msg = `¡Hola! Aquí tienes el presupuesto para tu pieza 3D:\n\n` +
                `📦 *Pieza:* ${itemName}\n` +
                `⚖️ *Peso estimado:* ${weight} g\n` +
                `⏱️ *Tiempo de impresión:* ~${time} horas\n` +
                `💶 *Precio final:* ${price} (IVA incl.)\n` +
                `📅 *Validez del presupuesto:* 15 días laborables (hasta el ${expiryFormatted}) sujeto a cola de taller.\n` +
                paymentText + `\n` +
                `¿Deseas confirmarlo para que lo pongamos en cola de impresión en el taller? 🚀`;
                
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function toggleOrderExtraOptions() {
    const fields = document.getElementById('order-extra-fields');
    const icon = document.getElementById('order-extra-icon');
    if (!fields) return;
    const isHidden = fields.style.display === 'none';
    fields.style.display = isHidden ? 'block' : 'none';
    if (icon) icon.className = isHidden ? 'fa-solid fa-chevron-up text-dim text-xs' : 'fa-solid fa-chevron-down text-dim text-xs';
}

function resetToCleanWorkshop() {
    if (!confirm('¿Seguro que quieres vaciar los datos de demostración?\n\nTu taller quedará limpio para que introduzcas tus propias bobinas, impresoras y encargos reales. (Podrás volver a cargar datos demo cuando quieras con el botón del menú).')) {
        return;
    }
    state.orders = [];
    state.filaments = [];
    state.expenses = [];
    state.clients = [];
    state.printers = [
        { id: generateId(), name: 'Mi Impresora Principal', tech: 'FDM', nozzle: 0.4, power: 120, wear: 0.05, hours: 0, status: 'Idle', nozzleHours: 0, acquisitionPrice: 300, lifespanHours: 2000, fixedCostPerMonth: 0 }
    ];
    state.wastageLogs = [];
    saveState();
    renderAll();
    showToast('✨ Taller reiniciado: ¡Listo para tus datos reales!', 'success');
    if (typeof triggerConfetti === 'function') triggerConfetti();
    playChime('success');
    
    setTimeout(() => {
        openModal('modal-filament');
        showToast('👉 Añade tu primer rollo de filamento para empezar', 'info');
    }, 600);
}

function renderWorkshopAlerts() {
    const card = document.getElementById('workshop-alerts-card');
    if (!card) return;
    
    const alerts = [];
    
    // Check low stock filaments (< 200g or < 20%)
    state.filaments.forEach(f => {
        const pct = f.maxWeight > 0 ? (f.currentWeight / f.maxWeight) : 1;
        if (f.currentWeight < 200 || pct < 0.20) {
            alerts.push({
                type: 'warning',
                icon: 'fa-solid fa-triangle-exclamation',
                text: `<strong>Filamento Bajo:</strong> Te quedan solo <strong>${Math.round(f.currentWeight)}g</strong> de ${escapeHtml(f.brand)} ${escapeHtml(f.material)} (${escapeHtml(f.colorName)}). ¡Conviene pedir recambio!`
            });
        }
    });

    // Check urgent orders (within 48 hours and not delivered)
    const now = new Date();
    state.orders.forEach(o => {
        if (o.status !== 'Entregado' && o.deadline) {
            const due = new Date(o.deadline);
            const diffHours = (due - now) / (1000 * 60 * 60);
            if (diffHours < 48) {
                if (diffHours < 0) {
                    alerts.push({
                        type: 'warning',
                        icon: 'fa-solid fa-clock',
                        text: `<strong>Entrega Vencida:</strong> El encargo de <em>${escapeHtml(o.client)}</em> ("${escapeHtml(o.title)}") superó la fecha límite fijada.`
                    });
                } else {
                    alerts.push({
                        type: 'info',
                        icon: 'fa-solid fa-hourglass-half',
                        text: `<strong>Entrega Próxima:</strong> El encargo de <em>${escapeHtml(o.client)}</em> ("${escapeHtml(o.title)}") vence en menos de 48 horas.`
                    });
                }
            }
        }
    });

    // Check backup reminder (if workshop has data and > 7 days since last backup)
    if (state.orders.length > 0 || state.filaments.length > 0) {
        if (!state.lastBackupDate) {
            alerts.push({
                type: 'info',
                icon: 'fa-solid fa-shield-halved',
                text: `<strong>Copia de Seguridad:</strong> Tu taller tiene datos pero aún no has descargado ningún backup. <button class="btn-outline btn-xs" onclick="quickBackupWorkshop()" style="margin-left:8px; border-color:#60a5fa; color:#60a5fa; display:inline-flex; align-items:center; gap:4px; padding:2px 8px; cursor:pointer;"><i class="fa-solid fa-download"></i> Descargar Copia</button>`
            });
        } else {
            const daysSinceBackup = (now - new Date(state.lastBackupDate)) / (1000 * 60 * 60 * 24);
            if (daysSinceBackup >= 7) {
                alerts.push({
                    type: 'warning',
                    icon: 'fa-solid fa-shield-halved',
                    text: `<strong>Recordatorio de Seguridad:</strong> Han pasado ${Math.floor(daysSinceBackup)} días desde tu última copia de respaldo. <button class="btn-outline btn-xs" onclick="quickBackupWorkshop()" style="margin-left:8px; border-color:#60a5fa; color:#60a5fa; display:inline-flex; align-items:center; gap:4px; padding:2px 8px; cursor:pointer;"><i class="fa-solid fa-download"></i> Descargar Copia</button>`
                });
            }
        }
    }

    if (alerts.length > 0) {
        card.style.display = 'flex';
        card.innerHTML = alerts.map(a => `
            <div class="workshop-alert-item alert-${a.type}">
                <i class="${a.icon}"></i>
                <span>${a.text}</span>
            </div>
        `).join('');
    } else {
        card.style.display = 'flex';
        card.innerHTML = `
            <div class="workshop-alert-item alert-success">
                <i class="fa-solid fa-circle-check"></i>
                <span><strong>¡Todo en orden en el taller!</strong> Tienes filamento suficiente y no hay entregas urgentes retrasadas.</span>
            </div>
        `;
    }
}

function toggleSidebar(forceOpen) {
    const sb = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sb) return;

    const isOpen = (forceOpen !== undefined) ? forceOpen : !sb.classList.contains('mobile-open');
    if (isOpen) {
        sb.classList.add('mobile-open', 'active');
        if (backdrop) backdrop.classList.add('active');
        document.body.classList.add('sidebar-open-locked');
    } else {
        sb.classList.remove('mobile-open', 'active');
        if (backdrop) backdrop.classList.remove('active');
        document.body.classList.remove('sidebar-open-locked');
    }
}

function switchMobileTab(tabId, el) {
    switchTab(tabId);
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
    if (el) el.classList.add('active');
    toggleSidebar(false);
}

function switchTab(tabId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
    });

    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
        
        // Update sidebar active link
        document.querySelectorAll('.nav-item').forEach(nav => {
            if (nav.getAttribute('data-tab') === tabId) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });

        // Update mobile bottom nav active state
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Localized Spanish titles with matching FontAwesome icons
        const titles = {
            'tab-dashboard': '<i class="fa-solid fa-house-chimney text-cyan"></i> Mi Taller 3D',
            'tab-calendar-view': '<i class="fa-solid fa-calendar-check text-cyan"></i> Calendario de Vencimientos',
            'tab-orders': '<i class="fa-solid fa-list-check text-emerald"></i> Pedidos y Encargos',
            'tab-catalog': '<i class="fa-solid fa-box-open text-primary"></i> Catálogo de Piezas',
            'tab-crm': '<i class="fa-solid fa-users text-secondary"></i> Directorio de Clientes (CRM)',
            'tab-filaments': '<i class="fa-solid fa-spool text-purple"></i> Mis Bobinas de Filamento',
            'tab-printers': '<i class="fa-solid fa-print text-purple"></i> Parque de Impresoras 3D',
            'tab-expenses': '<i class="fa-solid fa-receipt text-danger"></i> Control de Gastos y Costes',
            'tab-calculator': '<i class="fa-solid fa-calculator text-amber"></i> Calculadora de Precios',
            'tab-schedule': '<i class="fa-solid fa-calendar-days text-cyan"></i> Agenda General y Fechas Límite',
            'tab-maintenance': '<i class="fa-solid fa-screwdriver-wrench text-amber"></i> Mantenimiento & Repuestos',
            'tab-advisor': '<i class="fa-solid fa-wand-magic-sparkles text-emerald"></i> Asistente de Selección de Materiales',
            'tab-gallery': '<i class="fa-solid fa-camera-retro text-cyan"></i> Showroom & Galería de Trabajos',
            'tab-analytics': '<i class="fa-solid fa-chart-line text-cyan"></i> Métricas y Rentabilidad del Taller'
        };
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.innerHTML = titles[tabId] || '<i class="fa-solid fa-cube"></i> Print3D Studio';
        
        // Immediate view updates
        if (tabId === 'tab-dashboard') { renderDashboard(); }
        if (tabId === 'tab-orders') { renderOrders(); }
        if (tabId === 'tab-calendar-view' || tabId === 'tab-schedule') { renderDashboardCalendar(); }
        if (tabId === 'tab-maintenance') { renderMaintenance(); renderSparesTable(); }
        if (tabId === 'tab-advisor') { runMaterialAdvisor(); }
        if (tabId === 'tab-filaments') { renderFilaments(); }
        if (tabId === 'tab-printers') { renderPrinters(); }
        if (tabId === 'tab-catalog') { renderCatalog(); }
        if (tabId === 'tab-gallery') { renderGallery(); }
        if (tabId === 'tab-crm') { renderCRM(); }
        if (tabId === 'tab-expenses') { renderExpenses(); }
        
        // Render charts when opening dashboard or analytics
        if (tabId === 'tab-dashboard' || tabId === 'tab-analytics') {
            setTimeout(renderCharts, 50);
        }
    }
}

function renderAll() {
    renderDashboard();
    renderOrders();
    renderCatalog();
    renderGallery();
    renderCRM();
    renderFilaments();
    renderPrinters();
    renderExpenses();
    renderMaintenance();
    renderSparesTable();
    renderAnalytics();
    renderCharts();
}

// ==========================================================================
// 3. Dashboard & KPI Reordering
// ==========================================================================
function renderDashboard() {
    const revenue = state.orders.reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
    const expenses = state.expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const netProfit = revenue - expenses;
    const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0;
    
    const revEl = document.getElementById('dash-total-revenue');
    if (revEl) revEl.textContent = `${revenue.toFixed(2)} €`;
    const expEl = document.getElementById('dash-total-expenses');
    if (expEl) expEl.textContent = `${expenses.toFixed(2)} €`;
    const profEl = document.getElementById('dash-net-profit');
    if (profEl) profEl.textContent = `${netProfit.toFixed(2)} €`;
    const margEl = document.getElementById('dash-profit-margin');
    if (margEl) margEl.textContent = `Margen neto: ${margin}%`;

    const tariffEl = document.getElementById('header-tariff-val');
    if (tariffEl) tariffEl.textContent = `${(parseFloat(state.electricityTariff) || 0.18).toFixed(2)} €/kWh`;

    const activePrinters = state.printers.filter(p => p.status === 'Printing').length;
    const prActiveEl = document.getElementById('dash-printers-active');
    if (prActiveEl) prActiveEl.textContent = `${activePrinters} / ${state.printers.length}`;
    
    const countEl = document.getElementById('dash-orders-count');
    if (countEl) countEl.textContent = `${state.orders.length} encargos registrados`;
    
    const activeJobs = state.orders.filter(o => o.status === 'Imprimiendo').length;
    const actJobsEl = document.getElementById('dash-active-jobs');
    if (actJobsEl) actJobsEl.textContent = `${activeJobs} impresiones en marcha`;

    // Recent Orders Table
    const tbody = document.getElementById('dash-recent-orders-list');
    if (tbody) {
        tbody.innerHTML = '';
        state.orders.slice(-5).reverse().forEach(o => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(o.client)}</strong> <span class="text-xs text-muted">(${escapeHtml(o.title)})</span></td>
                <td><span class="badge ${getBadgeClass(o.status)}">${o.status}</span></td>
                <td class="fw-bold text-emerald">${parseFloat(o.price || 0).toFixed(2)} €</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Printers Status Strip with Financial Profitability
    const printersList = document.getElementById('dash-printers-list');
    if (printersList) {
        printersList.innerHTML = '';
        state.printers.forEach(p => {
            const pOrders = state.orders.filter(o => o.printerId === p.id);
            const pRevenue = pOrders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
            const pHours = pOrders.reduce((s, o) => s + (parseFloat(o.time) || 0), 0);
            const purchasePrice = parseFloat(p.purchasePrice || 0);
            const powerKw = (parseFloat(p.power || 250)) / 1000;
            const wearPerHour = parseFloat(p.wear || 0.15);
            const kwhPrice = parseFloat(p.kwhPrice || 0.18);
            const opCost = (pHours * powerKw * kwhPrice) + (pHours * wearPerHour);
            const netProfit = pRevenue - opCost;
            
            let statusBadge = '';
            if (purchasePrice > 0 && netProfit >= purchasePrice) {
                statusBadge = `<span class="badge bg-emerald text-dark fw-bold" style="font-size:10px;"><i class="fa-solid fa-circle-check"></i> RENTABLE (+${(netProfit - purchasePrice).toFixed(0)}€)</span>`;
            } else if (purchasePrice > 0) {
                const amortPct = Math.min(100, Math.round((Math.max(0, netProfit) / purchasePrice) * 100));
                statusBadge = `<span class="badge bg-amber text-dark fw-bold" style="font-size:10px;"><i class="fa-solid fa-spinner"></i> Amortizando (${amortPct}%)</span>`;
            } else {
                statusBadge = `<span class="badge ${p.status === 'Printing' ? 'bg-primary' : 'bg-secondary'}" style="font-size:10px;">${p.status}</span>`;
            }

            const card = document.createElement('div');
            card.className = 'printer-status-card';
            card.style.cursor = 'pointer';
            card.style.padding = '12px 14px';
            card.style.borderRadius = '10px';
            card.style.background = 'rgba(255, 255, 255, 0.03)';
            card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            card.onclick = () => openPrinterProfile(p.id);
            card.title = 'Haz clic para ver el informe económico detallado y amortización de esta máquina';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong><i class="fa-solid fa-print text-cyan mr-1"></i> ${escapeHtml(p.name)}</strong>
                        <div class="text-xs text-muted mt-1">${pHours.toFixed(1)}h trabajadas • ${pOrders.length} encargos</div>
                    </div>
                    <div style="text-align: right;">
                        <div>${statusBadge}</div>
                        <div class="text-xs fw-bold text-emerald mt-1">+${pRevenue.toFixed(2)} € cobrados</div>
                    </div>
                </div>
            `;
            printersList.appendChild(card);
        });
    }

    renderWorkshopAlerts();
    renderMonthlyGoal();
    renderDashboardCalendar();
    setTimeout(renderCharts, 50);
}

function moveKpiCard(cardId, direction) {
    const grid = document.getElementById('kpi-grid');
    if (!grid) return;
    const cards = Array.from(grid.children);
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx >= 0 && targetIdx < cards.length) {
        if (direction === -1) {
            grid.insertBefore(cards[idx], cards[targetIdx]);
        } else {
            grid.insertBefore(cards[idx], cards[targetIdx].nextSibling);
        }
    }
}

// ==========================================================================
// 4. Orders Kanban & Tabular View
// ==========================================================================
function toggleOrdersView(mode) {
    currentOrdersView = mode;
    const kanban = document.getElementById('orders-kanban-view');
    const table = document.getElementById('orders-table-view');
    
    if (mode === 'kanban') {
        if (kanban) kanban.style.display = 'grid';
        if (table) table.style.display = 'none';
    } else {
        if (kanban) kanban.style.display = 'none';
        if (table) table.style.display = 'block';
    }
    renderOrders();
}

function renderOrders() {
    if (currentOrdersView === 'kanban') {
        renderOrdersKanban();
    } else {
        renderOrdersTable();
    }
}

function renderOrdersKanban() {
    const container = document.getElementById('orders-kanban-view');
    if (!container) return;
    
    const columns = ['Presupuesto', 'En Cola', 'Imprimiendo', 'Post-Proceso', 'Listo', 'Entregado'];
    const searchTerm = (document.getElementById('filter-orders-search')?.value || '').toLowerCase();
    
    container.innerHTML = '';
    
    columns.forEach(col => {
        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-column';
        colDiv.setAttribute('data-status', col);
        
        const colOrders = state.orders.filter(o => {
            const matchesCol = o.status === col;
            const matchesSearch = !searchTerm || 
                (o.title && o.title.toLowerCase().includes(searchTerm)) || 
                (o.client && o.client.toLowerCase().includes(searchTerm));
            return matchesCol && matchesSearch;
        });

        colDiv.innerHTML = `
            <div class="kanban-column-header">
                <h3>${col}</h3>
                <span class="badge" style="background:rgba(255,255,255,0.08); font-size:11px;">${colOrders.length}</span>
            </div>
            <div class="kanban-cards" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${col}')"></div>
        `;
        
        const cardsDiv = colDiv.querySelector('.kanban-cards');
        
        colOrders.forEach(o => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.setAttribute('ondragstart', `handleDragStart(event, '${o.id}')`);
            card.setAttribute('ondragend', `handleDragEnd(event)`);
            
            const fil = state.filaments.find(f => f.id === o.filamentId);
            const filText = fil ? `${fil.brand} ${fil.material} (${fil.colorName})` : 'Filamento estándar';
            
            card.innerHTML = `
                ${o.photo ? `<div style="width:100%; height:90px; border-radius:6px; overflow:hidden; margin-bottom:8px; background:#000;"><img src="${o.photo}" style="width:100%; height:100%; object-fit:cover;"></div>` : ''}
                <h4>${escapeHtml(o.title)}</h4>
                <div class="kanban-card-client"><i class="fa-solid fa-user"></i> ${escapeHtml(o.client)}</div>
                
                <div class="kanban-card-specs">
                    <span><i class="fa-solid fa-weight-scale text-amber"></i> ${o.weight || 0}g</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-clock text-cyan"></i> ${o.time || 0}h</span>
                    ${o.deadline ? `<span>•</span><span class="text-xs text-secondary"><i class="fa-solid fa-calendar"></i> ${o.deadline}</span>` : ''}
                </div>

                ${(() => {
                    if (o.deadline && o.status !== 'Entregado') {
                        const deadlineDate = new Date(o.deadline + (o.deadline.length === 10 ? 'T23:59:59' : ''));
                        const now = new Date();
                        const diffMs = deadlineDate.getTime() - now.getTime();
                        const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));
                        const printHours = parseFloat(o.time || 0);

                        if (diffMs < 0) {
                            return `<div class="mb-1"><span class="badge bg-danger" style="font-size:9.5px; animation: pulse 1.5s infinite;"><i class="fa-solid fa-circle-exclamation mr-1"></i> ¡PLAZO VENCIDO! (${Math.abs(hoursRemaining)}h vencido)</span></div>`;
                        } else if (hoursRemaining < printHours) {
                            return `<div class="mb-1"><span class="badge bg-danger" style="font-size:9.5px; animation: pulse 1.5s infinite; border:1px solid #ff4d4f;"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ¡IMPOSIBLE ENTREGAR A TIEMPO! (Quedan ${hoursRemaining}h y requiere ${printHours}h)</span></div>`;
                        } else if (hoursRemaining <= 24) {
                            return `<div class="mb-1"><span class="badge" style="background:#ea580c; color:#fff; font-size:9.5px;"><i class="fa-solid fa-stopwatch mr-1"></i> Cuenta atrás: ${hoursRemaining}h restantes</span></div>`;
                        } else {
                            const daysLeft = Math.ceil(hoursRemaining / 24);
                            return `<div class="mb-1"><span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:9.5px;"><i class="fa-solid fa-hourglass-half mr-1"></i> Quedan ${daysLeft}d (${hoursRemaining}h)</span></div>`;
                        }
                    }
                    return '';
                })()}

                ${o.isRma ? `<div class="mb-1"><span class="badge bg-danger" style="font-size:10px;"><i class="fa-solid fa-rotate-left mr-1"></i> Garantía / RMA (0 €)</span></div>` : ''}
                ${(() => {
                    if (o.status === 'Presupuesto') {
                        const orderDate = new Date(o.date || Date.now());
                        const diffDays = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
                        const daysLeft = 15 - diffDays;
                        if (daysLeft < 0) {
                            return `<div class="mb-1"><span class="badge bg-danger" style="font-size:9.5px;"><i class="fa-solid fa-hourglass-end mr-1"></i> Presupuesto Caducado (${Math.abs(daysLeft)}d vencido)</span></div>`;
                        } else if (daysLeft <= 3) {
                            return `<div class="mb-1"><span class="badge" style="background:#ef4444; color:#fff; font-size:9.5px;"><i class="fa-solid fa-clock mr-1"></i> Caduca en ${daysLeft}d</span></div>`;
                        } else {
                            return `<div class="mb-1"><span class="badge" style="background:rgba(245,158,11,0.15); color:#fbbf24; font-size:9.5px;"><i class="fa-solid fa-clock mr-1"></i> Válido ${daysLeft}d restantes</span></div>`;
                        }
                    }
                    return '';
                })()}
                ${(() => {
                    const deposit = parseFloat(o.depositPaid || 0);
                    const price = parseFloat(o.price || 0);
                    if (deposit >= price && price > 0) {
                        return `<div class="mb-1"><span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:9.5px;"><i class="fa-solid fa-circle-check mr-1"></i> Pagado 100% (${escapeHtml(o.paymentMethod || 'Bizum')})</span></div>`;
                    } else if (deposit > 0) {
                        const pending = Math.max(0, price - deposit);
                        return `<div class="mb-1"><span class="badge" style="background:rgba(0,210,255,0.12); color:#00d2ff; font-size:9.5px;"><i class="fa-solid fa-hand-holding-dollar mr-1"></i> Señal: ${deposit.toFixed(2)}€ • Pend: ${pending.toFixed(2)}€</span></div>`;
                    }
                    return '';
                })()}
                <div class="kanban-card-price">${parseFloat(o.price || 0).toFixed(2)} €</div>

                <div class="kanban-card-actions">
                    <button onclick="editOrder('${o.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="advanceOrderStatus('${o.id}')" title="Avanzar Estado" class="text-cyan"><i class="fa-solid fa-arrow-right"></i></button>
                    <button onclick="shareClientTracking('${o.id}')" title="Portal Seguimiento Cliente (WhatsApp)" class="text-cyan"><i class="fa-solid fa-satellite-dish"></i></button>
                    <button onclick="openBudgetModal('${o.id}')" title="Presupuesto Formal (PDF)"><i class="fa-solid fa-file-pdf text-amber"></i></button>
                    <button onclick="openDeliveryNoteModal('${o.id}')" title="Albarán de Entrega (sin precios)"><i class="fa-solid fa-truck-ramp-box text-cyan"></i></button>
                    <button onclick="openWhatsAppStatusModal('${o.id}')" title="Mensajes Rápidos WhatsApp" class="text-emerald"><i class="fa-brands fa-whatsapp"></i></button>
                    <button onclick="duplicateOrder('${o.id}')" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
                    <button onclick="duplicateOrderAsRMA('${o.id}')" title="Reimprimir en Garantía (RMA)"><i class="fa-solid fa-rotate-left text-danger"></i></button>
                    <button onclick="showOrderHistory('${o.id}')" title="Historial"><i class="fa-solid fa-clock-rotate-left"></i></button>
                    <button onclick="openInvoiceModal('${o.id}')" title="Factura"><i class="fa-solid fa-file-invoice"></i></button>
                    <button onclick="showTicketModal('${o.id}')" title="Ticket"><i class="fa-solid fa-receipt"></i></button>
                    <button onclick="deleteOrder('${o.id}')" title="Eliminar" class="text-danger"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            cardsDiv.appendChild(card);
        });
        
        container.appendChild(colDiv);
    });
}

function renderOrdersTable() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;
    
    const searchTerm = (document.getElementById('filter-orders-search')?.value || '').toLowerCase();
    const orders = state.orders.filter(o => 
        !searchTerm || 
        (o.title && o.title.toLowerCase().includes(searchTerm)) || 
        (o.client && o.client.toLowerCase().includes(searchTerm))
    );
    
    tbody.innerHTML = '';
    orders.forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${escapeHtml(o.title)}</strong>
                ${o.isRma ? `<span class="badge bg-danger ml-1" style="font-size:9px;">RMA</span>` : ''}
            </td>
            <td>${escapeHtml(o.client)}</td>
            <td><span class="badge ${getBadgeClass(o.status)}">${o.status}</span></td>
            <td>${o.weight || 0}g</td>
            <td>${o.time || 0}h</td>
            <td class="fw-bold text-emerald">${parseFloat(o.price || 0).toFixed(2)} €</td>
            <td>${o.deadline || '—'}</td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-outline btn-xs" onclick="editOrder('${o.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-outline btn-xs" onclick="shareClientTracking('${o.id}')" title="Portal Seguimiento Cliente" style="color:#06b6d4;"><i class="fa-solid fa-satellite-dish"></i></button>
                    <button class="btn btn-outline btn-xs" onclick="openBudgetModal('${o.id}')" title="Presupuesto Formal (PDF)"><i class="fa-solid fa-file-pdf text-amber"></i></button>
                    <button class="btn btn-outline btn-xs" onclick="openDeliveryNoteModal('${o.id}')" title="Albarán"><i class="fa-solid fa-truck-ramp-box text-cyan"></i></button>
                    <button class="btn btn-outline btn-xs" onclick="openWhatsAppStatusModal('${o.id}')" title="WhatsApp"><i class="fa-brands fa-whatsapp text-emerald"></i></button>
                    <button class="btn btn-outline btn-xs" onclick="advanceOrderStatus('${o.id}')" title="Avanzar"><i class="fa-solid fa-arrow-right"></i></button>
                    <button class="btn btn-outline btn-xs" onclick="duplicateOrder('${o.id}')" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
                    <button class="btn btn-outline btn-xs text-danger" onclick="deleteOrder('${o.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Kanban Drag & Drop
let draggedOrderId = null;

function handleDragStart(e, id) {
    draggedOrderId = id;
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', id);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedOrderId = null;
    document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, status) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (draggedOrderId) {
        updateOrderStatus(draggedOrderId, status);
    }
}

function advanceOrderStatus(id) {
    const order = state.orders.find(o => o.id === id);
    if (!order) return;
    const flow = ['Presupuesto', 'En Cola', 'Imprimiendo', 'Post-Proceso', 'Listo', 'Entregado'];
    const idx = flow.indexOf(order.status);
    if (idx >= 0 && idx < flow.length - 1) {
        updateOrderStatus(id, flow[idx + 1]);
    }
}

function updateOrderStatus(id, status) {
    const order = state.orders.find(o => o.id === id);
    if (order && order.status !== status) {
        const oldStatus = order.status;
        order.status = status;
        if (!order.changelog) order.changelog = [];
        order.changelog.push({
            date: new Date().toISOString(),
            from: oldStatus,
            to: status,
            note: 'Estado actualizado'
        });
        saveState();
        renderOrders();
        renderDashboard();
        showToast(`Encargo actualizado a "${status}"`, 'info');
        playChime('success');
    }
}

function duplicateOrder(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const cloned = JSON.parse(JSON.stringify(o));
    cloned.id = generateId();
    cloned.title = `${o.title} (Copia)`;
    cloned.status = 'Presupuesto';
    cloned.date = new Date().toISOString();
    cloned.changelog = [{ date: new Date().toISOString(), from: '-', to: 'Presupuesto', note: 'Encargo duplicado' }];
    state.orders.push(cloned);
    saveState();
    renderOrders();
    renderDashboard();
    showToast(`Encargo duplicado con éxito`, 'success');
}

function showOrderHistory(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const list = document.getElementById('order-history-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (!o.changelog || o.changelog.length === 0) {
        list.innerHTML = '<p class="text-muted text-sm p-3">No hay registros de cambios para este encargo.</p>';
    } else {
        o.changelog.forEach(c => {
            const div = document.createElement('div');
            div.className = 'p-3 mb-2 rounded bg-dark border border-secondary';
            div.innerHTML = `
                <div class="d-flex justify-content-between text-xs text-muted mb-1">
                    <span>${new Date(c.date).toLocaleString()}</span>
                    <span class="badge bg-secondary">${escapeHtml(c.to)}</span>
                </div>
                <div class="text-sm">${escapeHtml(c.note || 'Cambio de estado')} (${escapeHtml(c.from)} &rarr; ${escapeHtml(c.to)})</div>
            `;
            list.appendChild(div);
        });
    }
    openModal('modal-order-history');
}

function openInvoiceModal(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    
    const fil = state.filaments.find(f => f.id === o.filamentId);
    const filName = fil ? `${fil.brand} ${fil.material} (${fil.colorName})` : 'PLA+ Premium';
    
    const subtotal = parseFloat(o.price || 0) / 1.21;
    const tax = parseFloat(o.price || 0) - subtotal;

    document.getElementById('invoice-id').textContent = `FAC-${o.id.substring(0, 6).toUpperCase()}`;
    document.getElementById('invoice-date').textContent = new Date().toLocaleDateString();
    document.getElementById('invoice-client-name').textContent = o.client || 'Cliente General';
    document.getElementById('invoice-item-desc').textContent = o.title;
    document.getElementById('invoice-item-mat').textContent = filName;
    document.getElementById('invoice-item-info').textContent = `${o.weight || 0}g / ${o.time || 0}h`;
    document.getElementById('invoice-item-price').textContent = `${parseFloat(o.price || 0).toFixed(2)} €`;
    
    document.getElementById('invoice-subtotal').textContent = `${subtotal.toFixed(2)} €`;
    document.getElementById('invoice-tax').textContent = `${tax.toFixed(2)} €`;
    document.getElementById('invoice-total').textContent = `${parseFloat(o.price || 0).toFixed(2)} €`;
    
    openModal('modal-invoice');
}

function sendBudgetWhatsApp(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    
    const baseDate = o.date ? new Date(o.date) : new Date();
    const expiry = new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    const expiryFormatted = expiry.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const paymentText = typeof getPaymentLinksText === 'function' ? getPaymentLinksText(parseFloat(o.price || 0).toFixed(2), (o.id || '001').substring(0, 8).toUpperCase()) : '';

    const text = encodeURIComponent(
        `👋 ¡Hola ${o.client}!\n\n` +
        `Le enviamos el presupuesto formal para su encargo 3D:\n` +
        `📦 *Pieza:* ${o.title}\n` +
        `⚖️ *Peso:* ${o.weight}g\n` +
        `⏱️ *Tiempo estimado:* ${o.time}h\n` +
        `💶 *Total:* ${parseFloat(o.price).toFixed(2)} € (IVA incl.)\n` +
        `📅 *Validez comercial:* 15 días laborables (hasta el ${expiryFormatted}) sujeto a disponibilidad de máquinas.\n` +
        paymentText + `\n` +
        `¿Desea confirmarlo para comenzar con la impresión en el taller?\n¡Muchas gracias!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

function sendBudgetEmail(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const subject = encodeURIComponent(`Presupuesto Impresión 3D: ${o.title}`);
    const body = encodeURIComponent(
        `Estimado/a ${o.client},\n\nLe adjuntamos los detalles de su presupuesto:\nPieza: ${o.title}\nPeso: ${o.weight}g\nTiempo: ${o.time}h\nPrecio Total: ${parseFloat(o.price).toFixed(2)} €\n\nQuedamos a su disposición.\nUn saludo,\nPrint3D Studio`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// ==========================================================================
// 5. 3D Catalog Suite (Scales, Packs, Live Stock, PDF Export)
// ==========================================================================
let selectedCatalogCategory = 'ALL';
window._catalogPhotoData = null;
window._currentCatDetailId = null;
let currentDetailScale = 1.0;
let currentDetailQty = 1;

function filterCatalogCategory(cat) {
    selectedCatalogCategory = cat;
    document.querySelectorAll('#catalog-category-pills .cat-pill').forEach(btn => {
        const text = btn.textContent || '';
        if (cat === 'ALL' && text.includes('Todas')) {
            btn.classList.add('active');
        } else if (text.toLowerCase().includes(cat.toLowerCase().split(' ')[0])) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderCatalog();
}

function previewCatalogPhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        compressImage(file, 800, 0.75, function(compressedData) {
            window._catalogPhotoData = compressedData;
            const preview = document.getElementById('catalog-photo-preview');
            const wrap = document.getElementById('catalog-photo-preview-wrap');
            if (preview && wrap) {
                preview.src = compressedData;
                wrap.style.display = 'block';
            }
            showToast('📸 Foto de catálogo optimizada', 'info');
        });
    }
}

function openCatalogModal(id = null) {
    window._catalogPhotoData = null;
    const titleEl = document.getElementById('modal-catalog-title');
    const photoPreview = document.getElementById('catalog-photo-preview');
    const photoWrap = document.getElementById('catalog-photo-preview-wrap');
    const photoInput = document.getElementById('catalog-photo-input');
    if (photoInput) photoInput.value = '';

    if (id) {
        const item = state.catalog.find(c => c.id === id);
        if (!item) return;
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen text-primary"></i> Editar Modelo del Catálogo`;
        document.getElementById('catalog-id').value = item.id;
        document.getElementById('catalog-name').value = item.name || '';
        document.getElementById('catalog-category').value = item.category || 'Otros';
        document.getElementById('catalog-material').value = item.material || 'PLA+';
        document.getElementById('catalog-weight').value = item.weight || 100;
        document.getElementById('catalog-time').value = item.time || 5;
        document.getElementById('catalog-price').value = item.price || 25;
        document.getElementById('catalog-notes').value = item.notes || '';
        if (item.photo && photoPreview && photoWrap) {
            photoPreview.src = item.photo;
            photoWrap.style.display = 'block';
            window._catalogPhotoData = item.photo;
        } else if (photoWrap) {
            photoWrap.style.display = 'none';
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-cube text-primary"></i> Añadir Modelo al Catálogo`;
        document.getElementById('catalog-id').value = '';
        document.getElementById('catalog-name').value = '';
        document.getElementById('catalog-category').value = 'Figuras & Miniaturas';
        document.getElementById('catalog-material').value = 'PLA+';
        document.getElementById('catalog-weight').value = 120;
        document.getElementById('catalog-time').value = 4.5;
        document.getElementById('catalog-price').value = 22.00;
        document.getElementById('catalog-notes').value = '';
        if (photoWrap) photoWrap.style.display = 'none';
    }
    openModal('modal-catalog');
}

function saveCatalogItem() {
    const name = document.getElementById('catalog-name')?.value?.trim();
    if (!name) {
        showToast('Por favor introduce un nombre para el modelo', 'warning');
        return;
    }

    const id = document.getElementById('catalog-id')?.value || generateId();
    const category = document.getElementById('catalog-category')?.value || 'Otros';
    const material = document.getElementById('catalog-material')?.value || 'PLA+';
    const weight = parseFloat(document.getElementById('catalog-weight')?.value) || 0;
    const time = parseFloat(document.getElementById('catalog-time')?.value) || 0;
    const price = parseFloat(document.getElementById('catalog-price')?.value) || 0;
    const notes = document.getElementById('catalog-notes')?.value || '';
    
    let icon = 'fa-solid fa-cube';
    if (category.includes('Miniaturas') || category.includes('Figuras')) icon = 'fa-solid fa-dragon';
    else if (category.includes('Cosplay')) icon = 'fa-solid fa-mask';
    else if (category.includes('Mecánica')) icon = 'fa-solid fa-gear';
    else if (category.includes('Hogar') || category.includes('Decoración')) icon = 'fa-solid fa-leaf';
    else if (category.includes('Litofan')) icon = 'fa-solid fa-lightbulb';

    const existingIdx = state.catalog.findIndex(c => c.id === id);
    const existing = existingIdx >= 0 ? state.catalog[existingIdx] : null;

    const item = {
        id,
        name,
        category,
        material,
        weight,
        time,
        price,
        notes,
        icon: existing?.icon || icon,
        photo: window._catalogPhotoData !== null ? window._catalogPhotoData : (existing?.photo || null)
    };

    if (existingIdx >= 0) {
        state.catalog[existingIdx] = item;
        showToast(`Modelo "${name}" actualizado con éxito`, 'success');
    } else {
        state.catalog.push(item);
        showToast(`Modelo "${name}" añadido al catálogo`, 'success');
    }

    saveState();
    renderCatalog();
    closeModal('modal-catalog');
}

function deleteCatalogItem(id) {
    const item = state.catalog.find(c => c.id === id);
    if (!item) return;
    if (confirm(`¿Eliminar el modelo "${item.name}" del catálogo?`)) {
        state.catalog = state.catalog.filter(c => c.id !== id);
        saveState();
        renderCatalog();
        showToast(`Modelo eliminado del catálogo`, 'info');
    }
}

function duplicateCatalogItem(id) {
    const item = state.catalog.find(c => c.id === id);
    if (!item) return;
    const copy = JSON.parse(JSON.stringify(item));
    copy.id = generateId();
    copy.name = `${item.name} (Copia)`;
    state.catalog.push(copy);
    saveState();
    renderCatalog();
    showToast(`Modelo "${copy.name}" duplicado con éxito`, 'success');
}

function openCatalogDetail(id) {
    window._currentCatDetailId = id;
    currentDetailScale = 1.0;
    currentDetailQty = 1;

    const item = state.catalog.find(c => c.id === id);
    if (!item) return;

    const titleEl = document.getElementById('cat-detail-title');
    const catBadge = document.getElementById('cat-detail-category');
    if (titleEl) titleEl.textContent = item.name;
    if (catBadge) catBadge.textContent = item.category || 'General';

    renderCatalogDetailBody();
    openModal('modal-catalog-detail');
}

function setCatalogScale(scale) {
    currentDetailScale = parseFloat(scale);
    document.querySelectorAll('.scale-pill').forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.scale) === currentDetailScale);
    });
    renderCatalogDetailBody();
}

function setCatalogPackQty(qty) {
    currentDetailQty = parseInt(qty, 10);
    document.querySelectorAll('.pack-pill').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.qty, 10) === currentDetailQty);
    });
    renderCatalogDetailBody();
}

function renderCatalogDetailBody() {
    const body = document.getElementById('cat-detail-body');
    if (!body || !window._currentCatDetailId) return;

    const c = state.catalog.find(x => x.id === window._currentCatDetailId);
    if (!c) return;

    const scale = currentDetailScale || 1.0;
    const qty = currentDetailQty || 1;

    const scaledWeight = Math.round((c.weight || 0) * Math.pow(scale, 3));
    const scaledTime = parseFloat(((c.time || 0) * Math.pow(scale, 2.2)).toFixed(1));
    const baseScaledUnitPrice = (c.price || 0) * Math.pow(scale, 2.5);

    let discountPct = 0;
    if (qty >= 25) discountPct = 20;
    else if (qty >= 10) discountPct = 15;
    else if (qty >= 5) discountPct = 10;
    else if (qty >= 3) discountPct = 5;

    const unitPrice = baseScaledUnitPrice * (1 - discountPct / 100);
    const totalPrice = unitPrice * qty;
    const totalWeight = scaledWeight * qty;
    const totalTime = parseFloat((scaledTime * qty).toFixed(1));

    const filCostKg = 20;
    const electricityKwh = 0.18;
    const powerKw = 0.25;

    const unitFilCost = (scaledWeight / 1000) * filCostKg;
    const unitElecCost = scaledTime * powerKw * electricityKwh;
    const unitWearCost = scaledTime * 0.15;
    const unitProductionCost = unitFilCost + unitElecCost + unitWearCost;

    const totalProductionCost = unitProductionCost * qty;
    const netProfit = totalPrice - totalProductionCost;
    const profitMargin = totalPrice > 0 ? ((netProfit / totalPrice) * 100).toFixed(1) : 0;

    let availableStockGrams = 0;
    state.filaments.forEach(f => {
        if (!c.material || f.material.toLowerCase().includes(c.material.toLowerCase().split(' ')[0])) {
            availableStockGrams += (f.currentWeight || 0);
        }
    });

    const hasEnoughStock = availableStockGrams >= totalWeight;
    const stockPct = Math.min(100, Math.round((availableStockGrams / (totalWeight || 1)) * 100));

    body.innerHTML = `
        <div class="grid-2" style="gap: 20px; align-items: stretch;">
            <div>
                <div style="width: 100%; height: 260px; border-radius: 14px; overflow: hidden; background: #080d1a; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; position: relative;">
                    ${c.photo ? 
                        `<img src="${c.photo}" style="width: 100%; height: 100%; object-fit: cover;">` :
                        `<div class="text-center p-4">
                            <i class="${c.icon || 'fa-solid fa-cube'}" style="font-size: 5rem; color: #00d2ff; opacity: 0.85;"></i>
                            <div class="mt-2 text-xs text-dim">Sin fotografía adjunta</div>
                         </div>`
                    }
                    <span class="badge" style="position: absolute; top: 12px; left: 12px; background: rgba(0,210,255,0.2); color:#00d2ff; border: 1px solid rgba(0,210,255,0.4); font-size: 11px;">${escapeHtml(c.material || 'PLA+')}</span>
                </div>

                <div class="p-3 mt-3 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); font-size: 12px;">
                    <div class="fw-bold mb-1 text-white"><i class="fa-solid fa-circle-info text-cyan"></i> Notas Técnicas de Laminación:</div>
                    <div class="text-dim">${escapeHtml(c.notes || 'Configuración estándar: altura de capa 0.20mm, 3 perímetros, relleno giroide.')}</div>
                </div>

                <div class="stock-check-box mt-3">
                    <div>
                        <div class="fw-bold ${hasEnoughStock ? 'text-emerald' : 'text-danger'}">
                            <i class="fa-solid ${hasEnoughStock ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> 
                            ${hasEnoughStock ? 'Stock de Filamento Disponible' : 'Stock Insuficiente en Taller'}
                        </div>
                        <div class="text-xs text-dim mt-1">Requerido: <strong>${totalWeight}g</strong> | Disponible: <strong>${availableStockGrams}g</strong></div>
                    </div>
                    <span class="badge ${hasEnoughStock ? 'bg-success' : 'bg-danger'}">${stockPct}%</span>
                </div>
            </div>

            <div>
                <div class="mb-3">
                    <label class="form-label text-xs text-dim mb-1"><i class="fa-solid fa-up-right-and-down-left-from-center text-cyan"></i> Escala del Modelo 3D:</label>
                    <div class="scale-selector-pills">
                        <button class="scale-pill ${scale === 0.5 ? 'active' : ''}" data-scale="0.5" onclick="setCatalogScale(0.5)">50% (Mini)</button>
                        <button class="scale-pill ${scale === 0.75 ? 'active' : ''}" data-scale="0.75" onclick="setCatalogScale(0.75)">75%</button>
                        <button class="scale-pill ${scale === 1.0 ? 'active' : ''}" data-scale="1.0" onclick="setCatalogScale(1.0)">100% (Real)</button>
                        <button class="scale-pill ${scale === 1.25 ? 'active' : ''}" data-scale="1.25" onclick="setCatalogScale(1.25)">125%</button>
                        <button class="scale-pill ${scale === 1.5 ? 'active' : ''}" data-scale="1.5" onclick="setCatalogScale(1.5)">150% (Maxi)</button>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label text-xs text-dim mb-1"><i class="fa-solid fa-boxes-stacked text-amber"></i> Lote / Cantidad con Descuento por Volumen:</label>
                    <div class="pack-selector-pills">
                        <button class="pack-pill ${qty === 1 ? 'active' : ''}" data-qty="1" onclick="setCatalogPackQty(1)">1 ud</button>
                        <button class="pack-pill ${qty === 3 ? 'active' : ''}" data-qty="3" onclick="setCatalogPackQty(3)">Pack 3 (-5%)</button>
                        <button class="pack-pill ${qty === 5 ? 'active' : ''}" data-qty="5" onclick="setCatalogPackQty(5)">Pack 5 (-10%)</button>
                        <button class="pack-pill ${qty === 10 ? 'active' : ''}" data-qty="10" onclick="setCatalogPackQty(10)">Pack 10 (-15%)</button>
                        <button class="pack-pill ${qty === 25 ? 'active' : ''}" data-qty="25" onclick="setCatalogPackQty(25)">Pack 25 (-20%)</button>
                    </div>
                </div>

                <div class="p-3 rounded mb-3" style="background: rgba(0, 210, 255, 0.05); border: 1px solid rgba(0, 210, 255, 0.15);">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-xs text-dim">Tiempo estimado total:</span>
                        <span class="fw-bold text-cyan"><i class="fa-solid fa-clock"></i> ${totalTime} h</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-xs text-dim">Material total necesario:</span>
                        <span class="fw-bold text-amber"><i class="fa-solid fa-weight-scale"></i> ${totalWeight} g</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-xs text-dim">Coste Producción (Luz + Material + Desgaste):</span>
                        <span class="text-xs fw-bold text-dim">${totalProductionCost.toFixed(2)} €</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
                        <span class="text-xs text-emerald fw-bold">Beneficio Neto Estimado:</span>
                        <span class="fw-bold text-emerald">+${netProfit.toFixed(2)} € (${profitMargin}% margen)</span>
                    </div>
                </div>

                <div class="p-3 rounded mb-3 text-center" style="background: linear-gradient(135deg, rgba(52,211,153,0.15), rgba(0,210,255,0.1)); border: 1px solid rgba(52,211,153,0.3);">
                    <div class="text-xs text-dim text-uppercase" style="letter-spacing:1px;">Precio Total a Presupuestar</div>
                    <div class="fw-bold text-emerald my-1" style="font-size: 2rem; font-family:'Outfit',sans-serif;">${totalPrice.toFixed(2)} €</div>
                    ${qty > 1 ? `<div class="text-xs text-dim">(${unitPrice.toFixed(2)} € / ud con ${discountPct}% dto. por lote)</div>` : ''}
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn btn-success w-100" onclick="orderDirectCatalogBatch()">
                        <i class="fa-solid fa-cart-plus mr-1"></i> Lanzar Encargo (${qty} uds • ${totalPrice.toFixed(2)} €)
                    </button>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-outline btn-sm w-100 text-emerald" onclick="shareCatalogWhatsApp()">
                            <i class="fa-brands fa-whatsapp"></i> Enviar por WhatsApp
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="duplicateCatalogItem('${c.id}'); closeModal('modal-catalog-detail');" title="Clonar">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function orderDirectCatalogBatch() {
    const c = state.catalog.find(x => x.id === window._currentCatDetailId);
    if (!c) return;

    const scale = currentDetailScale || 1.0;
    const qty = currentDetailQty || 1;

    const scaledWeight = Math.round((c.weight || 0) * Math.pow(scale, 3) * qty);
    const scaledTime = parseFloat(((c.time || 0) * Math.pow(scale, 2.2) * qty).toFixed(1));

    let discountPct = 0;
    if (qty >= 25) discountPct = 20;
    else if (qty >= 10) discountPct = 15;
    else if (qty >= 5) discountPct = 10;
    else if (qty >= 3) discountPct = 5;

    const unitPrice = (c.price || 0) * Math.pow(scale, 2.5) * (1 - discountPct / 100);
    const totalPrice = parseFloat((unitPrice * qty).toFixed(2));

    closeModal('modal-catalog-detail');
    switchTab('tab-orders');
    openOrderModalWithDefaults();

    setTimeout(() => {
        const itemInput = document.getElementById('order-item');
        const weightInput = document.getElementById('order-weight');
        const timeInput = document.getElementById('order-time');
        const priceInput = document.getElementById('order-price');

        const titleText = qty > 1 ? 
            `${c.name} [Lote x${qty}] (Escala ${Math.round(scale * 100)}%)` :
            (scale !== 1.0 ? `${c.name} (Escala ${Math.round(scale * 100)}%)` : c.name);

        if (itemInput) itemInput.value = titleText;
        if (weightInput) weightInput.value = scaledWeight;
        if (timeInput) timeInput.value = scaledTime;
        if (priceInput) priceInput.value = totalPrice;

        if (c.material && state.filaments.length > 0) {
            const match = state.filaments.find(f => f.material.toLowerCase().includes(c.material.toLowerCase().split(' ')[0]));
            if (match) selectPicker('order-filament', match.id);
        }

        if (c.photo) {
            window._orderPhotoData = c.photo;
            const prev = document.getElementById('order-photo-preview');
            if (prev) {
                prev.src = c.photo;
                prev.style.display = 'block';
            }
        }

        showToast(`Datos del modelo "${c.name}" cargados en el encargo`, 'info');
    }, 60);
}

function shareCatalogWhatsApp() {
    const c = state.catalog.find(x => x.id === window._currentCatDetailId);
    if (!c) return;

    const scale = currentDetailScale || 1.0;
    const qty = currentDetailQty || 1;

    let discountPct = 0;
    if (qty >= 25) discountPct = 20;
    else if (qty >= 10) discountPct = 15;
    else if (qty >= 5) discountPct = 10;
    else if (qty >= 3) discountPct = 5;

    const unitPrice = (c.price || 0) * Math.pow(scale, 2.5) * (1 - discountPct / 100);
    const totalPrice = parseFloat((unitPrice * qty).toFixed(2));
    const totalWeight = Math.round((c.weight || 0) * Math.pow(scale, 3) * qty);
    const totalTime = parseFloat(((c.time || 0) * Math.pow(scale, 2.2) * qty).toFixed(1));

    const msg = encodeURIComponent(
        `✨ *Catálogo Print3D Studio* ✨\n\n📋 *Modelo:* ${c.name}\n🏷️ *Categoría:* ${c.category || 'General'}\n🧵 *Material:* ${c.material || 'PLA+'}\n📏 *Escala:* ${Math.round(scale * 100)}%\n📦 *Cantidad:* ${qty} ud(s)\n⏱️ *Tiempo total:* ${totalTime} h\n⚖️ *Peso total:* ${totalWeight} g\n\n💶 *Presupuesto Total:* *${totalPrice.toFixed(2)} €* (IVA incl.)\n\n¿Desea formalizar este pedido? ¡Respondemos al instante!`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function exportCatalogPDF() {
    window.print();
}

function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    const countAll = document.getElementById('cat-count-all');
    if (countAll) countAll.textContent = state.catalog.length;

    const statTotal = document.getElementById('cat-stat-total');
    const statAvgPrice = document.getElementById('cat-stat-avg-price');
    const statAvgMargin = document.getElementById('cat-stat-avg-margin');
    const statAvgTime = document.getElementById('cat-stat-avg-time');

    if (state.catalog.length > 0) {
        const avgPrice = state.catalog.reduce((s, c) => s + (parseFloat(c.price) || 0), 0) / state.catalog.length;
        const avgTime = state.catalog.reduce((s, c) => s + (parseFloat(c.time) || 0), 0) / state.catalog.length;
        
        let totalEstCost = 0;
        state.catalog.forEach(c => {
            const filCost = ((c.weight || 0) / 1000) * 20;
            const elecCost = (c.time || 0) * 0.25 * 0.18;
            totalEstCost += (filCost + elecCost);
        });
        const totalRev = state.catalog.reduce((s, c) => s + (parseFloat(c.price) || 0), 0);
        const avgMargin = totalRev > 0 ? (((totalRev - totalEstCost) / totalRev) * 100).toFixed(0) : 0;

        if (statTotal) statTotal.textContent = state.catalog.length;
        if (statAvgPrice) statAvgPrice.textContent = `${avgPrice.toFixed(2)} €`;
        if (statAvgMargin) statAvgMargin.textContent = `+${avgMargin}%`;
        if (statAvgTime) statAvgTime.textContent = `${avgTime.toFixed(1)}h`;
    }

    const searchTerm = (document.getElementById('filter-catalog-search')?.value || '').toLowerCase();
    const items = state.catalog.filter(c => {
        const matchesCategory = (selectedCatalogCategory === 'ALL' || c.category === selectedCatalogCategory);
        const matchesSearch = !searchTerm || 
            (c.name && c.name.toLowerCase().includes(searchTerm)) || 
            (c.material && c.material.toLowerCase().includes(searchTerm)) ||
            (c.notes && c.notes.toLowerCase().includes(searchTerm));
        return matchesCategory && matchesSearch;
    });

    grid.innerHTML = '';
    
    if (items.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: var(--text-dim);">
                <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;"></i>
                <h4>No se encontraron modelos</h4>
                <p style="font-size: 13px;">Prueba a cambiar el filtro de categoría o pulsa en "Añadir Modelo".</p>
                <button class="btn btn-primary btn-sm mt-2" onclick="openCatalogModal()"><i class="fa-solid fa-plus"></i> Crear Nuevo Modelo</button>
            </div>
        `;
        return;
    }

    items.forEach(c => {
        const estCostFilament = ((c.weight || 0) / 1000) * 20;
        const estCostPower = (c.time || 0) * 0.25 * 0.18;
        const estCostTotal = estCostFilament + estCostPower;
        const marginPct = (c.price || 0) > 0 ? (((c.price - estCostTotal) / c.price) * 100).toFixed(0) : 0;
        const marginColorClass = marginPct >= 60 ? 'text-emerald' : (marginPct >= 40 ? 'text-amber' : 'text-danger');

        const div = document.createElement('div');
        div.className = 'catalog-card';
        div.innerHTML = `
            <div>
                <div class="catalog-img-wrap" onclick="openCatalogDetail('${c.id}')" title="Clic para ver ficha interactiva">
                    ${c.photo ? 
                        `<img src="${c.photo}" alt="${escapeHtml(c.name)}">` : 
                        `<i class="${c.icon || 'fa-solid fa-cube'} catalog-fallback-icon"></i>`
                    }
                    <span class="catalog-cat-badge">${escapeHtml(c.category || 'General')}</span>
                </div>

                <div style="margin-top: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        <h3 onclick="openCatalogDetail('${c.id}')" style="cursor:pointer;" title="Ver detalles">${escapeHtml(c.name)}</h3>
                        <span class="badge" style="background: rgba(0,210,255,0.12); color:#00d2ff; font-size:10px;">${escapeHtml(c.material || 'PLA')}</span>
                    </div>
                    ${c.notes ? `<p style="font-size: 11.5px; color: var(--text-dim); margin: 6px 0 0; line-height: 1.3;">${escapeHtml(c.notes)}</p>` : ''}
                </div>
            </div>

            <div>
                <div class="catalog-specs-row my-2">
                    <div class="catalog-spec-item">
                        <span class="catalog-spec-label"><i class="fa-solid fa-clock"></i> Tiempo</span>
                        <span class="catalog-spec-val">${c.time || 0}h</span>
                    </div>
                    <div class="catalog-spec-item">
                        <span class="catalog-spec-label"><i class="fa-solid fa-weight-scale"></i> Peso</span>
                        <span class="catalog-spec-val">${c.weight || 0}g</span>
                    </div>
                    <div class="catalog-spec-item">
                        <span class="catalog-spec-label"><i class="fa-solid fa-coins"></i> Coste Fab.</span>
                        <span class="catalog-spec-val">~${estCostTotal.toFixed(1)}€</span>
                    </div>
                </div>

                <div class="catalog-pricing-row mb-3">
                    <div>
                        <div class="catalog-price-val">${parseFloat(c.price || 0).toFixed(2)} €</div>
                    </div>
                    <span class="catalog-margin-pill ${marginColorClass}">+${marginPct}% margen</span>
                </div>

                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-success btn-sm" style="flex: 1;" onclick="openCatalogDetail('${c.id}')" title="Configurar escala, packs y lanzar encargo">
                        <i class="fa-solid fa-sliders"></i> Configurar / Pedir
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="duplicateCatalogItem('${c.id}')" title="Duplicar modelo">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="openCatalogModal('${c.id}')" title="Editar modelo">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline btn-sm text-danger" onclick="deleteCatalogItem('${c.id}')" title="Eliminar modelo">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
}

function createOrderFromCatalog(id) {
    openCatalogDetail(id);
}

// ==========================================================================
// 6. CRM, Filaments, Printers (with Financial Profile) & Expenses
// ==========================================================================
function renderCRM() {
    const grid = document.getElementById('crm-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    state.clients.forEach(c => {
        const clientOrders = state.orders.filter(o => o.client && o.client.toLowerCase() === c.name.toLowerCase());
        const ordersCount = clientOrders.length || c.ordersCount || 0;
        const totalSpent = clientOrders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0) || c.totalSpent || 0;

        let totalClientEstCost = 0;
        clientOrders.forEach(o => {
            const filCost = ((o.weight || 0) / 1000) * 20;
            const powerCost = (o.time || 0) * 0.25 * 0.18;
            totalClientEstCost += (filCost + powerCost);
        });
        const clientProfit = totalSpent - totalClientEstCost;
        const clientMargin = totalSpent > 0 ? ((clientProfit / totalSpent) * 100).toFixed(0) : 0;

        const div = document.createElement('div');
        div.className = 'crm-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h3>${escapeHtml(c.name)}</h3>
                <span class="badge ${getBadgeClass(c.status)}">${escapeHtml(c.status || 'Regular')}</span>
            </div>
            <p class="text-xs text-muted mt-1"><i class="fa-solid fa-envelope"></i> ${escapeHtml(c.email || 'Sin email')}</p>
            <p class="text-xs text-muted"><i class="fa-solid fa-phone"></i> ${escapeHtml(c.phone || 'Sin teléfono')}</p>
            
            <div class="p-2 mt-2 rounded bg-dark border border-secondary" style="font-size:11.5px;">
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-muted">Encargos realizados:</span>
                    <strong>${ordersCount}</strong>
                </div>
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-muted">Gasto acumulado:</span>
                    <strong class="text-emerald">${totalSpent.toFixed(2)} €</strong>
                </div>
                <div class="d-flex justify-content-between">
                    <span class="text-muted">Rentabilidad taller:</span>
                    <strong class="text-cyan">+${clientMargin}%</strong>
                </div>
            </div>

            <div class="mt-3" style="display:flex; gap:6px;">
                <button class="btn btn-outline btn-sm w-100" onclick="filterOrdersByClient('${escapeHtml(c.name)}')">
                    <i class="fa-solid fa-list-check"></i> Ver Encargos
                </button>
                <button class="btn btn-outline btn-sm text-emerald" onclick="window.open('https://wa.me/?text=Hola%20${encodeURIComponent(c.name)}', '_blank')" title="WhatsApp">
                    <i class="fa-brands fa-whatsapp"></i>
                </button>
            </div>
        `;
        grid.appendChild(div);
    });
}

function filterOrdersByClient(clientName) {
    switchTab('tab-orders');
    const search = document.getElementById('filter-orders-search');
    if (search) {
        search.value = clientName;
        renderOrders();
    }
}

function renderFilaments() {
    const grid = document.getElementById('filaments-grid');
    if (!grid) return;
    
    const searchTerm = (document.getElementById('filter-filament-search')?.value || '').toLowerCase();
    const filaments = state.filaments.filter(f => 
        !searchTerm || 
        (f.brand && f.brand.toLowerCase().includes(searchTerm)) || 
        (f.material && f.material.toLowerCase().includes(searchTerm)) ||
        (f.colorName && f.colorName.toLowerCase().includes(searchTerm))
    );
    
    grid.innerHTML = '';
    filaments.forEach(f => {
        const percentage = Math.max(0, Math.min(100, Math.round(((f.currentWeight || 0) / (f.maxWeight || 1000)) * 100)));
        const isLow = percentage < 20;

        let pColor = '#10b981';
        if (percentage < 35) pColor = '#f59e0b';
        if (percentage < 15) pColor = '#ef4444';

        const div = document.createElement('div');
        div.className = 'filament-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="color-swatch" style="background-color: ${f.hex}; border: 1px solid rgba(255,255,255,0.2);"></div>
                    <div>
                        <h3 style="margin:0; font-size:15px;">${escapeHtml(f.brand)} ${escapeHtml(f.material)}</h3>
                        <div class="text-xs text-muted">${escapeHtml(f.colorName)}</div>
                    </div>
                </div>
                ${isLow ? '<span class="badge bg-danger">⚠️ Stock Bajo</span>' : ''}
            </div>

            <div class="progress-bar mt-3" style="height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
                <div class="progress-fill" style="width: ${percentage}%; background-color: ${pColor}; height:100%;"></div>
            </div>
            
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:6px; color:var(--text-dim);">
                <span>Restante: <strong>${f.currentWeight}g</strong> / ${f.maxWeight}g</span>
                <span class="fw-bold">${percentage}%</span>
            </div>

            <div class="mt-2 text-xs text-muted">Coste: <strong>${parseFloat(f.costPerKg || 0).toFixed(2)} €/kg</strong></div>

            <div class="d-flex gap-2 mt-3">
                <button class="btn btn-outline btn-sm w-100" onclick="editFilament('${f.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
                <button class="btn btn-outline btn-sm text-cyan" onclick="openSpoolScaleModal('${f.id}')" title="Pesar en Báscula (Restar Tara)"><i class="fa-solid fa-weight-scale"></i></button>
                <button class="btn btn-outline btn-sm" onclick="openLabelModal('filament', '${f.id}')" title="Etiqueta QR"><i class="fa-solid fa-tag"></i></button>
                <button class="btn btn-outline btn-sm text-danger" onclick="deleteFilament('${f.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        grid.appendChild(div);
    });

    renderFilamentPurchasesSummary();
}

function openFilamentComparator() {
    const tbody = document.getElementById('filament-compare-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const recTemps = {
        'PLA': '195 - 215°C (Cama 50-60°C)',
        'PLA+': '205 - 225°C (Cama 55-65°C)',
        'PETG': '230 - 250°C (Cama 70-85°C)',
        'ABS': '240 - 260°C (Cama 95-110°C)',
        'ASA': '245 - 265°C (Cama 95-110°C)',
        'TPU': '210 - 230°C (Cama 40-50°C)',
        'Resina': 'Exposición 2.2 - 2.8s / capa'
    };

    state.filaments.forEach(f => {
        const pct = Math.round(((f.currentWeight || 0) / (f.maxWeight || 1000)) * 100);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="color-swatch" style="background-color: ${f.hex}; border:1px solid #666;"></div> ${escapeHtml(f.colorName)}</td>
            <td><strong>${escapeHtml(f.brand)}</strong> ${escapeHtml(f.material)}</td>
            <td>${f.currentWeight}g (${pct}%)</td>
            <td class="fw-bold text-emerald">${parseFloat(f.costPerKg || 0).toFixed(2)} €</td>
            <td class="text-xs text-cyan">${recTemps[f.material] || '200 - 220°C'}</td>
        `;
        tbody.appendChild(tr);
    });

    openModal('modal-filament-compare');
}

function renderPrinters() {
    const grid = document.getElementById('printers-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    state.printers.forEach(p => {
        const hours = p.hours || 0;
        const nozzleLimit = 300;
        const nozzleHours = p.nozzleHours || 0;
        const nozzlePct = Math.min(100, Math.round((nozzleHours / nozzleLimit) * 100));
        let nozzleColor = '#10b981';
        if (nozzlePct > 70) nozzleColor = '#f59e0b';
        if (nozzlePct > 90) nozzleColor = '#ef4444';

        const printerOrders = state.orders.filter(o => o.printerId === p.id);
        const totalRev = printerOrders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);

        const div = document.createElement('div');
        div.className = 'printer-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h3><i class="fa-solid fa-print text-cyan mr-1"></i> ${escapeHtml(p.name)}</h3>
                <span class="badge ${p.status === 'Printing' ? 'bg-primary' : 'bg-secondary'}">${p.status}</span>
            </div>
            
            <div class="text-xs text-muted mt-1">
                <span>Tecnología: <strong>${p.tech}</strong></span> | 
                <span>Boquilla: <strong>${p.nozzle}mm</strong></span>
            </div>

            <div class="p-2 mt-2 rounded bg-dark border border-secondary" style="font-size:11.5px;">
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-muted">Horas de trabajo:</span>
                    <strong>${hours.toFixed(1)} h</strong>
                </div>
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-muted">Facturado con esta máquina:</span>
                    <strong class="text-emerald">${totalRev.toFixed(2)} €</strong>
                </div>
                <div class="d-flex justify-content-between">
                    <span class="text-muted">Potencia / Consumo:</span>
                    <span>${p.power}W (~${parseFloat(p.wear || 0.15).toFixed(2)} €/h)</span>
                </div>
            </div>

            <!-- Nozzle life indicator -->
            <div class="mt-3">
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
                    <span class="text-dim"><i class="fa-solid fa-circle-notch"></i> Vida Boquilla (${nozzleHours.toFixed(0)}h / ${nozzleLimit}h)</span>
                    <button class="btn-xs btn-outline" onclick="resetNozzle('${p.id}')" title="Reiniciar contador de boquilla"><i class="fa-solid fa-arrows-rotate"></i> Nueva</button>
                </div>
                <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                    <div style="width:${nozzlePct}%; background-color:${nozzleColor}; height:100%;"></div>
                </div>
            </div>

            <!-- Retorno de Inversión (ROI) y Amortización -->
            ${(() => {
                const purchasePrice = parseFloat(p.purchasePrice || 0);
                if (purchasePrice > 0) {
                    const roiPct = Math.round((totalRev / purchasePrice) * 100);
                    const isAmortized = totalRev >= purchasePrice;
                    const diff = totalRev - purchasePrice;
                    return `
                        <div class="p-2 mt-2 rounded" style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.25);">
                            <div class="d-flex justify-content-between align-items-center mb-1" style="font-size:11px;">
                                <span class="text-white"><i class="fa-solid fa-coins text-amber mr-1"></i> Amortización / ROI:</span>
                                <span class="fw-bold ${isAmortized ? 'text-emerald' : 'text-cyan'}">${roiPct}% amortizada</span>
                            </div>
                            <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                                <div style="width:${Math.min(100, roiPct)}%; background:${isAmortized ? '#10b981' : '#00d2ff'}; height:100%;"></div>
                            </div>
                            <div class="d-flex justify-content-between text-muted mt-1" style="font-size:10.5px;">
                                <span>Compra: <strong>${purchasePrice.toFixed(0)} €</strong></span>
                                <span>${isAmortized ? `<strong class="text-emerald">+${diff.toFixed(2)} € ganancia</strong>` : `Faltan <strong>${Math.abs(diff).toFixed(2)} €</strong>`}</span>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="p-2 mt-2 rounded" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); font-size:11px; display:flex; justify-content:space-between; align-items:center;">
                            <span class="text-muted"><i class="fa-solid fa-coins text-dim mr-1"></i> Coste de compra sin fijar</span>
                            <button class="btn-xs btn-outline" onclick="editPrinter('${p.id}')">Fijar coste</button>
                        </div>
                    `;
                }
            })()}

            <!-- Salud de Mantenimiento Preventivo (Ciclos 150h, 300h, 500h) -->
            ${(() => {
                const cleanElapsed = Math.max(0, hours - (p.lastCleanHours || 0));
                const lubeElapsed = Math.max(0, hours - (p.lastLubeHours || 0));
                const beltElapsed = Math.max(0, hours - (p.lastBeltHours || 0));
                const isOverdue = cleanElapsed >= 150 || lubeElapsed >= 300 || beltElapsed >= 500;
                return `
                    <div class="p-2 mt-2 rounded" style="background: ${isOverdue ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)'}; font-size:11px;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="${isOverdue ? 'text-danger fw-bold' : 'text-muted'}"><i class="fa-solid fa-wrench mr-1"></i> Mantenimiento:</span>
                            <button class="btn-xs btn-outline ${isOverdue ? 'text-danger' : 'text-cyan'}" onclick="openMaintenanceCheckModal('${p.id}')">
                                <i class="fa-solid fa-clipboard-check"></i> ${isOverdue ? '⚠️ Revisar' : 'Poner al día'}
                            </button>
                        </div>
                        <div class="d-flex justify-content-between text-muted" style="font-size:10px;">
                            <span title="Ciclo 150h: ventiladores y extrusor">🧹 Limpieza: <strong class="${cleanElapsed >= 150 ? 'text-danger' : 'text-white'}">${cleanElapsed.toFixed(0)}/150h</strong></span>
                            <span title="Ciclo 300h: engrase varillas Z">🛢️ Engrase: <strong class="${lubeElapsed >= 300 ? 'text-danger' : 'text-white'}">${lubeElapsed.toFixed(0)}/300h</strong></span>
                            <span title="Ciclo 500h: correas y bowden">⚙️ Correas: <strong class="${beltElapsed >= 500 ? 'text-danger' : 'text-white'}">${beltElapsed.toFixed(0)}/500h</strong></span>
                        </div>
                    </div>
                `;
            })()}

            <div style="display:flex; gap:6px; margin-top:14px;">
                <button class="btn btn-outline btn-sm w-100 text-cyan" onclick="openPrinterProfile('${p.id}')">
                    <i class="fa-solid fa-chart-column"></i> Perfil & Beneficio
                </button>
                <button class="btn btn-outline btn-sm" onclick="editPrinter('${p.id}')" title="Configurar"><i class="fa-solid fa-gear"></i></button>
                <button class="btn btn-outline btn-sm text-danger" onclick="deletePrinter('${p.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        grid.appendChild(div);
    });
}

function openPrinterProfile(id) {
    const p = state.printers.find(x => x.id === id);
    if (!p) return;

    const titleEl = document.getElementById('printer-profile-title');
    const body = document.getElementById('printer-profile-body');
    if (!body) return;
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-chart-column text-cyan"></i> Perfil Financiero: ${escapeHtml(p.name)}`;

    const printerOrders = state.orders.filter(o => o.printerId === p.id);
    const totalRevenue = printerOrders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
    const totalHoursWorked = printerOrders.reduce((s, o) => s + (parseFloat(o.time) || 0), 0);

    const purchasePrice = parseFloat(p.purchasePrice || 0);
    const amortMonths = parseInt(p.amortMonths || 36, 10);
    const fixedMonthly = parseFloat(p.fixedCostMonth || 0);
    const kwhPrice = parseFloat(p.kwhPrice || 0.18);
    const powerKw = (parseFloat(p.power || 250)) / 1000;
    const wearPerHour = parseFloat(p.wear || 0.15);

    const electricCost = totalHoursWorked * powerKw * kwhPrice;
    const wearCost = totalHoursWorked * wearPerHour;
    
    let filCost = 0;
    printerOrders.forEach(o => {
        filCost += ((parseFloat(o.weight || 0) / 1000) * 20);
    });

    const totalOperationalCost = electricCost + wearCost + filCost;
    const grossProfit = totalRevenue - totalOperationalCost;
    const amortRecovered = Math.min(purchasePrice, Math.max(0, grossProfit));
    const isAmortized = purchasePrice > 0 ? (grossProfit >= purchasePrice) : true;
    const netProfitAfterMachine = purchasePrice > 0 ? (grossProfit - purchasePrice) : grossProfit;

    body.innerHTML = `
        <div class="grid-3 mb-3" style="gap:10px;">
            <div class="p-3 rounded text-center bg-dark border border-secondary">
                <div class="text-xs text-muted">Ingresos Generados</div>
                <div class="text-lg fw-bold text-emerald">${totalRevenue.toFixed(2)} €</div>
            </div>
            <div class="p-3 rounded text-center bg-dark border border-secondary">
                <div class="text-xs text-muted">Costes Operativos</div>
                <div class="text-lg fw-bold text-danger">${totalOperationalCost.toFixed(2)} €</div>
            </div>
            <div class="p-3 rounded text-center bg-dark border border-secondary">
                <div class="text-xs text-muted">Beneficio Bruto</div>
                <div class="text-lg fw-bold ${grossProfit >= 0 ? 'text-cyan' : 'text-danger'}">${grossProfit.toFixed(2)} €</div>
            </div>
        </div>

        <div class="p-3 rounded mb-3 bg-dark border border-secondary" style="font-size:12px;">
            <div class="fw-bold mb-2 text-white"><i class="fa-solid fa-calculator text-cyan"></i> Desglose de Gastos Acumulados:</div>
            <div class="d-flex justify-content-between mb-1">
                <span class="text-muted">⚡ Electricidad (${totalHoursWorked.toFixed(1)}h a ${(powerKw*1000).toFixed(0)}W):</span>
                <span>${electricCost.toFixed(2)} €</span>
            </div>
            <div class="d-flex justify-content-between mb-1">
                <span class="text-muted">🛠️ Desgaste mecánico (${wearPerHour}€/h):</span>
                <span>${wearCost.toFixed(2)} €</span>
            </div>
            <div class="d-flex justify-content-between mb-1">
                <span class="text-muted">🧵 Filamento transformado:</span>
                <span>${filCost.toFixed(2)} €</span>
            </div>
            <div class="d-flex justify-content-between pt-1 border-top border-secondary">
                <span class="text-muted">🏢 Mantenimiento fijo configurado:</span>
                <span>${fixedMonthly.toFixed(2)} € / mes</span>
            </div>
        </div>

        <div class="p-3 rounded bg-dark border border-secondary text-center" style="background:linear-gradient(135deg, rgba(0,210,255,0.08), rgba(16,185,129,0.08));">
            <div class="text-xs text-muted text-uppercase">Amortización de la Máquina (${purchasePrice.toFixed(2)} € en ${amortMonths} meses)</div>
            <div class="my-2">
                <div style="height:10px; background:#1e293b; border-radius:5px; overflow:hidden;">
                    <div style="width:${purchasePrice > 0 ? Math.min(100, (grossProfit / purchasePrice) * 100) : 100}%; background:#10b981; height:100%;"></div>
                </div>
            </div>
            <div class="fw-bold ${isAmortized ? 'text-emerald' : 'text-amber'}" style="font-size:14px;">
                ${isAmortized ? '🎉 Máquina Totalmente Amortizada y en Beneficio Neto Puro' : `Pendiente de amortizar: ${(purchasePrice - grossProfit).toFixed(2)} €`}
            </div>
            <div class="text-xs text-muted mt-1">Beneficio neto final descontando máquina: <strong class="${netProfitAfterMachine >= 0 ? 'text-emerald' : 'text-danger'}">${netProfitAfterMachine.toFixed(2)} €</strong></div>
        </div>
    `;

    openModal('modal-printer-profile');
}

function resetNozzle(id) {
    const p = state.printers.find(x => x.id === id);
    if (!p) return;
    p.nozzleHours = 0;
    saveState();
    renderPrinters();
    showToast(`Contador de boquilla reiniciado para ${p.name}`, 'success');
}

function renderExpenses() {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;
    
    const filterCat = document.getElementById('filter-expense-category')?.value;
    const expenses = state.expenses.filter(e => !filterCat || filterCat === 'ALL' || e.category === filterCat);
    
    // Financial calculations
    const totalExp = state.expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const filExp = state.expenses.filter(e => e.category === 'Filamento').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const pwrExp = state.expenses.filter(e => e.category === 'Electricidad').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const fixExp = state.expenses.filter(e => e.category !== 'Filamento' && e.category !== 'Electricidad').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    const kpiTot = document.getElementById('exp-kpi-total');
    if (kpiTot) kpiTot.textContent = `${totalExp.toFixed(2)} €`;
    const kpiFil = document.getElementById('exp-kpi-filament');
    if (kpiFil) kpiFil.textContent = `${filExp.toFixed(2)} €`;
    const kpiPwr = document.getElementById('exp-kpi-power');
    if (kpiPwr) kpiPwr.textContent = `${pwrExp.toFixed(2)} €`;
    const kpiFix = document.getElementById('exp-kpi-fixed');
    if (kpiFix) kpiFix.textContent = `${fixExp.toFixed(2)} €`;

    tbody.innerHTML = '';
    expenses.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(e.date).toLocaleDateString()}</td>
            <td><strong>${escapeHtml(e.concept)}</strong></td>
            <td><span class="badge bg-secondary">${escapeHtml(e.category)}</span></td>
            <td class="fw-bold text-danger">-${parseFloat(e.amount || 0).toFixed(2)} €</td>
            <td>
                <button class="btn btn-outline btn-xs text-danger" onclick="deleteExpense('${e.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderWastageLossSummary();
    renderHourlyFixedCosts();
}

// ==========================================================================
// 7. Analytics, Charts & CSV Export
// ==========================================================================
function renderAnalytics() {
    const revenue = state.orders.reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
    const expenses = state.expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const netProfit = revenue - expenses;
    const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0;
    
    const elem = document.getElementById('stat-avg-margin');
    if (elem) elem.textContent = `${margin}%`;
    
    const printHours = state.orders.reduce((sum, o) => sum + (parseFloat(o.time) || 0), 0);
    const printHoursElem = document.getElementById('stat-print-hours');
    if (printHoursElem) printHoursElem.textContent = `${printHours.toFixed(1)}h`;
    
    const filamentUsed = state.orders.reduce((sum, o) => sum + (parseFloat(o.weight) || 0), 0);
    const filUsedElem = document.getElementById('stat-filament-used');
    if (filUsedElem) filUsedElem.textContent = `${(filamentUsed / 1000).toFixed(2)} kg`;

    renderWeeklyHeatmap();
    renderStarAndTrapPieces();
}

function renderWeeklyHeatmap() {
    const container = document.getElementById('heatmap-container');
    if (!container) return;
    container.innerHTML = '';

    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const headerRow = document.createElement('div');
    headerRow.style.display = 'grid';
    headerRow.style.gridTemplateColumns = 'repeat(7, 1fr)';
    headerRow.style.gap = '6px';
    headerRow.style.marginBottom = '6px';
    headerRow.style.textAlign = 'center';
    headerRow.style.fontSize = '11px';
    headerRow.style.fontWeight = 'bold';
    headerRow.style.color = 'var(--text-dim)';
    
    days.forEach(d => {
        headerRow.innerHTML += `<div>${d}</div>`;
    });
    container.appendChild(headerRow);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    grid.style.gap = '6px';

    const orderDates = state.orders.map(o => (o.date || '').split('T')[0]);

    for (let i = 27; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const count = orderDates.filter(x => x === iso).length;

        let bg = 'rgba(255,255,255,0.04)';
        if (count === 1) bg = 'rgba(0, 210, 255, 0.3)';
        if (count === 2) bg = 'rgba(0, 210, 255, 0.6)';
        if (count >= 3) bg = 'rgba(0, 210, 255, 0.9)';

        const cell = document.createElement('div');
        cell.style.aspectRatio = '1';
        cell.style.background = bg;
        cell.style.borderRadius = '4px';
        cell.style.cursor = 'pointer';
        cell.title = `${iso}: ${count} encargo(s)`;
        grid.appendChild(cell);
    }
    container.appendChild(grid);
}

function renderCharts() {
    if (typeof Chart === 'undefined') return;
    
    const primary = '#00d2ff';
    const emerald = '#10b981';
    const text = '#cbd5e1';

    Chart.defaults.color = text;
    Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';

    // Financial Overview Line Chart
    const ctxFin = document.getElementById('chart-financial-overview');
    if (ctxFin) {
        if (charts.fin) charts.fin.destroy();
        charts.fin = new Chart(ctxFin, {
            type: 'line',
            data: {
                labels: ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'],
                datasets: [
                    {
                        label: 'Ingresos (€)',
                        data: [1200, 1850, 1600, 2100, 1950, Math.max(2200, state.orders.reduce((s,o)=>s+parseFloat(o.price||0),0))],
                        borderColor: primary,
                        backgroundColor: 'rgba(0, 210, 255, 0.1)',
                        tension: 0.35,
                        fill: true
                    },
                    {
                        label: 'Gastos (€)',
                        data: [450, 520, 610, 580, 640, Math.max(700, state.expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0))],
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        tension: 0.35,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Filament Stock Bar Chart
    const ctxFil = document.getElementById('chart-filament-stock');
    if (ctxFil) {
        if (charts.fil) charts.fil.destroy();
        charts.fil = new Chart(ctxFil, {
            type: 'bar',
            data: {
                labels: state.filaments.map(f => `${f.brand} ${f.colorName}`),
                datasets: [{
                    label: 'Gramos Restantes',
                    data: state.filaments.map(f => f.currentWeight),
                    backgroundColor: state.filaments.map(f => f.hex || '#00d2ff'),
                    borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Expenses Pie Chart
    const ctxExp = document.getElementById('chart-expenses-pie');
    if (ctxExp) {
        if (charts.exp) charts.exp.destroy();
        const catMap = {};
        state.expenses.forEach(e => {
            catMap[e.category] = (catMap[e.category] || 0) + (parseFloat(e.amount) || 0);
        });
        charts.exp = new Chart(ctxExp, {
            type: 'doughnut',
            data: {
                labels: Object.keys(catMap),
                datasets: [{
                    data: Object.values(catMap),
                    backgroundColor: ['#00d2ff', '#f59e0b', '#ef4444', '#a855f7', '#10b981', '#64748b']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Profit by Material Chart
    const ctxMat = document.getElementById('chart-profit-material');
    if (ctxMat) {
        if (charts.mat) charts.mat.destroy();
        const matRev = {};
        state.orders.forEach(o => {
            const fil = state.filaments.find(f => f.id === o.filamentId);
            const mat = fil ? fil.material : 'Otros';
            matRev[mat] = (matRev[mat] || 0) + (parseFloat(o.price) || 0);
        });
        charts.mat = new Chart(ctxMat, {
            type: 'bar',
            data: {
                labels: Object.keys(matRev),
                datasets: [{
                    label: 'Facturación (€)',
                    data: Object.values(matRev),
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function exportAnalyticsCSV() {
    let csv = 'ID,Pieza,Cliente,Material,Peso_g,Tiempo_h,Precio_EUR,Estado,Fecha,Plazo\n';
    state.orders.forEach(o => {
        const fil = state.filaments.find(f => f.id === o.filamentId);
        const mat = fil ? `${fil.brand} ${fil.material}` : '';
        csv += `"${o.id}","${(o.title||'').replace(/"/g, '""')}","${(o.client||'').replace(/"/g, '""')}","${mat}",${o.weight||0},${o.time||0},${o.price||0},"${o.status}","${o.date||''}","${o.deadline||''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `print3d_informe_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Informe CSV exportado con éxito', 'success');
}

// ==========================================================================
// 8. Modals, Pickers & Form Handlers
// ==========================================================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open-locked');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        // Only remove body lock if no other modals are active
        const anyActive = document.querySelector('.modal-overlay.active');
        if (!anyActive) {
            document.body.classList.remove('modal-open-locked');
        }
    }
}

// Global click-outside-to-close for all modals
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        closeModal(e.target.id);
    }
});

// Native PWA Installation Support
let deferredPWAInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPWAInstallPrompt = e;
    document.querySelectorAll('.btn-pwa-install').forEach(btn => {
        btn.style.display = 'inline-flex';
    });
});

window.addEventListener('appinstalled', () => {
    deferredPWAInstallPrompt = null;
    showToast('¡Print3D Studio instalada como app en tu dispositivo!', 'success');
    playChime('success');
});

function triggerPWAInstall() {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        showToast('¡La app ya está instalada en tu dispositivo!', 'success');
        return;
    }

    if (deferredPWAInstallPrompt) {
        deferredPWAInstallPrompt.prompt();
        deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
            if (choiceResult && choiceResult.outcome === 'accepted') {
                showToast('¡Instalando Print3D Studio en tu móvil!', 'success');
            }
            deferredPWAInstallPrompt = null;
        });
    } else {
        openMobileGuideModal();
    }
}

function triggerPWAInstallDirect() {
    if (deferredPWAInstallPrompt) {
        deferredPWAInstallPrompt.prompt();
        deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
            if (choiceResult && choiceResult.outcome === 'accepted') {
                showToast('¡Instalando Print3D Studio en tu móvil!', 'success');
            }
            deferredPWAInstallPrompt = null;
        });
        closeModal('modal-mobile-guide');
    } else {
        showToast('En Chrome, toca los 3 puntos (⋮) de arriba ➔ "Instalar aplicación"', 'info');
    }
}

function populatePickers() {
    const filPicker = document.getElementById('order-filament-picker');
    const printPicker = document.getElementById('order-printer-picker');
    
    if (filPicker) {
        filPicker.innerHTML = state.filaments.map(f => `
            <div class="picker-item" onclick="selectPicker('order-filament', '${f.id}')" data-id="${f.id}">
                <div class="color-swatch" style="background-color: ${f.hex}"></div>
                <span>${escapeHtml(f.brand)} ${escapeHtml(f.material)} (${escapeHtml(f.colorName)})</span>
            </div>
        `).join('');
    }
    
    if (printPicker) {
        printPicker.innerHTML = state.printers.map(p => `
            <div class="picker-item" onclick="selectPicker('order-printer', '${p.id}')" data-id="${p.id}">
                <span>${escapeHtml(p.name)} (${p.status})</span>
            </div>
        `).join('');
    }
}

window.selectPicker = function(prefix, id) {
    const input = document.getElementById(`${prefix}-id`);
    if (input) input.value = id;
    document.querySelectorAll(`#${prefix}-picker .picker-item`).forEach(el => {
        el.style.border = el.getAttribute('data-id') === id ? '2px solid #00d2ff' : '1px solid #333';
    });
    calculateOrderSuggestedPrice();
};

function compressImage(file, maxDimension = 800, quality = 0.75, callback) {
    if (!file || !file.type.startsWith('image/')) {
        if (callback) callback(null);
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            if (callback) callback(compressed);
        };
        img.onerror = function() {
            if (callback) callback(e.target.result);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function previewOrderPhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        compressImage(file, 800, 0.75, function(compressedData) {
            window._orderPhotoData = compressedData;
            const preview = document.getElementById('order-photo-preview');
            if (preview) {
                preview.src = compressedData;
                preview.style.display = 'block';
            }
            showToast('📸 Foto optimizada para el taller', 'info');
        });
    }
}

function openOrderModalWithDefaults() {
    window._orderPhotoData = null;
    document.getElementById('order-id').value = '';
    document.getElementById('order-client').value = '';
    document.getElementById('order-item').value = '';
    document.getElementById('order-weight').value = '100';
    document.getElementById('order-time').value = '4';
    document.getElementById('order-price').value = '20.00';
    document.getElementById('order-status').value = 'pending';
    document.getElementById('order-filament-id').value = '';
    document.getElementById('order-printer-id').value = '';
    
    const prev = document.getElementById('order-photo-preview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    const fileInp = document.getElementById('order-photo');
    if (fileInp) fileInp.value = '';

    const rmaChk = document.getElementById('order-is-rma');
    if (rmaChk) rmaChk.checked = false;
    const rmaWrap = document.getElementById('order-rma-reason-wrap');
    if (rmaWrap) rmaWrap.style.display = 'none';
    const rmaReason = document.getElementById('order-rma-reason');
    if (rmaReason) rmaReason.value = '';

    const notesInp = document.getElementById('order-print-notes');
    if (notesInp) notesInp.value = '';
    const tipBanner = document.getElementById('order-tips-banner');
    if (tipBanner) { tipBanner.style.display = 'none'; tipBanner.innerHTML = ''; }

    const depInp = document.getElementById('order-deposit');
    if (depInp) depInp.value = '0.00';
    const payMet = document.getElementById('order-payment-method');
    if (payMet) payMet.value = 'Bizum';
    updateOrderBalanceIndicator();

    populatePickers();
    if (state.filaments.length > 0) selectPicker('order-filament', state.filaments[0].id);
    if (state.printers.length > 0) selectPicker('order-printer', state.printers[0].id);

    calculateOrderSuggestedPrice();
    calculateQueueDeliveryEstimate(4);
    openModal('modal-order');
}

window.editOrder = function(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    
    window._orderPhotoData = o.photo || null;
    document.getElementById('order-id').value = o.id;
    document.getElementById('order-client').value = o.client;
    document.getElementById('order-item').value = o.title;
    document.getElementById('order-weight').value = o.weight;
    document.getElementById('order-time').value = o.time;
    document.getElementById('order-price').value = o.price;

    const depInp = document.getElementById('order-deposit');
    if (depInp) depInp.value = parseFloat(o.depositPaid || 0).toFixed(2);
    const payMet = document.getElementById('order-payment-method');
    if (payMet) payMet.value = o.paymentMethod || 'Bizum';
    updateOrderBalanceIndicator();
    
    const rmaChk = document.getElementById('order-is-rma');
    if (rmaChk) rmaChk.checked = !!o.isRma;
    const rmaWrap = document.getElementById('order-rma-reason-wrap');
    if (rmaWrap) rmaWrap.style.display = o.isRma ? 'block' : 'none';
    const rmaReason = document.getElementById('order-rma-reason');
    if (rmaReason) rmaReason.value = o.rmaReason || '';
    
    const notesInp = document.getElementById('order-print-notes');
    if (notesInp) notesInp.value = o.printNotes || '';
    const tipBanner = document.getElementById('order-tips-banner');
    if (tipBanner) { tipBanner.style.display = 'none'; tipBanner.innerHTML = ''; }

    const statusMap = { 'Presupuesto': 'pending', 'En Cola': 'en-cola', 'Imprimiendo': 'printing', 'Post-Proceso': 'post', 'Listo': 'done', 'Entregado': 'delivered' };
    document.getElementById('order-status').value = statusMap[o.status] || 'pending';
    
    document.getElementById('order-filament-id').value = o.filamentId || '';
    document.getElementById('order-printer-id').value = o.printerId || '';
    
    const prev = document.getElementById('order-photo-preview');
    if (prev) {
        if (o.photo) {
            prev.src = o.photo;
            prev.style.display = 'block';
        } else {
            prev.src = '';
            prev.style.display = 'none';
        }
    }

    populatePickers();
    if (o.filamentId) selectPicker('order-filament', o.filamentId);
    if (o.printerId) selectPicker('order-printer', o.printerId);
    
    calculateOrderSuggestedPrice();
    calculateQueueDeliveryEstimate(parseFloat(o.time) || 0);
    openModal('modal-order');
};

window.updateOrderBalanceIndicator = function() {
    const price = parseFloat(document.getElementById('order-price')?.value) || 0;
    const deposit = parseFloat(document.getElementById('order-deposit')?.value) || 0;
    const balInd = document.getElementById('order-balance-indicator');
    if (balInd) {
        const pending = Math.max(0, price - deposit);
        if (deposit > 0 && pending === 0) {
            balInd.innerHTML = '<span class="text-emerald fw-bold"><i class="fa-solid fa-check"></i> Pagado al 100%</span>';
        } else if (deposit > 0) {
            balInd.innerHTML = `Pendiente: <strong class="text-amber">${pending.toFixed(2)} €</strong>`;
        } else {
            balInd.innerHTML = `Pendiente: <strong class="text-white">${price.toFixed(2)} €</strong>`;
        }
    }
};

function saveOrder() {
    const id = document.getElementById('order-id').value || generateId();
    const title = document.getElementById('order-item')?.value?.trim();
    const client = document.getElementById('order-client')?.value?.trim();
    const weight = parseFloat(document.getElementById('order-weight')?.value) || 0;
    const time = parseFloat(document.getElementById('order-time')?.value) || 0;
    const price = parseFloat(document.getElementById('order-price')?.value) || 0;
    const depositPaid = parseFloat(document.getElementById('order-deposit')?.value) || 0;
    const paymentMethod = document.getElementById('order-payment-method')?.value || 'Bizum';
    const statusRaw = document.getElementById('order-status')?.value;
    const filamentId = document.getElementById('order-filament-id')?.value;
    const printerId = document.getElementById('order-printer-id')?.value;
    const deadlineInput = document.getElementById('order-deadline')?.value;
    const isRma = document.getElementById('order-is-rma')?.checked || false;
    const rmaReason = document.getElementById('order-rma-reason')?.value?.trim() || '';
    const printNotes = document.getElementById('order-print-notes')?.value?.trim() || '';

    const statusMap = { 'pending': 'Presupuesto', 'en-cola': 'En Cola', 'printing': 'Imprimiendo', 'post': 'Post-Proceso', 'done': 'Listo', 'delivered': 'Entregado' };
    const status = statusMap[statusRaw] || 'Presupuesto';

    if (!title || !client) {
        showToast('Por favor completa el nombre del cliente y la pieza', 'warning');
        return;
    }

    const existingIdx = state.orders.findIndex(o => o.id === id);
    const existing = existingIdx >= 0 ? state.orders[existingIdx] : null;

    const changelog = existing ? (existing.changelog || []) : [];
    if (existing && existing.status !== status) {
        changelog.push({
            date: new Date().toISOString(),
            from: existing.status,
            to: status,
            note: 'Estado actualizado en formulario'
        });
    }

    const order = {
        id,
        title,
        client,
        weight,
        time,
        price,
        depositPaid,
        paymentMethod,
        status,
        filamentId: filamentId || (state.filaments[0]?.id || ''),
        printerId: printerId || '',
        deadline: deadlineInput || existing?.deadline || '',
        photo: window._orderPhotoData !== null ? window._orderPhotoData : (existing?.photo || null),
        date: existing ? existing.date : new Date().toISOString(),
        isRma,
        rmaReason,
        printNotes: printNotes || (existing?.printNotes || ''),
        changelog
    };
    
    if (existingIdx >= 0) {
        state.orders[existingIdx] = order;
        showToast('Encargo actualizado con éxito', 'success');
    } else {
        state.orders.push(order);
        showToast('Nuevo encargo registrado', 'success');
    }
    
    // Auto register client in CRM if new
    if (!state.clients.find(c => c.name.toLowerCase() === client.toLowerCase())) {
        state.clients.push({
            id: generateId(),
            name: client,
            email: '',
            phone: '',
            ordersCount: 1,
            totalSpent: price,
            status: 'Regular'
        });
    }

    saveState();
    renderOrders();
    renderDashboard();
    closeModal('modal-order');
    playChime('success');
}

function calculateOrderSuggestedPrice() {
    const weight = parseFloat(document.getElementById('order-weight')?.value) || 0;
    const time = parseFloat(document.getElementById('order-time')?.value) || 0;
    const filId = document.getElementById('order-filament-id')?.value;
    
    let filCost = 0;
    if (filId) {
        const fil = state.filaments.find(f => f.id === filId);
        if (fil) filCost = (fil.costPerKg / 1000) * weight;
    } else {
        filCost = (20 / 1000) * weight;
    }
    
    const powerCost = time * 0.25 * (parseFloat(state.electricityTariff) || 0.18);
    const wearCost = time * 0.15;
    const laborSetup = 2.50;
    const totalCost = filCost + powerCost + wearCost + laborSetup;
    const suggested = totalCost * 2.8; // 180% markup

    const disp = document.getElementById('order-suggested-price-display');
    if (disp) {
        disp.textContent = `${suggested.toFixed(2)} €`;
        disp.dataset.val = suggested.toFixed(2);
    }
}

window.useSuggestedOrderPrice = function() {
    const val = document.getElementById('order-suggested-price-display')?.dataset?.val;
    const priceInput = document.getElementById('order-price');
    if (val && priceInput) priceInput.value = val;
};

// Filament Modal
window.editFilament = function(id) {
    const f = state.filaments.find(x => x.id === id);
    if (!f) return;
    document.getElementById('filament-id').value = f.id;
    document.getElementById('filament-brand').value = f.brand || '';
    document.getElementById('filament-material').value = f.material || 'PLA';
    document.getElementById('filament-color-name').value = f.colorName || '';
    document.getElementById('filament-color-hex').value = f.hex || '#000000';
    document.getElementById('filament-weight-total').value = f.maxWeight || 1000;
    document.getElementById('filament-weight-current').value = f.currentWeight || 1000;
    document.getElementById('filament-cost').value = f.costPerKg || 20;
    openModal('modal-filament');
};

function saveFilament() {
    const id = document.getElementById('filament-id')?.value || generateId();
    const brand = document.getElementById('filament-brand')?.value?.trim();
    if (!brand) {
        showToast('Por favor introduce la marca del filamento', 'warning');
        return;
    }
    const f = {
        id,
        brand,
        material: document.getElementById('filament-material')?.value || 'PLA',
        colorName: document.getElementById('filament-color-name')?.value || 'Negro',
        hex: document.getElementById('filament-color-hex')?.value || '#000000',
        maxWeight: parseFloat(document.getElementById('filament-weight-total')?.value) || 1000,
        currentWeight: parseFloat(document.getElementById('filament-weight-current')?.value) || 1000,
        costPerKg: parseFloat(document.getElementById('filament-cost')?.value) || 20
    };
    const idx = state.filaments.findIndex(x => x.id === id);
    if (idx >= 0) state.filaments[idx] = f;
    else state.filaments.push(f);
    
    saveState();
    renderFilaments();
    closeModal('modal-filament');
    showToast('Bobina guardada en inventario', 'success');
}

window.deleteFilament = function(id) {
    if (confirm('¿Eliminar esta bobina del inventario?')) {
        state.filaments = state.filaments.filter(f => f.id !== id);
        saveState();
        renderFilaments();
        showToast('Bobina eliminada', 'info');
    }
};

// Printer Modal
window.editPrinter = function(id) {
    const p = state.printers.find(x => x.id === id);
    if (!p) return;
    document.getElementById('printer-id').value = p.id;
    document.getElementById('printer-name').value = p.name || '';
    document.getElementById('printer-tech').value = p.tech || 'FDM';
    document.getElementById('printer-nozzle').value = p.nozzle || 0.4;
    document.getElementById('printer-power').value = p.power || 300;
    document.getElementById('printer-wear').value = p.wear || 0.15;
    
    const pp = document.getElementById('printer-purchase-price');
    const am = document.getElementById('printer-amort-months');
    const fc = document.getElementById('printer-fixed-cost');
    const kp = document.getElementById('printer-kwh-price');
    if (pp) pp.value = p.purchasePrice || 0;
    if (am) am.value = p.amortMonths || 36;
    if (fc) fc.value = p.fixedCostMonth || 0;
    if (kp) kp.value = p.kwhPrice || 0.18;
    
    openModal('modal-printer');
};

function savePrinter() {
    const id = document.getElementById('printer-id')?.value || generateId();
    const name = document.getElementById('printer-name')?.value?.trim();
    if (!name) {
        showToast('Introduce el nombre o modelo de la impresora', 'warning');
        return;
    }
    const p = {
        id,
        name,
        tech: document.getElementById('printer-tech')?.value || 'FDM',
        nozzle: parseFloat(document.getElementById('printer-nozzle')?.value) || 0.4,
        power: parseFloat(document.getElementById('printer-power')?.value) || 250,
        wear: parseFloat(document.getElementById('printer-wear')?.value) || 0.15,
        purchasePrice: parseFloat(document.getElementById('printer-purchase-price')?.value) || 0,
        amortMonths: parseInt(document.getElementById('printer-amort-months')?.value) || 36,
        fixedCostMonth: parseFloat(document.getElementById('printer-fixed-cost')?.value) || 0,
        kwhPrice: parseFloat(document.getElementById('printer-kwh-price')?.value) || 0.18,
        hours: 0,
        nozzleHours: 0,
        status: 'Idle'
    };
    
    const existing = state.printers.find(x => x.id === id);
    if (existing) {
        p.hours = existing.hours || 0;
        p.nozzleHours = existing.nozzleHours || 0;
        p.status = existing.status || 'Idle';
    }
    
    const idx = state.printers.findIndex(x => x.id === id);
    if (idx >= 0) state.printers[idx] = p;
    else state.printers.push(p);
    
    saveState();
    renderPrinters();
    renderDashboard();
    closeModal('modal-printer');
    showToast('Impresora guardada con éxito', 'success');
}

window.deletePrinter = function(id) {
    if (confirm('¿Eliminar esta impresora de la flota?')) {
        state.printers = state.printers.filter(p => p.id !== id);
        saveState();
        renderPrinters();
        renderDashboard();
        showToast('Impresora eliminada', 'info');
    }
};

// Expense Modal
function saveExpense() {
    const id = document.getElementById('expense-id')?.value || generateId();
    const concept = document.getElementById('expense-concept')?.value?.trim();
    if (!concept) {
        showToast('Introduce el concepto del gasto', 'warning');
        return;
    }
    const e = {
        id,
        concept,
        category: document.getElementById('expense-category')?.value || 'Otros',
        amount: parseFloat(document.getElementById('expense-amount')?.value) || 0,
        date: document.getElementById('expense-date')?.value || new Date().toISOString().split('T')[0]
    };
    const idx = state.expenses.findIndex(x => x.id === id);
    if (idx >= 0) state.expenses[idx] = e;
    else state.expenses.push(e);
    
    saveState();
    renderExpenses();
    renderDashboard();
    closeModal('modal-expense');
    showToast('Gasto registrado con éxito', 'success');
}

window.deleteExpense = function(id) {
    if (confirm('¿Eliminar este gasto?')) {
        state.expenses = state.expenses.filter(e => e.id !== id);
        saveState();
        renderExpenses();
        renderDashboard();
        showToast('Gasto eliminado', 'info');
    }
};

window.deleteOrder = function(id) {
    if (confirm('¿Eliminar este encargo definitivamente?')) {
        state.orders = state.orders.filter(o => o.id !== id);
        saveState();
        renderOrders();
        renderDashboard();
        showToast('Encargo eliminado', 'info');
    }
};

// Ticket Modal
window.showTicketModal = function(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    
    document.getElementById('ticket-date').textContent = new Date(o.date).toLocaleDateString();
    document.getElementById('ticket-id').textContent = o.id.substring(0, 8);
    document.getElementById('ticket-client').textContent = o.client;
    document.getElementById('ticket-item').textContent = o.title;
    
    let materialStr = 'PLA+ Estándar';
    if (o.filamentId) {
        const f = state.filaments.find(x => x.id === o.filamentId);
        if (f) materialStr = `${f.brand} ${f.material} (${f.colorName})`;
    }
    document.getElementById('ticket-material').textContent = materialStr;
    document.getElementById('ticket-info').textContent = `${o.weight}g | ${o.time}h de impresión`;
    document.getElementById('ticket-total').textContent = `${parseFloat(o.price).toFixed(2)} €`;
    
    const deposit = parseFloat(o.depositPaid || 0);
    const price = parseFloat(o.price || 0);
    const pending = Math.max(0, price - deposit);
    const depRow = document.getElementById('ticket-deposit-row');
    const pendRow = document.getElementById('ticket-pending-row');
    const methEl = document.getElementById('ticket-payment-method');
    const depVal = document.getElementById('ticket-deposit-val');
    const pendVal = document.getElementById('ticket-pending-val');

    if (depRow && pendRow) {
        if (deposit > 0) {
            depRow.style.display = 'flex';
            if (methEl) methEl.textContent = o.paymentMethod || 'Bizum';
            if (depVal) depVal.textContent = `${deposit.toFixed(2)} €`;

            pendRow.style.display = 'flex';
            if (pendVal) pendVal.textContent = `${pending.toFixed(2)} €`;
        } else {
            depRow.style.display = 'none';
            pendRow.style.display = 'none';
        }
    }
    
    openModal('modal-ticket');
};

// ==========================================================================
// 9. Calculator & 3D WebGL Viewer Logic
// ==========================================================================
function initCalculator() {
    ['calc-weight', 'calc-time', 'calc-profit-margin-slider'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateQuote);
    });
    
    const slider = document.getElementById('calc-profit-margin-slider');
    const marginVal = document.getElementById('calc-margin-val');
    if (slider && marginVal) {
        slider.addEventListener('input', (e) => {
            marginVal.textContent = `${e.target.value}%`;
        });
    }

    const layerSlider = document.getElementById('calc-layer-slider');
    if (layerSlider) {
        layerSlider.addEventListener('input', (e) => {
            updateGCodeLayerSim(e.target.value);
        });
    }
}

function loadCalcPreset(type) {
    const w = document.getElementById('calc-weight');
    const t = document.getElementById('calc-time');
    const m = document.getElementById('calc-profit-margin-slider');
    
    if (type === 'cosplay') {
        if (w) w.value = 850; if (t) t.value = 42; if (m) m.value = 150;
    } else if (type === 'miniature' || type === 'sla') {
        if (w) w.value = 60; if (t) t.value = 4; if (m) m.value = 250;
    } else if (type === 'functional' || type === 'mechanical') {
        if (w) w.value = 180; if (t) t.value = 9; if (m) m.value = 180;
    } else if (type === 'arch') {
        if (w) w.value = 320; if (t) t.value = 18; if (m) m.value = 200;
    }
    
    if (m) {
        const mv = document.getElementById('calc-margin-val');
        if (mv) mv.textContent = `${m.value}%`;
    }
    
    calculateQuote();
    load3DGeometry(type);
}

function calculateQuote() {
    const weight = parseFloat(document.getElementById('calc-weight')?.value) || 0;
    const time = parseFloat(document.getElementById('calc-time')?.value) || 0;
    const margin = parseFloat(document.getElementById('calc-profit-margin-slider')?.value) || 180;
    const riskFactor = parseFloat(document.getElementById('calc-risk-factor')?.value) || 1.0;

    // Multicolor AMS / MMU
    const multiEnabled = document.getElementById('calc-multicolor-enabled')?.checked || false;
    const multiCount = parseInt(document.getElementById('calc-multicolor-count')?.value) || 2;
    let purgeGrams = 0;
    let extraMultiTime = 0;
    if (multiEnabled && weight > 0) {
        if (multiCount === 2) purgeGrams = weight * 0.25;
        else if (multiCount === 3) purgeGrams = weight * 0.45;
        else purgeGrams = weight * 0.65;
        extraMultiTime = (multiCount - 1) * 0.4;
    }
    const purgeInfo = document.getElementById('calc-multicolor-purge-info');
    if (purgeInfo) {
        purgeInfo.textContent = multiEnabled ? `+${purgeGrams.toFixed(0)} g purga (+${extraMultiTime.toFixed(1)}h)` : '+0 g en torre/cacas';
    }

    // Estimador de Soportes
    const supportsType = document.getElementById('calc-supports-type')?.value || 'none';
    let supportGrams = 0;
    if (weight > 0) {
        if (supportsType === 'tree') supportGrams = weight * 0.18;
        else if (supportsType === 'dense') supportGrams = weight * 0.45;
    }
    const supportsInfo = document.getElementById('calc-supports-info');
    if (supportsInfo) {
        if (supportGrams > 0) {
            supportsInfo.style.display = 'block';
            supportsInfo.innerHTML = `<i class="fa-solid fa-tree mr-1"></i> +${supportGrams.toFixed(1)} g de material en soportes (${supportsType === 'tree' ? '+18% árbol' : '+45% denso'})`;
        } else {
            supportsInfo.style.display = 'none';
        }
    }

    const effectiveWeight = weight + purgeGrams + supportGrams;
    const effectiveTime = time + extraMultiTime;

    const costFilament = (20 / 1000) * effectiveWeight;
    const costPower = effectiveTime * 0.25 * (parseFloat(state.electricityTariff) || 0.18);
    const costWear = effectiveTime * 0.15;
    const costLabor = effectiveTime * 0.5;

    // Hardware & Finishing
    const inserts = parseInt(document.getElementById('calc-hw-inserts')?.value) || 0;
    const magnets = parseInt(document.getElementById('calc-hw-magnets')?.value) || 0;
    const screws = parseInt(document.getElementById('calc-hw-screws')?.value) || 0;
    const sanding = document.getElementById('calc-hw-sanding')?.checked ? 3.00 : 0;
    const painting = document.getElementById('calc-hw-painting')?.checked ? 8.00 : 0;
    const costHardware = (inserts * 0.25) + (magnets * 0.35) + (screws * 0.15) + sanding + painting;

    // CAD / 3D design service
    const cadEnabled = document.getElementById('calc-cad-enabled')?.checked || false;
    const cadType = document.getElementById('calc-cad-type')?.value || 'mod';
    const cadHours = parseFloat(document.getElementById('calc-cad-hours')?.value) || 1;
    let costCad = 0;
    if (cadEnabled) {
        costCad = cadType === 'mod' ? 5.00 : (cadHours * 20.00);
    }

    const basePrintCost = (costFilament + costPower + costWear + costLabor) * riskFactor;
    const totalCost = basePrintCost + costHardware + costCad;
    const profitNet = totalCost * (margin / 100);
    let suggestedPrice = totalCost + profitNet;

    // Tarifa Mínima de Puesta en Marcha (5.00 €)
    const minFee = parseFloat(state.minimumOrderFee) || 5.00;
    const minBadge = document.getElementById('calc-min-fee-badge');
    if ((weight > 0 || time > 0) && suggestedPrice < minFee) {
        suggestedPrice = minFee;
        if (minBadge) minBadge.style.display = 'block';
    } else {
        if (minBadge) minBadge.style.display = 'none';
    }

    // Consejo Nocturno para impresiones >= 6h
    const nightTip = document.getElementById('calc-night-savings-tip');
    const nightText = document.getElementById('calc-night-savings-text');
    if (effectiveTime >= 6) {
        const nightSavings = effectiveTime * 0.25 * 0.12;
        if (nightText) {
            nightText.innerHTML = `<strong>Ahorro Nocturno:</strong> Esta pieza dura ${effectiveTime.toFixed(1)}h. Imprimiendo de noche (00h-08h) ahorras aprox. <strong>${nightSavings.toFixed(2)} €</strong> en luz.`;
        }
        if (nightTip) nightTip.style.display = 'block';
    } else {
        if (nightTip) nightTip.style.display = 'none';
    }

    const cFil = document.getElementById('calc-cost-filament');
    if (cFil) cFil.textContent = `${costFilament.toFixed(2)} €`;
    const cPow = document.getElementById('calc-cost-power');
    if (cPow) cPow.textContent = `${costPower.toFixed(2)} €`;
    const cWear = document.getElementById('calc-cost-wear');
    if (cWear) cWear.textContent = `${costWear.toFixed(2)} €`;
    const cLab = document.getElementById('calc-cost-labor');
    if (cLab) cLab.textContent = `${costLabor.toFixed(2)} €`;

    const rowHw = document.getElementById('calc-cost-hw-row');
    const cHw = document.getElementById('calc-cost-hardware');
    if (rowHw && cHw) {
        if (costHardware > 0) {
            rowHw.style.display = 'flex';
            cHw.textContent = `${costHardware.toFixed(2)} €`;
        } else {
            rowHw.style.display = 'none';
        }
    }

    const rowCad = document.getElementById('calc-cost-cad-row');
    const cCad = document.getElementById('calc-cost-cad');
    if (rowCad && cCad) {
        if (costCad > 0) {
            rowCad.style.display = 'flex';
            cCad.textContent = `${costCad.toFixed(2)} €`;
        } else {
            rowCad.style.display = 'none';
        }
    }

    const cTot = document.getElementById('calc-cost-total');
    if (cTot) cTot.textContent = `${totalCost.toFixed(2)} €`;
    const pNet = document.getElementById('calc-profit-net');
    if (pNet) pNet.textContent = `${profitNet.toFixed(2)} €`;
    const sPrice = document.getElementById('calc-suggested-price');
    if (sPrice) sPrice.textContent = `${suggestedPrice.toFixed(2)} €`;

    renderVolumeTiers();
}

window.toggleCalcSection = function(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('calc-hw-icon');
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (icon) icon.className = isHidden ? 'fa-solid fa-chevron-up text-dim text-xs' : 'fa-solid fa-chevron-down text-dim text-xs';
};

window.toggleMulticolorOptions = function(enabled) {
    const det = document.getElementById('calc-multicolor-details');
    if (det) det.style.display = enabled ? 'block' : 'none';
    calculateQuote();
};

window.toggleCadOptions = function(enabled) {
    const det = document.getElementById('calc-cad-details');
    if (det) det.style.display = enabled ? 'block' : 'none';
    calculateQuote();
};

window.toggleCadHoursInput = function(val) {
    const wrap = document.getElementById('calc-cad-hours-wrap');
    if (wrap) wrap.style.display = val === 'custom' ? 'block' : 'none';
};

window.convertCalcToOrder = function() {
    const title = document.getElementById('calc-item-name')?.value || 'Pieza Calculada';
    const weight = parseFloat(document.getElementById('calc-weight')?.value) || 100;
    const time = parseFloat(document.getElementById('calc-time')?.value) || 4;
    const priceText = document.getElementById('calc-suggested-price')?.textContent || '20.00 €';
    const price = parseFloat(priceText.replace('€', '').trim()) || 20.00;
    
    switchTab('tab-orders');
    openOrderModalWithDefaults();
    
    setTimeout(() => {
        const itemInput = document.getElementById('order-item');
        const weightInput = document.getElementById('order-weight');
        const timeInput = document.getElementById('order-time');
        const priceInput = document.getElementById('order-price');
        
        if (itemInput) itemInput.value = title;
        if (weightInput) weightInput.value = weight;
        if (timeInput) timeInput.value = time;
        if (priceInput) priceInput.value = price;
        
        showToast('Presupuesto volcado en nuevo encargo', 'info');
    }, 60);
};

// --- PROYECTO MULTI-PIEZA / ENSAMBLAJES ---
window.assemblyPieces = window.assemblyPieces || [];

window.addCurrentPieceToAssembly = function() {
    const name = document.getElementById('calc-item-name')?.value?.trim() || `Pieza #${window.assemblyPieces.length + 1}`;
    const weight = parseFloat(document.getElementById('calc-weight')?.value) || 0;
    const time = parseFloat(document.getElementById('calc-time')?.value) || 0;
    const priceText = document.getElementById('calc-suggested-price')?.textContent || '0 €';
    const price = parseFloat(priceText.replace('€', '').trim()) || 0;

    if (weight <= 0 && time <= 0) {
        showToast('Introduce al menos peso o tiempo para agregar la pieza', 'warning');
        return;
    }

    window.assemblyPieces.push({
        name,
        weight,
        time,
        price
    });

    renderAssemblyList();
    showToast(`Pieza "${name}" agregada al ensamblaje`, 'success');
    playChime('success');
};

window.removeAssemblyPiece = function(index) {
    if (window.assemblyPieces && window.assemblyPieces[index] !== undefined) {
        window.assemblyPieces.splice(index, 1);
        renderAssemblyList();
    }
};

window.renderAssemblyList = function() {
    const listEl = document.getElementById('assembly-pieces-list');
    const totalBar = document.getElementById('assembly-total-bar');
    const totalCount = document.getElementById('assembly-total-count');
    const totalStats = document.getElementById('assembly-total-stats');
    const totalPrice = document.getElementById('assembly-total-price');

    if (!listEl) return;

    if (!window.assemblyPieces || window.assemblyPieces.length === 0) {
        listEl.innerHTML = `<div class="text-xs text-muted text-center py-2" id="assembly-empty-msg">No hay piezas en el proyecto. Calcula una pieza arriba y pulsa "Añadir Pieza".</div>`;
        if (totalBar) {
            totalBar.classList.add('d-none');
            totalBar.classList.remove('d-flex');
        }
        return;
    }

    let totW = 0, totT = 0, totP = 0;
    let html = '';
    window.assemblyPieces.forEach((p, idx) => {
        totW += p.weight;
        totT += p.time;
        totP += p.price;
        html += `
            <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); font-size: 0.8rem;">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%;">
                    <strong class="text-white">${escapeHtml(p.name)}</strong>
                    <div class="text-muted text-xs">${p.weight}g · ${p.time}h · <span class="text-emerald fw-bold">${p.price.toFixed(2)} €</span></div>
                </div>
                <button type="button" class="btn-outline btn-xs text-danger" onclick="removeAssemblyPiece(${idx})" title="Eliminar subpieza" style="border-color: rgba(239,68,68,0.3); padding: 2px 6px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    });

    listEl.innerHTML = html;
    if (totalBar) {
        totalBar.classList.remove('d-none');
        totalBar.classList.add('d-flex');
    }
    if (totalCount) totalCount.textContent = `${window.assemblyPieces.length} ${window.assemblyPieces.length === 1 ? 'pieza' : 'piezas'}`;
    if (totalStats) totalStats.textContent = `(${totW.toFixed(0)}g • ${totT.toFixed(1)}h)`;
    if (totalPrice) totalPrice.textContent = `${totP.toFixed(2)} €`;
};

window.convertAssemblyToOrder = function() {
    if (!window.assemblyPieces || window.assemblyPieces.length === 0) {
        showToast('El ensamblaje está vacío. Añade al menos una pieza.', 'warning');
        return;
    }

    let totW = 0, totT = 0, totP = 0;
    const pieceNames = window.assemblyPieces.map(p => p.name).join(' + ');
    window.assemblyPieces.forEach(p => {
        totW += p.weight;
        totT += p.time;
        totP += p.price;
    });

    const projectName = `Proyecto Ensamblaje (${window.assemblyPieces.length} piezas: ${pieceNames.length > 40 ? pieceNames.substring(0, 40) + '...' : pieceNames})`;

    switchTab('tab-orders');
    openOrderModalWithDefaults();

    setTimeout(() => {
        const itemInput = document.getElementById('order-item');
        const weightInput = document.getElementById('order-weight');
        const timeInput = document.getElementById('order-time');
        const priceInput = document.getElementById('order-price');

        if (itemInput) itemInput.value = projectName;
        if (weightInput) weightInput.value = Math.round(totW);
        if (timeInput) timeInput.value = parseFloat(totT.toFixed(1));
        if (priceInput) priceInput.value = parseFloat(totP.toFixed(2));

        showToast(`Ensamblaje volcado: ${window.assemblyPieces.length} piezas sumadas con éxito`, 'success');
        playChime('success');
    }, 60);
};

function parseGCodeMetadata(text) {
    let weight = null;
    let timeHours = null;

    // 1. Filament Weight in Grams
    // Bambu / OrcaSlicer / PrusaSlicer: ; filament used [g] = 45.23 or ; total filament used [g] : 45.23
    const filamentGM = text.match(/;\s*(?:total\s+)?filament\s+used\s*\[g\]\s*[:=]\s*([0-9.]+)/i);
    if (filamentGM) {
        weight = parseFloat(filamentGM[1]);
    } else {
        // Simplify3D: ;   Plastic weight: 46.10 g
        const s3dM = text.match(/;\s*Plastic weight:\s*([0-9.]+)\s*g/i);
        if (s3dM) {
            weight = parseFloat(s3dM[1]);
        } else {
            // Cura: ;Filament used: 12.35m or 12350mm (1.75mm PLA ~ 3.0g per meter)
            const curaM = text.match(/;\s*Filament used:\s*([0-9.]+)\s*m\b/i);
            if (curaM) {
                weight = Math.round(parseFloat(curaM[1]) * 3.0);
            } else {
                const curaMm = text.match(/;\s*Filament used:\s*([0-9.]+)\s*mm\b/i);
                if (curaMm) {
                    weight = Math.round((parseFloat(curaMm[1]) / 1000) * 3.0);
                }
            }
        }
    }

    // 2. Print Time in Hours
    // Cura: ;TIME:7200 (seconds)
    const curaTime = text.match(/;\s*TIME:([0-9]+)/i);
    if (curaTime) {
        timeHours = parseFloat((parseInt(curaTime[1], 10) / 3600).toFixed(2));
    } else {
        // Prusa / Bambu / Orca: ; estimated printing time (normal mode) = 3h 45m 12s
        const estTime = text.match(/;\s*(?:model printing time|estimated printing time[^=]*)=\s*([^\r\n;]+)/i);
        if (estTime) {
            const timeStr = estTime[1].trim();
            let totalH = 0;
            const days = timeStr.match(/([0-9]+)\s*d/i);
            const hours = timeStr.match(/([0-9]+)\s*h/i);
            const minutes = timeStr.match(/([0-9]+)\s*m/i);
            const seconds = timeStr.match(/([0-9]+)\s*s/i);

            if (days) totalH += parseInt(days[1], 10) * 24;
            if (hours) totalH += parseInt(hours[1], 10);
            if (minutes) totalH += parseInt(minutes[1], 10) / 60;
            if (seconds) totalH += parseInt(seconds[1], 10) / 3600;

            if (totalH > 0) timeHours = parseFloat(totalH.toFixed(2));
        }
    }

    return { weight, timeHours };
}

function initDropzone() {
    const dropzone = document.getElementById('file-dropzone');
    const input = document.getElementById('calc-file-input');
    
    if (!dropzone || !input) return;
    
    dropzone.addEventListener('click', () => input.click());
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });
    
    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleCalcFiles(files);
    });
    
    input.addEventListener('change', function() {
        handleCalcFiles(this.files);
    });
    
    function handleCalcFiles(files) {
        if (files.length > 0) {
            const f = files[0];
            const cleanName = f.name.replace(/\.[^/.]+$/, "");
            const ext = f.name.toLowerCase().split('.').pop();
            
            if (ext === 'gcode' || ext === '3mf' || ext === 'txt') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const text = e.target.result;
                    const meta = parseGCodeMetadata(text);
                    
                    document.getElementById('calc-item-name').value = cleanName;
                    if (meta.weight) {
                        document.getElementById('calc-weight').value = meta.weight;
                    }
                    if (meta.timeHours) {
                        document.getElementById('calc-time').value = meta.timeHours;
                    }
                    calculateQuote();
                    
                    if (meta.weight && meta.timeHours) {
                        showToast(`⚡ G-Code analizado: ${meta.weight}g y ${meta.timeHours}h extraídos automáticamente`, 'success');
                        playChime('success');
                    } else {
                        showToast(`Archivo "${f.name}" cargado`, 'info');
                    }
                };
                // Read first 350KB to parse slicing headers
                reader.readAsText(f.slice(0, 350000));
            } else {
                showToast(`Archivo "${f.name}" cargado`, 'success');
                const sizeInKb = f.size / 1024;
                const weightVal = Math.max(15, Math.floor(sizeInKb / 8));
                const timeVal = Math.max(1, parseFloat((weightVal / 22).toFixed(1)));
                
                document.getElementById('calc-weight').value = weightVal;
                document.getElementById('calc-time').value = timeVal;
                document.getElementById('calc-item-name').value = cleanName;
                calculateQuote();
            }
            
            const types = ['cosplay', 'miniature', 'functional'];
            load3DGeometry(types[Math.floor(Math.random() * types.length)]);
        }
    }
}

function init3DViewer() {
    if (typeof THREE === 'undefined') return;
    
    const container = document.getElementById('three-canvas');
    if (!container) return;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a14);
    
    camera = new THREE.PerspectiveCamera(45, (container.clientWidth || 300) / (container.clientHeight || 260), 0.1, 1000);
    camera.position.set(0, 2, 5);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth || 300, container.clientHeight || 260);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0x00d2ff, 1.2);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    load3DGeometry('functional');

    function animate() {
        requestAnimationFrame(animate);
        if (mesh) {
            mesh.rotation.y += 0.008;
        }
        renderer.render(scene, camera);
    }
    animate();
    
    window.addEventListener('resize', () => {
        if (!container || !camera || !renderer) return;
        camera.aspect = (container.clientWidth || 300) / (container.clientHeight || 260);
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth || 300, container.clientHeight || 260);
    });
}

function load3DGeometry(type) {
    if (!scene) return;
    if (mesh) scene.remove(mesh);
    
    let geometry;
    if (type === 'cosplay') geometry = new THREE.TorusKnotGeometry(0.9, 0.28, 64, 16);
    else if (type === 'miniature') geometry = new THREE.ConeGeometry(1, 2, 24);
    else geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    
    const material = new THREE.MeshPhongMaterial({ color: 0x00d2ff, shininess: 80 });
    mesh = new THREE.Mesh(geometry, material);
    
    wireframe = new THREE.WireframeGeometry(geometry);
    const line = new THREE.LineSegments(wireframe);
    line.material.depthTest = false;
    line.material.opacity = 0.25;
    line.material.transparent = true;
    line.visible = false;
    mesh.add(line);
    
    scene.add(mesh);
    reset3DCamera();
}

function reset3DCamera() {
    if (camera) {
        camera.position.set(0, 1.5, 4.5);
        camera.lookAt(0, 0, 0);
    }
}

function toggle3DWireframe() {
    if (mesh && mesh.children.length > 0) {
        mesh.children[0].visible = !mesh.children[0].visible;
    }
}

function updateGCodeLayerSim(val) {
    const display = document.getElementById('layer-val');
    if (display) display.textContent = `${val}%`;
    if (mesh) {
        const scale = val / 100;
        mesh.scale.set(1, scale || 0.01, 1);
        mesh.position.y = -0.7 + scale * 0.7;
    }
}

function initMeshBackground() {
    if (typeof THREE === 'undefined') return;
    const canvas = document.getElementById('mesh-canvas');
    if (!canvas) return;
    
    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const bgRenderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    
    bgRenderer.setSize(window.innerWidth, window.innerHeight);
    bgCamera.position.z = 30;
    
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 80;
    }
    const particles = new THREE.BufferGeometry();
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const pMaterial = new THREE.PointsMaterial({
        size: 0.18,
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.35
    });
    
    const pMesh = new THREE.Points(particles, pMaterial);
    bgScene.add(pMesh);
    
    function animateBg() {
        requestAnimationFrame(animateBg);
        pMesh.rotation.y += 0.0006;
        pMesh.rotation.x += 0.0003;
        bgRenderer.render(bgScene, bgCamera);
    }
    animateBg();
    
    window.addEventListener('resize', () => {
        bgCamera.aspect = window.innerWidth / window.innerHeight;
        bgCamera.updateProjectionMatrix();
        bgRenderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function startTelemetrySimulation() {
    if (telemetryInterval) clearInterval(telemetryInterval);
    
    let layer = 142;
    telemetryInterval = setInterval(() => {
        const noz = document.getElementById('tele-nozzle-temp');
        const bed = document.getElementById('tele-bed-temp');
        const lay = document.getElementById('tele-layer-count');
        
        if (noz) noz.textContent = `${210 + Math.floor(Math.random() * 4)}°C`;
        if (bed) bed.textContent = `${60 + Math.floor(Math.random() * 2)}°C`;
        if (lay) {
            layer = (layer + 1) % 450;
            lay.textContent = `${layer} / 450`;
        }
    }, 2500);
}

// ==========================================================================
// 10. Agenda, Calendar, Spares & Maintenance
// ==========================================================================
function renderDashboardCalendar() {
    const container = document.getElementById('agenda-calendar-container');
    if (!container) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthTitle = document.getElementById('calendar-month-title');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    if (monthTitle) monthTitle.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const startingDay = firstDay === 0 ? 6 : firstDay - 1; // Mon = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '<div class="agcal-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px;">';
    
    const dayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    dayHeaders.forEach(dh => {
        html += `<div style="text-align:center; font-size:11px; font-weight:bold; color:var(--text-dim); padding:4px 0;">${dh}</div>`;
    });

    for (let i = 0; i < startingDay; i++) {
        html += '<div style="opacity:0.2; min-height:60px;"></div>';
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const mStr = String(month + 1).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        const dateIso = `${year}-${mStr}-${dStr}`;

        const dayOrders = state.orders.filter(o => o.deadline === dateIso);
        const isToday = dateIso === todayStr;

        html += `
            <div class="agcal-day ${isToday ? 'agcal-day-today' : ''}" onclick="showAgendaDayDetail('${dateIso}')" style="min-height:64px; background:rgba(255,255,255,0.03); border:1px solid ${isToday ? '#00d2ff' : 'rgba(255,255,255,0.07)'}; border-radius:8px; padding:6px; cursor:pointer;">
                <div style="font-size:11px; font-weight:bold; color:${isToday ? '#00d2ff' : '#cbd5e1'};">${day}</div>
                <div style="margin-top:4px; display:flex; flex-direction:column; gap:2px;">
                    ${dayOrders.slice(0, 2).map(o => `
                        <div style="font-size:9.5px; background:rgba(0,210,255,0.15); color:#00d2ff; padding:1px 4px; border-radius:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(o.title)}
                        </div>
                    `).join('')}
                    ${dayOrders.length > 2 ? `<div style="font-size:9px; color:var(--text-dim);">+${dayOrders.length - 2} más</div>` : ''}
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

function changeCalendarMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderDashboardCalendar();
}

function goToToday() {
    currentCalendarDate = new Date();
    renderDashboardCalendar();
}

function switchAgendaView(mode) {
    currentAgendaView = mode;
    const btnM = document.getElementById('btn-agenda-view-month');
    const btnG = document.getElementById('btn-agenda-view-gantt');
    const monthView = document.getElementById('agenda-month-view');
    const ganttView = document.getElementById('agenda-gantt-view');
    
    if (btnM) btnM.classList.toggle('active', mode === 'month');
    if (btnG) btnG.classList.toggle('active', mode === 'gantt');
    if (monthView) monthView.style.display = mode === 'month' ? 'block' : 'none';
    if (ganttView) ganttView.style.display = mode === 'gantt' ? 'block' : 'none';

    if (mode === 'month') renderDashboardCalendar();
}

function showAgendaDayDetail(dateStr) {
    const panel = document.getElementById('agenda-day-detail');
    const title = document.getElementById('agenda-day-detail-title');
    const list = document.getElementById('agenda-day-detail-list');
    if (!panel || !list) return;

    if (title) title.innerHTML = `<i class="fa-solid fa-calendar-day text-cyan"></i> Encargos para el día ${dateStr}`;
    
    const dayOrders = state.orders.filter(o => o.deadline === dateStr);
    list.innerHTML = '';
    
    if (dayOrders.length === 0) {
        list.innerHTML = '<p class="text-muted text-sm p-2">No hay encargos con fecha límite para este día.</p>';
    } else {
        dayOrders.forEach(o => {
            const div = document.createElement('div');
            div.className = 'p-3 mb-2 rounded bg-dark border border-secondary';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <strong>${escapeHtml(o.title)}</strong>
                    <span class="badge ${getBadgeClass(o.status)}">${o.status}</span>
                </div>
                <div class="text-xs text-muted mt-1">Cliente: ${escapeHtml(o.client)} | Precio: ${parseFloat(o.price).toFixed(2)} €</div>
            `;
            list.appendChild(div);
        });
    }
    panel.style.display = 'block';
}

function closeAgendaDayDetail() {
    const panel = document.getElementById('agenda-day-detail');
    if (panel) panel.style.display = 'none';
}

function renderMaintenance() {
    const grid = document.getElementById('maintenance-printers-grid');
    if (!grid) return;
    grid.innerHTML = '';

    state.printers.forEach(p => {
        const hours = p.hours || 0;
        const nextService = Math.max(0, 500 - (hours % 500));
        const needService = nextService < 50;

        const card = document.createElement('div');
        card.className = 'p-3 mb-3 rounded bg-dark border border-secondary';
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-bold"><i class="fa-solid fa-print text-cyan mr-2"></i> ${escapeHtml(p.name)}</span>
                <span class="badge ${needService ? 'bg-danger' : 'bg-success'}">${needService ? 'Revisión Necesaria' : 'Estado Óptimo'}</span>
            </div>
            <div class="d-flex justify-content-between text-xs text-muted mb-1">
                <span>Horas Totales: ${hours.toFixed(1)} h</span>
                <span>Próximo Servicio: en ${nextService.toFixed(0)} h</span>
            </div>
            <div class="progress mb-3" style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow:hidden;">
                <div class="progress-bar ${needService ? 'bg-danger' : 'bg-cyan'}" style="width: ${Math.min(100, ((hours % 500) / 500) * 100)}%; height:100%;"></div>
            </div>
            <button class="btn btn-outline btn-sm w-100" onclick="performMaintenance('${p.id}')">
                <i class="fa-solid fa-check"></i> Registrar Mantenimiento Realizado
            </button>
        `;
        grid.appendChild(card);
    });
}

function performMaintenance(printerId) {
    const printer = state.printers.find(p => p.id === printerId);
    if (printer) {
        printer.hours = (printer.hours || 0) + 1;
        saveState();
        renderMaintenance();
        playChime('success');
        showToast(`Mantenimiento preventivo registrado para ${printer.name}`, 'success');
    }
}

function renderSparesTable() {
    const tbody = document.getElementById('spares-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!state.spares || state.spares.length === 0) {
        state.spares = [
            { id: generateId(), name: 'Boquilla Latón 0.4mm', category: 'Boquillas', qty: 5, minStock: 2 },
            { id: generateId(), name: 'Superficie PEI Texturizada', category: 'Camas PEI', qty: 1, minStock: 2 }
        ];
    }

    state.spares.forEach(s => {
        const isLow = s.qty <= s.minStock;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">${escapeHtml(s.name)}</td>
            <td><span class="badge bg-secondary">${escapeHtml(s.category)}</span></td>
            <td><span class="fw-bold ${isLow ? 'text-danger' : 'text-emerald'}">${s.qty} uds</span> ${isLow ? '<span class="badge bg-danger">Stock Bajo</span>' : ''}</td>
            <td>${s.minStock} uds</td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-outline btn-xs" onclick="adjustSpareQty('${s.id}', 1)"><i class="fa-solid fa-plus"></i></button>
                    <button class="btn btn-outline btn-xs" onclick="adjustSpareQty('${s.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function adjustSpareQty(id, delta) {
    const s = state.spares.find(x => x.id === id);
    if (s) {
        s.qty = Math.max(0, (s.qty || 0) + delta);
        saveState();
        renderSparesTable();
    }
}

function openAddSpareModal() {
    const f = document.getElementById('form-spare');
    if (f) f.reset();
    openModal('modal-add-spare');
}

let qrStream = null;

function openQRScanner() {
    openModal('modal-qr-scanner');
    const video = document.getElementById('qr-video');
    const result = document.getElementById('qr-scan-result');
    if (result) result.textContent = 'Iniciando cámara...';
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && video) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                qrStream = stream;
                video.srcObject = stream;
                video.play();
                if (result) result.textContent = 'Apunta al código QR de la bobina o pedido...';
            })
            .catch(err => {
                console.warn('Camera error or blocked:', err);
                if (result) result.innerHTML = '<span class="text-amber"><i class="fa-solid fa-triangle-exclamation"></i> Cámara no disponible o denegada.</span>';
            });
    } else if (result) {
        result.textContent = 'Cámara no soportada en este entorno.';
    }
}

function closeQRScanner() {
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }
    const video = document.getElementById('qr-video');
    if (video) video.srcObject = null;
    closeModal('modal-qr-scanner');
}

function saveSparePart() {
    const name = document.getElementById('spare-name')?.value?.trim();
    if (!name) return;
    const spare = {
        id: generateId(),
        name,
        category: document.getElementById('spare-category')?.value || 'Boquillas',
        qty: parseInt(document.getElementById('spare-quantity')?.value, 10) || 1,
        minStock: parseInt(document.getElementById('spare-min-stock')?.value, 10) || 2
    };
    state.spares.push(spare);
    saveState();
    renderSparesTable();
    closeModal('modal-add-spare');
    showToast('Repuesto añadido al almacén', 'success');
}

// Digital Signature Pad
let sigDrawing = false;
let sigCtx = null;

function initSignaturePad() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;
    sigCtx = canvas.getContext('2d');
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.strokeStyle = '#000000';

    canvas.addEventListener('mousedown', startSig);
    canvas.addEventListener('mousemove', drawSig);
    canvas.addEventListener('mouseup', stopSig);
    canvas.addEventListener('touchstart', startSigTouch, { passive: false });
    canvas.addEventListener('touchmove', drawSigTouch, { passive: false });
    canvas.addEventListener('touchend', stopSig);
}

function startSig(e) { sigDrawing = true; sigCtx.beginPath(); sigCtx.moveTo(e.offsetX, e.offsetY); }
function drawSig(e) { if (!sigDrawing) return; sigCtx.lineTo(e.offsetX, e.offsetY); sigCtx.stroke(); }
function stopSig() { sigDrawing = false; }
function startSigTouch(e) {
    e.preventDefault();
    const rect = e.target.getBoundingClientRect();
    const touch = e.touches[0];
    sigDrawing = true;
    sigCtx.beginPath();
    sigCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
}
function drawSigTouch(e) {
    e.preventDefault();
    if (!sigDrawing) return;
    const rect = e.target.getBoundingClientRect();
    const touch = e.touches[0];
    sigCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    sigCtx.stroke();
}

function clearSignatureCanvas() {
    const canvas = document.getElementById('signature-canvas');
    if (canvas && sigCtx) sigCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveSignatureAndDeliver() {
    closeModal('modal-signature');
    showToast('Firma registrada y encargo marcado como entregado', 'success');
    playChime('success');
}

function openLabelModal(type, id) {
    const titleEl = document.getElementById('label-title');
    const subEl = document.getElementById('label-subtitle');
    const idEl = document.getElementById('label-id');
    const qrEl = document.getElementById('label-qr-code');

    if (type === 'filament') {
        const f = (state.filaments || []).find(item => item.id === id);
        if (f) {
            if (titleEl) titleEl.textContent = `${f.brand} ${f.material}`.toUpperCase();
            if (subEl) subEl.textContent = `${f.colorName} • ${f.currentWeight}g / ${f.maxWeight}g • ${parseFloat(f.costPerKg || 0).toFixed(2)}€/kg`;
            if (idEl) idEl.textContent = `ID: #${f.id}`;
            if (qrEl) qrEl.textContent = `[ QR: FIL-${f.id.substring(0, 8)} ]`;
        }
    } else if (type === 'order') {
        const o = (state.orders || []).find(item => item.id === id);
        if (o) {
            if (titleEl) titleEl.textContent = (o.title || 'ENCARGO 3D').toUpperCase();
            if (subEl) subEl.textContent = `Cliente: ${o.client || 'N/A'} • ${o.weight || 0}g • ${parseFloat(o.price || 0).toFixed(2)}€`;
            if (idEl) idEl.textContent = `PEDIDO: #${o.id}`;
            if (qrEl) qrEl.textContent = `[ QR: ORD-${o.id.substring(0, 8)} ]`;
        }
    }

    openModal('modal-label-print');
}

function runMaterialAdvisor() {
    const appEl = document.getElementById('advisor-usage')?.value;
    const priorityEl = document.getElementById('advisor-priority')?.value;
    const tempEl = document.getElementById('advisor-temp')?.value;
    const resEl = document.getElementById('advisor-recommendation-result');
    if (!resEl) return;
    
    const recommendations = {
        'decor': { mat: 'PLA / PLA+', desc: 'Excelente estética, acabado nítido y cero contracción térmica. Perfecto para bustos, figuras y maquetas de exposición.' },
        'mech': { mat: 'PETG / ASA', desc: 'Resistencia mecánica a impactos, tracción y temperaturas moderadas de hasta 80°C. Ideal para engranajes y carcasas funcionales.' },
        'outdoor': { mat: 'ASA', desc: 'Inmune a la radiación UV, no amarillea ni se degrada con la lluvia o calor exterior. El mejor material para uso en exteriores.' },
        'temp': { mat: 'Policarbonato (PC) o ABS', desc: 'Soporta hasta 110°C en entornos de motor o cajas térmicas. Requiere cama caliente a 100°C+.' },
        'flex': { mat: 'TPU Flexible (95A / 85A)', desc: 'Amortiguación de vibraciones, juntas de estanqueidad y carcasas antigolpes. Imprimir lento (20-30mm/s).' }
    };

    let rec = recommendations[appEl] || recommendations['decor'];

    // Override based on temperature priority
    if (tempEl === 'alta' && appEl !== 'flex') {
        rec = { mat: 'PC / ABS / ASA', desc: `${rec.desc} ⚠️ A temperaturas altas (>80°C), se recomienda PC o ABS obligatoriamente.` };
    }

    // Additional tip based on priority
    let tipHtml = '';
    if (priorityEl === 'strength') {
        tipHtml = '<div class="text-xs text-amber mt-2"><i class="fa-solid fa-shield-halved"></i> Tip: Para máxima resistencia, usa relleno al 60%+ con patrón cúbico o giróide y 4 paredes.</div>';
    } else if (priorityEl === 'finish') {
        tipHtml = '<div class="text-xs text-cyan mt-2"><i class="fa-solid fa-gem"></i> Tip: Para mejor acabado, usa altura de capa 0.12mm, velocidad lenta y activa el "ironing".</div>';
    } else if (priorityEl === 'economy') {
        tipHtml = '<div class="text-xs text-emerald mt-2"><i class="fa-solid fa-piggy-bank"></i> Tip: PLA genérico + 15% relleno + 0.28mm de capa = máximo ahorro sin perder estructura.</div>';
    }

    resEl.innerHTML = `
        <div class="p-3 rounded bg-dark border border-secondary mt-2">
            <h4 class="text-cyan fw-bold mb-1"><i class="fa-solid fa-check"></i> Recomendado: ${rec.mat}</h4>
            <p class="text-xs text-dim mb-0">${rec.desc}</p>
            ${tipHtml}
        </div>
    `;
}

// QR Scanner - closeQRScanner already defined at L3027 with proper camera cleanup
function saveWastageLog() { closeModal('modal-wastage'); showToast('Desperdicio registrado en métricas', 'info'); }

// ==========================================================================
// 11. Alerts & System Utilities
// ==========================================================================
function toggleDarkMode() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('PRINT3D_THEME', isLight ? 'light' : 'dark');
    const btn = document.getElementById('btn-dark-mode');
    if (btn) {
        btn.innerHTML = isLight ? '<i class="fa-solid fa-moon"></i> Modo Oscuro' : '<i class="fa-solid fa-circle-half-stroke"></i> Tema';
    }
    showToast(isLight ? 'Modo Claro activado' : 'Modo Oscuro activado', 'info');
}

function checkDeadlineAlerts() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    state.orders.forEach(o => {
        if (o.status !== 'Entregado' && o.deadline) {
            if (o.deadline === today) {
                showToast(`⚠️ ¡El encargo "${o.title}" vence HOY!`, 'warning');
                playChime('alert');
            } else if (o.deadline === tomorrow) {
                showToast(`⏰ Encargo "${o.title}" vence mañana`, 'info');
            }
        }
    });
}

function checkLowStockAlerts() {
    state.filaments.forEach(f => {
        const pct = (f.currentWeight / (f.maxWeight || 1000));
        if (pct < 0.2) {
            showToast(`⚠️ Filamento bajo: ${f.brand} ${f.colorName} (${f.currentWeight}g restantes)`, 'warning');
        }
    });
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = type === 'success' ? '#065f46' : (type === 'error' ? '#991b1b' : (type === 'warning' ? '#92400e' : '#1e293b'));
    toast.style.color = '#fff';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    toast.style.fontSize = '13.5px';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.border = '1px solid rgba(255,255,255,0.15)';
    toast.style.animation = 'fadeInUp 0.3s ease';

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    if (type === 'warning') icon = 'fa-bell';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(msg)}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 75, spread: 65, origin: { y: 0.65 } });
    }
}

function exportStateJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `print3d_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Copia de seguridad JSON descargada', 'success');
}

function importStateJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            state = JSON.parse(evt.target.result);
            saveState();
            renderAll();
            showToast('Base de datos restaurada correctamente', 'success');
            playChime('success');
        } catch (err) {
            showToast('Error al importar el archivo JSON', 'error');
        }
    };
    reader.readAsText(file);
}

function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getBadgeClass(status) {
    switch (status) {
        case 'Presupuesto': return 'bg-amber';
        case 'En Cola': return 'bg-cyan';
        case 'Imprimiendo': return 'bg-primary';
        case 'Post-Proceso': return 'bg-purple';
        case 'Listo': return 'bg-emerald';
        case 'Entregado': return 'bg-success';
        case 'VIP': return 'bg-amber';
        case 'Empresa': return 'bg-cyan';
        default: return 'bg-secondary';
    }
}

// ==========================================================================
// 12. New Workshop Productivity Enhancements:
//     - 1-Click Quick Backup with Date Tracking
//     - Formal Budget / Quote PDF Generation & WhatsApp Sharing
//     - Mobile / PWA Wi-Fi Access Guide
//     - Real-Time Electricity Tariff Workshop Configuration
// ==========================================================================

// 1. Quick Backup with Date & Reminder
function quickBackupWorkshop() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}m`;
    state.lastBackupDate = now.toISOString();
    saveState();
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `copia-seguridad-taller-3d_${timestamp}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    showToast('Copia de seguridad guardada con éxito', 'success');
    playChime('success');
    renderWorkshopAlerts();
}

// 2. Formal Customer Budget Modal & WhatsApp
window._activeBudgetData = null;

function openBudgetModal(orderId) {
    const o = state.orders.find(x => x.id === orderId);
    if (!o) return;
    
    const client = state.clients?.find(c => c.name.toLowerCase() === (o.client || '').toLowerCase());
    const filament = state.filaments.find(f => f.id === o.filamentId);
    const filName = filament ? `${filament.brand} ${filament.material} (${filament.colorName})` : 'PLA+ Estándar';
    
    const priceNum = parseFloat(o.price || 0);
    const subtotal = priceNum / 1.21;
    const iva = priceNum - subtotal;
    
    const refId = `PRE-${(o.id || '001').substring(0, 8).toUpperCase()}`;
    const dateFormatted = o.date ? new Date(o.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('es-ES');
    
    const refEl = document.getElementById('budget-ref-id');
    const dateEl = document.getElementById('budget-date');
    const clientNameEl = document.getElementById('budget-client-name');
    const clientContactEl = document.getElementById('budget-client-contact');
    const itemTitleEl = document.getElementById('budget-item-title');
    const itemSpecsEl = document.getElementById('budget-item-specs');
    
    if (refEl) refEl.textContent = refId;
    if (dateEl) dateEl.textContent = dateFormatted;
    if (clientNameEl) clientNameEl.textContent = o.client || 'Cliente Particular';
    if (clientContactEl) clientContactEl.textContent = client ? `${client.email || ''} ${client.phone || ''}`.trim() || 'Cliente Registrado' : 'Cliente Particular';
    if (itemTitleEl) itemTitleEl.textContent = o.title || 'Fabricación 3D Personalizada';
    if (itemSpecsEl) itemSpecsEl.textContent = `Peso estimado: ${o.weight || 0}g • Tiempo de impresión: ${o.time || 0} horas`;
    
    const tbody = document.getElementById('budget-table-items');
    if (tbody) {
        tbody.innerHTML = `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td class="p-2">
                    <strong>${escapeHtml(o.title || 'Pieza 3D a medida')}</strong>
                    <div class="text-xs text-muted">Impresión aditiva de precisión, inspección visual y desbarbado</div>
                </td>
                <td class="p-2 text-center">${escapeHtml(filName)}</td>
                <td class="p-2 text-center">${o.time || 0}h</td>
                <td class="p-2 text-center">1 ud</td>
                <td class="p-2 text-end fw-bold">${priceNum.toFixed(2)} €</td>
            </tr>
        `;
    }
    
    const subEl = document.getElementById('budget-subtotal');
    const ivaEl = document.getElementById('budget-iva');
    const totEl = document.getElementById('budget-total');
    if (subEl) subEl.textContent = `${subtotal.toFixed(2)} €`;
    if (ivaEl) ivaEl.textContent = `${iva.toFixed(2)} €`;
    if (totEl) totEl.textContent = `${priceNum.toFixed(2)} €`;

    // 15-day commercial validity calculation
    const orderDateObj = o.date ? new Date(o.date) : new Date();
    const expiryDateObj = new Date(orderDateObj.getTime() + 15 * 24 * 60 * 60 * 1000);
    const expiryFormatted = expiryDateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    const expiryEl = document.getElementById('budget-expiry-date');
    const termsExpiryEl = document.getElementById('budget-terms-expiry');
    if (expiryEl) expiryEl.textContent = expiryFormatted;
    if (termsExpiryEl) termsExpiryEl.textContent = expiryFormatted;
    
    window._activeBudgetData = {
        ref: refId,
        client: o.client,
        title: o.title,
        price: priceNum.toFixed(2),
        material: filName,
        phone: client?.phone || '',
        expiry: expiryFormatted
    };
    
    openModal('modal-budget-pdf');
}

function openCalcBudgetModal() {
    const itemName = document.getElementById('calc-item-name')?.value?.trim() || 'Pieza 3D Calculada';
    const weight = parseFloat(document.getElementById('calc-weight')?.value) || 0;
    const time = parseFloat(document.getElementById('calc-time')?.value) || 0;
    const suggestedPriceEl = document.getElementById('calc-suggested-price');
    const priceNum = parseFloat(suggestedPriceEl ? suggestedPriceEl.textContent.replace('€', '').trim() : 0) || 15.00;
    
    const subtotal = priceNum / 1.21;
    const iva = priceNum - subtotal;
    const refId = `PRE-CALC-${Math.floor(1000 + Math.random() * 9000)}`;
    const dateFormatted = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const refEl = document.getElementById('budget-ref-id');
    const dateEl = document.getElementById('budget-date');
    const clientNameEl = document.getElementById('budget-client-name');
    const clientContactEl = document.getElementById('budget-client-contact');
    const itemTitleEl = document.getElementById('budget-item-title');
    const itemSpecsEl = document.getElementById('budget-item-specs');
    
    if (refEl) refEl.textContent = refId;
    if (dateEl) dateEl.textContent = dateFormatted;
    if (clientNameEl) clientNameEl.textContent = 'Cliente Solicitante (Presupuesto Rápido)';
    if (clientContactEl) clientContactEl.textContent = 'Emitido directamente desde la Calculadora de Taller';
    if (itemTitleEl) itemTitleEl.textContent = itemName;
    if (itemSpecsEl) itemSpecsEl.textContent = `Peso estimado: ${weight}g • Tiempo de impresión: ${time} horas`;
    
    const tbody = document.getElementById('budget-table-items');
    if (tbody) {
        tbody.innerHTML = `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td class="p-2">
                    <strong>${escapeHtml(itemName)}</strong>
                    <div class="text-xs text-muted">Prototipado / Fabricación 3D según especificaciones de cotización</div>
                </td>
                <td class="p-2 text-center">Filamento Seleccionado</td>
                <td class="p-2 text-center">${time}h</td>
                <td class="p-2 text-center">1 ud</td>
                <td class="p-2 text-end fw-bold">${priceNum.toFixed(2)} €</td>
            </tr>
        `;
    }
    
    const subEl = document.getElementById('budget-subtotal');
    const ivaEl = document.getElementById('budget-iva');
    const totEl = document.getElementById('budget-total');
    if (subEl) subEl.textContent = `${subtotal.toFixed(2)} €`;
    if (ivaEl) ivaEl.textContent = `${iva.toFixed(2)} €`;
    if (totEl) totEl.textContent = `${priceNum.toFixed(2)} €`;

    // 15-day commercial validity calculation
    const todayObj = new Date();
    const expiryDateObj = new Date(todayObj.getTime() + 15 * 24 * 60 * 60 * 1000);
    const expiryFormatted = expiryDateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    const expiryEl = document.getElementById('budget-expiry-date');
    const termsExpiryEl = document.getElementById('budget-terms-expiry');
    if (expiryEl) expiryEl.textContent = expiryFormatted;
    if (termsExpiryEl) termsExpiryEl.textContent = expiryFormatted;
    
    window._activeBudgetData = {
        ref: refId,
        client: 'Cliente',
        title: itemName,
        price: priceNum.toFixed(2),
        material: 'Filamento de Taller',
        phone: '',
        expiry: expiryFormatted
    };
    
    openModal('modal-budget-pdf');
}

function sendActiveBudgetWhatsApp() {
    if (!window._activeBudgetData) return;
    const d = window._activeBudgetData;
    const msg = `¡Hola! Le enviamos el presupuesto formal de impresión 3D para "${d.title}":\n\n` +
                `📋 *Ref:* ${d.ref}\n` +
                `📦 *Pieza:* ${d.title} (${d.material})\n` +
                `💰 *Precio Total:* ${d.price} € (IVA incl.)\n` +
                `📅 *Validez comercial:* 15 días laborables (hasta el ${d.expiry || '15 días'}) sujeto a disponibilidad de cola del taller.\n\n` +
                `¿Desea confirmarlo para que lo pongamos en cola de impresión en el taller? ¡Muchas gracias!`;
    const phoneClean = (d.phone || '').replace(/[^0-9]/g, '');
    const url = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// 3. Mobile PWA Access Guide
function openMobileGuideModal() {
    const urlEl = document.getElementById('mobile-guide-url');
    if (urlEl) {
        urlEl.textContent = 'Detectando IP local...';
        fetch('/api/info')
            .then(res => res.json())
            .then(data => {
                if (data && data.url) {
                    urlEl.textContent = data.url;
                } else {
                    urlEl.textContent = window.location.origin;
                }
            })
            .catch(() => {
                urlEl.textContent = window.location.origin.includes('localhost') 
                    ? 'http://192.168.1.76:8080' 
                    : window.location.origin;
            });
    }
    openModal('modal-mobile-guide');
}

function copyMobileGuideUrl() {
    const urlEl = document.getElementById('mobile-guide-url');
    if (urlEl) {
        const text = urlEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Dirección del taller copiada al portapapeles', 'success');
        }).catch(() => {
            showToast(`Copia la dirección: ${text}`, 'info');
        });
    }
}

// 4. Electricity Tariff Config
function openElectricityConfigModal() {
    const input = document.getElementById('electricity-tariff-input');
    const curVal = parseFloat(state.electricityTariff) || 0.18;
    if (input) input.value = curVal;
    updateTariffPreview(curVal);
    openModal('modal-electricity-config');
}

function setTariffPreset(val) {
    const input = document.getElementById('electricity-tariff-input');
    if (input) input.value = val;
    updateTariffPreview(val);
}

function updateTariffPreview(val) {
    const num = parseFloat(val) || 0.18;
    const previewEl = document.getElementById('preview-cost-per-hour');
    if (previewEl) previewEl.textContent = (num * 0.25).toFixed(3);
}

function saveElectricityConfig() {
    const input = document.getElementById('electricity-tariff-input');
    const val = parseFloat(input?.value) || 0.18;
    state.electricityTariff = val;
    
    // Update default electricity cost on all printers
    if (state.printers) {
        state.printers.forEach(p => {
            p.kwhPrice = val;
        });
    }
    
    // Update header label
    const headerTariff = document.getElementById('header-tariff-val');
    if (headerTariff) headerTariff.textContent = `${val.toFixed(2)} €/kWh`;
    
    saveState();
    calculateQuote();
    renderPrinters();
    renderDashboard();
    closeModal('modal-electricity-config');
    showToast(`Tarifa eléctrica actualizada a ${val.toFixed(2)} €/kWh para todo el taller`, 'success');
}

// Global window bindings for inline HTML handlers
window.quickBackupWorkshop = quickBackupWorkshop;
window.openBudgetModal = openBudgetModal;
window.openCalcBudgetModal = openCalcBudgetModal;
window.sendActiveBudgetWhatsApp = sendActiveBudgetWhatsApp;
window.openMobileGuideModal = openMobileGuideModal;
window.copyMobileGuideUrl = copyMobileGuideUrl;
window.openElectricityConfigModal = openElectricityConfigModal;
window.setTariffPreset = setTariffPreset;
window.updateTariffPreview = updateTariffPreview;
window.saveElectricityConfig = saveElectricityConfig;

// ==========================================================================
// 13. Advanced Workshop Mastery Features (3, 10, 11, 12, 13, 15, 17, 18, 19, 20)
// ==========================================================================

// FEATURE 17: Meta Mensual de Beneficio (Sueldo del Taller)
function promptMonthlyGoal() {
    const cur = state.monthlyProfitGoal || 1200;
    const val = prompt('Introduce tu meta mensual de beneficio neto limpio para tu taller (€):', cur);
    if (val !== null) {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
            state.monthlyProfitGoal = num;
            saveState();
            renderMonthlyGoal();
            showToast(`Meta mensual de beneficio fijada en ${num.toFixed(2)} €`, 'success');
        }
    }
}

function renderMonthlyGoal() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    
    const monthOrders = state.orders.filter(o => {
        if (!o.date) return false;
        const d = new Date(o.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const monthRevenue = monthOrders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
    
    const monthExpensesList = state.expenses.filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const monthExpenses = monthExpensesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const monthProfit = monthRevenue - monthExpenses;
    
    const target = parseFloat(state.monthlyProfitGoal) || 1200;
    const pct = Math.min(100, Math.max(0, Math.round((monthProfit / target) * 100)));
    
    const curEl = document.getElementById('dash-goal-current');
    const targetEl = document.getElementById('dash-goal-target');
    const fillEl = document.getElementById('dash-goal-progress-fill');
    const pctEl = document.getElementById('dash-goal-percent');
    const msgEl = document.getElementById('dash-goal-message');
    
    if (curEl) curEl.textContent = `${monthProfit.toFixed(2)} €`;
    if (targetEl) targetEl.textContent = `${target.toFixed(2)} €`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}% conseguido`;
    
    if (msgEl) {
        if (monthProfit >= target) {
            msgEl.innerHTML = `<span class="text-emerald fw-bold"><i class="fa-solid fa-trophy mr-1"></i> ¡Objetivo mensual superado en ${(monthProfit - target).toFixed(2)} €!</span>`;
        } else {
            const diff = target - monthProfit;
            msgEl.textContent = `Te faltan ${diff.toFixed(2)} € de beneficio para alcanzar tu meta de este mes.`;
        }
    }
}

// FEATURE 3: Calculadora de Coste de Fallos Mensual (€ tirados a la basura)
function renderWastageLossSummary() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    
    const logs = (state.wastageLogs || []).filter(l => {
        if (!l.date) return true;
        const d = new Date(l.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    
    const totalGrams = logs.reduce((s, l) => s + (parseFloat(l.grams) || 0), 0);
    const totalHours = logs.reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
    
    const tariff = parseFloat(state.electricityTariff) || 0.18;
    const filCost = (totalGrams / 1000) * 20;
    const powerCost = totalHours * 0.25 * tariff;
    const totalLoss = filCost + powerCost;
    
    const costEl = document.getElementById('wastage-month-cost');
    const gramsEl = document.getElementById('wastage-month-grams');
    const hoursEl = document.getElementById('wastage-month-hours');
    const topEl = document.getElementById('wastage-top-cause');
    
    if (costEl) costEl.textContent = `${totalLoss.toFixed(2)} €`;
    if (gramsEl) gramsEl.textContent = `${totalGrams.toFixed(0)} g`;
    if (hoursEl) hoursEl.textContent = `${totalHours.toFixed(1)} h`;
    
    if (topEl) {
        if (logs.length === 0) {
            topEl.innerHTML = `Causa principal este mes: <em>Sin fallos registrados</em>`;
        } else {
            const causes = {};
            logs.forEach(l => causes[l.reason] = (causes[l.reason] || 0) + 1);
            let topC = Object.keys(causes).reduce((a, b) => causes[a] > causes[b] ? a : b);
            topEl.innerHTML = `Causa más frecuente: <strong class="text-amber">${escapeHtml(topC)}</strong> (${causes[topC]} veces)`;
        }
    }
}

// FEATURE 18: Calculadora de Costes Fijos del Taller por Hora
function renderHourlyFixedCosts() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    
    const fixedExpenses = state.expenses.filter(e => {
        const isCat = (e.category || '').toLowerCase().includes('fijo');
        if (!isCat) return false;
        if (!e.date) return true;
        const d = new Date(e.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const fixedSum = fixedExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    
    const monthOrders = state.orders.filter(o => {
        if (!o.date) return true;
        const d = new Date(o.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const totalHours = monthOrders.reduce((s, o) => s + (parseFloat(o.time) || 0), 0);
    
    const hourlyCost = totalHours > 0 ? (fixedSum / totalHours) : (fixedSum > 0 ? fixedSum / 100 : 0);
    
    const totEl = document.getElementById('fixed-month-total');
    const hrsEl = document.getElementById('fixed-month-hours');
    const valEl = document.getElementById('fixed-cost-per-hour-val');
    const badgeEl = document.getElementById('fixed-hourly-badge');
    
    if (totEl) totEl.textContent = `${fixedSum.toFixed(2)} €`;
    if (hrsEl) hrsEl.textContent = `${totalHours.toFixed(1)} h`;
    if (valEl) valEl.textContent = hourlyCost.toFixed(2);
    if (badgeEl) badgeEl.textContent = `${hourlyCost.toFixed(2)} €/h`;
}

function applyFixedHourlyCostToCalculator() {
    const valEl = document.getElementById('fixed-cost-per-hour-val');
    const hourlyRate = parseFloat(valEl ? valEl.textContent : 0) || 0;
    state.hourlyFixedCost = hourlyRate;
    saveState();
    calculateQuote();
    showToast(`Coste de estructura (+${hourlyRate.toFixed(2)} €/h) vinculado a la calculadora`, 'success');
}

// FEATURE 11 & MEJORA 3: Descuentos por Volumen / Escala de Precios & Cotizador de Lotes
function renderVolumeTiers() {
    const tbody = document.getElementById('calc-volume-tiers-body');
    if (!tbody) return;
    
    const suggestedPriceEl = document.getElementById('calc-suggested-price');
    const basePrice = parseFloat(suggestedPriceEl ? suggestedPriceEl.textContent.replace('€', '').trim() : 0) || 15.00;
    const unitWeight = parseFloat(document.getElementById('calc-weight')?.value) || 50;
    const unitTime = parseFloat(document.getElementById('calc-time')?.value) || 2.0;

    const kwhCost = parseFloat(state.electricityTariff) || 0.18;
    const machineWear = 0.20;
    const costPerKg = 20.0;
    const unitCost = (unitWeight / 1000) * costPerKg + unitTime * (0.25 * kwhCost + machineWear);
    
    const tiers = [
        { qty: '1 ud (Muestra)', count: 1, disc: 0, factor: 1.0 },
        { qty: '5 uds', count: 5, disc: 10, factor: 0.90 },
        { qty: '10 uds', count: 10, disc: 15, factor: 0.85 },
        { qty: '25 uds', count: 25, disc: 22, factor: 0.78 },
        { qty: '50 uds (Tirada)', count: 50, disc: 32, factor: 0.68 },
        { qty: '100 uds (Lote)', count: 100, disc: 40, factor: 0.60 }
    ];
    
    tbody.innerHTML = tiers.map(t => {
        const unitPvp = basePrice * t.factor;
        const totalPvp = unitPvp * t.count;
        const totalBatchCost = unitCost * t.count;
        const netProfit = Math.max(0, totalPvp - totalBatchCost);

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td class="py-1"><strong>${t.qty}</strong></td>
                <td class="py-1 text-center"><span class="badge ${t.disc > 0 ? 'bg-cyan' : 'bg-secondary'}" style="font-size:10px;">${t.disc > 0 ? `-${t.disc}%` : 'Base'}</span></td>
                <td class="py-1 text-end font-mono text-emerald fw-bold">${unitPvp.toFixed(2)} €</td>
                <td class="py-1 text-end font-mono text-white">${totalPvp.toFixed(2)} €</td>
                <td class="py-1 text-end font-mono text-emerald fw-bold">+${netProfit.toFixed(1)} €</td>
                <td class="py-1 text-center">
                    <button type="button" class="btn btn-outline btn-xs text-cyan" onclick="convertTierToOrder(${t.count}, ${unitPvp.toFixed(2)})" title="Crear encargo para este lote (${t.count} uds)" style="padding: 1px 6px;">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function convertTierToOrder(qty, unitPrice) {
    const itemName = document.getElementById('calc-item-name')?.value?.trim() || 'Pieza en Lote';
    const unitWeight = parseFloat(document.getElementById('calc-weight')?.value) || 50;
    const unitTime = parseFloat(document.getElementById('calc-time')?.value) || 2.0;

    const totalWeight = Math.round(unitWeight * qty);
    const totalTime = parseFloat((unitTime * qty).toFixed(1));
    const totalPrice = parseFloat((unitPrice * qty).toFixed(2));

    switchTab('tab-orders');
    openOrderModalWithDefaults();

    setTimeout(() => {
        const itemInput = document.getElementById('order-item');
        const weightInput = document.getElementById('order-weight');
        const timeInput = document.getElementById('order-time');
        const priceInput = document.getElementById('order-price');

        if (itemInput) itemInput.value = `Tirada de ${qty} uds: ${itemName}`;
        if (weightInput) weightInput.value = totalWeight;
        if (timeInput) timeInput.value = totalTime;
        if (priceInput) priceInput.value = totalPrice;

        showToast(`Lote de ${qty} unidades volcado en el nuevo encargo`, 'success');
        playChime('success');
    }, 60);
}

function copyVolumeTiersToClipboard() {
    const itemName = document.getElementById('calc-item-name')?.value?.trim() || 'Pieza 3D a medida';
    const suggestedPriceEl = document.getElementById('calc-suggested-price');
    const basePrice = parseFloat(suggestedPriceEl ? suggestedPriceEl.textContent.replace('€', '').trim() : 0) || 15.00;
    
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 15);
    const expiryFormatted = expiry.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    const text = `📋 *Escala de Precios por Volumen — ${itemName}*\n` +
                 `• 1 unidad (Muestra): ${basePrice.toFixed(2)} €/ud\n` +
                 `• 5 unidades: ${(basePrice * 0.90).toFixed(2)} €/ud (Total: ${(basePrice * 0.90 * 5).toFixed(2)} €)\n` +
                 `• 10 unidades: ${(basePrice * 0.85).toFixed(2)} €/ud (Total: ${(basePrice * 0.85 * 10).toFixed(2)} €)\n` +
                 `• 25 unidades: ${(basePrice * 0.78).toFixed(2)} €/ud (Total: ${(basePrice * 0.78 * 25).toFixed(2)} €)\n` +
                 `• 50 unidades: ${(basePrice * 0.68).toFixed(2)} €/ud (Total: ${(basePrice * 0.68 * 50).toFixed(2)} €)\n` +
                 `• 100 unidades: ${(basePrice * 0.60).toFixed(2)} €/ud (Total: ${(basePrice * 0.60 * 100).toFixed(2)} €)\n\n` +
                 `_Precios con IVA incluido. Validez comercial: 15 días laborables (hasta el ${expiryFormatted}) en Print3D Studio._`;
                 
    navigator.clipboard.writeText(text).then(() => {
        showToast('Oferta por volumen copiada para enviar por WhatsApp', 'success');
    }).catch(() => {
        showToast('Texto de oferta preparado', 'info');
    });
}

// SIMULADOR DE GRANDES TIRADAS Y LOTES COMERCIALES
let currentBatchQuoteData = null;

function openBatchQuoteModal() {
    const itemName = document.getElementById('calc-item-name')?.value?.trim() || 'Lote de Piezas 3D';
    const weight = parseFloat(document.getElementById('calc-weight')?.value) || 40;
    const time = parseFloat(document.getElementById('calc-time')?.value) || 1.5;
    const suggestedPriceEl = document.getElementById('calc-suggested-price');
    const basePrice = parseFloat(suggestedPriceEl ? suggestedPriceEl.textContent.replace('€', '').trim() : 0) || 8.00;

    const nameInp = document.getElementById('batch-item-name');
    const wInp = document.getElementById('batch-unit-weight');
    const tInp = document.getElementById('batch-unit-time');
    const pInp = document.getElementById('batch-unit-base-price');

    if (nameInp) nameInp.value = itemName;
    if (wInp) wInp.value = weight;
    if (tInp) tInp.value = time;
    if (pInp) pInp.value = basePrice;

    calculateBatchQuote();
    openModal('modal-batch-quote');
}

function setBatchQty(qty) {
    const qInp = document.getElementById('batch-quantity');
    if (qInp) qInp.value = qty;
    calculateBatchQuote();
}

function calculateBatchQuote() {
    const itemName = document.getElementById('batch-item-name')?.value?.trim() || 'Pieza en Lote';
    const qty = parseInt(document.getElementById('batch-quantity')?.value, 10) || 25;
    const unitWeight = parseFloat(document.getElementById('batch-unit-weight')?.value) || 40;
    const unitTime = parseFloat(document.getElementById('batch-unit-time')?.value) || 1.5;
    const unitBasePrice = parseFloat(document.getElementById('batch-unit-base-price')?.value) || 8.00;

    // Progressive discounts by volume
    let discountPct = 0;
    if (qty >= 100) discountPct = 38;
    else if (qty >= 50) discountPct = 30;
    else if (qty >= 25) discountPct = 22;
    else if (qty >= 10) discountPct = 15;
    else if (qty >= 5) discountPct = 8;

    const unitFinalPrice = Math.max(1.5, parseFloat((unitBasePrice * (1 - discountPct / 100)).toFixed(2)));
    const totalPrice = parseFloat((unitFinalPrice * qty).toFixed(2));

    const totalWeightKg = parseFloat(((unitWeight * qty) / 1000).toFixed(2));
    const totalHours = parseFloat((unitTime * qty).toFixed(1));

    const kwhCost = parseFloat(state.electricityTariff) || 0.18;
    const machineWear = 0.20;
    const costPerKg = 20.0;
    const totalProductionCost = parseFloat((totalWeightKg * costPerKg + totalHours * (0.25 * kwhCost + machineWear)).toFixed(2));
    const netProfit = Math.max(0, parseFloat((totalPrice - totalProductionCost).toFixed(2)));

    // Production multi-machine in parallel
    const parallelCount = parseInt(document.getElementById('batch-parallel-printers')?.value, 10) || 1;
    const parallelHours = parseFloat((totalHours / parallelCount).toFixed(1));
    const daysNeeded = Math.max(1, Math.ceil(parallelHours / 10));

    currentBatchQuoteData = {
        name: itemName,
        qty,
        unitBasePrice,
        unitFinalPrice,
        discountPct,
        totalPrice,
        totalWeightKg,
        totalHours,
        parallelHours,
        parallelCount,
        totalProductionCost,
        netProfit,
        daysNeeded
    };

    const filEl = document.getElementById('batch-total-filament');
    const hoursEl = document.getElementById('batch-total-hours');
    const costEl = document.getElementById('batch-total-cost');
    const profitEl = document.getElementById('batch-net-profit');
    const unitFinalEl = document.getElementById('batch-unit-final-price');
    const totalPricEl = document.getElementById('batch-total-price');

    if (filEl) filEl.textContent = `${totalWeightKg} kg`;
    if (hoursEl) hoursEl.textContent = parallelCount > 1 ? `${totalHours}h (~${parallelHours}h / ${parallelCount} máq.)` : `${totalHours} h`;
    if (costEl) costEl.textContent = `${totalProductionCost.toFixed(2)} €`;
    if (profitEl) profitEl.textContent = `+${netProfit.toFixed(2)} €`;
    if (unitFinalEl) unitFinalEl.innerHTML = `${unitFinalPrice.toFixed(2)} €/ud <span class="badge bg-cyan text-xs ml-1" id="batch-discount-badge">-${discountPct}%</span>`;
    if (totalPricEl) totalPricEl.textContent = `${totalPrice.toFixed(2)} €`;

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 15);
    const expiryFormatted = expiry.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    const msg = `¡Hola! 👋 Propuesta formal por volumen para la producción de *${qty} unidades* de *"${itemName}"*:\n\n` +
                `📦 *Cantidad:* ${qty} unidades\n` +
                `🏷️ *Precio unitario:* ${unitFinalPrice.toFixed(2)} €/ud (Descuento de lote aplicado: -${discountPct}%)\n` +
                `💰 *TOTAL DEL LOTE:* ${totalPrice.toFixed(2)} € (IVA incl.)\n` +
                `⏱️ *Plazo de fabricación estimado:* ~${daysNeeded} días laborables${parallelCount > 1 ? ` (repartido en ${parallelCount} impresoras en paralelo para máxima rapidez)` : ''}\n\n` +
                `📅 *Validez del presupuesto:* 15 días laborables (hasta el ${expiryFormatted}) sujeto a cola de taller.\n\n` +
                `¿Deseas confirmarlo para reservar bobinas y programar las impresoras? 🚀`;

    const msgEl = document.getElementById('batch-whatsapp-msg');
    if (msgEl) msgEl.value = msg;
}

function copyBatchQuoteWhatsApp() {
    const msgEl = document.getElementById('batch-whatsapp-msg');
    if (!msgEl || !msgEl.value) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(msgEl.value).then(() => {
            showToast('📋 ¡Oferta de tirada copiada para WhatsApp!', 'success');
        }).catch(() => {
            msgEl.select();
            document.execCommand('copy');
            showToast('📋 Oferta copiada', 'success');
        });
    } else {
        msgEl.select();
        document.execCommand('copy');
        showToast('📋 Oferta copiada', 'success');
    }
    playChime('success');
}

function sendBatchQuoteWhatsApp() {
    const msgEl = document.getElementById('batch-whatsapp-msg');
    if (!msgEl || !msgEl.value) return;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msgEl.value)}`;
    window.open(waUrl, '_blank');
}

function convertBatchToOrder() {
    if (!currentBatchQuoteData) return;
    const d = currentBatchQuoteData;
    closeModal('modal-batch-quote');
    switchTab('tab-orders');
    openOrderModalWithDefaults();

    setTimeout(() => {
        const itemInput = document.getElementById('order-item');
        const weightInput = document.getElementById('order-weight');
        const timeInput = document.getElementById('order-time');
        const priceInput = document.getElementById('order-price');

        if (itemInput) itemInput.value = `Tirada de ${d.qty} uds: ${d.name}`;
        if (weightInput) weightInput.value = Math.round(d.totalWeightKg * 1000);
        if (timeInput) timeInput.value = d.totalHours;
        if (priceInput) priceInput.value = d.totalPrice;

        showToast(`Tirada de ${d.qty} unidades volcada al formulario de encargo`, 'success');
        playChime('success');
    }, 60);
}

// FEATURE 15: Estimador de Fecha de Entrega Realista según Cola del Taller
function calculateQueueDeliveryEstimate(additionalHours = 0) {
    const estEl = document.getElementById('order-queue-estimate');
    if (!estEl) return;
    
    const queuedOrders = state.orders.filter(o => o.status === 'En Cola' || o.status === 'Imprimiendo');
    const totalQueuedHours = queuedOrders.reduce((s, o) => s + (parseFloat(o.time) || 0), 0);
    const totalHoursToWork = totalQueuedHours + (parseFloat(additionalHours) || 0);
    
    const printersCount = Math.max(1, state.printers.length);
    const dailyWorkingHours = printersCount * 10;
    const daysNeeded = totalHoursToWork / dailyWorkingHours;
    
    const estDate = new Date();
    estDate.setTime(estDate.getTime() + (daysNeeded * 24 * 60 * 60 * 1000));
    
    const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    const dateFormatted = estDate.toLocaleDateString('es-ES', options);
    
    estEl.style.display = 'block';
    estEl.innerHTML = `<i class="fa-solid fa-clock-rotate-left mr-1"></i> Cola: <strong>${totalQueuedHours.toFixed(1)}h</strong> pendientes. Con ${printersCount} máquinas, disponible aprox.: <strong class="text-white">${dateFormatted}</strong>`;
    
    window._lastEstimatedQueueDate = estDate;
}

function checkOrderDeadlineFeasibility() {
    const deadlineInput = document.getElementById('order-deadline')?.value;
    const estEl = document.getElementById('order-queue-estimate');
    if (!estEl) return;

    // Reset base estimate first
    const timeVal = parseFloat(document.getElementById('order-time')?.value) || 0;
    calculateQueueDeliveryEstimate(timeVal);

    if (!deadlineInput || !window._lastEstimatedQueueDate) return;
    
    const deadlineDate = new Date(deadlineInput + 'T23:59:59');
    if (deadlineDate < window._lastEstimatedQueueDate) {
        estEl.classList.remove('text-cyan');
        estEl.classList.add('text-amber');
        estEl.innerHTML += ` <div class="mt-1"><span class="badge bg-amber text-dark">⚠️ ¡Atención! La fecha fijada es muy ajustada para la cola actual.</span></div>`;
    } else {
        estEl.classList.remove('text-amber');
        estEl.classList.add('text-cyan');
    }
}

// FEATURE 13: Garantía y Registro de Repetición (RMA)
function toggleOrderRMA(isRma) {
    const priceInput = document.getElementById('order-price');
    const wrap = document.getElementById('order-rma-reason-wrap');
    if (wrap) wrap.style.display = isRma ? 'block' : 'none';
    if (isRma) {
        if (priceInput) priceInput.value = '0.00';
    } else {
        calculateOrderSuggestedPrice();
    }
}

function duplicateOrderAsRMA(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    
    const newOrder = {
        ...o,
        id: generateId(),
        title: `[RMA] ${o.title}`,
        price: 0.00,
        status: 'En Cola',
        isRma: true,
        rmaReason: 'Garantía / Repetición por rotura o defecto',
        date: new Date().toISOString(),
        changelog: [{
            date: new Date().toISOString(),
            from: 'N/A',
            to: 'En Cola',
            note: 'Encargo de repetición gratuita creado bajo garantía (RMA)'
        }]
    };
    
    state.orders.push(newOrder);
    saveState();
    renderOrders();
    renderDashboard();
    showToast(`Encargo en garantía (RMA a 0€) añadido a la cola`, 'warning');
    playChime('alert');
}

// FEATURE 10: Mensajes Rápidos de Estado para WhatsApp
function openWhatsAppStatusModal(orderId) {
    const o = state.orders.find(x => x.id === orderId);
    if (!o) return;
    const idInput = document.getElementById('wa-status-order-id');
    if (idInput) idInput.value = orderId;
    openModal('modal-whatsapp-status');
}

function sendWhatsAppStatusTemplate(type) {
    const orderId = document.getElementById('wa-status-order-id')?.value;
    const o = state.orders.find(x => x.id === orderId);
    if (!o) return;
    
    const client = state.clients?.find(c => c.name.toLowerCase() === (o.client || '').toLowerCase());
    const phoneClean = (client?.phone || '').replace(/[^0-9]/g, '');
    let msg = '';
    
    const price = parseFloat(o.price || 0);
    const deposit = parseFloat(o.depositPaid || 0);
    const pending = Math.max(0, price - deposit);

    if (type === 'started') {
        msg = `¡Hola ${o.client}! 🚀 Tu encargo de impresión 3D "${o.title}" ya ha empezado a fabricarse en nuestro taller. Te avisaremos en cuanto esté listo. ¡Un saludo de Print3D Studio!`;
    } else if (type === 'ready') {
        if (deposit >= price && price > 0) {
            msg = `¡Hola ${o.client}! ✅ Tu pieza 3D "${o.title}" ha finalizado la impresión y ha superado el control de calidad. Ya puedes pasar a recogerla por el taller (está totalmente pagada al 100%). ¡Muchas gracias!`;
        } else if (deposit > 0) {
            msg = `¡Hola ${o.client}! ✅ Tu pieza 3D "${o.title}" ha finalizado la impresión y ha superado el control de calidad. Ya puedes pasar a recogerla por el taller. Total del pedido: ${price.toFixed(2)} € (ya abonada señal de ${deposit.toFixed(2)} € por ${o.paymentMethod || 'Bizum'}). Saldo restante a abonar: ${pending.toFixed(2)} €. ¡Muchas gracias!`;
        } else {
            msg = `¡Hola ${o.client}! ✅ Tu pieza 3D "${o.title}" ha finalizado la impresión y ha superado el control de calidad. Ya puedes pasar a recogerla por el taller. Total pendiente: ${price.toFixed(2)} €. ¡Muchas gracias!`;
        }
    } else if (type === 'shipped') {
        msg = `¡Hola ${o.client}! 📦 Tu pedido "${o.title}" ya ha sido cuidadosamente embalado y entregado a la agencia de transporte. Te llegará en breve. ¡Esperamos que disfrutes tu pieza!`;
    } else if (type === 'update') {
        msg = `¡Hola ${o.client}! 🔍 Te dejamos una actualización de tu pieza "${o.title}": la impresión avanza según lo previsto con excelentes acabados. ¡Seguimos trabajando en ella!`;
    } else if (type === 'care') {
        const filament = state.filaments?.find(f => f.id === o.filamentId);
        const mat = (filament?.material || 'PLA').toUpperCase();
        const tempTip = mat.includes('PLA') 
            ? 'Al estar fabricada en PLA, no la dejes dentro de un coche cerrado al sol en verano ni la metas al lavavajillas (>55ºC puede deformarse).'
            : 'Material de alta durabilidad técnica apto para uso continuado.';
            
        msg = `¡Hola ${o.client}! 🛠️ *Guía de cuidados y garantía de tu pieza 3D ("${o.title}")*:\n\n` +
              `1. ☀️ *Temperatura*: ${tempTip}\n` +
              `2. 🧼 *Limpieza*: Lavar con agua tibia y jabón neutro suave. No utilices acetona ni disolventes agresivos.\n` +
              `3. 🛡️ *Garantía de taller*: Tienes 30 días de garantía ante cualquier defecto de fabricación o fatiga prematura. Si surge cualquier problema, te la reimprimimos sin coste.\n\n` +
              `¡Que la disfrutes! Un saludo de Print3D Studio 🚀`;
    }
    
    const url = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    closeModal('modal-whatsapp-status');
}

function sendPieceCareInstructions(orderId) {
    const idInput = document.getElementById('wa-status-order-id');
    if (idInput) idInput.value = orderId;
    sendWhatsAppStatusTemplate('care');
}

// FEATURE 12: Albarán de Entrega sin Precios
function openDeliveryNoteModal(orderId) {
    const o = state.orders.find(x => x.id === orderId);
    if (!o) return;
    
    const client = state.clients?.find(c => c.name.toLowerCase() === (o.client || '').toLowerCase());
    const filament = state.filaments.find(f => f.id === o.filamentId);
    const filName = filament ? `${filament.brand} ${filament.material} (${filament.colorName})` : 'PLA+ Estándar';
    
    const refId = `ALB-${(o.id || '001').substring(0, 8).toUpperCase()}`;
    const dateFormatted = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    
    document.getElementById('delivery-ref-id').textContent = refId;
    document.getElementById('delivery-date').textContent = dateFormatted;
    document.getElementById('delivery-client-name').textContent = o.client || 'Cliente Particular';
    document.getElementById('delivery-client-info').textContent = client ? `${client.phone || ''} ${client.email || ''}`.trim() || 'Dirección de envío en paquete' : 'Entrega en mano / paquete';
    
    const tbody = document.getElementById('delivery-table-items');
    if (tbody) {
        tbody.innerHTML = `
            <tr style="border-bottom: 1px solid #cbd5e1;">
                <td class="p-2">
                    <strong>${escapeHtml(o.title || 'Pieza 3D')}</strong>
                    <div class="text-xs text-muted">Fabricación aditiva terminada y desbarbada</div>
                </td>
                <td class="p-2 text-center">${escapeHtml(filName)}</td>
                <td class="p-2 text-center">${o.weight || 0} g</td>
                <td class="p-2 text-center fw-bold">1 ud</td>
                <td class="p-2 text-center text-success"><i class="fa-solid fa-check-circle"></i> CONFORME</td>
            </tr>
        `;
    }
    
    openModal('modal-delivery-note');
}

// FEATURE 19: Detector de Piezas Trampa vs Piezas Estrella
function renderStarAndTrapPieces() {
    const starList = document.getElementById('star-pieces-list');
    const trapList = document.getElementById('trap-pieces-list');
    if (!starList || !trapList) return;
    
    if (state.orders.length === 0) {
        starList.innerHTML = `<div class="text-xs text-muted p-2">Registra pedidos para ver los más rentables.</div>`;
        trapList.innerHTML = `<div class="text-xs text-muted p-2">Sin datos de pedidos suficientes.</div>`;
        return;
    }
    
    const analyzed = state.orders.map(o => {
        const price = parseFloat(o.price || 0);
        const time = Math.max(0.5, parseFloat(o.time || 1));
        const weight = parseFloat(o.weight || 0);
        const filCost = (weight / 1000) * 20;
        const powerCost = time * 0.25 * (parseFloat(state.electricityTariff) || 0.18);
        const wearCost = time * 0.15;
        const costTotal = filCost + powerCost + wearCost;
        const netProfit = price - costTotal;
        const marginPct = costTotal > 0 ? (netProfit / costTotal) * 100 : 100;
        const hourlyNet = netProfit / time;
        return { order: o, price, time, weight, netProfit, marginPct, hourlyNet };
    });
    
    const stars = analyzed.filter(a => !a.order.isRma && a.hourlyNet >= 3.5).sort((a, b) => b.hourlyNet - a.hourlyNet).slice(0, 4);
    const traps = analyzed.filter(a => a.order.isRma || a.hourlyNet < 2.5).sort((a, b) => a.hourlyNet - b.hourlyNet).slice(0, 4);
    
    if (stars.length === 0) {
        starList.innerHTML = `<div class="text-xs text-muted p-2">Los pedidos actuales tienen un rendimiento estándar.</div>`;
    } else {
        starList.innerHTML = stars.map(s => `
            <div class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center text-xs">
                <div>
                    <strong class="text-white">${escapeHtml(s.order.title)}</strong>
                    <div class="text-dim text-xs">${escapeHtml(s.order.client)} • ${s.time}h de máquina</div>
                </div>
                <div class="text-end">
                    <span class="badge bg-emerald fw-bold">+${s.hourlyNet.toFixed(2)} €/h</span>
                    <div class="text-dim mt-1">+${s.netProfit.toFixed(2)} € limpios</div>
                </div>
            </div>
        `).join('');
    }
    
    if (traps.length === 0) {
        trapList.innerHTML = `<div class="text-xs text-muted p-2">¡Genial! No tienes piezas que dejen poco margen o pérdidas.</div>`;
    } else {
        trapList.innerHTML = traps.map(t => `
            <div class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center text-xs">
                <div>
                    <strong class="text-white">${escapeHtml(t.order.title)}</strong>
                    <div class="text-dim text-xs">${t.order.isRma ? '<span class="text-danger">Reimpresión RMA</span>' : `${escapeHtml(t.order.client)} • ${t.time}h`}</div>
                </div>
                <div class="text-end">
                    <span class="badge bg-danger fw-bold">${t.hourlyNet.toFixed(2)} €/h</span>
                    <div class="text-dim mt-1">${t.netProfit <= 0 ? 'Pérdida' : `Solo +${t.netProfit.toFixed(2)} €`}</div>
                </div>
            </div>
        `).join('');
    }
}

// FEATURE 20: Resumen Mensual de 1 Página para Gestor / Archivo Propio
function openMonthlyExecutiveReport() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const periodStr = `${monthNames[curMonth]} ${curYear}`;
    document.getElementById('mrep-period').textContent = periodStr;
    document.getElementById('mrep-date').textContent = now.toLocaleDateString('es-ES');
    
    const monthOrders = state.orders.filter(o => {
        if (!o.date) return true;
        const d = new Date(o.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    
    const grossRevenue = monthOrders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
    const baseRevenue = grossRevenue / 1.21;
    const ivaRevenue = grossRevenue - baseRevenue;
    
    const monthExpenses = state.expenses.filter(e => {
        if (!e.date) return true;
        const d = new Date(e.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const totalExpenses = monthExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const netProfit = grossRevenue - totalExpenses;
    const marginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    
    document.getElementById('mrep-kpi-revenue').textContent = `${grossRevenue.toFixed(2)} €`;
    document.getElementById('mrep-kpi-orders-count').textContent = `${monthOrders.length} encargos facturados`;
    document.getElementById('mrep-kpi-expenses').textContent = `${totalExpenses.toFixed(2)} €`;
    document.getElementById('mrep-kpi-profit').textContent = `${netProfit.toFixed(2)} €`;
    document.getElementById('mrep-kpi-margin').textContent = `Margen neto: ${marginPct.toFixed(1)}%`;
    
    document.getElementById('mrep-sales-base').textContent = `${baseRevenue.toFixed(2)} €`;
    document.getElementById('mrep-sales-iva').textContent = `${ivaRevenue.toFixed(2)} €`;
    document.getElementById('mrep-sales-total').textContent = `${grossRevenue.toFixed(2)} €`;
    
    const expCats = {};
    monthExpenses.forEach(e => expCats[e.category || 'Otros'] = (expCats[e.category || 'Otros'] || 0) + (parseFloat(e.amount) || 0));
    const expTbody = document.getElementById('mrep-expenses-table-body');
    if (expTbody) {
        if (Object.keys(expCats).length === 0) {
            expTbody.innerHTML = `<tr><td colspan="2" class="py-2 text-muted">Sin gastos registrados este mes</td></tr>`;
        } else {
            expTbody.innerHTML = Object.keys(expCats).map(cat => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td class="py-2">${escapeHtml(cat)}:</td>
                    <td class="py-2 text-end font-mono">${expCats[cat].toFixed(2)} €</td>
                </tr>
            `).join('') + `
                <tr>
                    <td class="py-2 fw-bold">Total Gastos de Explotación:</td>
                    <td class="py-2 text-end font-mono fw-bold text-danger">${totalExpenses.toFixed(2)} €</td>
                </tr>
            `;
        }
    }
    
    const totalHours = monthOrders.reduce((s, o) => s + (parseFloat(o.time) || 0), 0);
    const totalWeightKg = (monthOrders.reduce((s, o) => s + (parseFloat(o.weight) || 0), 0)) / 1000;
    
    const wastageLogs = (state.wastageLogs || []).filter(l => {
        if (!l.date) return true;
        const d = new Date(l.date);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const wasteGrams = wastageLogs.reduce((s, l) => s + (parseFloat(l.grams) || 0), 0);
    const wasteCost = (wasteGrams / 1000) * 20;
    
    document.getElementById('mrep-prod-hours').textContent = `${totalHours.toFixed(1)} h`;
    document.getElementById('mrep-prod-filament').textContent = `${totalWeightKg.toFixed(2)} kg`;
    document.getElementById('mrep-prod-waste').textContent = `${wasteGrams} g (${wasteCost.toFixed(2)} €)`;
    
    openModal('modal-monthly-report');
}

// Window bindings for all newly added functions
window.promptMonthlyGoal = promptMonthlyGoal;
window.renderMonthlyGoal = renderMonthlyGoal;
window.renderWastageLossSummary = renderWastageLossSummary;
window.renderHourlyFixedCosts = renderHourlyFixedCosts;
window.applyFixedHourlyCostToCalculator = applyFixedHourlyCostToCalculator;
window.renderVolumeTiers = renderVolumeTiers;
window.copyVolumeTiersToClipboard = copyVolumeTiersToClipboard;
window.calculateQueueDeliveryEstimate = calculateQueueDeliveryEstimate;
window.checkOrderDeadlineFeasibility = checkOrderDeadlineFeasibility;
window.toggleOrderRMA = toggleOrderRMA;
window.duplicateOrderAsRMA = duplicateOrderAsRMA;
window.openWhatsAppStatusModal = openWhatsAppStatusModal;
window.sendWhatsAppStatusTemplate = sendWhatsAppStatusTemplate;
window.openDeliveryNoteModal = openDeliveryNoteModal;
window.renderStarAndTrapPieces = renderStarAndTrapPieces;
window.openMonthlyExecutiveReport = openMonthlyExecutiveReport;

// ==========================================================================
// FEATURE: Buscador Global Rápido (Spotlight Ctrl+K)
// ==========================================================================
let currentGlobalSearchCategory = 'all';
let currentGlobalSearchResults = [];
let selectedGlobalSearchIndex = 0;

function openGlobalSearch() {
    const modal = document.getElementById('modal-global-search');
    if (!modal) return;
    modal.classList.add('active');
    const input = document.getElementById('global-search-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 60);
    }
    currentGlobalSearchCategory = 'all';
    document.querySelectorAll('.spotlight-filter-pill').forEach(pill => pill.classList.remove('active'));
    const firstPill = document.querySelector('.spotlight-filter-pill');
    if (firstPill) firstPill.classList.add('active');
    handleGlobalSearchInput('');
}

function closeGlobalSearch() {
    const modal = document.getElementById('modal-global-search');
    if (modal) modal.classList.remove('active');
}

function filterGlobalSearchCategory(cat, el) {
    currentGlobalSearchCategory = cat;
    document.querySelectorAll('.spotlight-filter-pill').forEach(pill => pill.classList.remove('active'));
    if (el) el.classList.add('active');
    const input = document.getElementById('global-search-input');
    handleGlobalSearchInput(input ? input.value : '');
}

function handleGlobalSearchInput(query) {
    const q = (query || '').toLowerCase().trim();
    const resultsContainer = document.getElementById('global-search-results');
    if (!resultsContainer) return;

    let items = [];

    // 1. Orders
    if (currentGlobalSearchCategory === 'all' || currentGlobalSearchCategory === 'orders') {
        (state.orders || []).forEach(o => {
            const match = !q || (o.title && o.title.toLowerCase().includes(q)) ||
                                (o.client && o.client.toLowerCase().includes(q)) ||
                                (o.id && o.id.toLowerCase().includes(q)) ||
                                (o.status && o.status.toLowerCase().includes(q));
            if (match) {
                items.push({
                    type: 'order',
                    typeLabel: 'Pedido',
                    icon: 'fa-solid fa-box',
                    iconBg: 'rgba(0, 210, 255, 0.15)',
                    iconColor: '#00d2ff',
                    id: o.id,
                    title: o.title || 'Sin título',
                    sub: `${o.client || 'Sin cliente'} • ${o.weight || 0}g • ${parseFloat(o.price || 0).toFixed(2)} €`,
                    badge: o.status || 'Presupuesto',
                    badgeClass: getBadgeClass(o.status),
                    tab: 'tab-orders',
                    action: () => {
                        switchTab('tab-orders');
                        closeGlobalSearch();
                        showTicketModal(o.id);
                    }
                });
            }
        });
    }

    // 2. Clients
    if (currentGlobalSearchCategory === 'all' || currentGlobalSearchCategory === 'clients') {
        (state.clients || []).forEach(c => {
            const match = !q || (c.name && c.name.toLowerCase().includes(q)) ||
                                (c.email && c.email.toLowerCase().includes(q)) ||
                                (c.phone && c.phone.toLowerCase().includes(q));
            if (match) {
                items.push({
                    type: 'client',
                    typeLabel: 'Cliente',
                    icon: 'fa-solid fa-user',
                    iconBg: 'rgba(16, 185, 129, 0.15)',
                    iconColor: '#10b981',
                    id: c.id,
                    title: c.name || 'Cliente sin nombre',
                    sub: `${c.phone || c.email || 'Sin contacto'} • ${c.ordersCount || 0} encargos`,
                    badge: `${parseFloat(c.totalSpent || 0).toFixed(2)} €`,
                    badgeClass: 'bg-emerald',
                    tab: 'tab-crm',
                    action: () => {
                        switchTab('tab-crm');
                        closeGlobalSearch();
                        filterOrdersByClient(c.name);
                    }
                });
            }
        });
    }

    // 3. Filaments
    if (currentGlobalSearchCategory === 'all' || currentGlobalSearchCategory === 'filaments') {
        (state.filaments || []).forEach(f => {
            const match = !q || (f.brand && f.brand.toLowerCase().includes(q)) ||
                                (f.material && f.material.toLowerCase().includes(q)) ||
                                (f.colorName && f.colorName.toLowerCase().includes(q));
            if (match) {
                const pct = Math.round(((f.currentWeight || 0) / (f.maxWeight || 1000)) * 100);
                items.push({
                    type: 'filament',
                    typeLabel: 'Bobina',
                    icon: 'fa-solid fa-spool',
                    iconBg: 'rgba(167, 139, 250, 0.15)',
                    iconColor: f.hex || '#a78bfa',
                    id: f.id,
                    title: `${f.brand} ${f.material} (${f.colorName})`,
                    sub: `${f.currentWeight || 0}g disponibles de ${f.maxWeight || 1000}g • ${parseFloat(f.costPerKg || 0).toFixed(2)} €/kg`,
                    badge: `${pct}%`,
                    badgeClass: pct < 20 ? 'bg-danger' : 'bg-purple',
                    tab: 'tab-filaments',
                    action: () => {
                        switchTab('tab-filaments');
                        closeGlobalSearch();
                        editFilament(f.id);
                    }
                });
            }
        });
    }

    // 4. Printers
    if (currentGlobalSearchCategory === 'all' || currentGlobalSearchCategory === 'printers') {
        (state.printers || []).forEach(p => {
            const match = !q || (p.name && p.name.toLowerCase().includes(q)) ||
                                (p.tech && p.tech.toLowerCase().includes(q));
            if (match) {
                const isPrinting = p.status && (p.status.toLowerCase() === 'printing' || p.status.toLowerCase() === 'imprimiendo');
                items.push({
                    type: 'printer',
                    typeLabel: 'Máquina',
                    icon: 'fa-solid fa-print',
                    iconBg: 'rgba(245, 158, 11, 0.15)',
                    iconColor: '#f59e0b',
                    id: p.id,
                    title: p.name || 'Impresora 3D',
                    sub: `${p.tech || 'FDM'} • Nozzle ${p.nozzle || 0.4}mm • ${p.hours || 0} horas de uso`,
                    badge: isPrinting ? 'Imprimiendo' : 'Disponible',
                    badgeClass: isPrinting ? 'bg-warning' : 'bg-success',
                    tab: 'tab-printers',
                    action: () => {
                        switchTab('tab-printers');
                        closeGlobalSearch();
                        openPrinterProfile(p.id);
                    }
                });
            }
        });
    }

    // 5. Catalog
    if (currentGlobalSearchCategory === 'all' || currentGlobalSearchCategory === 'catalog') {
        (state.catalog || []).forEach(item => {
            const match = !q || (item.name && item.name.toLowerCase().includes(q)) ||
                                (item.category && item.category.toLowerCase().includes(q)) ||
                                (item.material && item.material.toLowerCase().includes(q));
            if (match) {
                items.push({
                    type: 'catalog',
                    typeLabel: 'Catálogo',
                    icon: item.icon || 'fa-solid fa-cube',
                    iconBg: 'rgba(0, 210, 255, 0.15)',
                    iconColor: '#00d2ff',
                    id: item.id,
                    title: item.name || 'Pieza catálogo',
                    sub: `${item.category || 'General'} • ${item.weight || 0}g • ${item.time || 0}h aprox`,
                    badge: `${parseFloat(item.price || 0).toFixed(2)} €`,
                    badgeClass: 'bg-primary',
                    tab: 'tab-catalog',
                    action: () => {
                        switchTab('tab-catalog');
                        closeGlobalSearch();
                        openCatalogDetail(item.id);
                    }
                });
            }
        });
    }

    currentGlobalSearchResults = items.slice(0, 25);
    selectedGlobalSearchIndex = 0;

    if (currentGlobalSearchResults.length === 0) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 35px 20px; color: var(--text-dim);">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 2.2rem; opacity: 0.3; margin-bottom: 10px;"></i>
                <div style="font-size: 14px; font-weight: 600;">No se encontraron resultados para "${escapeHtml(query)}"</div>
                <div style="font-size: 12px; margin-top: 4px;">Intenta buscar por nombre de cliente, modelo, color o marca de filamento.</div>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = currentGlobalSearchResults.map((res, idx) => `
        <div class="spotlight-result-item ${idx === 0 ? 'selected' : ''}" data-index="${idx}" onclick="executeSearchResult(${idx})">
            <div class="spotlight-result-icon" style="background: ${res.iconBg}; color: ${res.iconColor};">
                <i class="${res.icon}"></i>
            </div>
            <div class="spotlight-result-info">
                <div class="spotlight-result-title">${escapeHtml(res.title)}</div>
                <div class="spotlight-result-sub">${escapeHtml(res.sub)}</div>
            </div>
            <span class="spotlight-result-badge badge ${res.badgeClass}">${escapeHtml(res.badge)}</span>
        </div>
    `).join('');
}

function handleGlobalSearchKeydown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentGlobalSearchResults.length === 0) return;
        selectedGlobalSearchIndex = (selectedGlobalSearchIndex + 1) % currentGlobalSearchResults.length;
        updateSpotlightSelection();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentGlobalSearchResults.length === 0) return;
        selectedGlobalSearchIndex = (selectedGlobalSearchIndex - 1 + currentGlobalSearchResults.length) % currentGlobalSearchResults.length;
        updateSpotlightSelection();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSearchResult(selectedGlobalSearchIndex);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeGlobalSearch();
    }
}

function updateSpotlightSelection() {
    const items = document.querySelectorAll('.spotlight-result-item');
    items.forEach((item, idx) => {
        if (idx === selectedGlobalSearchIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function executeSearchResult(index) {
    const res = currentGlobalSearchResults[index];
    if (res && typeof res.action === 'function') {
        res.action();
    }
}

// Global Keyboard Shortcut: Ctrl + K
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const modal = document.getElementById('modal-global-search');
        if (modal && modal.classList.contains('active')) {
            closeGlobalSearch();
        } else {
            openGlobalSearch();
        }
    }
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal-global-search');
        if (modal && modal.classList.contains('active')) {
            closeGlobalSearch();
        }
    }
});

// ==========================================================================
// FEATURE: Calculadora de Báscula para Bobinas (Restar Tara del Carrete)
// ==========================================================================
function openSpoolScaleModal(filamentId) {
    const modal = document.getElementById('modal-spool-scale');
    if (!modal) return;

    let targetFilament = null;
    const isNewFilament = (filamentId === '' || filamentId === undefined || filamentId === null);
    if (filamentId && !isNewFilament) {
        targetFilament = (state.filaments || []).find(f => f.id === filamentId);
    }
    // Only fallback to first filament if called without any ID (e.g. standalone shortcut)
    // Do NOT fallback when opened from "new filament" form (empty string)
    if (!targetFilament && !isNewFilament && (state.filaments || []).length > 0) {
        targetFilament = state.filaments[0];
    }

    const idInput = document.getElementById('scale-filament-id');
    const nameDisplay = document.getElementById('scale-filament-name');
    
    if (targetFilament) {
        if (idInput) idInput.value = targetFilament.id;
        if (nameDisplay) {
            nameDisplay.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="color-swatch" style="background-color:${targetFilament.hex || '#ccc'};"></span>
                    <strong>${escapeHtml(targetFilament.brand)} ${escapeHtml(targetFilament.material)}</strong> 
                    <span class="text-dim">(${escapeHtml(targetFilament.colorName || '')})</span>
                    <span class="badge bg-secondary" style="margin-left:auto;">Actual: ${targetFilament.currentWeight || 0}g</span>
                </div>
            `;
        }
    } else {
        if (idInput) idInput.value = '';
        if (nameDisplay) nameDisplay.textContent = 'Bobina en edición actual';
    }

    const grossInput = document.getElementById('scale-gross-weight');
    if (grossInput) {
        grossInput.value = '';
        setTimeout(() => grossInput.focus(), 80);
    }
    const tareInput = document.getElementById('scale-tare-weight');
    if (tareInput && !tareInput.value) {
        tareInput.value = '220';
    }

    calculateSpoolNetWeight();
    openModal('modal-spool-scale');
}

function setTarePreset(grams, label) {
    const tareInput = document.getElementById('scale-tare-weight');
    if (tareInput) {
        tareInput.value = grams;
        calculateSpoolNetWeight();
        showToast(`Tara ajustada a ${grams}g (${label})`, 'info');
    }
}

function calculateSpoolNetWeight() {
    const gross = parseFloat(document.getElementById('scale-gross-weight')?.value) || 0;
    const tare = parseFloat(document.getElementById('scale-tare-weight')?.value) || 0;
    const net = Math.max(0, Math.round(gross - tare));

    const filId = document.getElementById('scale-filament-id')?.value;
    const filament = (state.filaments || []).find(f => f.id === filId);
    const maxWeight = filament ? (filament.maxWeight || 1000) : 1000;
    const pct = Math.min(100, Math.round((net / maxWeight) * 100));

    const netResult = document.getElementById('scale-net-result');
    const netPercent = document.getElementById('scale-net-percent');

    if (netResult) {
        netResult.textContent = `${net} g`;
        netResult.className = `text-2xl font-mono fw-bold ${pct < 20 ? 'text-danger' : (pct < 40 ? 'text-amber' : 'text-cyan')} mt-1`;
    }
    if (netPercent) {
        netPercent.textContent = gross > 0 ? `${pct}% de capacidad restante (${net}g de plástico real)` : 'Introduce el peso en báscula';
    }
}

function applySpoolScaleWeight() {
    const gross = parseFloat(document.getElementById('scale-gross-weight')?.value) || 0;
    const tare = parseFloat(document.getElementById('scale-tare-weight')?.value) || 0;

    if (gross <= 0) {
        showToast('Coloca el carrete en la báscula e introduce el peso en gramos.', 'warning');
        return;
    }

    const net = Math.max(0, Math.round(gross - tare));
    const filId = document.getElementById('scale-filament-id')?.value;
    const fil = (state.filaments || []).find(f => f.id === filId);

    if (fil) {
        fil.currentWeight = net;
        saveState();
        renderFilaments();
        renderDashboard();
    }

    // Also update modal-filament input if currently open
    const currentWeightInput = document.getElementById('filament-weight-current');
    if (currentWeightInput) {
        currentWeightInput.value = net;
    }

    closeModal('modal-spool-scale');
    showToast(`¡Bobina calibrada con éxito! Filamento neto: ${net}g`, 'success');
    playChime('success');
}

// --- PORTAL DE SEGUIMIENTO EN VIVO PARA CLIENTES ---
function shareClientTracking(orderId) {
    const o = state.orders.find(ord => ord.id === orderId);
    if (!o) {
        showToast('Encargo no encontrado', 'error');
        return;
    }

    const payload = {
        id: o.id,
        title: o.title,
        client: o.client,
        status: o.status,
        deadline: o.deadline || null,
        photo: o.photo || null
    };

    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '').replace(/\/$/, '') + '/tracking.html';
    const trackingLink = `${baseUrl}?data=${encodeURIComponent(b64)}`;

    const text = `¡Hola ${o.client || ''}! Aquí tienes el enlace para seguir en directo el progreso de tu encargo 3D "${o.title}":\n\n${trackingLink}\n\n¡Gracias por confiar en nuestro taller! 🚀`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(trackingLink).then(() => {
            showToast('🔗 Enlace copiado al portapapeles y abriendo WhatsApp...', 'success');
        }).catch(() => {
            showToast('🔗 Abriendo WhatsApp para compartir seguimiento...', 'info');
        });
    }

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
}

// --- SINCRONIZACIÓN EN LA NUBE (PC ⟷ MÓVIL) ---
function openCloudSyncModal() {
    openModal('modal-cloud-sync');
}

function generateDirectSyncLink() {
    try {
        const minimalState = {
            orders: state.orders || [],
            filaments: state.filaments || [],
            printers: state.printers || [],
            expenses: state.expenses || [],
            catalog: state.catalog || [],
            clients: state.clients || [],
            spares: state.spares || [],
            wastageLogs: state.wastageLogs || [],
            electricityTariff: state.electricityTariff || 0.18,
            monthlyRevenueGoal: state.monthlyRevenueGoal || 1500,
            hourlyFixedCost: state.hourlyFixedCost || 1.5,
            syncTimestamp: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(minimalState);
        const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
        const baseUrl = window.location.origin + window.location.pathname;
        const syncUrl = `${baseUrl}?sync=${encodeURIComponent(b64)}`;

        const previewBox = document.getElementById('sync-link-preview-box');
        const urlInput = document.getElementById('sync-direct-url');
        if (previewBox) previewBox.style.display = 'block';
        if (urlInput) urlInput.value = syncUrl;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(syncUrl).then(() => {
                showToast('✅ ¡Enlace generado y copiado al portapapeles!', 'success');
            }).catch(() => {
                showToast('✅ Enlace generado. Cópialo o envíalo por WhatsApp', 'info');
            });
        } else {
            showToast('✅ Enlace generado. Cópialo o envíalo por WhatsApp', 'info');
        }
        playChime('success');
    } catch (err) {
        console.error('Error generating sync link:', err);
        showToast('Error al generar enlace de sincronización: ' + err.message, 'error');
    }
}

function shareSyncLinkWhatsApp() {
    const input = document.getElementById('sync-direct-url');
    if (!input || !input.value) {
        showToast('Genera primero el enlace', 'warning');
        return;
    }
    const msg = `Taller 3D - Enlace de Sincronización PC ⟷ Móvil:\n\n${input.value}\n\n(Abre este enlace en tu móvil para tener todos los datos sincronizados al instante)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function applySyncPayload() {
    const textarea = document.getElementById('sync-payload-input');
    if (!textarea || !textarea.value.trim()) {
        showToast('Pega un enlace o código de sincronización válido', 'warning');
        return;
    }

    try {
        let raw = textarea.value.trim();
        if (raw.includes('?sync=')) {
            const urlObj = new URL(raw);
            raw = urlObj.searchParams.get('sync') || raw;
        }

        const jsonStr = decodeURIComponent(escape(atob(raw)));
        const imported = JSON.parse(jsonStr);

        if (!imported || (!imported.orders && !imported.filaments)) {
            throw new Error('Formato de datos no reconocido');
        }

        if (confirm('¿Deseas volcar y sincronizar los datos recibidos en este dispositivo?')) {
            if (Array.isArray(imported.orders)) state.orders = imported.orders;
            if (Array.isArray(imported.filaments)) state.filaments = imported.filaments;
            if (Array.isArray(imported.printers)) state.printers = imported.printers;
            if (Array.isArray(imported.expenses)) state.expenses = imported.expenses;
            if (Array.isArray(imported.catalog)) state.catalog = imported.catalog;
            if (Array.isArray(imported.clients)) state.clients = imported.clients;
            if (Array.isArray(imported.spares)) state.spares = imported.spares;
            if (Array.isArray(imported.wastageLogs)) state.wastageLogs = imported.wastageLogs;
            if (imported.electricityTariff) state.electricityTariff = imported.electricityTariff;
            if (imported.monthlyRevenueGoal) state.monthlyRevenueGoal = imported.monthlyRevenueGoal;
            if (imported.hourlyFixedCost) state.hourlyFixedCost = imported.hourlyFixedCost;

            saveState();
            renderAll();
            closeModal('modal-cloud-sync');
            showToast('✅ Taller sincronizado con éxito', 'success');
            playChime('success');
        }
    } catch (err) {
        console.error('Sync error:', err);
        showToast('Error al importar sincronización: ' + err.message, 'error');
    }
}

function checkAutoSyncParam() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const syncData = urlParams.get('sync');
        if (syncData) {
            const jsonStr = decodeURIComponent(escape(atob(syncData)));
            const imported = JSON.parse(jsonStr);
            if (imported && (imported.orders || imported.filaments)) {
                if (Array.isArray(imported.orders)) state.orders = imported.orders;
                if (Array.isArray(imported.filaments)) state.filaments = imported.filaments;
                if (Array.isArray(imported.printers)) state.printers = imported.printers;
                if (Array.isArray(imported.expenses)) state.expenses = imported.expenses;
                if (Array.isArray(imported.catalog)) state.catalog = imported.catalog;
                if (Array.isArray(imported.clients)) state.clients = imported.clients;
                if (Array.isArray(imported.spares)) state.spares = imported.spares;
                if (Array.isArray(imported.wastageLogs)) state.wastageLogs = imported.wastageLogs;
                if (imported.electricityTariff) state.electricityTariff = imported.electricityTariff;
                if (imported.monthlyRevenueGoal) state.monthlyRevenueGoal = imported.monthlyRevenueGoal;
                if (imported.hourlyFixedCost) state.hourlyFixedCost = imported.hourlyFixedCost;

                saveState();
                showToast('🚀 ¡Taller sincronizado desde enlace directo!', 'success');
                playChime('success');

                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }
    } catch (err) {
        console.error('Error auto-syncing from URL parameter:', err);
    }
}

// Window bindings for all newly added functions
window.openGlobalSearch = openGlobalSearch;
window.closeGlobalSearch = closeGlobalSearch;
window.filterGlobalSearchCategory = filterGlobalSearchCategory;
window.handleGlobalSearchInput = handleGlobalSearchInput;
window.handleGlobalSearchKeydown = handleGlobalSearchKeydown;
window.executeSearchResult = executeSearchResult;
window.openSpoolScaleModal = openSpoolScaleModal;
window.setTarePreset = setTarePreset;
window.calculateSpoolNetWeight = calculateSpoolNetWeight;
window.applySpoolScaleWeight = applySpoolScaleWeight;

// Cloud Sync & Tracking Bindings
window.shareClientTracking = shareClientTracking;
window.openCloudSyncModal = openCloudSyncModal;
window.generateDirectSyncLink = generateDirectSyncLink;
window.shareSyncLinkWhatsApp = shareSyncLinkWhatsApp;
window.applySyncPayload = applySyncPayload;
window.checkAutoSyncParam = checkAutoSyncParam;

// Comprehensive bindings for full cross-module / inline-handler safety
window.openOrderModalWithDefaults = openOrderModalWithDefaults;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleWorkshopMode = toggleWorkshopMode;
window.toggleDarkMode = toggleDarkMode;
window.openQRScanner = openQRScanner;
window.closeQRScanner = closeQRScanner;
window.saveOrder = saveOrder;
window.saveFilament = saveFilament;
window.savePrinter = savePrinter;
window.saveExpense = saveExpense;
window.saveSparePart = saveSparePart;
window.saveWastageLog = saveWastageLog;
window.calculateOrderSuggestedPrice = calculateOrderSuggestedPrice;
window.toggleOrdersView = toggleOrdersView;
window.advanceOrderStatus = advanceOrderStatus;
window.duplicateOrder = duplicateOrder;
window.sendBudgetWhatsApp = sendBudgetWhatsApp;
window.sendBudgetEmail = sendBudgetEmail;
window.openInvoiceModal = openInvoiceModal;
window.showOrderHistory = showOrderHistory;
window.previewOrderPhoto = previewOrderPhoto;
window.loadCalcPreset = loadCalcPreset;
window.calculateQuote = calculateQuote;
window.toggle3DWireframe = toggle3DWireframe;
window.reset3DCamera = reset3DCamera;
window.exportAnalyticsCSV = exportAnalyticsCSV;
window.seedDemoData = seedDemoData;
window.resetToCleanWorkshop = resetToCleanWorkshop;
window.toggleNavAdvancedGroup = toggleNavAdvancedGroup;
window.switchTab = switchTab;
window.openPrinterProfile = openPrinterProfile;
window.resetNozzle = resetNozzle;
window.openFilamentComparator = openFilamentComparator;
window.openLabelModal = openLabelModal;
window.filterOrdersByClient = filterOrdersByClient;
window.openCatalogModal = openCatalogModal;
window.openCatalogDetail = openCatalogDetail;
window.createOrderFromCatalog = createOrderFromCatalog;
window.runMaterialAdvisor = runMaterialAdvisor;
window.saveSignatureAndDeliver = saveSignatureAndDeliver;
window.clearSignatureCanvas = clearSignatureCanvas;
window.clearSignaturePad = clearSignatureCanvas;
window.toggleSidebar = toggleSidebar;
window.switchMobileTab = switchMobileTab;
window.triggerPWAInstall = triggerPWAInstall;
window.triggerPWAInstallDirect = triggerPWAInstallDirect;
window.moveKpiCard = moveKpiCard;
window.toggleOrderExtraOptions = toggleOrderExtraOptions;
window.switchAgendaView = switchAgendaView;
window.changeCalendarMonth = changeCalendarMonth;
window.goToToday = goToToday;
window.closeAgendaDayDetail = closeAgendaDayDetail;
window.openAddSpareModal = openAddSpareModal;
window.previewCatalogPhoto = previewCatalogPhoto;
window.saveCatalogItem = saveCatalogItem;
window.filterCatalogCategory = filterCatalogCategory;
window.renderCatalog = renderCatalog;
window.shareCalcQuoteWhatsApp = shareCalcQuoteWhatsApp;
window.exportCatalogPDF = exportCatalogPDF;

// ==========================================================================
// NUEVAS MEJORAS DE NEGOCIO Y TALLER: TRUCOS, COTIZADOR EXPRESS Y CATÁLOGO WEB
// ==========================================================================

// --- MEJORA 6: BITÁCORA DE TRUCOS, PARÁMETROS Y RECORDATORIOS POR MODELO ---
function lookupModelPrintNotes(val) {
    const tipBanner = document.getElementById('order-tips-banner');
    if (!tipBanner) return;

    if (!val || val.trim().length < 2) {
        tipBanner.style.display = 'none';
        tipBanner.innerHTML = '';
        return;
    }

    const query = val.toLowerCase().trim();

    // 1. Check in catalog items first
    let match = state.catalog.find(c => c.name.toLowerCase().includes(query) && c.notes);
    let tipText = match ? match.notes : '';
    let matchItem = match;

    // 2. If not found, check past orders with printNotes
    if (!matchItem) {
        const orderMatch = state.orders.find(o => o.title && o.title.toLowerCase().includes(query) && o.printNotes);
        if (orderMatch) {
            tipText = orderMatch.printNotes;
            matchItem = orderMatch;
        }
    }

    if (matchItem && tipText) {
        tipBanner.style.display = 'block';
        tipBanner.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div>
                    <i class="fa-solid fa-lightbulb text-amber mr-1"></i>
                    <strong>Truco recordado para "${escapeHtml(matchItem.name || matchItem.title)}":</strong>
                    <span style="color:#fde68a;">${escapeHtml(tipText)}</span>
                </div>
                ${matchItem.weight ? `
                    <button type="button" class="btn-outline btn-xs" onclick="applyModelPreset('${matchItem.id}')" style="white-space:nowrap; border-color:rgba(245,158,11,0.5); color:#fbbf24;">
                        Aplicar valores
                    </button>
                ` : ''}
            </div>
        `;
    } else {
        tipBanner.style.display = 'none';
        tipBanner.innerHTML = '';
    }
}

function applyModelPreset(id) {
    const cat = state.catalog.find(c => c.id === id);
    if (cat) {
        if (cat.weight) document.getElementById('order-weight').value = cat.weight;
        if (cat.time) document.getElementById('order-time').value = cat.time;
        if (cat.price) document.getElementById('order-price').value = cat.price;
        if (cat.notes) {
            const notesInp = document.getElementById('order-print-notes');
            if (notesInp) notesInp.value = cat.notes;
        }
        calculateOrderSuggestedPrice();
        showToast(`Valores y trucos aplicados de "${cat.name}"`, 'success');
        playChime('success');
    }
}

function openPrintTipsModal() {
    renderPrintTipsList();
    openModal('modal-print-tips');
}

function renderPrintTipsList() {
    const container = document.getElementById('tips-items-container');
    const query = (document.getElementById('tips-search-input')?.value || '').toLowerCase().trim();
    if (!container) return;

    const tips = [];
    state.catalog.forEach(c => {
        if (c.notes && c.notes.trim()) {
            tips.push({
                source: 'Catálogo',
                name: c.name,
                category: c.category,
                material: c.material,
                weight: c.weight,
                time: c.time,
                notes: c.notes
            });
        }
    });

    state.orders.forEach(o => {
        if (o.printNotes && o.printNotes.trim() && !tips.some(t => t.name.toLowerCase() === o.title.toLowerCase())) {
            tips.push({
                source: 'Encargo',
                name: o.title,
                category: 'Taller',
                material: 'FDM',
                weight: o.weight,
                time: o.time,
                notes: o.printNotes
            });
        }
    });

    const filtered = tips.filter(t => 
        !query || 
        t.name.toLowerCase().includes(query) || 
        t.notes.toLowerCase().includes(query) ||
        (t.material && t.material.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-xs text-muted text-center py-4">No hay trucos registrados que coincidan con la búsqueda.</div>`;
        return;
    }

    container.innerHTML = filtered.map(t => `
        <div class="p-3 rounded" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div>
                    <strong class="text-white text-sm">${escapeHtml(t.name)}</strong>
                    <span class="badge ml-1" style="background:rgba(0,210,255,0.15); color:#00d2ff; font-size:10px;">${escapeHtml(t.material || 'PLA')}</span>
                </div>
                <span class="text-xs text-muted">${t.weight ? `${t.weight}g · ${t.time}h` : ''}</span>
            </div>
            <div class="p-2 rounded mt-2" style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); color:#fbbf24; font-size:12px;">
                <i class="fa-solid fa-lightbulb mr-1"></i> <strong>Parámetros & Truco:</strong> ${escapeHtml(t.notes)}
            </div>
        </div>
    `).join('');
}

// --- MEJORA 4: COTIZADOR RÁPIDO EXPRESS WHATSAPP (SIN ARCHIVO) ---
let currentExpressQuoteData = null;

function openExpressQuoteModal() {
    calculateExpressQuote();
    openModal('modal-express-quote');
}

function calculateExpressQuote() {
    const type = document.getElementById('eq-type')?.value || 'figura';
    const size = document.getElementById('eq-size')?.value || 'mediano';
    const density = document.getElementById('eq-density')?.value || 'decorativo';
    const material = document.getElementById('eq-material')?.value || 'PLA+';

    const sizeMatrix = {
        mini: { weightMin: 25, weightMax: 45, timeMin: 1.5, timeMax: 3.0, delay: '24 horas', label: 'Pequeño (< 8 cm)' },
        mediano: { weightMin: 80, weightMax: 150, timeMin: 4.0, timeMax: 7.5, delay: '24 - 48 horas', label: 'Mediano (8 - 15 cm)' },
        grande: { weightMin: 220, weightMax: 420, timeMin: 11.0, timeMax: 20.0, delay: '2 - 3 días', label: 'Grande (15 - 25 cm)' },
        gigante: { weightMin: 600, weightMax: 1050, timeMin: 30.0, timeMax: 50.0, delay: '4 - 6 días', label: 'Muy Grande (> 25 cm)' }
    };

    const typeNames = {
        figura: 'Figura / Miniatura (Detalle)',
        llavero: 'Llavero / Accesorio',
        tecnica: 'Pieza Técnica / Soporte Mecánico',
        cosplay: 'Cosplay / Casco / Prop',
        caja: 'Caja / Carcasa'
    };

    const densityMult = {
        decorativo: 1.0,
        reforzado: 1.35,
        solido: 1.85
    }[density] || 1.0;

    const typeTimeMult = {
        figura: 1.15,
        llavero: 0.85,
        tecnica: 1.2,
        cosplay: 1.1,
        caja: 0.95
    }[type] || 1.0;

    const base = sizeMatrix[size] || sizeMatrix.mediano;
    const estWeightMin = Math.round(base.weightMin * densityMult);
    const estWeightMax = Math.round(base.weightMax * densityMult);
    const estTimeMin = parseFloat((base.timeMin * typeTimeMult).toFixed(1));
    const estTimeMax = parseFloat((base.timeMax * typeTimeMult).toFixed(1));

    let costPerKg = 20.0;
    if (material === 'PETG') costPerKg = 22.0;
    if (material === 'TPU') costPerKg = 32.0;
    if (material === 'Resina SLA') costPerKg = 28.0;

    const kwhCost = parseFloat(state.electricityTariff) || 0.18;
    const machineWear = 0.20;

    const costMin = (estWeightMin / 1000) * costPerKg + estTimeMin * (0.25 * kwhCost + machineWear);
    const costMax = (estWeightMax / 1000) * costPerKg + estTimeMax * (0.25 * kwhCost + machineWear);

    let priceMin = Math.max(6.0, Math.round((costMin * 2.2) * 2) / 2);
    let priceMax = Math.max(priceMin + 3.0, Math.round((costMax * 2.6) * 2) / 2);

    currentExpressQuoteData = {
        type: typeNames[type] || type,
        sizeLabel: base.label,
        material,
        weightAvg: Math.round((estWeightMin + estWeightMax) / 2),
        timeAvg: parseFloat(((estTimeMin + estTimeMax) / 2).toFixed(1)),
        priceAvg: parseFloat(((priceMin + priceMax) / 2).toFixed(2)),
        priceMin,
        priceMax,
        delay: base.delay
    };

    const priceRangeEl = document.getElementById('eq-price-range');
    if (priceRangeEl) priceRangeEl.textContent = `${priceMin.toFixed(2)} € - ${priceMax.toFixed(2)} €`;

    const statsEl = document.getElementById('eq-stats');
    if (statsEl) statsEl.textContent = `~${currentExpressQuoteData.weightAvg}g • ~${currentExpressQuoteData.timeAvg}h`;

    const delayEl = document.getElementById('eq-delay');
    if (delayEl) delayEl.textContent = base.delay;

    const msg = `¡Hola! 👋 Para una pieza de tipo *${typeNames[type]}* de tamaño *${base.label}* en material *${material}*:\n\n📦 *Presupuesto estimado:* entre *${priceMin.toFixed(2)} €* y *${priceMax.toFixed(2)} €*\n⏱️ *Plazo de fabricación:* ${base.delay}\n\nSi tienes el archivo 3D (.stl, .obj) o una foto, envíamelo para confirmarte el precio exacto al céntimo. ¿Te reservo un hueco en la máquina? 🚀`;

    const msgEl = document.getElementById('eq-whatsapp-msg');
    if (msgEl) msgEl.value = msg;
}

function copyExpressQuote() {
    const msgEl = document.getElementById('eq-whatsapp-msg');
    if (!msgEl || !msgEl.value) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(msgEl.value).then(() => {
            showToast('📋 ¡Mensaje para WhatsApp copiado al portapapeles!', 'success');
        }).catch(() => {
            msgEl.select();
            document.execCommand('copy');
            showToast('📋 Mensaje copiado', 'success');
        });
    } else {
        msgEl.select();
        document.execCommand('copy');
        showToast('📋 Mensaje copiado', 'success');
    }
    playChime('success');
}

function sendExpressQuoteWhatsApp() {
    const msgEl = document.getElementById('eq-whatsapp-msg');
    if (!msgEl || !msgEl.value) return;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msgEl.value)}`;
    window.open(waUrl, '_blank');
}

function createOrderFromExpressQuote() {
    if (!currentExpressQuoteData) return;
    closeModal('modal-express-quote');
    switchTab('tab-orders');
    openOrderModalWithDefaults();

    setTimeout(() => {
        const itemInput = document.getElementById('order-item');
        const weightInput = document.getElementById('order-weight');
        const timeInput = document.getElementById('order-time');
        const priceInput = document.getElementById('order-price');

        if (itemInput) itemInput.value = `Encargo: ${currentExpressQuoteData.type} (${currentExpressQuoteData.sizeLabel})`;
        if (weightInput) weightInput.value = currentExpressQuoteData.weightAvg;
        if (timeInput) timeInput.value = currentExpressQuoteData.timeAvg;
        if (priceInput) priceInput.value = currentExpressQuoteData.priceAvg;

        showToast('Presupuesto express volcado en el formulario de encargo', 'info');
        playChime('success');
    }, 60);
}

// --- MEJORA 1: COMPARTIR CATÁLOGO WEB PÚBLICO CON CLIENTES ---
function shareClientCatalog() {
    try {
        const publicCatalog = (state.catalog || []).map(c => ({
            id: c.id,
            name: c.name,
            category: c.category || 'General',
            material: c.material || 'PLA+',
            price: parseFloat(c.price || 0),
            weight: c.weight || null,
            time: c.time || null,
            icon: c.icon || 'fa-solid fa-cube',
            notes: c.notes || '',
            photo: c.photo || null
        }));

        const jsonStr = JSON.stringify(publicCatalog);
        const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '').replace(/\/$/, '') + '/catalogo.html';
        const catalogUrl = `${baseUrl}?data=${encodeURIComponent(b64)}`;

        const input = document.getElementById('share-catalog-url');
        if (input) input.value = catalogUrl;

        openModal('modal-share-catalog');
    } catch (e) {
        console.error('Error generating catalog link:', e);
        showToast('Error al generar enlace del catálogo: ' + e.message, 'error');
    }
}

function copyCatalogLink() {
    const input = document.getElementById('share-catalog-url');
    if (!input || !input.value) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value).then(() => {
            showToast('📋 ¡Enlace del catálogo copiado al portapapeles!', 'success');
        }).catch(() => {
            input.select();
            document.execCommand('copy');
            showToast('📋 Enlace copiado', 'success');
        });
    } else {
        input.select();
        document.execCommand('copy');
        showToast('📋 Enlace copiado', 'success');
    }
    playChime('success');
}

function shareCatalogByWhatsApp() {
    const input = document.getElementById('share-catalog-url');
    if (!input || !input.value) return;
    const msg = `¡Hola! 👋 Aquí tienes nuestro catálogo de modelos y piezas 3D terminadas con fotos y precios orientativos:\n\n${input.value}\n\nPuedes echarle un vistazo y encargar el que más te guste directamente con un clic 🚀`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function previewCatalogPage() {
    const input = document.getElementById('share-catalog-url');
    if (input && input.value) {
        window.open(input.value, '_blank');
    }
}

// Window bindings for features 1, 4, 5, 6
window.lookupModelPrintNotes = lookupModelPrintNotes;
window.applyModelPreset = applyModelPreset;
window.openPrintTipsModal = openPrintTipsModal;
window.renderPrintTipsList = renderPrintTipsList;
window.openExpressQuoteModal = openExpressQuoteModal;
window.calculateExpressQuote = calculateExpressQuote;
window.copyExpressQuote = copyExpressQuote;
window.sendExpressQuoteWhatsApp = sendExpressQuoteWhatsApp;
window.createOrderFromExpressQuote = createOrderFromExpressQuote;
window.shareClientCatalog = shareClientCatalog;
window.copyCatalogLink = copyCatalogLink;
window.shareCatalogByWhatsApp = shareCatalogByWhatsApp;
window.previewCatalogPage = previewCatalogPage;

// Window bindings for features 3 and 5 (Batch Quotes & Tier Orders)
window.openBatchQuoteModal = openBatchQuoteModal;
window.setBatchQty = setBatchQty;
window.calculateBatchQuote = calculateBatchQuote;
window.copyBatchQuoteWhatsApp = copyBatchQuoteWhatsApp;
window.sendBatchQuoteWhatsApp = sendBatchQuoteWhatsApp;
window.convertBatchToOrder = convertBatchToOrder;
window.convertTierToOrder = convertTierToOrder;

// --- CARTA DE COLORES Y MUESTRARIO EN STOCK PARA WHATSAPP ---
function shareColorPaletteWhatsApp() {
    const inStock = (state.filaments || []).filter(f => (f.currentWeight || 0) > 40);
    if (inStock.length === 0) {
        showToast('No hay filamentos con stock suficiente (>40g)', 'warning');
        return;
    }

    let listText = '';
    inStock.forEach(f => {
        const mat = f.material || 'PLA';
        const brand = f.brand || '';
        const color = f.colorName || 'Color';
        const grams = Math.round(f.currentWeight || 0);
        listText += `• *${color}* (${mat} ${brand}) - _${grams}g disponibles_\n`;
    });

    const msg = `🎨 *CARTA DE COLORES Y MATERIALES EN TALLER* 🎨\n\n` +
        `¡Hola! Aquí tienes los colores y materiales que tenemos listos en stock para imprimir tu encargo:\n\n` +
        listText + `\n` +
        `¿Qué color y acabado te gusta más para tu pieza? ✨\n` +
        `_Print3D Studio_`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).catch(() => {});
    }
    showToast('🎨 Carta de colores copiada y abriendo WhatsApp...', 'success');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// --- GUÍA DE MATERIALES PARA CLIENTES ---
function openMaterialGuideModal() {
    openModal('modal-material-guide');
}

function shareMaterialGuideWhatsApp() {
    const msg = `📚 *GUÍA DE MATERIALES 3D PARA TU ENCARGO* 📚\n\n` +
        `¡Hola! Te explicamos brevemente qué material te conviene según el uso de tu pieza:\n\n` +
        `🔹 *PLA+ (Estético)*: El más definido y con más colores (seda, mármol). Ideal para figuras, maquetas y decoración de interior.\n` +
        `⚠️ _Cuidado: No dejar en coches cerrados al sol (>55ºC)._\n\n` +
        `🔹 *PETG (Resistente & Exterior)*: Muy tenaz a golpes, impermeable y resiste hasta 75ºC. Ideal para soportes de pared, baño y cocina.\n\n` +
        `🔹 *TPU 95A (Goma Flexible)*: Irrompible y elástico. Ideal para fundas amortiguadoras, topes y juntas.\n\n` +
        `🔹 *ASA / ABS (Automoción & Sol UV)*: Resiste intemperie total y más de 95ºC. Ideal para coche, moto y exterior.\n\n` +
        `¿Tienes dudas sobre cuál elegir? ¡Dinos para qué usarás la pieza y te recomendamos el mejor! 🚀`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).catch(() => {});
    }
    showToast('📚 Guía copiada y abriendo WhatsApp...', 'success');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function copyMaterialGuideToClipboard() {
    const msg = `📚 GUÍA DE MATERIALES 3D - PRINT3D STUDIO\n\n` +
        `• PLA+: Máxima estética, figuras y piezas de interior.\n` +
        `• PETG: Resistencia a golpes, agua y calor hasta 75ºC.\n` +
        `• TPU: Goma flexible amortiguadora e indestructible.\n` +
        `• ASA/ABS: Exterior, sol directo y alta temperatura (95ºC).`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).then(() => {
            showToast('📋 Guía de materiales copiada al portapapeles', 'success');
        }).catch(() => {
            showToast('📋 Guía copiada', 'success');
        });
    } else {
        showToast('📋 Guía copiada', 'success');
    }
    playChime('success');
}

// Window bindings for all new features
window.shareColorPaletteWhatsApp = shareColorPaletteWhatsApp;
window.openMaterialGuideModal = openMaterialGuideModal;
window.shareMaterialGuideWhatsApp = shareMaterialGuideWhatsApp;
window.copyMaterialGuideToClipboard = copyMaterialGuideToClipboard;
window.sendPieceCareInstructions = sendPieceCareInstructions;

// ==========================================================================
// FEATURE 2: Enlace Directo de Pago Inmediato (Bizum, Revolut, PayPal.me)
// ==========================================================================
function openPaymentConfigModal() {
    if (!state.paymentConfig) state.paymentConfig = { bizumPhone: '', revolutTag: '', paypalUser: '' };
    const bizInp = document.getElementById('pay-cfg-bizum');
    const revInp = document.getElementById('pay-cfg-revolut');
    const payInp = document.getElementById('pay-cfg-paypal');
    if (bizInp) bizInp.value = state.paymentConfig.bizumPhone || '';
    if (revInp) revInp.value = state.paymentConfig.revolutTag || '';
    if (payInp) payInp.value = state.paymentConfig.paypalUser || '';
    openModal('modal-payment-config');
}

function savePaymentConfig() {
    if (!state.paymentConfig) state.paymentConfig = {};
    state.paymentConfig.bizumPhone = document.getElementById('pay-cfg-bizum')?.value?.trim() || '';
    state.paymentConfig.revolutTag = document.getElementById('pay-cfg-revolut')?.value?.trim().replace(/^@/, '') || '';
    state.paymentConfig.paypalUser = document.getElementById('pay-cfg-paypal')?.value?.trim() || '';
    saveState();
    closeModal('modal-payment-config');
    showToast('💳 Métodos de cobro rápido guardados', 'success');
}

function getPaymentLinksText(priceNum, refText) {
    const cfg = state.paymentConfig || {};
    let text = '';
    if (cfg.bizumPhone) {
        text += `📲 *Bizum:* ${cfg.bizumPhone} (Concepto: ${refText || '3D'})\n`;
    }
    if (cfg.revolutTag && priceNum) {
        text += `💳 *Tarjeta / Revolut:* https://revolut.me/${cfg.revolutTag}/${priceNum}\n`;
    }
    if (cfg.paypalUser && priceNum) {
        text += `💳 *PayPal:* https://paypal.me/${cfg.paypalUser}/${priceNum}EUR\n`;
    }
    return text ? `\n💳 *Canales de Pago Directo:*\n${text}` : '';
}

// ==========================================================================
// FEATURE 3 & 4: Simulador de Boquillas y Asesor de Resistencia Mecánica
// ==========================================================================
function calculateNozzleImpact() {
    const nozzle = document.getElementById('calc-nozzle-size')?.value || '0.4';
    const timeEl = document.getElementById('calc-time');
    const tipEl = document.getElementById('calc-nozzle-tip');
    const baseTime = parseFloat(timeEl?.value) || 0;

    if (!tipEl) return;
    if (nozzle === '0.4' || baseTime <= 0) {
        tipEl.style.display = 'none';
        return;
    }

    tipEl.style.display = 'block';
    if (nozzle === '0.2') {
        const estTime = (baseTime * 2.2).toFixed(1);
        tipEl.innerHTML = `<i class="fa-solid fa-microscope text-cyan mr-1"></i> Boquilla 0.2mm (Ultra Detalle): Tardará aprox. <strong>${estTime}h</strong> (+120% tiempo). Ideal para miniaturas.`;
    } else if (nozzle === '0.6') {
        const estTime = (baseTime * 0.65).toFixed(1);
        const saved = (baseTime - parseFloat(estTime)).toFixed(1);
        tipEl.innerHTML = `<i class="fa-solid fa-bolt text-emerald mr-1"></i> Boquilla 0.6mm (Rápida): Tardará aprox. <strong>${estTime}h</strong> (¡Ahorras <strong>${saved}h</strong> de taller!).`;
    } else if (nozzle === '0.8') {
        const estTime = (baseTime * 0.40).toFixed(1);
        const saved = (baseTime - parseFloat(estTime)).toFixed(1);
        tipEl.innerHTML = `<i class="fa-solid fa-fire text-amber mr-1"></i> Boquilla 0.8mm (Modo Bestia): Tardará aprox. <strong>${estTime}h</strong> (¡Ahorras <strong>${saved}h</strong> de taller!). Ideal para macetas y cajas.`;
    }
}

function applyStrengthPreset(preset) {
    const tipEl = document.getElementById('calc-strength-tip');
    if (!tipEl) return;

    if (preset === 'decor') {
        tipEl.innerHTML = `<i class="fa-solid fa-seedling text-cyan mr-1"></i> <strong>Decorativo / Visual:</strong> 2 paredes exteriores • 10% relleno giroide. Rápido y ligero para figuras.`;
    } else if (preset === 'daily') {
        tipEl.innerHTML = `<i class="fa-solid fa-house text-emerald mr-1"></i> <strong>Uso diario ligero:</strong> 3 paredes exteriores • 18% relleno giroide. Equilibrio perfecto para soportes de móvil o macetas.`;
    } else if (preset === 'heavy') {
        tipEl.innerHTML = `<i class="fa-solid fa-dumbbell text-amber mr-1"></i> <strong>Carga pesada (>10 kg):</strong> 5 paredes exteriores • 40% relleno cúbico. <em>El 80% de la fuerza viene del número de paredes, no del relleno.</em>`;
    } else if (preset === 'watertight') {
        tipEl.innerHTML = `<i class="fa-solid fa-droplet text-primary mr-1"></i> <strong>Estanco a agua / líquidos:</strong> 6 paredes concéntricas • 100% relleno. Máxima densidad para evitar microfugas.`;
    } else {
        tipEl.innerHTML = `<i class="fa-solid fa-sliders text-muted mr-1"></i> Ajuste manual de paredes y relleno en tu laminador.`;
    }
}

// ==========================================================================
// FEATURE 5: Mantenimiento Preventivo de Impresoras
// ==========================================================================
function openMaintenanceCheckModal(printerId) {
    const p = state.printers.find(x => x.id === printerId);
    if (!p) return;

    const idInput = document.getElementById('maint-printer-id');
    const nameEl = document.getElementById('maint-printer-name');
    const hoursEl = document.getElementById('maint-printer-hours');
    if (idInput) idInput.value = printerId;
    if (nameEl) nameEl.textContent = p.name;
    if (hoursEl) hoursEl.textContent = `${(p.hours || 0).toFixed(1)} horas acumuladas`;

    const cleanElapsed = Math.max(0, (p.hours || 0) - (p.lastCleanHours || 0));
    const lubeElapsed = Math.max(0, (p.hours || 0) - (p.lastLubeHours || 0));
    const beltElapsed = Math.max(0, (p.hours || 0) - (p.lastBeltHours || 0));

    const cleanChk = document.getElementById('maint-task-clean');
    const lubeChk = document.getElementById('maint-task-lube');
    const beltsChk = document.getElementById('maint-task-belts');
    if (cleanChk) cleanChk.checked = cleanElapsed >= 150;
    if (lubeChk) lubeChk.checked = lubeElapsed >= 300;
    if (beltsChk) beltsChk.checked = beltElapsed >= 500;

    openModal('modal-printer-maintenance');
}

function saveMaintenanceLog() {
    const printerId = document.getElementById('maint-printer-id')?.value;
    const p = state.printers.find(x => x.id === printerId);
    if (!p) return;

    const currentHours = p.hours || 0;
    const cleanChk = document.getElementById('maint-task-clean')?.checked;
    const lubeChk = document.getElementById('maint-task-lube')?.checked;
    const beltsChk = document.getElementById('maint-task-belts')?.checked;

    if (cleanChk) p.lastCleanHours = currentHours;
    if (lubeChk) p.lastLubeHours = currentHours;
    if (beltsChk) p.lastBeltHours = currentHours;

    saveState();
    renderPrinters();
    closeModal('modal-printer-maintenance');
    showToast(`🛠️ Mantenimiento registrado para ${p.name}`, 'success');
    playChime('success');
}

// Window bindings for features 2, 3, 4, 5
window.openPaymentConfigModal = openPaymentConfigModal;
window.savePaymentConfig = savePaymentConfig;
window.calculateNozzleImpact = calculateNozzleImpact;
window.applyStrengthPreset = applyStrengthPreset;
window.openMaintenanceCheckModal = openMaintenanceCheckModal;
window.saveMaintenanceLog = saveMaintenanceLog;

// ==========================================================================
// FEATURE: Calculadora de Reescalado 3D (Regla del Cubo)
// ==========================================================================
let currentRescaleCalculated = { newWeight: 0, newTime: 0, scaleFactor: 1.0 };

function openRescaleModal() {
    const origWeight = parseFloat(document.getElementById('calc-weight')?.value) || 100;
    const origTime = parseFloat(document.getElementById('calc-time')?.value) || 4.0;

    const wInp = document.getElementById('rescale-orig-weight');
    const tInp = document.getElementById('rescale-orig-time');
    if (wInp) wInp.value = origWeight > 0 ? origWeight : 100;
    if (tInp) tInp.value = origTime > 0 ? origTime : 4.0;

    calculateRescale();
    openModal('modal-rescale-calculator');
}

function toggleRescaleInputs() {
    const mode = document.getElementById('rescale-mode')?.value || 'percent';
    const percentWrap = document.getElementById('rescale-percent-wrap');
    const origSizeWrap = document.getElementById('rescale-orig-size-wrap');
    const newSizeWrap = document.getElementById('rescale-new-size-wrap');

    if (mode === 'percent') {
        if (percentWrap) percentWrap.style.display = 'block';
        if (origSizeWrap) origSizeWrap.style.display = 'none';
        if (newSizeWrap) newSizeWrap.style.display = 'none';
    } else {
        if (percentWrap) percentWrap.style.display = 'none';
        if (origSizeWrap) origSizeWrap.style.display = 'block';
        if (newSizeWrap) newSizeWrap.style.display = 'block';
    }
    calculateRescale();
}

function calculateRescale() {
    const mode = document.getElementById('rescale-mode')?.value || 'percent';
    const origWeight = parseFloat(document.getElementById('rescale-orig-weight')?.value) || 0;
    const origTime = parseFloat(document.getElementById('rescale-orig-time')?.value) || 0;

    let scaleFactor = 1.0;
    if (mode === 'percent') {
        const percent = parseFloat(document.getElementById('rescale-percent')?.value) || 100;
        scaleFactor = Math.max(0.05, percent / 100);
    } else {
        const origSize = parseFloat(document.getElementById('rescale-orig-size')?.value) || 100;
        const newSize = parseFloat(document.getElementById('rescale-new-size')?.value) || 100;
        scaleFactor = origSize > 0 ? Math.max(0.05, newSize / origSize) : 1.0;
    }

    // Regla del Cubo 3D:
    // Volumen & Peso = S³
    // Tiempo = S^2.5 (capas + perímetros + relleno)
    const weightMultiplier = Math.pow(scaleFactor, 3);
    const timeMultiplier = Math.pow(scaleFactor, 2.5);

    const newWeight = Math.round(origWeight * weightMultiplier);
    const newTime = parseFloat((origTime * timeMultiplier).toFixed(1));

    currentRescaleCalculated = { newWeight, newTime, scaleFactor };

    const factorEl = document.getElementById('rescale-factor-val');
    const wEl = document.getElementById('rescale-new-weight');
    const tEl = document.getElementById('rescale-new-time');
    const wDeltaEl = document.getElementById('rescale-weight-delta');
    const tDeltaEl = document.getElementById('rescale-time-delta');

    if (factorEl) factorEl.textContent = `${scaleFactor.toFixed(2)}x (${Math.round(scaleFactor * 100)}%)`;
    if (wEl) wEl.textContent = `${newWeight} g`;
    if (tEl) tEl.textContent = `${newTime} h`;

    const weightDeltaPct = Math.round((weightMultiplier - 1) * 100);
    const timeDeltaPct = Math.round((timeMultiplier - 1) * 100);

    if (wDeltaEl) {
        wDeltaEl.textContent = weightDeltaPct >= 0 ? `+${weightDeltaPct}% de filamento` : `${weightDeltaPct}% de filamento`;
        wDeltaEl.className = weightDeltaPct >= 0 ? 'text-xs text-danger' : 'text-xs text-emerald';
    }
    if (tDeltaEl) {
        tDeltaEl.textContent = timeDeltaPct >= 0 ? `+${timeDeltaPct}% de máquina` : `${timeDeltaPct}% de máquina`;
        tDeltaEl.className = timeDeltaPct >= 0 ? 'text-xs text-purple' : 'text-xs text-emerald';
    }
}

function applyRescaleToCalculator() {
    if (!currentRescaleCalculated || currentRescaleCalculated.newWeight <= 0) {
        showToast('Calcula primero las dimensiones deseadas', 'warning');
        return;
    }

    const calcW = document.getElementById('calc-weight');
    const calcT = document.getElementById('calc-time');
    if (calcW) calcW.value = currentRescaleCalculated.newWeight;
    if (calcT) calcT.value = currentRescaleCalculated.newTime;

    calculateQuote();
    closeModal('modal-rescale-calculator');
    showToast(`✅ Valores aplicados: ${currentRescaleCalculated.newWeight}g y ${currentRescaleCalculated.newTime}h`, 'success');
}

// ==========================================================================
// FEATURE: Showroom & Galería de Trabajos Reales
// ==========================================================================
let currentGalleryFilter = 'ALL';
let tempGalleryPhotoData = '';

function renderGallery(filterCategory = currentGalleryFilter) {
    currentGalleryFilter = filterCategory;
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    if (!state.gallery) state.gallery = [];

    const items = state.gallery.filter(item => {
        return filterCategory === 'ALL' || item.category === filterCategory;
    });

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="p-4 text-center text-muted" style="grid-column: 1 / -1; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <i class="fa-solid fa-camera-retro fa-2x mb-2 text-dim"></i>
                <p class="text-sm">No hay trabajos en esta categoría.</p>
                <button class="btn-outline btn-xs mt-2" onclick="openAddGalleryPhotoModal()"><i class="fa-solid fa-plus mr-1"></i> Añadir Primera Foto</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="panel p-0 overflow-hidden" style="display:flex; flex-direction:column; border:1px solid rgba(255,255,255,0.08); background:var(--bg-card);">
            <div style="height: 180px; width: 100%; position: relative; background: #000; overflow: hidden;">
                <img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.title)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" onerror="this.src='https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'">
                <span class="badge" style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); font-size: 11px;">
                    ${escapeHtml(item.category)}
                </span>
            </div>
            <div class="p-3" style="display:flex; flex-direction:column; flex:1; justify-content:space-between;">
                <div>
                    <h4 class="font-bold text-sm mb-1 text-white">${escapeHtml(item.title)}</h4>
                    <div class="text-xs text-muted mb-2">
                        <span class="text-cyan"><i class="fa-solid fa-spool mr-1"></i> ${escapeHtml(item.material || 'PLA')}</span>
                        ${item.printer ? `<span class="ml-2 text-dim">• ${escapeHtml(item.printer)}</span>` : ''}
                    </div>
                    ${item.specs ? `<p class="text-xs text-dim mb-3" style="line-height:1.4;">${escapeHtml(item.specs)}</p>` : ''}
                </div>
                <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
                    <button class="btn-success btn-xs" onclick="sendGalleryPhotoWhatsApp('${item.id}')" title="Enviar muestra por WhatsApp">
                        <i class="fa-brands fa-whatsapp mr-1"></i> Enviar Muestra
                    </button>
                    <button class="btn-outline btn-xs text-danger border-0" onclick="deleteGalleryPhoto('${item.id}')" title="Eliminar de la galería">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function filterGalleryCategory(cat, btn) {
    const pills = document.querySelectorAll('#gallery-category-filters button');
    pills.forEach(p => p.classList.remove('active-pill'));
    if (btn) btn.classList.add('active-pill');
    renderGallery(cat);
}

function openAddGalleryPhotoModal() {
    tempGalleryPhotoData = '';
    const form = document.getElementById('form-add-gallery');
    if (form) form.reset();
    const prevWrap = document.getElementById('gal-photo-preview-wrap');
    if (prevWrap) prevWrap.style.display = 'none';
    openModal('modal-add-gallery');
}

function previewGalleryInputPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempGalleryPhotoData = e.target.result;
            const prev = document.getElementById('gal-photo-preview');
            const wrap = document.getElementById('gal-photo-preview-wrap');
            if (prev) prev.src = tempGalleryPhotoData;
            if (wrap) wrap.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewGalleryUrl(url) {
    if (url && url.startsWith('http')) {
        tempGalleryPhotoData = url;
        const prev = document.getElementById('gal-photo-preview');
        const wrap = document.getElementById('gal-photo-preview-wrap');
        if (prev) prev.src = url;
        if (wrap) wrap.style.display = 'block';
    }
}

function saveGalleryPhoto() {
    const title = document.getElementById('gal-item-title')?.value?.trim();
    const category = document.getElementById('gal-item-category')?.value || 'Otros';
    const material = document.getElementById('gal-item-material')?.value?.trim() || 'PLA';
    const printer = document.getElementById('gal-item-printer')?.value?.trim() || '';
    const specs = document.getElementById('gal-item-specs')?.value?.trim() || '';
    const photoUrl = tempGalleryPhotoData || document.getElementById('gal-item-url')?.value?.trim() || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80';

    if (!title) {
        showToast('Escribe el título de la pieza', 'warning');
        return;
    }

    if (!state.gallery) state.gallery = [];

    const newPhoto = {
        id: generateId(),
        title,
        category,
        material,
        printer,
        specs,
        photo: photoUrl,
        date: new Date().toISOString()
    };

    state.gallery.unshift(newPhoto);
    saveState();
    renderGallery();
    closeModal('modal-add-gallery');
    showToast('📸 Foto añadida a tu Showroom', 'success');
}

function deleteGalleryPhoto(id) {
    if (!confirm('¿Eliminar esta foto del Showroom?')) return;
    state.gallery = (state.gallery || []).filter(x => x.id !== id);
    saveState();
    renderGallery();
    showToast('Foto retirada del Showroom', 'info');
}

function sendGalleryPhotoWhatsApp(id) {
    const item = (state.gallery || []).find(x => x.id === id);
    if (!item) return;

    const msg = `¡Hola! 👋 Mira este ejemplo de trabajo real que fabricamos en nuestro taller:\n\n` +
                `✨ *"${item.title}"*\n` +
                `📂 *Categoría:* ${item.category}\n` +
                `🧵 *Material:* ${item.material}\n` +
                `${item.specs ? `⚙️ *Acabado:* ${item.specs}\n` : ''}` +
                `${item.photo && item.photo.startsWith('http') ? `📸 *Foto del resultado:* ${item.photo}\n\n` : '\n'}` +
                `¿Te gustaría un acabado o material similar para tu encargo? 🚀`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// ==========================================================================
// FEATURE: Calculador de Retales & Sobrantes de Bobina
// ==========================================================================
function openSpoolRemnantsModal(filamentId = null) {
    const picker = document.getElementById('remnant-spool-picker');
    if (picker) {
        picker.innerHTML = '<option value="">-- Introducir gramos manualmente --</option>' + 
            state.filaments.map(f => {
                const rem = Math.max(0, Math.round(f.currentWeight || 0));
                return `<option value="${f.id}" data-grams="${rem}">${escapeHtml(f.brand)} ${escapeHtml(f.material)} (${escapeHtml(f.colorName)}) — ${rem}g restantes</option>`;
            }).join('');

        if (filamentId) {
            picker.value = filamentId;
            const opt = picker.querySelector(`option[value="${filamentId}"]`);
            if (opt && opt.dataset.grams) {
                const gramsInput = document.getElementById('remnant-spool-grams');
                if (gramsInput) gramsInput.value = opt.dataset.grams;
            }
        }
    }

    calculateSpoolRemnants();
    openModal('modal-spool-remnants');
}

function onRemnantSpoolSelect(filamentId) {
    if (!filamentId) return;
    const f = state.filaments.find(x => x.id === filamentId);
    if (f) {
        const gramsInput = document.getElementById('remnant-spool-grams');
        if (gramsInput) gramsInput.value = Math.max(0, Math.round(f.currentWeight || 0));
        calculateSpoolRemnants();
    }
}

function calculateSpoolRemnants() {
    const grams = parseFloat(document.getElementById('remnant-spool-grams')?.value) || 0;
    const container = document.getElementById('remnants-results-grid');
    if (!container) return;

    if (grams <= 0) {
        container.innerHTML = '<div class="text-xs text-muted p-2">Indica una cantidad de gramos sobrantes para ver sugerencias.</div>';
        return;
    }

    // Default micro catalog if catalog has few items
    const candidates = (state.catalog && state.catalog.length > 0) ? state.catalog : [
        { name: 'Llavero Logotipo Personalizado', weight: 12, price: 3.50, time: 0.5, icon: 'fa-solid fa-key' },
        { name: 'Clip Cierra-Bolsas / Pinza', weight: 18, price: 2.50, time: 0.6, icon: 'fa-solid fa-paperclip' },
        { name: 'Soporte Móvil de Bolsillo', weight: 28, price: 5.00, time: 1.0, icon: 'fa-solid fa-mobile-screen' },
        { name: 'Rascador PEI para Cama 3D', weight: 35, price: 4.50, time: 1.2, icon: 'fa-solid fa-wrench' }
    ];

    const matching = candidates
        .filter(c => (c.weight || 0) <= grams)
        .map(c => {
            const units = Math.floor(grams / c.weight);
            const waste = grams - (units * c.weight);
            const totalEarn = units * (c.price || 5.00);
            return { ...c, units, waste, totalEarn };
        })
        .sort((a, b) => b.totalEarn - a.totalEarn);

    if (matching.length === 0) {
        container.innerHTML = `
            <div class="p-3 rounded bg-dark border border-secondary text-xs text-center text-muted">
                <i class="fa-solid fa-info-circle text-amber mr-1"></i> Tienes ${grams}g. Todos los modelos del catálogo pesan más. Puedes imprimir muestras de color o fichas de filamento (5-8g).
            </div>
        `;
        return;
    }

    container.innerHTML = matching.map(m => `
        <div class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
                <strong class="text-white text-xs d-block"><i class="${m.icon || 'fa-solid fa-cube'} text-amber mr-1"></i> ${escapeHtml(m.name)}</strong>
                <span class="text-xs text-muted">${m.weight}g / ud • Puedes hacer <strong class="text-emerald">${m.units} ud${m.units > 1 ? 'es' : ''}</strong> (Sobran ${m.waste}g)</span>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="text-xs font-mono text-emerald fw-bold">+${m.totalEarn.toFixed(2)} €</span>
                <button class="btn-primary btn-xs" onclick="createOrderFromRemnant('${escapeHtml(m.name)}', ${m.units}, ${m.weight}, ${m.totalEarn})">
                    <i class="fa-solid fa-plus mr-1"></i> Crear Lote
                </button>
            </div>
        </div>
    `).join('');
}

function createOrderFromRemnant(name, units, unitWeight, totalPrice) {
    const filId = document.getElementById('remnant-spool-picker')?.value || (state.filaments[0]?.id || '');
    const fil = state.filaments.find(f => f.id === filId);

    const newOrder = {
        id: generateId(),
        title: `${units}x ${name} (Liquidación Retal ${fil ? fil.colorName : ''})`,
        client: 'Stock Tienda / Mercadillo',
        filamentId: filId,
        printerId: state.printers[0]?.id || '',
        weight: units * unitWeight,
        time: parseFloat(((units * 0.8)).toFixed(1)),
        price: totalPrice,
        status: 'En Cola',
        date: new Date().toISOString(),
        changelog: [{ date: new Date().toISOString(), from: 'Creación', to: 'En Cola', note: 'Creado para aprovechar bobina casi vacía' }]
    };

    state.orders.unshift(newOrder);
    saveState();
    renderOrders();
    closeModal('modal-spool-remnants');
    showToast(`✅ Encargo añadido para aprovechar ${units * unitWeight}g de retal`, 'success');
}

// Window bindings for 6 new features
window.openRescaleModal = openRescaleModal;
window.toggleRescaleInputs = toggleRescaleInputs;
window.calculateRescale = calculateRescale;
window.applyRescaleToCalculator = applyRescaleToCalculator;

window.renderGallery = renderGallery;
window.filterGalleryCategory = filterGalleryCategory;
window.openAddGalleryPhotoModal = openAddGalleryPhotoModal;
window.previewGalleryInputPhoto = previewGalleryInputPhoto;
window.previewGalleryUrl = previewGalleryUrl;
window.saveGalleryPhoto = saveGalleryPhoto;
window.deleteGalleryPhoto = deleteGalleryPhoto;
window.sendGalleryPhotoWhatsApp = sendGalleryPhotoWhatsApp;

window.openSpoolRemnantsModal = openSpoolRemnantsModal;
window.onRemnantSpoolSelect = onRemnantSpoolSelect;
window.calculateSpoolRemnants = calculateSpoolRemnants;
window.createOrderFromRemnant = createOrderFromRemnant;

// ==========================================================================
// FEATURE 6: Histórico de Compras de Filamento & Detección de Ofertas
// ==========================================================================
function renderFilamentPurchasesSummary() {
    if (!state.filamentPurchases) state.filamentPurchases = [];
    const purchases = state.filamentPurchases;

    const plaPurchases = purchases.filter(p => p.material && p.material.toUpperCase().includes('PLA'));
    const petgPurchases = purchases.filter(p => p.material && p.material.toUpperCase().includes('PETG'));

    const avgPla = plaPurchases.length > 0 
        ? (plaPurchases.reduce((s, p) => s + (p.pricePerKg * p.quantityKg), 0) / plaPurchases.reduce((s, p) => s + p.quantityKg, 0)).toFixed(2)
        : '19.90';

    const avgPetg = petgPurchases.length > 0
        ? (petgPurchases.reduce((s, p) => s + (p.pricePerKg * p.quantityKg), 0) / petgPurchases.reduce((s, p) => s + p.quantityKg, 0)).toFixed(2)
        : '18.50';

    let bestDeal = null;
    purchases.forEach(p => {
        if (!bestDeal || p.pricePerKg < bestDeal.pricePerKg) {
            bestDeal = p;
        }
    });

    const plaEl = document.getElementById('fil-kpi-avg-pla');
    const petgEl = document.getElementById('fil-kpi-avg-petg');
    const dealEl = document.getElementById('fil-kpi-best-deal');
    const tipEl = document.getElementById('fil-kpi-savings-tip');

    if (plaEl) plaEl.textContent = `${avgPla} €/kg`;
    if (petgEl) petgEl.textContent = `${avgPetg} €/kg`;
    if (dealEl) dealEl.textContent = bestDeal ? `${bestDeal.pricePerKg.toFixed(2)} €/kg` : '11.90 €/kg';

    if (tipEl && bestDeal) {
        const savingsPct = Math.max(0, Math.round(((22.00 - bestDeal.pricePerKg) / 22.00) * 100));
        tipEl.innerHTML = `Mejor oferta en <strong>${escapeHtml(bestDeal.provider)}</strong> (-${savingsPct}% vs PVP habitual)`;
    }
}

function openFilamentPriceHistoryModal() {
    const dateInp = document.getElementById('buy-fil-date');
    if (dateInp && !dateInp.value) {
        dateInp.value = new Date().toISOString().split('T')[0];
    }

    calculatePurchasePricePerKg();
    renderFilamentPurchasesTable();
    openModal('modal-filament-price-history');
}

function calculatePurchasePricePerKg() {
    const kg = parseFloat(document.getElementById('buy-fil-kg')?.value) || 1;
    const cost = parseFloat(document.getElementById('buy-fil-cost')?.value) || 0;
    const previewEl = document.getElementById('buy-calc-preview');

    if (kg > 0 && cost > 0) {
        const pricePerKg = (cost / kg).toFixed(2);
        let badge = '';
        if (pricePerKg < 14) badge = '🔥 ¡Ofertón!';
        else if (pricePerKg <= 18) badge = '👍 Buen precio';
        else badge = '🏷️ Precio estándar';

        if (previewEl) previewEl.textContent = `Coste por Kilo: ${pricePerKg} €/kg (${badge})`;
    } else {
        if (previewEl) previewEl.textContent = 'Coste por Kilo: -- €/kg';
    }
}

function renderFilamentPurchasesTable() {
    const tbody = document.getElementById('filament-purchases-table-body');
    if (!tbody) return;

    if (!state.filamentPurchases) state.filamentPurchases = [];

    if (state.filamentPurchases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted p-3">No hay compras de filamento registradas todavía.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = state.filamentPurchases.map(p => {
        let badgeClass = 'bg-secondary';
        let dealLabel = 'Estándar';
        if (p.pricePerKg < 14) {
            badgeClass = 'bg-emerald';
            dealLabel = '¡Ofertón!';
        } else if (p.pricePerKg <= 18) {
            badgeClass = 'bg-cyan';
            dealLabel = 'Buen precio';
        }

        return `
            <tr>
                <td>${escapeHtml(p.date || '')}</td>
                <td><strong>${escapeHtml(p.brand)}</strong> <span class="badge bg-dark border border-secondary">${escapeHtml(p.material)}</span></td>
                <td><span class="text-white">${escapeHtml(p.provider)}</span></td>
                <td>${p.quantityKg} kg</td>
                <td class="font-mono">${parseFloat(p.totalCost || 0).toFixed(2)} €</td>
                <td>
                    <strong class="font-mono text-cyan">${parseFloat(p.pricePerKg || 0).toFixed(2)} €/kg</strong>
                    <span class="badge ${badgeClass} text-xs ml-1">${dealLabel}</span>
                </td>
                <td>
                    <button class="btn btn-outline btn-xs text-danger" onclick="deleteFilamentPurchase('${p.id}')" title="Eliminar registro">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function saveFilamentPurchase() {
    const date = document.getElementById('buy-fil-date')?.value || new Date().toISOString().split('T')[0];
    const provider = document.getElementById('buy-fil-provider')?.value?.trim();
    const brand = document.getElementById('buy-fil-brand')?.value?.trim();
    const material = document.getElementById('buy-fil-material')?.value || 'PLA';
    const quantityKg = parseFloat(document.getElementById('buy-fil-kg')?.value) || 1;
    const totalCost = parseFloat(document.getElementById('buy-fil-cost')?.value) || 0;
    const addExpense = document.getElementById('buy-fil-add-expense')?.checked || false;

    if (!provider || !brand || totalCost <= 0) {
        showToast('Por favor completa todos los campos de la compra', 'warning');
        return;
    }

    const pricePerKg = parseFloat((totalCost / quantityKg).toFixed(2));

    if (!state.filamentPurchases) state.filamentPurchases = [];

    const purchase = {
        id: generateId(),
        date,
        provider,
        brand,
        material,
        quantityKg,
        totalCost,
        pricePerKg,
        notes: `Compra en ${provider}`
    };

    state.filamentPurchases.unshift(purchase);

    if (addExpense) {
        if (!state.expenses) state.expenses = [];
        state.expenses.unshift({
            id: generateId(),
            date,
            concept: `Compra ${quantityKg}kg ${brand} ${material} (${provider})`,
            category: 'Filamento',
            amount: totalCost
        });
        renderExpenses();
    }

    saveState();
    renderFilamentPurchasesSummary();
    renderFilamentPurchasesTable();
    showToast(`✅ Compra registrada a ${pricePerKg} €/kg${addExpense ? ' y añadida a Gastos' : ''}`, 'success');
}

function deleteFilamentPurchase(id) {
    if (!confirm('¿Eliminar este registro de compra?')) return;
    state.filamentPurchases = (state.filamentPurchases || []).filter(p => p.id !== id);
    saveState();
    renderFilamentPurchasesSummary();
    renderFilamentPurchasesTable();
    showToast('Registro de compra eliminado', 'info');
}

// Window bindings for Feature 6
window.renderFilamentPurchasesSummary = renderFilamentPurchasesSummary;
window.openFilamentPriceHistoryModal = openFilamentPriceHistoryModal;
window.calculatePurchasePricePerKg = calculatePurchasePricePerKg;
window.renderFilamentPurchasesTable = renderFilamentPurchasesTable;
window.saveFilamentPurchase = saveFilamentPurchase;
window.deleteFilamentPurchase = deleteFilamentPurchase;




