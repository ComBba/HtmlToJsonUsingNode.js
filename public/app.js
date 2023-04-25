const itemsPerPage = 9;
let currentPage = 1;

fetch('/data')
  .then((response) => response.json())
  .then((data) => {
    displayGallery(data, currentPage);
    setupPagination(data.length, data);
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
}

function setupPagination(totalItems, data) {
  const pagination = document.getElementById("pagination");
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  for (let i = 1; i <= totalPages; i++) {
    const pageButton = document.createElement("span");
    pageButton.className = "page-button";
    pageButton.innerText = i;
    pageButton.addEventListener("click", () => {
      currentPage = i;
      displayGallery(data, currentPage);
      updatePagination();
    });

    pagination.appendChild(pageButton);
  }

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
