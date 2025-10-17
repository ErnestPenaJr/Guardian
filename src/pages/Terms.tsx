import { Link } from 'react-router-dom';

function Terms() {
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

        <h1 className="text-h5 font-display font-bold text-center mb-1">Terms of Service</h1>
        <p className="text-center text-gray-2 text-body-sm mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

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
              Your privacy is important to us. Our <Link to="/privacy" className="text-secondary hover:underline">Privacy Policy</Link> explains
              how we collect, use, and protect your personal information. By using the Services, you consent to our
              collection and use of your data as described in the Privacy Policy.
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
            <p className="text-body-base text-gray-1 mb-3">
              You represent and warrant that you own or have the necessary rights to submit User Content and that such
              content does not violate any third-party rights or applicable laws.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">7. Prohibited Activities</h2>
            <p className="text-body-base text-gray-1 mb-3">
              You agree not to engage in any of the following prohibited activities:
            </p>
            <ul className="list-disc pl-6 text-body-base text-gray-1 mb-3">
              <li>Copying, distributing, or disclosing any part of the Services without authorization</li>
              <li>Using any automated system to access the Services in a manner that sends more requests than a human can reasonably produce</li>
              <li>Transmitting spam, chain letters, or other unsolicited communications</li>
              <li>Attempting to interfere with, compromise, or disrupt the Services or their security</li>
              <li>Impersonating another person or entity</li>
              <li>Collecting or harvesting any personally identifiable information from the Services</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">8. Service Availability</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We strive to provide reliable and continuous access to the Services. However, we do not guarantee that
              the Services will be available at all times or that they will be error-free. We may modify, suspend, or
              discontinue any aspect of the Services at any time without prior notice.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">9. Disclaimers</h2>
            <p className="text-body-base text-gray-1 mb-3">
              THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT. GUARDIAN DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE,
              OR ERROR-FREE.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">10. Limitation of Liability</h2>
            <p className="text-body-base text-gray-1 mb-3">
              TO THE FULLEST EXTENT PERMITTED BY LAW, GUARDIAN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR
              INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR ACCESS TO
              OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICES.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">11. Indemnification</h2>
            <p className="text-body-base text-gray-1 mb-3">
              You agree to indemnify, defend, and hold harmless Guardian and its officers, directors, employees, and
              agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable
              attorney's fees, arising out of or in any way connected with your access to or use of the Services or
              your violation of these Terms.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">12. Termination</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We may terminate or suspend your account and access to the Services immediately, without prior notice or
              liability, for any reason, including if you breach these Terms. Upon termination, your right to use the
              Services will immediately cease.
            </p>
            <p className="text-body-base text-gray-1 mb-3">
              You may terminate your account at any time by contacting us. All provisions of these Terms that by their
              nature should survive termination shall survive, including ownership provisions, warranty disclaimers,
              indemnity, and limitations of liability.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">13. Changes to Terms</h2>
            <p className="text-body-base text-gray-1 mb-3">
              We reserve the right to modify these Terms at any time. If we make material changes to these Terms, we
              will notify you by updating the date at the top of these Terms and by maintaining a current version of
              these Terms at this location. Your continued use of the Services after any such changes constitutes your
              acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">14. Governing Law</h2>
            <p className="text-body-base text-gray-1 mb-3">
              These Terms shall be governed by and construed in accordance with the laws of the United States, without
              regard to its conflict of law provisions. Any legal action or proceeding arising under these Terms will
              be brought exclusively in the federal or state courts located in the United States.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">15. Contact Information</h2>
            <p className="text-body-base text-gray-1 mb-3">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="text-body-base text-gray-1 mb-3">
              <strong>Guardian Support</strong><br />
              Email: support@shieldlytics.com<br />
              Website: <a href="https://shieldlytics.com" className="text-secondary hover:underline">https://shieldlytics.com</a>
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">16. Entire Agreement</h2>
            <p className="text-body-base text-gray-1 mb-3">
              These Terms constitute the entire agreement between you and Guardian regarding the use of the Services
              and supersede any prior agreements between you and Guardian relating to your use of the Services.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h6 font-display font-semibold mb-3">17. Severability</h2>
            <p className="text-body-base text-gray-1 mb-3">
              If any provision of these Terms is held to be invalid or unenforceable, such provision shall be struck
              and the remaining provisions shall be enforced to the fullest extent under law.
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

export default Terms;
