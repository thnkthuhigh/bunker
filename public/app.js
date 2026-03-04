// ========== SVG Icons (no emoji) ==========
const ICONS = {
  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7"/><path d="M5 17h14"/><path d="M7 11l-2 6h14l-2-6"/></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  folder: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  edit: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

// ========== State ==========
let currentFilter = "all";
let currentCategoryId = null; // null = all
let searchQuery = "";
let currentModalItem = null;
let categories = [];
let editingCategoryId = null;

// ========== API ==========
const API = {
  async getItems(filter, search, categoryId) {
    const p = new URLSearchParams();
    if (filter && filter !== "all") p.set("type", filter);
    if (search) p.set("search", search);
    if (categoryId) p.set("category_id", categoryId);
    p.set("limit", "100");
    const res = await fetch(`/api/items?${p}`);
    return res.json();
  },
  async saveText(content, category_id) {
    const res = await fetch("/api/items/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, category_id }),
    });
    if (!res.ok) throw new Error("Failed to save");
    return res.json();
  },
  async uploadImage(file, category_id) {
    const fd = new FormData();
    fd.append("image", file);
    if (category_id) fd.append("category_id", category_id);
    const res = await fetch("/api/items/image", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Failed to upload");
    return res.json();
  },
  async pasteImage(imageData, filename, category_id) {
    const res = await fetch("/api/items/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageData, filename, category_id }),
    });
    if (!res.ok) throw new Error("Failed to paste");
    return res.json();
  },
  async deleteItem(id) {
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    return res.json();
  },
  async togglePin(id) {
    const res = await fetch(`/api/items/${id}/pin`, { method: "PATCH" });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  },
  async moveCategory(id, category_id) {
    const res = await fetch(`/api/items/${id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id }),
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  },

  // Categories
  async getCategories() {
    const res = await fetch("/api/categories");
    return res.json();
  },
  async createCategory(name, color) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed");
    }
    return res.json();
  },
  async updateCategory(id, name, color) {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  },
  async deleteCategory(id) {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  },
};

// ========== DOM ==========
const itemsGrid = document.getElementById("itemsGrid");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const textInput = document.getElementById("textInput");
const saveTextBtn = document.getElementById("saveTextBtn");
const fileInput = document.getElementById("fileInput");
const pasteZone = document.getElementById("pasteZone");
const searchInput = document.getElementById("searchInput");
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const toast = document.getElementById("toast");
const sidebar = document.getElementById("sidebar");
const mainWrapper = document.getElementById("mainWrapper");
const categoryList = document.getElementById("categoryList");
const categorySelect = document.getElementById("categorySelect");
const categoryModal = document.getElementById("categoryModal");
const categoryNameInput = document.getElementById("categoryNameInput");
const colorPicker = document.getElementById("colorPicker");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const moveCategoryModal = document.getElementById("moveCategoryModal");
const moveCategoryList = document.getElementById("moveCategoryList");
const itemCount = document.getElementById("itemCount");
const categoryModalTitle = document.getElementById("categoryModalTitle");

// ========== Toast ==========
let toastTimeout;
function showToast(message, type = "success") {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  toastTimeout = setTimeout(() => {
    toast.className = "toast";
  }, 2500);
}

// ========== Utils ==========
function formatDate(dateStr) {
  const d = new Date(dateStr + "Z");
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "Vua xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}p truoc`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h truoc`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d truoc`;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function getSelectedCategoryId() {
  return categorySelect.value || null;
}

// ========== Categories ==========
async function loadCategories() {
  try {
    const data = await API.getCategories();
    categories = data.categories;
    renderCategorySidebar(data);
    renderCategorySelect();
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
}

function renderCategorySidebar(data) {
  let html = "";

  // All items
  const allActive = !currentCategoryId ? "active" : "";
  html += `<li class="category-item ${allActive}" data-cat-id="">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    <span class="category-name">Tat ca</span>
    <span class="category-count">${data.total_count}</span>
  </li>`;

  // Each category
  for (const cat of data.categories) {
    const active = currentCategoryId === cat.id ? "active" : "";
    html += `<li class="category-item ${active}" data-cat-id="${cat.id}">
      <span class="category-dot" style="background:${cat.color}"></span>
      <span class="category-name">${escapeHtml(cat.name)}</span>
      <span class="category-count">${cat.item_count}</span>
      <span class="category-actions">
        <button class="category-action-btn" onclick="event.stopPropagation(); openEditCategory('${cat.id}')" title="Sua">${ICONS.edit}</button>
        <button class="category-action-btn" onclick="event.stopPropagation(); deleteCategoryAction('${cat.id}')" title="Xoa">${ICONS.x}</button>
      </span>
    </li>`;
  }

  // Uncategorized
  if (data.uncategorized_count > 0) {
    const uActive = currentCategoryId === "uncategorized" ? "active" : "";
    html += `<li class="category-item ${uActive}" data-cat-id="uncategorized">
      <span class="category-dot" style="background:#636e72"></span>
      <span class="category-name">Chua phan loai</span>
      <span class="category-count">${data.uncategorized_count}</span>
    </li>`;
  }

  categoryList.innerHTML = html;

  // Click handlers
  categoryList.querySelectorAll(".category-item").forEach((el) => {
    el.addEventListener("click", () => {
      const catId = el.dataset.catId;
      currentCategoryId = catId || null;
      loadCategories();
      loadItems();
    });
  });
}

function renderCategorySelect() {
  let html = '<option value="">-- Chon danh muc --</option>';
  for (const cat of categories) {
    html += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
  }
  categorySelect.innerHTML = html;
}

// ========== Category CRUD ==========
function openAddCategory() {
  editingCategoryId = null;
  categoryModalTitle.textContent = "Them danh muc";
  categoryNameInput.value = "";
  colorPicker
    .querySelectorAll(".color-swatch")
    .forEach((s) => s.classList.remove("active"));
  colorPicker.querySelector('[data-color="#6c5ce7"]').classList.add("active");
  categoryModal.classList.add("open");
  setTimeout(() => categoryNameInput.focus(), 100);
}

function openEditCategory(id) {
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;
  editingCategoryId = id;
  categoryModalTitle.textContent = "Sua danh muc";
  categoryNameInput.value = cat.name;
  colorPicker.querySelectorAll(".color-swatch").forEach((s) => {
    s.classList.toggle("active", s.dataset.color === cat.color);
  });
  categoryModal.classList.add("open");
  setTimeout(() => categoryNameInput.focus(), 100);
}

function closeCategoryModal(e) {
  if (e && e.target !== categoryModal) return;
  categoryModal.classList.remove("open");
}

async function saveCategory() {
  const name = categoryNameInput.value.trim();
  if (!name) {
    showToast("Vui long nhap ten danh muc", "error");
    return;
  }

  const activeSwatch = colorPicker.querySelector(".color-swatch.active");
  const color = activeSwatch ? activeSwatch.dataset.color : "#6c5ce7";

  try {
    if (editingCategoryId) {
      await API.updateCategory(editingCategoryId, name, color);
      showToast("Da cap nhat danh muc");
    } else {
      await API.createCategory(name, color);
      showToast("Da them danh muc");
    }
    categoryModal.classList.remove("open");
    loadCategories();
  } catch (err) {
    showToast(err.message || "Loi luu danh muc", "error");
  }
}

async function deleteCategoryAction(id) {
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;
  if (
    !confirm(
      `Xoa danh muc "${cat.name}"? Cac muc trong danh muc se chuyen ve "Chua phan loai".`,
    )
  )
    return;
  try {
    await API.deleteCategory(id);
    if (currentCategoryId === id) currentCategoryId = null;
    showToast("Da xoa danh muc");
    loadCategories();
    loadItems();
  } catch (err) {
    showToast("Loi xoa danh muc", "error");
  }
}

// ========== Move Category ==========
let movingItemId = null;

function openMoveCategory(itemId) {
  movingItemId = itemId;
  let html = `<li><button class="move-category-item" data-move-cat="">
    <span class="category-dot" style="background:#636e72"></span>
    Chua phan loai
  </button></li>`;
  for (const cat of categories) {
    html += `<li><button class="move-category-item" data-move-cat="${cat.id}">
      <span class="category-dot" style="background:${cat.color}"></span>
      ${escapeHtml(cat.name)}
    </button></li>`;
  }
  moveCategoryList.innerHTML = html;

  moveCategoryList.querySelectorAll(".move-category-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const catId = btn.dataset.moveCat || null;
      try {
        await API.moveCategory(movingItemId, catId);
        showToast("Da chuyen danh muc");
        closeMoveCategoryModal();
        loadItems();
        loadCategories();
      } catch {
        showToast("Loi chuyen danh muc", "error");
      }
    });
  });

  moveCategoryModal.classList.add("open");
}

function closeMoveCategoryModal(e) {
  if (e && e.target !== moveCategoryModal) return;
  moveCategoryModal.classList.remove("open");
}

// ========== Render Items ==========
function renderItem(item) {
  const card = document.createElement("div");
  card.className = `card${item.pinned ? " pinned" : ""}`;
  card.dataset.id = item.id;

  const catBadge = item.category_name
    ? `<span class="card-category-badge" style="background:${item.category_color}20; color:${item.category_color}"><span class="card-category-dot" style="background:${item.category_color}"></span>${escapeHtml(item.category_name)}</span>`
    : "";

  if (item.type === "image") {
    card.innerHTML = `
      <div class="card-image-wrapper" onclick="openModal('${item.id}')">
        <img src="/uploads/${item.filename}" alt="${escapeHtml(item.original_name || "")}" loading="lazy">
      </div>
      <div class="card-footer">
        <div class="card-meta">
          <span class="badge badge-image">IMG</span>
          ${catBadge}
          <span>${formatSize(item.file_size)}</span>
          <span>${formatDate(item.created_at)}</span>
        </div>
        <div class="card-actions">
          <button class="btn-icon ${item.pinned ? "pin-active" : ""}" onclick="togglePin('${item.id}')" title="Ghim">${ICONS.pin}</button>
          <button class="btn-icon" onclick="openMoveCategory('${item.id}')" title="Chuyen danh muc">${ICONS.folder}</button>
          <button class="btn-icon" onclick="downloadImage('${item.id}')" title="Tai ve">${ICONS.download}</button>
          <button class="btn-icon" onclick="copyImage('${item.id}', '/uploads/${item.filename}')" title="Copy anh">${ICONS.copy}</button>
          <button class="btn-icon" onclick="deleteItem('${item.id}')" title="Xoa">${ICONS.trash}</button>
        </div>
      </div>`;
  } else {
    card.innerHTML = `
      <div class="card-text-content">${escapeHtml(item.content)}</div>
      <div class="card-footer">
        <div class="card-meta">
          <span class="badge badge-text">TXT</span>
          ${catBadge}
          <span>${formatDate(item.created_at)}</span>
        </div>
        <div class="card-actions">
          <button class="btn-icon ${item.pinned ? "pin-active" : ""}" onclick="togglePin('${item.id}')" title="Ghim">${ICONS.pin}</button>
          <button class="btn-icon" onclick="openMoveCategory('${item.id}')" title="Chuyen danh muc">${ICONS.folder}</button>
          <button class="btn-icon" onclick="copyText('${item.id}')" title="Copy">${ICONS.copy}</button>
          <button class="btn-icon" onclick="deleteItem('${item.id}')" title="Xoa">${ICONS.trash}</button>
        </div>
      </div>`;
  }
  return card;
}

async function loadItems() {
  loading.style.display = "block";
  emptyState.style.display = "none";
  itemsGrid.innerHTML = "";

  try {
    const { items, total } = await API.getItems(
      currentFilter,
      searchQuery,
      currentCategoryId,
    );
    loading.style.display = "none";
    itemCount.textContent = `${total} muc`;

    if (items.length === 0) {
      emptyState.style.display = "flex";
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach((item) => frag.appendChild(renderItem(item)));
    itemsGrid.appendChild(frag);
  } catch (err) {
    loading.style.display = "none";
    showToast("Loi tai du lieu: " + err.message, "error");
  }
}

// ========== Actions ==========
async function saveText() {
  const content = textInput.value.trim();
  if (!content) {
    showToast("Vui long nhap noi dung", "error");
    return;
  }
  try {
    await API.saveText(content, getSelectedCategoryId());
    textInput.value = "";
    showToast("Da luu van ban");
    loadItems();
    loadCategories();
  } catch {
    showToast("Loi luu van ban", "error");
  }
}

async function uploadFiles(files) {
  const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
  if (!imgs.length) {
    showToast("Chi ho tro file anh", "error");
    return;
  }
  let ok = 0;
  for (const file of imgs) {
    try {
      await API.uploadImage(file, getSelectedCategoryId());
      ok++;
    } catch {}
  }
  showToast(`Da tai len ${ok}/${imgs.length} anh`);
  loadItems();
  loadCategories();
}

async function handlePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await API.pasteImage(
            reader.result,
            `clipboard-${Date.now()}.png`,
            getSelectedCategoryId(),
          );
          showToast("Da dan anh tu clipboard");
          loadItems();
          loadCategories();
        } catch {
          showToast("Loi dan anh", "error");
        }
      };
      reader.readAsDataURL(blob);
      return;
    }
  }
}

