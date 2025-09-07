// Admin ID
const ADMIN_ID = 7867539237;
let currentUser = null;
let isAdmin = false;

// Merchant wallet for manual payments
const MERCHANT_WALLET = 'UQDy5hhPvhwcNY9g-lP-nkjdmx4rAVZGFEnhOKzdF-JcIiDW';

// Current item being purchased
let currentPurchaseItem = null;
let currentPaymentMethods = null;
let selectedPaymentMethod = null;

// Current inventory item being viewed
let currentInventoryItem = null;

// User stats
let userStats = {
    totalPurchases: 0,
    totalSpent: 0,
    referralCount: 0,
    referralEarnings: 0
};

// User balance (for top-up and balance payments)
let userBalance = {
    stars: 0
};


// Initialize Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // Get user data
    const user = tg.initDataUnsafe?.user;
    const startParam = tg.initDataUnsafe?.start_param;

    // Process referral from start param
    if (startParam && !isNaN(startParam)) {
        localStorage.setItem('referrerId', startParam);
        console.log('Referral ID from start param:', startParam);
    }

    if (user && user.id) {
        currentUser = {
            id: user.id,
            username: user.username || null,
            first_name: user.first_name || 'user',
            last_name: user.last_name || null,
            photo_url: user.photo_url || null
        };
        isAdmin = user.id === ADMIN_ID;

        console.log('User initialized:', currentUser);

        // Синхронизация данных пользователя с новой системой
        syncUserData(currentUser);

        if (isAdmin) {
            addAdminButton();
        }

        // Set user profile info
        setUserProfileInfo(currentUser);

        // Load user stats and balance
        loadUserStats(currentUser.id);
        loadUserBalance(currentUser.id);

        // Update username if changed
        updateUserUsername(currentUser.id, currentUser.username);

        // Process referral if exists
        processReferral();
    } else {
        console.log('No valid user data found in Telegram WebApp');
        // Fallback for testing outside Telegram
        currentUser = {
            id: 7867539237,
            username: 'test_user',
            first_name: 'Test',
            last_name: 'User',
            photo_url: null
        };
        console.log('Using fallback user for testing:', currentUser);

        // Set user profile info for fallback user too
        setUserProfileInfo(currentUser);
        loadUserStats(currentUser.id);
        loadUserBalance(currentUser.id);
    }

    // Enable fullscreen mode (check if method exists)
    try {
        if (tg.requestFullscreen && typeof tg.requestFullscreen === 'function') {
            tg.requestFullscreen();
        }
    } catch (error) {
        console.log('Fullscreen not supported in this Telegram version');
    }

    // Set theme
    try {
        if (tg.setHeaderColor) {
            tg.setHeaderColor('#1a1a1a');
        }
        if (tg.setBackgroundColor) {
            tg.setBackgroundColor('#1a1a1a');
        }
    } catch (error) {
        console.log('Theme methods not supported');
    }
}



// Add admin button to navigation
function addAdminButton() {
    const bottomNav = document.getElementById('bottomNav');
    const adminNavItem = document.createElement('div');
    adminNavItem.className = 'nav-item';
    adminNavItem.innerHTML = `
        <img class="nav-icon" src="https://i.postimg.cc/FHzrQQZD/IMG-1211.png" alt="Админ">
        <span class="nav-text">Админ</span>
    `;
    bottomNav.appendChild(adminNavItem);

    // Add click handler
    adminNavItem.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');

        // Show admin section
        document.getElementById('marketSection').style.display = 'none';
        document.getElementById('activitySection').style.display = 'none';
        document.getElementById('inventorySection').style.display = 'none';
        document.getElementById('adminSection').style.display = 'block';
        // Загружаем товары перед отображением админ панели
        loadNFTs().then(() => {
            renderAdminItems();
        });
    });
}

// NFT data
let nftItems = []; // This seems to be a fallback or older data, availableNFTs is used now
let availableNFTs = []; // This is the primary list of NFTs
let activityItems = [];
let inventoryItems = [];
let editingItemId = null;

// DOM elements
const nftGrid = document.getElementById('nftGrid');
const activityList = document.getElementById('activityList');
const inventoryGrid = document.getElementById('inventoryGrid');
const marketSection = document.getElementById('marketSection');
const activitySection = document.getElementById('activitySection');
const inventorySection = document.getElementById('inventorySection');

// Load NFT items from server
async function loadNFTs() {
    try {
        const response = await fetch('/api/items');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        availableNFTs = Array.isArray(data) ? data : [];
        renderNFTs(availableNFTs);

        // Обновляем админ панель если она открыта
        if (document.getElementById('adminSection').style.display === 'block') {
            renderAdminItems();
        }

        console.log('NFTs loaded:', availableNFTs);
    } catch (error) {
        console.error('Error loading NFTs:', error);
        availableNFTs = [];
        renderNFTs(availableNFTs);
    }
}

// Функция для отображения NFT (совместимость)
function displayNFTs() {
    renderNFTs(availableNFTs);
}

// Load activity from server
async function loadActivity() {
    try {
        const response = await fetch('/api/activity');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        activityItems = Array.isArray(data) ? data : [];
        displayActivity();
        console.log('Activity loaded:', activityItems.length, 'items');
    } catch (error) {
        console.error('Error loading activity:', error);
        activityItems = [];
        displayActivity();
    }
}

