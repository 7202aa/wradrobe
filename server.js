const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const Database = require('better-sqlite3');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 确保数据库目录存在
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 初始化数据库
const db = new Database(path.join(dbDir, 'wardrobe.db'));

// 创建衣物表
db.exec(`
    CREATE TABLE IF NOT EXISTS wardrobe_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        color TEXT NOT NULL,
        brand TEXT DEFAULT '未知品牌',
        price REAL DEFAULT 0,
        seasons TEXT NOT NULL,
        purchase_date TEXT,
        image TEXT,
        notes TEXT,
        platform TEXT DEFAULT '未记录',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 创建穿搭记录表
db.exec(`
    CREATE TABLE IF NOT EXISTS outfit_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        image TEXT,
        season TEXT NOT NULL,
        style TEXT NOT NULL,
        scene TEXT NOT NULL,
        items TEXT,
        notes TEXT,
        rating INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 创建灵感表
db.exec(`
    CREATE TABLE IF NOT EXISTS inspiration_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image TEXT NOT NULL,
        description TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 创建索引以提高查询性能
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_category ON wardrobe_items(category);
    CREATE INDEX IF NOT EXISTS idx_color ON wardrobe_items(color);
    CREATE INDEX IF NOT EXISTS idx_wardrobe_created_at ON wardrobe_items(created_at);
    CREATE INDEX IF NOT EXISTS idx_outfit_date ON outfit_records(date);
    CREATE INDEX IF NOT EXISTS idx_outfit_season ON outfit_records(season);
    CREATE INDEX IF NOT EXISTS idx_outfit_style ON outfit_records(style);
    CREATE INDEX IF NOT EXISTS idx_outfit_scene ON outfit_records(scene);
`);

console.log('✅ 数据库初始化成功');

// ==================== API 路由 ====================

// 获取所有衣物
app.get('/api/items', (req, res) => {
    try {
        const { category, color, season, search } = req.query;
        let query = 'SELECT * FROM wardrobe_items WHERE 1=1';
        const params = [];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        if (color) {
            query += ' AND color = ?';
            params.push(color);
        }

        if (season) {
            query += ' AND seasons LIKE ?';
            params.push(`%${season}%`);
        }

        if (search) {
            query += ' AND (name LIKE ? OR brand LIKE ? OR notes LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY created_at DESC';

        const stmt = db.prepare(query);
        const items = stmt.all(...params);

        // 解析 seasons 字段
        const parsedItems = items.map(item => ({
            ...item,
            seasons: JSON.parse(item.seasons)
        }));

        res.json({
            success: true,
            data: parsedItems,
            count: parsedItems.length
        });
    } catch (error) {
        console.error('获取衣物列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取衣物列表失败',
            error: error.message
        });
    }
});

// 获取单个衣物详情
app.get('/api/items/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('SELECT * FROM wardrobe_items WHERE id = ?');
        const item = stmt.get(id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: '衣物不存在'
            });
        }

        item.seasons = JSON.parse(item.seasons);

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('获取衣物详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取衣物详情失败',
            error: error.message
        });
    }
});

// 添加衣物
app.post('/api/items', (req, res) => {
    try {
        const {
            name,
            category,
            color,
            brand = '未知品牌',
            price = 0,
            seasons = ['all-season'],
            purchase_date,
            image,
            notes = '',
            platform = '未记录'
        } = req.body;

        // 验证必填字段
        if (!name || !category || !color) {
            return res.status(400).json({
                success: false,
                message: '缺少必填字段: name, category, color'
            });
        }

        const stmt = db.prepare(`
            INSERT INTO wardrobe_items 
            (name, category, color, brand, price, seasons, purchase_date, image, notes, platform)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            name,
            category,
            color,
            brand,
            price,
            JSON.stringify(seasons),
            purchase_date,
            image,
            notes,
            platform
        );

        const newItem = db.prepare('SELECT * FROM wardrobe_items WHERE id = ?').get(result.lastInsertRowid);
        newItem.seasons = JSON.parse(newItem.seasons);

        res.status(201).json({
            success: true,
            message: '添加成功',
            data: newItem
        });
    } catch (error) {
        console.error('添加衣物失败:', error);
        res.status(500).json({
            success: false,
            message: '添加衣物失败',
            error: error.message
        });
    }
});

// 更新衣物
app.put('/api/items/:id', (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            category,
            color,
            brand,
            price,
            seasons,
            purchase_date,
            image,
            notes,
            platform
        } = req.body;

        // 检查衣物是否存在
        const exists = db.prepare('SELECT id FROM wardrobe_items WHERE id = ?').get(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: '衣物不存在'
            });
        }

        const stmt = db.prepare(`
            UPDATE wardrobe_items 
            SET name = ?, category = ?, color = ?, brand = ?, price = ?, 
                seasons = ?, purchase_date = ?, image = ?, notes = ?, platform = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            name,
            category,
            color,
            brand,
            price,
            JSON.stringify(seasons),
            purchase_date,
            image,
            notes,
            platform,
            id
        );

        const updatedItem = db.prepare('SELECT * FROM wardrobe_items WHERE id = ?').get(id);
        updatedItem.seasons = JSON.parse(updatedItem.seasons);

        res.json({
            success: true,
            message: '更新成功',
            data: updatedItem
        });
    } catch (error) {
        console.error('更新衣物失败:', error);
        res.status(500).json({
            success: false,
            message: '更新衣物失败',
            error: error.message
        });
    }
});

