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
import AdminDashboard from './pages/AdminDashboard';
import AdminUserManagement from './pages/AdminUserManagement';
import RequestDashboard from './pages/RequestDashboard';
import Health from './pages/Health';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
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
          <Route path="/home" element={<Home />} />
          <Route path="/invite/accept" element={<InviteAccept />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin-user-management" element={<AdminUserManagement />} />
          <Route path="/requests-dashboard" element={<RequestDashboard />} />
          <Route path="/health" element={<Health />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