// Load inventory from server
async function loadInventory() {
    try {
        // Проверяем наличие пользователя
        if (!currentUser) {
            console.log('No current user available');
            inventoryItems = [];
            renderInventory();
            return;
        }

        // Проверяем ID пользователя
        const userId = currentUser.id;
        if (!userId || isNaN(userId) || userId <= 0) {
            console.log('Invalid user ID:', userId);
            inventoryItems = [];
            renderInventory();
            return;
        }

        console.log('Loading inventory for user:', userId);

        const response = await fetch(`/api/inventory/${userId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            inventoryItems = data.map(item => {
                // Check if item is a "Printed Machine" and not upgraded
                if (item.name && item.name.toLowerCase().includes('печатная машина') && !item.isNFT) {
                    item.status = 'Неуникальный';
                    item.statusColor = 'non-unique';
                } else if (item.isNFT) {
                    item.status = 'Уникальный';
                    item.statusColor = 'unique';
                } else {
                    item.status = item.status || 'Редкий';
                    item.statusColor = item.statusColor || 'rare';
                }
                return item;
            });
            console.log(`Successfully loaded ${inventoryItems.length} inventory items`);
        } else {
            console.warn('Invalid inventory data format received:', typeof data);
            inventoryItems = [];
        }

        renderInventory();
    } catch (error) {
        console.error('Error loading inventory:', error.message || error);
        inventoryItems = [];
        renderInventory();
    }
}

// Load user balance
async function loadUserBalance(userId) {
    const targetUserId = userId || (currentUser && currentUser.id);

    if (!targetUserId) {
        console.log('No user ID available for balance loading');
        userBalance = { stars: 0 };
        updateBalanceDisplay();
        return;
    }

    try {
        const response = await fetch(`/api/user-balance/${targetUserId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        userBalance = { stars: data.stars || 0 };
        updateBalanceDisplay();
        console.log('User balance loaded:', data);
    } catch (error) {
        console.error('Error loading user balance:', error);
        userBalance = { stars: 0 };
        updateBalanceDisplay();
    }
}

// Update balance display in UI
function updateBalanceDisplay() {
    // Убеждаемся что userBalance это число, а не объект
    const balance = typeof userBalance === 'object' ? (userBalance.stars || 0) : (userBalance || 0);
    console.log('Updating balance display with:', balance);

    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) {
        balanceElement.textContent = balance.toLocaleString();
        console.log('Updated userBalance element to:', balance.toLocaleString());
    } else {
        console.log('userBalance element not found');
    }

    const balanceAmountElement = document.querySelector('.balance-amount');
    if (balanceAmountElement) {
        balanceAmountElement.textContent = balance.toLocaleString();
        console.log('Updated balance-amount element to:', balance.toLocaleString());
    } else {
        console.log('balance-amount element not found');
    }

    // Дополнительно обновляем все возможные элементы баланса
    const allBalanceElements = document.querySelectorAll('[data-balance]');
    allBalanceElements.forEach(element => {
        element.textContent = balance.toLocaleString();
    });
}

// Alias for loadInventory
async function loadUserInventory() {
    return await loadInventory();
}

// Auto-refresh data every 30 seconds
function autoRefresh() {
    setInterval(async () => {
        try {
            if (currentUser && currentUser.id) {
                await Promise.all([
                    loadUserBalance(),
                    loadUserStats()
                ]);
            }
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }, 30000);
}

// Admin functions
function renderAdminItems() {
    const adminItems = document.getElementById('adminItems');
    // Используем availableNFTs вместо nftItems
    const itemsToShow = availableNFTs.length > 0 ? availableNFTs : nftItems;

    if (itemsToShow.length === 0) {
        adminItems.innerHTML = `
            <div class="admin-empty">
                <div class="admin-empty-icon">📦</div>
                <div class="admin-empty-text">Нет товаров</div>
                <div class="admin-empty-subtext">Добавьте первый товар</div>
            </div>
        `;
        return;
    }

    adminItems.innerHTML = '';
    itemsToShow.forEach(item => {
        const adminItem = createAdminItemElement(item);
        adminItems.appendChild(adminItem);
    });
}

function createAdminItemElement(item) {
    const div = document.createElement('div');
    div.className = 'admin-item';

    const imageContent = item.image.startsWith('http') ?
        `<img src="${item.image}" alt="${item.name}">` :
        item.image;

    let pricesDisplay = '';
    if (item.prices) {
        const prices = [];
        if (item.prices.TON > 0) prices.push(`${item.prices.TON} TON`);
        if (item.prices.STARS > 0) prices.push(`${item.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px;" alt="Stars">`);
        if (item.prices.RUB > 0) prices.push(`${item.prices.RUB} ₽`);
        pricesDisplay = prices.join(' | ');
    } else {
        // Для совместимости со старым форматом
        const starsPrice = Math.ceil(item.price * 100);
        const rublePrice = Math.ceil(item.price * 300);
        pricesDisplay = `${item.price} TON | ${starsPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px;" alt="Stars"> | ${rublePrice} ₽`;
    }

    div.innerHTML = `
        <div class="admin-item-image">
            ${imageContent}
            ${item.tag ? `<div class="admin-item-tag ${item.tagColor}">${item.tag}</div>` : ''}
            ${item.status ? `<div class="admin-item-status ${item.statusColor || 'rare'}">${item.status}</div>` : ''}
        </div>
        <div class="admin-item-info">
            <h3>${item.name}</h3>
            <div class="admin-item-details">
                <div class="admin-detail">${pricesDisplay}</div>
                <div class="admin-detail">${item.quantity}</div>
                <div class="admin-detail">Осталось: ${item.stock}</div>
            </div>
        </div>
        <div class="admin-item-actions">
            <button class="admin-edit-btn" onclick="editAdminItem(${item.id})">✏️</button>
            <button class="admin-delete-btn" onclick="deleteAdminItem(${item.id})">🗑️</button>
        </div>
    `;

    return div;
}

function openAddItemModal() {
    editingItemId = null;
    document.getElementById('adminModalTitle').textContent = 'Добавить товар';
    clearAdminForm();
    document.getElementById('adminItemModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function editAdminItem(itemId) {
    const itemsToSearch = availableNFTs.length > 0 ? availableNFTs : nftItems;
    const item = itemsToSearch.find(nft => nft.id === itemId);
    if (!item) return;

    editingItemId = itemId;
    document.getElementById('adminModalTitle').textContent = 'Редактировать товар';

    // Fill form
    document.getElementById('itemImage').value = item.image || '';
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemDescription').value = item.description || '';

    // Заполнение цен в разных валютах
    if (item.prices) {
        document.getElementById('itemPriceTON').value = item.prices.TON || '';
        document.getElementById('itemPriceStars').value = item.prices.STARS || '';
        document.getElementById('itemPriceRubles').value = item.prices.RUB || '';
    } else {
        // Для совместимости со старым форматом
        document.getElementById('itemPriceTON').value = item.price || '';
        document.getElementById('itemPriceStars').value = '';
        document.getElementById('itemPriceRubles').value = '';
    }

    document.getElementById('itemQuantity').value = item.quantity || '';
    document.getElementById('itemStock').value = item.stock || 1;
    document.getElementById('itemTag').value = item.tag || '';
    document.getElementById('itemTagColor').value = item.tagColor || 'new';
    document.getElementById('itemStatus').value = item.status || 'Редкий';
    document.getElementById('itemStatusColor').value = item.statusColor || 'rare';

    document.getElementById('adminItemModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function deleteAdminItem(itemId) {
    console.log('Удаление товара:', itemId);

    try {
        const response = await fetch(`/api/items/${itemId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Reload data from server to sync with all users
            await loadNFTs();
            renderAdminItems();

            console.log('Товар успешно удален');

            if (window.Telegram?.WebApp?.showPopup) {
                try {
                    window.Telegram.WebApp.showPopup({
                        title: 'Успешно',
                        message: 'Товар удален',
                        buttons: [{ type: 'ok', text: 'OK' }]
                    });
                } catch (error) {
                    console.log('Товар удален');
                }
            }
        } else {
            console.log('Ошибка при удалении товара');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
    }
}

function clearAdminForm() {
    document.getElementById('itemImage').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemPriceTON').value = '';
    document.getElementById('itemPriceStars').value = '';
    document.getElementById('itemPriceRubles').value = '';
    document.getElementById('itemQuantity').value = '';
    document.getElementById('itemStock').value = '1';
    document.getElementById('itemTag').value = '';
    document.getElementById('itemTagColor').value = 'new';
    document.getElementById('itemStatus').value = 'Редкий';
    document.getElementById('itemStatusColor').value = 'rare';
}

function closeAdminItemModal() {
    document.getElementById('adminItemModal').classList.remove('active');
    document.body.style.overflow = '';
    editingItemId = null;
}

async function saveAdminItem() {
    const tonPrice = parseFloat(document.getElementById('itemPriceTON').value) || 0;
    const starsPrice = parseFloat(document.getElementById('itemPriceStars').value) || 0;
    const rublesPrice = parseFloat(document.getElementById('itemPriceRubles').value) || 0;

    const itemData = {
        image: document.getElementById('itemImage').value.trim(),
        name: document.getElementById('itemName').value.trim(),
        description: document.getElementById('itemDescription').value.trim(),
        prices: {
            TON: tonPrice,
            STARS: starsPrice,
            RUB: rublesPrice
        },
        quantity: document.getElementById('itemQuantity').value.trim() || 'x1',
        stock: parseInt(document.getElementById('itemStock').value) || 1,
        tag: document.getElementById('itemTag').value.trim(),
        tagColor: document.getElementById('itemTagColor').value || 'new',
        status: document.getElementById('itemStatus').value.trim() || 'Редкий',
        statusColor: document.getElementById('itemStatusColor').value || 'rare'
    };

    // Validation
    if (!itemData.name) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите название товара',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    if (tonPrice === 0 && starsPrice === 0 && rublesPrice === 0) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Укажите хотя бы одну цену (TON, Stars или ₽)',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    try {
        let response;

        if (editingItemId) {
            // Edit existing item
            response = await fetch(`/api/items/${editingItemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });
        } else {
            // Add new item
            response = await fetch('/api/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });
        }

        if (response.ok) {
            // Reload data from server to sync with all users
            await loadNFTs();
            renderAdminItems();
            closeAdminItemModal();

            console.log('Товар успешно сохранен');
        } else {
            const error = await response.json();
            console.log('Ошибка:', error.error || 'Не удалось сохранить товар');
        }
    } catch (error) {
        console.error('Error saving item:', error);
        console.log('Ошибка при сохранении товара');
    }
}

// Render NFT items
function renderNFTs(items) {
    nftGrid.innerHTML = '';

    if (items.length === 0) {
        nftGrid.innerHTML = `
            <div class="empty-market" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #888;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🛒</div>
                <div style="font-size: 16px; margin-bottom: 8px;">Магазин пуст</div>
                <div style="font-size: 14px; opacity: 0.7;">Товары появятся здесь</div>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const nftElement = createNFTElement(item);
        nftGrid.appendChild(nftElement);
    });
}

// Create NFT element
function createNFTElement(item) {
    const div = document.createElement('div');
    div.className = 'nft-item';
    div.onclick = () => openPurchaseModal(item);

    const imageContent = item.image && item.image.startsWith('http') ?
        `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` :
        (item.image || '📦');

    // Определить какую цену показывать (приоритет: Stars, затем TON, затем рубли)
    let priceDisplay = '';
    if (item.prices) {
        if (item.prices.STARS > 0) {
            priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-right: 4px;" alt="Stars">${item.prices.STARS}`;
        } else if (item.prices.TON > 0) {
            priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 16px; height: 16px; margin-right: 4px;" alt="TON">${item.prices.TON}`;
        } else if (item.prices.RUB > 0) {
            priceDisplay = `<img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 16px; height: 16px; margin-right: 4px;" alt="RUB">${item.prices.RUB}`;
        }
    } else if (item.price && !isNaN(item.price) && item.price > 0) {
        priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 16px; height: 16px; margin-right: 4px;" alt="TON">${item.price}`;
    }

    div.innerHTML = `
        <div class="nft-image">
            ${imageContent}
            <div class="nft-quantity">${item.quantity}</div>
            ${item.tag ? `<div class="nft-tag ${item.tagColor || 'new'}">${item.tag}</div>` : ''}
            ${item.status ? `<div class="nft-status ${item.statusColor || 'rare'}">${item.status}</div>` : ''}
        </div>
        <div class="nft-info">
            <h3>${item.name}</h3>
            <div class="nft-description">
                ${item.description || ''}
            </div>
        </div>
        <button class="buy-btn" onclick="event.stopPropagation(); console.log('Клик по кнопке купить, ID:', ${item.id}); buyItem(${item.id})" ${(item.stock === 0 || item.stock === undefined) ? 'disabled' : ''}>
            <span>${priceDisplay}</span>
        </button>
    `;

    return div;
}

// Buy item function with payment methods selection
async function buyItem(itemId) {
    console.log('Попытка покупки товара:', itemId);

    const item = availableNFTs.find(nft => nft.id === itemId) || nftItems.find(nft => nft.id === itemId);
    if (!item || item.stock <= 0) {
        console.log('Товар недоступен');
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Товар недоступен или распродан',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    // Store current purchase item and open payment methods modal
    currentPurchaseItem = item;
    await openPaymentMethodsModal(item);
}

// Render activity items
function renderActivity() {
    if (activityItems.length === 0) {
        activityList.innerHTML = `
            <div class="empty-activity">
                <div class="empty-activity-icon">📦</div>
                <div class="empty-activity-text">Нет активности</div>
                <div class="empty-activity-subtext">Покупки будут отображаться здесь</div>
            </div>
        `;
        return;
    }

    activityList.innerHTML = '';

    activityItems.forEach(item => {
        const activityElement = createActivityElement(item);
        activityList.appendChild(activityElement);
    });
}

// Alias for displayActivity for compatibility
function displayActivity() {
    renderActivity();
}

// Create activity element
function createActivityElement(item) {
    const div = document.createElement('div');
    div.className = 'activity-item';

    const imageContent = item.image && item.image.startsWith('http') ?
        `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` :
        (item.image || '📦');

    // Определить цену для отображения на основе способа оплаты
    let priceDisplay = '';

    // Определяем способ оплаты на основе данных о покупке
    if (item.paymentMethod) {
        switch (item.paymentMethod) {
            case 'STARS':
                priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.convertedPrice || item.prices?.STARS || Math.ceil((item.price || 0) * 100)}`;
                break;
            case 'TON':
                priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="TON">${item.convertedPrice || item.prices?.TON || item.price || 0}`;
                break;
            case 'YOOMONEY':
            case 'RUB':
                priceDisplay = `<img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="RUB">${item.convertedPrice || item.prices?.RUB || Math.ceil((item.price || 0) * 300)}`;
                break;
            default:
                // Для неизвестного способа оплаты - пытаемся определить по цене
                if (item.convertedPrice && item.convertedPrice >= 100) {
                    priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.convertedPrice}`;
                } else if (item.convertedPrice && item.convertedPrice < 100 && item.convertedPrice >= 1) {
                    priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="TON">${item.convertedPrice}`;
                } else {
                    priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.convertedPrice || Math.ceil((item.price || 0) * 100)}`;
                }
                break;
        }
    } else {
        // Fallback для старых записей без указания способа оплаты
        // Пытаемся определить способ оплаты по размеру convertedPrice
        if (item.convertedPrice && !isNaN(item.convertedPrice) && item.convertedPrice > 0) {
            if (item.convertedPrice === 1) {
                // Скорее всего TON
                priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="TON">${item.convertedPrice}`;
            } else if (item.convertedPrice === 100) {
                // Скорее всего Stars
                priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.convertedPrice}`;
            } else if (item.convertedPrice === 500) {
                // Скорее всего рубли
                priceDisplay = `<img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="RUB">${item.convertedPrice}`;
            } else if (item.convertedPrice >= 300) {
                // Большая сумма - скорее всего рубли
                priceDisplay = `<img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="RUB">${item.convertedPrice}`;
            } else if (item.convertedPrice >= 50) {
                // Средняя сумма - скорее всего Stars
                priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.convertedPrice}`;
            } else {
                // Маленькая сумма - скорее всего TON
                priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="TON">${item.convertedPrice}`;
            }
        } else if (item.prices) {
            if (item.prices.STARS > 0) {
                priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">${item.prices.STARS}`;
            } else if (item.prices.TON > 0) {
                priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="TON">${item.prices.TON}`;
            } else if (item.prices.RUB > 0) {
                priceDisplay = `<img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="RUB">${item.prices.RUB}`;
            }
        } else if (item.price && !isNaN(item.price) && item.price > 0) {
            // Старый формат - показываем как TON
            priceDisplay = `<img src="https://ton.org/download/ton_symbol.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="TON">${item.price}`;
        } else {
            priceDisplay = `<img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 12px; height: 12px; margin-right: 4px;" alt="Stars">1`;
        }
    }

    // Используем buyerNumber из данных активности, ID товара или fallback
    let giftNumber;
    if (item.buyerNumber) {
        giftNumber = item.buyerNumber;
    } else if (item.id) {
        giftNumber = item.id;
    } else {
        giftNumber = activityItems.length - activityItems.indexOf(item);
    }

    div.innerHTML = `
        <div class="activity-image">
            ${imageContent}
        </div>
        <div class="activity-info">
            <h3 class="activity-title">${item.name}</h3>
            <div class="activity-id">#${giftNumber}</div>
        </div>
        <div class="activity-details">
            <div class="activity-action">Покупка</div>
            <div class="activity-price">
                ${priceDisplay}
            </div>
            <div class="activity-date">${item.date} ${item.time}</div>
        </div>
    `;

    return div;
}

// Render inventory items
function renderInventory() {
    if (inventoryItems.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="empty-inventory" style="grid-column: 1 / -1;">
                <div class="empty-inventory-icon">🎒</div>
                <div class="empty-inventory-text">Инвентарь пуст</div>
                <div class="empty-inventory-subtext">Купленные предметы будут отображаться здесь</div>
            </div>
        `;
        return;
    }

    inventoryGrid.innerHTML = '';

    inventoryItems.forEach(item => {
        const inventoryElement = createInventoryElement(item);
        inventoryGrid.appendChild(inventoryElement);
    });
}

// Create inventory element
function createInventoryElement(item) {
    const div = document.createElement('div');
    div.className = 'inventory-item';
    div.onclick = () => openInventoryModal(item);

    const imageContent = item.image.startsWith('http') ?
        `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` :
        item.image;

    div.innerHTML = `
        <div class="inventory-image">
            ${imageContent}
            <div class="inventory-quantity">${item.quantity}</div>
        </div>
        <div class="inventory-info">
            <h3>${item.name}</h3>
        </div>
    `;

    return div;
}

// Inventory modal functions
function openInventoryModal(item) {
    currentInventoryItem = item;
    const modal = document.getElementById('inventoryModal');
    const modalImage = document.getElementById('inventoryModalImage');
    const modalTitle = document.getElementById('inventoryModalTitle');
    const modalPrice = document.getElementById('inventoryModalPrice');
    const modalOwner = document.getElementById('inventoryModalOwner');
    const modalId = document.getElementById('inventoryModalId');
    const modalComment = document.getElementById('inventoryModalComment');
    const commentRow = document.getElementById('commentRow');
    const priceRow = document.getElementById('priceRow');
    const modelRow = document.getElementById('modelRow');
    const backgroundRow = document.getElementById('backgroundRow');
    const statusElement = document.getElementById('inventoryModalStatus');

    // Set modal content
    modalTitle.textContent = item.name;

    // Set correct ID for all items - приоритет: buyerNumber, потом ID товара, потом inventoryId
    let displayId;
    if (item.buyerNumber) {
        displayId = item.buyerNumber;
    } else if (item.id) {
        displayId = item.id;
    } else {
        displayId = item.inventoryId || 'N/A';
    }
    modalId.textContent = `#${displayId}`;

    // Определить цену для отображения - показываем цену в той валюте, в которой покупали
    let priceDisplay = '';

    // Используем точное поле paymentMethod для определения иконки
    if (item.paymentMethod) {
        switch (item.paymentMethod) {
            case 'STARS':
                priceDisplay = `${item.convertedPrice || item.prices?.STARS || Math.ceil((item.price || 0) * 100)} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
                break;
            case 'TON':
                priceDisplay = `${item.convertedPrice || item.prices?.TON || item.price || 0} <img src="https://ton.org/download/ton_symbol.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="TON">`;
                break;
            case 'YOOMONEY':
            case 'RUB':
                priceDisplay = `${item.convertedPrice || item.prices?.RUB || Math.ceil((item.price || 0) * 300)} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="RUB">`;
                break;
            default:
                priceDisplay = `${item.convertedPrice || Math.ceil((item.price || 0) * 100)} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
                break;
        }
    } else {
        // Fallback - определяем по данным из activity.json для более точного отображения
        if (item.convertedPrice && !isNaN(item.convertedPrice) && item.convertedPrice > 0) {
            // Проверяем точные значения из activity.json для определения способа оплаты
            if (item.convertedPrice === 1) {
                // Точно TON
                priceDisplay = `${item.convertedPrice} <img src="https://ton.org/download/ton_symbol.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="TON">`;
            } else if (item.convertedPrice === 100) {
                // Точно Stars
                priceDisplay = `${item.convertedPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
            } else if (item.convertedPrice === 500) {
                // Точно рубли
                priceDisplay = `${item.convertedPrice} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="RUB">`;
            } else if (item.convertedPrice >= 300) {
                // Большая сумма - скорее всего рубли
                priceDisplay = `${item.convertedPrice} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="RUB">`;
            } else if (item.convertedPrice >= 50) {
                // Средняя сумма - скорее всего Stars
                priceDisplay = `${item.convertedPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
            } else {
                // Маленькая сумма - скорее всего TON
                priceDisplay = `${item.convertedPrice} <img src="https://ton.org/download/ton_symbol.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="TON">`;
            }
        } else if (item.prices) {
            if (item.prices.STARS > 0) {
                priceDisplay = `${item.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
            } else if (item.prices.TON > 0) {
                priceDisplay = `${item.prices.TON} <img src="https://ton.org/download/ton_symbol.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="TON">`;
            } else if (item.prices.RUB > 0) {
                priceDisplay = `${item.prices.RUB} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="RUB">`;
            }
        } else if (item.price && !isNaN(item.price) && item.price > 0) {
            priceDisplay = `${item.price} <img src="https://ton.org/download/ton_symbol.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="TON">`;
        } else {
            priceDisplay = `1 <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; margin-left: 4px;" alt="Stars">`;
        }
    }

    modalPrice.innerHTML = priceDisplay;

    // Set owner with username or nickname
    const ownerText = item.username ? `@${item.username}` : (item.nickname || 'UQDy...liDW');
    modalOwner.textContent = ownerText;

    // Show comment if exists
    if (item.comment && item.comment.trim()) {
        modalComment.textContent = item.comment;
        commentRow.style.display = 'flex';
    } else {
        commentRow.style.display = 'none';
    }

    // Update status, model, and background based on whether it's an NFT
    const upgradeSection = document.querySelector('.modal-upgrade-section');

    if (item.isNFT) {
        // Hide upgrade button if it's already an NFT
        if (upgradeSection) {
            upgradeSection.style.display = 'none';
        }

        // Show model and background rows, hide price row
        if (modelRow) modelRow.style.display = 'flex';
        if (backgroundRow) backgroundRow.style.display = 'flex';
        if (priceRow) priceRow.style.display = 'none';

        // Set new status and details
        if (statusElement) {
            statusElement.textContent = 'Уникальный';
            statusElement.className = 'detail-value status-unique';
        }

        const modelSpan = document.getElementById('inventoryModalModel');
        const backgroundSpan = document.getElementById('inventoryModalBackground');

        // Используем nftModel и nftBackground для NFT подарков
        if (modelSpan) modelSpan.textContent = item.nftModel || item.model || 'Не указано';
        if (backgroundSpan) backgroundSpan.textContent = item.nftBackground || item.background || 'Не указано';

    } else {
        // Show upgrade button only for non-NFT Печатная машина
        const isPrintingMachine = item.name && item.name.toLowerCase().includes('печатная машина');

        if (upgradeSection) {
            upgradeSection.style.display = isPrintingMachine ? 'block' : 'none';
        }

        // Hide model and background rows, show price row
        if (modelRow) modelRow.style.display = 'none';
        if (backgroundRow) backgroundRow.style.display = 'none';
        if (priceRow) priceRow.style.display = 'flex';

        // Set default status
        if (statusElement) {
            statusElement.textContent = item.status || 'Редкий';
            statusElement.className = `detail-value ${item.statusColor || 'rare'}`;
        }
    }

    // Set image
    if (item.image.startsWith('http')) {
        modalImage.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="modal-quantity">${item.quantity}</div>
        `;
    } else {
        modalImage.innerHTML = `
            ${item.image}
            <div class="modal-quantity">${item.quantity}</div>
        `;
    }

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeInventoryModal() {
    const modal = document.getElementById('inventoryModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentInventoryItem = null;
}

function withdrawItem() {
    if (window.Telegram?.WebApp?.showPopup) {
        try {
            window.Telegram.WebApp.showPopup({
                title: 'Вывод',
                message: 'Подарок можно будет вывести в профиль в скором времени.',
                buttons: [{ type: 'ok', text: 'Понятно' }]
            });
        } catch (error) {
            console.log('Функция вывода будет доступна в ближайшее время');
        }
    } else {
        console.log('Функция вывода будет доступна в ближайшее время');
    }
}

// Current item being transferred
let currentTransferItem = null;

function openTransferModal(inventoryItem) {
    if (!inventoryItem) {
        console.error('No inventory item provided to openTransferModal');
        return;
    }

    currentInventoryItem = inventoryItem;
    console.log('Opening transfer modal for:', currentInventoryItem);

    // Reload inventory to get the most up-to-date data
    loadInventory().then(() => {
        // Find the exact item in the current inventory data to ensure it's still available
        const userInventory = inventoryItems.filter(item => item.userId === currentUser.id);

        let exactItem;

        // Try to find by inventoryId first if available
        if (currentInventoryItem.inventoryId) {
            exactItem = inventoryItems.find(invItem =>
                invItem.inventoryId === currentInventoryItem.inventoryId &&
                invItem.userId === currentUser.id
            );
            console.log('Searching by inventoryId:', currentInventoryItem.inventoryId);
        }

        // If not found by inventoryId, try by other criteria
        if (!exactItem) {
            exactItem = inventoryItems.find(invItem =>
                invItem.userId === currentUser.id &&
                invItem.id === currentInventoryItem.id &&
                invItem.name === currentInventoryItem.name &&
                Math.abs((invItem.price || 0) - (currentInventoryItem.price || 0)) < 0.01
            );
            console.log('Searching by criteria match');
        }

        if (!exactItem) {
            console.error('Could not find exact item in inventory');
            console.log('Looking for:', currentInventoryItem);
            console.log('Available items:', inventoryItems.filter(item => item.userId === currentUser.id));
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Предмет не найден в инвентаре',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
            return;
        }

        // Create a deep copy to avoid reference issues
        currentTransferItem = JSON.parse(JSON.stringify(exactItem));
        console.log('Transfer modal opened for item:', currentTransferItem);

        // Проверка что currentTransferItem корректно установлен
        if (!currentTransferItem || !currentTransferItem.name) {
            console.error('Failed to set currentTransferItem properly:', currentTransferItem);
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Ошибка загрузки данных предмета',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
            return;
        }

        // Получаем элементы модального окна передачи
        const modal = document.getElementById('transferModal');
        const itemImage = document.getElementById('transferItemImage');
        const itemName = document.getElementById('transferItemName');

        // Очищаем поля ввода
        document.getElementById('transferUserId').value = '';
        document.getElementById('transferComment').value = '';

        // Безопасная проверка основных элементов
        if (!itemName || !itemImage || !modal) {
            console.error('Не найдены основные элементы модального окна передачи');
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: 'Ошибка интерфейса модального окна',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
            return;
        }

        // Заполняем информацию о предмете
        itemName.textContent = currentTransferItem.name || 'Подарок';

        // Определяем цену для отображения на основе способа оплаты
        let transferPriceDisplay = '';

        // Определяем способ оплаты на основе данных о покупке
        if (currentTransferItem.paymentMethod) {
            switch (currentTransferItem.paymentMethod) {
                case 'STARS':
                    transferPriceDisplay = `${currentTransferItem.convertedPrice || currentTransferItem.prices?.STARS || Math.ceil(currentTransferItem.price * 100)} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
                    break;
                case 'TON':
                    transferPriceDisplay = `${currentTransferItem.convertedPrice || currentTransferItem.prices?.TON || currentTransferItem.price} <img src="https://ton.org/download/ton_symbol.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="TON">`;
                    break;
                case 'YOOMONEY':
                case 'RUB':
                    transferPriceDisplay = `${currentTransferItem.convertedPrice || currentTransferItem.prices?.RUB} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="RUB">`;
                    break;
                default:
                    transferPriceDisplay = `${currentTransferItem.convertedPrice || Math.ceil(currentTransferItem.price * 100)} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
                    break;
            }
        } else {
            // Fallback для старых записей - определяем по точным значениям
            if (currentTransferItem.convertedPrice && !isNaN(currentTransferItem.convertedPrice) && currentTransferItem.convertedPrice > 0) {
                // Проверяем точные значения для определения способа оплаты
                if (currentTransferItem.convertedPrice === 1) {
                    // Точно TON
                    transferPriceDisplay = `${currentTransferItem.convertedPrice} <img src="https://ton.org/download/ton_symbol.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="TON">`;
                } else if (currentTransferItem.convertedPrice === 100) {
                    // Точно Stars
                    transferPriceDisplay = `${currentTransferItem.convertedPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
                } else if (currentTransferItem.convertedPrice === 500) {
                    // Точно рубли
                    transferPriceDisplay = `${currentTransferItem.convertedPrice} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="RUB">`;
                } else if (currentTransferItem.convertedPrice >= 300) {
                    // Большая сумма - скорее всего рубли
                    transferPriceDisplay = `${currentTransferItem.convertedPrice} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="RUB">`;
                } else if (currentTransferItem.convertedPrice >= 50) {
                    // Средняя сумма - скорее всего Stars
                    transferPriceDisplay = `${currentTransferItem.convertedPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
                } else {
                    // Маленькая сумма - скорее всего TON
                    transferPriceDisplay = `${currentTransferItem.convertedPrice} <img src="https://ton.org/download/ton_symbol.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="TON">`;
                }
            } else if (currentTransferItem.prices && typeof currentTransferItem.prices === 'object') {
                // Приоритет: STARS > TON > RUB
                if (currentTransferItem.prices.STARS && currentTransferItem.prices.STARS > 0) {
                    transferPriceDisplay = `${currentTransferItem.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
                } else if (currentTransferItem.prices.TON && currentTransferItem.prices.TON > 0) {
                    transferPriceDisplay = `${currentTransferItem.prices.TON} <img src="https://ton.org/download/ton_symbol.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="TON">`;
                } else if (currentTransferItem.prices.RUB && currentTransferItem.prices.RUB > 0) {
                    transferPriceDisplay = `${currentTransferItem.prices.RUB} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="RUB">`;
                }
            } else if (currentTransferItem.price && !isNaN(currentTransferItem.price) && currentTransferItem.price > 0) {
                // Старый формат с полем price
                transferPriceDisplay = `${currentTransferItem.price} <img src="https://ton.org/download/ton_symbol.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="TON">`;
            } else {
                // Резервное значение
                transferPriceDisplay = `1 <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
            }
        }

        // Создаем HTML структуру для мета-информации
        let transferDisplayId;
        if (currentTransferItem.buyerNumber) {
            transferDisplayId = currentTransferItem.buyerNumber;
        } else if (currentTransferItem.id) {
            transferDisplayId = currentTransferItem.id;
        } else {
            transferDisplayId = currentTransferItem.inventoryId || '0000';
        }

        const metaHTML = `
            <div class="transfer-item-price">${transferPriceDisplay}</div>
            <div class="transfer-item-id">#${transferDisplayId}</div>
        `;

        // Найдем или создадим контейнер для мета-информации
        let metaContainer = document.querySelector('.transfer-item-meta');
        if (metaContainer) {
            metaContainer.innerHTML = metaHTML;
        }

        // Set image with safety checks
        if (currentTransferItem.image && currentTransferItem.image.startsWith('http')) {
            itemImage.innerHTML = `<img src="${currentTransferItem.image}" alt="${currentTransferItem.name || 'Подарок'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
        } else {
            itemImage.innerHTML = currentTransferItem.image || '🎁';
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }).catch(error => {
        console.error('Error loading inventory for transfer:', error);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Ошибка загрузки инвентаря',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    });
}

function closeTransferModal() {
    const modal = document.getElementById('transferModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentTransferItem = null;
}

async function confirmTransfer() {
    if (!currentTransferItem || !currentUser) {
        console.log('Нет данных для передачи');
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Нет данных для передачи',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    const userId = parseInt(document.getElementById('transferUserId').value.trim());
    const comment = document.getElementById('transferComment').value.trim();

    if (!userId || isNaN(userId)) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите корректный ID пользователя',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    // Check if trying to send to self
    if (userId === currentUser.id) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Нельзя передать подарок самому себе',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    // Disable transfer button to prevent double-clicking
    const transferBtn = document.querySelector('.transfer-send-btn');
    if (!transferBtn) {
        console.error('Transfer button not found');
        return;
    }

    const originalText = transferBtn.textContent;
    transferBtn.disabled = true;
    transferBtn.textContent = 'Передача...';

    try {
        // Validate item data before sending
        if (!currentTransferItem.id || !currentTransferItem.name) {
            throw new Error('Неполные данные предмета');
        }

        console.log('Transferring item:', currentTransferItem);

        const transferData = {
            itemId: currentTransferItem.id,
            fromUserId: currentUser.id,
            fromUsername: currentUser.username || currentUser.first_name || 'user',
            toUserId: userId,
            comment: comment,
            item: {
                ...currentTransferItem,
                // Ensure we have all necessary data
                inventoryId: currentTransferItem.inventoryId,
                id: currentTransferItem.id,
                name: currentTransferItem.name,
                image: currentTransferItem.image,
                price: currentTransferItem.price,
                quantity: currentTransferItem.quantity
            }
        };

        console.log('Sending transfer request:', transferData);

        const response = await fetch('/api/transfer-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transferData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('Transfer response:', result);

        if (result.success) {
            closeTransferModal();

            // Перезагружаем инвентарь чтобы отобразить изменения
            await loadInventory();

            console.log(`Передача успешна: "${currentTransferItem.name}" отправлен пользователю с ID ${userId}`);

            // Показываем успешное сообщение с информацией о доставке
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Подарок передан! 🎉',
                    message: `Подарок "${currentTransferItem.name}" успешно передан пользователю с ID ${userId}!\n\nПолучатель получит уведомление в боте.`,
                    buttons: [{ type: 'ok', text: 'Отлично!' }]
                });
            } else {
                alert(`Подарок "${currentTransferItem.name}" успешно передан пользователю с ID ${userId}!\n\nПолучатель получит уведомление в боте.`);
            }

            // Очищаем данные текущей передачи
            currentTransferItem = null;
            return;
        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка при передаче предмета:', error);

        let errorMessage = 'Произошла ошибка при передаче подарка. Попробуйте еще раз.';

        // Обрабатываем различные типы ошибок
        if (error.message.includes('HTTP 404') || error.message.includes('не найден в боте')) {
            errorMessage = `Пользователь с ID ${userId} не найден в боте.\n\nПолучатель должен:\n• Зайти в бот хотя бы один раз\n• Или быть в списке активных пользователей`;
        } else if (error.message.includes('HTTP')) {
            errorMessage = 'Ошибка соединения с сервером. Проверьте интернет-соединение.';
        } else if (error.message) {
            // Используем сообщение об ошибке с сервера
            errorMessage = error.message;
        }

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка передачи',
                message: errorMessage,
                buttons: [{ type: 'ok', text: 'Понятно' }]
            });
        } else {
            alert(`Ошибка: ${errorMessage}`);
        }
    } finally {
        // Re-enable transfer button
        if (transferBtn) {
            transferBtn.disabled = false;
            transferBtn.textContent = originalText;
        }
    }
}

// Navigation functionality
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        // Remove active class from all items
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        // Add active class to clicked item
        this.classList.add('active');

        const section = this.querySelector('.nav-text').textContent;

        // Show/hide sections based on navigation
        if (section === 'Маркет') {
            marketSection.style.display = 'block';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
        } else if (section === 'Активность') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'block';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            loadActivity().then(() => {
                renderActivity();
            });
        } else if (section === 'Инвентарь') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'block';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            renderInventory();
        } else if (section === 'Профиль') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'block';
            // Перезагружаем статистику при открытии профиля
            if (currentUser) {
                loadUserStats(currentUser.id).then(() => {
                    updateStatsDisplay();
                });
            } else {
                updateStatsDisplay();
            }
        } else if (section === 'Админ') {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            document.getElementById('adminSection').style.display = 'block';
            renderAdminItems();
        } else {
            marketSection.style.display = 'none';
            activitySection.style.display = 'none';
            inventorySection.style.display = 'none';
            document.getElementById('adminSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            console.log(`Переход в раздел: ${section}`);
        }
    });
});

