(() => {
  const client = window.ddSupabase;
  const $ = id => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const status = $("article-status");
  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug) { status.textContent = "Article not found. Return to the homepage."; return; }
  if (!client) { status.textContent = "The publishing database is not configured yet."; return; }

  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const paragraphs = text => String(text || "").split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g,"<br>")}</p>`).join("");
  const date = value => value ? new Intl.DateTimeFormat("en-IN",{dateStyle:"long",timeStyle:"short"}).format(new Date(value)) : "";

  async function load() {
    const { data, error } = await client.from("news_articles")
      .select("title,excerpt,body,category,featured_image_url,author_name,published_at,source_name,source_url")
      .eq("slug", slug).eq("status","published").lte("published_at",new Date().toISOString()).maybeSingle();
    if (error || !data) { status.textContent = "This article is unavailable or has not been published."; return; }
    document.title = `${data.title} | The Duggar Daily`;
    $("article-category").textContent = data.category;
    $("article-title").textContent = data.title;
    $("article-excerpt").textContent = data.excerpt || "";
    $("article-byline").textContent = `${data.author_name || "The Duggar Daily Desk"} · ${date(data.published_at)}`;
    if (data.featured_image_url) { $("article-image").src = data.featured_image_url; $("article-image").alt = data.title; }
    else $("article-image").hidden = true;
    $("article-body").innerHTML = paragraphs(data.body);
    if (data.source_url) $("article-source").innerHTML = `Source: <a href="${escapeHtml(data.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.source_name || "Original source")}</a>`;
    $("article-content").hidden = false; status.hidden = true;
  }
  load();
})();
