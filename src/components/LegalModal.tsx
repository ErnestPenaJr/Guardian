import React from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const termsContent = (
    <div className="prose max-w-none">
      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">1. Introduction</h2>
        <p className="text-body-base text-gray-1 mb-3">
          Welcome to Guardian. These Terms of Service ("Terms") govern your access to and use of Guardian's
          services, including our application, websites, and related services (collectively, the "Services").
          By accessing or using our Services, you agree to be bound by these Terms.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">2. Use of Service</h2>
        <p className="text-body-base text-gray-1 mb-3">
          Guardian provides a secure platform for managing requests, forms, and workflows within your organization.
          You agree to use the Services only for lawful purposes and in accordance with these Terms.
        </p>
        <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
          <li>You must be at least 18 years old to use the Services</li>
          <li>You are responsible for maintaining the confidentiality of your account credentials</li>
          <li>You agree not to use the Services for any unlawful or prohibited activities</li>
          <li>You will not attempt to gain unauthorized access to any part of the Services</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">3. User Accounts</h2>
        <p className="text-body-base text-gray-1 mb-3">
          To access certain features of the Services, you must register for an account. You agree to provide
          accurate, current, and complete information during the registration process and to update such information
          to keep it accurate, current, and complete.
        </p>
        <p className="text-body-base text-gray-1 mb-3">
          You are responsible for all activities that occur under your account. You agree to immediately notify
          Guardian of any unauthorized use of your account or any other breach of security.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">4. Privacy and Data Protection</h2>
        <p className="text-body-base text-gray-1 mb-3">
          Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your
          personal information. By using the Services, you consent to our collection and use of your data as
          described in the Privacy Policy.
        </p>
        <p className="text-body-base text-gray-1 mb-3">
          Guardian implements company-based data isolation to ensure that your organization's data remains secure
          and separate from other organizations using the platform.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">5. Intellectual Property</h2>
        <p className="text-body-base text-gray-1 mb-3">
          The Services and their entire contents, features, and functionality (including but not limited to all
          information, software, text, displays, images, video, and audio) are owned by Guardian, its licensors,
          or other providers of such material and are protected by copyright, trademark, patent, trade secret,
          and other intellectual property or proprietary rights laws.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">6. User Content</h2>
        <p className="text-body-base text-gray-1 mb-3">
          You retain ownership of any content you submit, post, or display through the Services ("User Content").
          By submitting User Content, you grant Guardian a worldwide, non-exclusive, royalty-free license to use,
          reproduce, modify, and distribute such content solely for the purpose of providing and improving the Services.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">7. Disclaimers</h2>
        <p className="text-body-base text-gray-1 mb-3">
          THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER
          EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">8. Limitation of Liability</h2>
        <p className="text-body-base text-gray-1 mb-3">
          TO THE FULLEST EXTENT PERMITTED BY LAW, GUARDIAN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR
          INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">9. Contact Information</h2>
        <p className="text-body-base text-gray-1 mb-3">
          If you have any questions about these Terms, please contact us at support@guardian.com
        </p>
      </section>
    </div>
  );

  const privacyContent = (
    <div className="prose max-w-none">
      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">1. Introduction</h2>
        <p className="text-body-base text-gray-1 mb-3">
          Guardian ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how
          we collect, use, disclose, and safeguard your information when you use our Services.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">2. Information We Collect</h2>
        <p className="text-body-base text-gray-1 mb-3">
          We collect information that you provide directly to us, information we obtain automatically when you use
          our Services, and information from third-party sources.
        </p>

        <h3 className="text-body-lg font-semibold mb-2 mt-4">2.1 Information You Provide</h3>
        <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
          <li>Account information (name, email address, password)</li>
          <li>Company information (company name, organization details)</li>
          <li>Profile information (role, team assignments)</li>
          <li>Request and form data (submissions, attachments, notes)</li>
        </ul>

        <h3 className="text-body-lg font-semibold mb-2 mt-4">2.2 Automatically Collected Information</h3>
        <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
          <li>Log data (IP address, browser type, device information)</li>
          <li>Usage data (pages visited, features used, time spent)</li>
          <li>Cookies and similar tracking technologies</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">3. How We Use Your Information</h2>
        <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
          <li>To provide, maintain, and improve our Services</li>
          <li>To process and complete transactions</li>
          <li>To send you technical notices, updates, and support messages</li>
          <li>To respond to your comments, questions, and requests</li>
          <li>To monitor and analyze usage patterns and trends</li>
          <li>To detect, prevent, and address technical issues and security threats</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">4. Data Security</h2>
        <p className="text-body-base text-gray-1 mb-3">
          We implement appropriate technical and organizational measures to protect your information:
        </p>
        <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
          <li>Encryption of data in transit and at rest</li>
          <li>Company-based data isolation to prevent cross-organization access</li>
          <li>Role-based access controls and authentication</li>
          <li>Regular security assessments and monitoring</li>
          <li>JWT token-based authentication for API access</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">5. Company-Based Data Isolation</h2>
        <p className="text-body-base text-gray-1 mb-3">
          Guardian implements strict company-based data isolation:
        </p>
        <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
          <li>Your organization's data is logically separated from other organizations</li>
          <li>Users can only access data belonging to their own company</li>
          <li>All database queries include company ID filtering for security</li>
          <li>Cross-company data access is prevented at the application and database level</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">6. Your Rights and Choices</h2>
        <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
          <li><strong>Access:</strong> You can request access to the personal information we hold about you</li>
          <li><strong>Correction:</strong> You can update or correct your personal information through your account settings</li>
          <li><strong>Deletion:</strong> You can request deletion of your account and personal information</li>
          <li><strong>Data Portability:</strong> You can request a copy of your data in a structured format</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-h6 font-display font-semibold mb-3">7. Contact Us</h2>
        <p className="text-body-base text-gray-1 mb-3">
          If you have any questions about this Privacy Policy, please contact us at privacy@guardian.com
        </p>
      </section>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-6 h-6" />
            <h2 className="text-h5 font-display font-bold text-black">
              {type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-center text-gray-2 text-body-sm mb-6">
            Last Updated: {new Date().toLocaleDateString()}
          </p>
          {type === 'terms' ? termsContent : privacyContent}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-3 px-6 text-white font-medium transition-colors duration-300 ease-in-out"
            style={{
              borderRadius: '8px',
              backgroundColor: '#2EBCBC'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2F8CED';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2EBCBC';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