// Channel subscription functions
function showChannelSubscriptionModal() {
    // Check if user has already seen the modal (localStorage)
    const hasSeenChannelModal = localStorage.getItem('hasSeenChannelModal');

    if (!hasSeenChannelModal) {
        setTimeout(() => {
            const modal = document.getElementById('channelSubscriptionModal');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }, 2000); // Show after 2 seconds
    }
}

function closeChannelModal() {
    const modal = document.getElementById('channelSubscriptionModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Mark as seen so it won't show again
    localStorage.setItem('hasSeenChannelModal', 'true');
}

function subscribeToChannel() {
    const channelUrl = 'https://t.me/MetaGift_News';

    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(channelUrl);
    } else {
        window.open(channelUrl, '_blank');
    }

    // Close modal and mark as seen
    closeChannelModal();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing app...');

    // Initialize Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        // Set theme
        tg.setHeaderColor('#1a202c');
        tg.setBottomBarColor('#ffffff');

        // Get user data
        const user = tg.initDataUnsafe?.user;
        if (user) {
            currentUser = user;
            setUserProfileInfo(user);
        } else {
            console.log('No valid user data found in Telegram WebApp');
        }
    } else {
        console.log('Telegram WebApp not available, using fallback');
    }

    // Use fallback user for testing if no user found
    if (!currentUser) {
        currentUser = {
            id: 7867539237,
            username: 'test_user',
            first_name: 'Test',
            last_name: 'User',
            photo_url: null
        };
        setUserProfileInfo(currentUser);
        console.log('Using fallback user for testing:', currentUser);
    }

    // Сначала загружаем баланс, затем остальные данные
    console.log('Loading user balance first...');
    await loadUserBalance();

    // Load other data
    await Promise.all([
        loadNFTs(),
        loadUserStats(),
        loadUserInventory()
    ]);

    // Set up event listeners
    setupEventListeners();

    // Check fullscreen support
    checkFullscreenSupport();

    // Auto-refresh data
    autoRefresh();
});

