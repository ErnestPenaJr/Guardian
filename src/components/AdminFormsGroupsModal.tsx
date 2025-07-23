import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import AdminFormsGroups from '../pages/AdminFormsGroups';

interface AdminFormsGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminFormsGroupsModal: React.FC<AdminFormsGroupsModalProps> = ({ isOpen, onClose }) => {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-7xl h-5/6 flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-2xl font-bold">Manage Field Groups</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 bg-transparent border-none p-2 rounded-full hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="flex-grow overflow-auto p-4">
          <div className="h-full">
            <AdminFormsGroups isInModal={true} onModalClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFormsGroupsModal;
