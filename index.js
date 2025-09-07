const express = require('express');
const path = require('path');
const fs = require('fs');
const {
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
} = require('./database');

// Импорт нового модуля управления пользователями
const {
  getUserData,
  updateUserData,
  addToUserInventory,
  removeFromUserInventory,
  addUserActivity,
  updateUserBalance: updateUserBalanceNew,
  updateUserStats: updateUserStatsNew,
  getAllUsers,
  findUserByUsername,
  getPlatformStats
} = require('./user-data-manager');

// Импортируем функции PostgreSQL
const {
  initializePostgresDB,
  getAllItemsFromPG,
  getUserBalanceFromPG,
  updateUserBalanceInPG,
  addActivityToPG,
  getAllActivityFromPG,
  addToInventoryPG,
  getUserInventoryFromPG,
  removeFromInventoryPG,
  updateInventoryItemPG,
  updateUserStatsInPG,
  getUserStatsFromPG,
  addReferralPG,
  getReferralCountPG
} = require('./postgres-db');
const app = express();

app.use(express.static('public'));
app.use(express.json());

// Ensure root path serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database on startup
async function initDB() {
  // Принудительно используем файловую систему для DEV
  console.log('Using file-based database (PostgreSQL disabled for DEV)');
  await initializeDatabase();
}

// Ждем инициализации базы данных перед запуском сервера
initDB().then(() => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`🌐 Mini App URL: https://a2963e5e-329a-4852-9963-43b2eab5aa97-00-glaj1oasdqop.pike.replit.dev/`);
    console.log(`📱 Telegram Bot: @MetaGiftRobot`);
    console.log(`\nℹ️ Setup URLs:`);
    console.log(`To set webhook, visit: https://metagift-market.replit.app/set-webhook`);
    console.log(`To check webhook, visit: https://metagift-market.replit.app/webhook-info`);
  });
}).catch(console.error);

// Telegram Bot Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '8479679589:AAGrtH_H8gFj7GTOPaOs9W7zhjn2GmO1rrI';

// Handle Telegram webhook
app.post('/webhook', (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  const update = req.body;

  // Webhook handler without /start command

  res.status(200).send('OK');
});

// Currency rates and payment configuration
const CURRENCY_RATES = {
  TON_TO_STARS: 100,
  TON_TO_RUBLE: 300,
  STARS_TO_RUBLE: 3
};

const PAYMENT_METHODS = {
  STARS: {
    name: 'Telegram Stars',
    icon: 'https://i.postimg.cc/3N3f5zhH/IMG-1243.png',
    contact: '@MetaGiftsupport'
  },
  YOOMONEY: {
    name: 'ЮMoney',
    icon: 'https://i.postimg.cc/4yxzyjPG/IMG-1244.png',
    wallet: '4100118542839036'
  },
  TON: {
    name: 'TON Wallet',
    icon: 'https://ton.org/download/ton_symbol.png',
    wallet: 'UQDy5hhPvhwcNY9g-lP-nkjdmx4rAVZGFEnhOKzdF-JcIiDW'
  }
};

// Function to send message via Telegram Bot API
async function sendTelegramMessage(userId, message, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: parse_mode
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message sent successfully to user ${userId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message to user ${userId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message to user ${userId}:`, error);
    return false;
  }
}

// Function to send message with inline keyboard
async function sendTelegramMessageWithKeyboard(chatId, message, keyboard, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parse_mode,
        reply_markup: keyboard
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message with keyboard sent successfully to chat ${chatId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message with keyboard to chat ${chatId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message with keyboard to chat ${chatId}:`, error);
    return false;
  }
}

// Data file paths
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const INVENTORY_FILE = path.join(__dirname, 'inventory.json');
const USER_STATS_FILE = path.join(__dirname, 'user-stats.json');
const REFERRALS_FILE = path.join(__dirname, 'referrals.json');
const PAYMENT_REQUESTS_FILE = path.join(__dirname, 'payment-requests.json');
const USER_BALANCE_FILE = path.join(__dirname, 'user-balance.json');

