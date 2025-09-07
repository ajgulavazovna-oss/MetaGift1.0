// Simple file-based storage functions for compatibility
const fs = require('fs');
const path = require('path');

// File paths
const DATA_FILE = path.join(__dirname, 'data.json');
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const INVENTORY_FILE = path.join(__dirname, 'inventory.json');
const USER_BALANCE_FILE = path.join(__dirname, 'user-balance.json');
const USER_STATS_FILE = path.join(__dirname, 'user-stats.json');

// Default data
const DEFAULT_ITEMS = [];

// Load data from file-based storage

// Load data functions with fallback to defaults
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (error) {
        console.log('Error loading data file, using defaults');
    }
    
    // Save default data and return it
    saveData(DEFAULT_ITEMS);
    return DEFAULT_ITEMS;
}

function loadActivityData() {
    try {
        if (fs.existsSync(ACTIVITY_FILE)) {
            const data = fs.readFileSync(ACTIVITY_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.log('Error loading activity file');
    }
    return [];
}

function loadInventoryData() {
    try {
        if (fs.existsSync(INVENTORY_FILE)) {
            const data = fs.readFileSync(INVENTORY_FILE, 'utf8');
            
            if (!data || data.trim() === '') {
                console.log('Inventory file is empty, returning empty array');
                return [];
            }
            
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                console.log(`Loaded ${parsed.length} inventory items from file`);
                return parsed;
            } else {
                console.warn('Inventory file does not contain an array, returning empty array');
                return [];
            }
        } else {
            console.log('Inventory file does not exist, returning empty array');
            return [];
        }
    } catch (error) {
        console.error('Error loading inventory file:', error);
        // Try to backup corrupted file
        try {
            if (fs.existsSync(INVENTORY_FILE)) {
                const backupFile = INVENTORY_FILE + '.backup.' + Date.now();
                fs.copyFileSync(INVENTORY_FILE, backupFile);
                console.log('Created backup of corrupted inventory file:', backupFile);
            }
        } catch (backupError) {
            console.error('Could not backup corrupted inventory file:', backupError);
        }
    }
    return [];
}

function loadUserBalanceData() {
    try {
        if (fs.existsSync(USER_BALANCE_FILE)) {
            const data = fs.readFileSync(USER_BALANCE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading user balance file');
    }
    return {};
}

function loadUserStatsData() {
    try {
        if (fs.existsSync(USER_STATS_FILE)) {
            const data = fs.readFileSync(USER_STATS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading user stats file');
    }
    return {};
}

// Save data functions
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('Data saved successfully');
    } catch (error) {
        console.log('Error saving data:', error);
    }
}

function saveActivityData(data) {
    try {
        fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving activity:', error);
    }
}

function saveInventoryData(data) {
    try {
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving inventory:', error);
    }
}

function saveUserBalanceData(data) {
    try {
        fs.writeFileSync(USER_BALANCE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving user balance:', error);
    }
}

function saveUserStatsData(data) {
    try {
        fs.writeFileSync(USER_STATS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving user stats:', error);
    }
}

// Initialize all data files
function initializeDatabase() {
    console.log('Initializing file-based storage');
    
    // Initialize data.json with default items if empty or missing
    const items = loadData();
    console.log(`Loaded ${items.length} items`);
    
    // Initialize other files if they don't exist
    if (!fs.existsSync(ACTIVITY_FILE)) {
        saveActivityData([]);
    }
    if (!fs.existsSync(INVENTORY_FILE)) {
        saveInventoryData([]);
    }
    if (!fs.existsSync(USER_BALANCE_FILE)) {
        saveUserBalanceData({});
    }
    if (!fs.existsSync(USER_STATS_FILE)) {
        saveUserStatsData({});
    }
    
    console.log('Database initialization complete');
    return Promise.resolve();
}

// Compatibility functions for the main app
function getUserBalance(userId) {
    const userBalanceData = loadUserBalanceData();
    return Promise.resolve(userBalanceData[userId] ? userBalanceData[userId].stars : 0);
}

function updateUserBalance(userId, stars, username) {
    const userBalanceData = loadUserBalanceData();
    userBalanceData[userId] = { stars, username };
    saveUserBalanceData(userBalanceData);
    return Promise.resolve();
}

function getUserStats(userId) {
    const userStatsData = loadUserStatsData();
    return Promise.resolve(userStatsData[userId] || {
        total_purchases: 0,
        total_spent: 0,
        referral_count: 0,
        referral_earnings: 0
    });
}

function getAllItems() {
    try {
        const items = loadData();
        return Promise.resolve(items.map(row => ({
            id: row.id,
            name: row.name,
            image: row.image,
            description: row.description || '',
            price: row.price,
            prices: row.prices || {
                TON: row.price,
                STARS: Math.ceil(row.price * 100),
                RUB: Math.ceil(row.price * 300)
            },
            quantity: row.quantity,
            stock: row.stock,
            tag: row.tag,
            tagColor: row.tagColor,
            status: row.status,
            statusColor: row.statusColor
        })));
    } catch (error) {
        console.error('Error loading items:', error);
        return Promise.resolve([]);
    }
}

function addActivity(activityData) {
    const activityItems = loadActivityData();
    const newActivity = {
        id: activityData.id,
        name: activityData.name,
        image: activityData.image,
        price: activityData.price,
        convertedPrice: activityData.convertedPrice || activityData.price,
        prices: activityData.prices,
        paymentMethod: activityData.paymentMethod,
        userId: activityData.userId,
        username: activityData.username,
        buyerNumber: activityData.buyerNumber || (activityItems.length + 1),
        adminGift: activityData.adminGift || false,
        fromAdmin: activityData.fromAdmin || null,
        date: new Date().toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }),
        time: new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        })
    };
    activityItems.push(newActivity);
    saveActivityData(activityItems);
    return Promise.resolve();
}

function getAllActivity() {
    const activityItems = loadActivityData();
    // Возвращаем в обратном порядке (новые сначала) но сохраняем правильную нумерацию
    return Promise.resolve(activityItems.slice().reverse().slice(0, 100));
}

function addToInventory(inventoryData) {
    const inventoryItems = loadInventoryData();
    const newItem = {
        inventoryId: Date.now() + Math.random(),
        id: inventoryData.id,
        name: inventoryData.name,
        image: inventoryData.image,
        price: inventoryData.price,
        convertedPrice: inventoryData.convertedPrice || inventoryData.price,
        prices: inventoryData.prices,
        quantity: inventoryData.quantity,
        owner: inventoryData.owner,
        userId: inventoryData.userId,
        username: inventoryData.username,
        status: inventoryData.status || 'Редкий',
        buyerNumber: inventoryData.buyerNumber || null,
        comment: inventoryData.comment || null,
        transferDate: inventoryData.transferDate || null,
        fromUsername: inventoryData.fromUsername || null,
        originalOwner: inventoryData.originalOwner || null,
        createdAt: new Date().toISOString(),
        // Добавляем поля для NFT информации
        nftModel: inventoryData.nftModel || null,
        nftBackground: inventoryData.nftBackground || null,
        isNFT: inventoryData.isNFT || false,
        // Добавляем поле способа оплаты для истории
        paymentMethod: inventoryData.paymentMethod || null,
        // Добавляем поле для админских подарков
        isAdminGift: inventoryData.isAdminGift || false
    };
    inventoryItems.push(newItem);
    saveInventoryData(inventoryItems);
    console.log(`Добавлен предмет в инвентарь: ${newItem.name} для пользователя ${newItem.userId}`);
    return Promise.resolve();
}

function getUserInventory(userId) {
    try {
        if (!userId || isNaN(userId) || userId <= 0) {
            console.log('Invalid userId provided to getUserInventory:', userId);
            return Promise.resolve([]);
        }
        
        const inventoryItems = loadInventoryData();
        if (!Array.isArray(inventoryItems)) {
            console.warn('Inventory data is not an array, returning empty inventory');
            return Promise.resolve([]);
        }
        
        const userItems = inventoryItems.filter(item => {
            if (!item) {
                console.warn('Found null/undefined item in inventory data');
                return false;
            }
            
            if (!item.userId) {
                console.warn('Found item without userId:', item);
                return false;
            }
            
            return item.userId === userId;
        });
        
        console.log(`Found ${userItems.length} items for user ${userId}`);
        
        const mappedItems = userItems.map(row => {
            try {
                return {
                    inventoryId: row.inventoryId || Date.now() + Math.random(),
                    id: row.id || 0,
                    name: row.name || 'Неизвестный предмет',
                    image: row.image || '📦',
                    price: row.price || 0,
                    convertedPrice: row.convertedPrice || row.price || 0,
                    prices: row.prices || {},
                    quantity: row.quantity || 'x1',
                    owner: row.owner || 'Неизвестно',
                    userId: row.userId,
                    username: row.username || 'user',
                    status: row.status || 'Редкий',
                    buyerNumber: row.buyerNumber || null,
                    comment: row.comment || null,
                    transferDate: row.transferDate || null,
                    fromUsername: row.fromUsername || null,
                    originalOwner: row.originalOwner || null,
                    createdAt: row.createdAt || new Date().toISOString(),
                    // Добавляем поля для NFT информации
                    nftModel: row.nftModel || null,
                    nftBackground: row.nftBackground || null,
                    isNFT: row.isNFT || false
                };
            } catch (mappingError) {
                console.error('Error mapping inventory item:', mappingError, row);
                return null;
            }
        }).filter(item => item !== null);
        
        return Promise.resolve(mappedItems);
    } catch (error) {
        console.error('Error in getUserInventory:', error);
        return Promise.resolve([]);
    }
}

function removeFromInventory(inventoryId, userId) {
    const inventoryItems = loadInventoryData();
    const newInventoryItems = inventoryItems.filter(item =>
        !(item.inventoryId === inventoryId && item.userId === userId)
    );
    saveInventoryData(newInventoryItems);
    console.log(`Удален предмет из инвентаря: ID ${inventoryId} для пользователя ${userId}`);
    return Promise.resolve(true);
}

function updateInventoryItem(inventoryId, userId, updateData) {
    const inventoryItems = loadInventoryData();
    const itemIndex = inventoryItems.findIndex(item => 
        item.inventoryId === inventoryId && item.userId === userId
    );
    
    if (itemIndex === -1) {
        console.log(`Предмет с ID ${inventoryId} не найден в инвентаре пользователя ${userId}`);
        return Promise.resolve(false);
    }
    
    // Обновляем предмет
    inventoryItems[itemIndex] = {
        ...inventoryItems[itemIndex],
        ...updateData
    };
    
    saveInventoryData(inventoryItems);
    console.log(`Обновлен предмет в инвентаре: ID ${inventoryId} для пользователя ${userId}`);
    return Promise.resolve(inventoryItems[itemIndex]);
}

function updateUserStats(userId, username, purchaseData) {
    const userStatsData = loadUserStatsData();
    if (!userStatsData[userId]) {
        userStatsData[userId] = {
            totalPurchases: 0,
            totalSpent: 0,
            referralCount: 0,
            referralEarnings: 0
        };
    }
    userStatsData[userId].totalPurchases += 1;
    
    // Добавляем потраченную сумму в Stars (конвертированная цена)
    const spentAmount = purchaseData.convertedPrice || (purchaseData.price ? Math.ceil(purchaseData.price * 100) : 0);
    userStatsData[userId].totalSpent += spentAmount;
    
    userStatsData[userId].username = username;
    saveUserStatsData(userStatsData);
    return Promise.resolve();
}

module.exports = {
    initializeDatabase,
    getUserBalance,
    updateUserBalance,
    getUserStats,
    getAllItems,
    addActivity,
    getAllActivity,
    addToInventory,
    getUserInventory,
    removeFromInventory,
    updateInventoryItem,
    updateUserStats,
    loadData,
    saveData
};
