// public/app.js
const itemsPerPage = 9;
let currentPage = 1;
const searchInput = document.getElementById("search-input");

(async function () {
  fetchData(currentPage);

  // Fetch and render categories
  const categories = await fetchCategories();
  renderCategories(categories);

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
    const defaultFavicon = `data:image/svg+xml, <svg width="96" height="96" viewBox="0 0 96 96" fill="none" style="color:rgba(255,255,255,1);fill:rgba(0,0,0,1)" xmlns="http://www.w3.org/2000/svg"><rect width="96" height="96"/><path d="M78.8303 41.4616C79.637 39.0379 79.9168 36.4697 79.651 33.9291C79.3852 31.3885 78.5798 28.9339 77.2888 26.7296C75.3745 23.3959 72.4506 20.7564 68.9389 19.1921C65.4273 17.6277 61.5095 17.2193 57.7507 18.0258C56.0552 16.1152 53.9712 14.5888 51.6382 13.5487C49.3051 12.5086 46.7768 11.9788 44.2224 11.9948C40.3794 11.9857 36.6328 13.1972 33.5226 15.4546C30.4125 17.7119 28.0995 20.8985 26.917 24.5551C24.4136 25.0679 22.0486 26.1094 19.9801 27.61C17.9117 29.1105 16.1876 31.0355 14.923 33.2561C12.9938 36.5809 12.1704 40.4326 12.5717 44.2556C12.973 48.0787 14.5782 51.6755 17.1558 54.5272C16.3487 56.9509 16.0686 59.519 16.3342 62.0596C16.5998 64.6003 17.405 67.0549 18.6958 69.2592C20.6102 72.593 23.5341 75.2325 27.0457 76.7968C30.5573 78.3612 34.4752 78.7695 38.2339 77.963C39.9291 79.874 42.0131 81.4007 44.3462 82.4408C46.6793 83.4809 49.2078 84.0105 51.7623 83.9941C55.6081 84.0053 59.358 82.794 62.4706 80.5351C65.5832 78.2762 67.8974 75.0865 69.079 71.4267C71.5826 70.9144 73.9478 69.8731 76.0163 68.3725C78.0849 66.8719 79.8089 64.9467 81.073 62.7257C82.9995 59.4007 83.8204 55.5498 83.4173 51.7282C83.0143 47.9065 81.4081 44.3116 78.8303 41.4616ZM51.9099 79.2873C48.3273 79.2873 45.5538 78.1873 43.1309 76.1646C43.2402 76.105 43.4318 76 43.5567 75.9233L57.8927 67.6425C58.2527 67.438 58.5517 67.1412 58.7587 66.7827C58.9658 66.4242 59.0735 66.0169 59.0708 65.6029V45.392L65.1316 48.8908C65.1633 48.9068 65.1905 48.9303 65.211 48.9593C65.2316 48.9882 65.2447 49.0217 65.2494 49.0569V65.7902C65.248 73.3826 58.9274 79.2873 51.9099 79.2873ZM22.778 66.9059C21.197 64.1743 20.6272 60.9736 21.1684 57.8643C21.2749 57.9281 21.4608 58.0417 21.5942 58.1183L35.9302 66.3991C36.2874 66.6082 36.6938 66.7184 37.1076 66.7184C37.5215 66.7184 37.9279 66.6082 38.285 66.3991L55.7877 56.293V63.2906C55.7898 63.3264 55.783 63.3621 55.7679 63.3946C55.7528 63.427 55.7298 63.4552 55.7011 63.4766L41.209 71.844C38.1091 73.6293 34.4277 74.112 30.9724 73.1862C27.517 72.2604 24.5701 70.0018 22.778 66.9059ZM19.001 35.6094C20.5754 32.8745 23.0615 30.7803 26.0242 29.6933C26.0242 29.8168 26.0242 30.0354 26.0242 30.1873V46.7489C26.0212 47.1626 26.1287 47.5696 26.3356 47.9279C26.5424 48.2862 26.8411 48.5828 27.2009 48.7872L44.7021 58.8919L38.6427 62.3907C38.6127 62.4103 38.5784 62.4222 38.5428 62.4254C38.5072 62.4287 38.4713 62.4231 38.4383 62.4092L23.9448 54.0347C20.8494 52.2436 18.5907 49.2981 17.6639 45.8441C16.7371 42.39 17.218 38.7094 19.001 35.6094ZM68.7909 47.196L51.2882 37.0899L57.3476 33.5925C57.3776 33.5729 57.4119 33.561 57.4475 33.5577C57.4832 33.5545 57.519 33.5601 57.552 33.574L72.0455 41.9442C74.2647 43.2275 76.0724 45.1162 77.2572 47.3894C78.4421 49.6626 78.955 52.2263 78.7359 54.7804C78.5169 57.3344 77.575 59.7733 76.0204 61.8116C74.4658 63.8498 72.3628 65.4032 69.9576 66.2898V49.2329C69.961 48.8204 69.8548 48.4145 69.6498 48.0566C69.4448 47.6987 69.1483 47.4017 68.7909 47.196ZM74.8219 38.1118C74.7154 38.0465 74.5295 37.9344 74.3961 37.8578L60.0601 29.577C59.7027 29.3685 59.2964 29.2586 58.8827 29.2586C58.469 29.2586 58.0627 29.3685 57.7053 29.577L40.2026 39.6831V32.6855C40.2006 32.6497 40.2075 32.6141 40.2226 32.5816C40.2377 32.5492 40.2606 32.521 40.2892 32.4995L54.7813 24.1392C57.0015 22.859 59.5404 22.2375 62.1008 22.3474C64.6613 22.4574 67.1375 23.2941 69.2398 24.7599C71.3421 26.2257 72.9836 28.2598 73.9721 30.6243C74.9606 32.9888 75.2554 35.5859 74.8219 38.1118ZM36.9082 50.5898L30.8473 47.091C30.8152 47.0756 30.7876 47.0522 30.767 47.0232C30.7464 46.9941 30.7335 46.9603 30.7295 46.9249V30.1873C30.7312 27.6237 31.463 25.1137 32.8394 22.951C34.2158 20.7882 36.1797 19.0623 38.5014 17.9752C40.823 16.8881 43.4063 16.4848 45.9488 16.8125C48.4914 17.1402 50.8879 18.1854 52.858 19.8256C52.7487 19.8853 52.5585 19.9903 52.4322 20.0669L38.0962 28.3478C37.7367 28.5525 37.4381 28.8491 37.2311 29.2073C37.0241 29.5655 36.9161 29.9723 36.9181 30.386L36.9082 50.5898ZM40.1998 43.4928L47.9952 38.9904L55.7905 43.49V52.4918L47.9952 56.9899L40.1998 52.4904V43.4928Z" fill="currentColor"/> </svg>`;
    if (item.favicon == null || item.favicon == undefined || item.favicon.length < 5) {
      favicon.src = defaultFavicon;
    } else {
      const firstChar = item.favicon.charAt(0);
      const firstFewChars = item.favicon.slice(0, 4);
      if (firstFewChars === 'PGh0' || firstFewChars === 'PEhU' || firstFewChars === 'PCFE') {
        favicon.src = defaultFavicon; // Use the actual base64 HTML data from the database
      } else if (firstChar === 'P') {
        favicon.src = `data:image/svg+xml;base64,${item.favicon}`; // Use the actual base64 favicon (SVG) from the database
      } else if (firstChar === 'i') {
        favicon.src = `data:image/png;base64,${item.favicon}`; // Use the actual base64 favicon (PNG) from the database
      } else if (firstChar === '/' || firstChar === '9') {
        favicon.src = `data:image/jpeg;base64,${item.favicon}`; // Use the actual base64 favicon (JPEG) from the database
      } else if (firstChar === 'R') {
        favicon.src = `data:image/gif;base64,${item.favicon}`; // Use the actual base64 favicon (GIF) from the database
      } else if (firstChar === 'U') {
        favicon.src = `data:image/webp;base64,${item.favicon}`; // Use the actual base64 favicon (WebP) from the database
      } else if (firstChar === 'Q') {
        favicon.src = `data:image/bmp;base64,${item.favicon}`; // Use the actual base64 favicon (BMP) from the database
      } else if (firstChar === 'A') {
        favicon.src = `data:image/x-icon;base64,${item.favicon}`; // Use the actual base64 favicon (ICO) from the database
      } else {
        console.warn("Favicon not found for item: ", item)
        favicon.src = defaultFavicon;
      }
    }
    favicon.className = "favicon"; // Add a class to style the favicon
    galleryItem.appendChild(favicon);

    const img = document.createElement("img");
    img.src = `/image/${item.dataId}`;

    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = '<br/>&nbsp;' + item.summary + '<br/>&nbsp;'.repeat(3);
    content.addEventListener("click", () => {
      window.open(item.dataUrl, '_blank');
    });

    // Delete button
    const deleteData = document.createElement("div");
    deleteData.className = "deleteData";
    deleteData.innerText = `delete ID: ${item.dataId}\n${item.dataUrl}\n`;
    deleteData.addEventListener("click", () => {
      const userConfirmation = confirm("Are you sure you want to delete this item?");
      if (userConfirmation) {
        console.log(item);
        deleteDataAndRender(item._id);
      }
    });
    //content.insertBefore(deleteData, content.firstChild);

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
    galleryItem.appendChild(deleteData);
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
    categoryElement.addEventListener("click", () => {
      searchInput.value = category;
      onSearchInput({ target: { value: category } });
    });
    categoriesContainer.appendChild(categoryElement);
  });
}

function deleteDataAndRender(objId) {
  console.log('[deleteOne][client]', objId);
  fetch(`/delete/${objId}`, { method: 'DELETE' })
    .then((response) => {
      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }
      fetchData(currentPage); // Refetch the data after deletion
    })
    .catch((error) => {
      console.error("Error deleting data:", error);
    });
}