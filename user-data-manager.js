
const fs = require('fs');
const path = require('path');

const USERS_DATA_FILE = path.join(__dirname, 'users-data.json');

// Загрузка данных пользователей
function loadUsersData() {
    try {
        if (fs.existsSync(USERS_DATA_FILE)) {
            const data = fs.readFileSync(USERS_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading users data file, using empty object');
    }
    return {};
}

// Сохранение данных пользователей
function saveUsersData(data) {
    try {
        fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving users data:', error);
    }
}

// Получить данные конкретного пользователя
function getUserData(userId) {
    const usersData = loadUsersData();
    if (!usersData[userId]) {
        usersData[userId] = {
            id: userId,
            username: null,
            balance: { stars: 0 },
            stats: {
                totalPurchases: 0,
                totalSpent: 0,
                referralCount: 0,
                referralEarnings: 0
            },
            inventory: [],
            nfts: [],
            activity: [],
            profile: {
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            },
            referrals: {
                referred: [],
                referredBy: null
            }
        };
        saveUsersData(usersData);
    }
    return usersData[userId];
}

// Обновить данные пользователя
function updateUserData(userId, updateData) {
    const usersData = loadUsersData();
    if (!usersData[userId]) {
        usersData[userId] = getUserData(userId);
    }
    
    // Глубокое слияние объектов
    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }
    
    deepMerge(usersData[userId], updateData);
    usersData[userId].profile.lastUpdated = new Date().toISOString();
    saveUsersData(usersData);
    return usersData[userId];
}

// Добавить предмет в инвентарь пользователя
function addToUserInventory(userId, item) {
    const userData = getUserData(userId);
    const inventoryItem = {
        ...item,
        addedAt: new Date().toISOString()
    };
    userData.inventory.push(inventoryItem);
    
    // Если это NFT, добавляем в отдельный список NFT
    if (item.isNFT) {
        userData.nfts.push(inventoryItem);
    }
    
    updateUserData(userId, userData);
    return inventoryItem;
}

// Удалить предмет из инвентаря пользователя
function removeFromUserInventory(userId, inventoryId) {
    const userData = getUserData(userId);
    userData.inventory = userData.inventory.filter(item => item.inventoryId !== inventoryId);
    userData.nfts = userData.nfts.filter(item => item.inventoryId !== inventoryId);
    updateUserData(userId, userData);
}

// Добавить активность пользователя
function addUserActivity(userId, activity) {
    const userData = getUserData(userId);
    const activityItem = {
        ...activity,
        timestamp: new Date().toISOString()
    };
    userData.activity.unshift(activityItem); // Добавляем в начало для обратного порядка
    
    // Ограничиваем количество записей активности (последние 100)
    if (userData.activity.length > 100) {
        userData.activity = userData.activity.slice(0, 100);
    }
    
    updateUserData(userId, userData);
    return activityItem;
}

// Обновить баланс пользователя
function updateUserBalance(userId, balance, username) {
    const userData = getUserData(userId);
    userData.balance.stars = balance;
    if (username) {
        userData.username = username;
    }
    updateUserData(userId, userData);
}

// Обновить статистику пользователя
function updateUserStats(userId, statsUpdate) {
    const userData = getUserData(userId);
    Object.keys(statsUpdate).forEach(key => {
        if (typeof statsUpdate[key] === 'number') {
            userData.stats[key] = (userData.stats[key] || 0) + statsUpdate[key];
        } else {
            userData.stats[key] = statsUpdate[key];
        }
    });
    updateUserData(userId, userData);
}

// Получить всех пользователей (для админа)
function getAllUsers() {
    return loadUsersData();
}

// Поиск пользователя по username
function findUserByUsername(username) {
    const usersData = loadUsersData();
    for (const userId in usersData) {
        if (usersData[userId].username === username) {
            return usersData[userId];
        }
    }
    return null;
}

// Статистика платформы
function getPlatformStats() {
    const usersData = loadUsersData();
    const userIds = Object.keys(usersData);
    
    let totalUsers = userIds.length;
    let totalPurchases = 0;
    let totalSpent = 0;
    let totalNFTs = 0;
    let activeUsers = 0;
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    userIds.forEach(userId => {
        const user = usersData[userId];
        totalPurchases += user.stats.totalPurchases || 0;
        totalSpent += user.stats.totalSpent || 0;
        totalNFTs += user.nfts.length || 0;
        
        if (user.profile.lastLogin && new Date(user.profile.lastLogin) > oneWeekAgo) {
            activeUsers++;
        }
    });
    
    return {
        totalUsers,
        activeUsers,
        totalPurchases,
        totalSpent,
        totalNFTs,
        averageSpentPerUser: totalUsers > 0 ? (totalSpent / totalUsers).toFixed(2) : 0
    };
}

module.exports = {
    loadUsersData,
    saveUsersData,
    getUserData,
    updateUserData,
    addToUserInventory,
    removeFromUserInventory,
    addUserActivity,
    updateUserBalance,
    updateUserStats,
    getAllUsers,
    findUserByUsername,
    getPlatformStats
};
