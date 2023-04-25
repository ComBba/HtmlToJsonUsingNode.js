const itemsPerPage = 9;
let currentPage = 1;

fetch('/data')
  .then((response) => response.json())
  .then((data) => {
    const totalItems = data.length;
    displayGallery(data, currentPage);
    setupPagination(totalItems, data);
    displayDataInfo(totalItems, currentPage);
  })
  .catch((error) => {
    console.error('Error fetching JSON data:', error);
  });


function displayGallery(data, page) {
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;

  data.slice(start, end).forEach((item) => {
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


function createPageButton(i, data) {
  const pageButton = document.createElement("span");
  pageButton.className = "page-button";
  pageButton.innerText = i;
  pageButton.addEventListener("click", () => {
    currentPage = i;
    displayGallery(data, currentPage);
    updatePagination();
  });

  return pageButton;
}

function displayPaginationButtons(start, end, totalPages, data) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  const prevButton = document.createElement("span");
  prevButton.className = "page-button";
  prevButton.innerText = "Prev";
  prevButton.addEventListener("click", () => {
    if (currentPage > 1) {
      const newStart = Math.max(start - 10, 1);
      const newEnd = newStart + 9;
      displayPaginationButtons(newStart, newEnd, totalPages, data);
      currentPage = Math.max(currentPage - 10, 1);
      displayGallery(data, currentPage);
      updatePagination();
      displayDataInfo(data.length, currentPage);
    }
  });
  pagination.appendChild(prevButton);

  for (let i = start; i <= end && i <= totalPages; i++) {
    const pageButton = createPageButton(i, data);
    pagination.appendChild(pageButton);
  }

  const nextButton = document.createElement("span");
  nextButton.className = "page-button";
  nextButton.innerText = "Next";
  nextButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
      const newStart = Math.min(end + 1, totalPages);
      const newEnd = Math.min(end + 10, totalPages);
      displayPaginationButtons(newStart, newEnd, totalPages, data);
      currentPage = Math.min(currentPage + 10, totalPages);
      displayGallery(data, currentPage);
      updatePagination();
      displayDataInfo(data.length, currentPage);
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