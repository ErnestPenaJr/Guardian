import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';

interface UpdateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  general?: string;
}

const UpdateProfileModal: React.FC<UpdateProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        firstName: user.FIRST_NAME || user.firstName || '',
        lastName: user.LAST_NAME || user.lastName || '',
        email: user.EMAIL || user.email || '',
        companyName: '', // We'll load this from API if needed
      });
      setErrors({});
      loadCompanyInfo();
    }
  }, [isOpen, user]);

  const loadCompanyInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !user?.COMPANY_ID) return;

      const response = await fetch(`/api/company/${user.COMPANY_ID}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const companyData = await response.json();
        setFormData(prev => ({
          ...prev,
          companyName: companyData.COMPANY_NAME || companyData.name || '',
        }));
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    if (user) {
      setFormData({
        firstName: user.FIRST_NAME || user.firstName || '',
        lastName: user.LAST_NAME || user.lastName || '',
        email: user.EMAIL || user.email || '',
        companyName: formData.companyName, // Keep company name
      });
    }
    setErrors({});
    setIsSubmitting(false);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // First Name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    } else if (formData.firstName.length > 50) {
      newErrors.firstName = 'First name must be less than 50 characters';
    }

    // Last Name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    } else if (formData.lastName.length > 50) {
      newErrors.lastName = 'Last name must be less than 50 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      } else if (formData.email.length > 125) {
        newErrors.email = 'Email must be less than 125 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!user) {
      setErrors({ general: 'User not found. Please log in again.' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Use the existing PUT /api/users/:id endpoint
      const response = await fetch(`/api/users/${user.USER_ID || user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          // Don't send roleId or status for profile updates
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
      }

      await response.json();

      // Update user in auth context and localStorage
      const updatedUserData = {
        ...user,
        FIRST_NAME: formData.firstName.trim(),
        LAST_NAME: formData.lastName.trim(),
        EMAIL: formData.email.trim(),
        FULL_NAME: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
      };

      updateUser(updatedUserData);

      toast.success('Profile updated successfully!', {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      handleClose();

    } catch (error: any) {
      console.error('Profile update error:', error);
      
      let errorMessage = 'Failed to update profile. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      }

      if (error.message?.toLowerCase().includes('email')) {
        setErrors({ email: errorMessage });
      } else {
        setErrors({ general: errorMessage });
      }

      toast.error(errorMessage, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity z-[1001]" 
          aria-hidden="true"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        {/* Modal panel */}
        <div 
          className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-sm transform transition-all sm:my-8 sm:align-middle max-w-lg w-full z-[1002] relative border border-gray-200 border-t-4 border-t-blue-500"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-headline"
        >
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-semibold text-gray-900" id="modal-headline">
              Update Profile
            </h3>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="bg-white px-6 py-6">
            <form onSubmit={handleSubmit}>
              {/* General error */}
              {errors.general && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{errors.general}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* First Name */}
              <div className="mb-4">
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.firstName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your first name"
                  maxLength={50}
                  aria-describedby={errors.firstName ? "firstName-error" : undefined}
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && (
                  <p id="firstName-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.firstName}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div className="mb-4">
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.lastName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your last name"
                  maxLength={50}
                  aria-describedby={errors.lastName ? "lastName-error" : undefined}
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && (
                  <p id="lastName-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.lastName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email address"
                  maxLength={125}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Company/Organization (Read Only) */}
              <div className="mb-6">
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Organization
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName || 'Loading...'}
                  disabled={true}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                  placeholder="Organization name"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Contact your administrator to update organization information.
                </p>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 space-y-3 space-y-reverse sm:space-y-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSubmitting ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateProfileModal;