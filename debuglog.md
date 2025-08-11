# Guardian MVP Debug Log

## 2025-08-08

- Changed heading text in `src/pages/VerifyForgotPassword.tsx` from "Verify Your Email" to "Verify Your Code".
  - Context: The verification step on the forgot password flow uses a 6-digit code; heading updated to reflect code verification instead of email verification.
  - Affected DOM: `<h1 class="text-h3 font-display font-bold text-center mb-2">...` now reads "Verify Your Code".
  - Related files checked: `src/pages/VerifyEmail.tsx` also contains a "Verify Your Email" heading for email verification; left unchanged as it is correct for that flow.
  - Build/runtime: No rebuild steps required beyond Vite HMR; change should hot-reload on the dev server at port 5175.
  - Verification: Manually confirmed the updated text renders on the Verify Forgot Password code-entry page.

## 2025-08-11

- SimpleFormBuilder sidebar update
  - Added preset section above fields list with buttons: Subject, Financial, Vehicle, Address
  - File: `src/components/SimpleFormBuilder.tsx` — section header changed to "WORKFLOW TEMPLATES"
  - Behavior: Clicking a button now preloads (replaces) current form fields with the template (previously appended)
  - Styles: Added `.forms-section`, `.forms-grid`, and `.form-btn*` rules in `src/styles/SimpleFormBuilder.css`
  - New template: `vehicle` (Make, Model, Year, VIN, License Plate)
  - Verified via Vite HMR on port 5175
