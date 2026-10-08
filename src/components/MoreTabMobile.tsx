import React from "react";
import {
  Settings2, FileText, Share2, Bell, Send, Facebook, Mail,
  ChevronLeft, ArrowUpLeft, Code2, Info, ShieldAlert, Lock, Users,
} from "lucide-react";
import AppInstallUninstall from "./AppInstallUninstall";

interface MoreTabMobileProps {
  activeTab: string;
  triggerHaptic: (pattern?: number | number[]) => void;
  setShowSettingsModal: (show: boolean) => void;
  handleOpenPdfModal: () => void;
  handleShare: () => void;
  setSettingsTab: (tab: 'general' | 'notifications' | 'appearance') => void;
  setCurrentPage: (page: 'dashboard' | 'api' | 'contact' | 'terms' | 'privacy' | 'about') => void;
  onlineCount: number;
}

export const MoreTabMobile: React.FC<MoreTabMobileProps> = ({
  activeTab, triggerHaptic, setShowSettingsModal, handleOpenPdfModal,
  handleShare, setSettingsTab, setCurrentPage, onlineCount,
}) => {
  return (
    <section id="more-section" aria-label="المزيد" className={activeTab === 'more' ? 'more-section md:hidden' : 'hidden'}>
      <div className="more-brand">
        <img src="/logo.png" alt="" width="48" height="48" />
        <div>
          <h2>مؤشر الدينار</h2>
          <p>Dinar Index Libya</p>
        </div>
      </div>

      <section className="more-group" aria-labelledby="more-tools-heading">
        <h3 id="more-tools-heading">أدوات المنصة</h3>
        <div className="more-tools">
          <button onClick={() => { triggerHaptic(10); setSettingsTab('general'); setShowSettingsModal(true); }}>
            <Settings2 aria-hidden="true" /><span>الإعدادات</span>
          </button>
          <button onClick={handleOpenPdfModal}>
            <FileText aria-hidden="true" /><span>طباعة PDF</span>
          </button>
          <button onClick={() => { triggerHaptic(10); handleShare(); }}>
            <Share2 aria-hidden="true" /><span>مشاركة</span>
          </button>
          <button onClick={() => { triggerHaptic(10); setShowSettingsModal(true); setSettingsTab('notifications'); }}>
            <Bell aria-hidden="true" /><span>التنبيهات</span>
          </button>
        </div>
      </section>

      <section className="more-group" aria-labelledby="more-social-heading">
        <h3 id="more-social-heading">التواصل والمتابعة</h3>
        <div className="more-links">
          <a href="https://t.me/libya_index_dollar" target="_blank" rel="noopener noreferrer">
            <Send aria-hidden="true" className="more-link-icon" />
            <span><strong>قناة التيليجرام</strong><small dir="ltr">@libya_index_dollar</small></span>
            <ArrowUpLeft aria-hidden="true" className="more-link-arrow" />
          </a>
          <a href="https://www.facebook.com/profile.php?id=61593953519936" target="_blank" rel="noopener noreferrer">
            <Facebook aria-hidden="true" className="more-link-icon" />
            <span><strong>صفحة الفيسبوك</strong><small>مؤشر الدينار</small></span>
            <ArrowUpLeft aria-hidden="true" className="more-link-arrow" />
          </a>
          <button onClick={() => { triggerHaptic(10); setCurrentPage('contact'); }}>
            <Mail aria-hidden="true" className="more-link-icon" />
            <span><strong>اتصل بنا</strong><small>للتواصل مع فريق التطوير</small></span>
            <ChevronLeft aria-hidden="true" className="more-link-arrow" />
          </button>
        </div>
      </section>

      <section className="more-group" aria-labelledby="more-info-heading">
        <h3 id="more-info-heading">عن المنصة</h3>
        <div className="more-links">
          <button onClick={() => { triggerHaptic(10); setCurrentPage('api'); }}>
            <Code2 aria-hidden="true" className="more-link-icon" />
            <span><strong>بوابة المطورين (API)</strong><small>الوصول البرمجي للأسعار</small></span>
            <ChevronLeft aria-hidden="true" className="more-link-arrow" />
          </button>
          <button onClick={() => { triggerHaptic(10); setCurrentPage('about'); }}>
            <Info aria-hidden="true" className="more-link-icon" />
            <span><strong>عن المنصة</strong><small>من نحن وكيف نعمل</small></span>
            <ChevronLeft aria-hidden="true" className="more-link-arrow" />
          </button>
          <button onClick={() => { triggerHaptic(10); setCurrentPage('terms'); }}>
            <ShieldAlert aria-hidden="true" className="more-link-icon" />
            <span><strong>سياسة الاستخدام</strong><small>الشروط والأحكام</small></span>
            <ChevronLeft aria-hidden="true" className="more-link-arrow" />
          </button>
          <button onClick={() => { triggerHaptic(10); setCurrentPage('privacy'); }}>
            <Lock aria-hidden="true" className="more-link-icon" />
            <span><strong>سياسة الخصوصية</strong><small>كيفية حماية بياناتك</small></span>
            <ChevronLeft aria-hidden="true" className="more-link-arrow" />
          </button>
        </div>
      </section>

      <div className="more-install"><AppInstallUninstall /></div>
      <div className="more-footer">
        <span className="more-online"><Users aria-hidden="true" /><span>{onlineCount.toLocaleString()} متواجد الآن</span></span>
        <small dir="ltr">GreenBox © 2026</small>
      </div>
    </section>
  );
};
