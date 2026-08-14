window.toggleVisible = function(inputId, btnId) {
    var inp = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    if (inp.type === "password") { inp.type = "text"; btn.textContent = "🙈"; }
    else { inp.type = "password"; btn.textContent = "👁️"; }
  };

  const STATIC_BANK_LIST = ["ABBANK","ACB BANK","AGRIBANK","ANZ BANK","BAC A BANK","BAO VIET BANK","BIDV BANK","BIDC","BVBANK","CAKE","CB BANK","CIMB","CIMB BANK","CITI","CO OPBANK","Co-opBank","DBS","EXIMBANK","FIRST BANK","GP BANK","HD BANK","HNB","HONGLEONG BANK","HSBC","IBK","IBK HCM","INDOVINA BANK","IVB","KASIKORNBANK","KB KOOKMIN BANK","KBANK","KEB Hana Bank","KIENLONGBANK","KOOKMI","LIENVIET BANK","LIOBANK","LP BANK","MAFC","MBBANK","MBV","MBV BANK","Mirae Asset Finance Company","MOMO","MSB","MSB BANK","NAMA BANK","NCB","NCB BANK","NHB","NONGHYUP BANK","OCB BANK","PGBANK","PUBLICBANK","PVCOMBANK","SACOMBANK","SAIGONBANK","SCB","SCB BANK","SCBVL","SEABANK","SHB BANK","SHINHAN BANK","SHINHAN BANK VN","Social Policy Bank of Vietnam","Standard Chartered","State Bank of Vietnam","TECHCOMBANK","TIMO BANK","TIMO BY BAN VIET BANK","TPBANK","UBANK","UOB","UOB (United Overseas Bank)","VDB","VIB BANK","VIET CAPITAL BANK (BVBANK)","VIETA BANK","VIETBANK","VIETCOMBANK","VIETINBANK","VIETNAM BANK FOR SOCIAL POLICIES","Vietnam Development Bank","Vietcombank Neo Limited (VCBNeo)","VIKKI BANK","VIKKI BY HDBANK","Vikki Digital Bank","VPBANK","VR BANK","VRB(VIET NGA)","WOORI BANK","ALL BANK SUPPORT","Saigon-Hanoi Commercial Joint Stock Bank"];
  var LOGO_MAP = {};

  fetch("https://api.vietqr.io/v2/banks").then(r=>r.json()).then(data=>{
    if(data&&data.data){ data.data.forEach(b=>{ if(b.logo){ LOGO_MAP[b.shortName.toUpperCase()]=b.logo; LOGO_MAP[b.code.toUpperCase()]=b.logo; } }); }
    ["tagSelect","bulkTag"].forEach(id=>{ var dd=document.getElementById("dropdown-"+id); if(dd&&dd.classList.contains("open")) renderBankList(id,""); var val=document.getElementById(id)&&document.getElementById(id).value; if(val) _updateDisplayLogo(id,val); });
  }).catch(()=>{});

  function _getLogo(n) {
    if (!n) return "";
    if (LOGO_MAP[n.toUpperCase()]) return LOGO_MAP[n.toUpperCase()];
    var nb = n.toUpperCase().replace(/\s+BANK$/, "").trim();
    if (LOGO_MAP[nb]) return LOGO_MAP[nb];
    var f = n.toUpperCase().split(" ")[0];
    if (LOGO_MAP[f]) return LOGO_MAP[f];
    return "";
  }

  function _updateDisplayLogo(id, val) {
    var d = document.getElementById("display-" + id);
    if (!d) return;
    var l = _getLogo(val);
    var imgHtml = l ? '<img src="' + l + '" onerror="this.style.display=\'none\'" style="width:20px;height:20px;object-fit:contain;border-radius:4px;flex-shrink:0;">' : '🏦';
    d.innerHTML = imgHtml + '<span class="display-text" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + val + '</span><span class="arrow">▼</span>';
    d.classList.remove("placeholder");
  }

  function renderBankList(id, filter) {
    filter = filter || "";
    var list = document.getElementById("list-" + id);
    if (!list) return;
    var lower = filter.toLowerCase();
    var filtered = STATIC_BANK_LIST.filter(function(b) { return b.toLowerCase().includes(lower); });
    if (filtered.length === 0) { list.innerHTML = '<div class="bank-option no-result">Không tìm thấy ngân hàng</div>'; return; }
    list.innerHTML = filtered.map(function(b) {
      var l = _getLogo(b);
      var icon = l ? '<img src="' + l + '" onerror="this.style.display=\'none\'" style="width:22px;height:22px;object-fit:contain;border-radius:4px;flex-shrink:0;">' : '<span style="font-size:18px;flex-shrink:0;">🏦</span>';
      var safeName = b.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return '<div class="bank-option" onclick="selectBank(\'' + id + '\',\'' + safeName + '\')">' + icon + '<span>' + b + '</span></div>';
    }).join("");
  }

  function toggleBankDropdown(id) {
    var dd = document.getElementById("dropdown-" + id);
    var isOpen = dd.classList.contains("open");
    document.querySelectorAll(".bank-dropdown.open").forEach(function(el) { el.classList.remove("open"); });
    if (!isOpen) {
      dd.classList.add("open");
      renderBankList(id, "");
      var inp = dd.querySelector("input");
      if (inp) { inp.value = ""; inp.focus(); }
    }
  }

  function filterBankOptions(id, val) { renderBankList(id, val); }
  window.getBankLogo = function(n) { return _getLogo(n); };

  function selectBank(id, val) {
    document.getElementById(id).value = val;
    _updateDisplayLogo(id, val);
    document.getElementById("dropdown-" + id).classList.remove("open");
  }

  document.addEventListener("click", function(e) {
    if (!e.target.closest(".bank-select-wrapper")) {
      document.querySelectorAll(".bank-dropdown.open").forEach(function(el) { el.classList.remove("open"); });
    }
  });

  document.addEventListener("DOMContentLoaded", function() {
    ["tagSelect", "bulkTag"].forEach(function(id) { renderBankList(id, ""); });
  });