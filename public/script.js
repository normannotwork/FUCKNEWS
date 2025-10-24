document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('news-container');
    let newsItems = [];
    let currentIndex = 0;

    async function fetchNews() {
        try {
            const response = await fetch('/.netlify/functions/news');
            const news = await response.json();
            newsItems = news;
            currentIndex = 0;
            displayNextNews();
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
        container.appendChild(plaque);
    }

    function displayNextNews() {
        if (currentIndex >= newsItems.length) {
            currentIndex = 0; // Loop back to start
        }

        const item = newsItems[currentIndex];
        const plaque = document.createElement('div');
        plaque.className = 'news-plaque';

        // Add emoji based on content sentiment (simple heuristic)
        const emoji = getRandomEmoji();
        plaque.innerHTML = `<h3>${emoji} ${item.title}</h3><p>${item.summary}</p>`;

        // Random starting position
        plaque.style.left = `${Math.random() * 80}vw`;
        plaque.style.top = `${Math.random() * 80}vh`;

        // Stagger animations with random delays
        plaque.style.animationDelay = `${Math.random() * 5}s`;
        plaque.style.animationDuration = `${20 + Math.random() * 10}s`; // Vary speed

        plaque.addEventListener('click', () => {
            window.open(item.url, '_blank');
            // Add click effect
            plaque.style.transform = 'scale(0.95)';
            setTimeout(() => {
                plaque.style.transform = '';
            }, 150);
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
        }, 30000); // Remove after 30 seconds

        currentIndex++;
    }

    function getRandomEmoji() {
        const emojis = ['📰', '📢', '🎭', '🤡', '🎪', '🎨', '🎭', '🎪', '🎨', '🎭'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    }

    // Initial load
    fetchNews();

    // Refresh news every 5 minutes
    setInterval(fetchNews, 300000);

    // Add new plaques every 3-8 seconds
    setInterval(() => {
        if (newsItems.length > 0) {
            displayNextNews();
        }
    }, 3000 + Math.random() * 5000);

    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Загружаем сатиру...</p>';
    loadingIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: white;
        z-index: 1000;
        font-family: 'Inter', sans-serif;
    `;
    document.body.appendChild(loadingIndicator);

    // Hide loading after first news load
    setTimeout(() => {
        loadingIndicator.style.display = 'none';
    }, 3000);
});