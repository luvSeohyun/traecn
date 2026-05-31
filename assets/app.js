// GitHub API 配置
const GITHUB_CONFIG = {
    token: localStorage.getItem('github_token') || '',
    owner: localStorage.getItem('github_owner') || 'luvSeohyun',
    repo: localStorage.getItem('github_repo') || 'traecn',
    branch: localStorage.getItem('github_branch') || 'master'
};

// RAW格式列表
const RAW_FORMATS = ['.raw', '.cr2', '.nef', '.arw', '.dng', '.orf', '.raf', '.pef'];

// 数据存储
let data = {
    articles: [],
    essays: [],
    images: [],
    videos: []
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploads();
    initModals();
    initConfig();
    loadDataFromGitHub();
});

// 导航切换
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = link.dataset.section;
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
        });
    });
}

// 文件上传处理
function initUploads() {
    document.getElementById('article-upload').addEventListener('change', (e) => {
        handleTextUpload(e.target.files, 'articles');
    });
    
    document.getElementById('essay-upload').addEventListener('change', (e) => {
        handleTextUpload(e.target.files, 'essays');
    });
    
    document.getElementById('image-upload').addEventListener('change', (e) => {
        handleImageUpload(e.target.files);
    });
    
    document.getElementById('video-upload').addEventListener('change', (e) => {
        handleVideoUpload(e.target.files);
    });
}

// 处理文本文件上传
async function handleTextUpload(files, type) {
    const folder = type === 'articles' ? 'articles' : 'essays';
    
    for (const file of Array.from(files)) {
        const content = await readFileAsText(file);
        const filename = file.name;
        
        // 上传到 GitHub
        const success = await uploadToGitHub(folder, filename, content);
        
        if (success) {
            const item = {
                id: Date.now() + Math.random(),
                title: filename.replace(/\.[^/.]+$/, ''),
                content: content,
                date: new Date().toLocaleString('zh-CN'),
                filename: filename,
                path: `${folder}/${filename}`
            };
            data[type].unshift(item);
        }
    }
    
    renderAll();
}

// 处理图片上传
async function handleImageUpload(files) {
    for (const file of Array.from(files)) {
        const content = await readFileAsBase64(file);
        const filename = file.name;
        const isRaw = RAW_FORMATS.some(ext => filename.toLowerCase().endsWith(ext));
        
        const success = await uploadToGitHub('images', filename, content, true);
        
        if (success) {
            const item = {
                id: Date.now() + Math.random(),
                src: `data:${file.type || 'image/jpeg'};base64,${content}`,
                filename: filename,
                format: isRaw ? 'RAW' : getImageFormat(filename),
                isRaw: isRaw,
                date: new Date().toLocaleString('zh-CN'),
                size: formatFileSize(file.size),
                path: `images/${filename}`
            };
            data.images.unshift(item);
        }
    }
    
    renderImages();
}

// 处理视频上传
async function handleVideoUpload(files) {
    for (const file of Array.from(files)) {
        const content = await readFileAsBase64(file);
        const filename = file.name;
        
        const success = await uploadToGitHub('videos', filename, content, true);
        
        if (success) {
            const item = {
                id: Date.now() + Math.random(),
                src: `data:${file.type || 'video/mp4'};base64,${content}`,
                filename: filename,
                title: filename.replace(/\.[^/.]+$/, ''),
                date: new Date().toLocaleString('zh-CN'),
                size: formatFileSize(file.size),
                path: `videos/${filename}`
            };
            data.videos.unshift(item);
        }
    }
    
    renderVideos();
}

// 读取文件为文本
function readFileAsText(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
    });
}

// 读取文件为 Base64
function readFileAsBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });
}

