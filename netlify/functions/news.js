const Parser = require('rss-parser');
const axios = require('axios');

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
    console.log('Starting news fetch...');

    // Fetch news from Russian RSS feeds
    const feeds = [
      'https://lenta.ru/rss',
      'https://ria.ru/export/rss2/index.xml',
      'https://tass.ru/rss/v2.xml'
    ];

    const allNews = [];
    console.log('Fetching RSS feeds...');

    for (const feedUrl of feeds) {
      try {
        console.log(`Fetching feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        const feedNews = feed.items.slice(0, 5).map(item => ({
          title: item.title,
          description: item.contentSnippet || item.summary || '',
          url: item.link
        }));
        allNews.push(...feedNews);
        console.log(`Fetched ${feedNews.length} items from ${feedUrl}`);
      } catch (feedError) {
        console.error(`Error fetching feed ${feedUrl}:`, feedError);
      }
    }

    console.log(`Total news collected: ${allNews.length}`);

    if (allNews.length === 0) {
      console.error('No news collected from RSS feeds');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Не удалось получить новости из RSS-лент' }),
      };
    }

    // Shuffle and limit to 10 news for better performance
    const shuffledNews = allNews.sort(() => 0.5 - Math.random()).slice(0, 10);
    console.log(`Processing ${shuffledNews.length} news items with AI...`);

    // Process news with AI (limit concurrency to avoid rate limits)
    const processedNews = [];
    for (const newsItem of shuffledNews) {
      try {
        const processed = await processNewsWithAI(newsItem);
        processedNews.push(processed);
      } catch (error) {
        console.error('Failed to process news item:', error);
        processedNews.push({
          title: newsItem.title,
          summary: 'Ошибка обработки новости',
          url: newsItem.url,
        });
      }
    }
    console.log('AI processing completed');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(processedNews),
    };
  } catch (error) {
    console.error('Main error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Внутренняя ошибка сервера', details: error.message }),
    };
  }
};

// Function to process news with AI
async function processNewsWithAI(newsItem) {
  const prompt = `Прокомментируй эту новость остроумно и сатирически: ${newsItem.title} - ${newsItem.description}`;

  try {
    console.log(`Processing news: ${newsItem.title.substring(0, 50)}...`);

    // Задержка для избежания rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    const IOINTELLIGENCE_API_KEY = process.env.IOINTELLIGENCE_API_KEY;
    if (!IOINTELLIGENCE_API_KEY) {
      console.error('IOINTELLIGENCE_API_KEY not set');
      throw new Error('IOINTELLIGENCE_API_KEY not set');
    }

    console.log('Making AI request...');
    const MODEL = 'openai/gpt-oss-120b';

    const response = await axios.post('https://api.intelligence.io.solutions/api/v1/chat/completions', {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `Ты — профессиональный стендап-комик и сатирик. Твоя задача - создавать остроумные, ироничные комментарии к новостям в стиле лучших комиков. Используй:

1. ИРОНИЮ - говори одно, подразумевай другое
2. САРКАЗМ - едкие замечания с подтекстом
3. ПАРАДОКСЫ - неожиданные повороты мысли
4. СРАВНЕНИЯ - смешные аналогии с повседневной жизнью
5. ПЕРЕФРАЗИРОВАНИЕ - переверни новость с ног на голову

Будь очень остроумным, современным и смешным. Отвечай ТОЛЬКО комментарием к новости. Максимум 2-3 предложения. Никаких заголовков, markdown или лишних слов.`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 150,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${IOINTELLIGENCE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    console.log('AI response received');

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      console.error('Invalid AI response structure:', response.data);
      throw new Error('Invalid AI response structure');
    }

    let summary = response.data.choices[0].message.content?.trim() || '';

    // Очистка сводки
    summary = summary
      .replace(/^```[a-z]*\s*\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    if (!summary) {
      console.error('Empty AI response');
      summary = 'Не удалось сгенерировать комментарий';
    }

    console.log(`AI summary generated: ${summary.substring(0, 50)}...`);

    return {
      title: newsItem.title,
      summary: summary,
      url: newsItem.url,
    };
  } catch (error) {
    console.error('Error processing news with AI:', error.message);
    console.error('Full error:', error);

    // Return failed item with error details
    return {
      title: newsItem.title,
      summary: `Ошибка обработки: ${error.message}`,
      url: newsItem.url,
    };
  }
}