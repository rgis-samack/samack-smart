// DASHBOARD APP STATE
let catalogData = null;
let activeTab = 'canais'; // 'canais', 'filmes', 'series'
let activeCategory = 'all';
let searchQuery = '';
let categorySearchQuery = '';

// API Cover to Name Map
let apiCoverMap = {};

// Pagination variables (lazy loading to prevent browser freeze with 10k+ items)
let currentPage = 1;
const itemsPerPage = 60;
let filteredItems = [];

// DOM ELEMENTS
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const noDataView = document.getElementById('no-data-view');
const dashboardDataView = document.getElementById('dashboard-data-view');
const catalogGrid = document.getElementById('catalog-grid');
const globalSearch = document.getElementById('global-search');
const categorySearch = document.getElementById('category-search');
const categoryListContainer = document.getElementById('category-list');
const btnLoadMore = document.getElementById('btn-load-more');
const loadMoreBox = document.getElementById('load-more-box');
const displayedCountLabel = document.getElementById('displayed-items-count');
const totalCountLabel = document.getElementById('total-items-count');

// Tab buttons
const tabButtons = document.querySelectorAll('.tab-btn');

// Account summary metrics
const headerStatusDot = document.getElementById('header-status-dot');
const headerAccountStatus = document.getElementById('header-account-status');
const accountStatusSummary = document.getElementById('account-status-summary');
const metricAccStatus = document.getElementById('acc-status');
const metricAccMessage = document.getElementById('acc-message');
const metricAccExpiration = document.getElementById('acc-expiration');
const metricAccDaysLeft = document.getElementById('acc-days-left');
const metricAccConnections = document.getElementById('acc-connections');
const connectionsProgress = document.getElementById('connections-progress');
const metricSrvInfo = document.getElementById('srv-info');
const metricSrvTimezone = document.getElementById('srv-timezone');

// Video Player Modal
const playerModal = document.getElementById('player-modal');
const modalContent = playerModal.querySelector('.modal-content');
const modalBodyContainer = document.getElementById('modal-body-container');
const modalTitle = document.getElementById('modal-title');
const modalCategory = document.getElementById('modal-category');
const modalStreamUrl = document.getElementById('modal-stream-url');
const vlcPlayLink = document.getElementById('vlc-play-link');
const btnCopyUrl = document.getElementById('btn-copy-url');
const modalCloseBtn = document.getElementById('modal-close-btn');
const videoPlayer = document.getElementById('video-player');
const playerError = document.getElementById('player-error');

// Series elements inside modal
const modalSeriesSidebar = document.getElementById('modal-series-sidebar');
const modalSeasonSelect = document.getElementById('modal-season-select');
const modalEpisodesList = document.getElementById('modal-episodes-list');

let hlsPlayerInstance = null;
let mpegtsPlayerInstance = null;
let currentSeriesSelected = null;
let currentEpisodeSelected = null;

// INIT EVENTS
document.addEventListener('DOMContentLoaded', () => {
    detectDevice();
    setupDragAndDrop();
    setupFileInput();
    setupTabs();
    setupSearch();
    setupLoadMore();
    setupModalEvents();
});

