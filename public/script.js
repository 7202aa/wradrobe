// API 配置
const API_BASE_URL = window.location.origin + '/api';

// 数据存储
let wardrobeItems = [];
let currentDetailId = null;
let currentImageData = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initImageUpload();
    initEventListeners();
    loadItemsFromServer();
});

// ==================== API 调用函数 ====================

// 从服务器加载数据
async function loadItemsFromServer() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/items`);
        const result = await response.json();
        
        if (result.success) {
            wardrobeItems = result.data;
            renderAllItems();
            updateStatistics();
            showToast('数据加载成功!');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        showToast('加载数据失败,请检查网络连接', 'error');
    } finally {
        showLoading(false);
    }
}

// 添加衣物到服务器
async function saveItemToServer(item) {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(item)
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadItemsFromServer(); // 重新加载数据
            showToast('添加成功!');
            return true;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('添加失败:', error);
        showToast('添加失败: ' + error.message, 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// 删除衣物
async function deleteItemFromServer(id) {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/items/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadItemsFromServer();
            showToast('删除成功!');
            return true;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败: ' + error.message, 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// ==================== 图片上传 ====================

function initImageUpload() {
    const fileInput = document.getElementById('item-image-file');
    const uploadArea = document.getElementById('upload-area');
    
    if (!fileInput || !uploadArea) return;
    
    fileInput.addEventListener('change', handleImageSelect);
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-blue)';
        uploadArea.style.background = 'var(--primary-blue-lighter)';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            fileInput.files = files;
            handleImageSelect();
        }
    });
}

function handleImageSelect() {
    const file = document.getElementById('item-image-file').files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过5MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentImageData = e.target.result;
        showImagePreview(currentImageData);
    };
    reader.readAsDataURL(file);
}

function showImagePreview(imageData) {
    const placeholder = document.querySelector('.upload-placeholder');
    const preview = document.getElementById('image-preview');
    
    if (placeholder) placeholder.style.display = 'none';
    if (preview) {
        preview.style.display = 'block';
        document.getElementById('preview-img').src = imageData;
    }
}

function removeImage() {
    currentImageData = null;
    document.getElementById('item-image-file').value = '';
    
    const placeholder = document.querySelector('.upload-placeholder');
    const preview = document.getElementById('image-preview');
    
    if (placeholder) placeholder.style.display = 'block';
    if (preview) preview.style.display = 'none';
}

// ==================== 事件监听 ====================

function initEventListeners() {
    // 导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // 添加衣物按钮
    const addBtn = document.getElementById('add-item-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openDialog('add-item-dialog'));
    }
    
    // 搜索和筛选
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const seasonFilter = document.getElementById('season-filter');
    const colorFilter = document.getElementById('color-filter');
    
    if (searchInput) searchInput.addEventListener('input', filterItems);
    if (categoryFilter) categoryFilter.addEventListener('change', filterItems);
    if (seasonFilter) seasonFilter.addEventListener('change', filterItems);
    if (colorFilter) colorFilter.addEventListener('change', filterItems);
}

// ==================== UI 交互 ====================

function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    
    if (tabName === 'all') {
        renderAllItems();
    } else if (tabName === 'statistics') {
        updateStatistics();
    } else {
        renderCategoryItems(tabName);
    }
}

function openDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
        dialog.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        if (dialogId === 'add-item-dialog') {
            document.getElementById('item-form')?.reset();
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('item-purchase-date');
            if (dateInput) dateInput.value = today;
            
            currentImageData = null;
            const placeholder = document.querySelector('.upload-placeholder');
            const preview = document.getElementById('image-preview');
            if (placeholder) placeholder.style.display = 'block';
            if (preview) preview.style.display = 'none';
        }
    }
}

function openAddDialog(category) {
    openDialog('add-item-dialog');
    const categorySelect = document.getElementById('item-category');
    if (categorySelect) categorySelect.value = category;
}

function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
        dialog.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 保存衣物
async function saveItem() {
    const seasons = Array.from(document.querySelectorAll('.season-checkbox:checked')).map(cb => cb.value);
    
    const item = {
        name: document.getElementById('item-name').value,
        category: document.getElementById('item-category').value,
        color: document.getElementById('item-color').value,
        brand: document.getElementById('item-brand').value || '未知品牌',
        price: parseFloat(document.getElementById('item-price').value) || 0,
        seasons: seasons.length > 0 ? seasons : ['all-season'],
        purchase_date: document.getElementById('item-purchase-date').value,
        image: currentImageData || 'https://placehold.co/400x500/E7F0FF/0052D9?text=No+Image',
        notes: document.getElementById('item-notes').value,
        platform: document.getElementById('item-platform').value || '未记录'
    };
    
    if (!item.name || !item.category || !item.color) {
        alert('请填写所有必填字段');
        return;
    }
    
    const success = await saveItemToServer(item);
    if (success) {
        closeDialog('add-item-dialog');
    }
}

// ==================== 渲染函数 ====================

function renderAllItems() {
    const grid = document.getElementById('items-grid');
    if (grid) renderItems(grid, wardrobeItems);
}

function renderCategoryItems(category) {
    const grid = document.getElementById(`${category}-grid`);
    const filtered = wardrobeItems.filter(item => item.category === category);
    if (grid) renderItems(grid, filtered);
}

function renderItems(grid, items) {
    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2"/>
                </svg>
                <h3>还没有衣物</h3>
                <p>点击"添加衣物"开始管理你的衣柜吧</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = items.map(item => `
        <div class="item-card" onclick="viewItemDetail(${item.id})">
            <img src="${item.image}" alt="${item.name}" class="item-image" 
                 onerror="this.src='https://placehold.co/400x500/E7F0FF/0052D9?text=No+Image'">
            <div class="item-content">
                <div class="item-header">
                    <h3 class="item-name">${item.name}</h3>
                </div>
                <p class="item-brand">${item.brand}</p>
                <div class="item-tags">
                    <span class="tag category">${getCategoryText(item.category)}</span>
                    <span class="tag color">${getColorText(item.color)}</span>
                    ${item.seasons.slice(0, 2).map(s => `<span class="tag season">${getSeasonText(s)}</span>`).join('')}
                </div>
                <div class="item-footer">
                    <span class="item-price">¥${item.price}</span>
                    <span class="item-platform">${item.platform || '未记录'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function viewItemDetail(id) {
    const item = wardrobeItems.find(i => i.id === id);
    if (!item) return;
    
    currentDetailId = id;
    
    document.getElementById('detail-title').textContent = '衣物详情';
    document.getElementById('detail-content').innerHTML = `
        <div class="detail-grid">
            <div>
                <img src="${item.image}" alt="${item.name}" class="detail-image"
                     onerror="this.src='https://placehold.co/600x800/E7F0FF/0052D9?text=No+Image'">
            </div>
            <div class="detail-info">
                <div class="detail-section">
                    <h4>名称</h4>
                    <p style="font-size: 18px; font-weight: 600;">${item.name}</p>
                </div>
                <div class="detail-section">
                    <h4>分类信息</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                        <span class="tag category">${getCategoryText(item.category)}</span>
                        <span class="tag color">${getColorText(item.color)}</span>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>品牌 & 价格</h4>
                    <p>${item.brand} | ¥${item.price}</p>
                </div>
                <div class="detail-section">
                    <h4>适用季节</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                        ${item.seasons.map(s => `<span class="tag season">${getSeasonText(s)}</span>`).join('')}
                    </div>
                </div>
                <div class="detail-section">
                    <h4>购买日期</h4>
                    <p>📅 ${item.purchase_date || '未记录'}</p>
                </div>
                <div class="detail-section">
                    <h4>购买平台</h4>
                    <p>${item.platform || '未记录'}</p>
                </div>
                ${item.notes ? `
                    <div class="detail-section">
                        <h4>备注</h4>
                        <p>${item.notes}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('delete-btn').onclick = () => deleteItem(id);
    openDialog('view-detail-dialog');
}

async function deleteItem(id) {
    if (!confirm('确定要删除这件衣物吗? 此操作会影响所有用户!')) return;
    
    const success = await deleteItemFromServer(id);
    if (success) {
        closeDialog('view-detail-dialog');
    }
}

function filterItems() {
    const searchText = document.getElementById('search-input')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('category-filter')?.value || '';
    const seasonFilter = document.getElementById('season-filter')?.value || '';
    const colorFilter = document.getElementById('color-filter')?.value || '';
    
    let filtered = wardrobeItems;
    
    if (searchText) {
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(searchText) ||
            item.brand.toLowerCase().includes(searchText) ||
            (item.notes && item.notes.toLowerCase().includes(searchText))
        );
    }
    
    if (categoryFilter) {
        filtered = filtered.filter(item => item.category === categoryFilter);
    }
    
    if (seasonFilter) {
        filtered = filtered.filter(item => item.seasons.includes(seasonFilter));
    }
    
    if (colorFilter) {
        filtered = filtered.filter(item => item.color === colorFilter);
    }
    
    const grid = document.getElementById('items-grid');
    if (grid) renderItems(grid, filtered);
}

