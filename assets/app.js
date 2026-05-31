// 数据存储
let data = {
    articles: JSON.parse(localStorage.getItem('articles') || '[]'),
    essays: JSON.parse(localStorage.getItem('essays') || '[]'),
    images: JSON.parse(localStorage.getItem('images') || '[]'),
    videos: JSON.parse(localStorage.getItem('videos') || '[]')
};

// RAW格式列表
const RAW_FORMATS = ['.raw', '.cr2', '.nef', '.arw', '.dng', '.orf', '.raf', '.pef'];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploads();
    initModals();
    renderAll();
});

// 导航切换
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = link.dataset.section;
            
            // 更新导航状态
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // 切换内容区
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
        });
    });
}

// 文件上传处理
function initUploads() {
    // 文章上传
    document.getElementById('article-upload').addEventListener('change', (e) => {
        handleTextUpload(e.target.files, 'articles');
    });
    
    // 随笔上传
    document.getElementById('essay-upload').addEventListener('change', (e) => {
        handleTextUpload(e.target.files, 'essays');
    });
    
    // 图片上传
    document.getElementById('image-upload').addEventListener('change', (e) => {
        handleImageUpload(e.target.files);
    });
    
    // 视频上传
    document.getElementById('video-upload').addEventListener('change', (e) => {
        handleVideoUpload(e.target.files);
    });
}

// 处理文本文件上传
function handleTextUpload(files, type) {
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = {
                id: Date.now() + Math.random(),
                title: file.name.replace(/\.[^/.]+$/, ''),
                content: e.target.result,
                date: new Date().toLocaleString('zh-CN'),
                filename: file.name
            };
            data[type].unshift(item);
            saveData(type);
            renderAll();
        };
        reader.readAsText(file);
    });
}

// 处理图片上传
function handleImageUpload(files) {
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        const isRaw = RAW_FORMATS.some(ext => 
            file.name.toLowerCase().endsWith(ext)
        );
        
        reader.onload = (e) => {
            const item = {
                id: Date.now() + Math.random(),
                src: e.target.result,
                filename: file.name,
                format: isRaw ? 'RAW' : getImageFormat(file.name),
                isRaw: isRaw,
                date: new Date().toLocaleString('zh-CN'),
                size: formatFileSize(file.size)
            };
            data.images.unshift(item);
            saveData('images');
            renderImages();
        };
        reader.readAsDataURL(file);
    });
}

// 处理视频上传
function handleVideoUpload(files) {
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = {
                id: Date.now() + Math.random(),
                src: e.target.result,
                filename: file.name,
                title: file.name.replace(/\.[^/.]+$/, ''),
                date: new Date().toLocaleString('zh-CN'),
                size: formatFileSize(file.size)
            };
            data.videos.unshift(item);
            saveData('videos');
            renderVideos();
        };
        reader.readAsDataURL(file);
    });
}

// 获取图片格式
function getImageFormat(filename) {
    const ext = filename.split('.').pop().toUpperCase();
    return ext || 'IMAGE';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 保存数据到localStorage
function saveData(type) {
    localStorage.setItem(type, JSON.stringify(data[type]));
}

// 渲染所有内容
function renderAll() {
    renderArticles();
    renderEssays();
    renderImages();
    renderVideos();
}

// 渲染文章列表
function renderArticles() {
    const container = document.getElementById('articles-list');
    if (data.articles.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无文章，点击上方按钮添加</div>';
        return;
    }
    
    container.innerHTML = data.articles.map(article => `
        <div class="item-card" onclick="openTextModal('articles', ${article.id})">
            <h3>${escapeHtml(article.title)}</h3>
            <div class="item-meta">${article.date}</div>
            <div class="item-preview">${escapeHtml(article.content.substring(0, 150))}...</div>
        </div>
    `).join('');
}

// 渲染随笔列表
function renderEssays() {
    const container = document.getElementById('essays-list');
    if (data.essays.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无随笔，点击上方按钮添加</div>';
        return;
    }
    
    container.innerHTML = data.essays.map(essay => `
        <div class="item-card" onclick="openTextModal('essays', ${essay.id})">
            <h3>${escapeHtml(essay.title)}</h3>
            <div class="item-meta">${essay.date}</div>
            <div class="item-preview">${escapeHtml(essay.content.substring(0, 150))}...</div>
        </div>
    `).join('');
}

// 渲染图片网格
function renderImages(filter = 'all') {
    const container = document.getElementById('images-grid');
    let images = data.images;
    
    if (filter === 'jpg') {
        images = images.filter(img => !img.isRaw);
    } else if (filter === 'raw') {
        images = images.filter(img => img.isRaw);
    }
    
    if (images.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无图片，点击上方按钮添加</div>';
        return;
    }
    
    container.innerHTML = images.map(image => `
        <div class="image-card" onclick="openImageModal(${image.id})">
            <img src="${image.src}" alt="${escapeHtml(image.filename)}" loading="lazy">
            <span class="format-badge">${image.format}</span>
            <div class="image-overlay">
                <p>${escapeHtml(image.filename)}</p>
                <small>${image.size} · ${image.date}</small>
            </div>
        </div>
    `).join('');
}

// 渲染视频列表
function renderVideos() {
    const container = document.getElementById('videos-list');
    if (data.videos.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无视频，点击上方按钮添加</div>';
        return;
    }
    
    container.innerHTML = data.videos.map(video => `
        <div class="video-card">
            <video controls preload="metadata">
                <source src="${video.src}" type="video/mp4">
                您的浏览器不支持视频播放
            </video>
            <div class="video-info">
                <h4>${escapeHtml(video.title)}</h4>
                <div class="video-meta">${video.size} · ${video.date}</div>
            </div>
        </div>
    `).join('');
}

// 初始化模态框
function initModals() {
    // 关闭按钮
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // 点击背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });
    
    // 图片筛选
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderImages(btn.dataset.filter);
        });
    });
}

// 打开图片模态框
function openImageModal(id) {
    const image = data.images.find(img => img.id === id);
    if (!image) return;
    
    document.getElementById('modal-image').src = image.src;
    document.getElementById('modal-filename').textContent = image.filename;
    document.getElementById('modal-format').textContent = `${image.format} · ${image.size} · ${image.date}`;
    document.getElementById('modal-download').href = image.src;
    document.getElementById('modal-download').download = image.filename;
    
    document.getElementById('image-modal').classList.add('active');
}

// 打开文本模态框
function openTextModal(type, id) {
    const item = data[type].find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('text-modal-title').textContent = item.title;
    document.getElementById('text-modal-body').textContent = item.content;
    
    document.getElementById('text-modal').classList.add('active');
}

// 关闭所有模态框
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});
