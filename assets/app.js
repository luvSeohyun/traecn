// 配置
const CONFIG = {
    github: {
        token: localStorage.getItem('github_token') || '',
        owner: localStorage.getItem('github_owner') || 'luvSeohyun',
        repo: localStorage.getItem('github_repo') || 'traecn',
        branch: localStorage.getItem('github_branch') || 'master'
    },
    nas: {
        enabled: localStorage.getItem('storage_source') === 'nas' || localStorage.getItem('storage_source') === 'both',
        url: localStorage.getItem('nas_url') || '',
        username: localStorage.getItem('nas_username') || '',
        password: localStorage.getItem('nas_password') || '',
        basePath: localStorage.getItem('nas_basepath') || '/我们的小天地'
    },
    storageSource: localStorage.getItem('storage_source') || 'github'
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

// 当前编辑状态
let currentEditor = {
    type: '', // 'articles' 或 'essays'
    mode: '', // 'create' 或 'edit'
    item: null
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploads();
    initModals();
    initConfig();
    initEditor();
    loadData();
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
    
    // 写文章按钮
    document.getElementById('write-article').addEventListener('click', () => {
        openEditor('articles', 'create');
    });
    
    // 写随笔按钮
    document.getElementById('write-essay').addEventListener('click', () => {
        openEditor('essays', 'create');
    });
}

// 初始化编辑器
function initEditor() {
    document.getElementById('editor-save').addEventListener('click', saveEditorContent);
    document.getElementById('editor-cancel').addEventListener('click', closeEditor);
}

// 打开编辑器
function openEditor(type, mode, item = null) {
    currentEditor = { type, mode, item };
    
    const modal = document.getElementById('editor-modal');
    const title = document.getElementById('editor-title');
    const filename = document.getElementById('editor-filename');
    const content = document.getElementById('editor-content');
    
    title.textContent = mode === 'create' 
        ? (type === 'articles' ? '写文章' : '写随笔')
        : (type === 'articles' ? '编辑文章' : '编辑随笔');
    
    if (mode === 'edit' && item) {
        filename.value = item.title;
        content.value = item.content;
    } else {
        filename.value = '';
        content.value = '';
    }
    
    modal.classList.add('active');
    content.focus();
}

// 关闭编辑器
function closeEditor() {
    document.getElementById('editor-modal').classList.remove('active');
    currentEditor = { type: '', mode: '', item: null };
}

// 保存编辑器内容
async function saveEditorContent() {
    const filename = document.getElementById('editor-filename').value.trim();
    const content = document.getElementById('editor-content').value;
    
    if (!filename) {
        alert('请输入文件名');
        return;
    }
    
    if (!content) {
        alert('请输入内容');
        return;
    }
    
    const fullFilename = filename + '.md';
    const folder = currentEditor.type === 'articles' ? 'articles' : 'essays';
    
    showSyncStatus('正在保存...', 'syncing');
    
    let success = false;
    
    // 根据存储源保存
    if (CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both') {
        success = await uploadToGitHub(folder, fullFilename, content);
    }
    
    if (CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both') {
        success = await uploadToNAS(folder, fullFilename, content);
    }
    
    if (success) {
        const item = {
            id: Date.now() + Math.random(),
            title: filename,
            content: content,
            date: new Date().toLocaleString('zh-CN'),
            filename: fullFilename,
            path: `${folder}/${fullFilename}`
        };
        
        if (currentEditor.mode === 'edit' && currentEditor.item) {
            const index = data[currentEditor.type].findIndex(i => i.id === currentEditor.item.id);
            if (index !== -1) {
                data[currentEditor.type][index] = item;
            }
        } else {
            data[currentEditor.type].unshift(item);
        }
        
        renderAll();
        closeEditor();
        showSyncStatus('保存成功！', 'success');
    }
}

// 处理文本文件上传
async function handleTextUpload(files, type) {
    const folder = type === 'articles' ? 'articles' : 'essays';
    
    for (const file of Array.from(files)) {
        const content = await readFileAsText(file);
        const filename = file.name;
        
        showSyncStatus(`正在上传 ${filename}...`, 'syncing');
        
        let success = false;
        
        if (CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both') {
            success = await uploadToGitHub(folder, filename, content);
        }
        
        if (CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both') {
            success = await uploadToNAS(folder, filename, content);
        }
        
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
        
        showSyncStatus(`正在上传 ${filename}...`, 'syncing');
        
        let success = false;
        
        if (CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both') {
            success = await uploadToGitHub('images', filename, content, true);
        }
        
        if (CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both') {
            success = await uploadToNAS('images', filename, content, true);
        }
        
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
        
        showSyncStatus(`正在上传 ${filename}...`, 'syncing');
        
        let success = false;
        
        if (CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both') {
            success = await uploadToGitHub('videos', filename, content, true);
        }
        
        if (CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both') {
            success = await uploadToNAS('videos', filename, content, true);
        }
        
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
    if (!CONFIG.github.token) {
        return false;
    }
    
    try {
        const path = `${folder}/${filename}`;
        const encodedContent = isBinary ? content : btoa(unescape(encodeURIComponent(content)));
        
        // 检查文件是否已存在
        let sha = null;
        try {
            const checkResponse = await fetch(
                `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/${path}?ref=${CONFIG.github.branch}`,
                {
                    headers: {
                        'Authorization': `token ${CONFIG.github.token}`,
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
            branch: CONFIG.github.branch
        };
        
        if (sha) {
            body.sha = sha;
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${CONFIG.github.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        
        return response.ok;
    } catch (error) {
        console.error('GitHub upload error:', error);
        return false;
    }
}

// 上传到 NAS (WebDAV)
async function uploadToNAS(folder, filename, content, isBinary = false) {
    if (!CONFIG.nas.url || !CONFIG.nas.username) {
        return false;
    }
    
    try {
        const path = `${CONFIG.nas.basePath}/${folder}/${filename}`;
        const url = `${CONFIG.nas.url}${encodeURIComponent(path)}`;
        
        let body;
        if (isBinary) {
            // Base64 转二进制
            const byteCharacters = atob(content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            body = new Uint8Array(byteNumbers);
        } else {
            body = content;
        }
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'Basic ' + btoa(CONFIG.nas.username + ':' + CONFIG.nas.password),
                'Content-Type': isBinary ? 'application/octet-stream' : 'text/plain'
            },
            body: body
        });
        
        return response.ok || response.status === 201;
    } catch (error) {
        console.error('NAS upload error:', error);
        return false;
    }
}

// 加载数据
async function loadData() {
    showSyncStatus('正在加载数据...', 'syncing');
    
    try {
        // 根据存储源加载
        if (CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both') {
            await loadFromGitHub();
        }
        
        if (CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both') {
            await loadFromNAS();
        }
        
        showSyncStatus('加载完成！', 'success');
        renderAll();
    } catch (error) {
        showSyncStatus(`加载失败: ${error.message}`, 'error');
        console.error('Load error:', error);
        renderAll();
    }
}

// 从 GitHub 加载
async function loadFromGitHub() {
    if (!CONFIG.github.token) return;
    
    data.articles = await loadFolderFromGitHub('articles', 'text');
    data.essays = await loadFolderFromGitHub('essays', 'text');
    data.images = await loadFolderFromGitHub('images', 'image');
    data.videos = await loadFolderFromGitHub('videos', 'video');
}

// 从 NAS 加载
async function loadFromNAS() {
    if (!CONFIG.nas.url || !CONFIG.nas.username) return;
    
    const nasArticles = await loadFolderFromNAS('articles', 'text');
    const nasEssays = await loadFolderFromNAS('essays', 'text');
    const nasImages = await loadFolderFromNAS('images', 'image');
    const nasVideos = await loadFolderFromNAS('videos', 'video');
    
    // 合并数据（去重）
    data.articles = mergeData(data.articles, nasArticles);
    data.essays = mergeData(data.essays, nasEssays);
    data.images = mergeData(data.images, nasImages);
    data.videos = mergeData(data.videos, nasVideos);
}

// 合并数据（根据文件名去重）
function mergeData(existing, newData) {
    const existingNames = new Set(existing.map(item => item.filename));
    const uniqueNew = newData.filter(item => !existingNames.has(item.filename));
    return [...existing, ...uniqueNew];
}

// 从 GitHub 加载文件夹
async function loadFolderFromGitHub(folder, type) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/${folder}?ref=${CONFIG.github.branch}`,
            {
                headers: {
                    'Authorization': `token ${CONFIG.github.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!response.ok) {
            if (response.status === 404) return [];
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
                    path: file.path,
                    source: 'github'
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
                    path: file.path,
                    source: 'github'
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
                    path: file.path,
                    source: 'github'
                });
            }
        }
        
        return items;
    } catch (error) {
        console.error(`Error loading ${folder} from GitHub:`, error);
        return [];
    }
}

