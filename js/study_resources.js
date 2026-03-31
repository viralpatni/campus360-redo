// js/study_resources.js
// Handles resource and PYQ loading, upload, and load more functionality

document.addEventListener("DOMContentLoaded", function () {
  let resourcePage = 1;
  let pyqPage = 1;
  let resourceCategory = "";
  let pyqCategory = "";
  let resourceSearch = "";
  let pyqSearch = "";
  const resourceList = document.getElementById("resourceList");
  const pyqList = document.getElementById("pyqList");
  const loadMoreResources = document.getElementById("loadMoreResources");
  const loadMorePyqs = document.getElementById("loadMorePyqs");
  const uploadForm = document.getElementById("uploadForm");
  const uploadPyqForm = document.getElementById("uploadPyqForm");
  const resourceCategorySelect = document.getElementById("resourceCategory");
  const pyqCategorySelect = document.getElementById("pyqCategory");
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");

  function setThemeIcon() {
    if (!themeToggle || !themeIcon) return;

    const isDark = !document.body.classList.contains("light-theme");
    if (isDark) {
      themeIcon.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffd700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
      themeToggle.setAttribute("aria-label", "Switch to light mode");
    } else {
      themeIcon.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path></svg>';
      themeToggle.setAttribute("aria-label", "Switch to dark mode");
    }
  }

  function setTheme(mode) {
    const isLight = mode === "light";
    document.body.classList.toggle("light-theme", isLight);
    setThemeIcon();
  }

  const savedTheme = localStorage.getItem("studyResourcesTheme") || "dark";
  setTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const nextTheme = document.body.classList.contains("light-theme")
        ? "dark"
        : "light";
      setTheme(nextTheme);
      localStorage.setItem("studyResourcesTheme", nextTheme);
    });
  }

  // Load resources
  function loadResources(page = 1) {
    let url = `php/get_resources.php?page=${page}`;
    if (resourceCategory)
      url += `&category=${encodeURIComponent(resourceCategory)}`;
    if (resourceSearch) url += `&search=${encodeURIComponent(resourceSearch)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        data.resources.forEach((resource) => {
          const li = document.createElement("li");
          li.className = "resource-item";
          li.innerHTML = `<span>${resource.name} <small style="color:#888">[${resource.category}]</small><br><small>Uploaded: ${resource.uploadDate}</small></span>
                        <a href="${resource.url}" download>Download</a>`;
          resourceList.appendChild(li);
        });
        if (!data.hasMore) loadMoreResources.disabled = true;
      });
  }

  // Load PYQs
  function loadPyqs(page = 1) {
    let url = `php/get_pyqs.php?page=${page}`;
    if (pyqCategory) url += `&category=${encodeURIComponent(pyqCategory)}`;
    if (pyqSearch) url += `&search=${encodeURIComponent(pyqSearch)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        data.pyqs.forEach((pyq) => {
          const li = document.createElement("li");
          li.className = "pyq-item";
          li.innerHTML = `<span>${pyq.subject}: ${pyq.year} <small style="color:#888">[${pyq.category}]</small><br><small>Uploaded: ${pyq.uploadDate}</small></span>
                        <a href="${pyq.url}" download>Download</a>`;
          pyqList.appendChild(li);
        });
        if (!data.hasMore) loadMorePyqs.disabled = true;
      });
  }

  // Upload resource
  uploadForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    formData.append("resourceCategory", resourceCategorySelect.value);
    fetch("php/upload_resources.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert("Resource uploaded successfully!");
          resourceList.innerHTML = "";
          resourcePage = 1;
          loadResources(resourcePage);
        } else {
          alert("Upload failed.");
        }
      });
  });

  // Upload PYQ
  uploadPyqForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const formData = new FormData(uploadPyqForm);
    formData.append("pyqCategory", pyqCategorySelect.value);
    fetch("php/upload_pyq.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert("PYQ uploaded successfully!");
          pyqList.innerHTML = "";
          pyqPage = 1;
          loadPyqs(pyqPage);
        } else {
          alert("PYQ upload failed.");
        }
      });
  });

  // Load more resources
  loadMoreResources.addEventListener("click", function () {
    resourcePage++;
    loadResources(resourcePage);
  });
  resourceCategorySelect.addEventListener("change", function () {
    resourceCategory = resourceCategorySelect.value;
    resourceList.innerHTML = "";
    resourcePage = 1;
    loadMoreResources.disabled = false;
    loadResources(resourcePage);
  });
  // Add search box for resources
  const resourceSearchBox = document.createElement("input");
  resourceSearchBox.type = "text";
  resourceSearchBox.placeholder = "Search resources...";
  resourceSearchBox.style =
    "margin-bottom:10px;width:100%;padding:8px;border-radius:4px;border:1px solid #ccc;";
  resourceList.parentNode.insertBefore(resourceSearchBox, resourceList);
  resourceSearchBox.addEventListener("input", function () {
    resourceSearch = resourceSearchBox.value;
    resourceList.innerHTML = "";
    resourcePage = 1;
    loadMoreResources.disabled = false;
    loadResources(resourcePage);
  });

  // Load more PYQs
  loadMorePyqs.addEventListener("click", function () {
    pyqPage++;
    loadPyqs(pyqPage);
  });
  pyqCategorySelect.addEventListener("change", function () {
    pyqCategory = pyqCategorySelect.value;
    pyqList.innerHTML = "";
    pyqPage = 1;
    loadMorePyqs.disabled = false;
    loadPyqs(pyqPage);
  });
  // Add search box for PYQs
  const pyqSearchBox = document.createElement("input");
  pyqSearchBox.type = "text";
  pyqSearchBox.placeholder = "Search PYQs...";
  pyqSearchBox.style =
    "margin-bottom:10px;width:100%;padding:8px;border-radius:4px;border:1px solid #ccc;";
  pyqList.parentNode.insertBefore(pyqSearchBox, pyqList);
  pyqSearchBox.addEventListener("input", function () {
    pyqSearch = pyqSearchBox.value;
    pyqList.innerHTML = "";
    pyqPage = 1;
    loadMorePyqs.disabled = false;
    loadPyqs(pyqPage);
  });

  // Initial load
  loadResources(resourcePage);
  loadPyqs(pyqPage);
});
