// ========== Toast 弹窗组件 ==========
function showToast(type, title, message, duration = 5000) {
    const container = document.getElementById('toast-container');
    const icons = { error: '!', warning: '!', success: '✓', info: 'i' };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'i'}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// ========== 配置 ==========
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

const RAW_FORMATS = ['.raw', '.cr2', '.nef', '.arw', '.dng', '.orf', '.raf', '.pef'];

let data = { articles: [], essays: [], images: [], videos: [] };

let currentEditor = { type: '', mode: '', item: null };

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploads();
    initModals();
    initConfig();
    initEditor();
    loadData();
});

// ========== 导航切换 ==========
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

// ========== 文件上传处理 ==========
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
    
    document.getElementById('write-article').addEventListener('click', () => {
        openEditor('articles', 'create');
    });
    
    document.getElementById('write-essay').addEventListener('click', () => {
        openEditor('essays', 'create');
    });
}

// ========== 编辑器 ==========
function initEditor() {
    document.getElementById('editor-save').addEventListener('click', saveEditorContent);
    document.getElementById('editor-cancel').addEventListener('click', closeEditor);
}

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

function closeEditor() {
    document.getElementById('editor-modal').classList.remove('active');
    currentEditor = { type: '', mode: '', item: null };
}

// ========== 保存编辑器内容（修复版） ==========
async function saveEditorContent() {
    const filename = document.getElementById('editor-filename').value.trim();
    const content = document.getElementById('editor-content').value;
    
    if (!filename) {
        showToast('warning', '请输入文件名', '文件名不能为空，请填写一个标题后重试。');
        return;
    }
    
    if (!content) {
        showToast('warning', '请输入内容', '内容不能为空，请写点什么吧。');
        return;
    }
    
    // 前置校验：检查存储源是否已配置
    const needGitHub = CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both';
    const needNAS = CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both';
    
    if (needGitHub && !CONFIG.github.token) {
        showToast('error', 'GitHub Token 未配置',
            '请先点击右上角 ⚙️ 设置按钮，在 GitHub 标签页中填入你的 Personal Access Token（需要 repo 权限）。获取方式：GitHub → Settings → Developer settings → Personal access tokens → Generate new token。');
        return;
    }
    
    if (needNAS && (!CONFIG.nas.url || !CONFIG.nas.username)) {
        showToast('error', 'NAS 未配置',
            '请先点击右上角 ⚙️ 设置按钮，在 NAS 标签页中填入 NAS 地址、用户名和密码。确保绿联 NAS 已开启 WebDAV 服务（控制面板 → 文件服务 → WebDAV）。');
        return;
    }
    
    const fullFilename = filename + '.md';
    const folder = currentEditor.type === 'articles' ? 'articles' : 'essays';
    
    // 禁用保存按钮，防止重复点击
    const saveBtn = document.getElementById('editor-save');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;
    
    showSyncStatus('正在保存...', 'syncing');
    
    let success = false;
    let lastError = '';
    
    try {
        if (needGitHub) {
            const result = await uploadToGitHub(folder, fullFilename, content);
            if (result.success) {
                success = true;
            } else {
                lastError = result.error || 'GitHub 上传失败';
            }
        }
        
        if (needNAS && !success) {
            const result = await uploadToNAS(folder, fullFilename, content);
            if (result.success) {
                success = true;
            } else {
                lastError = result.error || 'NAS 上传失败';
            }
        }
        
        if (needNAS && success && (CONFIG.storageSource === 'both')) {
            // both 模式：GitHub 成功后也上传 NAS
            await uploadToNAS(folder, fullFilename, content);
        }
    } catch (err) {
        lastError = err.message;
    }
    
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    
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
        showToast('success', '保存成功', `"${filename}" 已保存到${CONFIG.storageSource === 'nas' ? 'NAS' : 'GitHub'}。`);
    } else {
        showSyncStatus('保存失败', 'error');
        showToast('error', '保存失败', `${lastError}。请检查配置是否正确，或稍后重试。`);
    }
}