// 从 NAS 加载文件夹 (WebDAV PROPFIND)
async function loadFolderFromNAS(folder, type) {
    try {
        const path = `${CONFIG.nas.basePath}/${folder}`;
        const url = `${CONFIG.nas.url}${encodeURIComponent(path)}`;
        
        // WebDAV PROPFIND 请求
        const response = await fetch(url, {
            method: 'PROPFIND',
            headers: {
                'Authorization': 'Basic ' + btoa(CONFIG.nas.username + ':' + CONFIG.nas.password),
                'Content-Type': 'text/xml',
                'Depth': '1'
            },
            body: `<?xml version="1.0" encoding="utf-8"?>
                <propfind xmlns="DAV:">
                    <prop>
                        <displayname/>
                        <getcontentlength/>
                        <getlastmodified/>
                        <resourcetype/>
                    </prop>
                </propfind>`
        });
        
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`Failed to load ${folder} from NAS`);
        }
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const responses = xmlDoc.querySelectorAll('response');
        const items = [];
        
        for (const resp of responses) {
            const href = resp.querySelector('href')?.textContent || '';
            const displayName = resp.querySelector('displayname')?.textContent || '';
            const contentLength = resp.querySelector('getcontentlength')?.textContent || '0';
            const lastModified = resp.querySelector('getlastmodified')?.textContent;
            const isCollection = resp.querySelector('resourcetype collection') !== null;
            
            // 跳过文件夹本身
            if (isCollection || !displayName || displayName === folder) continue;
            
            const fileUrl = `${CONFIG.nas.url}${href}`;
            
            if (type === 'text') {
                const contentResponse = await fetch(fileUrl, {
                    headers: {
                        'Authorization': 'Basic ' + btoa(CONFIG.nas.username + ':' + CONFIG.nas.password)
                    }
                });
                const content = await contentResponse.text();
                
                items.push({
                    id: 'nas_' + displayName,
                    title: displayName.replace(/\.[^/.]+$/, ''),
                    content: content,
                    date: lastModified ? new Date(lastModified).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN'),
                    filename: displayName,
                    path: `${folder}/${displayName}`,
                    source: 'nas'
                });
            } else if (type === 'image') {
                const isRaw = RAW_FORMATS.some(ext => displayName.toLowerCase().endsWith(ext));
                
                items.push({
                    id: 'nas_' + displayName,
                    src: fileUrl + '?auth=' + btoa(CONFIG.nas.username + ':' + CONFIG.nas.password),
                    filename: displayName,
                    format: isRaw ? 'RAW' : getImageFormat(displayName),
                    isRaw: isRaw,
                    date: lastModified ? new Date(lastModified).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN'),
                    size: formatFileSize(parseInt(contentLength)),
                    path: `${folder}/${displayName}`,
                    source: 'nas'
                });
            } else if (type === 'video') {
                items.push({
                    id: 'nas_' + displayName,
                    src: fileUrl + '?auth=' + btoa(CONFIG.nas.username + ':' + CONFIG.nas.password),
                    filename: displayName,
                    title: displayName.replace(/\.[^/.]+$/, ''),
                    date: lastModified ? new Date(lastModified).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN'),
                    size: formatFileSize(parseInt(contentLength)),
                    path: `${folder}/${displayName}`,
                    source: 'nas'
                });
            }
        }
        
        return items;
    } catch (error) {
        console.error(`Error loading ${folder} from NAS:`, error);
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
            <div class="item-meta">${article.date} ${article.source ? `(${article.source})` : ''}</div>
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
            <div class="item-meta">${essay.date} ${essay.source ? `(${essay.source})` : ''}</div>
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
                <small>${image.size} · ${image.date} ${image.source ? `(${image.source})` : ''}</small>
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
                <div class="video-meta">${video.size} · ${video.date} ${video.source ? `(${video.source})` : ''}</div>
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
    document.getElementById('github-token').value = CONFIG.github.token;
    document.getElementById('repo-owner').value = CONFIG.github.owner;
    document.getElementById('repo-name').value = CONFIG.github.repo;
    document.getElementById('repo-branch').value = CONFIG.github.branch;
    
    document.getElementById('storage-source').value = CONFIG.storageSource;
    document.getElementById('nas-url').value = CONFIG.nas.url;
    document.getElementById('nas-username').value = CONFIG.nas.username;
    document.getElementById('nas-password').value = CONFIG.nas.password;
    document.getElementById('nas-basepath').value = CONFIG.nas.basePath;
    
    // 配置标签页切换
    document.querySelectorAll('.config-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(tab.dataset.tab + '-config').classList.add('active');
        });
    });
    
    configBtn.addEventListener('click', () => {
        configModal.classList.add('active');
    });
    
    saveBtn.addEventListener('click', saveConfig);
}

