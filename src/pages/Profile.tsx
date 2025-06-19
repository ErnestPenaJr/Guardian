import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { User, Mail, Building, Save, LayoutDashboard, FileText, Sliders } from 'lucide-react';
import api from '../utils/api';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  jobTitle: string;
  department: string;
}

const Profile: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize form with empty values
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    jobTitle: '',
    department: ''
  });

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      // Log user object to understand its structure
      console.log('User object structure:', user);
      
      setFormData({
        firstName: user.firstName || user.FIRST_NAME || '',
        lastName: user.lastName || user.LAST_NAME || '',
        email: user.email || user.EMAIL || '',
        companyName: user.companyName || '',
        jobTitle: user.jobTitle || '',
        department: user.department || ''
      });
    }
  }, [user]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      // Create a copy of the form data to send to the API
      // The server only accepts firstName and lastName fields
      const dataToSubmit = {
        firstName: formData.firstName,
        lastName: formData.lastName
      };
      
      // Make API call to update user profile
      await api.put('/users/profile', dataToSubmit);
      
      // Show success message
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 pt-0 pb-8 max-w-3xl" style={{ marginTop: 0, paddingTop: 0 }}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Your Profile</h1>
            <p className="text-gray-600">Update your personal information</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <form onSubmit={handleSubmit}>
              {/* Main content layout with profile photo on left and info on right */}
              <div className="flex flex-col md:flex-row gap-8">
                {/* Profile Photo Section */}
                <div className="flex flex-col items-start">
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold mb-4">
                    {user?.profilePhotoUrl ? (
                      <img src={user.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      (formData.firstName && formData.lastName)
                        ? `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase()
                        : 'U'
                    )}
                  </div>
                  {/* <button 
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800"
                    onClick={() => toast.info('Photo upload functionality coming soon!')}
                  >
                    Change photo
                  </button> */}
                </div>

                {/* Right side information sections */}
                <div className="flex-1">
                  {/* Personal Information Section */}
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4">Personal Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* First Name */}
                      <div className="form-group">
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className="sg-input pl-10 w-full"
                            placeholder="First Name"
                          />
                        </div>
                      </div>
                      
                      {/* Last Name */}
                      <div className="form-group">
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className="sg-input pl-10 w-full"
                            placeholder="Last Name"
                          />
                        </div>
                      </div>
                      
                      {/* Email */}
                      <div className="form-group">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="sg-input pl-10 w-full"
                            placeholder="Email Address"
                            disabled
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed. Contact support for assistance.</p>
                      </div>
                      
                      {/* Phone field removed */}
                    </div>
                  </div>

                  {/* Company Information Section */}
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4">Company Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Company Name */}
                      <div className="form-group">
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="companyName"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleChange}
                            className="sg-input pl-10 w-full"
                            placeholder="Company Name"
                            disabled
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Company information is managed by administrators.</p>
                      </div>
                      
                      {/* Job Title */}
                      {/* <div className="form-group">
                        <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="jobTitle"
                            name="jobTitle"
                            value={formData.jobTitle}
                            onChange={handleChange}
                            className="sg-input pl-10 w-full"
                            placeholder="Job Title"
                          />
                        </div>
                      </div> */}
                      
                      {/* Department */}
                      {/* <div className="form-group md:col-span-2">
                        <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="department"
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            className="sg-input pl-10 w-full"
                            placeholder="Department"
                          />
                        </div>
                      </div> */}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end mt-8">
                    <button
                      type="button"
                      className="mr-4 px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                      onClick={() => navigate(-1)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
                      style={{ backgroundColor: '#2EBCBC' }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
    </div>
    );
};

export default Profile;