// Current top up amount
let currentTopUpAmount = 0;

// Top Up Stars Modal Functions
function openTopUpModal() {
    const modal = document.getElementById('topUpModal');
    document.getElementById('topUpAmount').value = '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTopUpModal() {
    const modal = document.getElementById('topUpModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    // Don't reset currentTopUpAmount here, it's needed for payment modal
}

function proceedToTopUpPayment() {
    const amountInput = document.getElementById('topUpAmount');
    const amount = parseInt(amountInput.value);

    console.log('Input value:', amountInput.value, 'Parsed amount:', amount);

    if (!amount || amount < 1) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Введите корректное количество Stars (минимум 1)',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        return;
    }

    currentTopUpAmount = amount;
    console.log('Set currentTopUpAmount to:', currentTopUpAmount);

    // Close top up modal and open payment modal
    closeTopUpModal();
    openTopUpPaymentModal();
}

function openTopUpPaymentModal() {
    const modal = document.getElementById('topUpPaymentModal');
    const priceElement = document.getElementById('topUpPaymentPrice');
    const starsAmountElement = document.getElementById('topUpStarsAmount');

    // Set payment info - make sure currentTopUpAmount is used correctly
    console.log('Current top up amount:', currentTopUpAmount);
    priceElement.innerHTML = `${currentTopUpAmount} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 16px; height: 16px; margin-left: 4px;" alt="Stars">`;
    starsAmountElement.textContent = currentTopUpAmount;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTopUpPaymentModal() {
    const modal = document.getElementById('topUpPaymentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentTopUpAmount = 0; // Reset only when payment modal is closed
}

async function confirmTopUpPayment() {
    if (!currentUser || !currentTopUpAmount) {
        console.log('Нет данных для подтверждения пополнения');
        return;
    }

    try {
        const response = await fetch('/api/topup-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                username: currentUser.username || currentUser.first_name || 'user',
                amount: currentTopUpAmount,
                type: 'stars_topup'
            })
        });

        if (response.ok) {
            closeTopUpPaymentModal();

            let successMessage = `Ваша заявка на пополнение отправлена в модерацию. Ожидайте подтверждения от 1 минуты.`;

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Заявка отправлена',
                    message: successMessage,
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }

            currentTopUpAmount = 0;
        } else {
            console.log('Ошибка при отправке заявки на пополнение');
        }
    } catch (error) {
        console.error('Error submitting top up request:', error);
    }
}

// Purchase modal functionality
function openPurchaseModal(item) {
    const modal = document.getElementById('purchaseModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalId = document.getElementById('modalId');
    const modalPrice = document.getElementById('modalPrice');
    const modalBuyBtn = document.getElementById('modalBuyBtn');

    // Set modal content
    modalTitle.textContent = item.name;

    // Добавляем описание товара под заголовком
    let descriptionHtml = '';
    if (item.description && item.description.trim()) {
        descriptionHtml = `<div class="modal-description" style="color: #888; font-size: 14px; margin-top: 8px; line-height: 1.4;">${item.description}</div>`;
    }
    modalTitle.innerHTML = `${item.name}${descriptionHtml}`;

    // Отображаем ID товара в модальном окне покупки
    const modalIdElement = document.getElementById('modalId');
    if (modalIdElement) {
        modalIdElement.textContent = `#${item.id}`;
        modalIdElement.style.display = 'block';
    }

    // Показываем все доступные цены
    let pricesDisplay = '';
    if (item.prices) {
        const prices = [];
        if (item.prices.TON > 0) prices.push(`<img src="https://ton.org/download/ton_symbol.png" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;" alt="TON">${item.prices.TON}`);
        if (item.prices.STARS > 0) prices.push(`${item.prices.STARS} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" alt="Stars">`);
        if (item.prices.RUB > 0) prices.push(`<img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;" alt="RUB">${item.prices.RUB}`);
        pricesDisplay = prices.join(' | ');
    } else {
        // Для совместимости со старым форматом
        const starsPrice = Math.ceil(item.price * 100);
        pricesDisplay = `${starsPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" alt="Stars">`;
    }
    modalPrice.innerHTML = pricesDisplay;

    // Set image
    if (item.image.startsWith('http')) {
        modalImage.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="modal-quantity">${item.quantity}</div>
        `;
    } else {
        modalImage.innerHTML = `
            ${item.image}
            <div class="modal-quantity">${item.quantity}</div>
        `;
    }

    // Set buy button action
    modalBuyBtn.onclick = () => {
        buyItem(item.id);
        closePurchaseModal();
    };

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePurchaseModal() {
    const modal = document.getElementById('purchaseModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Fullscreen toggle functionality
function toggleFullscreen() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        try {
            if (tg.isFullscreen && tg.exitFullscreen) {
                tg.exitFullscreen();
            } else if (tg.requestFullscreen) {
                tg.requestFullscreen();
            }
        } catch (error) {
            console.log('Fullscreen not supported or error:', error);
        }
    }
}

// Profile Section Functions
// Referral functions
function openInviteModal() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        const user = tg.initDataUnsafe?.user;
        if (user) {
            // Generate referral link with current user ID
            const baseUrl = 'https://t.me/MetaGiftRobot/OpenApp';
            const referralLink = `${baseUrl}?startapp=${user.id}`;

            // Update referral link inputs
            const referralLinkInput = document.getElementById('referralLinkInput');
            const inviteModalLink = document.getElementById('inviteModalLink');

            if (referralLinkInput) {
                referralLinkInput.value = referralLink;
            }

            if (inviteModalLink) {
                inviteModalLink.value = referralLink;
            }

            tg.showPopup({
                title: '🎁 Пригласить друга',
                message: `🎁 Присоединяйся к MetaGift!\n\nПокупай и дари уникальные подарки в Telegram!\n💰 Получай 25% с каждой покупки рефералов!\n\n${referralLink}`,
                buttons: [
                    {type: 'default', text: 'Поделиться', id: 'share'},
                    {type: 'cancel', text: 'Отмена'}
                ]
            }, (buttonId) => {
                if (buttonId === 'share') {
                    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🎁 Присоединяйся к MetaGift Market! Получай 25% с каждой покупки!')}`;
                    window.open(shareUrl, '_blank');
                }
            });
        }
    }
}

function copyReferralLink() {
    const referralLinkInput = document.getElementById('referralLinkInput');
    if (referralLinkInput && referralLinkInput.value) {
        navigator.clipboard.writeText(referralLinkInput.value).then(() => {
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Ссылка скопирована!',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            } else {
                alert('Ссылка скопирована!');
            }
        }).catch(err => {
            console.error('Error copying to clipboard:', err);
        });
    }
}

