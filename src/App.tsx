import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import StyleGuide from './pages/StyleGuide';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/style-guide" element={<StyleGuide />} />
      </Routes>
    </Router>
  );
}

export default App;
