const CACHE_NAME = 'padaria-v1.0.0';
const STATIC_CACHE = 'padaria-static-v1.0.0';
const DYNAMIC_CACHE = 'padaria-dynamic-v1.0.0';

// Arquivos para cache estático
const STATIC_FILES = [
    '/',
    '/pages/landing_page.html',
    '/pages/menu_simples.html',
    '/pages/admin-login.html',
    '/pages/admin-panel.html',
    '/css/styles.css',
    '/js/cart.js',
    '/js/admin.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Arquivos para cache dinâmico
const DYNAMIC_FILES = [
    '/api/',
    '/images/',
    '/icons/'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('🚀 Service Worker instalado');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 Cache estático aberto');
                return cache.addAll(STATIC_FILES);
            })
            .catch((error) => {
                console.error('❌ Erro ao instalar cache estático:', error);
            })
    );
    
    // Ativar imediatamente
    self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker ativado');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Remover caches antigos
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('🗑️ Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
    );
    
    // Tomar controle de todas as páginas
    self.clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Estratégia de cache: Cache First para arquivos estáticos
    if (isStaticFile(request)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Estratégia de cache: Network First para APIs
    if (isApiRequest(request)) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Estratégia de cache: Stale While Revalidate para outros recursos
    event.respondWith(staleWhileRevalidate(request));
});

// Verificar se é arquivo estático
function isStaticFile(request) {
    const url = new URL(request.url);
    return STATIC_FILES.includes(url.pathname) || 
           STATIC_FILES.includes(url.href) ||
           request.destination === 'style' ||
           request.destination === 'script' ||
           request.destination === 'image';
}

// Verificar se é requisição de API
function isApiRequest(request) {
    const url = new URL(request.url);
    return url.pathname.startsWith('/api/');
}

// Estratégia: Cache First
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('📦 Servindo do cache:', request.url);
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('❌ Erro na estratégia Cache First:', error);
        
        // Fallback para cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback offline
        return offlineFallback(request);
    }
}

// Estratégia: Network First
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('❌ Erro na estratégia Network First:', error);
        
        // Fallback para cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback offline
        return offlineFallback(request);
    }
}

// Estratégia: Stale While Revalidate
async function staleWhileRevalidate(request) {
    try {
        const cachedResponse = await caches.match(request);
        
        // Buscar nova versão em background
        const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
                const cache = await caches.open(DYNAMIC_CACHE);
                cache.put(request, response.clone());
            }
            return response;
        });
        
        // Retornar cache se disponível, senão aguardar network
        return cachedResponse || fetchPromise;
    } catch (error) {
        console.error('❌ Erro na estratégia Stale While Revalidate:', error);
        
        // Fallback para cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback offline
        return offlineFallback(request);
    }
}

// Fallback offline
async function offlineFallback(request) {
    const url = new URL(request.url);
    
    // Página offline personalizada
    if (request.destination === 'document') {
        return new Response(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - Padaria</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: linear-gradient(135deg, #f97316, #f59e0b);
                        color: white;
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .offline-container {
                        background: rgba(255,255,255,0.1);
                        padding: 40px;
                        border-radius: 20px;
                        backdrop-filter: blur(10px);
                    }
                    h1 { font-size: 2.5em; margin-bottom: 20px; }
                    p { font-size: 1.2em; margin-bottom: 30px; }
                    .retry-btn {
                        background: white;
                        color: #f97316;
                        padding: 15px 30px;
                        border: none;
                        border-radius: 25px;
                        font-size: 1.1em;
                        cursor: pointer;
                        transition: transform 0.3s;
                    }
                    .retry-btn:hover { transform: scale(1.05); }
                </style>
            </head>
            <body>
                <div class="offline-container">
                    <h1>📱 Offline</h1>
                    <p>Parece que você está sem conexão com a internet.</p>
                    <p>Algumas funcionalidades podem não estar disponíveis.</p>
                    <button class="retry-btn" onclick="window.location.reload()">
                        🔄 Tentar Novamente
                    </button>
                </div>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    // Imagem offline
    if (request.destination === 'image') {
        return new Response(`
            <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="200" fill="#f3f4f6"/>
                <text x="100" y="100" text-anchor="middle" fill="#9ca3af" font-size="16">
                    Imagem não disponível offline
                </text>
            </svg>
        `, {
            headers: { 'Content-Type': 'image/svg+xml' }
        });
    }
    
    // Resposta padrão offline
    return new Response('Recurso não disponível offline', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

// Sincronização em background
self.addEventListener('sync', (event) => {
    console.log('🔄 Sincronização em background:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(backgroundSync());
    }
});

// Função de sincronização em background
async function backgroundSync() {
    try {
        console.log('🔄 Executando sincronização em background...');
        
        // Aqui você pode sincronizar dados offline
        // Por exemplo, enviar pedidos que foram feitos offline
        
        console.log('✅ Sincronização em background concluída');
    } catch (error) {
        console.error('❌ Erro na sincronização em background:', error);
    }
}

// Push notifications
self.addEventListener('push', (event) => {
    console.log('🔔 Push notification recebida');
    
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Nova notificação da Padaria',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            data: data.data || {},
            actions: [
                {
                    action: 'view',
                    title: 'Ver',
                    icon: '/icons/icon-72x72.png'
                },
                {
                    action: 'close',
                    title: 'Fechar',
                    icon: '/icons/icon-72x72.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'Padaria', options)
        );
    }
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
    console.log('👆 Notificação clicada:', event.action);
    
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
    console.log('💬 Mensagem recebida:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

console.log('🚀 Service Worker carregado:', CACHE_NAME);