// 上传到 GitHub
async function uploadToGitHub(folder, filename, content, isBinary = false) {
    if (!GITHUB_CONFIG.token) {
        alert('请先配置 GitHub Token！');
        return false;
    }
    
    showSyncStatus('正在同步到 GitHub...', 'syncing');
    
    try {
        const path = `${folder}/${filename}`;
        const encodedContent = isBinary ? content : btoa(unescape(encodeURIComponent(content)));
        
        // 检查文件是否已存在
        let sha = null;
        try {
            const checkResponse = await fetch(
                `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}?ref=${GITHUB_CONFIG.branch}`,
                {
                    headers: {
                        'Authorization': `token ${GITHUB_CONFIG.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            if (checkResponse.ok) {
                const fileData = await checkResponse.json();
                sha = fileData.sha;
            }
        } catch (e) {
            // 文件不存在，继续创建
        }
        
        // 创建或更新文件
        const body = {
            message: `Upload ${filename}`,
            content: encodedContent,
            branch: GITHUB_CONFIG.branch
        };
        
        if (sha) {
            body.sha = sha;
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        
        if (response.ok) {
            showSyncStatus('同步成功！', 'success');
            return true;
        } else {
            const error = await response.json();
            throw new Error(error.message);
        }
    } catch (error) {
        showSyncStatus(`同步失败: ${error.message}`, 'error');
        console.error('Upload error:', error);
        return false;
    }
}

// 从 GitHub 加载数据
async function loadDataFromGitHub() {
    if (!GITHUB_CONFIG.token) {
        renderAll();
        return;
    }
    
    showSyncStatus('正在从 GitHub 加载...', 'syncing');
    
    try {
        // 加载文章
        data.articles = await loadFolderFromGitHub('articles', 'text');
        // 加载随笔
        data.essays = await loadFolderFromGitHub('essays', 'text');
        // 加载图片
        data.images = await loadFolderFromGitHub('images', 'image');
        // 加载视频
        data.videos = await loadFolderFromGitHub('videos', 'video');
        
        showSyncStatus('加载完成！', 'success');
        renderAll();
    } catch (error) {
        showSyncStatus(`加载失败: ${error.message}`, 'error');
        console.error('Load error:', error);
        renderAll();
    }
}

// 从 GitHub 加载文件夹
async function loadFolderFromGitHub(folder, type) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${folder}?ref=${GITHUB_CONFIG.branch}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                return []; // 文件夹不存在，返回空数组
            }
            throw new Error(`Failed to load ${folder}`);
        }
        
        const files = await response.json();
        const items = [];
        
        for (const file of files) {
            if (file.type !== 'file') continue;
            
            const contentResponse = await fetch(file.download_url);
            
            if (type === 'text') {
                const content = await contentResponse.text();
                items.push({
                    id: file.sha,
                    title: file.name.replace(/\.[^/.]+$/, ''),
                    content: content,
                    date: new Date(file.last_modified || Date.now()).toLocaleString('zh-CN'),
                    filename: file.name,
                    path: file.path
                });
            } else if (type === 'image') {
                const blob = await contentResponse.blob();
                const src = URL.createObjectURL(blob);
                const isRaw = RAW_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext));
                
                items.push({
                    id: file.sha,
                    src: src,
                    filename: file.name,
                    format: isRaw ? 'RAW' : getImageFormat(file.name),
                    isRaw: isRaw,
                    date: new Date(file.last_modified || Date.now()).toLocaleString('zh-CN'),
                    size: formatFileSize(file.size),
                    path: file.path
                });
            } else if (type === 'video') {
                const blob = await contentResponse.blob();
                const src = URL.createObjectURL(blob);
                
                items.push({
                    id: file.sha,
                    src: src,
                    filename: file.name,
                    title: file.name.replace(/\.[^/.]+$/, ''),
                    date: new Date(file.last_modified || Date.now()).toLocaleString('zh-CN'),
                    size: formatFileSize(file.size),
                    path: file.path
                });
            }
        }
        
        return items;
    } catch (error) {
        console.error(`Error loading ${folder}:`, error);
        return [];
    }
}

// 显示同步状态
function showSyncStatus(message, type) {
    let statusEl = document.querySelector('.sync-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'sync-status';
        document.querySelector('header').appendChild(statusEl);
    }
    
    statusEl.textContent = message;
    statusEl.className = `sync-status ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// 获取图片格式
function getImageFormat(filename) {
    const ext = filename.split('.').pop().toUpperCase();
    return ext || 'IMAGE';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 渲染所有内容
function renderAll() {
    renderArticles();
    renderEssays();
    renderImages();
    renderVideos();
}

// 渲染文章列表 - 只显示前3行预览
function renderArticles() {
    const container = document.getElementById('articles-list');
    if (data.articles.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无文章，点击上方按钮添加</div>';
        return;
    }
    
    container.innerHTML = data.articles.map(article => {
        const previewLines = article.content.split('\n').slice(0, 3).join('\n');
        return `
        <div class="item-card" onclick="openTextModal('articles', '${article.id}')">
            <h3>${escapeHtml(article.title)}</h3>
            <div class="item-meta">${article.date}</div>
            <div class="item-preview">${escapeHtml(previewLines)}${article.content.split('\n').length > 3 ? '...' : ''}</div>
        </div>
    `}).join('');
}

// 渲染随笔列表 - 只显示前3行预览
function renderEssays() {
    const container = document.getElementById('essays-list');
    if (data.essays.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无随笔，点击上方按钮添加</div>';
        return;
    }
    
    container.innerHTML = data.essays.map(essay => {
        const previewLines = essay.content.split('\n').slice(0, 3).join('\n');
        return `
        <div class="item-card" onclick="openTextModal('essays', '${essay.id}')">
            <h3>${escapeHtml(essay.title)}</h3>
            <div class="item-meta">${essay.date}</div>
            <div class="item-preview">${escapeHtml(previewLines)}${essay.content.split('\n').length > 3 ? '...' : ''}</div>
        </div>
    `}).join('');
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
        <div class="image-card" onclick="openImageModal('${image.id}')">
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
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderImages(btn.dataset.filter);
        });
    });
}

// 初始化配置
function initConfig() {
    const configBtn = document.getElementById('config-btn');
    const configModal = document.getElementById('config-modal');
    const saveBtn = document.getElementById('save-config');
    
    // 加载已保存的配置
    document.getElementById('github-token').value = GITHUB_CONFIG.token;
    document.getElementById('repo-owner').value = GITHUB_CONFIG.owner;
    document.getElementById('repo-name').value = GITHUB_CONFIG.repo;
    document.getElementById('repo-branch').value = GITHUB_CONFIG.branch;
    
    configBtn.addEventListener('click', () => {
        configModal.classList.add('active');
    });
    
    saveBtn.addEventListener('click', saveConfig);
}

// 保存配置
function saveConfig() {
    const token = document.getElementById('github-token').value.trim();
    const owner = document.getElementById('repo-owner').value.trim();
    const repo = document.getElementById('repo-name').value.trim();
    const branch = document.getElementById('repo-branch').value.trim();
    
    if (!token) {
        showConfigStatus('请输入 GitHub Token', 'error');
        return;
    }
    
    localStorage.setItem('github_token', token);
    localStorage.setItem('github_owner', owner);
    localStorage.setItem('github_repo', repo);
    localStorage.setItem('github_branch', branch);
    
    GITHUB_CONFIG.token = token;
    GITHUB_CONFIG.owner = owner;
    GITHUB_CONFIG.repo = repo;
    GITHUB_CONFIG.branch = branch;
    
    showConfigStatus('配置保存成功！', 'success');
    
    // 重新加载数据
    setTimeout(() => {
        closeAllModals();
        loadDataFromGitHub();
    }, 1000);
}

// 显示配置状态
function showConfigStatus(message, type) {
    const statusEl = document.getElementById('config-status');
    statusEl.textContent = message;
    statusEl.className = `config-status ${type}`;
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
    if (!text) return '';
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