// Function to copy user ID to clipboard
function copyUserId() {
    if (currentUser && currentUser.id) {
        navigator.clipboard.writeText(currentUser.id.toString()).then(() => {
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'ID скопирован',
                    message: `Ваш ID ${currentUser.id} скопирован в буфер обмена.`,
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            } else {
                alert(`Ваш ID ${currentUser.id} скопирован в буфер обмена.`);
            }
        }).catch(err => {
            console.error('Error copying user ID:', err);
        });
    }
}

function setUserProfileInfo(user) {
    const profileUsername = document.getElementById('profileUsername');
    const userAvatar = document.getElementById('userAvatar');
    const headerUsername = document.getElementById('headerUsername');
    const headerUserAvatar = document.getElementById('headerUserAvatar');
    const referralLinkInput = document.getElementById('referralLinkInput');
    const inviteModalLink = document.getElementById('inviteModalLink');
    const profileUserId = document.getElementById('profileUserId'); // Element to display user ID

    if (user) {
        const username = `@${user.username || user.first_name || 'user'}`;

        // Set profile section
        if (profileUsername) {
            profileUsername.textContent = username;
        }

        // Set header user info
        if (headerUsername) {
            headerUsername.textContent = username;
        }

        // Set user avatar if available
        if (user.photo_url) {
            if (userAvatar) {
                userAvatar.src = user.photo_url;
            }
            if (headerUserAvatar) {
                headerUserAvatar.src = user.photo_url;
            }
        }

        // Display User ID in profile
        if (profileUserId) {
            profileUserId.innerHTML = `
                <span id="userIdText">ID: ${user.id}</span>
                <div class="copy-icon">📋</div>
            `;
        }

        // Generate referral link with current user ID
        const baseUrl = 'https://t.me/MetaGiftRobot/OpenApp';
        const referralLink = `${baseUrl}?startapp=${user.id}`;

        // Update referral link inputs
        if (referralLinkInput) {
            referralLinkInput.value = referralLink;
        }

        if (inviteModalLink) {
            inviteModalLink.value = referralLink;
        }

        // Load user stats and balance
        loadUserStats(user.id);
        loadUserBalance(user.id);
    }
}

async function loadUserStats(userId) {
    try {
        const response = await fetch(`/api/user-stats/${userId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        userStats = await response.json();
        updateStatsDisplay();
    } catch (error) {
        console.error('Error loading user stats:', error);
        userStats = { totalPurchases: 0, totalSpent: 0, referralCount: 0, referralEarnings: 0 };
        updateStatsDisplay();
    }
}

async function updateUserUsername(userId, newUsername) {
    if (!userId || !newUsername) return;

    try {
        // Get current username from localStorage or previous data
        const storedUsername = localStorage.getItem(`username_${userId}`);

        // Only update if username has changed
        if (storedUsername && storedUsername !== newUsername) {
            const response = await fetch('/api/update-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    oldUsername: storedUsername,
                    newUsername: newUsername
                })
            });

            if (response.ok) {
                console.log(`Username updated from ${storedUsername} to ${newUsername}`);
            }
        }

        // Store current username
        localStorage.setItem(`username_${userId}`, newUsername);

    } catch (error) {
        console.error('Error updating username:', error);
    }
}

function updateStatsDisplay() {
    const totalPurchasesEl = document.getElementById('totalPurchases');
    const totalSpentEl = document.getElementById('totalSpent');
    const referralCountEl = document.getElementById('referralCount');
    const referralEarningsEl = document.getElementById('referralEarnings');

    if (totalPurchasesEl) {
        totalPurchasesEl.textContent = userStats.totalPurchases || 0;
    }

    if (totalSpentEl) {
        // Конвертируем в Stars если цена была в TON
        let totalSpentInStars = 0;
        if (userStats.totalSpent) {
            // Если значение больше 50, то скорее всего это уже Stars, иначе конвертируем из TON
            totalSpentInStars = userStats.totalSpent > 50 ? userStats.totalSpent : Math.ceil(userStats.totalSpent * 100);
        }
        totalSpentEl.innerHTML = `${totalSpentInStars} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px;" alt="Stars">`;
    }

    if (referralCountEl) {
        referralCountEl.textContent = userStats.referralCount || 0;
    }

    if (referralEarningsEl) {
        const earnings = userStats.referralEarnings || 0;
        referralEarningsEl.innerHTML = `${earnings} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px;" alt="Stars">`;
    }
}

// Invite modal functions
function openInviteModal() {
    const modal = document.getElementById('inviteModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeInviteModal() {
    const modal = document.getElementById('inviteModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function copyInviteLink() {
    const referralLinkInput = document.getElementById('inviteModalLink');
    const linkText = referralLinkInput.value;

    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkText).then(() => {
            console.log('Ссылка скопирована в буфер обмена');

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Ссылка скопирована в буфер обмена',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }).catch(() => {
            fallbackCopy(inviteModalLink);
        });
    } else {
        // Fallback to old method
        fallbackCopy(inviteModalLink);
    }
}

function fallbackCopy(input) {
    try {
        input.select();
        input.setSelectionRange(0, 99999);
        document.execCommand('copy');
        console.log('Ссылка скопирована в буфер обмена');

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Успешно',
                message: 'Ссылка скопирована в буфер обмена',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    } catch (error) {
        console.log('Не удалось скопировать ссылку');
    }
}

function shareToTelegram() {
    const referralLink = document.getElementById('inviteModalLink').value;
    const message = `🎁 Присоединяйся к MetaGift Market! Получай 25% с каждой покупки!\n\n${referralLink}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🎁 Присоединяйся к MetaGift Market! Получай 25% с каждой покупки!')}`;
    window.open(telegramUrl, '_blank');
}

function openChannel() {
    const channelUrl = 'https://t.me/MetaGift_news';

    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(channelUrl);
    } else {
        window.open(channelUrl, '_blank');
    }
}

function openChat() {
    const chatUrl = 'https://t.me/MetaGift_Chat';

    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(chatUrl);
    } else {
        window.open(chatUrl, '_blank');
    }
}

function upgradeToNFT() {
    if (!currentInventoryItem) {
        console.error('Нет предмета для улучшения');
        return;
    }

    // Проверяем, что это печатная машина
    if (!currentInventoryItem.name || !currentInventoryItem.name.toLowerCase().includes('печатная машина')) {
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Недоступно',
                message: 'Улучшение в NFT доступно только для Печатной машины.',
                buttons: [{ type: 'ok', text: 'Понятно' }]
            });
        }
        return;
    }

    // Открываем модальное окно подтверждения
    openUpgradeConfirmModal();
}

function openUpgradeConfirmModal() {
    const modal = document.getElementById('upgradeConfirmModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeUpgradeConfirmModal() {
    const modal = document.getElementById('upgradeConfirmModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

async function confirmUpgrade() {
    const requiredStars = 25;

    // Проверяем баланс пользователя
    const currentStars = typeof userBalance === 'object' ? (userBalance.stars || 0) : (userBalance || 0);
    if (currentStars < requiredStars) {
        closeUpgradeConfirmModal();

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Недостаточно Stars',
                message: `Для улучшения нужно ${requiredStars} Stars. У вас ${currentStars} Stars. Пополните баланс.`,
                buttons: [{ type: 'ok', text: 'Пополнить' }]
            }, () => {
                openTopUpModal();
            });
        }
        return;
    }

    // Проверяем, что currentInventoryItem существует
    if (!currentInventoryItem || !currentInventoryItem.inventoryId) {
        console.error('currentInventoryItem не найден:', currentInventoryItem);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Предмет для улучшения не найден. Попробуйте закрыть и открыть предмет снова.',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
        closeUpgradeConfirmModal();
        return;
    }

    try {
        console.log('Sending upgrade request for inventoryId:', currentInventoryItem.inventoryId);

        // Списываем звезды с баланса
        const response = await fetch('/api/upgrade-to-nft', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                inventoryId: currentInventoryItem.inventoryId,
                requiredStars: requiredStars
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Upgrade successful:', result);

            // Обновляем баланс
            userBalance = { stars: result.newBalance || 0 };
            updateBalanceDisplay();

            // Закрываем модальное окно подтверждения
            closeUpgradeConfirmModal();

            // Открываем рулетку
            openRouletteModal();
        } else {
            const error = await response.json();
            console.error('Upgrade failed:', error);
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка',
                    message: error.error || 'Не удалось выполнить улучшение',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }
    } catch (error) {
        console.error('Error upgrading to NFT:', error);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Произошла ошибка при улучшении. Попробуйте позже.',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    }
}

// Рулетка
const nftVariants = []; // Initialize as empty, will be populated from server

// Function to load NFT variants from server
async function loadNFTVariants() {
    try {
        const response = await fetch('/api/nft-variants');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const variants = await response.json();
        nftVariants.length = 0; // Clear existing variants
        nftVariants.push(...variants); // Populate with new variants
        renderNFTVariantsList();
    } catch (error) {
        console.error('Error loading NFT variants:', error);
        nftVariants = [];
        renderNFTVariantsList();
    }
}

// Function to save NFT variants to server
async function saveNFTVariants() {
    try {
        const response = await fetch('/api/nft-variants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(nftVariants)
        });

        if (!response.ok) {
            console.error('Failed to save NFT variants');
        }
    } catch (error) {
        console.error('Error saving NFT variants:', error);
    }
}

function openRouletteModal() {
    const modal = document.getElementById('rouletteModal');
    const rouletteWheel = document.getElementById('rouletteWheel');

    // Проверяем, что NFT варианты загружены
    if (nftVariants.length === 0) {
        console.log('NFT варианты не загружены, загружаем...');
        loadNFTVariants().then(() => {
            if (nftVariants.length === 0) {
                if (window.Telegram?.WebApp?.showPopup) {
                    window.Telegram.WebApp.showPopup({
                        title: 'Ошибка',
                        message: 'NFT варианты не настроены. Обратитесь к администратору.',
                        buttons: [{ type: 'ok', text: 'OK' }]
                    });
                }
                return;
            }
            openRouletteModalInternal();
        });
        return;
    }

    openRouletteModalInternal();
}

function openRouletteModalInternal() {
    const modal = document.getElementById('rouletteModal');
    const rouletteWheel = document.getElementById('rouletteWheel');

    // Создаем элементы рулетки
    rouletteWheel.innerHTML = '';

    // Добавляем больше элементов для эффекта прокрутки
    const totalItems = 20;
    for (let i = 0; i < totalItems; i++) {
        const item = document.createElement('div');
        item.className = 'roulette-item';

        // Заполняем случайными вариантами из доступных
        const randomVariant = nftVariants[Math.floor(Math.random() * nftVariants.length)];
        item.innerHTML = `
            <img src="${randomVariant.url}" alt="${randomVariant.model}">
            <div class="roulette-item-info">
                <div class="roulette-model">${randomVariant.model}</div>
                <div class="roulette-background">${randomVariant.background}</div>
            </div>
        `;

        rouletteWheel.appendChild(item);
    }

    // Показываем модальное окно
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Автоматически запускаем рулетку через небольшую задержку
    setTimeout(() => {
        startRoulette();
    }, 1000);
}


function startRoulette() {
    const rouletteWheel = document.getElementById('rouletteWheel');
    const rouletteStatus = document.querySelector('.roulette-status');

    if (rouletteStatus) {
        rouletteStatus.textContent = 'Подбираем улучшение...';
    }

    // Выбираем случайный результат
    const winningVariant = nftVariants[Math.floor(Math.random() * nftVariants.length)];

    // Вычисляем позицию для остановки
    const itemWidth = 200; // ширина одного элемента
    const totalItems = rouletteWheel.children.length;
    const winningIndex = Math.floor(totalItems / 2); // позиция в центре
    const centerPosition = window.innerWidth / 2 - itemWidth / 2;
    const stopPosition = -(winningIndex * itemWidth - centerPosition);

    // Добавляем дополнительные обороты для эффекта
    const extraSpins = 3000; // 3000px дополнительного прокручивания
    const finalPosition = stopPosition - extraSpins;

    // Устанавливаем выигрышный вариант в центральный элемент
    const centerItem = rouletteWheel.children[winningIndex];
    centerItem.innerHTML = `
        <img src="${winningVariant.url}" alt="${winningVariant.model}">
        <div class="roulette-item-info">
            <div class="roulette-model">${winningVariant.model}</div>
            <div class="roulette-background">${winningVariant.background}</div>
        </div>
    `;

    // Запускаем анимацию
    rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.23, 1, 0.32, 1)';
    rouletteWheel.style.transform = `translateX(${finalPosition}px)`;

    // После окончания анимации показываем результат
    setTimeout(() => {
        showRouletteResult(winningVariant);
    }, 4500);
}

