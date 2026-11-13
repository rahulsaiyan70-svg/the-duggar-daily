(() => {
  const client = window.ddSupabase;
  const grid = document.getElementById("latest-grid");
  if (!grid) return;

  const status = document.createElement("p");
  status.id = "live-news-status";
  status.textContent = client ? "Loading newsroom stories…" : "Newsroom publishing connection will appear here after Supabase is configured.";
  grid.parentElement.insertBefore(status, grid);

  if (!client) return;

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const formatDate = value => value ? new Intl.DateTimeFormat("en-IN", {
    day:"numeric", month:"short", year:"numeric"
  }).format(new Date(value)) : "The Duggar Daily Desk";

  async function loadPublishedNews() {
    const { data, error } = await client.from("news_articles")
      .select("id,title,slug,excerpt,category,featured_image_url,author_name,published_at,source_name,source_url")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending:false })
      .limit(18);

    if (error) {
      status.textContent = "Latest newsroom stories are temporarily unavailable.";
      console.error("Duggar Daily news feed:", error.message);
      return;
    }
    if (!data || !data.length) {
      status.textContent = "No articles have been published yet. The editorial team can publish the first story from the Newsroom.";
      return;
    }

    status.textContent = "Latest stories from The Duggar Daily newsroom";
    const cards = data.map(article => {
      const image = article.featured_image_url || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=80";
      const source = article.source_url
        ? `<span class="live-source">Source: <a href="${escapeHtml(article.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.source_name || "Original source")}</a></span>`
        : "";
      return `<article class="news-card story-card live-news-card" data-category="${escapeHtml(article.category)}" data-search="${escapeHtml(article.title + " " + (article.excerpt || ""))}">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(article.title)}" loading="lazy">
        <div class="news-card-copy">
          <span class="category-label">${escapeHtml(article.category)}</span>
          <h3><a href="article.html?slug=${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></h3>
          <p>${escapeHtml(article.excerpt || "")}</p>
          <small class="live-meta">${escapeHtml(article.author_name || "The Duggar Daily Desk").toUpperCase()} · ${escapeHtml(formatDate(article.published_at))}</small>
          ${source}
        </div>
      </article>`;
    }).join("");

    grid.querySelectorAll(".live-news-card").forEach(el => el.remove());
    grid.insertAdjacentHTML("afterbegin", cards);
  }

  loadPublishedNews();
})();