function updateStatistics() {
    document.getElementById('total-items').textContent = wardrobeItems.length;
    
    if (wardrobeItems.length > 0) {
        const mostExpensive = wardrobeItems.reduce((max, item) => 
            item.price > max.price ? item : max
        );
        document.getElementById('most-worn').textContent = mostExpensive.name;
    } else {
        document.getElementById('most-worn').textContent = '-';
    }
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthAdded = wardrobeItems.filter(item => 
        item.purchase_date && item.purchase_date.startsWith(currentMonth)
    ).length;
    document.getElementById('month-added').textContent = monthAdded;
    
    const colorCounts = {};
    wardrobeItems.forEach(item => {
        colorCounts[item.color] = (colorCounts[item.color] || 0) + 1;
    });
    const mainColor = Object.keys(colorCounts).reduce((a, b) => 
        colorCounts[a] > colorCounts[b] ? a : b, '-'
    );
    document.getElementById('main-color').textContent = 
        mainColor !== '-' ? getColorText(mainColor) : '-';
    
    renderCharts();
}

function renderCharts() {
    const categoryCounts = {};
    wardrobeItems.forEach(item => {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    const categoryChart = document.getElementById('category-chart');
    if (categoryChart && Object.keys(categoryCounts).length > 0) {
        const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
        categoryChart.innerHTML = Object.entries(categoryCounts).map(([category, count]) => {
            const percentage = (count / total * 100).toFixed(1);
            return `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;">
                        <span>${getCategoryText(category)}</span>
                        <span style="color: var(--gray-500);">${count} 件 (${percentage}%)</span>
                    </div>
                    <div style="background: var(--gray-100); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, var(--primary-blue), var(--primary-blue-light)); 
                                    height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    const colorCounts = {};
    wardrobeItems.forEach(item => {
        colorCounts[item.color] = (colorCounts[item.color] || 0) + 1;
    });
    
    const colorChart = document.getElementById('color-chart');
    if (colorChart && Object.keys(colorCounts).length > 0) {
        const total = Object.values(colorCounts).reduce((a, b) => a + b, 0);
        colorChart.innerHTML = Object.entries(colorCounts).map(([color, count]) => {
            const percentage = (count / total * 100).toFixed(1);
            return `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;">
                        <span>${getColorText(color)}</span>
                        <span style="color: var(--gray-500);">${count} 件 (${percentage}%)</span>
                    </div>
                    <div style="background: var(--gray-100); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, var(--secondary-purple), var(--secondary-purple-light)); 
                                    height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    const seasonCounts = { spring: 0, summer: 0, autumn: 0, winter: 0, 'all-season': 0 };
    wardrobeItems.forEach(item => {
        item.seasons.forEach(season => {
            seasonCounts[season] = (seasonCounts[season] || 0) + 1;
        });
    });
    
    const seasonChart = document.getElementById('season-chart');
    if (seasonChart && wardrobeItems.length > 0) {
        const maxCount = Math.max(...Object.values(seasonCounts));
        seasonChart.innerHTML = `
            <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 240px; gap: 12px;">
                ${Object.entries(seasonCounts).map(([season, count]) => {
                    const height = maxCount > 0 ? (count / maxCount * 200) : 0;
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                            <div style="width: 100%; background: linear-gradient(180deg, var(--primary-blue-light), var(--primary-blue)); 
                                        height: ${height}px; border-radius: 8px 8px 0 0; 
                                        transition: height 0.3s ease; position: relative; min-height: 4px;">
                                ${count > 0 ? `<span style="position: absolute; top: -20px; left: 50%; 
                                    transform: translateX(-50%); font-size: 12px; font-weight: 600; 
                                    color: var(--primary-blue);">${count}</span>` : ''}
                            </div>
                            <span style="margin-top: 8px; font-size: 13px; color: var(--gray-600);">
                                ${getSeasonText(season)}
                            </span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

// ==================== 工具函数 ====================

function showLoading(show) {
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); 
                        display: flex; align-items: center; justify-content: center; z-index: 9999;">
                <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #0052D9; 
                                border-radius: 50%; animation: spin 1s linear infinite;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(loader);
        
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }
    loader.style.display = show ? 'block' : 'none';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? '#E34D59' : '#0052D9';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

function getCategoryText(category) {
    const map = {
        'tops': '上装',
        'bottoms': '下装',
        'dresses': '连衣裙',
        'outerwear': '外套',
        'accessories': '配饰鞋包'
    };
    return map[category] || category;
}

function getColorText(color) {
    const map = {
        'black': '黑色', 'white': '白色', 'gray': '灰色', 'blue': '蓝色',
        'red': '红色', 'pink': '粉色', 'green': '绿色', 'yellow': '黄色',
        'brown': '棕色', 'purple': '紫色', 'other': '其他'
    };
    return map[color] || color;
}

function getSeasonText(season) {
    const map = {
        'spring': '春季', 'summer': '夏季', 'autumn': '秋季',
        'winter': '冬季', 'all-season': '四季'
    };
    return map[season] || season;
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
