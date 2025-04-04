
# React + TypeScript Code Standards

This project follows Shieldlytics internal coding standards for integrating React and TypeScript into the existing stack.

---

## 🔧 Code Style

- Use **functional components** and **React Hooks**.
- Use **TypeScript** with strict typing for props, state, and functions.
- Use **CamelCase** for variables and functions.
- Use **PascalCase** for component names.
- Use **snake_case** for all file and folder names.
- Keep all files under **200-300 lines** for readability and maintainability.

---

## 🗂 Project Structure

```
src/
├── components/         # Reusable UI components
├── pages/              # Page-level components
├── hooks/              # Custom React hooks
├── services/           # API calls
├── utils/              # Helper functions
├── types/              # TypeScript interfaces and types
├── assets/
│   └── styles/
│       └── bootstrap_overrides.scss
├── App.tsx             # Root component
├── index.tsx           # React entry point
└── main.ts             # Vite/Webpack entry (if needed)
```

---

## 🎨 Styling & Animations

- Use **Bootstrap 5** (via npm) for UI styling.
- Use **CSS Modules** for scoped styles.
- Use **AOS (Animate On Scroll)** for animations. Initialize globally in `App.tsx`.

---

## 🔗 Libraries

- **React Hook Form** for form management
- **Yup** or **Zod** for schema validation
- **Axios** or `fetch` for AJAX requests
- **Font Awesome Pro 5.15.4** for icons
- **Jest** and **React Testing Library** for unit testing
- **Storybook** for component documentation and preview

---

## 🔄 API Integration

- PHP (`.php`) as backends.
- Group all API calls inside `/services` folder.
- Use typed request and response interfaces.

---

## ⚠️ Rules & Conventions

- **Do not mock** data in stage/prod — use mock data only for test.
- Always validate against environments: `test`, `stage`, `prod`.
- Never introduce new patterns unless existing ones are exhausted.
- Clean up deprecated code if refactored.
- Always restart the server after changes.
- Confirm before modifying `.env` or deploying changes.
- Follow Git commit conventions: `fix:`, `feat:`, `refactor:`, etc.

---

## ✅ Testing & Documentation

- Unit test all major functionality with Jest.
- Use Storybook for UI components.
- Use Cypress for end-to-end testing.
- Document API interfaces, permissions, and component props clearly.

---

## 🌐 Security & Performance

- Enforce HTTPS.
- Use CSRF tokens and secure cookies.
- Secure file uploads and localStorage access.
- Optimize images and implement lazy loading.
- Use responsive design with Bootstrap 5.

---

## 📄 Changelog

All changes must be tracked in `changelog.md`. Keep notes concise and scoped.

---

For more context, refer to `global_rules.md` and `WORKFLOW.md`.

---

# ⚛️ React Best Practices

## 🧱 Component Structure
- Use functional components over class components.
- Keep components small and focused.
- Extract reusable logic into custom hooks.
- Use composition over inheritance.
- Implement proper prop types with TypeScript.
- Split large components into smaller, focused ones.

## 🔄 Hooks
- Follow the Rules of Hooks.
- Use custom hooks for reusable logic.
- Keep hooks focused and simple.
- Use appropriate dependency arrays in useEffect.
- Implement cleanup in useEffect when needed.
- Avoid nested hooks.

## 🧠 State Management
- Use useState for local component state.
- Implement useReducer for complex state logic.
- Use Context API for shared state.
- Keep state as close to where it's used as possible.
- Avoid prop drilling through proper state management.
- Use state management libraries only when necessary.

## 🚀 Performance
- Implement proper memoization (useMemo, useCallback).
- Use React.memo for expensive components.
- Avoid unnecessary re-renders.
- Implement proper lazy loading.
- Use proper key props in lists.
- Profile and optimize render performance.

## 📝 Forms
- Use controlled components for form inputs.
- Implement proper form validation.
- Handle form submission states properly.
- Show appropriate loading and error states.
- Use form libraries for complex forms.
- Implement proper accessibility for forms.

## ❗ Error Handling
- Implement Error Boundaries.
- Handle async errors properly.
- Show user-friendly error messages.
- Implement proper fallback UI.
- Log errors appropriately.
- Handle edge cases gracefully.

## 🧪 Testing
- Write unit tests for components.
- Implement integration tests for complex flows.
- Use React Testing Library.
- Test user interactions.
- Test error scenarios.
- Implement proper mock data.

## ♿ Accessibility
- Use semantic HTML elements.
- Implement proper ARIA attributes.
- Ensure keyboard navigation.
- Test with screen readers.
- Handle focus management.
- Provide proper alt text for images.

## 🗃️ Code Organization
- Group related components together.
- Use proper file naming conventions.
- Implement proper directory structure.
- Keep styles close to components.
- Use proper imports/exports.
- Document complex component logic.
