import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import StyleGuide from './pages/StyleGuide';
import ForgotPassword from './pages/ForgotPassword';
import VerifyForgotPassword from './pages/VerifyForgotPassword';
import ResetPassword from './pages/ResetPassword';

function App() {
  return (
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
      </Routes>
    </Router>
  );
}

export default App;
