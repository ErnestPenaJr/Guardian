import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { showToast } from '../utils/toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette } from '@fortawesome/free-solid-svg-icons';

function Login() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      showToast.error('Please fill in all fields');
      return;
    }
    // Handle login logic here
    showToast.success('Login successful');
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: 'url("/images/background.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
          <span className="text-h4 font-display font-bold text-primary">Guardian</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              placeholder="Username"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
            />
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-secondary text-body-sm hover:text-secondary/80 transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg hover:bg-secondary/90 transition-colors"
          >
            Sign In
          </button>

          <div className="flex items-center justify-center gap-2">
            <span className="text-gray-3 text-body-sm">Don't have an account?</span>
            <Link
              to="/register"
              className="text-secondary text-body-sm font-semibold hover:text-secondary/80 transition-colors"
            >
              Create New Account
            </Link>
          </div>
          
          <div className="mt-4 text-center">
            <Link to="/style-guide" className="text-secondary text-body-sm hover:text-secondary/80 transition-colors">
              <FontAwesomeIcon icon={faPalette} title="View Style Guide" />
            </Link>
          </div>
        </form>
      </div>

      <div className="mt-8 text-center">
        <p className="text-white text-body-sm font-semibold drop-shadow-md">
          Powered by <br></br>
          <img src="/images/shieldlytics.png" alt="Shieldlytics" width={300} />
        </p>
      </div>
    </div>
  );
}

export default Login;
