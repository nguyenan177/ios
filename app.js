import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import {
    getFirestore, collection, addDoc, onSnapshot, serverTimestamp,
    orderBy, query, deleteDoc, doc, updateDoc, getDoc, setDoc, getDocs
  } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

  // ===== Firebase TRUNG TÂM: chỉ dùng để xác thực đăng nhập (username/password/config riêng của mỗi người) =====
  const centralConfig = {
    apiKey: "AIzaSyBgu_xwD78pAX13Nlow_34WGMgt2zdF2-g",
    authDomain: "toolreg.firebaseapp.com",
    projectId: "toolreg",
    storageBucket: "toolreg.firebasestorage.app",
    messagingSenderId: "827602504675",
    appId: "1:827602504675:web:01ee55370c320c7935aed6",
    measurementId: "G-QEHKVJP3K9"
  };
  const centralApp = initializeApp(centralConfig, "central");
  const centralDb = getFirestore(centralApp);

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function normUser(u) { return u.trim().toLowerCase(); }
  function setMsg(elId, text, type) {
    const el = document.getElementById(elId);
    el.textContent = text;
    el.className = "msg " + (type || "");
  }

  // ===========================
  // ĐĂNG NHẬP NHANH (tài khoản đã lưu trên máy này)
  // ===========================
  const SAVED_ACCOUNTS_KEY = "savedAccounts";

  function getSavedAccounts() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function setSavedAccounts(arr) {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(arr));
  }

  function saveAccountForQuickLogin(username, passwordHash, firebaseConfig) {
    const list = getSavedAccounts().filter(a => a.username !== username);
    list.unshift({ username, passwordHash, firebaseConfig });
    setSavedAccounts(list.slice(0, 8)); // giới hạn tối đa 8 tài khoản gần nhất
  }

  function renderQuickAccounts() {
    const box = document.getElementById("quickLoginBox");
    const list = document.getElementById("quickAccountsList");
    const accounts = getSavedAccounts();
    if (accounts.length === 0) { box.style.display = "none"; return; }
    box.style.display = "block";
    list.innerHTML = accounts.map(a => `
      <div class="quick-account" id="qa-${a.username}" onclick="quickLogin('${a.username}')">
        <div class="qa-avatar">${a.username.charAt(0).toUpperCase()}</div>
        <div class="qa-name">${a.username}</div>
        <button class="qa-remove" title="Xoá tài khoản đã lưu" onclick="event.stopPropagation(); removeSavedAccount('${a.username}')">✕</button>
      </div>`).join("");
  }

  window.quickLogin = async function (username) {
    const accounts = getSavedAccounts();
    const acc = accounts.find(a => a.username === username);
    if (!acc) return;
    const item = document.getElementById("qa-" + username);
    if (item) { item.classList.add("disabled"); item.querySelector(".qa-name").textContent = "⏳ Đang đăng nhập..."; }
    try {
      // Vẫn xác minh lại với Firestore để đảm bảo tài khoản chưa bị xoá / đổi cấu hình
      const snap = await getDoc(doc(centralDb, "users", username));
      if (!snap.exists()) { removeSavedAccountSilently(username); setMsg("loginMsg", "❌ Tài khoản không còn tồn tại.", "error"); renderQuickAccounts(); return; }
      const data = snap.data();
      if (data.passwordHash !== acc.passwordHash) { removeSavedAccountSilently(username); setMsg("loginMsg", "⚠️ Mật khẩu đã thay đổi, vui lòng đăng nhập lại.", "error"); renderQuickAccounts(); return; }
      localStorage.setItem("authUser", username);
      localStorage.setItem("authConfig", JSON.stringify(data.firebaseConfig));
      saveAccountForQuickLogin(username, data.passwordHash, data.firebaseConfig);
      enterManager(username, data.firebaseConfig);
    } catch (e) {
      setMsg("loginMsg", "❌ Lỗi: " + e.message, "error");
      if (item) { item.classList.remove("disabled"); item.querySelector(".qa-name").textContent = username; }
    }
  };

  function removeSavedAccountSilently(username) {
    setSavedAccounts(getSavedAccounts().filter(a => a.username !== username));
  }

  window.removeSavedAccount = function (username) {
    removeSavedAccountSilently(username);
    renderQuickAccounts();
  };

  window.doLogin = async function () {
    const username = normUser(document.getElementById("loginUsername").value);
    const password = document.getElementById("loginPassword").value;
    const remember = document.getElementById("rememberAccount").checked;
    if (!username || !password) return setMsg("loginMsg", "⚠️ Vui lòng nhập đủ thông tin.", "error");

    const btn = document.getElementById("btnLogin");
    btn.disabled = true; btn.textContent = "⏳ Đang kiểm tra...";
    try {
      const snap = await getDoc(doc(centralDb, "users", username));
      if (!snap.exists()) { setMsg("loginMsg", "❌ Tài khoản không tồn tại.", "error"); return; }
      const data = snap.data();
      const hash = await sha256(password);
      if (hash !== data.passwordHash) { setMsg("loginMsg", "❌ Sai mật khẩu.", "error"); return; }

      localStorage.setItem("authUser", username);
      localStorage.setItem("authConfig", JSON.stringify(data.firebaseConfig));
      if (remember) saveAccountForQuickLogin(username, hash, data.firebaseConfig);
      setMsg("loginMsg", "✅ Đăng nhập thành công...", "success");
      enterManager(username, data.firebaseConfig);
    } catch (e) {
      setMsg("loginMsg", "❌ Lỗi: " + e.message, "error");
    } finally {
      btn.disabled = false; btn.textContent = "Đăng nhập";
    }
  };

  document.getElementById("loginUsername").addEventListener("keydown", e => { if (e.key === "Enter") window.doLogin(); });
  document.getElementById("loginPassword").addEventListener("keydown", e => { if (e.key === "Enter") window.doLogin(); });

  renderQuickAccounts();

  window.doLogout = function () {
    if (!confirm("Đăng xuất khỏi tài khoản này?")) return;
    localStorage.removeItem("authUser");
    localStorage.removeItem("authConfig");
    document.getElementById("managerView").style.display = "none";
    document.getElementById("loginView").style.display = "flex";
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
    setMsg("loginMsg", "", "");
    renderQuickAccounts();
  };

  // ===========================
  // QUẢN LÝ TÀI KHOẢN (chỉ chạy sau khi đăng nhập thành công)
  // ===========================
  function enterManager(username, firebaseConfig) {
    document.getElementById("loginView").style.display = "none";
    document.getElementById("managerView").style.display = "block";
    document.getElementById("whoUser").textContent = username;

    const app = initializeApp(firebaseConfig, "user-" + Date.now());

    const db = getFirestore(app);
    const accountsCol = collection(db, "accounts");
    const groupsCol   = collection(db, "groups");
  const accountDataCol = collection(db, "accountData");
    const settingsRef = doc(db, "settings", "apiKeys");

    let allAccounts = [];
    let allGroups   = [];         // [{id, name, memberIds:[]}]
    let activeGroupId = null;     // null = tất cả
    let modalAccountId = null;
    let modalSelectedGroupIds = new Set();
  let currentDataAccountId = null;

    const DEFAULT_API_KEY         = "ed7192f2d8bd0a6ee3b60a1915cc0084";
    const DEFAULT_CAPTCHA_API_KEY = "7354dfda0562f14700d36f923868d5e7";

    window.getApiKey           = () => window._cfg?.apiKey           || DEFAULT_API_KEY;
    window.getCaptchaApiKey    = () => window._cfg?.captchaApiKey    || DEFAULT_CAPTCHA_API_KEY;
    window.getPassword         = () => window._cfg?.password         || "";
    window.getWithdrawPassword = () => window._cfg?.withdrawPassword || "";
    window.getTgChatId         = () => window._cfg?.tgChatId         || "";
    window._cfg = {};

    function setStatusMsg(msg, type) {
      const el = document.getElementById("apiStatusMsg");
      el.textContent = msg; el.className = "api-status-msg " + type;
      if (msg) setTimeout(() => { el.textContent = ""; el.className = "api-status-msg"; }, 3500);
    }

    function updateSavedDot(hasSaved) {
      const dot = document.getElementById("apiSavedDot");
      dot.classList.toggle("saved", !!hasSaved);
      dot.title = hasSaved ? "Đã lưu cài đặt trên Firebase" : "Đang dùng giá trị mặc định";
    }

    function applyDataToCache(d) {
      window._cfg = { apiKey: d.apiKey||"", captchaApiKey: d.captchaApiKey||"", password: d.password||"", withdrawPassword: d.withdrawPassword||"", tgChatId: d.tgChatId||"" };
    }

    function fillFormFromCache() {
      document.getElementById("inputApiKey").value           = window._cfg.apiKey;
      document.getElementById("inputCaptchaKey").value       = window._cfg.captchaApiKey;
      document.getElementById("inputPassword").value         = window._cfg.password;
      document.getElementById("inputWithdrawPassword").value = window._cfg.withdrawPassword;
      document.getElementById("inputTgChatId").value         = window._cfg.tgChatId;
    }

    async function loadSettings() {
      try {
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          applyDataToCache(snap.data());
          const d = snap.data();
          updateSavedDot(!!(d.apiKey || d.captchaApiKey || d.password || d.withdrawPassword || d.tgChatId));
        }
      } catch(e) { console.warn("Không tải được cài đặt:", e); }
    }

    window.toggleApiPanel = async function() {
      const body = document.getElementById("apiSettingsBody");
      const btn  = document.getElementById("apiToggleBtn");
      const isOpen = body.classList.toggle("open");
      btn.textContent = isOpen ? "▲ Đóng" : "▼ Mở";
      if (isOpen) {
        try { const snap = await getDoc(settingsRef); if (snap.exists()) applyDataToCache(snap.data()); } catch(e) {}
        fillFormFromCache();
      }
    };

    window.saveApiKeys = async function() {
      const payload = {
        apiKey: document.getElementById("inputApiKey").value.trim(),
        captchaApiKey: document.getElementById("inputCaptchaKey").value.trim(),
        password: document.getElementById("inputPassword").value.trim(),
        withdrawPassword: document.getElementById("inputWithdrawPassword").value.trim(),
        tgChatId: document.getElementById("inputTgChatId").value.trim(),
      };
      const hasAny = Object.values(payload).some(v => v);
      if (!hasAny) { setStatusMsg("⚠️ Vui lòng nhập ít nhất một trường.", "error"); return; }
      const btn = document.querySelector(".api-btn-save");
      btn.disabled = true; btn.textContent = "⏳ Đang lưu...";
      try {
        await setDoc(settingsRef, payload);
        applyDataToCache(payload);
        setStatusMsg("✅ Đã lưu lên Firebase thành công!", "success");
        updateSavedDot(hasAny);
      } catch(e) { setStatusMsg("❌ Lỗi: " + e.message, "error"); }
      btn.disabled = false; btn.textContent = "💾 Lưu tất cả cài đặt";
    };

    window.resetApiKeys = async function() {
      if (!confirm("Reset về mặc định? Tất cả cài đặt trên Firebase sẽ bị xoá.")) return;
      const btn = document.querySelector(".api-btn-reset");
      btn.disabled = true; btn.textContent = "⏳...";
      try {
        const empty = { apiKey:"", captchaApiKey:"", password:"", withdrawPassword:"", tgChatId:"" };
        await setDoc(settingsRef, empty);
        applyDataToCache(empty);
        fillFormFromCache();
        setStatusMsg("🔄 Đã reset về mặc định.", "success");
        updateSavedDot(false);
      } catch(e) { setStatusMsg("❌ Lỗi: " + e.message, "error"); }
      btn.disabled = false; btn.textContent = "🔄 Reset";
    };

    window.showActiveKeys = async function() {
      const box = document.getElementById("activeKeyBox");
      if (box.style.display !== "none") { box.style.display = "none"; return; }
      let cfg = { ...window._cfg };
      try { const snap = await getDoc(settingsRef); if (snap.exists()) { applyDataToCache(snap.data()); cfg = { ...window._cfg }; } } catch(e) {}
      const rows = [
        { id:"activeApiKeyVal",    val: cfg.apiKey           || DEFAULT_API_KEY,         isDefault: !cfg.apiKey },
        { id:"activeCaptchaKeyVal",val: cfg.captchaApiKey    || DEFAULT_CAPTCHA_API_KEY, isDefault: !cfg.captchaApiKey },
        { id:"activePasswordVal",  val: cfg.password         || "(chưa đặt)",            isDefault: !cfg.password },
        { id:"activeWithdrawVal",  val: cfg.withdrawPassword || "(chưa đặt)",            isDefault: !cfg.withdrawPassword },
        { id:"activeTgChatIdVal",  val: cfg.tgChatId         || "(chưa đặt)",            isDefault: !cfg.tgChatId },
      ];
      rows.forEach(({ id, val, isDefault }) => {
        const el = document.getElementById(id);
        el.textContent = val;
        el.className = "active-key-val" + (isDefault ? " is-default" : "");
      });
      box.style.display = "block";
    };

    window.copyActiveKey = async function(elId) {
      const val = document.getElementById(elId).textContent.trim();
      try {
        await navigator.clipboard.writeText(val);
        const btn = document.querySelector(`[onclick="copyActiveKey('${elId}')"]`);
        btn.textContent = "✅ Đã copy"; btn.style.background = "#2e7d32";
        setTimeout(() => { btn.textContent = "📋 Copy"; btn.style.background = ""; }, 1800);
      } catch(e) { alert("Không thể copy: " + val); }
    };

    loadSettings();

    // ===========================
    // GROUP PANEL
    // ===========================
    window.toggleGroupPanel = function() {
      const body = document.getElementById("groupPanelBody");
      const btn  = document.getElementById("groupToggleBtn");
      const isOpen = body.classList.toggle("open");
      btn.textContent = isOpen ? "▲ Đóng" : "▼ Mở";
    };

    function renderGroupPanel() {
      const badge = document.getElementById("groupCountBadge");
      badge.textContent = allGroups.length;

      const container = document.getElementById("groupList");
      if (allGroups.length === 0) {
        container.innerHTML = '<div class="group-empty">Chưa có nhóm nào. Tạo nhóm mới ở trên!</div>';
      } else {
        container.innerHTML = allGroups.map(g => {
          const memberIds = g.memberIds || [];
          const count = memberIds.length;
          const members = allAccounts.filter(a => memberIds.includes(a.id));
          const membersHtml = members.length === 0
            ? '<div class="group-empty">Chưa có thành viên nào.</div>'
            : members.map(a => `
              <div class="group-member-row">
                <span class="group-member-name">${a.data.name}</span>
                <span class="group-member-acc">${a.data.account}</span>
                <span class="group-member-bank">${a.data.tag}</span>
                <button class="group-member-remove" onclick="removeFromGroup('${g.id}','${a.id}')">✕</button>
              </div>`).join("");
          return `
            <div class="group-item" id="gitem-${g.id}">
              <div class="group-item-header" onclick="toggleGroupMembers('${g.id}')">
                <span style="font-size:18px;">👥</span>
                <span class="group-item-name">${g.name}</span>
                <span class="group-item-count">${count}</span>
                <div class="group-item-actions" onclick="event.stopPropagation()">
                  <button class="btn-rename-group" onclick="renameGroup('${g.id}','${g.name}')">✏️ Đổi tên</button>
                  <button class="btn-delete-group" onclick="deleteGroup('${g.id}')">🗑️</button>
                </div>
              </div>
              <div class="group-members" id="gmembers-${g.id}">
                ${membersHtml}
              </div>
            </div>`;
        }).join("");
      }

      renderFilterBar();
    }

    function renderFilterBar() {
      const dropdown = document.getElementById("groupFilterDropdown");
      const allTab = `<button class="group-filter-tab${activeGroupId===null?' active':''}" onclick="filterByGroup(null, this)">🗂️ Tất cả</button>`;
      const groupTabs = allGroups.map(g => `<button class="group-filter-tab${activeGroupId===g.id?' active':''}" onclick="filterByGroup('${g.id}', this)">👥 ${g.name}</button>`).join("");
      dropdown.innerHTML = allTab + groupTabs;

      const currentEl = document.getElementById("groupFilterCurrent");
      const toggleEl = document.getElementById("groupFilterToggle");
      if (activeGroupId === null) {
        currentEl.textContent = "Tất cả";
        toggleEl.classList.remove("active-filter");
      } else {
        const g = allGroups.find(x => x.id === activeGroupId);
        currentEl.textContent = g ? g.name : "Tất cả";
        toggleEl.classList.add("active-filter");
      }
    }

    window.toggleGroupFilterDropdown = function() {
      document.getElementById("groupFilterBar").classList.toggle("open");
    };

    document.addEventListener("click", (e) => {
      const bar = document.getElementById("groupFilterBar");
      if (bar && !bar.contains(e.target)) bar.classList.remove("open");
    });

    window.toggleGroupMembers = function(gid) {
      const el = document.getElementById("gmembers-" + gid);
      el.classList.toggle("open");
    };

    window.createGroup = async function() {
      const inp = document.getElementById("newGroupName");
      const name = inp.value.trim();
      if (!name) return alert("Vui lòng nhập tên nhóm.");
      if (allGroups.find(g => g.name.toLowerCase() === name.toLowerCase())) return alert("Nhóm này đã tồn tại.");
      await addDoc(groupsCol, { name, memberIds: [], time: serverTimestamp() });
      inp.value = "";
    };

    window.renameGroup = async function(gid, oldName) {
      const newName = prompt("Đổi tên nhóm:", oldName);
      if (!newName || newName.trim() === oldName) return;
      await updateDoc(doc(db, "groups", gid), { name: newName.trim() });
    };

    window.deleteGroup = async function(gid) {
      const g = allGroups.find(x => x.id === gid);
      if (!confirm(`Xoá nhóm "${g?.name}"? Tài khoản sẽ không bị xoá.`)) return;
      await deleteDoc(doc(db, "groups", gid));
      if (activeGroupId === gid) { activeGroupId = null; }
    };

    window.removeFromGroup = async function(gid, accountId) {
      const ref = doc(db, "groups", gid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const current = snap.data().memberIds || [];
      await updateDoc(ref, { memberIds: current.filter(id => id !== accountId) });
    };

    window.filterByGroup = function(gid, btn) {
      activeGroupId = gid;
      document.querySelectorAll(".group-filter-tab").forEach(t => t.classList.remove("active"));
      if (btn) btn.classList.add("active");
      renderFilterBar();
      document.getElementById("groupFilterBar").classList.remove("open");
      const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
      applyFilters(keyword);
    };

    // ===========================
    // MODAL: add to group
    // ===========================
    window.openGroupModal = function(accountId) {
      modalAccountId = accountId;
      modalSelectedGroupIds = new Set();
      const acc = allAccounts.find(a => a.id === accountId);
      document.getElementById("modalAccountInfo").textContent = acc ? `📌 ${acc.data.name} — ${acc.data.account}` : "";

      // Pre-select groups this account is already in
      allGroups.forEach(g => { if ((g.memberIds||[]).includes(accountId)) modalSelectedGroupIds.add(g.id); });

      renderModalGroupList();
      document.getElementById("groupModal").classList.add("open");
    };

    window.openGroupModalForSelected = function() {
      const checkboxes = document.querySelectorAll(".account-item input[type='checkbox']:checked");
      if (checkboxes.length === 0) return alert("Vui lòng chọn ít nhất 1 tài khoản.");
      const ids = [];
      checkboxes.forEach(cb => {
        const id = cb.closest(".account-item")?.querySelector(".btn-del")?.getAttribute("onclick")?.match(/'(.*?)'/)?.[1];
        if (id) ids.push(id);
      });
      if (ids.length === 0) return;

      modalAccountId = ids;
      modalSelectedGroupIds = new Set();
      document.getElementById("modalAccountInfo").textContent = `📌 Đã chọn ${ids.length} tài khoản`;

      renderModalGroupList();
      document.getElementById("groupModal").classList.add("open");
    };

    window.closeGroupModal = function() {
      document.getElementById("groupModal").classList.remove("open");
      modalAccountId = null;
    };

    function renderModalGroupList() {
      const container = document.getElementById("modalGroupList");
      if (allGroups.length === 0) {
        container.innerHTML = '<div class="modal-empty">Chưa có nhóm nào. Hãy tạo nhóm trong phần Quản lý nhóm.</div>';
        return;
      }
      container.innerHTML = allGroups.map(g => {
        const selected = modalSelectedGroupIds.has(g.id);
        return `<div class="modal-group-option${selected?' selected':''}" onclick="toggleModalGroup('${g.id}', this)">
          <span style="font-size:18px;">👥</span>
          <span class="g-name">${g.name}</span>
          <span class="g-count" style="font-size:12px;color:#aaa;">${(g.memberIds||[]).length} thành viên</span>
          ${selected ? '<span class="g-check">✅</span>' : '<span class="g-check" style="opacity:0">✅</span>'}
        </div>`;
      }).join("");
    }

    window.toggleModalGroup = function(gid, el) {
      if (modalSelectedGroupIds.has(gid)) { modalSelectedGroupIds.delete(gid); el.classList.remove("selected"); }
      else { modalSelectedGroupIds.add(gid); el.classList.add("selected"); }
      // update checkmark
      el.querySelector(".g-check").style.opacity = modalSelectedGroupIds.has(gid) ? "1" : "0";
      renderModalGroupList();
    };

    window.confirmAddToGroup = async function() {
      if (!modalAccountId) return;
      if (Array.isArray(modalAccountId)) {
        for (const g of allGroups) {
          if (!modalSelectedGroupIds.has(g.id)) continue;
          const ref = doc(db, "groups", g.id);
          const current = g.memberIds || [];
          const merged = new Set(current);
          modalAccountId.forEach(id => merged.add(id));
          await updateDoc(ref, { memberIds: [...merged] });
        }
      } else {
        for (const g of allGroups) {
          const ref = doc(db, "groups", g.id);
          const current = g.memberIds || [];
          const shouldBe = modalSelectedGroupIds.has(g.id);
          const isIn     = current.includes(modalAccountId);
          if (shouldBe && !isIn) await updateDoc(ref, { memberIds: [...current, modalAccountId] });
          if (!shouldBe && isIn) await updateDoc(ref, { memberIds: current.filter(id => id !== modalAccountId) });
        }
      }
      closeGroupModal();
    };

    
  // ===========================
  // MODAL: DATA tài khoản
  // ===========================
  window.openDataModal = async function(accountId) {
    currentDataAccountId = accountId;
    const acc = allAccounts.find(a => a.id === accountId);
    document.getElementById("dataModalInfo").textContent = acc ? `📌 ${acc.data.name} — ${acc.data.account}` : "";

    // Reset form
    document.getElementById("dataUsername").value = "";
    document.getElementById("dataPassword").value = "";
    document.getElementById("dataFullname").value = "";
    document.getElementById("dataPhone").value = "";
    document.getElementById("dataGmail").value = "";
    document.getElementById("dataStatusMsg").textContent = "";
    document.getElementById("dataStatusMsg").className = "api-status-msg";

    // Load existing data
    try {
      const snap = await getDoc(doc(db, "accountData", accountId));
      if (snap.exists()) {
        const d = snap.data();
        document.getElementById("dataUsername").value = d.username || "";
        document.getElementById("dataPassword").value = d.password || "";
        document.getElementById("dataFullname").value = d.fullname || "";
        document.getElementById("dataPhone").value = d.phone || "";
        document.getElementById("dataGmail").value = d.gmail || "";
      }
    } catch(e) { console.warn("Không tải được data:", e); }

    document.getElementById("dataModal").classList.add("open");
  };

  window.closeDataModal = function() {
    document.getElementById("dataModal").classList.remove("open");
    currentDataAccountId = null;
  };

  window.saveAccountData = async function() {
    if (!currentDataAccountId) return;
    const payload = {
      username: document.getElementById("dataUsername").value.trim(),
      password: document.getElementById("dataPassword").value.trim(),
      fullname: document.getElementById("dataFullname").value.trim(),
      phone: document.getElementById("dataPhone").value.trim(),
      gmail: document.getElementById("dataGmail").value.trim(),
      updatedAt: serverTimestamp()
    };
    const btn = document.querySelector('#dataModal .modal-btn-confirm');
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = "⏳ Đang lưu...";
    try {
      await setDoc(doc(db, "accountData", currentDataAccountId), payload);
      const el = document.getElementById("dataStatusMsg");
      el.textContent = "✅ Đã lưu thành công!";
      el.className = "api-status-msg success";
      setTimeout(() => { el.textContent = ""; el.className = "api-status-msg"; }, 2500);
    } catch(e) {
      const el = document.getElementById("dataStatusMsg");
      el.textContent = "❌ Lỗi: " + e.message;
      el.className = "api-status-msg error";
    }
    btn.disabled = false; btn.textContent = originalText;
  };

  document.getElementById("dataModal").addEventListener("click", function(e) {
    if (e.target === this) closeDataModal();
  });

// Close modal on overlay click
    document.getElementById("groupModal").addEventListener("click", function(e) {
      if (e.target === this) closeGroupModal();
    });

    // ===========================
    // RENDER ACCOUNTS
    // ===========================
    function highlightText(text, keyword) {
      if (!keyword) return text;
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="highlight">$1</span>');
    }

    function renderAccounts(accounts, keyword = "") {
      const list = document.getElementById("accountList");
      const resultCount = document.getElementById("searchResultCount");
      list.innerHTML = "";
      const filterLabel = activeGroupId ? `nhóm "${allGroups.find(g=>g.id===activeGroupId)?.name}"` : "";
      if (accounts.length === 0) {
        list.innerHTML = filterLabel
          ? `<i>Không có tài khoản nào trong ${filterLabel}.</i>`
          : (keyword ? `<i>Không tìm thấy kết quả cho "<b>${keyword}</b>".</i>` : "<i>Chưa có tài khoản nào.</i>");
        resultCount.textContent = keyword || filterLabel ? "0 kết quả" : "";
        document.getElementById("totalCount").textContent = allAccounts.length;
        return;
      }
      accounts.forEach(({ data, id, date }) => {
        const extraTags = data.extra_tags || [];
        // Which groups contain this account
        const myGroups = allGroups.filter(g => (g.memberIds||[]).includes(id));
        const groupBadgesHtml = myGroups.map(g => `<span style="background:#ede8fd;color:#7c3aed;border-radius:20px;padding:2px 9px;font-size:12px;font-weight:700;">👥 ${g.name}</span>`).join("");
        const div = document.createElement("div");
        div.className = "account-item";
        div.innerHTML = `
          <div class="account-header">
            <div>
              <input type="checkbox" style="transform: scale(1.2); margin-right: 6px;" />
              <div><strong>${highlightText(data.name, keyword)}</strong></div>
              <div>${highlightText(data.account, keyword)}</div>
              <div class="account-meta">${date}</div>
              ${myGroups.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">${groupBadgesHtml}</div>` : ""}
            </div>
            <div><span class="bank-tag"><img src="" id="banklogo-${id}" style="width:36px;height:36px;object-fit:contain;border-radius:5px;vertical-align:middle;" onerror="this.style.display='none'">${data.tag}</span></div>
          </div>
          <div class="extra-tags" id="tags-${id}">
            ${extraTags.map(tag => `<span class="extra-tag">${tag} <button onclick="removeTag('${id}', '${tag}')">×</button></span>`).join("")}
          </div>
          <div class="tag-input-row" id="tagInputRow-${id}">
            <input type="text" id="input-${id}" placeholder="Nhập tag phụ..." />
            <button onclick="addExtraTag('${id}', 'input-${id}')">✔</button>
          </div>
          <div class="action-buttons">
            <button class="btn btn-copy" onclick="copyText('${data.name}')">📋 Copy Tên</button>
            <button class="btn btn-stk"  onclick="copyText('${data.account}')">💳 Copy STK</button>
            <button class="btn btn-tag"  onclick="toggleTagInput('${id}')">➕ Thêm Tag</button>
            <button class="btn btn-del" onclick="deleteAccount('${id}')">❌ Xoá</button>
          </div>
          <div style="margin-top:8px;">
            <button class="btn btn-data" onclick="openDataModal('${id}')" style="width:100%;">📝 DATA</button>
          </div>
        `;
        list.appendChild(div);
        var logoImg = div.querySelector("#banklogo-" + id);
        if (logoImg && window.getBankLogo) logoImg.src = window.getBankLogo(data.tag);
      });
      document.getElementById("totalCount").textContent = allAccounts.length;
      const total = activeGroupId
        ? (allGroups.find(g=>g.id===activeGroupId)?.memberIds||[]).length
        : allAccounts.length;
      resultCount.textContent = (keyword || activeGroupId) ? `${accounts.length} / ${total} kết quả` : "";
    }

    function applyFilters(keyword) {
      let filtered = allAccounts;
      if (activeGroupId) {
        const g = allGroups.find(x => x.id === activeGroupId);
        const ids = g ? (g.memberIds || []) : [];
        filtered = filtered.filter(a => ids.includes(a.id));
      }
      if (keyword) {
        filtered = filtered.filter(({ data }) => data.name.toLowerCase().includes(keyword) || data.account.toLowerCase().includes(keyword));
      }
      renderAccounts(filtered, keyword);
    }

    window.handleSearch = () => {
      const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
      document.getElementById("clearBtn").classList.toggle("visible", keyword.length > 0);
      applyFilters(keyword);
    };

    window.clearSearch = () => {
      document.getElementById("searchInput").value = "";
      document.getElementById("clearBtn").classList.remove("visible");
      document.getElementById("searchResultCount").textContent = "";
      applyFilters("");
    };

    // ===========================
    // ACCOUNT CRUD
    // ===========================
    window.addAccount = async () => {
      const name = document.getElementById("name").value.trim();
      const account = document.getElementById("account").value.trim();
      const tag = document.getElementById("tagSelect").value;
      const btn = document.getElementById("btnAdd");
      if (!name || !account || !tag) return alert("Vui lòng nhập đủ thông tin và chọn ngân hàng.");
      btn.disabled = true; btn.textContent = "Đang thêm...";
      await addDoc(accountsCol, { name, account, tag, extra_tags: [], time: serverTimestamp() });
      btn.disabled = false; btn.textContent = "Thêm";
      document.getElementById("name").value = "";
      document.getElementById("account").value = "";
      document.getElementById("tagSelect").value = "";
      var d = document.getElementById("display-tagSelect");
      d.innerHTML = '<span class="display-text">-- Chọn ngân hàng --</span><span class="arrow">▼</span>';
      d.classList.add("placeholder");
    };

    window.addBulk = async () => {
      const text = document.getElementById("bulkInput").value.trim();
      const tag = document.getElementById("bulkTag").value;
      const btn = document.getElementById("btnBulk");
      if (!text || !tag) return alert("Vui lòng nhập dữ liệu và chọn ngân hàng.");
      btn.disabled = true; btn.textContent = "Đang thêm...";
      for (const line of text.split("\n")) {
        const parts = line.split(/[-–]/);
        if (parts.length === 2) {
          const name = parts[0].trim(), account = parts[1].trim();
          if (name && account) await addDoc(accountsCol, { name, account, tag, extra_tags: [], time: serverTimestamp() });
        }
      }
      btn.disabled = false; btn.textContent = "➕ Thêm hàng loạt";
      document.getElementById("bulkInput").value = "";
      document.getElementById("bulkTag").value = "";
      var d2 = document.getElementById("display-bulkTag");
      d2.innerHTML = '<span class="display-text">-- Chọn ngân hàng --</span><span class="arrow">▼</span>';
      d2.classList.add("placeholder");
    };

    window.copyText = async (text) => {
      try { await navigator.clipboard.writeText(text); alert("Đã copy: " + text); } catch { alert("Không thể copy."); }
    };

    window.copyAll = async () => {
      const lines = [];
      document.querySelectorAll(".account-item").forEach(item => {
        const name = item.querySelector("strong")?.textContent.trim() || "";
        const account = item.querySelector(".account-header div:nth-child(1)").children[1]?.textContent.trim() || "";
        const tag = item.querySelector(".bank-tag")?.textContent.trim() || "";
        if (name && account && tag) lines.push(`${name} - ${account} - ${tag}`);
      });
      try { await navigator.clipboard.writeText(lines.join("\n")); alert("Đã sao chép danh sách."); } catch { alert("Không thể sao chép."); }
    };

    window.deleteAccount = async (id) => {
      if (!confirm("Bạn có chắc muốn xoá?")) return;
      // Also remove from all groups
      for (const g of allGroups) {
        if ((g.memberIds||[]).includes(id)) {
          await updateDoc(doc(db, "groups", g.id), { memberIds: g.memberIds.filter(x => x !== id) });
        }
      }
      await deleteDoc(doc(db, "accounts", id));
    };

    window.toggleTagInput = (id) => { document.getElementById(`tagInputRow-${id}`).classList.toggle('show'); };

    window.addExtraTag = async (id, inputId) => {
      const input = document.getElementById(inputId);
      const tag = input.value.trim();
      if (!tag) return;
      const ref = doc(db, "accounts", id);
      const snap = await getDoc(ref);
      const current = snap.data().extra_tags || [];
      if (!current.includes(tag)) await updateDoc(ref, { extra_tags: [...current, tag] });
      input.value = "";
    };

    window.removeTag = async (id, tagToRemove) => {
      const tagEl = [...document.querySelectorAll(`#tags-${id} .extra-tag`)].find(el => el.textContent.includes(tagToRemove));
      if (tagEl) tagEl.classList.add('removing');
      setTimeout(async () => {
        const ref = doc(db, "accounts", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        await updateDoc(ref, { extra_tags: (snap.data().extra_tags || []).filter(t => t !== tagToRemove) });
      }, 200);
    };

    window.deleteSelectedAccounts = async () => {
      const checkboxes = document.querySelectorAll(".account-item input[type='checkbox']:checked");
      if (checkboxes.length === 0) return alert("Vui lòng chọn ít nhất 1 tài khoản để xoá.");
      if (!confirm(`Bạn có chắc muốn xoá ${checkboxes.length} tài khoản đã chọn?`)) return;
      for (const cb of checkboxes) {
        const id = cb.closest(".account-item")?.querySelector(".btn-del")?.getAttribute("onclick")?.match(/'(.*?)'/)?.[1];
        if (id) {
          for (const g of allGroups) {
            if ((g.memberIds||[]).includes(id)) await updateDoc(doc(db, "groups", g.id), { memberIds: g.memberIds.filter(x => x !== id) });
          }
          await deleteDoc(doc(db, "accounts", id));
        }
      }
    };

    // ===========================
    // REALTIME LISTENERS
    // ===========================
    const qAccounts = query(accountsCol, orderBy("time", "desc"));
    onSnapshot(qAccounts, (snapshot) => {
      allAccounts = [];
      snapshot.forEach(docSnap => {
        allAccounts.push({ data: docSnap.data(), id: docSnap.id, date: docSnap.data().time?.toDate().toLocaleString("vi-VN") || "" });
      });
      const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
      applyFilters(keyword);
      renderGroupPanel(); // refresh group member names
    });

    const qGroups = query(groupsCol, orderBy("time", "asc"));
    onSnapshot(qGroups, (snapshot) => {
      allGroups = [];
      snapshot.forEach(docSnap => {
        allGroups.push({ id: docSnap.id, ...docSnap.data() });
      });
      renderGroupPanel();
      const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
      applyFilters(keyword);
    });

  }

  // Nếu trình duyệt đã lưu sẵn phiên đăng nhập -> vào thẳng phần quản lý
  (function checkExistingLogin() {
    const authUser = localStorage.getItem("authUser");
    const authConfigRaw = localStorage.getItem("authConfig");
    if (authUser && authConfigRaw) {
      try {
        enterManager(authUser, JSON.parse(authConfigRaw));
      } catch (e) {
        localStorage.removeItem("authUser");
        localStorage.removeItem("authConfig");
      }
    }
  })();