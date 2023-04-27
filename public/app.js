const itemsPerPage = 9;
let currentPage = 1;

fetchData(currentPage);

const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", onSearchInput);

// Add this function to your app.js
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

  const totalItems = data.length; // Moved outside the forEach loop

  data.forEach((item) => {
    const galleryItem = document.createElement("div");
    galleryItem.className = "gallery-item";
    galleryItem.addEventListener("click", () => {
      window.open(item.dataUrl, '_blank');
    });

    const dataName = document.createElement("div");
    dataName.className = "dataName";
    dataName.innerText = item.dataName;
    galleryItem.appendChild(dataName);

    const dataTask = document.createElement("div");
    dataTask.className = "dataTask";
    dataTask.innerText = item.dataTask;
    galleryItem.appendChild(dataTask);

    const img = document.createElement("img");
    if (!item.screenShot || item.screenShot.length < 10) {
      img.src = item.imgSrc;
    } else {
      img.src = `data:image/png;base64,${item.screenShot}`;
    }
    const content = document.createElement("div");
    content.className = "content";
    content.innerText = item.summary;

    galleryItem.appendChild(img);
    galleryItem.appendChild(content);
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
  setActivePageButton(); // Add this line to update the active page button
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