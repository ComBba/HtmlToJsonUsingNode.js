const itemsPerPage = 9;
let currentPage = 1;
let paginationInitialized = false; // 추가된 부분

fetchData(currentPage);

function fetchData(page) {
  fetch(`/data?page=${page}`)
    .then((response) => response.json())
    .then(({ data, totalItems }) => {
      displayGallery(data, currentPage);
      if (!paginationInitialized) { // 추가된 부분
        setupPagination(totalItems);
        paginationInitialized = true;
      }
      updatePagination();
      updateDataInfo(totalItems, currentPage); // 추가된 부분
    })
    .catch((error) => {
      console.error("Error fetching JSON data:", error);
    });
}

function displayGallery(data, page) {
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

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

    const totalItems = data.length;
    displayDataInfo(totalItems, currentPage);
  });
}

function setupPagination(totalItems) {
  const pagination = document.getElementById("pagination");
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const pageButton = document.createElement("span");
    pageButton.className = "page-button";
    pageButton.innerText = i;
    pageButton.addEventListener("click", () => {
      currentPage = i;
      fetchData(currentPage);
    });

    pagination.appendChild(pageButton);
  }
}

function createPageButton(i) {
  const pageButton = document.createElement("span");
  pageButton.className = "page-button";
  pageButton.innerText = i;
  pageButton.addEventListener("click", () => {
    currentPage = i;
    fetchData(currentPage); // 수정된 부분
    updatePagination();
  });

  return pageButton;
}

function displayPaginationButtons(start, end, totalPages) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  const prevButton = document.createElement("span");
  prevButton.className = "page-button";
  prevButton.innerText = "Prev";
  prevButton.addEventListener("click", () => {
    if (currentPage > 1) {
      const newStart = Math.max(start - 10, 1);
      const newEnd = newStart + 9;
      displayPaginationButtons(newStart, newEnd, totalPages);
      currentPage = Math.max(currentPage - 10, 1);
      fetchData(currentPage);
    }
  });
  pagination.appendChild(prevButton);

  for (let i = start; i <= end && i <= totalPages; i++) {
    const pageButton = createPageButton(i);
    pagination.appendChild(pageButton);
  }

  const nextButton = document.createElement("span");
  nextButton.className = "page-button";
  nextButton.innerText = "Next";
  nextButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
      const newStart = Math.min(end + 1, totalPages);
      const newEnd = Math.min(end + 10, totalPages);
      displayPaginationButtons(newStart, newEnd, totalPages);
      currentPage = Math.min(currentPage + 10, totalPages);
      fetchData(currentPage);
    }
  });
  pagination.appendChild(nextButton);
}


function displayDataInfo(totalItems, currentPage) {
  const dataInfo = document.getElementById("data-info");
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  dataInfo.innerText = `Displaying items ${start} - ${end} of ${totalItems}`;
}

function setupPagination(totalItems, data) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  displayPaginationButtons(1, 10, totalPages, data);
  updatePagination();
}

function updatePagination() {
  const pageButtons = document.querySelectorAll(".page-button");
  pageButtons.forEach((button) => {
    if (parseInt(button.innerText) === currentPage) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

function updateDataInfo(totalItems, page) {
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, totalItems);
  const dataInfo = document.getElementById("data-info");
  dataInfo.innerText = `Displaying items ${start} - ${end} of ${totalItems}`;
}