// DETECT ACCESSED DEVICE
function detectDevice() {
    const ua = navigator.userAgent.toLowerCase();
    let device = 'desktop';
    let icon = 'fa-desktop';
    let label = 'Desktop';
    
    const isTV = /smarttv|smart-tv|googletv|appletv|hbbtv|tizen|webos|crkey|roku|playstation|xbox|large screen/i.test(ua) || 
                 (ua.includes('tv') && !ua.includes('mobile'));
                 
    if (isTV) {
        device = 'tv';
        icon = 'fa-tv';
        label = 'Smart TV';
    } else if (/mobi|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
        device = 'smartphone';
        icon = 'fa-mobile-screen-button';
        label = 'Smartphone';
    }
    
    document.body.className = '';
    document.body.classList.add(`device-${device}`);
    
    const indicator = document.getElementById('device-indicator');
    if (indicator) {
        indicator.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${label}</span>`;
        indicator.className = `device-badge badge-${device}`;
    }
    
    console.log("Dispositivo detectado:", device);
    return device;
}

// FILE UPLOADING AND PARSING
function setupFileInput() {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

function setupDragAndDrop() {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

function handleFile(file) {
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (extension === '.json') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let normalizedData;
                if (Array.isArray(data)) {
                    normalizedData = normalizeFlatJsonArray(data);
                } else {
                    normalizedData = normalizeCatalogObject(data);
                }
                await processCatalogData(normalizedData);
            } catch (err) {
                alert('Erro ao processar o arquivo JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
    } else if (extension === '.m3u' || extension === '.m3u8') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const catalog = parseM3UContent(e.target.result);
                await processCatalogData(catalog);
            } catch (err) {
                alert('Erro ao processar o arquivo M3U: ' + err.message);
            }
        };
        reader.readAsText(file);
    } else if (extension === '.db' || extension === '.sqlite') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const catalog = await parseSQLiteBuffer(e.target.result);
                await processCatalogData(catalog);
            } catch (err) {
                alert('Erro ao ler o banco de dados SQLite: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert('Formato de arquivo não suportado! Por favor envie .json, .m3u, .m3u8, .db ou .sqlite');
    }
}

// HELPER PARSER FUNCTIONS
function normalizeFlatJsonArray(arrayData) {
    const catalog = {
        canais: [],
        filmes: [],
        series: [],
        dados_usuario: {},
        dados_servidor: {}
    };
    
    arrayData.forEach(item => {
        const url = item.url || item.url_stream || item.link || '';
        const titulo = item.nome || item.titulo || item.name || 'Sem Título';
        const grupo = item.categoria || item.grupo || item.category || 'Sem Categoria';
        const logo = item.logo || item.image || '';
        
        let tipo = item.tipo || '';
        if (!tipo) {
            const urlLower = url.toLowerCase();
            if (urlLower.includes('/movie/')) {
                tipo = 'filme';
            } else if (urlLower.includes('/series/')) {
                tipo = 'serie';
            } else {
                tipo = 'canal';
            }
        }
        
        const normalizedItem = {
            titulo: titulo,
            grupo: grupo,
            logo: logo,
            url_stream: url,
            tipo: tipo
        };
        
        if (tipo === 'filme') {
            catalog.filmes.push(normalizedItem);
        } else if (tipo === 'serie') {
            catalog.series.push(normalizedItem);
        } else {
            catalog.canais.push(normalizedItem);
        }
    });
    
    return catalog;
}

function normalizeCatalogObject(data) {
    const catalog = {
        canais: [],
        filmes: [],
        series: [],
        dados_usuario: data.dados_usuario || {},
        dados_servidor: data.dados_servidor || {}
    };
    
    const mapItem = (item, defaultType) => {
        const url = item.url || item.url_stream || item.link || '';
        const titulo = item.nome || item.titulo || item.name || 'Sem Título';
        const grupo = item.categoria || item.grupo || item.category || 'Sem Categoria';
        const logo = item.logo || item.image || '';
        const tipo = item.tipo || defaultType;
        return { titulo, grupo, logo, url_stream: url, tipo };
    };
    
    if (Array.isArray(data.canais)) {
        catalog.canais = data.canais.map(i => mapItem(i, 'canal'));
    }
    if (Array.isArray(data.filmes)) {
        catalog.filmes = data.filmes.map(i => mapItem(i, 'filme'));
    }
    if (Array.isArray(data.series)) {
        catalog.series = data.series.map(i => mapItem(i, 'serie'));
    }
    
    // Suporte caso o objeto venha no formato de array plano sob outra chave
    if (catalog.canais.length === 0 && catalog.filmes.length === 0 && catalog.series.length === 0) {
        for (const key in data) {
            if (Array.isArray(data[key])) {
                const normalized = normalizeFlatJsonArray(data[key]);
                catalog.canais = catalog.canais.concat(normalized.canais);
                catalog.filmes = catalog.filmes.concat(normalized.filmes);
                catalog.series = catalog.series.concat(normalized.series);
            }
        }
    }
    
    return catalog;
}

function parseM3UContent(text) {
    const catalog = {
        canais: [],
        filmes: [],
        series: [],
        dados_usuario: {},
        dados_servidor: {}
    };
    
    const lines = text.split('\n');
    let currentItem = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
            currentItem = {};
            
            // Extrair titulo (depois da ultima virgula)
            const commaIndex = line.lastIndexOf(',');
            if (commaIndex !== -1) {
                currentItem.titulo = line.substring(commaIndex + 1).trim();
            } else {
                currentItem.titulo = 'Sem Título';
            }
            
            // Extrair logo
            const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
            currentItem.logo = logoMatch ? logoMatch[1] : '';
            
            // Extrair grupo
            const groupMatch = line.match(/group-title="([^"]+)"/i);
            currentItem.grupo = groupMatch ? groupMatch[1] : 'Sem Categoria';
            
        } else if (line && !line.startsWith('#')) {
            if (currentItem) {
                currentItem.url_stream = line;
                
                const urlLower = line.toLowerCase();
                let tipo = 'canal';
                if (urlLower.includes('/movie/')) {
                    tipo = 'filme';
                } else if (urlLower.includes('/series/')) {
                    tipo = 'serie';
                }
                
                currentItem.tipo = tipo;
                
                if (tipo === 'filme') {
                    catalog.filmes.push(currentItem);
                } else if (tipo === 'serie') {
                    catalog.series.push(currentItem);
                } else {
                    catalog.canais.push(currentItem);
                }
                
                currentItem = null;
            }
        }
    }
    
    return catalog;
}

async function parseSQLiteBuffer(arrayBuffer) {
    // Inicializar sql.js WASM
    const SQL = await initSqlJs({
        locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
    });
    
    const db = new SQL.Database(new Uint8Array(arrayBuffer));
    
    const catalog = {
        canais: [],
        filmes: [],
        series: [],
        dados_usuario: {},
        dados_servidor: {}
    };
    
    try {
        const stmt = db.prepare("SELECT titulo, grupo, logo, url_stream, tipo FROM streams");
        while (stmt.step()) {
            const row = stmt.getAsObject();
            const item = {
                titulo: row.titulo || 'Sem Título',
                grupo: row.grupo || 'Sem Categoria',
                logo: row.logo || '',
                url_stream: row.url_stream || '',
                tipo: row.tipo || 'canal'
            };
            
            if (item.tipo === 'filme') {
                catalog.filmes.push(item);
            } else if (item.tipo === 'serie') {
                catalog.series.push(item);
            } else {
                catalog.canais.push(item);
            }
        }
        stmt.free();
    } catch (e) {
        console.error("Erro ao processar tabelas do SQLite:", e);
        throw new Error("Tabela 'streams' não encontrada no banco de dados SQLite selecionado.");
    }
    
    return catalog;
}

// FETCH DETAILED SERIES NAMES FROM API (IF CORS ALLOWS)
async function fetchSeriesNamesFromApi(streamUrl) {
    try {
        const match = streamUrl.match(/^(https?:\/\/[^\/]+)\/(?:series|movie|get\.php|player_api\.php|play)/i);
        if (!match) return;
        const host = match[1];
        
        let username = "";
        let password = "";
        if (streamUrl.includes('username=')) {
            username = streamUrl.match(/username=([^&]+)/)[1];
            password = streamUrl.match(/password=([^&]+)/)[1];
        } else {
            const parts = streamUrl.match(/\/(?:series|movie)\/([^\/]+)\/([^\/]+)/);
            if (parts) {
                username = parts[1];
                password = parts[2];
            }
        }
        
        if (host && username && password) {
            const apiTargetUrl = `${host}/player_api.php?username=${username}&password=${password}&action=get_series`;
            console.log("Tentando baixar nomes reais das séries via API para enriquecer o catálogo local...");
            const response = await fetch(apiTargetUrl);
            if (response.ok) {
                const seriesList = await response.json();
                seriesList.forEach(s => {
                    if (s.cover && s.name) {
                        const coverName = s.cover.substring(s.cover.lastIndexOf('/') + 1).toLowerCase();
                        apiCoverMap[coverName] = s.name;
                        apiCoverMap[s.cover.toLowerCase()] = s.name;
                    }
                });
                console.log("Mapeamento de nomes de séries finalizado com sucesso!");
            }
        }
    } catch (e) {
        console.warn("Bloqueio de CORS ou erro de rede ao tentar consultar get_series da API. O app utilizará o motor interno de regex para extrair os nomes das séries.");
    }
}

async function processCatalogData(data) {
    catalogData = data;
    apiCoverMap = {}; // Reset
    
    // Normalização básica caso falte alguma chave de array
    if (!catalogData.canais) catalogData.canais = [];
    if (!catalogData.filmes) catalogData.filmes = [];
    if (!catalogData.series) catalogData.series = [];
    
    // Buscar nomes de séries na API caso tenhamos algum stream de exemplo
    const firstSeriesStream = catalogData.series.length > 0 ? catalogData.series[0].url_stream : null;
    if (firstSeriesStream) {
        await fetchSeriesNamesFromApi(firstSeriesStream);
    }
    
    // Agrupar episódios de séries por Série Pai
    console.log("Iniciando agrupamento de episódios de séries...");
    catalogData.groupedSeries = groupSeriesList(catalogData.series);
    console.log("Agrupamento de séries finalizado. Total de séries:", catalogData.groupedSeries.length);

    // Ocultar view sem dados e mostrar dashboard
    noDataView.style.display = 'none';
    dashboardDataView.style.display = 'flex';
    
    // Exibir dados da conta
    renderAccountSummary();
    
    // Atualizar badges das tabs
    document.getElementById('badge-tab-canais').textContent = catalogData.canais.length;
    document.getElementById('badge-tab-filmes').textContent = catalogData.filmes.length;
    document.getElementById('badge-tab-series').textContent = catalogData.groupedSeries.length;
    
    // Definir tab padrão ativa com base no conteúdo disponível
    if (catalogData.canais.length > 0) {
        switchTab('canais');
    } else if (catalogData.filmes.length > 0) {
        switchTab('filmes');
    } else if (catalogData.groupedSeries.length > 0) {
        switchTab('series');
    } else {
        switchTab('canais');
    }
}

// GROUP SERIES ALGORITHM
function groupSeriesList(episodesList) {
    const seriesMap = {};
    
    episodesList.forEach(ep => {
        let title = ep.titulo || 'Sem Título';
        let logo = ep.logo || '';
        let grupo = ep.grupo || 'Sem Categoria';
        let url = ep.url_stream || '';
        
        let seasonNum = 1;
        let episodeNum = 1;
        let seriesName = '';
        
        // Expressões regulares inteligentes para extrair Temporada, Episódio e Nome
        const seMatch = title.match(/^(.*?)\s+S(\d+)\s*[E|EP](\d+)\b/i) || 
                        title.match(/^(.*?)\s+S(\d+)\s*\.\s*[E|EP](\d+)\b/i);
        const xMatch = title.match(/^(.*?)\s+(\d+)x(\d+)\b/i);
        const sMatch = title.match(/^(.*?)\s+S(\d+)\b/i);
        
        if (seMatch) {
            seriesName = seMatch[1].trim();
            seasonNum = parseInt(seMatch[2]);
            episodeNum = parseInt(seMatch[3]);
        } else if (xMatch) {
            seriesName = xMatch[1].trim();
            seasonNum = parseInt(xMatch[2]);
            episodeNum = parseInt(xMatch[3]);
        } else if (sMatch) {
            seriesName = sMatch[1].trim();
            seasonNum = parseInt(sMatch[2]);
            const epMatch = title.match(/[E|EP](\d+)\b/i);
            if (epMatch) episodeNum = parseInt(epMatch[1]);
        } else {
            const justSeMatch = title.match(/S(\d+)\s*[E|EP](\d+)/i);
            if (justSeMatch) {
                seriesName = ''; // Herda do logo ou API
                seasonNum = parseInt(justSeMatch[1]);
                episodeNum = parseInt(justSeMatch[2]);
            } else {
                seriesName = title;
                seasonNum = 1;
                episodeNum = 1;
            }
        }
        
        // Agrupar pelo logo se existir (todas as temps de uma mesma série dividem a mesma logo no Xtream)
        // se não houver logo, agrupa pelo nome da série
        const groupKey = logo ? logo : (seriesName ? seriesName : 'series_default');
        
        if (!seriesMap[groupKey]) {
            seriesMap[groupKey] = {
                id: groupKey,
                titulo: seriesName,
                logo: logo,
                grupo: grupo,
                tipo: 'serie',
                temporadas: {}
            };
        }
        
        const seriesObj = seriesMap[groupKey];
        if (!seriesObj.titulo && seriesName) {
            seriesObj.titulo = seriesName;
        }
        
        if (!seriesObj.temporadas[seasonNum]) {
            seriesObj.temporadas[seasonNum] = [];
        }
        
        // Adiciona episódio à temporada
        seriesObj.temporadas[seasonNum].push({
            titulo: title,
            url_stream: url,
            season: seasonNum,
            episode: episodeNum,
            grupo: grupo
        });
    });
    
    // Converter o mapa para array e enriquecer com nomes reais da API
    const seriesList = [];
    for (const key in seriesMap) {
        const s = seriesMap[key];
        
        // 1. Tentar mapear nome pela API
        if (s.logo) {
            const coverName = s.logo.substring(s.logo.lastIndexOf('/') + 1).toLowerCase();
            if (apiCoverMap[coverName]) {
                s.titulo = apiCoverMap[coverName];
            } else if (apiCoverMap[s.logo.toLowerCase()]) {
                s.titulo = apiCoverMap[s.logo.toLowerCase()];
            }
        }
        
        // 2. Se falhar, usa o nome do regex ou fallback do TMDB ID
        if (!s.titulo) {
            if (s.logo) {
                const tmdbMatch = s.logo.match(/\/([^\/]+)\.(jpg|png|jpeg)/i);
                if (tmdbMatch) {
                    s.titulo = `Série [TMDB ID: ${tmdbMatch[1].substring(0, 6)}]`;
                } else {
                    s.titulo = `Série Sem Nome (${s.grupo})`;
                }
            } else {
                s.titulo = `Série Sem Nome (${s.grupo})`;
            }
        }
        
        // Ordenar temporadas e episódios
        const sortedTemporadas = {};
        const seasonsKeys = Object.keys(s.temporadas).map(Number).sort((a, b) => a - b);
        
        seasonsKeys.forEach(seasonNum => {
            const eps = s.temporadas[seasonNum];
            // Ordena episódios numericamente
            eps.sort((a, b) => a.episode - b.episode);
            sortedTemporadas[seasonNum] = eps;
        });
        
        s.temporadas = sortedTemporadas;
        s.total_episodios = Object.values(s.temporadas).reduce((acc, curr) => acc + curr.length, 0);
        seriesList.push(s);
    }
    
    return seriesList;
}

// ACCOUNT METRICS RENDERER
function renderAccountSummary() {
    const user = catalogData.dados_usuario || {};
    const server = catalogData.dados_servidor || {};
    
    // Header status bar
    if (user.status) {
        accountStatusSummary.style.display = 'block';
        headerAccountStatus.textContent = user.status === 'Active' ? 'Ativo' : user.status;
        if (user.status === 'Active') {
            headerStatusDot.className = 'dot active';
        } else {
            headerStatusDot.className = 'dot';
        }
    } else {
        accountStatusSummary.style.display = 'none';
    }

    // Status Card
    metricAccStatus.textContent = user.status ? String(user.status).toUpperCase() : 'DESCONHECIDO';
    metricAccMessage.textContent = user.message || 'Sem mensagem do servidor';
    
    const cardStatus = document.getElementById('acc-status');
    if (user.status && String(user.status).toLowerCase() === 'active') {
        cardStatus.style.color = 'var(--neon-green)';
    } else if (user.status) {
        cardStatus.style.color = 'var(--neon-red)';
    } else {
        cardStatus.style.color = 'var(--fg-white)';
    }

    // Expiration Card
    if (user.exp_date === null || user.exp_date === undefined || user.exp_date === 'Ilimitado') {
        metricAccExpiration.textContent = 'ILIMITADO';
        metricAccDaysLeft.textContent = 'Acesso eterno';
    } else {
        const expTimestamp = parseInt(user.exp_date);
        if (!isNaN(expTimestamp)) {
            const expDate = new Date(expTimestamp * 1000);
            metricAccExpiration.textContent = expDate.toLocaleDateString('pt-BR');
            
            const diffTime = expDate.getTime() - new Date().getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                metricAccDaysLeft.textContent = `${diffDays} dias restantes`;
                metricAccDaysLeft.style.color = 'var(--neon-green)';
            } else {
                metricAccDaysLeft.textContent = `Expirou há ${Math.abs(diffDays)} dias`;
                metricAccDaysLeft.style.color = 'var(--neon-red)';
            }
        } else {
            metricAccExpiration.textContent = user.exp_date;
            metricAccDaysLeft.textContent = '';
        }
    }

    // Connections Card
    const activeCons = parseInt(user.active_cons) || 0;
    const maxCons = parseInt(user.max_connections) || 1;
    metricAccConnections.textContent = `${activeCons} / ${maxCons}`;
    
    const percentage = Math.min((activeCons / maxCons) * 100, 100);
    connectionsProgress.style.width = `${percentage}%`;
    if (activeCons >= maxCons) {
        connectionsProgress.style.backgroundColor = 'var(--neon-red)';
    } else if (activeCons > 0) {
        connectionsProgress.style.backgroundColor = 'var(--neon-orange)';
    } else {
        connectionsProgress.style.backgroundColor = 'var(--neon-cyan)';
    }

    // Server Card
    const srvName = server.xui ? 'XUI.one' : 'Xtream Codes';
    const srvVer = server.version ? `v${server.version}` : '';
    metricSrvInfo.textContent = `${srvName} ${srvVer}`.trim();
    metricSrvTimezone.textContent = server.timezone || 'Timezone Indefinido';
}

// TABS LOGIC
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    activeTab = tabName;
    activeCategory = 'all'; // reset categoria
    
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    globalSearch.value = '';
    searchQuery = '';
    categorySearch.value = '';
    categorySearchQuery = '';

    updateCategoryList();
    filterAndRenderCatalog(true);
}

// CATEGORIES LOGIC
function updateCategoryList() {
    // Escolher lista apropriada (series agrupadas ou plana para outros)
    const items = activeTab === 'series' ? (catalogData.groupedSeries || []) : (catalogData[activeTab] || []);
    
    const categoryCounts = {};
    items.forEach(item => {
        const cat = item.grupo || 'Sem Categoria';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    let categories = Object.keys(categoryCounts).map(name => {
        return { name, count: categoryCounts[name] };
    });
    categories.sort((a, b) => a.name.localeCompare(b.name));

    renderCategories(categories, items.length);
}

function renderCategories(categories, totalCount) {
    categoryListContainer.innerHTML = '';

    const allDiv = document.createElement('div');
    allDiv.className = `category-item ${activeCategory === 'all' ? 'active' : ''}`;
    allDiv.setAttribute('data-category', 'all');
    allDiv.innerHTML = `
        <span>Todas as Categorias</span>
        <span class="badge">${totalCount}</span>
    `;
    allDiv.addEventListener('click', () => selectCategory('all'));
    categoryListContainer.appendChild(allDiv);

    const filteredCats = categories.filter(c => 
        c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );

    filteredCats.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = `category-item ${activeCategory === cat.name ? 'active' : ''}`;
        catDiv.setAttribute('data-category', cat.name);
        catDiv.innerHTML = `
            <span>${cat.name}</span>
            <span class="badge">${cat.count}</span>
        `;
        catDiv.addEventListener('click', () => selectCategory(cat.name));
        categoryListContainer.appendChild(catDiv);
    });
}

function selectCategory(catName) {
    activeCategory = catName;
    
    const items = categoryListContainer.querySelectorAll('.category-item');
    items.forEach(item => {
        if (item.getAttribute('data-category') === catName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    filterAndRenderCatalog(true);
}

// FILTER AND RENDER GRID
function filterAndRenderCatalog(resetPagination = true) {
    if (resetPagination) {
        currentPage = 1;
    }

    const rawItems = activeTab === 'series' ? (catalogData.groupedSeries || []) : (catalogData[activeTab] || []);
    
    filteredItems = rawItems.filter(item => {
        const matchCategory = activeCategory === 'all' || item.grupo === activeCategory;
        const title = (item.titulo || '').toLowerCase();
        const group = (item.grupo || '').toLowerCase();
        const term = searchQuery.toLowerCase();
        const matchSearch = title.includes(term) || group.includes(term);
        
        return matchCategory && matchSearch;
    });

    totalCountLabel.textContent = filteredItems.length;

    const startIndex = 0;
    const endIndex = currentPage * itemsPerPage;
    const itemsToRender = filteredItems.slice(startIndex, endIndex);

    displayedCountLabel.textContent = itemsToRender.length;

    if (endIndex < filteredItems.length) {
        loadMoreBox.style.display = 'block';
    } else {
        loadMoreBox.style.display = 'none';
    }

    renderCatalogGrid(itemsToRender);
}

function renderCatalogGrid(items) {
    catalogGrid.innerHTML = '';
    
    if (items.length === 0) {
        catalogGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--fg-gray);">
                <i class="fa-solid fa-folder-open" style="font-size: 48px; margin-bottom: 16px; color: #202b3c;"></i>
                <p>Nenhum item corresponde aos filtros selecionados.</p>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'stream-card';
        
        let typeBadgeClass = 'badge-live';
        let typeText = 'Ao Vivo';
        let subtitleText = item.grupo || 'Sem Categoria';
        
        if (activeTab === 'filmes') {
            typeBadgeClass = 'badge-movie';
            typeText = 'Filme';
        } else if (activeTab === 'series') {
            typeBadgeClass = 'badge-series';
            typeText = 'Série';
            subtitleText = `${item.total_episodios} Episódios | ${item.grupo}`;
        }

        let logoHtml = '';
        if (item.logo && (item.logo.startsWith('http') || item.logo.startsWith('https'))) {
            logoHtml = `<img src="${item.logo}" alt="${item.titulo}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">`;
        }
        
        const initials = String(item.titulo || 'S').substring(0, 2).toUpperCase();
        const fallbackLogo = `<div class="logo-fallback" style="${item.logo ? 'display:none;' : ''}">${initials}</div>`;

        card.innerHTML = `
            <div class="card-logo-box">
                ${logoHtml}
                ${fallbackLogo}
                <div class="play-hover-overlay">
                    <i class="fa-solid fa-play"></i>
                </div>
            </div>
            <div class="card-info">
                <h4 title="${item.titulo}">${item.titulo}</h4>
                <div class="card-category" title="${subtitleText}">${subtitleText}</div>
                <div class="card-footer">
                    <span class="card-type-badge ${typeBadgeClass}">${typeText}</span>
                    <i class="fa-solid fa-circle-arrow-right card-action-btn"></i>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openPlayerModal(item));
        catalogGrid.appendChild(card);
    });
}

