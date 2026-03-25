import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorTestingComponent from './components/ErrorTestingComponent';
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

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover />
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
          </Routes>
        </Router>
        <ErrorTestingComponent />
      </div>
    </ErrorBoundary>
  );
}

export default App;
