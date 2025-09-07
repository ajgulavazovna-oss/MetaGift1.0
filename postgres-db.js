
const { Pool } = require('pg');

// Создаем пул соединений с PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Инициализация базы данных и создание таблиц
async function initializePostgresDB() {
  const client = await pool.connect();
  
  try {
    console.log('Initializing PostgreSQL database...');
    
    // Создаем таблицу для товаров
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image TEXT,
        description TEXT,
        prices JSONB,
        quantity VARCHAR(50),
        stock INTEGER DEFAULT 0,
        tag VARCHAR(50),
        tag_color VARCHAR(50),
        status VARCHAR(50),
        status_color VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем таблицу активности
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity (
        id SERIAL PRIMARY KEY,
        item_id INTEGER,
        name VARCHAR(255),
        image TEXT,
        price DECIMAL(10,2),
        converted_price DECIMAL(10,2),
        prices JSONB,
        payment_method VARCHAR(50),
        user_id BIGINT,
        username VARCHAR(255),
        buyer_number INTEGER UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_str VARCHAR(50),
        time_str VARCHAR(50)
      )
    `);
    
    // Создаем таблицу инвентаря
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        inventory_id VARCHAR(100) PRIMARY KEY,
        item_id INTEGER,
        name VARCHAR(255),
        image TEXT,
        price DECIMAL(10,2),
        converted_price DECIMAL(10,2),
        prices JSONB,
        payment_method VARCHAR(50),
        quantity VARCHAR(50),
        owner VARCHAR(255),
        user_id BIGINT,
        username VARCHAR(255),
        status VARCHAR(50),
        buyer_number INTEGER,
        comment TEXT,
        transfer_date TIMESTAMP,
        from_username VARCHAR(255),
        original_owner VARCHAR(255),
        nft_model VARCHAR(255),
        nft_background VARCHAR(255),
        is_nft BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем таблицу балансов пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_balance (
        user_id BIGINT PRIMARY KEY,
        stars INTEGER DEFAULT 0,
        username VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем таблицу статистики пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id BIGINT PRIMARY KEY,
        total_purchases INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        referral_count INTEGER DEFAULT 0,
        referral_earnings DECIMAL(10,2) DEFAULT 0,
        username VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем таблицу запросов на оплату
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id VARCHAR(100) PRIMARY KEY,
        item_id INTEGER,
        user_id BIGINT,
        username VARCHAR(255),
        price DECIMAL(10,2),
        converted_price DECIMAL(10,2),
        payment_method VARCHAR(50),
        item_name VARCHAR(255),
        item_image TEXT,
        referrer_id BIGINT,
        status VARCHAR(50) DEFAULT 'pending',
        type VARCHAR(50) DEFAULT 'purchase',
        amount INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем таблицу рефералов
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id BIGINT,
        referred_id BIGINT,
        referrer_username VARCHAR(255),
        referred_username VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(referrer_id, referred_id)
      )
    `);
    
    console.log('PostgreSQL database initialized successfully');
    
    // Проверяем, есть ли данные в таблице items, если нет - добавляем начальные данные
    const itemsCount = await client.query('SELECT COUNT(*) FROM items');
    if (parseInt(itemsCount.rows[0].count) === 0) {
      console.log('Adding initial item data...');
      await client.query(`
        INSERT INTO items (name, image, description, prices, quantity, stock, tag, tag_color, status, status_color)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        'Печатная машина',
        'https://i.postimg.cc/d0gX8mXg/IMG-1232.png',
        'Подарок который можно будет конвертировать в NFT',
        JSON.stringify({ TON: 1, STARS: 100, RUB: 500 }),
        '1',
        4980,
        'NEW',
        'top',
        'Редкий',
        'limited'
      ]);
    }
    
    // Мигрируем данные из JSON файлов
    await migrateDataFromJSON(client);
    
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Функция для миграции данных из JSON файлов
async function migrateDataFromJSON(client) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Мигрируем инвентарь
    const inventoryPath = path.join(__dirname, 'inventory.json');
    if (fs.existsSync(inventoryPath)) {
      const inventoryData = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
      console.log(`Migrating ${inventoryData.length} inventory items...`);
      
      for (const item of inventoryData) {
        const inventoryId = item.inventoryId || (Date.now() + Math.random()).toString();
        await client.query(`
          INSERT INTO inventory (
            inventory_id, item_id, name, image, price, converted_price, prices, 
            payment_method, quantity, owner, user_id, username, status, buyer_number,
            comment, transfer_date, from_username, original_owner, nft_model, 
            nft_background, is_nft
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (inventory_id) DO NOTHING
        `, [
          inventoryId,
          item.id,
          item.name,
          item.image,
          item.price || 0,
          item.convertedPrice || item.price || 0,
          JSON.stringify(item.prices || {}),
          item.paymentMethod || 'STARS',
          item.quantity || '1',
          item.owner || '',
          item.userId,
          item.username || '',
          item.status || 'Редкий',
          item.buyerNumber || 1,
          item.comment,
          item.transferDate,
          item.fromUsername,
          item.originalOwner,
          item.nftModel,
          item.nftBackground,
          item.isNFT || false
        ]);
      }
      console.log('Inventory migration completed');
    }
    
    // Мигрируем активность
    const activityPath = path.join(__dirname, 'activity.json');
    if (fs.existsSync(activityPath)) {
      const activityData = JSON.parse(fs.readFileSync(activityPath, 'utf8'));
      console.log(`Migrating ${activityData.length} activity items...`);
      
      for (const item of activityData) {
        await client.query(`
          INSERT INTO activity (item_id, name, image, price, converted_price, prices, payment_method, user_id, username, buyer_number, date_str, time_str)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT DO NOTHING
        `, [
          item.id,
          item.name,
          item.image,
          item.price || 0,
          item.convertedPrice || item.price || 0,
          JSON.stringify(item.prices || {}),
          item.paymentMethod || 'STARS',
          item.userId,
          item.username || '',
          item.buyerNumber || 1,
          item.date || '',
          item.time || ''
        ]);
      }
      console.log('Activity migration completed');
    }
    
    // Мигрируем балансы пользователей
    const balancePath = path.join(__dirname, 'user-balance.json');
    if (fs.existsSync(balancePath)) {
      const balanceData = JSON.parse(fs.readFileSync(balancePath, 'utf8'));
      console.log(`Migrating ${Object.keys(balanceData).length} user balances...`);
      
      for (const [userId, data] of Object.entries(balanceData)) {
        await client.query(`
          INSERT INTO user_balance (user_id, stars, username, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id) DO UPDATE SET 
            stars = $2, username = $3, updated_at = CURRENT_TIMESTAMP
        `, [parseInt(userId), data.stars || 0, data.username || '']);
      }
      console.log('User balance migration completed');
    }
    
    // Мигрируем статистику пользователей
    const statsPath = path.join(__dirname, 'user-stats.json');
    if (fs.existsSync(statsPath)) {
      const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      console.log(`Migrating ${Object.keys(statsData).length} user stats...`);
      
      for (const [userId, data] of Object.entries(statsData)) {
        await client.query(`
          INSERT INTO user_stats (user_id, total_purchases, total_spent, referral_count, referral_earnings, username, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id) DO UPDATE SET 
            total_purchases = $2, total_spent = $3, referral_count = $4, referral_earnings = $5, username = $6, updated_at = CURRENT_TIMESTAMP
        `, [
          parseInt(userId), 
          data.totalPurchases || 0, 
          data.totalSpent || 0, 
          data.referralCount || 0, 
          data.referralEarnings || 0, 
          data.username || ''
        ]);
      }
      console.log('User stats migration completed');
    }
    
  } catch (error) {
    console.error('Error migrating data from JSON:', error);
  }
}

// Функции для работы с товарами
async function getAllItemsFromPG() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM items ORDER BY id');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      image: row.image,
      description: row.description,
      prices: row.prices,
      quantity: row.quantity,
      stock: row.stock,
      tag: row.tag,
      tagColor: row.tag_color,
      status: row.status,
      statusColor: row.status_color
    }));
  } finally {
    client.release();
  }
}

// Функции для работы с балансом пользователей
async function getUserBalanceFromPG(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT stars FROM user_balance WHERE user_id = $1', [userId]);
    return result.rows.length > 0 ? result.rows[0].stars : 0;
  } finally {
    client.release();
  }
}

async function updateUserBalanceInPG(userId, stars, username) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO user_balance (user_id, stars, username, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET stars = $2, username = $3, updated_at = CURRENT_TIMESTAMP
    `, [userId, stars, username]);
  } finally {
    client.release();
  }
}

// Функции для работы с активностью
async function addActivityToPG(activityData) {
  const client = await pool.connect();
  try {
    const date = new Date();
    const dateStr = date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    await client.query(`
      INSERT INTO activity (item_id, name, image, price, converted_price, prices, payment_method, user_id, username, buyer_number, date_str, time_str)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      activityData.id,
      activityData.name,
      activityData.image,
      activityData.price,
      activityData.convertedPrice || activityData.price,
      JSON.stringify(activityData.prices),
      activityData.paymentMethod,
      activityData.userId,
      activityData.username,
      activityData.buyerNumber,
      dateStr,
      timeStr
    ]);
  } finally {
    client.release();
  }
}

async function getAllActivityFromPG() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM activity 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    return result.rows.map(row => ({
      id: row.item_id,
      name: row.name,
      image: row.image,
      price: parseFloat(row.price),
      convertedPrice: parseFloat(row.converted_price),
      prices: row.prices,
      paymentMethod: row.payment_method,
      userId: row.user_id,
      username: row.username,
      buyerNumber: row.buyer_number,
      date: row.date_str,
      time: row.time_str
    }));
  } finally {
    client.release();
  }
}

// Функции для работы с инвентарем
async function addToInventoryPG(inventoryData) {
  const client = await pool.connect();
  try {
    const inventoryId = Date.now() + Math.random().toString();
    await client.query(`
      INSERT INTO inventory (
        inventory_id, item_id, name, image, price, converted_price, prices, 
        payment_method, quantity, owner, user_id, username, status, buyer_number,
        comment, transfer_date, from_username, original_owner, nft_model, 
        nft_background, is_nft
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    `, [
      inventoryId,
      inventoryData.id,
      inventoryData.name,
      inventoryData.image,
      inventoryData.price,
      inventoryData.convertedPrice || inventoryData.price,
      JSON.stringify(inventoryData.prices),
      inventoryData.paymentMethod,
      inventoryData.quantity,
      inventoryData.owner,
      inventoryData.userId,
      inventoryData.username,
      inventoryData.status || 'Редкий',
      inventoryData.buyerNumber,
      inventoryData.comment,
      inventoryData.transferDate,
      inventoryData.fromUsername,
      inventoryData.originalOwner,
      inventoryData.nftModel,
      inventoryData.nftBackground,
      inventoryData.isNFT || false
    ]);
    
    console.log(`Добавлен предмет в инвентарь: ${inventoryData.name} для пользователя ${inventoryData.userId}`);
  } finally {
    client.release();
  }
}

async function getUserInventoryFromPG(userId) {
  if (!userId || isNaN(userId) || userId <= 0) {
    console.log('Invalid userId provided to getUserInventoryFromPG:', userId);
    return [];
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM inventory WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    
    return result.rows.map(row => ({
      inventoryId: row.inventory_id,
      id: row.item_id,
      name: row.name,
      image: row.image,
      price: parseFloat(row.price),
      convertedPrice: parseFloat(row.converted_price),
      prices: row.prices,
      quantity: row.quantity,
      owner: row.owner,
      userId: row.user_id,
      username: row.username,
      status: row.status,
      buyerNumber: row.buyer_number,
      comment: row.comment,
      transferDate: row.transfer_date,
      fromUsername: row.from_username,
      originalOwner: row.original_owner,
      nftModel: row.nft_model,
      nftBackground: row.nft_background,
      isNFT: row.is_nft,
      createdAt: row.created_at
    }));
  } finally {
    client.release();
  }
}

async function removeFromInventoryPG(inventoryId, userId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM inventory WHERE inventory_id = $1 AND user_id = $2', [inventoryId, userId]);
    console.log(`Удален предмет из инвентаря: ID ${inventoryId} для пользователя ${userId}`);
    return true;
  } finally {
    client.release();
  }
}

async function updateInventoryItemPG(inventoryId, userId, updateData) {
  const client = await pool.connect();
  try {
    const setFields = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updateData)) {
      const columnMap = {
        name: 'name',
        image: 'image',
        status: 'status',
        nftModel: 'nft_model',
        nftBackground: 'nft_background',
        isNFT: 'is_nft',
        upgradeDate: 'updated_at'
      };
      
      const column = columnMap[key] || key;
      setFields.push(`${column} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    
    if (setFields.length === 0) return false;
    
    values.push(inventoryId, userId);
    const query = `
      UPDATE inventory 
      SET ${setFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE inventory_id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;
    
    const result = await client.query(query, values);
    
    if (result.rows.length > 0) {
      console.log(`Обновлен предмет в инвентаре: ID ${inventoryId} для пользователя ${userId}`);
      return result.rows[0];
    }
    
    return false;
  } finally {
    client.release();
  }
}

// Функции для работы со статистикой пользователей
async function updateUserStatsInPG(userId, username, purchaseData) {
  const client = await pool.connect();
  try {
    const spentAmount = purchaseData.convertedPrice || (purchaseData.price ? Math.ceil(purchaseData.price * 100) : 0);
    
    await client.query(`
      INSERT INTO user_stats (user_id, total_purchases, total_spent, username, updated_at)
      VALUES ($1, 1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        total_purchases = user_stats.total_purchases + 1,
        total_spent = user_stats.total_spent + $2,
        username = $3,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, spentAmount, username]);
  } finally {
    client.release();
  }
}

async function getUserStatsFromPG(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        totalPurchases: row.total_purchases,
        totalSpent: parseFloat(row.total_spent),
        referralCount: row.referral_count,
        referralEarnings: parseFloat(row.referral_earnings),
        username: row.username
      };
    }
    return {
      totalPurchases: 0,
      totalSpent: 0,
      referralCount: 0,
      referralEarnings: 0
    };
  } finally {
    client.release();
  }
}

// Функции для работы с рефералами
async function addReferralPG(referrerId, referredId, referrerUsername, referredUsername) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO referrals (referrer_id, referred_id, referrer_username, referred_username)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (referrer_id, referred_id) DO NOTHING
    `, [referrerId, referredId, referrerUsername, referredUsername]);
    console.log(`Referral added: ${referrerUsername} -> ${referredUsername}`);
  } finally {
    client.release();
  }
}

async function getReferralCountPG(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT COUNT(*) FROM referrals WHERE referrer_id = $1', [userId]);
    return parseInt(result.rows[0].count);
  } finally {
    client.release();
  }
}

// Экспортируем все функции
module.exports = {
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
  getReferralCountPG,
  pool
};