// SEARCH SETUP
function setupSearch() {
    let globalSearchTimeout;
    globalSearch.addEventListener('input', (e) => {
        clearTimeout(globalSearchTimeout);
        globalSearchTimeout = setTimeout(() => {
            searchQuery = e.target.value.trim();
            filterAndRenderCatalog(true);
        }, 300);
    });

    let catSearchTimeout;
    categorySearch.addEventListener('input', (e) => {
        clearTimeout(catSearchTimeout);
        catSearchTimeout = setTimeout(() => {
            categorySearchQuery = e.target.value.trim();
            updateCategoryList();
        }, 200);
    });
}

// LOAD MORE LOGIC
function setupLoadMore() {
    btnLoadMore.addEventListener('click', () => {
        currentPage++;
        filterAndRenderCatalog(false);
    });
}

// MODAL / VIDEO PLAYER LOGIC
function setupModalEvents() {
    modalCloseBtn.addEventListener('click', closePlayerModal);
    
    playerModal.addEventListener('click', (e) => {
        if (e.target === playerModal) {
            closePlayerModal();
        }
    });

    btnCopyUrl.addEventListener('click', () => {
        modalStreamUrl.select();
        document.execCommand('copy');
        
        const prevText = btnCopyUrl.innerHTML;
        btnCopyUrl.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        btnCopyUrl.style.borderColor = 'var(--neon-green)';
        btnCopyUrl.style.color = 'var(--neon-green)';
        
        setTimeout(() => {
            btnCopyUrl.innerHTML = prevText;
            btnCopyUrl.style.borderColor = '';
            btnCopyUrl.style.color = '';
        }, 1500);
    });

    // Evento de troca de temporada
    modalSeasonSelect.addEventListener('change', (e) => {
        if (currentSeriesSelected) {
            renderSeasonEpisodes(currentSeriesSelected, e.target.value);
        }
    });
}