// 删除衣物
app.delete('/api/items/:id', (req, res) => {
    try {
        const { id } = req.params;

        // 检查衣物是否存在
        const exists = db.prepare('SELECT id FROM wardrobe_items WHERE id = ?').get(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: '衣物不存在'
            });
        }

        const stmt = db.prepare('DELETE FROM wardrobe_items WHERE id = ?');
        stmt.run(id);

        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除衣物失败:', error);
        res.status(500).json({
            success: false,
            message: '删除衣物失败',
            error: error.message
        });
    }
});

// 获取统计信息
app.get('/api/statistics', (req, res) => {
    try {
        // 总数
        const totalStmt = db.prepare('SELECT COUNT(*) as total FROM wardrobe_items');
        const { total } = totalStmt.get();

        // 类别分布
        const categoryStmt = db.prepare(`
            SELECT category, COUNT(*) as count 
            FROM wardrobe_items 
            GROUP BY category
        `);
        const categoryDistribution = categoryStmt.all();

        // 颜色分布
        const colorStmt = db.prepare(`
            SELECT color, COUNT(*) as count 
            FROM wardrobe_items 
            GROUP BY color
        `);
        const colorDistribution = colorStmt.all();

        // 最贵的衣物
        const expensiveStmt = db.prepare(`
            SELECT name, price 
            FROM wardrobe_items 
            ORDER BY price DESC 
            LIMIT 1
        `);
        const mostExpensive = expensiveStmt.get();

        // 本月新增
        const monthStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM wardrobe_items 
            WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now')
        `);
        const { count: monthAdded } = monthStmt.get();

        res.json({
            success: true,
            data: {
                total,
                categoryDistribution,
                colorDistribution,
                mostExpensive,
                monthAdded
            }
        });
    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            error: error.message
        });
    }
});

// 批量导入数据 (用于从 localStorage 迁移)
app.post('/api/items/batch', (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: '无效的数据格式'
            });
        }

        const stmt = db.prepare(`
            INSERT INTO wardrobe_items 
            (name, category, color, brand, price, seasons, purchase_date, image, notes, platform)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                stmt.run(
                    item.name,
                    item.category,
                    item.color,
                    item.brand || '未知品牌',
                    item.price || 0,
                    JSON.stringify(item.seasons || ['all-season']),
                    item.purchaseDate || item.purchase_date,
                    item.image,
                    item.notes || '',
                    item.platform || '未记录'
                );
            }
        });

        insertMany(items);

        res.json({
            success: true,
            message: `成功导入 ${items.length} 条数据`
        });
    } catch (error) {
        console.error('批量导入失败:', error);
        res.status(500).json({
            success: false,
            message: '批量导入失败',
            error: error.message
        });
    }
});

// ==================== 穿搭记录 API ====================

// 获取所有穿搭记录
app.get('/api/outfits', (req, res) => {
    try {
        const { season, style, search } = req.query;
        let query = 'SELECT * FROM outfit_records WHERE 1=1';
        const params = [];

        if (season) {
            query += ' AND season = ?';
            params.push(season);
        }

        if (style) {
            query += ' AND style = ?';
            params.push(style);
        }

        if (search) {
            query += ' AND (items LIKE ? OR notes LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ' ORDER BY date DESC, created_at DESC';

        const stmt = db.prepare(query);
        const records = stmt.all(...params);

        res.json({
            success: true,
            data: records,
            count: records.length
        });
    } catch (error) {
        console.error('获取穿搭记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取穿搭记录失败',
            error: error.message
        });
    }
});

// 获取单条穿搭记录
app.get('/api/outfits/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('SELECT * FROM outfit_records WHERE id = ?');
        const record = stmt.get(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }

        res.json({
            success: true,
            data: record
        });
    } catch (error) {
        console.error('获取穿搭记录详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取穿搭记录详情失败',
            error: error.message
        });
    }
});

