(() => {
  const client = window.ddSupabase;
  const $ = id => document.getElementById(id);
  const loginPanel = $("login-panel"), dashboard = $("dashboard");
  const showMessage = (id, text, success=false) => {
    const el=$(id); el.textContent=text; el.classList.remove("dd-hidden","success");
    if(success) el.classList.add("success");
  };
  const hideMessage = id => $(id).classList.add("dd-hidden");
  const slugify = text => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);
  let currentImageUrl = null, currentArticles = [];

  if (!client) {
    showMessage("login-message","Supabase is not configured. Add your project URL and anon/publishable key in newsroom-config.js.");
    $("login-form").querySelector("button").disabled=true;
    return;
  }

  async function isEditor(userId) {
    const {data,error}=await client.from("newsroom_users").select("role,active").eq("user_id",userId).maybeSingle();
    return !error && data && data.active === true && ["admin","editor"].includes(data.role);
  }
  async function refreshSession() {
    const {data:{session}}=await client.auth.getSession();
    if(!session){loginPanel.classList.remove("dd-hidden");dashboard.classList.add("dd-hidden");return;}
    const allowed=await isEditor(session.user.id);
    if(!allowed){await client.auth.signOut();showMessage("login-message","This account is not authorised for newsroom access. Ask the administrator to add your user ID to newsroom_users.");return;}
    loginPanel.classList.add("dd-hidden");dashboard.classList.remove("dd-hidden");
    $("signed-in-user").textContent=session.user.email || "Signed in";
    await loadArticles();
  }
  $("login-form").addEventListener("submit",async e=>{
    e.preventDefault();hideMessage("login-message");
    const {error}=await client.auth.signInWithPassword({email:$("login-email").value.trim(),password:$("login-password").value});
    if(error){showMessage("login-message",error.message);return;} await refreshSession();
  });
  $("logout-btn").addEventListener("click",async()=>{await client.auth.signOut();location.reload();});

  function switchView(view){
    $("editor-view").classList.toggle("dd-hidden",view!=="editor");
    $("articles-view").classList.toggle("dd-hidden",view!=="articles");
    document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  }
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));

  function resetForm(){
    $("article-form").reset();$("article-id").value="";$("author").value="The Duggar Daily Desk";
    $("editor-heading").textContent="Write a new article";currentImageUrl=null;$("image-current").textContent="";
  }
  $("reset-form").addEventListener("click",resetForm);

  async function uploadImage(file){
    if(!file) return currentImageUrl;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
    if(file.size>6*1024*1024) throw new Error("Image must be smaller than 6 MB.");
    const ext=file.name.split(".").pop().toLowerCase();
    const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error}=await client.storage.from("news-images").upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw error;
    const {data}=client.storage.from("news-images").getPublicUrl(path);
    return data.publicUrl;
  }
  function formData(status){
    const title=$("title").value.trim(), body=$("body").value.trim();
    if(!title || !body) throw new Error("Headline and full article are required.");
    return {title,slug:slugify(title),excerpt:$("excerpt").value.trim(),category:$("category").value,
      author_name:$("author").value.trim()||"The Duggar Daily Desk",body,status,
      source_name:$("source-name").value.trim()||null,source_url:$("source-url").value.trim()||null};
  }
  async function save(status){
    hideMessage("dashboard-message");
    try{
      const payload=formData(status);
      const image=$("image-file").files[0];
      if(image) currentImageUrl=await uploadImage(image);
      payload.featured_image_url=currentImageUrl;
      if(status==="published") payload.published_at=new Date().toISOString();
      const id=$("article-id").value;
      let result;
      if(id) result=await client.from("news_articles").update(payload).eq("id",id);
      else result=await client.from("news_articles").insert(payload);
      if(result.error) throw result.error;
      showMessage("dashboard-message",status==="published"?"Article published successfully. It will appear on the public homepage.":"Draft saved successfully.",true);
      resetForm();await loadArticles();switchView("articles");
    }catch(err){showMessage("dashboard-message",err.message||"Unable to save article.");}
  }
  $("article-form").addEventListener("submit",e=>{e.preventDefault();save("draft");});
  $("publish-article").addEventListener("click",()=>save("published"));

  async function loadArticles(){
    const {data,error}=await client.from("news_articles").select("*").order("updated_at",{ascending:false}).limit(100);
    if(error){showMessage("dashboard-message",error.message);return;}
    currentArticles=data||[];
    $("count-total").textContent=currentArticles.length;
    $("count-published").textContent=currentArticles.filter(a=>a.status==="published").length;
    $("count-drafts").textContent=currentArticles.filter(a=>a.status==="draft").length;
    $("article-list").innerHTML=currentArticles.length?currentArticles.map(a=>`
      <div class="dd-article-row"><div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.category)} · ${escapeHtml(a.status.toUpperCase())} · ${escapeHtml(new Date(a.updated_at).toLocaleString("en-IN"))}</p></div>
      <div class="dd-row-actions"><button class="dd-btn secondary" data-edit="${a.id}">Edit</button>${a.status==="draft"?`<button class="dd-btn" data-publish="${a.id}">Publish</button>`:`<button class="dd-btn secondary" data-unpublish="${a.id}">Unpublish</button>`}<button class="dd-btn danger" data-delete="${a.id}">Delete</button></div></div>`).join(""):"<p class='dd-note'>No articles yet. Create your first story.</p>";
    $("article-list").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editArticle(b.dataset.edit)));
    $("article-list").querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",()=>changeStatus(b.dataset.publish,"published")));
    $("article-list").querySelectorAll("[data-unpublish]").forEach(b=>b.addEventListener("click",()=>changeStatus(b.dataset.unpublish,"draft")));
    $("article-list").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteArticle(b.dataset.delete)));
  }
  function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function editArticle(id){
    const a=currentArticles.find(x=>x.id===id);if(!a)return;
    $("article-id").value=a.id;$("title").value=a.title;$("excerpt").value=a.excerpt||"";
    $("category").value=a.category;$("author").value=a.author_name||"The Duggar Daily Desk";
    $("body").value=a.body;$("source-name").value=a.source_name||"";$("source-url").value=a.source_url||"";
    currentImageUrl=a.featured_image_url;$("image-current").textContent=currentImageUrl?"Current image: "+currentImageUrl:"No featured image";
    $("editor-heading").textContent="Edit article";switchView("editor");window.scrollTo({top:0,behavior:"smooth"});
  }
  async function changeStatus(id,status){
    const payload=status==="published"?{status,published_at:new Date().toISOString()}:{status,published_at:null};
    const {error}=await client.from("news_articles").update(payload).eq("id",id);
    if(error)showMessage("dashboard-message",error.message);else{showMessage("dashboard-message",status==="published"?"Article published.":"Article moved to drafts.",true);await loadArticles();}
  }
  async function deleteArticle(id){
    if(!confirm("Permanently delete this article?"))return;
    const {error}=await client.from("news_articles").delete().eq("id",id);
    if(error)showMessage("dashboard-message",error.message);else{showMessage("dashboard-message","Article deleted.",true);await loadArticles();}
  }
  refreshSession();
})();