// Helper functions for loading and saving
function loadJSON(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log(`Error loading ${filePath}, using defaults`);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`Error saving ${filePath}:`, error);
  }
}

// Load initial data
let activityItems = loadJSON(ACTIVITY_FILE, []);
let inventoryItems = loadJSON(INVENTORY_FILE, []);
let userStatsData = loadJSON(USER_STATS_FILE, {});
let referralsData = loadJSON(REFERRALS_FILE, {});
let paymentRequestsData = loadJSON(PAYMENT_REQUESTS_FILE, []);
let userBalanceData = loadJSON(USER_BALANCE_FILE, {});

// API endpoints
app.get('/api/items', async (req, res) => {
  try {
    console.log('Using file system for items');
    const items = await getAllItems();

    console.log(`API: Loaded ${items.length} items:`, items.map(item => ({ id: item.id, name: item.name })));

    // Добавляем заголовки CORS
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error.message || error);
    // Возвращаем пустой массив в случае ошибки
    res.status(500).json([]);
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const activity = await getAllActivity();
    console.log(`API: Loaded ${activity.length} activity items`);
    res.json(activity);
  } catch (error) {
    console.error('Error getting activity:', error.message || error);
    res.status(500).json([]);
  }
});

app.get('/api/inventory/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);

  if (!userId || isNaN(userId) || userId <= 0) {
    console.error('Invalid user ID provided:', req.params.userId);
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    console.log(`Loading inventory for user ${userId}`);
    const inventory = await getUserInventory(userId);

    if (!inventory) {
      console.log(`No inventory found for user ${userId}, returning empty array`);
      return res.json([]);
    }

    if (!Array.isArray(inventory)) {
      console.error('Inventory data is not an array:', typeof inventory);
      return res.json([]);
    }

    console.log(`Successfully loaded ${inventory.length} items for user ${userId}`);

    // Добавляем заголовки CORS
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    res.json(inventory);
  } catch (error) {
    console.error('Error getting user inventory:', error.message || error);
    res.status(500).json([]);
  }
});

app.get('/api/user-stats/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const userStatsData = loadJSON(USER_STATS_FILE, {});
    const stats = userStatsData[userId] || {};

    // Return consistent format
    const formattedStats = {
      totalPurchases: stats.totalPurchases || 0,
      totalSpent: stats.totalSpent || 0,
      referralCount: stats.referralCount || 0,
      referralEarnings: stats.referralEarnings || 0,
      username: stats.username || ''
    };
    res.json(formattedStats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.json({
      totalPurchases: 0,
      totalSpent: 0,
      referralCount: 0,
      referralEarnings: 0
    });
  }
});

app.get('/api/user-balance/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const userBalance = await getUserBalance(userId);
    console.log(`API: User ${userId} balance: ${userBalance || 0}`);

    // Добавляем заголовки CORS
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    res.json({ stars: userBalance || 0 });
  } catch (error) {
    console.error('Error getting user balance:', error.message || error);
    // Возвращаем баланс 0 в случае ошибки
    res.status(500).json({ stars: 0 });
  }
});