async function copyText(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  const text = card?.querySelector(".card-text-content")?.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Da copy van ban");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Da copy van ban");
  }
}

async function copyImage(id, src) {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    if (blob.type !== "image/png") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
    } else {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    }
    showToast("Da copy anh vao clipboard");
  } catch (err) {
    showToast("Khong the copy anh", "error");
  }
}

function downloadImage(id) {
  window.open(`/api/items/${id}/download`, "_blank");
}

async function deleteItem(id) {
  if (!confirm("Ban co chac muon xoa?")) return;
  try {
    await API.deleteItem(id);
    showToast("Da xoa");
    loadItems();
    loadCategories();
  } catch {
    showToast("Loi xoa", "error");
  }
}

async function togglePin(id) {
  try {
    const updated = await API.togglePin(id);
    showToast(updated.pinned ? "Da ghim" : "Da bo ghim");
    loadItems();
  } catch {
    showToast("Loi ghim", "error");
  }
}

// ========== Modal ==========
function openModal(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  const img = card?.querySelector(".card-image-wrapper img");
  if (!img) return;
  currentModalItem = id;
  modalImage.src = img.src;
  imageModal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(e) {
  if (e && e.target !== imageModal && e.target !== modalImage.parentElement)
    return;
  imageModal.classList.remove("open");
  document.body.style.overflow = "";
  currentModalItem = null;
}

function downloadModalImage() {
  if (currentModalItem) downloadImage(currentModalItem);
}
function copyModalImage() {
  if (currentModalItem) copyImage(currentModalItem, modalImage.src);
}

// ========== Sidebar ==========
function toggleSidebar() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.classList.toggle("mobile-open");
  } else {
    sidebar.classList.toggle("collapsed");
    mainWrapper.classList.toggle("expanded");
  }
}

