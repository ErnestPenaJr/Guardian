import { Link } from 'react-router-dom';

function Privacy() {
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
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-4xl my-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
          <span className="text-h4 font-display font-bold text-black">Guardian</span>
        </div>

        <h1 className="text-h5 font-display font-bold text-center mb-1">Privacy Policy</h1>
        <p className="text-center text-gray-2 text-body-sm mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

        <div className="prose max-w-none">
          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">1. Introduction</h2>
            <p className="text-body-base text-gray-1 mb-3">
              Guardian ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you use our Services. Please read this
              Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access
              the Services.
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
              <li>Communications with us (support inquiries, feedback)</li>
            </ul>

            <h3 className="text-body-lg font-semibold mb-2 mt-4">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
              <li>Log data (IP address, browser type, device information)</li>
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Performance and error data</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
              <li>To provide, maintain, and improve our Services</li>
              <li>To process and complete transactions</li>
              <li>To send you technical notices, updates, and support messages</li>
              <li>To respond to your comments, questions, and requests</li>
              <li>To monitor and analyze usage patterns and trends</li>
              <li>To detect, prevent, and address technical issues and security threats</li>
              <li>To comply with legal obligations and enforce our policies</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">4. Data Sharing and Disclosure</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We may share your information in the following circumstances:
            </p>

            <h3 className="text-body-lg font-semibold mb-2 mt-4">4.1 Within Your Organization</h3>
            <p className="text-body-base text-gray-1 mb-3">
              Information may be shared with other users within your organization based on role-based access controls
              and permission settings.
            </p>

            <h3 className="text-body-lg font-semibold mb-2 mt-4">4.2 Service Providers</h3>
            <p className="text-body-base text-gray-1 mb-3">
              We may share your information with third-party service providers who perform services on our behalf,
              such as hosting, data storage, email delivery, and analytics.
            </p>

            <h3 className="text-body-lg font-semibold mb-2 mt-4">4.3 Legal Requirements</h3>
            <p className="text-body-base text-gray-1 mb-3">
              We may disclose your information if required to do so by law or in response to valid requests by public
              authorities (e.g., a court or government agency).
            </p>

            <h3 className="text-body-lg font-semibold mb-2 mt-4">4.4 Business Transfers</h3>
            <p className="text-body-base text-gray-1 mb-3">
              If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as
              part of that transaction.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">5. Data Security</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We implement appropriate technical and organizational measures to protect your information against
              unauthorized access, alteration, disclosure, or destruction. These measures include:
            </p>
            <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
              <li>Encryption of data in transit and at rest</li>
              <li>Company-based data isolation to prevent cross-organization access</li>
              <li>Role-based access controls and authentication</li>
              <li>Regular security assessments and monitoring</li>
              <li>Secure database connections with Microsoft SQL Server</li>
              <li>JWT token-based authentication for API access</li>
            </ul>
            <p className="text-body-base text-gray-1 mb-3">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we
              strive to use commercially acceptable means to protect your information, we cannot guarantee absolute
              security.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">6. Company-Based Data Isolation</h2>
            <p className="text-body-base text-gray-1 mb-3">
              Guardian implements strict company-based data isolation. This means:
            </p>
            <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
              <li>Your organization's data is logically separated from other organizations</li>
              <li>Users can only access data belonging to their own company</li>
              <li>All database queries include company ID filtering for security</li>
              <li>Cross-company data access is prevented at the application and database level</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">7. Data Retention</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We retain your information for as long as your account is active or as needed to provide you Services.
              We will retain and use your information as necessary to comply with our legal obligations, resolve
              disputes, and enforce our agreements. When you request deletion of your account, we will delete or
              anonymize your personal information within a reasonable timeframe, except where we are required to
              retain it for legal or compliance purposes.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">8. Your Rights and Choices</h2>
            <p className="text-body-base text-gray-1 mb-3">
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
              <li><strong>Access:</strong> You can request access to the personal information we hold about you</li>
              <li><strong>Correction:</strong> You can update or correct your personal information through your account settings</li>
              <li><strong>Deletion:</strong> You can request deletion of your account and personal information</li>
              <li><strong>Data Portability:</strong> You can request a copy of your data in a structured format</li>
              <li><strong>Opt-Out:</strong> You can opt out of certain data collection and communications</li>
            </ul>
            <p className="text-body-base text-gray-1 mb-3">
              To exercise these rights, please contact us using the information provided in the Contact section below.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">9. Cookies and Tracking Technologies</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We use cookies and similar tracking technologies to collect and track information about your use of our
              Services. Cookies are small data files stored on your device. You can instruct your browser to refuse
              all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may
              not be able to use some portions of our Services.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">10. Third-Party Links</h2>
            <p className="text-body-base text-gray-1 mb-3">
              Our Services may contain links to third-party websites or services that are not owned or controlled by
              Guardian. We are not responsible for the privacy practices or content of these third-party sites. We
              encourage you to review the privacy policies of any third-party sites you visit.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">11. Children's Privacy</h2>
            <p className="text-body-base text-gray-1 mb-3">
              Our Services are not intended for individuals under the age of 18. We do not knowingly collect personal
              information from children under 18. If you are a parent or guardian and believe that your child has
              provided us with personal information, please contact us so we can delete such information.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">12. International Data Transfers</h2>
            <p className="text-body-base text-gray-1 mb-3">
              Your information may be transferred to and maintained on computers located outside of your state,
              province, country, or other governmental jurisdiction where data protection laws may differ from those
              of your jurisdiction. By using our Services, you consent to the transfer of your information to the
              United States and other countries where Guardian operates.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">13. Changes to This Privacy Policy</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We may update this Privacy Policy from time to time. We will notify you of any changes by updating the
              "Last Updated" date at the top of this Privacy Policy. You are advised to review this Privacy Policy
              periodically for any changes. Your continued use of the Services after any modifications to the Privacy
              Policy will constitute your acknowledgment of the modifications and your consent to abide by the updated
              Privacy Policy.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">14. Contact Us</h2>
            <p className="text-body-base text-gray-1 mb-3">
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p className="text-body-base text-gray-1 mb-3">
              <strong>Guardian Privacy Team</strong><br />
              Email: support@shieldlytics.com<br />
              Website: <a href="https://shieldlytics.com" className="text-secondary hover:underline">https://shieldlytics.com</a>
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">15. California Privacy Rights</h2>
            <p className="text-body-base text-gray-1 mb-3">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act
              (CCPA), including the right to request information about the categories and specific pieces of personal
              information we have collected about you, the right to request deletion of your personal information, and
              the right to opt-out of the sale of your personal information. Guardian does not sell personal information.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/register"
            className="inline-block py-3 px-6 text-white font-medium transition-colors duration-300 ease-in-out"
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
            Back to Registration
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Privacy;