function openPlayerModal(item) {
    playerError.style.display = 'none';
    videoPlayer.style.display = 'block';
    
    // Tratamento específico se for SÉRIE
    if (item.tipo === 'serie') {
        currentSeriesSelected = item;
        
        // Configurar classes de duas colunas na modal
        modalContent.classList.add('series-width');
        modalBodyContainer.classList.add('series-layout');
        modalSeriesSidebar.style.display = 'flex';
        
        modalTitle.textContent = item.titulo;
        modalCategory.textContent = item.grupo || 'Sem Categoria';
        
        // Povoar o seletor de temporadas
        modalSeasonSelect.innerHTML = '';
        const seasons = Object.keys(item.temporadas);
        seasons.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = `Temporada ${s}`;
            modalSeasonSelect.appendChild(opt);
        });
        
        // Carregar episódios da primeira temporada disponível
        if (seasons.length > 0) {
            renderSeasonEpisodes(item, seasons[0]);
        }
        
    } else {
        // Layout padrão para VODs individuais (Filme / Live)
        currentSeriesSelected = null;
        modalContent.classList.remove('series-width');
        modalBodyContainer.classList.remove('series-layout');
        modalSeriesSidebar.style.display = 'none';
        
        modalTitle.textContent = item.titulo;
        modalCategory.textContent = item.grupo || 'Sem Categoria';
        
        // Tocar stream imediatamente
        playMediaStream(item.url_stream);
    }

    // Ativar modal
    playerModal.classList.add('active');
}

