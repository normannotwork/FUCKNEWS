const Parser = require('rss-parser');

const parser = new Parser();

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Только GET-запросы разрешены' }),
    };
  }

  try {
    // Fetch news from Russian RSS feeds
    const feeds = [
      'https://lenta.ru/rss',
      'https://ria.ru/export/rss2/index.xml',
      'https://tass.ru/rss/v2.xml'
    ];

    const allNews = [];

    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const feedNews = feed.items.slice(0, 5).map(item => ({
          title: item.title,
          description: item.contentSnippet || item.summary || '',
          url: item.link
        }));
        allNews.push(...feedNews);
      } catch (feedError) {
        console.error(`Error fetching feed ${feedUrl}:`, feedError);
      }
    }

    // Shuffle and limit to 10 news for better performance
    const shuffledNews = allNews.sort(() => 0.5 - Math.random()).slice(0, 10);

    // Process news with AI
    const processedNews = await Promise.all(shuffledNews.map(processNewsWithAI));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(processedNews),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Внутренняя ошибка сервера' }),
    };
  }
};

// Function to process news with AI
async function processNewsWithAI(newsItem) {
  const prompt = `Прокомментируй эту новость остроумно и сатирически: ${newsItem.title} - ${newsItem.description}`;
  try {
    // Задержка для избежания rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    const IOINTELLIGENCE_API_KEY = process.env.IOINTELLIGENCE_API_KEY;
    if (!IOINTELLIGENCE_API_KEY) {
      throw new Error('IOINTELLIGENCE_API_KEY not set');
    }

    const MODEL = 'openai/gpt-oss-120b';

    const response = await axios.post('https://api.intelligence.io.solutions/api/v1/chat/completions', {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `Ты — остроумный сатирик в стиле КВН или Comedy Club. Создавай смешные, едкие комментарии к новостям с использованием иронии, сарказма и парадоксов. Будь остроумным, но не злым. Используй современный юмор, отсылки к поп-культуре и неожиданные повороты. Отвечай ТОЛЬКО комментарием. Никаких заголовков, markdown или лишних слов.`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 200,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${IOINTELLIGENCE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    let summary = response.data.choices[0].message.content?.trim() || '';

    // Очистка сводки
    summary = summary
      .replace(/^```[a-z]*\s*\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    return {
      title: newsItem.title,
      summary: summary,
      url: newsItem.url,
    };
  } catch (error) {
    console.error('Error processing news with AI:', error);
    return {
      title: newsItem.title,
      summary: 'Failed to process.',
      url: newsItem.url,
    };
  }
}