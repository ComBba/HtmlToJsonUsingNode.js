// public/app.js
const itemsPerPage = 9;
let currentPage = 1;

(async function () {
  fetchData(currentPage);

  // Fetch and render categories
  const categories = await fetchCategories();
  renderCategories(categories);

  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", onSearchInput);
})();

function onSearchInput(event) {
  const searchQuery = event.target.value;
  currentPage = 1;
  fetchData(currentPage, searchQuery);
}

function fetchData(page, searchQuery = "") {
  fetch(`/data?page=${page}&search=${encodeURIComponent(searchQuery)}`)
    .then((response) => response.json())
    .then(({ data, totalItems }) => {
      displayGallery(data, currentPage);
      if (!document.getElementById("pagination").hasChildNodes()) {
        setupPagination(totalItems, searchQuery);
      } else {
        updatePagination(totalItems, searchQuery);
      }
      updateDataInfo(totalItems, currentPage);
    })
    .catch((error) => {
      console.error("Error fetching JSON data:", error);
    });
}

function displayGallery(data, page) {
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  const totalItems = data.length;

  data.forEach((item) => {
    const galleryItem = document.createElement("div");
    galleryItem.className = "gallery-item";
    galleryItem.addEventListener("click", () => {
      window.open(item.dataUrl, '_blank');
    });
    /*
    // 높이를 100px 범위 내에서 10px 단위로 랜덤하게 설정
    const randomHeight = Math.floor(Math.random() * 11) * 10; // 0 ~ 100 사이의 10의 배수
    galleryItem.style.height = `${200 + randomHeight}px`; // 기본 높이에 랜덤 높이를 더함
    */
    const dataName = document.createElement("div");
    dataName.className = "dataName";
    dataName.innerText = item.dataName;
    galleryItem.appendChild(dataName);

    const dataTask = document.createElement("div");
    dataTask.className = "dataTask";
    dataTask.innerText = item.dataTask;
    galleryItem.appendChild(dataTask);

    // Add this block to create a favicon element and append it to the gallery item
    const favicon = document.createElement("img");
    favicon.src = `data:image/png;base64,${item.favicon}`; // Use the actual base64 favicon from the database
    favicon.className = "favicon"; // Add a class to style the favicon
    galleryItem.appendChild(favicon);

    const img = document.createElement("img");
    img.src = `/image/${item.dataId}`;

    const content = document.createElement("div");
    content.className = "content";
    content.innerText = item.summary;

    const categoriesScoreContainer = document.createElement("div");
    categoriesScoreContainer.className = "category-score-container";

    const category1 = document.createElement("div");
    category1.className = "category-score";
    category1.innerText = `${item.Category1st}: ${item.Category1stScore.toFixed(1)}`;
    categoriesScoreContainer.appendChild(category1);

    const category2 = document.createElement("div");
    category2.className = "category-score";
    category2.innerText = `${item.Category2nd}: ${item.Category2ndScore.toFixed(1)}`;
    categoriesScoreContainer.appendChild(category2);

    const category3 = document.createElement("div");
    category3.className = "category-score";
    category3.innerText = `${item.Category3rd}: ${item.Category3rdScore.toFixed(1)}`;
    categoriesScoreContainer.appendChild(category3);

    galleryItem.appendChild(img);
    galleryItem.appendChild(content);
    galleryItem.appendChild(categoriesScoreContainer);
    gallery.appendChild(galleryItem);
  });

  displayDataInfo(totalItems, currentPage);
}

function setupPagination(totalItems, searchQuery = "") {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  displayPaginationButtons(1, 10, totalPages, searchQuery);
}

function updatePagination(totalItems, searchQuery = "") {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const start = Math.floor((currentPage - 1) / 10) * 10 + 1;
  const end = Math.min(start + 9, totalPages);

  displayPaginationButtons(start, end, totalPages, searchQuery);
  setActivePageButton();
}

function createPageButton(i, searchQuery) {
  const pageButton = document.createElement("span");
  pageButton.className = "page-button";
  pageButton.innerText = i;
  pageButton.addEventListener("click", () => {
    currentPage = i;
    fetchData(currentPage, searchQuery);
    setActivePageButton();
  });

  return pageButton;
}

function displayDataInfo(totalItems, currentPage) {
  const dataInfo = document.getElementById("data-info");
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  dataInfo.innerText = `Displaying items ${start} - ${end} of ${totalItems}`;
}

function setActivePageButton() {
  const pageButtons = document.getElementsByClassName("page-button");
  Array.from(pageButtons).forEach((button) => {
    if (parseInt(button.textContent) === currentPage) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

function displayPaginationButtons(start, end, totalPages, searchQuery) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  const prevButton = document.createElement("span");
  prevButton.className = "page-button";
  prevButton.innerText = "Prev";
  prevButton.addEventListener("click", () => {
    if (currentPage > 1) {
      const newStart = Math.max(start - 10, 1);
      const newEnd = Math.min(newStart + 9, totalPages);
      displayPaginationButtons(newStart, newEnd, totalPages, searchQuery);
      currentPage = Math.max(currentPage - 10, 1);
      fetchData(currentPage, searchQuery);
    }
  });
  pagination.appendChild(prevButton);

  for (let i = start; i <= end && i <= totalPages; i++) {
    const pageButton = createPageButton(i, searchQuery);
    pagination.appendChild(pageButton);
  }

  const nextButton = document.createElement("span");
  nextButton.className = "page-button";
  nextButton.innerText = "Next";
  nextButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
      const newStart = Math.min(end + 1, totalPages);
      const newEnd = Math.min(newStart + 9, totalPages);
      displayPaginationButtons(newStart, newEnd, totalPages, searchQuery);
      currentPage = Math.min(currentPage + 10, totalPages);
      fetchData(currentPage, searchQuery);
    }
  });
  pagination.appendChild(nextButton);

  setActivePageButton();
}

function updateDataInfo(totalItems, page) {
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, totalItems);
  const dataInfo = document.getElementById("data-info");
  dataInfo.innerText = `Displaying items ${start} - ${end} of ${totalItems}`;
}

async function fetchCategories() {
  const response = await fetch('/categories');
  const { categories } = await response.json();
  return categories;
}

function renderCategories(categories) {
  const categoriesContainer = document.getElementById('categories');
  categoriesContainer.innerHTML = '';

  categories.forEach(({ category, count }) => {
    const categoryElement = document.createElement('span');
    categoryElement.textContent = `${category} (${count})`;
    categoriesContainer.appendChild(categoryElement);
  });
}