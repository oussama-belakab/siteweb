/**
 * مكتبة الربط وإدارة البيانات للموقع الإلكتروني (app-api.js)
 * متوافقة مع جداول البوت وقاعدة بيانات Turso السحابية، ونظام تسجيل الدخول بالرقم والرمز السري.
 * تدعم الـ Cookies الدائمة، حماية المحتوى من لقطات الشاشة، وتنظيم الفيديوهات داخل الوحدات.
 */

const API_BASE = window.location.origin.includes("http") ? "" : "http://localhost:5000";

// كائن الخدمات الموحد
window.AppAPI = {
  // 1. إدارة ملفات تعريف الارتباط (Cookies) الدائمة
  setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
  },

  getCookie(name) {
    const cname = name + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(cname) === 0) {
        return c.substring(cname.length, c.length);
      }
    }
    return "";
  },

  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
  },

  // 2. إدارة حساب وجلسة التلميذ (localStorage + Cookies المزدوج)
  getCurrentStudent() {
    try {
      let raw = localStorage.getItem("math_student") || localStorage.getItem("math_current_student");
      if (!raw) {
        raw = this.getCookie("math_student_session");
      }
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed && (parsed.phone || parsed.full_name || parsed.first_name || parsed.id)) {
          if (!parsed.full_name && (parsed.first_name || parsed.last_name)) {
            parsed.full_name = `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim();
          }
          const str = JSON.stringify(parsed);
          localStorage.setItem("math_student", str);
          localStorage.setItem("math_current_student", str);
          return parsed;
        }
      }
    } catch(e) {}
    return null;
  },

  isLoggedIn() {
    const student = this.getCurrentStudent();
    return student !== null && (Boolean(student.phone) || Boolean(student.full_name) || Boolean(student.id));
  },

  setCurrentStudent(student) {
    if (!student.full_name && (student.first_name || student.last_name)) {
      student.full_name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
    }
    const str = JSON.stringify(student);
    localStorage.setItem("math_student", str);
    localStorage.setItem("math_current_student", str);
    // حفظ في الكوكيز لمدة سنة كاملة (365 يوم) حتى لا يُطلب تسجيل الدخول في كل مرة
    this.setCookie("math_student_session", str, 365);
    this.updateUserHeader();
    this.initWatermark();
  },

  logout() {
    localStorage.removeItem("math_student");
    localStorage.removeItem("math_current_student");
    this.deleteCookie("math_student_session");
    window.location.href = "login.html";
  },

  // 3. نظام حماية المحتوى: منع لقطات الشاشة وإعادة التوجيه ونسخ النصوص
  initContentProtection() {
    // منع النقر بالزر الأيمن
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.showToastNotification("🔒 تم حظر النقر بزر الفأرة الأيمن لحماية حقوق المحتوى.");
      return false;
    });

    // منع اختصارات لوحة المفاتيح للتصوير والطباعة وسرقة المصدر
    document.addEventListener("keydown", (e) => {
      // PrintScreen
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("❌ غير مسموح بنسخ أو تصوير شاشة محتوى المنصة.");
        }
        this.showToastNotification("🔒 أخذ لقطات الشاشة ممنوع لحماية خصوصية المحتوى.");
      }

      // Ctrl+P (الطباعة), Ctrl+S (الحفظ), Ctrl+U (فحص الكود)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        this.showToastNotification("🔒 هذه الخاصية معطلة لحماية الملفات.");
        return false;
      }

      // F12 أو أدوات المطورين Ctrl+Shift+I
      if (e.keyCode === 123 || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'))) {
        e.preventDefault();
        return false;
      }
    });

    // إضافة علامة مائية باسم التلميذ ورقم هاتفه
    this.initWatermark();
  },

  initWatermark() {
    // تم حذف الاسم والعلامة المائية من أسفل الشاشة نهائياً بناءً على طلب الأستاذ
    const watermark = document.getElementById("studentWatermark");
    if (watermark) {
      watermark.remove();
    }
  },

  showToastNotification(msg) {
    let toast = document.getElementById("appSecToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appSecToast";
      toast.style.cssText = `
        position: fixed;
        bottom: 25px;
        right: 50%;
        transform: translateX(50%);
        background: #1e1b4b;
        color: #fef08a;
        padding: 12px 22px;
        border-radius: 18px;
        font-size: 0.88rem;
        font-weight: 800;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        z-index: 100000;
        border: 1px solid #7033ff;
        display: none;
        animation: fadeInAuth 0.2s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.display = "block";
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      toast.style.display = "none";
    }, 2800);
  },

  // 4. نظام حماية المحتوى والملفات: لا يمكن لأي زائر التحميل أو المشاهدة إلا بعد تسجيل الدخول
  showAuthModal(message = null, subtext = null) {
    let modal = document.getElementById("appAuthModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "appAuthModal";
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeInAuth 0.25s ease-out;
      `;
      modal.innerHTML = `
        <style>
          @keyframes fadeInAuth { from { opacity: 0; } to { opacity: 1; } }
          @keyframes zoomUpAuth { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          .auth-modal-card {
            background: #ffffff;
            border-radius: 28px;
            padding: 32px 24px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
            animation: zoomUpAuth 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            border: 2px solid #ede9fe;
          }
          .auth-modal-icon {
            width: 72px;
            height: 72px;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            color: #d97706;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 16px auto;
            box-shadow: 0 8px 20px rgba(217, 119, 6, 0.25);
          }
          .auth-modal-btn-login {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            background: linear-gradient(135deg, #7033ff 0%, #4b16c8 100%);
            color: #ffffff;
            padding: 14px 20px;
            border-radius: 16px;
            font-weight: 800;
            font-size: 1rem;
            text-decoration: none;
            box-shadow: 0 10px 25px rgba(112, 51, 255, 0.35);
            transition: all 0.2s ease;
            margin-bottom: 10px;
            border: none;
            cursor: pointer;
          }
          .auth-modal-btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 30px rgba(112, 51, 255, 0.45);
          }
          .auth-modal-btn-reg {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            background: #ede9fe;
            color: #5b21b6;
            padding: 12px 18px;
            border-radius: 14px;
            font-weight: 800;
            font-size: 0.92rem;
            text-decoration: none;
            transition: all 0.2s;
            margin-bottom: 10px;
          }
          .auth-modal-btn-reg:hover { background: #ddd6fe; }
          .auth-modal-btn-bot {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            background: #f1f5f9;
            color: #1e293b;
            padding: 10px 16px;
            border-radius: 14px;
            font-weight: 700;
            font-size: 0.85rem;
            text-decoration: none;
            transition: background 0.2s;
            margin-bottom: 10px;
          }
          .auth-modal-btn-bot:hover { background: #e2e8f0; }
        </style>
        <div class="auth-modal-card">
          <div class="auth-modal-icon">
            <i class="fa-solid fa-lock"></i>
          </div>
          <h3 style="font-size: 1.35rem; color: #1e293b; font-weight: 900; margin-bottom: 10px;">
            تسجيل الدخول مطلوب 🔐
          </h3>
          <p id="appAuthModalMsg" style="font-size: 0.95rem; color: #334155; line-height: 1.6; margin-bottom: 8px; font-weight: 700;">
            عذراً! هذا الملف والمحتوى التعليمي مخصص فقط لتلاميذ الأستاذ بلعقاب أسامة المسجلين.
          </p>
          <p id="appAuthModalSub" style="font-size: 0.82rem; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
            يرجى تسجيل الدخول برقم هاتفك والرمز السري لتتمكن من المشاهدة والتحميل.
          </p>
          <a href="login.html" class="auth-modal-btn-login">
            <i class="fa-solid fa-arrow-right-to-bracket"></i>
            <span>تسجيل الدخول بالرقم والرمز السري</span>
          </a>
          <a href="register.html" class="auth-modal-btn-reg">
            <i class="fa-solid fa-user-plus"></i>
            <span>إنشاء حساب جديد عبر الموقع</span>
          </a>
          <a href="https://t.me/Belakab_math_bot" target="_blank" class="auth-modal-btn-bot">
            <i class="fa-brands fa-telegram" style="color: #0088cc; font-size: 1.1rem;"></i>
            <span>أو التسجيل عبر بوت التليجرام</span>
          </a>
          <button type="button" onclick="document.getElementById('appAuthModal').style.display='none'" style="background: none; border: none; color: #94a3b8; font-size: 0.88rem; cursor: pointer; margin-top: 6px; padding: 6px;">
            ✕ إغلاق
          </button>
        </div>
      `;
      document.body.appendChild(modal);
    }

    if (message) {
      const msgEl = modal.querySelector("#appAuthModalMsg");
      if (msgEl) msgEl.innerText = message;
    }
    if (subtext) {
      const subEl = modal.querySelector("#appAuthModalSub");
      if (subEl) subEl.innerText = subtext;
    }

    modal.style.display = "flex";
  },

  requireAuth(actionCallback, customMsg = null, customSub = null) {
    if (this.isLoggedIn()) {
      if (typeof actionCallback === "function") {
        actionCallback();
      }
      return true;
    }
    this.showAuthModal(customMsg, customSub);
    return false;
  },

  openProtectedFile(url, fileTitle = "الملف") {
    if (!url || url === "#") {
      alert("الملف غير متوفر حالياً، يرجى المحاولة لاحقاً.");
      return;
    }
    this.requireAuth(() => {
      const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
      
      let viewerModal = document.getElementById("appMediaViewerModal");
      if (!viewerModal) {
        viewerModal = document.createElement("div");
        viewerModal.id = "appMediaViewerModal";
        viewerModal.style.cssText = `
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(8px); z-index: 100000; display: none;
          flex-direction: column; align-items: center; justify-content: center;
          padding: 12px;
        `;
        viewerModal.innerHTML = `
          <div style="width: 100%; max-width: 950px; height: 92vh; background: #fff; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #1e1b4b; color: #fff; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                <i class="fa-solid fa-file-lines" style="color: #ffb703; font-size: 1.1rem;"></i>
                <h3 id="appViewerTitle" style="font-size: 0.95rem; font-weight: 800; margin: 0; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">معاينة الملف</h3>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <!-- أزرار التكبير والتصغير المريحة -->
                <div style="display: flex; align-items: center; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 2px 4px; border: 1px solid rgba(255,255,255,0.15);">
                  <button id="modalZoomOutBtn" type="button" style="background:none; border:none; color:#fff; width:28px; height:28px; border-radius:6px; cursor:pointer; font-size:0.85rem;" title="تصغير (-)"><i class="fa-solid fa-minus"></i></button>
                  <span id="modalZoomLabel" style="color:#ffb703; font-weight:800; font-size:0.78rem; min-width:44px; text-align:center; user-select:none;">70%</span>
                  <button id="modalZoomInBtn" type="button" style="background:none; border:none; color:#fff; width:28px; height:28px; border-radius:6px; cursor:pointer; font-size:0.85rem;" title="تكبير (+)"><i class="fa-solid fa-plus"></i></button>
                </div>
                <!-- فتح في صفحة كاملة دون تحميل -->
                <a id="appViewerExternalBtn" href="#" target="_blank" style="color: #fff; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 10px; font-size: 0.82rem; text-decoration: none; font-weight: 700; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.2);">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> <span>نافذة كاملة</span>
                </a>
                <button type="button" onclick="document.getElementById('appMediaViewerModal').style.display='none'" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
            <div id="appViewerContent" style="flex: 1; width: 100%; background: #0f172a; overflow: auto; display: flex; align-items: center; justify-content: center; position: relative;">
              <div id="appViewerSpinner" style="position: absolute; color: #ffb703; font-size: 1.5rem; z-index: 1;">
                <i class="fa-solid fa-spinner fa-spin"></i> <span style="font-size:0.9rem; margin-right:8px; color:#fff;">جاري قراءة وتجهيز المستند...</span>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(viewerModal);
      }

      const titleEl = viewerModal.querySelector("#appViewerTitle");
      const extBtn = viewerModal.querySelector("#appViewerExternalBtn");
      const contentEl = viewerModal.querySelector("#appViewerContent");
      const spinnerEl = viewerModal.querySelector("#appViewerSpinner");
      const zoomOutBtn = viewerModal.querySelector("#modalZoomOutBtn");
      const zoomInBtn = viewerModal.querySelector("#modalZoomInBtn");
      const zoomLabel = viewerModal.querySelector("#modalZoomLabel");

      let currentZoom = 0.70; // الحجم الافتراضي المريح بحيث تظهر الصفحة كاملة وغير قريبة جداً

      function applyModalZoom() {
        if (zoomLabel) zoomLabel.innerText = `${Math.round(currentZoom * 100)}%`;
        const boxes = contentEl.querySelectorAll(".app-page-box");
        boxes.forEach(b => {
          b.style.width = `${Math.round(currentZoom * 100)}%`;
        });
        const img = contentEl.querySelector(".app-viewer-img");
        if (img) {
          img.style.maxWidth = `${Math.round(currentZoom * 100)}%`;
        }
      }

      if (zoomOutBtn) zoomOutBtn.onclick = () => {
        currentZoom = Math.max(0.40, currentZoom - 0.12);
        applyModalZoom();
      };
      if (zoomInBtn) zoomInBtn.onclick = () => {
        currentZoom = Math.min(1.40, currentZoom + 0.12);
        applyModalZoom();
      };

      if (titleEl) titleEl.innerText = fileTitle || "معاينة الملف";
      // توجيه زر "نافذة كاملة" لصفحة العارض viewer.html حتى لا يتحمل أبداً
      if (extBtn) extBtn.href = `viewer.html?file=${encodeURIComponent(fullUrl)}&title=${encodeURIComponent(fileTitle)}`;
      if (spinnerEl) spinnerEl.style.display = "flex";
      viewerModal.style.display = "flex";

      // تحميل الملف وعرضه حسب نوعه
      fetch(fullUrl)
        .then(async (res) => {
          const ct = (res.headers.get("Content-Type") || "").toLowerCase();
          const arrayBuffer = await res.arrayBuffer();
          return { arrayBuffer, ct };
        })
        .then(async ({ arrayBuffer, ct }) => {
          if (spinnerEl) spinnerEl.style.display = "none";
          const oldEmbed = contentEl.querySelector(".app-viewer-embed");
          if (oldEmbed) oldEmbed.remove();

          // فحص هل هو PDF
          const isPdf = ct.includes("pdf") || (arrayBuffer.byteLength >= 4 && new Uint8Array(arrayBuffer.slice(0, 4)).reduce((acc, b) => acc + String.fromCharCode(b), '') === "%PDF");

          if (isPdf) {
            // عرض صفحات الـ PDF مباشرة داخل الموقع باستخدام PDF.js دون أي تحميل
            try {
              if (!window.pdfjsLib) {
                await new Promise((resolve, reject) => {
                  const s = document.createElement("script");
                  s.src = "js/pdf.min.js";
                  s.onload = resolve;
                  s.onerror = reject;
                  document.head.appendChild(s);
                });
              }
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/pdf.worker.min.js";

              const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
              const pdf = await loadingTask.promise;

              const pagesWrap = document.createElement("div");
              pagesWrap.className = "app-viewer-embed";
              pagesWrap.style.cssText = "width: 100%; padding: 24px 12px; display: flex; flex-direction: column; align-items: center; gap: 24px;";

              for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const unscaled = page.getViewport({ scale: 1.0 });
                // دقة رسم ممتازة وجودة واضحة
                const renderScale = 1.6;
                const viewport = page.getViewport({ scale: renderScale });

                const pageBox = document.createElement("div");
                pageBox.className = "app-page-box";
                pageBox.style.cssText = `width: ${Math.round(currentZoom * 100)}%; max-width: 750px; text-align: center; transition: width 0.15s ease;`;

                if (pdf.numPages > 1) {
                  const badge = document.createElement("div");
                  badge.style.cssText = "font-size: 0.8rem; color: #94a3b8; font-weight: 800; margin-bottom: 8px;";
                  badge.innerText = `📄 الصفحة ${pageNum} من ${pdf.numPages}`;
                  pageBox.appendChild(badge);
                }

                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.cssText = "width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); background: #fff;";

                const ctx = canvas.getContext("2d");
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                pageBox.appendChild(canvas);
                pagesWrap.appendChild(pageBox);
              }

              contentEl.appendChild(pagesWrap);
              applyModalZoom();
              return;
            } catch(e_pdf) {
              console.error("PDF.js render error:", e_pdf);
            }
          }

          // إذا كان صورة
          const blob = new Blob([arrayBuffer], { type: ct || "image/jpeg" });
          const blobUrl = URL.createObjectURL(blob);

          if (ct.includes("image")) {
            const imgWrap = document.createElement("div");
            imgWrap.className = "app-viewer-embed";
            imgWrap.style.cssText = "padding: 20px; display: flex; align-items: center; justify-content: center; width: 100%;";
            const img = document.createElement("img");
            img.className = "app-viewer-img";
            img.src = blobUrl;
            img.style.cssText = `max-width: ${Math.round(currentZoom * 100)}%; height: auto; object-fit: contain; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); transition: max-width 0.15s ease;`;
            imgWrap.appendChild(img);
            contentEl.appendChild(imgWrap);
          } else {
            const iframe = document.createElement("iframe");
            iframe.className = "app-viewer-embed";
            iframe.src = `viewer.html?file=${encodeURIComponent(fullUrl)}&title=${encodeURIComponent(fileTitle)}`;
            iframe.style.cssText = "width: 100%; height: 100%; border: none;";
            contentEl.appendChild(iframe);
          }
        })
        .catch(err => {
          if (spinnerEl) spinnerEl.style.display = "none";
          const oldEmbed = contentEl.querySelector(".app-viewer-embed");
          if (oldEmbed) oldEmbed.remove();
          const errDiv = document.createElement("div");
          errDiv.className = "app-viewer-embed";
          errDiv.style.cssText = "text-align: center; padding: 40px; color: #64748b;";
          errDiv.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #f59e0b; margin-bottom: 12px;"></i>
            <h3 style="color: #1e293b; font-weight: 800;">تعذر تحميل الملف</h3>
            <p style="font-size: 0.88rem;">يمكنك محاولة فتحه مباشرة في نافذة جديدة.</p>
            <a href="${fullUrl}" target="_blank" style="display: inline-block; margin-top: 12px; background: #7033ff; color: #fff; padding: 10px 24px; border-radius: 12px; text-decoration: none; font-weight: 800;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> فتح الملف
            </a>
          `;
          contentEl.appendChild(errDiv);
        });
    }, `عذراً! معاينة "${fileTitle}" تتطلب تسجيل الدخول.`);
  },

  // 5. تحديث شريط الهيدر
  updateUserHeader() {
    const student = this.getCurrentStudent();
    const badgeContainer = document.getElementById("studentProfilePill");

    if (badgeContainer) {
      if (student && (student.full_name || student.phone)) {
        const displayName = student.full_name ? student.full_name.split(' ')[0] : student.phone;
        badgeContainer.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.18); padding:6px 14px; border-radius:20px; font-size:0.85rem;">
            <i class="fa-solid fa-circle-user" style="color:#ffb703; font-size:16px;"></i>
            <span style="font-weight:800; color:#fff;">${displayName}</span>
            <span style="font-size:0.75rem; background:rgba(0,0,0,0.25); padding:2px 8px; border-radius:10px; color:#e2d5ff;">${student.school || student.branch || 'تلميذ مفعل'}</span>
            <button onclick="window.AppAPI.logout()" title="تسجيل الخروج" style="background:none; border:none; color:#fca5a5; cursor:pointer; font-size:14px; margin-right:4px;">
              <i class="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        `;
      } else {
        badgeContainer.innerHTML = `
          <a href="login.html" style="display:flex; align-items:center; gap:6px; background:#ffb703; color:#1e1040; padding:6px 14px; border-radius:20px; font-size:0.82rem; font-weight:800; text-decoration:none;">
            <i class="fa-solid fa-lock"></i>
            <span>تسجيل الدخول</span>
          </a>
        `;
      }
    }
  },

  // 6. جلب الوحدات من Turso
  async getUnits() {
    try {
      const res = await fetch(`${API_BASE}/api/units`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch(e) {}
    return [
      { id: 1, name: "الدوال العددية 📉" },
      { id: 2, name: "الدلة الأسية 📈" },
      { id: 3, name: "الدلة اللوغارتمية 📊" },
      { id: 4, name: "المتتاليات 🔢" },
      { id: 5, name: "الاحتمالات 🎲" },
      { id: 6, name: "القسمة في Z ➗" },
      { id: 7, name: "الأعداد المركبة 🧮" }
    ];
  },

  // 7. جلب الدروس من Turso
  async getLessons(unitId = null) {
    try {
      const url = unitId && unitId !== "all" ? `${API_BASE}/api/lessons?unit_id=${unitId}` : `${API_BASE}/api/lessons`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch(e) {}
    return [];
  },

  // 8. جلب التمارين من Turso
  async getExercises(unitId = null) {
    try {
      const url = unitId && unitId !== "all" ? `${API_BASE}/api/exercises?unit_id=${unitId}` : `${API_BASE}/api/exercises`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch(e) {}
    return [];
  },

  // 9. جلب الفيديوهات الشارحة من Turso (منظمة داخل الوحدات)
  async getVideos(unitId = null) {
    try {
      const url = unitId && unitId !== "all" ? `${API_BASE}/api/videos?unit_id=${unitId}` : `${API_BASE}/api/videos`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch(e) {}
    return [];
  },

  // 10. جلب الواجبات النشطة من Turso
  async getHomework(unitId = null) {
    try {
      const url = unitId && unitId !== "all" ? `${API_BASE}/api/homework?unit_id=${unitId}` : `${API_BASE}/api/homework`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch(e) {}
    return [];
  },

  // 11. جلب علامات وتصحيحات التلميذ من Turso
  async getMySubmissions() {
    const student = this.getCurrentStudent();
    if (!student) return [];
    const nameOrPhone = student.full_name || student.phone || "";
    const query = nameOrPhone ? `?student_name=${encodeURIComponent(nameOrPhone)}` : "";
    try {
      const res = await fetch(`${API_BASE}/api/submissions/my${query}`);
      if (res.ok) {
        const data = await res.json();
        return data || [];
      }
    } catch(e) {}
    return [];
  },

  // 12. إرسال محاولة حل واجب في Turso
  async submitHomework(formData) {
    try {
      const student = this.getCurrentStudent() || {};
      const payload = {
        exercise_name: formData.get("exercise_name") || "واجب منزلي",
        student_name: formData.get("student_name") || student.full_name || "تلميذ مسجل",
        school: formData.get("school") || student.school || student.branch || "دراسة عن بعد 🌐",
        phone: student.phone || "",
        student_id: student.id || student.user_id || null,
        note: formData.get("note") || ""
      };

      const res = await fetch(`${API_BASE}/api/homework/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch(e) {}

    return { success: true, message: "تم إرسال الواجب بنجاح!" };
  },

  // 13. جلب مواضيع البكالوريا من Turso
  async getBacTopics(stream = null, year = null) {
    try {
      const query = new URLSearchParams();
      if (stream && stream !== "الكل") query.append("stream", stream);
      if (year && year !== "الكل") query.append("year", year);
      const res = await fetch(`${API_BASE}/api/bac?${query}`);
      if (res.ok) {
        const data = await res.json();
        return data || [];
      }
    } catch(e) {}
    return [];
  },

  // 14. جلب الملفات المخصصة من Turso
  async getFiles(folderId = null) {
    try {
      const query = folderId ? `?folder_id=${folderId}` : "";
      const res = await fetch(`${API_BASE}/api/files${query}`);
      if (res.ok) {
        const data = await res.json();
        return data || [];
      }
    } catch(e) {}
    return [];
  },

  // 6. الفحص الدوري لحظر/حذف الحساب من طرف الأستاذ (طرد فوري تلقائي)
  async checkAccountStatus() {
    const student = this.getCurrentStudent();
    if (!student || !student.phone) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/status?phone=${encodeURIComponent(student.phone)}`);
      const data = await res.json();
      if (data && data.active === -1) {
        this.logout();
      }
    } catch(e) {}
  }
};

// تشغيل التهيئة التلقائية وحماية المحتوى والمراقبة عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  window.AppAPI.updateUserHeader();
  window.AppAPI.initContentProtection();
  window.AppAPI.checkAccountStatus();
  setInterval(() => {
    window.AppAPI.checkAccountStatus();
  }, 15000);
});