// ========== 文件上传 ==========
async function handleTextUpload(files, type) {
    const folder = type === 'articles' ? 'articles' : 'essays';
    const needGitHub = CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both';
    const needNAS = CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both';
    
    if (needGitHub && !CONFIG.github.token) {
        showToast('error', '无法上传', 'GitHub Token 未配置，请先在设置中配置。');
        return;
    }
    if (needNAS && (!CONFIG.nas.url || !CONFIG.nas.username)) {
        showToast('error', '无法上传', 'NAS 未配置，请先在设置中配置。');
        return;
    }
    
    for (const file of Array.from(files)) {
        const content = await readFileAsText(file);
        const filename = file.name;
        
        showSyncStatus(`正在上传 ${filename}...`, 'syncing');
        
        let success = false;
        
        if (needGitHub) {
            const result = await uploadToGitHub(folder, filename, content);
            success = result.success;
            if (!success) {
                showToast('error', `上传 ${filename} 失败`, result.error || '请检查 GitHub Token 是否有效。');
                continue;
            }
        }
        
        if (needNAS) {
            const result = await uploadToNAS(folder, filename, content);
            if (!result.success && !success) {
                showToast('error', `上传 ${filename} 失败`, result.error || '请检查 NAS 地址和账号密码是否正确。');
                continue;
            }
            success = true;
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

async function handleImageUpload(files) {
    const needGitHub = CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both';
    const needNAS = CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both';
    
    if (needGitHub && !CONFIG.github.token) {
        showToast('error', '无法上传', 'GitHub Token 未配置，请先在设置中配置。');
        return;
    }
    if (needNAS && (!CONFIG.nas.url || !CONFIG.nas.username)) {
        showToast('error', '无法上传', 'NAS 未配置，请先在设置中配置。');
        return;
    }
    
    for (const file of Array.from(files)) {
        const content = await readFileAsBase64(file);
        const filename = file.name;
        const isRaw = RAW_FORMATS.some(ext => filename.toLowerCase().endsWith(ext));
        
        showSyncStatus(`正在上传 ${filename}...`, 'syncing');
        
        let success = false;
        
        if (needGitHub) {
            const result = await uploadToGitHub('images', filename, content, true);
            success = result.success;
            if (!success) {
                showToast('error', `上传图片失败`, result.error || '请检查 GitHub Token 是否有效。注意：GitHub 单文件限制 100MB。');
                continue;
            }
        }
        
        if (needNAS) {
            const result = await uploadToNAS('images', filename, content, true);
            if (!result.success && !success) {
                showToast('error', `上传图片失败`, result.error || '请检查 NAS 地址和账号密码。');
                continue;
            }
            success = true;
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

async function handleVideoUpload(files) {
    const needGitHub = CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both';
    const needNAS = CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both';
    
    if (needGitHub && !CONFIG.github.token) {
        showToast('error', '无法上传', 'GitHub Token 未配置，请先在设置中配置。');
        return;
    }
    if (needNAS && (!CONFIG.nas.url || !CONFIG.nas.username)) {
        showToast('error', '无法上传', 'NAS 未配置，请先在设置中配置。');
        return;
    }
    
    for (const file of Array.from(files)) {
        const content = await readFileAsBase64(file);
        const filename = file.name;
        
        showSyncStatus(`正在上传 ${filename}...`, 'syncing');
        
        let success = false;
        
        if (needGitHub) {
            const result = await uploadToGitHub('videos', filename, content, true);
            success = result.success;
            if (!success) {
                showToast('error', `上传视频失败`, result.error || '请检查 GitHub Token 是否有效。注意：GitHub 单文件限制 100MB。');
                continue;
            }
        }
        
        if (needNAS) {
            const result = await uploadToNAS('videos', filename, content, true);
            if (!result.success && !success) {
                showToast('error', `上传视频失败`, result.error || '请检查 NAS 地址和账号密码。');
                continue;
            }
            success = true;
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

// ========== 文件读取工具 ==========
function readFileAsText(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
    });
}

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

// ========== 上传到 GitHub（返回详细结果） ==========
async function uploadToGitHub(folder, filename, content, isBinary = false) {
    if (!CONFIG.github.token) {
        return { success: false, error: 'GitHub Token 为空' };
    }
    
    try {
        const path = `${folder}/${filename}`;
        const encodedContent = isBinary ? content : btoa(unescape(encodeURIComponent(content)));
        
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
            } else if (checkResponse.status === 401) {
                return { success: false, error: 'GitHub Token 无效或已过期，请重新生成一个有 repo 权限的 Token。' };
            } else if (checkResponse.status === 403) {
                return { success: false, error: 'GitHub API 请求被拒绝，可能是 Token 权限不足或请求次数超限。请检查 Token 是否有 repo 权限。' };
            } else if (checkResponse.status === 404) {
                // 文件不存在，正常情况，继续创建
            }
        } catch (e) {
            // 网络错误，继续尝试创建
        }
        
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
        
        if (response.ok) {
            return { success: true };
        }
        
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
            return { success: false, error: 'GitHub Token 无效或已过期，请到 GitHub Settings → Developer settings 重新生成。' };
        } else if (response.status === 403) {
            return { success: false, error: '权限不足，请确保 Token 有 repo 权限，且仓库不是通过 GitHub Free 的限制。' };
        } else if (response.status === 409) {
            return { success: false, error: '文件冲突，可能文件在上传过程中被修改。请稍后重试。' };
        } else if (response.status === 422) {
            return { success: false, error: `请求参数错误：${errorData.message || '文件可能过大或格式不正确'}` };
        } else if (response.status === 413) {
            return { success: false, error: '文件过大，GitHub 单文件限制为 100MB。建议使用 NAS 存储大文件。' };
        }
        
        return { success: false, error: `GitHub 上传失败（${response.status}）：${errorData.message || '未知错误'}` };
    } catch (error) {
        return { success: false, error: `网络错误：无法连接到 GitHub。请检查网络连接是否正常。(${error.message})` };
    }
}

// ========== 上传到 NAS（返回详细结果） ==========
async function uploadToNAS(folder, filename, content, isBinary = false) {
    if (!CONFIG.nas.url || !CONFIG.nas.username) {
        return { success: false, error: 'NAS 地址或用户名未配置' };
    }
    
    try {
        const path = `${CONFIG.nas.basePath}/${folder}/${filename}`;
        const url = `${CONFIG.nas.url}${encodeURIComponent(path)}`;
        
        let body;
        if (isBinary) {
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
                'Content-Type': isBinary ? 'application/octet-stream' : 'text/plain; charset=utf-8'
            },
            body: body
        });
        
        if (response.ok || response.status === 201) {
            return { success: true };
        }
        
        if (response.status === 401) {
            return { success: false, error: 'NAS 用户名或密码错误，请检查设置中的 NAS 配置。' };
        } else if (response.status === 403) {
            return { success: false, error: 'NAS 权限不足，请检查用户是否有该目录的写入权限。' };
        } else if (response.status === 404) {
            return { success: false, error: `NAS 目录不存在：${CONFIG.nas.basePath}/${folder}。请先在 NAS 上创建该文件夹。` };
        } else if (response.status === 409) {
            return { success: false, error: 'NAS 目录冲突，请检查路径配置是否正确。' };
        }
        
        return { success: false, error: `NAS 上传失败（${response.status}），请检查 NAS 是否在线及 WebDAV 服务是否开启。` };
    } catch (error) {
        return { success: false, error: `无法连接到 NAS（${CONFIG.nas.url}）。请检查：1) NAS 是否开机 2) IP 地址是否正确 3) WebDAV 服务是否已开启（控制面板 → 文件服务 → WebDAV）4) 是否在同一网络下。` };
    }
}

// ========== 加载数据 ==========
async function loadData() {
    showSyncStatus('正在加载数据...', 'syncing');
    
    try {
        const needGitHub = CONFIG.storageSource === 'github' || CONFIG.storageSource === 'both';
        const needNAS = CONFIG.storageSource === 'nas' || CONFIG.storageSource === 'both';
        
        if (needGitHub && !CONFIG.github.token) {
            showToast('info', 'GitHub 未配置', '当前存储源包含 GitHub，但未配置 Token。如需从 GitHub 加载数据，请在设置中配置。');
        } else if (needGitHub) {
            await loadFromGitHub();
        }
        
        if (needNAS && (!CONFIG.nas.url || !CONFIG.nas.username)) {
            showToast('info', 'NAS 未配置', '当前存储源包含 NAS，但未配置地址或账号。如需从 NAS 加载数据，请在设置中配置。');
        } else if (needNAS) {
            await loadFromNAS();
        }
        
        showSyncStatus('加载完成！', 'success');
        renderAll();
    } catch (error) {
        showSyncStatus('加载失败', 'error');
        showToast('error', '数据加载失败', `${error.message}。请检查网络连接和配置后刷新页面重试。`);
        renderAll();
    }
}

async function loadFromGitHub() {
    if (!CONFIG.github.token) return;
    
    data.articles = await loadFolderFromGitHub('articles', 'text');
    data.essays = await loadFolderFromGitHub('essays', 'text');
    data.images = await loadFolderFromGitHub('images', 'image');
    data.videos = await loadFolderFromGitHub('videos', 'video');
}

async function loadFromNAS() {
    if (!CONFIG.nas.url || !CONFIG.nas.username) return;
    
    const nasArticles = await loadFolderFromNAS('articles', 'text');
    const nasEssays = await loadFolderFromNAS('essays', 'text');
    const nasImages = await loadFolderFromNAS('images', 'image');
    const nasVideos = await loadFolderFromNAS('videos', 'video');
    
    data.articles = mergeData(data.articles, nasArticles);
    data.essays = mergeData(data.essays, nasEssays);
    data.images = mergeData(data.images, nasImages);
    data.videos = mergeData(data.videos, nasVideos);
}

function mergeData(existing, newData) {
    const existingNames = new Set(existing.map(item => item.filename));
    const uniqueNew = newData.filter(item => !existingNames.has(item.filename));
    return [...existing, ...uniqueNew];
}

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
            if (response.status === 401) {
                showToast('error', 'GitHub Token 无效', '加载 GitHub 数据时认证失败，请检查 Token 是否正确。');
                return [];
            }
            return [];
        }
        
        const files = await response.json();
        const items = [];
        
        for (const file of files) {
            if (file.type !== 'file') continue;
            
            try {
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
            } catch (e) {
                console.warn(`跳过加载文件: ${file.name}`, e);
            }
        }
        
        return items;
    } catch (error) {
        console.error(`Error loading ${folder} from GitHub:`, error);
        return [];
    }
}