function renderSeasonEpisodes(series, seasonNum) {
    modalEpisodesList.innerHTML = '';
    const eps = series.temporadas[seasonNum] || [];
    
    eps.forEach((ep, index) => {
        const epDiv = document.createElement('div');
        epDiv.className = 'episode-item';
        epDiv.setAttribute('data-url', ep.url_stream);
        
        // Formatar nome amigável do ep: "Episódio XX" ou se o título for descritivo
        const cleanTitle = ep.titulo.replace(/S\d+E\d+/gi, '').replace(series.titulo, '').replace(/^[\s\-_,]+/g, '').trim();
        const epDisplayTitle = cleanTitle ? `Ep. ${ep.episode} - ${cleanTitle}` : `Episódio ${ep.episode}`;
        
        epDiv.innerHTML = `
            <span>${epDisplayTitle}</span>
            <i class="fa-solid fa-play-circle"></i>
        `;
        
        epDiv.addEventListener('click', () => {
            // Remover classe ativa dos outros
            const allItems = modalEpisodesList.querySelectorAll('.episode-item');
            allItems.forEach(item => item.classList.remove('active'));
            epDiv.classList.add('active');
            
            currentEpisodeSelected = ep;
            playMediaStream(ep.url_stream);
        });
        
        modalEpisodesList.appendChild(epDiv);
    });
    
    // Autoselecionar e tocar o primeiro episódio da lista
    if (eps.length > 0) {
        const firstEpItem = modalEpisodesList.querySelector('.episode-item');
        firstEpItem.click();
    }
}