// 添加穿搭记录
app.post('/api/outfits', (req, res) => {
    try {
        const {
            date,
            image,
            season,
            style,
            scene,
            items = '',
            notes = '',
            rating = 0
        } = req.body;

        // 验证必填字段
        if (!date || !season || !style || !scene) {
            return res.status(400).json({
                success: false,
                message: '缺少必填字段: date, season, style, scene'
            });
        }

        const stmt = db.prepare(`
            INSERT INTO outfit_records 
            (date, image, season, style, scene, items, notes, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(date, image, season, style, scene, items, notes, rating);

        const newRecord = db.prepare('SELECT * FROM outfit_records WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: '添加成功',
            data: newRecord
        });
    } catch (error) {
        console.error('添加穿搭记录失败:', error);
        res.status(500).json({
            success: false,
            message: '添加穿搭记录失败',
            error: error.message
        });
    }
});

// 更新穿搭记录
app.put('/api/outfits/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { date, image, season, style, scene, items, notes, rating } = req.body;

        const exists = db.prepare('SELECT id FROM outfit_records WHERE id = ?').get(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }

        const stmt = db.prepare(`
            UPDATE outfit_records 
            SET date = ?, image = ?, season = ?, style = ?, scene = ?, 
                items = ?, notes = ?, rating = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(date, image, season, style, scene, items, notes, rating, id);

        const updatedRecord = db.prepare('SELECT * FROM outfit_records WHERE id = ?').get(id);

        res.json({
            success: true,
            message: '更新成功',
            data: updatedRecord
        });
    } catch (error) {
        console.error('更新穿搭记录失败:', error);
        res.status(500).json({
            success: false,
            message: '更新穿搭记录失败',
            error: error.message
        });
    }
});

// 删除穿搭记录
app.delete('/api/outfits/:id', (req, res) => {
    try {
        const { id } = req.params;

        const exists = db.prepare('SELECT id FROM outfit_records WHERE id = ?').get(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }

        const stmt = db.prepare('DELETE FROM outfit_records WHERE id = ?');
        stmt.run(id);

        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除穿搭记录失败:', error);
        res.status(500).json({
            success: false,
            message: '删除穿搭记录失败',
            error: error.message
        });
    }
});

// 批量导入穿搭记录
app.post('/api/outfits/batch', (req, res) => {
    try {
        const { records } = req.body;

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                success: false,
                message: '无效的数据格式'
            });
        }

        const stmt = db.prepare(`
            INSERT INTO outfit_records 
            (date, image, season, style, scene, items, notes, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((records) => {
            for (const record of records) {
                stmt.run(
                    record.date,
                    record.image,
                    record.season,
                    record.style,
                    record.scene,
                    record.items || '',
                    record.notes || '',
                    record.rating || 0
                );
            }
        });

        insertMany(records);

        res.json({
            success: true,
            message: `成功导入 ${records.length} 条记录`
        });
    } catch (error) {
        console.error('批量导入穿搭记录失败:', error);
        res.status(500).json({
            success: false,
            message: '批量导入失败',
            error: error.message
        });
    }
});

// ==================== 灵感 API ====================

// 获取所有灵感
app.get('/api/inspirations', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM inspiration_list ORDER BY created_at DESC');
        const inspirations = stmt.all();

        // 解析 tags 字段
        const parsedInspirations = inspirations.map(item => ({
            ...item,
            tags: item.tags ? JSON.parse(item.tags) : []
        }));

        res.json({
            success: true,
            data: parsedInspirations,
            count: parsedInspirations.length
        });
    } catch (error) {
        console.error('获取灵感列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取灵感列表失败',
            error: error.message
        });
    }
});

// 获取单个灵感
app.get('/api/inspirations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('SELECT * FROM inspiration_list WHERE id = ?');
        const inspiration = stmt.get(id);

        if (!inspiration) {
            return res.status(404).json({
                success: false,
                message: '灵感不存在'
            });
        }

        inspiration.tags = inspiration.tags ? JSON.parse(inspiration.tags) : [];

        res.json({
            success: true,
            data: inspiration
        });
    } catch (error) {
        console.error('获取灵感详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取灵感详情失败',
            error: error.message
        });
    }
});

// 添加灵感
app.post('/api/inspirations', (req, res) => {
    try {
        const { title, image, description = '', tags = [] } = req.body;

        // 验证必填字段
        if (!title || !image) {
            return res.status(400).json({
                success: false,
                message: '缺少必填字段: title, image'
            });
        }

        const stmt = db.prepare(`
            INSERT INTO inspiration_list (title, image, description, tags)
            VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(title, image, description, JSON.stringify(tags));

        const newInspiration = db.prepare('SELECT * FROM inspiration_list WHERE id = ?').get(result.lastInsertRowid);
        newInspiration.tags = JSON.parse(newInspiration.tags);

        res.status(201).json({
            success: true,
            message: '添加成功',
            data: newInspiration
        });
    } catch (error) {
        console.error('添加灵感失败:', error);
        res.status(500).json({
            success: false,
            message: '添加灵感失败',
            error: error.message
        });
    }
});