async function showRouletteResult(winningVariant) {
    // Закрываем модальное окно рулетки
    closeRouletteModal();

    try {
        // Обновляем предмет в инвентаре
        const response = await fetch('/api/update-nft-variant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                inventoryId: currentInventoryItem.inventoryId,
                variant: winningVariant
            })
        });

        if (response.ok) {
            // Перезагружаем инвентарь
            await loadInventory();

            // Закрываем модальное окно инвентаря
            closeInventoryModal();

            // Показываем результат
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Поздравляем! 🎉',
                    message: `Ваша Печатная машина улучшена в NFT!\n\nМодель: ${winningVariant.model}\nФон: ${winningVariant.background}\n\nТеперь ваш подарок уникален!`,
                    buttons: [{ type: 'ok', text: 'Отлично!' }]
                });
            }
        } else {
            console.error('Failed to update NFT variant');
        }
    } catch (error) {
        console.error('Error updating NFT variant:', error);
    }
}

function closeRouletteModal() {
    const modal = document.getElementById('rouletteModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Сбрасываем позицию рулетки
    const rouletteWheel = document.getElementById('rouletteWheel');
    rouletteWheel.style.transition = 'none';
    rouletteWheel.style.transform = 'translateX(0)';
}

// Payment Methods Modal Functions
async function openPaymentMethodsModal(item) {
    try {
        const response = await fetch(`/api/payment-methods/${item.id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentPaymentMethods = data.paymentMethods;

        // Add balance payment method if user has enough stars
        let starsPrice = 0;
        if (item.prices && item.prices.STARS > 0) {
            starsPrice = item.prices.STARS;
        } else if (item.price) {
            starsPrice = Math.ceil(item.price * 100);
        }

        const currentStars = typeof userBalance === 'object' ? (userBalance.stars || 0) : (userBalance || 0);
        console.log('User balance:', currentStars, 'Required stars:', starsPrice);

        if (currentStars >= starsPrice && starsPrice > 0) {
            currentPaymentMethods.unshift({
                id: 'BALANCE',
                name: 'Оплата с баланса',
                icon: 'https://i.postimg.cc/3N3f5zhH/IMG-1243.png',
                price: starsPrice,
                description: `У вас: ${currentStars} Stars`
            });
        }

        const modal = document.getElementById('paymentMethodsModal');

        // Set item info in payment methods modal
        const itemImageElement = document.getElementById('paymentMethodsItemImage');
        const itemNameElement = document.getElementById('paymentMethodsItemName');

        if (itemImageElement && itemNameElement) {
            // Set item image
            if (item.image && item.image.startsWith('http')) {
                itemImageElement.innerHTML = `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
            } else {
                itemImageElement.innerHTML = item.image || '📦';
            }

            // Set item name
            itemNameElement.textContent = item.name;
        }

        // Get methods list element
        const methodsList = document.getElementById('paymentMethodsList') ||
                           document.querySelector('.payment-methods-list') ||
                           document.querySelector('#paymentMethodsModal .payment-methods');

        if (!methodsList) {
            console.error('Payment methods list element not found');
            return;
        }

        // Render payment methods
        methodsList.innerHTML = '';
        currentPaymentMethods.forEach(method => {
            // Add icon for TON Wallet
            if (method.id === 'TON') {
                method.icon = 'https://ton.org/download/ton_symbol.png';
            }
            const methodElement = createPaymentMethodElement(method);
            methodsList.appendChild(methodElement);
        });

        // Close purchase modal and show payment methods modal
        closePurchaseModal();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Error loading payment methods:', error);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: 'Не удалось загрузить способы оплаты',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    }
}

function createPaymentMethodElement(method) {
    const div = document.createElement('div');
    div.className = 'payment-method-item';
    div.onclick = () => selectPaymentMethod(method);

    let priceText = '';
    let currencySymbol = '';

    switch (method.id) {
        case 'STARS':
            priceText = `${method.price} `;
            currencySymbol = '';
            break;
        case 'YOOMONEY':
            priceText = `${method.price} ₽`;
            currencySymbol = '₽';
            break;
        case 'TON':
            priceText = `${method.price} TON`;
            currencySymbol = 'TON';
            break;
        case 'BALANCE': // Handle new balance payment method
            priceText = `${method.price} `;
            currencySymbol = '';
            break;
    }

    div.innerHTML = `
        <div class="payment-method-icon">
            <img src="${method.icon}" alt="${method.name}">
        </div>
        <div class="payment-method-info">
            <div class="payment-method-name">${method.name}</div>
            <div class="payment-method-price">${priceText}</div>
            ${method.description ? `<div class="payment-method-description">${method.description}</div>` : ''}
        </div>
        <div class="payment-method-arrow">→</div>
    `;

    return div;
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    closePaymentMethodsModal();

    // Handle different payment methods
    if (method.id === 'BALANCE') {
        confirmBalancePayment();
    } else {
        openPaymentModal(currentPurchaseItem, method);
    }
}

function closePaymentMethodsModal() {
    const modal = document.getElementById('paymentMethodsModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Payment Modal Functions
function openPaymentModal(item, paymentMethod) {
    const modal = document.getElementById('paymentModal');
    const itemImage = document.getElementById('paymentItemImage');
    const itemName = document.getElementById('paymentItemName');
    const itemPrice = document.getElementById('paymentItemPrice');
    const paymentInstructions = document.getElementById('paymentInstructions');

    // Set item info
    itemName.textContent = item.name;

    // Set price based on payment method
    let priceText = '';
    let methodIcon = '';

    switch (paymentMethod.id) {
        case 'STARS':
            priceText = `${paymentMethod.price} `;
            methodIcon = `<img src="${paymentMethod.icon}" style="width: 16px; height: 16px; margin-right: 4px;" alt="Stars">`;
            break;
        case 'YOOMONEY':
            priceText = `${paymentMethod.price} ₽`;
            methodIcon = `<img src="${paymentMethod.icon}" style="width: 16px; height: 16px; margin-right: 4px;" alt="ЮMoney">`;
            break;
        case 'TON':
            methodIcon = `<div class="ton-icon" style="width: 16px; height: 16px; display: inline-block; margin-right: 4px;"></div>`;
            priceText = `${paymentMethod.price} TON`;
            break;
    }

    itemPrice.innerHTML = `${methodIcon}${priceText}`;

    // Set image
    if (item.image && item.image.startsWith('http')) {
        itemImage.innerHTML = `<img src="${item.image}" alt="${item.name}">`;
    } else {
        itemImage.innerHTML = item.image || '📦';
    }

    // Update payment instructions based on method
    updatePaymentInstructions(paymentMethod);

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function updatePaymentInstructions(paymentMethod) {
    const paymentInstructions = document.getElementById('paymentInstructions');

    let instructionsHTML = '';

    switch (paymentMethod.id) {
        case 'STARS':
            instructionsHTML = `
                <div class="payment-step">
                    <div class="step-number">1</div>
                    <div class="step-text">Отправьте ${paymentMethod.price} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px; vertical-align: middle;" alt="Stars"> Telegram Stars менеджеру обычным подарком:</div>
                </div>
                <div class="payment-contact">
                    <div class="contact-label">Менеджер поддержки:</div>
                    <div class="contact-info">
                        <span>${paymentMethod.contact}</span>
                        <button class="contact-btn" onclick="openTelegramContact('${paymentMethod.contact}')">Написать</button>
                    </div>
                </div>
                <div class="payment-step">
                    <div class="step-number">2</div>
                    <div class="step-text">После отправки звезд обычным подарком нажмите кнопку "Я оплатил"</div>
                </div>
            `;
            break;

        case 'YOOMONEY':
            instructionsHTML = `
                <div class="payment-step">
                    <div class="step-number">1</div>
                    <div class="step-text">Переведите ${paymentMethod.price} ₽ на кошелек ЮMoney:</div>
                </div>
                <div class="payment-wallet">
                    <div class="wallet-label">Номер кошелька ЮMoney:</div>
                    <div class="wallet-address">
                        <span id="yoomoneyWallet">${paymentMethod.wallet}</span>
                        <button class="copy-wallet-btn" onclick="copyYoomoneyWallet()">Копировать</button>
                    </div>
                </div>
                <div class="payment-step">
                    <div class="step-number">2</div>
                    <div class="step-text">После перевода нажмите кнопку "Оплачено"</div>
                </div>
            `;
            break;

        case 'TON':
            instructionsHTML = `
                <div class="payment-step">
                    <div class="step-number">1</div>
                    <div class="step-text">Переведите ${paymentMethod.price} TON на кошелек:</div>
                </div>
                <div class="payment-wallet">
                    <div class="wallet-label">TON кошелек:</div>
                    <div class="wallet-address">
                        <span id="walletAddressText">${paymentMethod.wallet}</span>
                        <button class="copy-wallet-btn" onclick="copyWalletAddress()">Копировать</button>
                    </div>
                </div>
                <div class="payment-step">
                    <div class="step-number">2</div>
                    <div class="step-text">После перевода нажмите кнопку "Оплачено"</div>
                </div>
            `;
            break;
    }

    paymentInstructions.innerHTML = instructionsHTML;
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentPurchaseItem = null;
}

function copyWalletAddress() {
    const walletText = document.getElementById('walletAddressText').textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(walletText).then(() => {
            console.log('Адрес кошелька скопирован');

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Адрес кошелька скопирован в буфер обмена',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }).catch(() => {
            fallbackCopyWallet();
        });
    } else {
        fallbackCopyWallet();
    }
}

function fallbackCopyWallet() {
    try {
        const walletElement = document.getElementById('walletAddressText');
        const walletText = walletElement ? walletElement.textContent : MERCHANT_WALLET;

        const textArea = document.createElement('textarea');
        textArea.value = walletText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        console.log('Адрес кошелька скопирован');

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Успешно',
                message: 'Адрес кошелька скопирован в буфер обмена',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    } catch (error) {
        console.log('Не удалось скопировать адрес кошелька');
    }
}

function copyYoomoneyWallet() {
    const walletText = document.getElementById('yoomoneyWallet').textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(walletText).then(() => {
            console.log('Номер кошелька ЮMoney скопирован');

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Номер кошелька ЮMoney скопирован в буфер обмена',
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        }).catch(() => {
            fallbackCopyYoomoney();
        });
    } else {
        fallbackCopyYoomoney();
    }
}

function fallbackCopyYoomoney() {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = document.getElementById('yoomoneyWallet').textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        console.log('Номер кошелька ЮMoney скопирован');

        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Успешно',
                message: 'Номер кошелька ЮMoney скопирован в буфер обмена',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    } catch (error) {
        console.log('Не удалось скопировать номер кошелька ЮMoney');
    }
}

function openTelegramContact(username) {
    const telegramUrl = `https://t.me/${username.replace('@', '')}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(telegramUrl);
    } else {
        window.open(telegramUrl, '_blank');
    }
}

async function confirmPayment() {
    if (!currentPurchaseItem || !currentUser || !selectedPaymentMethod) {
        console.log('Нет данных для подтверждения оплаты');
        return;
    }

    try {
        const response = await fetch('/api/payment-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemId: currentPurchaseItem.id,
                userId: currentUser.id,
                username: currentUser.username || currentUser.first_name || 'user',
                price: currentPurchaseItem.price,
                convertedPrice: selectedPaymentMethod.price,
                paymentMethod: selectedPaymentMethod.id,
                itemName: currentPurchaseItem.name,
                itemImage: currentPurchaseItem.image,
                referrerId: getReferrerId()
            })
        });

        if (response.ok) {
            closePaymentModal();

            let methodName = selectedPaymentMethod.name;
            let successMessage = `Ваша заявка на оплату через ${methodName} отправлена kepada администратору. Ожидайте подтверждения.`;

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Заявка отправлена',
                    message: successMessage,
                    buttons: [{ type: 'ok', text: 'OK' }]
                });
            }
        } else {
            console.log('Ошибка при отправке заявки на оплату');
        }
    } catch (error) {
        console.error('Error submitting payment request:', error);
    }
}

async function confirmBalancePayment() {
    if (!currentPurchaseItem || !currentUser || !selectedPaymentMethod) {
        console.log('Нет данных для подтверждения оплаты с баланса');
        return;
    }

    try {
        const response = await fetch('/api/purchase-with-balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemId: currentPurchaseItem.id,
                userId: currentUser.id,
                username: currentUser.username || currentUser.first_name || 'user',
                starsPrice: selectedPaymentMethod.price, // Price in stars
                referrerId: getReferrerId()
            })
        });

        if (response.ok) {
            const result = await response.json();
            closePaymentMethodsModal();

            // Update user balance from server response
            userBalance = { stars: result.newBalance || 0 };
            updateBalanceDisplay();

            // Reload user balance from server to ensure sync
            await loadUserBalance(currentUser.id);

            // Update inventory and other relevant data
            await loadInventory();
            await loadUserStats(currentUser.id); // Update stats if necessary

            let successMessage = `Поздравляем! Вы успешно приобрели "${currentPurchaseItem.name}" за ${selectedPaymentMethod.price} Stars.`;

            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Покупка успешна!',
                    message: successMessage,
                    buttons: [{ type: 'ok', text: 'Отлично!' }]
                });
            }
        } else {
            const error = await response.json();
            console.error('Error confirming balance payment:', error.error || 'Неизвестная ошибка');
            if (window.Telegram?.WebApp?.showPopup) {
                window.Telegram.WebApp.showPopup({
                    title: 'Ошибка оплаты',
                    message: error.error || 'Не удалось завершить покупку с баланса. Попробуйте еще раз.',
                    buttons: [{ type: 'ok', text: 'Понятно' }]
                });
            }
        }
    } catch (error) {
        console.error('Error confirming balance payment:', error);
        if (window.Telegram?.WebApp?.showPopup) {
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка оплаты',
                message: 'Произошла ошибка при попытке оплаты с баланса. Попробуйте еще раз.',
                buttons: [{ type: 'ok', text: 'OK' }]
            });
        }
    }
}


// Admin Panel Functions
function showAdminTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Show/hide content
    if (tab === 'items') {
        document.getElementById('adminItems').style.display = 'block';
        document.getElementById('adminPayments').style.display = 'none';
        document.getElementById('adminVariants').style.display = 'none';
        document.getElementById('adminGifts').style.display = 'none'; // Hide gifts section
        document.getElementById('adminUsers').style.display = 'none'; // Hide users section
        renderAdminItems();
    } else if (tab === 'payments') {
        document.getElementById('adminItems').style.display = 'none';
        document.getElementById('adminPayments').style.display = 'block';
        document.getElementById('adminVariants').style.display = 'none';
        document.getElementById('adminGifts').style.display = 'none'; // Hide gifts section
        document.getElementById('adminUsers').style.display = 'none'; // Hide users section
        loadPaymentRequests();
    } else if (tab === 'variants') {
        document.getElementById('adminItems').style.display = 'none';
        document.getElementById('adminPayments').style.display = 'none';
        document.getElementById('adminVariants').style.display = 'block';
        document.getElementById('adminGifts').style.display = 'none'; // Hide gifts section
        document.getElementById('adminUsers').style.display = 'none'; // Hide users section
        renderAdminVariants().then(() => {
            console.log('Admin variants rendered');
        });
    } else if (tab === 'gifts') { // New tab for gifts
        document.getElementById('adminItems').style.display = 'none';
        document.getElementById('adminPayments').style.display = 'none';
        document.getElementById('adminVariants').style.display = 'none';
        document.getElementById('adminGifts').style.display = 'block'; // Show gifts section
        document.getElementById('adminUsers').style.display = 'none'; // Hide users section
        loadGiftItems(); // Load gift items when tab is activated
    } else if (tab === 'users') { // New tab for users
        document.getElementById('adminItems').style.display = 'none';
        document.getElementById('adminPayments').style.display = 'none';
        document.getElementById('adminVariants').style.display = 'none';
        document.getElementById('adminGifts').style.display = 'none';
        document.getElementById('adminUsers').style.display = 'block'; // Show users section
        loadPlatformUsers(); // Load platform users when tab is activated
    }
}

async function renderAdminVariants() {
    const adminVariantsContainer = document.getElementById('adminVariants');
    if (!adminVariantsContainer) {
        console.error('Admin variants container not found!');
        return;
    }
    adminVariantsContainer.innerHTML = `
        <div class="admin-variants-header">
            <h3>NFT Варианты улучшений</h3>
            <button class="admin-add-btn" onclick="openAddVariantModal()">+ Добавить вариант</button>
        </div>
        <div class="variants-list" id="variantsList">
            <!-- Variants will be loaded here -->
        </div>
    `;
    await loadNFTVariants(); // Call the function to load variants
    renderNFTVariantsList(); // Render the loaded variants
}

function renderNFTVariantsList() { // Renamed function to avoid conflict and be more descriptive
    const variantsList = document.getElementById('variantsList');
    if (!variantsList) return;

    variantsList.innerHTML = '';

    nftVariants.forEach((variant, index) => {
        const variantElement = document.createElement('div');
        variantElement.className = 'variant-item';
        variantElement.innerHTML = `
            <div class="variant-image">
                <img src="${variant.url}" alt="${variant.model}">
            </div>
            <div class="variant-info">
                <h4>${variant.model}</h4>
                <div class="variant-background">Фон: ${variant.background}</div>
                <div class="variant-url">${variant.url}</div>
            </div>
            <div class="variant-actions">
                <button class="admin-edit-btn" onclick="editVariant(${index})">✏️</button>
                <button class="admin-delete-btn" onclick="deleteVariant(${index})">🗑️</button>
            </div>
        `;
        variantsList.appendChild(variantElement);
    });
}

function openAddVariantModal() {
    document.getElementById('variantModalTitle').textContent = 'Добавить вариант';
    document.getElementById('variantUrl').value = '';
    document.getElementById('variantModel').value = '';
    document.getElementById('variantBackground').value = '';
    // Clear any previous edit index
    const modal = document.getElementById('variantModal');
    if (modal) {
        modal.removeAttribute('data-edit-index');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function editVariant(index) {
    const variant = nftVariants[index];
    document.getElementById('variantModalTitle').textContent = 'Редактировать вариант';
    document.getElementById('variantUrl').value = variant.url;
    document.getElementById('variantModel').value = variant.model;
    document.getElementById('variantBackground').value = variant.background;
    // Store index for editing
    const modal = document.getElementById('variantModal');
    if (modal) {
        modal.dataset.editIndex = index;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function deleteVariant(index) {
    if (confirm('Удалить этот вариант?')) {
        nftVariants.splice(index, 1);
        renderNFTVariantsList(); // Update list display
        saveNFTVariants(); // Save changes to server
    }
}

function closeVariantModal() {
    const modal = document.getElementById('variantModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        modal.removeAttribute('data-edit-index');
    }
}

function saveVariant() {
    const url = document.getElementById('variantUrl').value.trim();
    const model = document.getElementById('variantModel').value.trim();
    const background = document.getElementById('variantBackground').value.trim();

    if (!url || !model || !background) {
        alert('Заполните все поля');
        return;
    }

    const variant = { url, model, background };
    const editIndex = document.getElementById('variantModal').dataset.editIndex;

    if (editIndex !== undefined) {
        nftVariants[parseInt(editIndex)] = variant;
    } else {
        nftVariants.push(variant);
    }

    renderNFTVariantsList(); // Update list display
    saveNFTVariants(); // Save changes to server
    closeVariantModal();
}

async function loadPaymentRequests() {
    try {
        const response = await fetch('/api/payment-requests');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const requests = await response.json();
        renderPaymentRequests(requests);
    } catch (error) {
        console.error('Error loading payment requests:', error);
        renderPaymentRequests([]); // Render empty state on error
    }
}

function renderPaymentRequests(requests) {
    const adminPayments = document.getElementById('adminPayments');
    if (!adminPayments) {
        console.error('Admin payments section not found!');
        return;
    }

    if (requests.length === 0) {
        adminPayments.innerHTML = `
            <div class="admin-empty">
                <div class="admin-empty-icon">💳</div>
                <div class="admin-empty-text">Нет заявок на оплату</div>
                <div class="admin-empty-subtext">Заявки будут отображаться здесь</div>
            </div>
        `;
        return;
    }

    adminPayments.innerHTML = '';

    requests.forEach(request => {
        const requestElement = createPaymentRequestElement(request);
        adminPayments.appendChild(requestElement);
    });
}

function createPaymentRequestElement(request) {
    const div = document.createElement('div');
    div.className = 'payment-request';

    // Check if this is a top up request
    if (request.type === 'stars_topup') {
        div.innerHTML = `
            <div class="payment-request-header">
                <div class="payment-request-status pending">В ожидании</div>
                <div class="request-date">${new Date(request.date).toLocaleString('ru-RU')}</div>
            </div>
            <div class="payment-request-info">
                <div class="payment-request-image">
                    ⭐
                </div>
                <div class="payment-request-details">
                    <h4>Пополнение Stars</h4>
                    <div class="request-user">@${request.username}</div>
                    <div class="request-price">${request.amount} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px;" alt="Stars"></div>
                </div>
            </div>
            <div class="payment-request-actions">
                <button class="approve-btn" onclick="approveTopUp('${request.id}')">Принять</button>
                <button class="reject-btn" onclick="rejectPayment('${request.id}')">Отклонить</button>
            </div>
        `;
    } else {
        // Regular item purchase request
        const imageContent = request.itemImage && request.itemImage.startsWith('http') ?
            `<img src="${request.itemImage}" alt="${request.itemName}">` :
            (request.itemImage || '📦');

        // Определить цену и иконку на основе способа оплаты
        let priceDisplay = '';
        let paymentMethodName = '';

        switch (request.paymentMethod) {
            case 'STARS':
                priceDisplay = `${request.convertedPrice} <img src="https://i.postimg.cc/3N3f5zhH/IMG-1243.png" style="width: 14px; height: 14px;" alt="Stars">`;
                paymentMethodName = 'Telegram Stars';
                break;
            case 'TON':
                priceDisplay = `${request.convertedPrice || request.price} <img src="https://ton.org/download/ton_symbol.png" style="width: 14px; height: 14px;" alt="TON">`;
                paymentMethodName = 'TON Wallet';
                break;
            case 'YOOMONEY':
                priceDisplay = `${request.convertedPrice} <img src="https://i.postimg.cc/4yxzyjPG/IMG-1244.png" style="width: 14px; height: 14px;" alt="ЮMoney">`;
                paymentMethodName = 'ЮMoney';
                break;
            default:
                priceDisplay = `${request.price} TON`;
                paymentMethodName = 'TON Wallet';
                break;
        }

        div.innerHTML = `
            <div class="payment-request-header">
                <div class="payment-request-status pending">В ожидании</div>
                <div class="request-date">${new Date(request.date).toLocaleString('ru-RU')}</div>
            </div>
            <div class="payment-request-info">
                <div class="payment-request-image">
                    ${imageContent}
                </div>
                <div class="payment-request-details">
                    <h4>${request.itemName}</h4>
                    <div class="request-user">@${request.username}</div>
                    <div class="request-price">${priceDisplay}</div>
                    <div class="request-payment-method" style="font-size: 12px; color: #888; margin-top: 4px;">Способ: ${paymentMethodName}</div>
                </div>
            </div>
            <div class="payment-request-actions">
                <button class="approve-btn" onclick="approvePayment('${request.id}')">Принять</button>
                <button class="reject-btn" onclick="rejectPayment('${request.id}')">Отклонить</button>
            </div>
        `;
    }

    return div;
}

async function approvePayment(requestId) {
    try {
        const response = await fetch(`/api/payment-request/${requestId}/approve`, {
            method: 'POST'
        });

        if (response.ok) {
            loadPaymentRequests();
            console.log('Заявка на оплату одобрена');

            // Reload other data to sync
            await loadNFTs();
            await loadActivity();
            await loadInventory();
        } else {
            console.error(`Failed to approve payment request ${requestId}`);
        }
    } catch (error) {
        console.error('Error approving payment:', error);
    }
}

async function approveTopUp(requestId) {
    try {
        const response = await fetch(`/api/topup-request/${requestId}/approve`, {
            method: 'POST'
        });

        if (response.ok) {
            loadPaymentRequests();
            console.log('Заявка на пополнение одобрена');
        } else {
            console.error(`Failed to approve top up request ${requestId}`);
        }
    } catch (error) {
        console.error('Error approving top up:', error);
    }
}

async function rejectPayment(requestId) {
    try {
        const response = await fetch(`/api/payment-request/${requestId}/reject`, {
            method: 'POST'
        });

        if (response.ok) {
            loadPaymentRequests();
            console.log('Заявка на оплату отклонена');
        } else {
            console.error(`Failed to reject payment request ${requestId}`);
        }
    } catch (error) {
        console.error('Error rejecting payment:', error);
    }
}

// Referral system functions
function getReferrerId() {
    // Check Telegram WebApp start param first
    if (window.Telegram && window.Telegram.WebApp) {
        const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param;
        if (startParam && !isNaN(startParam)) {
            localStorage.setItem('referrerId', startParam);
            return startParam;
        }
    }

    // Check if user came from referral link in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralParam = urlParams.get('startapp');
    if (referralParam && !isNaN(referralParam)) {
        localStorage.setItem('referrerId', referralParam);
        return referralParam;
    }

    // Return stored referrer ID
    return localStorage.getItem('referrerId');
}

// Process referral if exists
async function processReferral() {
    const referrerId = getReferrerId();
    if (referrerId && currentUser && referrerId !== currentUser.id.toString()) {
        try {
            await fetch('/api/add-referral', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    referrerId: parseInt(referrerId),
                    referredId: currentUser.id,
                    referrerUsername: 'unknown',
                    referredUsername: currentUser.username || currentUser.first_name || 'user'
                })
            });
            console.log('Referral processed successfully');
        } catch (error) {
            console.error('Error processing referral:', error);
        }
    }
}

// Updated Admin Panel Functions for Gifts

// Load items for gift transfer
async function loadGiftItems() {
    try {
        const response = await fetch('/api/items');
        const items = await response.json();

        const select = document.getElementById('giftItemSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Выберите подарок...</option>';

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (ID: ${item.id})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading gift items:', error);
    }
}

// Send gift to user
async function sendGiftToUser() {
    const userId = document.getElementById('giftUserId').value;
    const itemId = document.getElementById('giftItemSelect').value;
    const comment = document.getElementById('giftComment').value;

    if (!userId || !itemId) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }

    try {
        const response = await fetch('/api/admin-gift-transfer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: parseInt(userId),
                itemId: parseInt(itemId),
                comment: comment || null,
                adminId: currentUser.id,
                adminUsername: currentUser.username
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Подарок успешно отправлен пользователю!');
            // Clear form
            document.getElementById('giftUserId').value = '';
            document.getElementById('giftItemSelect').value = '';
            document.getElementById('giftComment').value = '';
        } else {
            alert('Ошибка: ' + (result.error || 'Не удалось отправить подарок'));
        }
    } catch (error) {
        console.error('Error sending gift:', error);
        alert('Произошла ошибка при отправке подарка');
    }
}

// Function to load and render the admin data, including gifts
function loadAdminData() {
    loadPaymentRequests();
    loadTopUpRequests();
    loadGiftItems(); // Ensure gift items are loaded when admin panel is accessed
}

// Синхронизация данных пользователя с новой системой
async function syncUserData(user) {
    if (!user || !user.id) {
        console.log('No user data to sync');
        return;
    }

    try {
        const response = await fetch('/api/user-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                photoUrl: user.photo_url
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('User data synced successfully:', result);
        } else {
            console.error('Failed to sync user data');
        }
    } catch (error) {
        console.error('Error syncing user data:', error);
    }
}

// Load platform users for admin panel
async function loadPlatformUsers() {
    try {
        const response = await fetch('/api/platform-users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        renderPlatformStats(data.stats);
        renderUsersList(data.users);
    } catch (error) {
        console.error('Error loading platform users:', error);
        // Показываем заглушку в случае ошибки
        renderPlatformStats({
            totalUsers: 0,
            totalPurchases: 0,
            totalSpent: 0
        });
        renderUsersList([]);
    }
}

// Функция для отображения статистики платформы
function renderPlatformStats(stats) {
    const platformStatsElement = document.getElementById('platformStats');
    if (platformStatsElement) {
        platformStatsElement.innerHTML = `
            <div class="stat-card">
                <h4>${stats.totalUsers}</h4>
                <p>Всего пользователей</p>
            </div>
            <div class="stat-card">
                <h4>${stats.totalPurchases}</h4>
                <p>Всего покупок</p>
            </div>
            <div class="stat-card">
                <h4>${stats.totalSpent} Stars</h4>
                <p>Общий объем продаж</p>
            </div>
            <div class="stat-card">
                <h4>${stats.totalGifts}</h4>
                <p>Всего подарков</p>
            </div>
            <div class="stat-card">
                <h4>${stats.totalNFTs}</h4>
                <p>NFT подарков</p>
            </div>
        `;
    }
}

// Функция для отображения списка пользователей
function renderUsersList(users) {
    const usersListElement = document.getElementById('usersList');
    if (!usersListElement) return;

    if (!users || users.length === 0) {
        usersListElement.innerHTML = `
            <div class="admin-empty">
                <div class="admin-empty-icon">👥</div>
                <div class="admin-empty-text">Нет пользователей</div>
                <div class="admin-empty-subtext">Пользователи появятся после первого входа в бот</div>
            </div>
        `;
        return;
    }

    usersListElement.innerHTML = '';
    users.forEach(user => {
        const userElement = createUserElement(user);
        usersListElement.appendChild(userElement);
    });
}

// Функция для создания элемента пользователя
function createUserElement(user) {
    const div = document.createElement('div');
    div.className = 'user-item';

    const displayName = user.username ? `@${user.username}` :
                       user.firstName ? user.firstName :
                       `User ${user.userId}`;

    const lastSeenDate = user.lastSeen ? new Date(user.lastSeen).toLocaleDateString('ru-RU') : 'Никогда';
    const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : 'Неизвестно';

    // Форматируем баланс
    const balance = user.balance || 0;
    const balanceText = balance > 0 ? `${balance} Stars` : '0 Stars';

    // Форматируем потрачено
    const totalSpent = user.totalSpent || 0;
    const spentText = totalSpent > 0 ? `${totalSpent} Stars` : '0 Stars';

    // Количество подарков в инвентаре
    const inventoryCount = user.inventoryCount || 0;
    const nftCount = user.nftCount || 0;

    // Создаем список подарков пользователя
    let inventoryHTML = '';
    if (user.inventory && user.inventory.length > 0) {
        inventoryHTML = `
            <div class="user-inventory">
                <h5>Подарки пользователя (${user.inventory.length})</h5>
                <div class="user-gifts-list">
        `;

        user.inventory.forEach(item => {
            const giftImage = item.image && item.image.startsWith('http') ?
                `<img src="${item.image}" alt="${item.name}" style="width: 30px; height: 30px; border-radius: 6px; object-fit: cover;">` :
                `<span style="font-size: 20px;">${item.image || '🎁'}</span>`;

            const giftStatus = item.isNFT ? 'NFT' : (item.status || 'Редкий');
            const statusClass = item.isNFT ? 'nft-status' : 'regular-status';

            let priceDisplay = '';
            if (item.convertedPrice > 0) {
                switch (item.paymentMethod) {
                    case 'STARS':
                        priceDisplay = `${item.convertedPrice} ⭐`;
                        break;
                    case 'TON':
                        priceDisplay = `${item.convertedPrice} TON`;
                        break;
                    case 'YOOMONEY':
                    case 'RUB':
                        priceDisplay = `${item.convertedPrice} ₽`;
                        break;
                    default:
                        priceDisplay = `${item.convertedPrice} ⭐`;
                        break;
                }
            }

            const nftDetails = item.isNFT && item.nftModel ? `
                <div class="nft-details">
                    <small>Модель: ${item.nftModel}</small>
                    <small>Фон: ${item.nftBackground || 'Не указан'}</small>
                </div>
            ` : '';

            inventoryHTML += `
                <div class="user-gift-item">
                    <div class="gift-image">${giftImage}</div>
                    <div class="gift-info">
                        <div class="gift-name">${item.name}</div>
                        <div class="gift-meta">
                            <span class="gift-status ${statusClass}">${giftStatus}</span>
                            ${item.buyerNumber ? `<span class="gift-number">#${item.buyerNumber}</span>` : ''}
                            ${priceDisplay ? `<span class="gift-price">${priceDisplay}</span>` : ''}
                        </div>
                        ${nftDetails}
                    </div>
                </div>
            `;
        });

        inventoryHTML += `
                </div>
            </div>
        `;
    } else {
        inventoryHTML = `
            <div class="user-inventory">
                <h5>Подарки пользователя</h5>
                <div class="no-gifts">Нет подарков</div>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="user-header">
            <div class="user-avatar">
                ${user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div class="user-basic-info">
                <h4>${displayName}</h4>
                <div class="user-id">ID: ${user.userId}</div>
                <div class="user-last-seen">Последний вход: ${lastSeenDate}</div>
            </div>
        </div>

        <div class="user-details">
            <h5>Информация о пользователе</h5>
            <div class="user-stats">
                <div class="user-stat">
                    <div class="user-stat-label">Баланс</div>
                    <div class="user-stat-value">${balanceText}</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-label">Покупок</div>
                    <div class="user-stat-value">${user.totalPurchases || 0}</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-label">Потрачено</div>
                    <div class="user-stat-value">${spentText}</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-label">Подарков</div>
                    <div class="user-stat-value">${inventoryCount}</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-label">NFT</div>
                    <div class="user-stat-value">${nftCount}</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-label">Рефералов</div>
                    <div class="user-stat-value">${user.referralCount || 0}</div>
                </div>
                <div class="user-stat">
                    <div class="user-stat-label">Регистрация</div>
                    <div class="user-stat-value">${createdDate}</div>
                </div>
            </div>
        </div>

        ${inventoryHTML}

        <div class="user-actions">
            <button class="user-action-btn gift-btn" onclick="sendAdminGiftToUser(${user.userId})">
                🎁 Подарок
            </button>
            <button class="user-action-btn details-btn" onclick="showUserDetails(${user.userId})">
                📊 Подробнее
            </button>
        </div>
    `;

    return div;
}

// Функция для поиска пользователя
async function searchUser() {
    const query = document.getElementById('userSearchInput').value.trim();
    if (!query) {
        loadPlatformUsers();
        return;
    }

    try {
        const response = await fetch(`/api/search-users?query=${encodeURIComponent(query)}`);
        if (response.ok) {
            const users = await response.json();
            renderUsersList(users);
        }
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

// Функция для отправки подарка пользователю из списка
function sendAdminGiftToUser(userId) {
    const giftUserIdField = document.getElementById('giftUserId');
    if (giftUserIdField) {
        giftUserIdField.value = userId;
        // Переключаемся на вкладку подарков
        showAdminTab('gifts');
        // Обновляем активную кнопку
        document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.admin-tab')[3].classList.add('active'); // gifts tab
    }
}

// Функция для показа деталей пользователя
function showUserDetails(userId) {
    if (window.Telegram?.WebApp?.showPopup) {
        window.Telegram.WebApp.showPopup({
            title: 'Информация о пользователе',
            message: `ID пользователя: ${userId}\n\nВы можете отправить подарок этому пользователю через раздел "Передача подарков".`,
            buttons: [{ type: 'ok', text: 'Понятно' }]
        });
    } else {
        alert(`Информация о пользователе:\nID: ${userId}`);
    }
}

// Helper function to set up event listeners for various UI elements
function setupEventListeners() {
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                if (modal.id === 'purchaseModal') closePurchaseModal();
                else if (modal.id === 'paymentMethodsModal') closePaymentMethodsModal();
                else if (modal.id === 'paymentModal') closePaymentModal();
                else if (modal.id === 'inventoryModal') closeInventoryModal();
                else if (modal.id === 'transferModal') closeTransferModal();
                else if (modal.id === 'topUpModal') closeTopUpModal();
                else if (modal.id === 'topUpPaymentModal') closeTopUpPaymentModal();
                else if (modal.id === 'variantModal') closeVariantModal();
                else if (modal.id === 'upgradeConfirmModal') closeUpgradeConfirmModal();
                else if (modal.id === 'rouletteModal') closeRouletteModal();
                else if (modal.id === 'channelSubscriptionModal') closeChannelModal();
                else if (modal.id === 'inviteModal') closeInviteModal();
            }
        });
    });

    // Close modals with escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (document.getElementById('purchaseModal')?.classList.contains('active')) closePurchaseModal();
            else if (document.getElementById('paymentMethodsModal')?.classList.contains('active')) closePaymentMethodsModal();
            else if (document.getElementById('paymentModal')?.classList.contains('active')) closePaymentModal();
            else if (document.getElementById('inventoryModal')?.classList.contains('active')) closeInventoryModal();
            else if (document.getElementById('transferModal')?.classList.contains('active')) closeTransferModal();
            else if (document.getElementById('topUpModal')?.classList.contains('active')) closeTopUpModal();
            else if (document.getElementById('topUpPaymentModal')?.classList.contains('active')) closeTopUpPaymentModal();
            else if (document.getElementById('variantModal')?.classList.contains('active')) closeVariantModal();
            else if (document.getElementById('upgradeConfirmModal')?.classList.contains('active')) closeUpgradeConfirmModal();
            else if (document.getElementById('rouletteModal')?.classList.contains('active')) closeRouletteModal();
            else if (document.getElementById('channelSubscriptionModal')?.classList.contains('active')) closeChannelModal();
            else if (document.getElementById('inviteModal')?.classList.contains('active')) closeInviteModal();
        }
    });

    // Add event listener for the admin tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // The showAdminTab function is already called by the onclick attribute in HTML
            // This event listener is mainly for adding the 'active' class, which is handled by showAdminTab
        });
    });
}

// Check for fullscreen API support
function checkFullscreenSupport() {
    const fullscreenButton = document.getElementById('fullscreenButton');
    if (fullscreenButton) {
        if (document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled) {
            fullscreenButton.style.display = 'block'; // Show button if fullscreen is supported
        } else {
            fullscreenButton.style.display = 'none'; // Hide button if not supported
        }
    }
}