let stallTimeout = null;

async function playMediaStream(streamUrl) {
    let resolvedUrl = streamUrl;
    
    // Detectar se é um link com redirecionamento de CDN/Gateway
    const needsRedirectResolve = streamUrl && (
        streamUrl.includes('/play/') || 
        streamUrl.includes('acxll.shop') || 
        streamUrl.includes('hx3060.com')
    );
    
    if (needsRedirectResolve) {
        console.log("Detectado link com redirecionamento. Resolvendo link final...");
        
        // Exibir indicador visual de carregamento na tela do player
        const warningBox = document.getElementById('mixed-content-warning');
        const errorTitle = document.getElementById('player-error-title');
        const errorDesc = document.getElementById('player-error-desc');
        const errorIcon = document.getElementById('player-error-icon');
        
        if (warningBox) warningBox.style.display = 'none';
        if (errorTitle) errorTitle.textContent = "Resolvendo link do servidor...";
        if (errorDesc) errorDesc.textContent = "Por favor, aguarde enquanto localizamos a mídia direta.";
        if (errorIcon) {
            errorIcon.className = "fa-solid fa-spinner fa-spin";
            errorIcon.style.color = "var(--neon-cyan)";
        }
        playerError.style.display = 'flex';
        videoPlayer.style.display = 'none';
        
        try {
            const res = await fetch('https://www.redirectcheck.org/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: streamUrl })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.final_result && data.final_result.final_url) {
                    resolvedUrl = data.final_result.final_url;
                    console.log("URL resolvida com sucesso para reprodução:", resolvedUrl);
                }
            }
        } catch (e) {
            console.error("Falha ao resolver redirecionamento via API:", e);
        }
        
        // Restaurar estado padrão da UI de erro caso seja necessário exibir erro depois
        if (errorIcon) {
            errorIcon.className = "fa-solid fa-circle-exclamation";
            errorIcon.style.color = "var(--neon-orange)";
        }
        if (errorTitle) errorTitle.textContent = "Este formato de mídia não pôde ser reproduzido diretamente no navegador.";
        if (errorDesc) errorDesc.textContent = "Recomendamos copiar o link e abrir no VLC ou outro player externo.";
        
        playerError.style.display = 'none';
        videoPlayer.style.display = 'block';
    }
    
    // Tratamento de segurança Mixed Content (HTTPS bloqueia HTTP)
    if (window.location.protocol === 'https:' && resolvedUrl.startsWith('http://')) {
        // Tentar forçar o protocolo seguro (HTTPS) para o stream de vídeo resolvido
        resolvedUrl = resolvedUrl.replace(/^http:\/\//i, 'https://');
        console.log("Ajustado protocolo do stream resolvido para HTTPS devido à página HTTPS:", resolvedUrl);
    }
    
    modalStreamUrl.value = resolvedUrl;
    
    // VLC Protocol link
    const rawUrl = resolvedUrl || '';
    const vlcUrl = rawUrl.replace(/^http:\/\//i, 'vlc://').replace(/^https:\/\//i, 'vlc://');
    vlcPlayLink.href = vlcUrl;
    
    playerError.style.display = 'none';
    videoPlayer.style.display = 'block';
    
    // Configurações do Elemento HTML5 de Vídeo
    videoPlayer.preload = "auto";
    videoPlayer.setAttribute('preload', 'auto');
    
    // Parar tocador anterior e limpar eventos de stall
    videoPlayer.pause();
    videoPlayer.src = '';
    clearTimeout(stallTimeout);
    
    if (hlsPlayerInstance) {
        hlsPlayerInstance.destroy();
        hlsPlayerInstance = null;
    }
    if (mpegtsPlayerInstance) {
        mpegtsPlayerInstance.destroy();
        mpegtsPlayerInstance = null;
    }
    
    // Lógica para recuperar de travamento (Stall/Waiting) em reprodução nativa (MP4)
    videoPlayer.addEventListener('waiting', () => {
        clearTimeout(stallTimeout);
        stallTimeout = setTimeout(() => {
            if (!videoPlayer.paused) {
                console.log("Stall detectado no player nativo. Ajustando currentTime em 0.1s para forçar o buffer...");
                videoPlayer.currentTime = videoPlayer.currentTime + 0.1;
            }
        }, 3500); // Se ficar carregando por mais de 3.5s, dá um empurrão
    });
    
    videoPlayer.addEventListener('playing', () => {
        clearTimeout(stallTimeout);
    });
    
    // Decidir player com base no formato
    const isLive = activeTab === 'canais';
    const isM3U8 = resolvedUrl.toLowerCase().includes('.m3u8');
    
    // Identificar se é stream MPEG-TS (Raw TS):
    // Links de canais ao vivo que não contêm .m3u8, ou links que contêm .ts
    const isMpegTS = (isLive && !isM3U8) || resolvedUrl.toLowerCase().includes('.ts') || (resolvedUrl.includes('/play/') && !resolvedUrl.includes('.mp4') && !resolvedUrl.includes('.mkv'));
    
    if (isM3U8) {
        // Tocador HLS (Aumentado o buffer em segundo plano e tolerância a quedas de rede)
        if (Hls.isSupported()) {
            const hlsConfig = {
                maxBufferLength: 120,             // Buffer máximo de 120 segundos
                maxMaxBufferLength: 240,          // Limite máximo do buffer acumulado (4 minutos)
                maxBufferSize: 200 * 1024 * 1024, // Limite de 200MB de cache na memória ram
                maxBufferHole: 2.0,               // Pular buracos de rede de até 2.0s sem travar
                lowBufferWatchdogPeriod: 1.0,     // Verificar buffer baixo a cada 1 segundo
                nudgeOffset: 0.1,                 // Empurrão de 0.1s caso trave
                nudgeMaxRetries: 8,               // Tentar destravar 8 vezes antes de parar
                enableWorker: true,               // Habilitar processamento de buffer em Worker de segundo plano
                progressive: true                 // Baixar segmentos de forma progressiva
            };
            
            hlsPlayerInstance = new Hls(hlsConfig);
            hlsPlayerInstance.loadSource(resolvedUrl);
            hlsPlayerInstance.attachMedia(videoPlayer);
            
            hlsPlayerInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                videoPlayer.play().catch(() => {
                    console.log('Autoplay cancelado ou bloqueado pelo navegador.');
                });
            });
            
            hlsPlayerInstance.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Erro de rede fatal detectado no buffer. Tentando reconectar...');
                            hlsPlayerInstance.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Erro de codificação/mídia detectado. Tentando recuperar o player...');
                            hlsPlayerInstance.recoverMediaError();
                            break;
                        default:
                            console.error('Erro de buffer irrecuperável HLS:', data.type);
                            showPlayerError(resolvedUrl);
                            break;
                    }
                }
            });
        } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari nativo HLS
            videoPlayer.src = resolvedUrl;
            videoPlayer.addEventListener('loadedmetadata', () => {
                videoPlayer.play();
            });
            videoPlayer.addEventListener('error', () => {
                showPlayerError(resolvedUrl);
            });
        } else {
            showPlayerError(resolvedUrl);
        }
    } else if (isMpegTS) {
        // Tocador MPEG-TS (usando mpegts.js) para canais ao vivo brutos
        if (mpegts.getFeatureList().mseLivePlayback) {
            console.log("Inicializando mpegts.js para stream raw TS:", resolvedUrl);
            try {
                mpegtsPlayerInstance = mpegts.createPlayer({
                    type: 'mpegts',
                    isLive: true,
                    url: resolvedUrl
                }, {
                    enableWorker: true,
                    lazyLoad: false,
                    stashInitialSize: 128 * 1024
                });
                
                mpegtsPlayerInstance.attachMediaElement(videoPlayer);
                mpegtsPlayerInstance.load();
                mpegtsPlayerInstance.play().catch((e) => {
                    console.warn("Autoplay mpegts bloqueado pelo navegador:", e);
                });
                
                // Tratar erros e reconexões do stream MPEG-TS
                mpegtsPlayerInstance.on(mpegts.ErrorTypes.NETWORK_ERROR, (e) => {
                    console.log("Erro de rede mpegts. Reconectando em 2s...");
                    setTimeout(() => {
                        if (mpegtsPlayerInstance) {
                            mpegtsPlayerInstance.unload();
                            mpegtsPlayerInstance.load();
                            mpegtsPlayerInstance.play().catch(() => {});
                        }
                    }, 2000);
                });
                
                mpegtsPlayerInstance.on(mpegts.ErrorTypes.MEDIA_ERROR, (e) => {
                    console.log("Erro de decodificação mpegts. Recarregando...");
                    if (mpegtsPlayerInstance) {
                        mpegtsPlayerInstance.unload();
                        mpegtsPlayerInstance.load();
                        mpegtsPlayerInstance.play().catch(() => {});
                    }
                });
            } catch (err) {
                console.error("Erro ao inicializar mpegts player:", err);
                showPlayerError(resolvedUrl);
            }
        } else {
            console.warn("MSE Live Playback (mpegts) não é suportado neste navegador.");
            showPlayerError(resolvedUrl);
        }
    } else {
        // VOD Direto (MP4, MKV, etc.)
        videoPlayer.src = resolvedUrl;
        videoPlayer.play().catch(() => {
            showPlayerError(resolvedUrl);
        });
        videoPlayer.addEventListener('error', () => {
            showPlayerError(resolvedUrl);
        });
    }
}