// 保存配置
function saveConfig() {
    // GitHub 配置
    const githubToken = document.getElementById('github-token').value.trim();
    const owner = document.getElementById('repo-owner').value.trim();
    const repo = document.getElementById('repo-name').value.trim();
    const branch = document.getElementById('repo-branch').value.trim();
    
    // NAS 配置
    const storageSource = document.getElementById('storage-source').value;
    const nasUrl = document.getElementById('nas-url').value.trim();
    const nasUsername = document.getElementById('nas-username').value.trim();
    const nasPassword = document.getElementById('nas-password').value;
    const nasBasePath = document.getElementById('nas-basepath').value.trim();
    
    // 保存到 localStorage
    localStorage.setItem('github_token', githubToken);
    localStorage.setItem('github_owner', owner);
    localStorage.setItem('github_repo', repo);
    localStorage.setItem('github_branch', branch);
    
    localStorage.setItem('storage_source', storageSource);
    localStorage.setItem('nas_url', nasUrl);
    localStorage.setItem('nas_username', nasUsername);
    localStorage.setItem('nas_password', nasPassword);
    localStorage.setItem('nas_basepath', nasBasePath);
    
    // 更新配置对象
    CONFIG.github.token = githubToken;
    CONFIG.github.owner = owner;
    CONFIG.github.repo = repo;
    CONFIG.github.branch = branch;
    
    CONFIG.storageSource = storageSource;
    CONFIG.nas.enabled = storageSource === 'nas' || storageSource === 'both';
    CONFIG.nas.url = nasUrl;
    CONFIG.nas.username = nasUsername;
    CONFIG.nas.password = nasPassword;
    CONFIG.nas.basePath = nasBasePath;
    
    showConfigStatus('配置保存成功！', 'success');
    
    // 重新加载数据
    setTimeout(() => {
        closeAllModals();
        loadData();
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