async function loadFolderFromNAS(folder, type) {
    try {
        const path = `${CONFIG.nas.basePath}/${folder}`;
        const url = `${CONFIG.nas.url}${encodeURIComponent(path)}`;
        
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
            if (response.status === 404) {
                return [];
            }
            if (response.status === 401) {
                showToast('error', 'NAS 认证失败', `无法访问 NAS 目录 ${folder}，用户名或密码错误。`);
                return [];
            }
            return [];
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
            
            if (isCollection || !displayName || displayName === folder) continue;
            
            const fileUrl = `${CONFIG.nas.url}${href}`;
            
            try {
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
            } catch (e) {
                console.warn(`跳过加载 NAS 文件: ${displayName}`, e);
            }
        }
        
        return items;
    } catch (error) {
        console.error(`Error loading ${folder} from NAS:`, error);
        return [];
    }
}

// ========== 同步状态 ==========
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
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    }
}

// ========== 工具函数 ==========
function getImageFormat(filename) {
    const ext = filename.split('.').pop().toUpperCase();
    return ext || 'IMAGE';
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========== 渲染 ==========
function renderAll() {
    renderArticles();
    renderEssays();
    renderImages();
    renderVideos();
}

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

// ========== 模态框 ==========
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

function openTextModal(type, id) {
    const item = data[type].find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('text-modal-title').textContent = item.title;
    document.getElementById('text-modal-body').textContent = item.content;
    
    document.getElementById('text-modal').classList.add('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ========== 配置 ==========
function initConfig() {
    const configBtn = document.getElementById('config-btn');
    const saveBtn = document.getElementById('save-config');
    
    document.getElementById('github-token').value = CONFIG.github.token;
    document.getElementById('repo-owner').value = CONFIG.github.owner;
    document.getElementById('repo-name').value = CONFIG.github.repo;
    document.getElementById('repo-branch').value = CONFIG.github.branch;
    
    document.getElementById('storage-source').value = CONFIG.storageSource;
    document.getElementById('nas-url').value = CONFIG.nas.url;
    document.getElementById('nas-username').value = CONFIG.nas.username;
    document.getElementById('nas-password').value = CONFIG.nas.password;
    document.getElementById('nas-basepath').value = CONFIG.nas.basePath;
    
    document.querySelectorAll('.config-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(tab.dataset.tab + '-config').classList.add('active');
        });
    });
    
    configBtn.addEventListener('click', () => {
        document.getElementById('config-modal').classList.add('active');
    });
    
    saveBtn.addEventListener('click', saveConfig);
}