// Endpoint для добавления реферала
app.post('/api/add-referral', async (req, res) => {
  const { referrerId, referredId, referrerUsername, referredUsername } = req.body;

  try {
    // Проверяем, что пользователь не добавляет сам себя как реферала
    if (referrerId === referredId) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    // Обработка для файловой системы
    const referralsData = loadJSON(REFERRALS_FILE, {});
    if (!referralsData[referrerId]) {
      referralsData[referrerId] = [];
    }

    // Проверяем, что реферал еще не добавлен
    if (!referralsData[referrerId].includes(referredId)) {
      referralsData[referrerId].push(referredId);
      saveJSON(REFERRALS_FILE, referralsData);

      // Обновляем статистику реферера
      const userStatsData = loadJSON(USER_STATS_FILE, {});
      if (!userStatsData[referrerId]) {
        userStatsData[referrerId] = {
          totalPurchases: 0,
          totalSpent: 0,
          referralCount: 0,
          referralEarnings: 0
        };
      }
      userStatsData[referrerId].referralCount += 1;
      saveJSON(USER_STATS_FILE, userStatsData);

      console.log(`Referral added: ${referredId} referred by ${referrerId}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding referral:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// NFT Variants API
app.post('/api/nft-variants', (req, res) => {
  try {
    const variants = req.body;
    if (!Array.isArray(variants)) {
      return res.status(400).json({ error: 'Variants must be an array' });
    }

    // Save variants to file
    const filePath = path.join(__dirname, 'nft-variants.json');
    saveJSON(filePath, variants);
    console.log('NFT variants saved to file:', variants);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving NFT variants:', error);
    res.status(500).json({ error: 'Failed to save variants' });
  }
});

app.get('/api/nft-variants', (req, res) => {
  try {
    const variants = loadJSON(path.join(__dirname, 'nft-variants.json'), []);
    console.log('Loading NFT variants from file:', variants);
    res.json(variants);
  } catch (error) {
    console.error('Error loading NFT variants:', error);
    res.status(500).json({ error: 'Failed to load variants' });
  }
});

// Унифицированные функции для работы с базой данных (принудительно файловая система)
async function getItems() {
  return await getAllItems();
}

async function getActivity() {
  return await getAllActivity();
}

async function getInventory(userId) {
  return await getUserInventory(userId);
}

async function getBalance(userId) {
  return await getUserBalance(userId);
}

async function setBalance(userId, stars, username) {
  return await updateUserBalance(userId, stars, username);
}

async function addToActivity(data) {
  return await addActivity(data);
}

async function addItemToInventory(data) {
  return await addToInventory(data);
}

async function removeItemFromInventory(inventoryId, userId) {
  return await removeFromInventory(inventoryId, userId);
}

async function updateItemInInventory(inventoryId, userId, updateData) {
  return await updateInventoryItem(inventoryId, userId, updateData);
}

async function updateStats(userId, username, purchaseData) {
  return await updateUserStats(userId, username, purchaseData);
}

async function getStats(userId) {
  return await getUserStats(userId);
}

// Get payment methods and converted prices for an item
app.get('/api/payment-methods/:itemId', async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    const items = await getAllItems();
    const item = items.find(item => item.id === itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const paymentMethods = [];

    // Add payment methods based on item prices
    if (item.prices) {
      if (item.prices.STARS > 0) {
        paymentMethods.push({
          id: 'STARS',
          name: 'Telegram Stars',
          icon: PAYMENT_METHODS.STARS.icon,
          price: item.prices.STARS,
          contact: PAYMENT_METHODS.STARS.contact
        });
      }

      if (item.prices.RUB > 0) {
        paymentMethods.push({
          id: 'YOOMONEY',
          name: 'ЮMoney (₽)',
          icon: PAYMENT_METHODS.YOOMONEY.icon,
          price: item.prices.RUB,
          wallet: PAYMENT_METHODS.YOOMONEY.wallet
        });
      }

      if (item.prices.TON > 0) {
        paymentMethods.push({
          id: 'TON',
          name: 'TON Wallet',
          icon: PAYMENT_METHODS.TON.icon,
          price: item.prices.TON,
          wallet: PAYMENT_METHODS.TON.wallet
        });
      }
    }

    res.json({ paymentMethods });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new item (admin only)
app.post('/api/items', async (req, res) => {
  try {
    const newItem = req.body;
    const items = loadData();

    // Auto-generate ID based on highest existing ID + 1
    const maxId = items.length > 0 ? Math.max(...items.map(item => item.id)) : 0;
    newItem.id = maxId + 1;

    items.push(newItem);
    saveData(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update item (admin only)
app.put('/api/items/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const updatedItem = req.body;
    const items = loadData();

    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    items[itemIndex] = { ...items[itemIndex], ...updatedItem };
    saveData(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete item (admin only)
app.delete('/api/items/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const items = loadData();

    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    items.splice(itemIndex, 1);
    saveData(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Purchase with balance endpoint
app.post('/api/purchase-with-balance', async (req, res) => {
  const { itemId, userId, username, starsPrice, referrerId } = req.body;

  try {
    const items = loadData();
    const item = items.find(nft => nft.id === itemId);

    if (!item || item.stock <= 0) {
      return res.status(400).json({ error: 'Товар недоступен или распродан' });
    }

    // Check user balance
    const userBalance = await getBalance(userId);
    if (userBalance < starsPrice) {
      return res.status(400).json({ error: 'Недостаточно Stars на балансе' });
    }

    // Decrease user balance
    const newBalance = userBalance - starsPrice;
    await setBalance(userId, newBalance, username);

    // Decrease item stock
    item.stock -= 1;
    if (item.stock === 0) {
      const newItems = items.filter(nft => nft.id !== itemId);
      saveData(newItems);
    } else {
      saveData(items);
    }

    // Calculate unique gift number - каждый подарок получает уникальный возрастающий номер
    const existingActivity = loadJSON(ACTIVITY_FILE, []);
    const giftNumber = existingActivity.length + 1;

    // Add to activity and inventory
    const activityData = {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      convertedPrice: starsPrice,
      prices: item.prices,
      userId: userId,
      username: username,
      buyerNumber: giftNumber
    };

    const inventoryData = {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      convertedPrice: starsPrice,
      prices: item.prices,
      paymentMethod: 'STARS',
      quantity: item.quantity,
      owner: '@' + username,
      userId: userId,
      username: username,
      status: item.status || 'Редкий',
      buyerNumber: giftNumber
    };

    await addToActivity(activityData);
    await addItemToInventory(inventoryData);
    await updateStats(userId, username, { price: item.price, convertedPrice: starsPrice });

    res.json({
      success: true,
      newBalance: newBalance,
      message: 'Покупка успешна!'
    });

  } catch (error) {
    console.error('Error purchasing with balance:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Payment request endpoints
app.post('/api/payment-request', (req, res) => {
  const { itemId, userId, username, price, itemName, itemImage, referrerId, paymentMethod, convertedPrice } = req.body;

  const paymentRequest = {
    id: Date.now().toString(),
    itemId: parseInt(itemId),
    userId: parseInt(userId),
    username: username,
    price: price,
    convertedPrice: convertedPrice || price,
    paymentMethod: paymentMethod || 'TON',
    itemName: itemName,
    itemImage: itemImage,
    referrerId: referrerId,
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(paymentRequest);
  saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

  res.json({ success: true });
});

app.get('/api/payment-requests', (req, res) => {
  const pendingRequests = paymentRequestsData.filter(request => request.status === 'pending');
  res.json(pendingRequests);
});

// Top up request endpoint
app.post('/api/topup-request', (req, res) => {
  const { userId, username, amount, type } = req.body;

  const topUpRequest = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    username: username,
    amount: parseInt(amount),
    type: type || 'stars_topup',
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(topUpRequest);
  saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

  res.json({ success: true });
});

// Transfer item endpoint
app.post('/api/transfer-item', async (req, res) => {
  const { itemId, fromUserId, fromUsername, toUserId, comment, item } = req.body;

  try {
    if (!item || !item.id || !item.name || !fromUserId || !fromUsername || !toUserId) {
      return res.status(400).json({ error: 'Отсутствуют обязательные данные для передачи' });
    }

    const recipientUserId = parseInt(toUserId);
    if (isNaN(recipientUserId) || recipientUserId <= 0) {
      return res.status(400).json({ error: 'Некорректный ID получателя' });
    }

    if (parseInt(fromUserId) === recipientUserId) {
      return res.status(400).json({ error: 'Нельзя передать подарок самому себе' });
    }

    // Find item in sender's inventory
    const inventory = await getUserInventory(parseInt(fromUserId));
    const inventoryItem = inventory.find(invItem =>
      invItem.inventoryId === item.inventoryId ||
      (invItem.id === item.id && invItem.name === item.name)
    );

    if (!inventoryItem) {
      return res.status(404).json({ error: 'Предмет не найден в вашем инвентаре' });
    }

    // Remove from sender's inventory
    await removeFromInventory(inventoryItem.inventoryId, parseInt(fromUserId));

    // Add to recipient's inventory
    const newInventoryItem = {
      ...inventoryItem,
      inventoryId: Date.now() + Math.random(),
      userId: recipientUserId,
      username: `user_${recipientUserId}`, // Will be updated when user logs in
      owner: `ID: ${recipientUserId}`,
      comment: comment || null,
      transferDate: new Date().toISOString(),
      fromUsername: fromUsername
    };

    await addToInventory(newInventoryItem);

    // Send notification to recipient
    const message = `🎁 <b>Вы получили подарок!</b>\n\n` +
      `📦 Подарок: ${item.name}\n` +
      `👤 От: ${fromUsername}\n` +
      `💬 Комментарий: ${comment || 'Без комментария'}\n\n` +
      `Подарок добавлен в ваш инвентарь!`;

    sendTelegramMessage(recipientUserId, message);

    res.json({ success: true });

  } catch (error) {
    console.error('Error transferring item:', error);
    res.status(500).json({ error: 'Произошла ошибка при передаче подарка' });
  }
});

// Helper functions for reading user data
function readUserData() {
    try {
        return loadJSON(path.join(__dirname, 'users-data.json'), {});
    } catch (error) {
        console.error('Error reading user data:', error);
        return {};
    }
}

function readUserStats() {
    try {
        return loadJSON(USER_STATS_FILE, {});
    } catch (error) {
        console.error('Error reading user stats:', error);
        return {};
    }
}

// Platform users endpoint
app.get('/api/platform-users', async (req, res) => {
    try {
        const usersData = readUserData();
        const userStats = readUserStats();
        const userBalanceData = loadJSON(USER_BALANCE_FILE, {});

        // Get all inventory items
        const allInventory = loadJSON(INVENTORY_FILE, []);

        // Calculate platform statistics
        let totalGifts = 0;
        let totalNFTs = 0;

        allInventory.forEach(item => {
            totalGifts++;
            if (item.isNFT) totalNFTs++;
        });

        const stats = {
            totalUsers: Object.keys(usersData).length,
            totalPurchases: Object.values(userStats).reduce((sum, user) => sum + (user.totalPurchases || 0), 0),
            totalSpent: Object.values(userStats).reduce((sum, user) => sum + (user.totalSpent || 0), 0),
            totalGifts: totalGifts,
            totalNFTs: totalNFTs
        };

        // Prepare users list with detailed inventory
        const users = Object.entries(usersData).map(([userId, user]) => {
            const stats = userStats[userId] || {};
            const balance = userBalanceData[userId] || 0;
            
            // Get user inventory
            const userInventory = allInventory.filter(item => item.userId === parseInt(userId));
            const nftCount = userInventory.filter(item => item.isNFT).length;

            return {
                userId: parseInt(userId),
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                totalPurchases: stats.totalPurchases || 0,
                totalSpent: stats.totalSpent || 0,
                balance: balance,
                inventoryCount: userInventory.length,
                nftCount: nftCount,
                referralCount: stats.referralCount || 0,
                lastSeen: user.lastSeen || new Date().toISOString(),
                createdAt: user.createdAt || new Date().toISOString(),
                inventory: userInventory.map(item => ({
                    id: item.id,
                    name: item.name,
                    image: item.image,
                    isNFT: item.isNFT || false,
                    status: item.status || 'Редкий',
                    buyerNumber: item.buyerNumber,
                    convertedPrice: item.convertedPrice,
                    paymentMethod: item.paymentMethod,
                    createdAt: item.createdAt,
                    nftModel: item.nftModel,
                    nftBackground: item.nftBackground
                }))
            };
        }).sort((a, b) => b.totalSpent - a.totalSpent); // Sort by total spent

        res.json({ stats, users });
    } catch (error) {
        console.error('Error loading platform users:', error);
        res.status(500).json({ error: 'Failed to load platform users' });
    }
});

// Search users endpoint
app.get('/api/search-users', async (req, res) => {
    try {
        const query = req.query.query?.toLowerCase() || '';
        const userData = readUserData();
        const userStats = readUserStats();
        const userBalanceData = loadJSON(USER_BALANCE_FILE, {});
        const allInventory = loadJSON(INVENTORY_FILE, []);

        const users = Object.entries(userData)
            .filter(([userId, user]) => {
                return userId.includes(query) ||
                       (user.username && user.username.toLowerCase().includes(query)) ||
                       (user.firstName && user.firstName.toLowerCase().includes(query));
            })
            .map(([userId, user]) => {
                const stats = userStats[userId] || {};
                const balance = userBalanceData[userId] || 0;
                const userInventory = allInventory.filter(item => item.userId === parseInt(userId));
                const nftCount = userInventory.filter(item => item.isNFT).length;

                return {
                    userId: parseInt(userId),
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    totalPurchases: stats.totalPurchases || 0,
                    totalSpent: stats.totalSpent || 0,
                    balance: balance,
                    inventoryCount: userInventory.length,
                    nftCount: nftCount,
                    referralCount: stats.referralCount || 0,
                    lastSeen: user.lastSeen || new Date().toISOString(),
                    createdAt: user.createdAt || new Date().toISOString(),
                    inventory: userInventory.map(item => ({
                        id: item.id,
                        name: item.name,
                        image: item.image,
                        isNFT: item.isNFT || false,
                        status: item.status || 'Редкий',
                        buyerNumber: item.buyerNumber,
                        convertedPrice: item.convertedPrice,
                        paymentMethod: item.paymentMethod,
                        createdAt: item.createdAt,
                        nftModel: item.nftModel,
                        nftBackground: item.nftBackground
                    }))
                };
            });

        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Admin gift transfer endpoint
app.post('/api/admin-gift-transfer', async (req, res) => {
  const { userId, itemId, comment, adminId, adminUsername } = req.body;

  try {
    if (!userId || !itemId) {
      return res.status(400).json({ error: 'Отсутствуют обязательные данные' });
    }

    // Get item details
    const items = await getAllItems();
    const item = items.find(nft => nft.id === itemId);

    if (!item) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // Calculate unique gift number
    const existingActivity = loadJSON(ACTIVITY_FILE, []);
    const giftNumber = existingActivity.length + 1;

    // Create inventory item for the user
    const inventoryData = {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price || 0,
      convertedPrice: 0, // Free gift from admin
      prices: item.prices || {},
      quantity: item.quantity || 'x1',
      owner: `ID: ${userId}`,
      userId: userId,
      username: `user_${userId}`, // Will be updated when user logs in
      status: item.status || 'Редкий',
      buyerNumber: giftNumber,
      comment: comment,
      transferDate: new Date().toISOString(),
      fromUsername: `Admin: ${adminUsername}`,
      isAdminGift: true
    };

    await addToInventory(inventoryData);

    // Add to activity
    const activityData = {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price || 0,
      convertedPrice: 0,
      paymentMethod: 'ADMIN_GIFT',
      userId: userId,
      username: `user_${userId}`,
      buyerNumber: giftNumber,
      adminGift: true,
      fromAdmin: adminUsername
    };

    await addActivity(activityData);

    console.log(`Admin gift sent: ${item.name} to user ${userId} by ${adminUsername}`);

    // Try to send notification if user exists in bot
    const message = `🎁 <b>Вы получили подарок от администрации!</b>\n\n` +
      `📦 Подарок: ${item.name}\n` +
      `👨‍💼 От: ${adminUsername} (Администратор)\n` +
      `💬 Комментарий: ${comment || 'Без комментария'}\n\n` +
      `Подарок добавлен в ваш инвентарь!`;

    sendTelegramMessage(userId, message).catch(error => {
      console.log(`Could not send notification to user ${userId} (user may not have started bot yet)`);
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error sending admin gift:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Admin approval endpoints
app.post('/api/payment-request/:id/approve', async (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  try {
    request.status = 'approved';

    const items = loadData();
    const item = items.find(nft => nft.id === request.itemId);

    if (item && item.stock > 0) {
      item.stock -= 1;
      if (item.stock === 0) {
        const newItems = items.filter(nft => nft.id !== request.itemId);
        saveData(newItems);
      } else {
        saveData(items);
      }

      // Calculate unique gift number - каждый подарок получает уникальный возрастающий номер
      const existingActivity = loadJSON(ACTIVITY_FILE, []);
      const giftNumber = existingActivity.length + 1;

      // Add to activity and inventory
      const activityEntry = {
        id: request.itemId,
        name: request.itemName,
        image: request.itemImage,
        price: request.price,
        convertedPrice: request.convertedPrice,
        paymentMethod: request.paymentMethod,
        userId: request.userId,
        username: request.username,
        buyerNumber: giftNumber
      };

      const inventoryData = {
        id: request.itemId,
        name: request.itemName,
        image: request.itemImage,
        price: request.price,
        convertedPrice: request.convertedPrice,
        paymentMethod: request.paymentMethod,
        quantity: item.quantity,
        owner: 'UQDy...liDW',
        userId: request.userId,
        username: request.username,
        status: 'Редкий',
        buyerNumber: giftNumber
      };

      await addActivity(activityEntry);
      await addToInventory(inventoryData);
      await updateUserStats(request.userId, request.username, { price: request.price, convertedPrice: request.convertedPrice });
    }

    saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);
    res.json({ success: true });

  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/topup-request/:id/approve', async (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId && r.type === 'stars_topup');

  if (!request) {
    return res.status(404).json({ error: 'Top up request not found' });
  }

  try {
    request.status = 'approved';
    saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

    // Update user balance
    const currentBalance = await getUserBalance(request.userId);
    const newBalance = currentBalance + request.amount;
    await updateUserBalance(request.userId, newBalance, request.username);

    // Send notification
    const message = `💰 <b>Пополнение баланса подтверждено!</b>\n\n` +
      `⭐ Начислено: ${request.amount} Stars\n` +
      `💳 Текущий баланс: ${newBalance} Stars\n\n` +
      `Теперь вы можете покупать подарки с баланса! 🎁`;

    sendTelegramMessage(request.userId, message);

    res.json({ success: true });

  } catch (error) {
    console.error('Error approving top up:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/payment-request/:id/reject', (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  request.status = 'rejected';
  saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsData);

  res.json({ success: true });
});

// NFT Upgrade endpoints
app.post('/api/upgrade-to-nft', async (req, res) => {
  const { userId, inventoryId, requiredStars } = req.body;

  console.log('Upgrade to NFT request:', { userId, inventoryId, requiredStars });

  try {
    // Проверяем баланс пользователя
    const userBalance = await getBalance(userId);
    if (userBalance < requiredStars) {
      return res.status(400).json({ error: 'Недостаточно Stars' });
    }

    // Проверяем, что предмет существует в инвентаре
    const userInventory = await getInventory(userId);
    const item = userInventory.find(item => 
      item.inventoryId === inventoryId
    );

    console.log('Found item in inventory:', item);

    if (!item) {
      console.log('Item not found in inventory for user:', userId, 'inventoryId:', inventoryId);
      console.log('Available items:', userInventory.map(i => ({ inventoryId: i.inventoryId, name: i.name })));
      return res.status(404).json({ error: 'Предмет не найден в инвентаре' });
    }

    // Проверяем, что это печатная машина и она еще не NFT
    if (!item.name || !item.name.toLowerCase().includes('печатная машина')) {
      return res.status(400).json({ error: 'Улучшение в NFT доступно только для Печатной машины' });
    }

    if (item.isNFT) {
      return res.status(400).json({ error: 'Этот предмет уже является NFT' });
    }

    // Списываем Stars
    const newBalance = userBalance - requiredStars;
    await setBalance(userId, newBalance, item.username || 'user');

    // Обновляем статус предмета в инвентаре (помечаем как "оплачено для NFT")
    await updateItemInInventory(inventoryId, userId, { status: 'Pending NFT Upgrade' });

    console.log('NFT upgrade payment successful for user:', userId);

    res.json({
      success: true,
      newBalance: newBalance,
      message: 'Оплата прошла успешно'
    });

  } catch (error) {
    console.error('Error upgrading to NFT:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/update-nft-variant', async (req, res) => {
  const { userId, inventoryId, variant } = req.body;

  console.log('Update NFT variant request:', { userId, inventoryId, variant });

  try {
    // Получаем текущий инвентарь пользователя
    const userInventory = await getInventory(userId);
    const item = userInventory.find(item => 
      item.inventoryId === inventoryId
    );

    console.log('Found item for NFT update:', item);

    if (!item) {
      console.log('Item not found for NFT update. Available items:', userInventory.map(i => ({ inventoryId: i.inventoryId, name: i.name })));
      return res.status(404).json({ error: 'Предмет не найден в инвентаре' });
    }

    // Проверяем, был ли предмет уже оплачен для NFT апгрейда
    if (item.status !== 'Pending NFT Upgrade') {
      console.log('Item status is not ready for NFT upgrade:', item.status);
      return res.status(400).json({ error: 'Предмет не готов к NFT апгрейду. Сначала произведите оплату.' });
    }

    // Подготавливаем данные для обновления
    const updateData = {
      name: variant.model,
      image: variant.url,
      nftModel: variant.model,
      nftBackground: variant.background,
      model: variant.model, // Дублируем для совместимости
      background: variant.background, // Дублируем для совместимости
      isNFT: true,
      status: 'Уникальный', // Устанавливаем статус как Уникальный
      upgradeDate: new Date().toISOString()
    };

    console.log('Updating item with data:', updateData);

    // Обновляем предмет используя унифицированную функцию
    const updatedItem = await updateItemInInventory(inventoryId, userId, updateData);

    if (!updatedItem) {
      return res.status(500).json({ error: 'Не удалось обновить предмет' });
    }

    console.log('NFT variant updated successfully for user:', userId);

    // Отправляем уведомление пользователю
    const message = `✨ <b>Ваш подарок улучшен!</b>\n\n` +
      `🖼️ Подарок: ${variant.model}\n` +
      `💎 Статус: Уникальный\n\n` +
      `Теперь вы владеете уникальным цифровым активом!`;

    sendTelegramMessage(userId, message);

    res.json({
      success: true,
      message: 'NFT вариант обновлен',
      updatedItem: updatedItem
    });

  } catch (error) {
    console.error('Error updating NFT variant:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API endpoints для работы с данными пользователей

// Получить все данные пользователя
app.get('/api/user-data/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const userData = getUserData(userId);
    res.json(userData);
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить данные пользователя при входе
app.post('/api/user-login', (req, res) => {
  const { userId, username, firstName, lastName, photoUrl } = req.body;

  try {
    const updateData = {
      username: username,
      profile: {
        firstName: firstName,
        lastName: lastName,
        photoUrl: photoUrl,
        lastLogin: new Date().toISOString()
      }
    };

    const userData = updateUserData(userId, updateData);
    res.json({ success: true, userData });
  } catch (error) {
    console.error('Error updating user login data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить статистику всех пользователей (для админа)
app.get('/api/admin/users', (req, res) => {
  try {
    const allUsers = getAllUsers();
    const platformStats = getPlatformStats();

    res.json({
      users: allUsers,
      stats: platformStats
    });
  } catch (error) {
    console.error('Error getting admin users data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Поиск пользователя по username
app.get('/api/search-user/:username', (req, res) => {
  const username = req.params.username;

  try {
    const user = findUserByUsername(username);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error searching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить NFT пользователя отдельно
app.get('/api/user-nfts/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const userData = getUserData(userId);
    res.json(userData.nfts || []);
  } catch (error) {
    console.error('Error getting user NFTs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Referral system functions
function getReferrerId() {
    // Check Telegram WebApp start param first
    if (window.Telegram && window.Telegram.WebApp) {
        const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith('r_')) {
            const referrerId = startParam.substring(2);
            localStorage.setItem('referrerId', referrerId);
            return referrerId;
        }
    }

    // Check if user came from referral link in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralParam = urlParams.get('startapp');
    if (referralParam && referralParam.startsWith('r_')) {
        const referrerId = referralParam.substring(2);
        localStorage.setItem('referrerId', referralParam.substring(2));
        return referrerId;
    }

    // Return stored referrer ID
    return localStorage.getItem('referrerId');
}
