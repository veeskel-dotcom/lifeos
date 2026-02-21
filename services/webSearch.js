// ═══ Web Search — поиск через DuckDuckGo ═══

export async function searchWeb(query) {
  try {
    const res = await fetch(`/api/proxy/websearch?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    const data = await res.json();

    const answer = data.answer || data.abstract || null;
    const topics = (data.related_topics || [])
      .filter(t => t.text)
      .slice(0, 3)
      .map(t => t.text);

    return {
      answer,
      source: data.abstract_source || 'DuckDuckGo',
      source_url: data.abstract_url || null,
      topics,
    };
  } catch (e) {
    console.error('[webSearch]', e);
    return { answer: null, source: null, source_url: null, topics: [] };
  }
}
