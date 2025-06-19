import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import StyleGuide from './pages/StyleGuide';
import ForgotPassword from './pages/ForgotPassword';
import VerifyForgotPassword from './pages/VerifyForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import InviteAccept from './pages/InviteAccept';
import Health from './pages/Health';
import EndpointManagerPage from './pages/EndpointManagerPage';
import ApiAccessPortal from './pages/ApiAccessPortal';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Router>
        <Routes>
          {/* Authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/style-guide" element={<StyleGuide />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-forgot-password" element={<VerifyForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite-accept" element={<InviteAccept />} />
          
          {/* User profile route - placed before other routes to ensure it takes precedence */}
          
          {/* Main navigation routes with Home component (contains sidebar) */}
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<Home />} />
          <Route path="/my-requests" element={<Home />} />
          <Route path="/settings" element={<Home />} />
          <Route path="/" element={<Home />} />
          
          {/* Admin routes with sidebar from Home component */}
          <Route path="/admin-fields" element={<Home />} />
          <Route path="/admin-fields-lookup" element={<Home />} />
          <Route path="/admin-forms-groups" element={<Home />} />
          <Route path="/admin-form-group-fields/:formGroupId" element={<Home />} />
          <Route path="/profile" element={<Home />} />
          <Route path="/change-password" element={<Home />} />

          {/* User profile route moved to top of routes */}
          
          {/* Admin routes with sidebar from Home component */}
          <Route path="/admin" element={<Home />} />
          <Route path="/admin-user-management" element={<Home />} />
          <Route path="/request-dashboard" element={<Home />} />
          {/* Style Guide Route - Ensure wrapped in Home for layout */}
          <Route path="/style-guide" element={<Home />} />
          <Route path="/api-manager" element={<EndpointManagerPage />} />
          <Route path="/api-explorer" element={<ApiAccessPortal />} />

          {/* Health check doesn't need layout */}
          <Route path="/health" element={<Health />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