function showPlayerError(streamUrl = '') {
    videoPlayer.style.display = 'none';
    playerError.style.display = 'flex';
    
    const warningBox = document.getElementById('mixed-content-warning');
    const errorTitle = document.getElementById('player-error-title');
    const errorDesc = document.getElementById('player-error-desc');
    const errorIcon = document.getElementById('player-error-icon');
    
    if (warningBox) warningBox.style.display = 'none';
    if (errorTitle) errorTitle.textContent = "Este formato de mídia não pôde ser reproduzido diretamente no navegador.";
    if (errorDesc) errorDesc.textContent = "Recomendamos copiar o link e abrir no VLC ou outro player externo.";
    if (errorIcon) {
        errorIcon.className = "fa-solid fa-circle-exclamation";
        errorIcon.style.color = "var(--neon-orange)";
    }
    
    if (location.protocol === 'https:' && streamUrl && streamUrl.toLowerCase().startsWith('http://')) {
        console.warn("Mixed Content detectado! HTTPS bloqueou carregamento HTTP.");
        if (errorTitle) errorTitle.textContent = "Erro de Segurança HTTPS (Conteúdo Misto)";
        if (errorDesc) errorDesc.textContent = "Seu sinal de transmissão não é criptografado (HTTP), mas este site está rodando de forma segura (HTTPS).";
        if (errorIcon) {
            errorIcon.className = "fa-solid fa-shield-halved";
            errorIcon.style.color = "var(--neon-red)";
        }
        if (warningBox) warningBox.style.display = 'block';
    }
}

function closePlayerModal() {
    playerModal.classList.remove('active');
    
    // Reset classes de layout
    modalContent.classList.remove('series-width');
    modalBodyContainer.classList.remove('series-layout');
    modalSeriesSidebar.style.display = 'none';
    
    videoPlayer.pause();
    videoPlayer.src = '';
    
    if (hlsPlayerInstance) {
        hlsPlayerInstance.destroy();
        hlsPlayerInstance = null;
    }
    if (mpegtsPlayerInstance) {
        mpegtsPlayerInstance.destroy();
        mpegtsPlayerInstance = null;
    }
}