// ========== Event Listeners ==========
saveTextBtn.addEventListener("click", saveText);
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveText();
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    uploadFiles(e.target.files);
    e.target.value = "";
  }
});

document.addEventListener("paste", handlePaste);

pasteZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  pasteZone.classList.add("dragover");
});
pasteZone.addEventListener("dragleave", () =>
  pasteZone.classList.remove("dragover"),
);
pasteZone.addEventListener("drop", (e) => {
  e.preventDefault();
  pasteZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
});

document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length > 0 && !pasteZone.contains(e.target))
    uploadFiles(e.dataTransfer.files);
});

// Type filters
document.querySelectorAll(".type-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".type-filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    loadItems();
  });
});

// Search
let searchTimeout;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    loadItems();
  }, 300);
});

// Sidebar toggle
document
  .getElementById("sidebarToggle")
  .addEventListener("click", toggleSidebar);
document.getElementById("sidebarOpenBtn").addEventListener("click", () => {
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("mobile-open");
  } else {
    toggleSidebar();
  }
});

// Close mobile sidebar on outside click
document.addEventListener("click", (e) => {
  if (
    window.innerWidth <= 768 &&
    sidebar.classList.contains("mobile-open") &&
    !sidebar.contains(e.target) &&
    e.target.id !== "sidebarOpenBtn"
  ) {
    sidebar.classList.remove("mobile-open");
  }
});

// Category modal
addCategoryBtn.addEventListener("click", openAddCategory);
saveCategoryBtn.addEventListener("click", saveCategory);
categoryNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveCategory();
});

colorPicker.querySelectorAll(".color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    colorPicker
      .querySelectorAll(".color-swatch")
      .forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
  });
});

// Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (imageModal.classList.contains("open")) closeModal();
    else if (categoryModal.classList.contains("open")) closeCategoryModal();
    else if (moveCategoryModal.classList.contains("open"))
      closeMoveCategoryModal();
  }
});

// ========== Init ==========
loadCategories();
loadItems();
setInterval(() => {
  loadItems();
  loadCategories();
}, 10000);
