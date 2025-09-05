import React, { useState } from 'react';
import Modal from 'react-modal';
import { X, Users, UserPlus, ArrowRight } from 'lucide-react';
import SendInvitesForm from './SendInvitesForm';
import api from '../utils/api';
import { toast } from 'react-toastify';

interface AccountCreatorInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userFirstName?: string;
  companyName?: string;
}

const AccountCreatorInviteModal: React.FC<AccountCreatorInviteModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  userFirstName = 'Admin',
  companyName = 'your organization'
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSkip = async () => {
    await markInviteModalAsCompleted();
    onComplete();
  };

  const handleSendInvites = () => {
    // The SendInvitesForm has its own onClose handler that closes the inner form
    // We'll mark as completed when the user successfully sends invites
    markInviteModalAsCompleted();
    onComplete();
  };

  const markInviteModalAsCompleted = async () => {
    try {
      setIsLoading(true);
      const response = await api.post('/api/users/complete-account-creator-invite');
      
      if (response.data.success) {
        console.log('✅ Account creator invite modal marked as completed');
      }
    } catch (error) {
      console.error('❌ Error marking invite modal as completed:', error);
      // Don't show error toast - this is background operation
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteFormClose = () => {
    // Called when SendInvitesForm closes (after successful send)
    markInviteModalAsCompleted();
    onComplete();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="bg-white rounded-xl shadow-2xl max-w-2xl mx-auto mt-20 p-0 max-h-[80vh] overflow-hidden focus:outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50"
      ariaHideApp={false}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="text-black p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Welcome to Guardian!</h2>
                <p className="text-white/90 text-sm">Build your team and get started</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Welcome Message */}
            <div className="text-center space-y-3">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  🎉 Congratulations, {userFirstName}!
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  You've successfully created your Guardian account for <strong>{companyName}</strong>. 
                  As the account creator, you can now invite your team members to join your organization.
                </p>
              </div>
            </div>

            {/* Benefits Section */}
            {/* <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-teal-600" />
                Why invite your team now?
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <ArrowRight className="w-4 h-4 mr-2 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>Get everyone on the same platform from day one</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="w-4 h-4 mr-2 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>Assign appropriate roles and permissions</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="w-4 h-4 mr-2 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>Start collaborating immediately</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="w-4 h-4 mr-2 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>You can always invite more people later</span>
                </li>
              </ul>
            </div> */}

            {/* Invite Form */}
            <div className="border-t pt-6">
              <SendInvitesForm onClose={handleInviteFormClose} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              You can invite team members anytime from the main menu
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleSkip}
                disabled={isLoading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AccountCreatorInviteModal;