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
    console.log(`Starting sequential processing of ${shuffledNews.length} news items...`);

    for (let i = 0; i < shuffledNews.length; i++) {
      const newsItem = shuffledNews[i];
      console.log(`Processing item ${i + 1}/${shuffledNews.length}: ${newsItem.title.substring(0, 30)}...`);

      try {
        const processed = await processNewsWithAI(newsItem);
        processedNews.push(processed);
        console.log(`✓ Item ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`✗ Failed to process item ${i + 1}:`, error.message);
        processedNews.push({
          title: newsItem.title,
          summary: `Ошибка обработки: ${error.message}`,
          url: newsItem.url,
        });
      }
    }

    console.log(`AI processing completed. Processed ${processedNews.length} items`);

    console.log(`Returning ${processedNews.length} processed news items`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(processedNews),
    };
  } catch (error) {
    console.error('Main error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Внутренняя ошибка сервера',
        details: error.message,
        timestamp: new Date().toISOString()
      }),
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

    const requestBody = {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `Ты — профессиональный стендап-комик и сатирик. Создавай остроумные, ироничные комментарии к новостям. Будь очень смешным и современным. Отвечай ТОЛЬКО комментарием. Максимум 2-3 предложения.`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 150,
      stream: false
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await axios.post('https://api.intelligence.io.solutions/api/v1/chat/completions', requestBody, {
      headers: {
        'Authorization': `Bearer ${IOINTELLIGENCE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    console.log('AI response received, status:', response.status);
    console.log('Response data keys:', Object.keys(response.data || {}));

    if (!response.data) {
      console.error('No response data from AI API');
      throw new Error('No response data from AI API');
    }

    console.log('Full response data:', JSON.stringify(response.data, null, 2));

    if (!response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      console.error('Invalid AI response structure - no choices');
      throw new Error('Invalid AI response structure - no choices');
    }

    if (!response.data.choices[0].message || !response.data.choices[0].message.content) {
      console.error('Invalid AI response structure - no message content');
      console.error('Choice 0:', response.data.choices[0]);
      throw new Error('Invalid AI response structure - no message content');
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