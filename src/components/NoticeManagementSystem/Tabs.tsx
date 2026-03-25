//

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { List, BarChart3, FileText, Bell } from "lucide-react";
import AllNotices from "../../pages/AllNotices";
import ViewNotice from "../../pages/ViewNotice";
import DeliveryStatusDashboard from "../../pages/DeliveryDashboard";
import CreateNotice from "../../pages/CreateNotice";

type TabType = "all" | "create-notice" | "dashboard" | "view-notice";

function pathnameToTab(pathname: string): TabType {
  if (pathname.endsWith("/create")) return "create-notice";
  if (pathname.includes("/edit/")) return "create-notice";
  if (pathname.endsWith("/notification-status-dashboard")) return "dashboard";
  if (pathname.includes("/view-notice")) return "view-notice";
  return "all";
}

export default function NoticeTabsWrapper() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(
    () => pathnameToTab(location.pathname),
    [location.pathname],
  );

  const tabs: { key: TabType; label: string; icon: typeof List }[] = [
    { key: "all", label: "All Notices", icon: List },
    { key: "create-notice", label: "Create Notice", icon: FileText },
    {
      key: "dashboard",
      label: "Notification Status Dashboard",
      icon: BarChart3,
    },
    { key: "view-notice", label: "View Notice", icon: Bell },
  ];

  const handleTabClick = (key: TabType) => {
    if (key === "all") navigate("/my-notices");
    else if (key === "create-notice") navigate("/my-notices/create");
    else if (key === "dashboard")
      navigate("/my-notices/notification-status-dashboard");
    else if (key === "view-notice") navigate("/my-notices/view-notice");
  };

  const openCreateNotice = () => navigate("/my-notices/create");

  const openViewNotice = (noticeId?: number) =>
    navigate(
      noticeId != null
        ? `/my-notices/view-notice/${noticeId}`
        : "/my-notices/view-notice",
    );

  const editNotice = (noticeId?: number) => {
    if (noticeId != null) navigate(`/my-notices/edit/${noticeId}`);
    else navigate("/my-notices/create");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs UI */}
      <div className="bg-white border-b">
        <div className="px-4 md:px-6">
          <div className="flex gap-6 md:gap-8 overflow-x-auto md:overflow-visible whitespace-nowrap md:justify-center">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleTabClick(key)}
                className={`flex-shrink-0 flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-black hover:border-gray-300"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content (NO extra width wrapper) */}
      <div>
        {activeTab === "all" && (
          <AllNotices
            openCreateNotice={openCreateNotice}
            openViewNotice={openViewNotice}
            editNotice={editNotice}
          />
        )}
        {activeTab === "create-notice" && <CreateNotice />}
        {activeTab === "dashboard" && <DeliveryStatusDashboard />}
        {activeTab === "view-notice" && <ViewNotice />}
      </div>
    </div>
  );
}
