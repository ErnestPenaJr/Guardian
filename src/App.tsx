import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorTestingComponent from './components/ErrorTestingComponent';
import DbWakeUpOverlay from './components/DbWakeUpOverlay';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import StyleGuide from './pages/StyleGuide';
import ForgotPassword from './pages/ForgotPassword';
import VerifyForgotPassword from './pages/VerifyForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import InviteAccept from './pages/InviteAccept';
import AdminDashboard from './pages/AdminDashboard';
import AdminUserManagement from './pages/AdminUserManagement';
import AdminFields from './pages/AdminFields.tsx';
import AdminFieldsLookupPage from './pages/AdminFieldsLookupPage';
import AdminFormsGroups from './pages/AdminFormsGroups';
import AdminFormGroupFieldsPage from './pages/AdminFormGroupFieldsPage';
import RequestDashboard from './pages/RequestDashboard';
import RequestFulfillmentDashboard from './pages/RequestFulfillmentDashboard';
import Health from './pages/Health';
import EndpointManagerPage from './pages/EndpointManagerPage';
import ApiAccessPortal from './pages/ApiAccessPortal';
import NoticesLandingPage from './pages/NoticesLandingPage';
import NoticeDetailsPage from './pages/NoticeDetailsPage';
import AccountSettings from './pages/AccountSettings';
import UpdateProfile from './pages/UpdateProfile';
import ChangePassword from './pages/ChangePassword';
import NotificationPreferences from './pages/NotificationPreferences';
import JafarAdministration from './pages/JafarAdministration';
import SiteAnalysis from './pages/SiteAnalysis';
import SecurityReport from './pages/SecurityReport';
import JafarPlatformConfig from './pages/JafarPlatformConfig';
import RequireJafar from './components/RequireJafar';
import AllNotices from './pages/AllNotices';
import CreateNotice from './pages/CreateNotice';
import ViewNotice from './pages/ViewNotice';
import DeliveryDashboard from './pages/DeliveryDashboard';
import FormBuilderPage from './pages/FormBuilderPage';
import WorkflowTemplatesAdmin from './pages/admin/WorkflowTemplatesAdmin';
import ExportPage from './pages/ExportPage';
import SecuritiesNoticeTemplateAdmin from './pages/SecuritiesNoticeTemplateAdmin';
import SecuritiesNoticeSend from './pages/SecuritiesNoticeSend';
import SecuritiesNoticeApprovalQueue from './pages/SecuritiesNoticeApprovalQueue';
import ExternalUserInbox from './pages/ExternalUserInbox';
import AuditLogPage from './pages/AuditLog';

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover />
        <DbWakeUpOverlay />
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-forgot-password" element={<VerifyForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/style-guide" element={<StyleGuide />} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/invite/accept" element={<InviteAccept />} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin-user-management" element={<ProtectedRoute><AdminUserManagement /></ProtectedRoute>} />
            <Route path="/admin-fields" element={<ProtectedRoute><AdminFields /></ProtectedRoute>} />
            <Route path="/admin-fields/lookups/:fieldId" element={<ProtectedRoute><AdminFieldsLookupPage /></ProtectedRoute>} />
            <Route path="/admin-forms-groups" element={<ProtectedRoute><AdminFormsGroups /></ProtectedRoute>} />
            <Route path="/admin-forms-groups/fields/:groupId" element={<ProtectedRoute><AdminFormGroupFieldsPage /></ProtectedRoute>} />
            <Route path="/requests-dashboard" element={<ProtectedRoute><RequestDashboard /></ProtectedRoute>} />
            <Route path="/my-requests" element={<ProtectedRoute><RequestFulfillmentDashboard /></ProtectedRoute>} />
            <Route path="/my-assignments" element={<ProtectedRoute><RequestFulfillmentDashboard /></ProtectedRoute>} />
            {/* Commented out to prevent navigation when clicking View button 
            <Route path="/request/:id" element={<Navigate to="/requests-dashboard" replace />} />
            */}
            <Route path="/notices" element={<ProtectedRoute><NoticesLandingPage /></ProtectedRoute>} />
            <Route path="/notices/:id" element={<ProtectedRoute><NoticeDetailsPage /></ProtectedRoute>} />
            <Route path="/health" element={<ProtectedRoute><Health /></ProtectedRoute>} />
            <Route path="/api-manager" element={<ProtectedRoute><EndpointManagerPage /></ProtectedRoute>} />
            <Route path="/api-access-portal" element={<ApiAccessPortal />} />
            <Route path="/api-explorer" element={<ApiAccessPortal />} />
            <Route path="/account-settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
            <Route path="/update-profile" element={<ProtectedRoute><UpdateProfile /></ProtectedRoute>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/notification-preferences" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />
            <Route path="/jafar-administration" element={<ProtectedRoute><JafarAdministration /></ProtectedRoute>} />
            <Route path="/jafar/site-analysis" element={<ProtectedRoute><RequireJafar><SiteAnalysis /></RequireJafar></ProtectedRoute>} />
            <Route path="/jafar/security-report" element={<ProtectedRoute><RequireJafar><SecurityReport /></RequireJafar></ProtectedRoute>} />
            <Route path="/jafar/platform-config" element={<ProtectedRoute><RequireJafar><JafarPlatformConfig /></RequireJafar></ProtectedRoute>} />
            <Route path="/my-notices" element={<ProtectedRoute><AllNotices /></ProtectedRoute>} />
            <Route path="/my-notices/create" element={<ProtectedRoute><CreateNotice /></ProtectedRoute>} />
            <Route path="/my-notices/edit/:id" element={<ProtectedRoute><CreateNotice /></ProtectedRoute>} />
            <Route path="/my-notices/view-notice/:id" element={<ProtectedRoute><ViewNotice /></ProtectedRoute>} />
            <Route path="/my-notices/view-notice" element={<ProtectedRoute><ViewNotice /></ProtectedRoute>} />
            <Route path="/my-notices/notification-status-dashboard" element={<ProtectedRoute><DeliveryDashboard /></ProtectedRoute>} />
            <Route path="/admin/workflow-templates" element={<ProtectedRoute><WorkflowTemplatesAdmin /></ProtectedRoute>} />
            <Route path="/form-builder/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
            <Route path="/form-builder/:formId" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
            <Route path="/export/:type" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
            {/* Securities Fraud Notice MVP — Phase 5 */}
            <Route path="/securities-notice-templates/new" element={<ProtectedRoute><SecuritiesNoticeTemplateAdmin /></ProtectedRoute>} />
            <Route path="/securities-notices/new" element={<ProtectedRoute><SecuritiesNoticeSend /></ProtectedRoute>} />
            <Route path="/securities-notices/approvals" element={<ProtectedRoute><SecuritiesNoticeApprovalQueue /></ProtectedRoute>} />
            {/* Phase 7 / US-SRB-03 — External user portal (role 5) */}
            <Route path="/external/inbox" element={<ProtectedRoute><ExternalUserInbox /></ProtectedRoute>} />
            <Route path="/external/notices/:id" element={<ProtectedRoute><ExternalUserInbox /></ProtectedRoute>} />
            {/* Phase 8 / US-CCL-04 — Audit log (admins + managers) */}
            <Route path="/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
          </Routes>
        </Router>
        <ErrorTestingComponent />
      </div>
    </ErrorBoundary>
  );
}

export default App;
