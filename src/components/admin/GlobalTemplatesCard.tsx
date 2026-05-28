// src/components/admin/GlobalTemplatesCard.tsx
//
// JAFAR-only dashboard card. Rendered as an inline-anchor that matches the
// styling of every other AdminDashboard card (Tailwind utility classes,
// top-border accent, large icon, bullet list, full-card click target).
//
// Clicking opens the GlobalTemplatesModal to manage platform-wide templates.

import React from 'react';
import { FaGlobe } from 'react-icons/fa';

interface Props {
  onOpenManager: () => void;
}

const GlobalTemplatesCard: React.FC<Props> = ({ onOpenManager }) => (
  <a
    href="#"
    className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-cyan-500"
    style={{
      borderRadius: '6px',
      backgroundColor: '#FFFFFF',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ecfeff')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
    onClick={(e) => {
      e.preventDefault();
      onOpenManager();
    }}
    data-testid="global-templates-card"
  >
    <FaGlobe className="h-12 w-12 text-cyan-500 mb-4" />
    <h3 className="text-lg font-semibold mb-2">Global Templates</h3>
    <ul className="text-gray-600">
      <li>Create platform-wide templates</li>
      <li>Visible to all companies</li>
      <li>JAFAR access only</li>
    </ul>
  </a>
);

export default GlobalTemplatesCard;