function saveConfig() {
    const githubToken = document.getElementById('github-token').value.trim();
    const owner = document.getElementById('repo-owner').value.trim();
    const repo = document.getElementById('repo-name').value.trim();
    const branch = document.getElementById('repo-branch').value.trim();
    
    const storageSource = document.getElementById('storage-source').value;
    const nasUrl = document.getElementById('nas-url').value.trim();
    const nasUsername = document.getElementById('nas-username').value.trim();
    const nasPassword = document.getElementById('nas-password').value;
    const nasBasePath = document.getElementById('nas-basepath').value.trim();
    
    // 校验
    if (storageSource === 'github' || storageSource === 'both') {
        if (!githubToken) {
            showConfigStatus('请填写 GitHub Token', 'error');
            return;
        }
    }
    
    if (storageSource === 'nas' || storageSource === 'both') {
        if (!nasUrl || !nasUsername) {
            showConfigStatus('请填写 NAS 地址和用户名', 'error');
            return;
        }
    }
    
    localStorage.setItem('github_token', githubToken);
    localStorage.setItem('github_owner', owner);
    localStorage.setItem('github_repo', repo);
    localStorage.setItem('github_branch', branch);
    
    localStorage.setItem('storage_source', storageSource);
    localStorage.setItem('nas_url', nasUrl);
    localStorage.setItem('nas_username', nasUsername);
    localStorage.setItem('nas_password', nasPassword);
    localStorage.setItem('nas_basepath', nasBasePath);
    
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
    
    showConfigStatus('配置保存成功！即将重新加载数据...', 'success');
    
    setTimeout(() => {
        closeAllModals();
        loadData();
    }, 1000);
}

function showConfigStatus(message, type) {
    const statusEl = document.getElementById('config-status');
    statusEl.textContent = message;
    statusEl.className = `config-status ${type}`;
}

// ========== 工具 ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});