// 更新灵感
app.put('/api/inspirations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, image, description, tags } = req.body;

        const exists = db.prepare('SELECT id FROM inspiration_list WHERE id = ?').get(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: '灵感不存在'
            });
        }

        const stmt = db.prepare(`
            UPDATE inspiration_list 
            SET title = ?, image = ?, description = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(title, image, description, JSON.stringify(tags), id);

        const updatedInspiration = db.prepare('SELECT * FROM inspiration_list WHERE id = ?').get(id);
        updatedInspiration.tags = JSON.parse(updatedInspiration.tags);

        res.json({
            success: true,
            message: '更新成功',
            data: updatedInspiration
        });
    } catch (error) {
        console.error('更新灵感失败:', error);
        res.status(500).json({
            success: false,
            message: '更新灵感失败',
            error: error.message
        });
    }
});

// 删除灵感
app.delete('/api/inspirations/:id', (req, res) => {
    try {
        const { id } = req.params;

        const exists = db.prepare('SELECT id FROM inspiration_list WHERE id = ?').get(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: '灵感不存在'
            });
        }

        const stmt = db.prepare('DELETE FROM inspiration_list WHERE id = ?');
        stmt.run(id);

        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除灵感失败:', error);
        res.status(500).json({
            success: false,
            message: '删除灵感失败',
            error: error.message
        });
    }
});

// 批量导入灵感
app.post('/api/inspirations/batch', (req, res) => {
    try {
        const { inspirations } = req.body;

        if (!Array.isArray(inspirations) || inspirations.length === 0) {
            return res.status(400).json({
                success: false,
                message: '无效的数据格式'
            });
        }

        const stmt = db.prepare(`
            INSERT INTO inspiration_list (title, image, description, tags)
            VALUES (?, ?, ?, ?)
        `);

        const insertMany = db.transaction((inspirations) => {
            for (const item of inspirations) {
                stmt.run(
                    item.title,
                    item.image,
                    item.description || '',
                    JSON.stringify(item.tags || [])
                );
            }
        });

        insertMany(inspirations);

        res.json({
            success: true,
            message: `成功导入 ${inspirations.length} 条灵感`
        });
    } catch (error) {
        console.error('批量导入灵感失败:', error);
        res.status(500).json({
            success: false,
            message: '批量导入失败',
            error: error.message
        });
    }
});

// 获取穿搭统计信息
app.get('/api/outfit-statistics', (req, res) => {
    try {
        // 总记录数
        const totalStmt = db.prepare('SELECT COUNT(*) as total FROM outfit_records');
        const { total } = totalStmt.get();

        // 灵感总数
        const inspirationStmt = db.prepare('SELECT COUNT(*) as total FROM inspiration_list');
        const { total: inspirationTotal } = inspirationStmt.get();

        // 风格分布
        const styleStmt = db.prepare(`
            SELECT style, COUNT(*) as count 
            FROM outfit_records 
            GROUP BY style
        `);
        const styleDistribution = styleStmt.all();

        // 场景分布
        const sceneStmt = db.prepare(`
            SELECT scene, COUNT(*) as count 
            FROM outfit_records 
            GROUP BY scene
        `);
        const sceneDistribution = sceneStmt.all();

        // 本月穿搭
        const monthStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM outfit_records 
            WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
        `);
        const { count: monthRecords } = monthStmt.get();

        // 最近7天趋势
        const trendStmt = db.prepare(`
            SELECT date, COUNT(*) as count 
            FROM outfit_records 
            WHERE date >= date('now', '-7 days')
            GROUP BY date
            ORDER BY date ASC
        `);
        const trend = trendStmt.all();

        res.json({
            success: true,
            data: {
                total,
                inspirationTotal,
                monthRecords,
                styleDistribution,
                sceneDistribution,
                trend
            }
        });
    } catch (error) {
        console.error('获取穿搭统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            error: error.message
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString()
    });
});

// 首页重定向到 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在'
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: err.message
    });
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    db.close();
    process.exit(0);
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     🎉 电子衣柜后端服务启动成功!                   ║
║                                                   ║
║     🌐 访问地址: http://localhost:${PORT}         ║
║     📊 API 文档: http://localhost:${PORT}/api     ║
║     💾 数据库: SQLite (${path.join(dbDir, 'wardrobe.db')})
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});
