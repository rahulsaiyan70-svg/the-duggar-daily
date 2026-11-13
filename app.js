
const dateElement = document.getElementById("current-date");
const yearElement = document.getElementById("year");

dateElement.textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

yearElement.textContent = new Date().getFullYear();

// Mobile navigation
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

menuToggle.addEventListener("click", () => {
  navLinks.classList.toggle("open");
});

// News search and category filters
const searchInput = document.getElementById("search");
const filterButtons = document.querySelectorAll(".filter");
const newsCards = document.querySelectorAll(".news-card");
const emptyState = document.getElementById("empty-state");

let selectedCategory = "all";

function filterNews() {
  const searchTerm = searchInput.value.toLowerCase();
  let visibleCount = 0;

  newsCards.forEach(card => {
    const category = card.dataset.category;
    const content = card.textContent.toLowerCase();

    const categoryMatch =
      selectedCategory === "all" ||
      category === selectedCategory;

    const searchMatch = content.includes(searchTerm);
    const show = categoryMatch && searchMatch;

    card.hidden = !show;

    if (show) visibleCount++;
  });

  emptyState.hidden = visibleCount !== 0;
}

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    filterButtons.forEach(item => item.classList.remove("active"));

    button.classList.add("active");
    selectedCategory = button.dataset.category;

    filterNews();
  });
});

searchInput.addEventListener("input", filterNews);

// Newsletter preview only
document.getElementById("newsletter-form")
  .addEventListener("submit", event => {
    event.preventDefault();

    document.getElementById("newsletter-message")
      .textContent = "Thank you for your interest in The Duggar Daily!";

    event.target.reset();
  });
