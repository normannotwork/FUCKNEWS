document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('news-container');
    let newsItems = [];
    let currentIndex = 0;

    async function fetchNews() {
        try {
            const response = await fetch('/.netlify/functions/news');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const news = await response.json();
            if (news && news.length > 0) {
                newsItems = news;
                currentIndex = 0;
                displayNextNews();
            } else {
                throw new Error('No news data received');
            }
        } catch (error) {
            console.error('Error fetching news:', error);
            showErrorPlaque();
        }
    }

    function showErrorPlaque() {
        const plaque = document.createElement('div');
        plaque.className = 'news-plaque';
        plaque.innerHTML = `
            <h3>🚨 Ошибка загрузки</h3>
            <p>Не удалось загрузить новости. Попробуйте обновить страницу через минуту.</p>
        `;
        plaque.style.left = '50%';
        plaque.style.top = '50%';
        plaque.style.transform = 'translate(-50%, -50%)';
        plaque.style.animation = 'none';
        plaque.style.zIndex = '200';
        container.appendChild(plaque);
    }

    function displayNextNews() {
        if (currentIndex >= newsItems.length) {
            currentIndex = 0; // Loop back to start
        }

        const item = newsItems[currentIndex];
        const plaque = document.createElement('div');
        plaque.className = `news-plaque${item.summary === 'Failed to process.' ? ' failed' : ''}`;

        plaque.innerHTML = `<h3>${item.title}</h3><p>${item.summary}</p>`;

        // Random starting position (kept within bounds for visibility)
        plaque.style.left = `${Math.random() * 50}vw`;
        plaque.style.top = `${Math.random() * 50}vh`;

        // Stagger animations with random delays
        plaque.style.animationDelay = `${Math.random() * 5}s`;
        plaque.style.animationDuration = `${120 + Math.random() * 80}s`; // Very slow movement

        plaque.addEventListener('click', () => {
            window.open(item.url, '_blank');
            // Add click effect with smooth animation
            plaque.style.transform = 'scale(0.95) translateY(-2px)';
            plaque.style.boxShadow = '0 4px 12px var(--shadow-md), 0 2px 4px var(--shadow-sm)';
            setTimeout(() => {
                plaque.style.transform = '';
                plaque.style.boxShadow = '';
            }, 200);
        });

        // Add mouse enter/leave effects
        plaque.addEventListener('mouseenter', () => {
            plaque.style.zIndex = '100';
        });

        plaque.addEventListener('mouseleave', () => {
            plaque.style.zIndex = 'auto';
        });

        container.appendChild(plaque);

        // Remove plaque after animation completes
        setTimeout(() => {
            if (plaque.parentNode) {
                plaque.remove();
            }
        }, 240000); // Remove after 4 minutes

        currentIndex++;
    }

    // Removed emoji function as requested

    // Initial load
    fetchNews();

    // Refresh news every 5 minutes
    setInterval(fetchNews, 300000);

    // Add new plaques every 30-60 seconds (much slower)
    setInterval(() => {
        if (newsItems.length > 0) {
            displayNextNews();
        }
    }, 30000 + Math.random() * 30000);

    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Загружаем новости...</p>';
    document.body.appendChild(loadingIndicator);

    // Hide loading after first news load
    let loadingHidden = false;
    const hideLoading = () => {
        if (!loadingHidden) {
            loadingHidden = true;
            loadingIndicator.style.opacity = '0';
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 500);
        }
    };

    // Hide loading after fetch completes or timeout
    fetchNews().then(hideLoading);
    setTimeout(hideLoading, 10000); // Fallback timeout
});