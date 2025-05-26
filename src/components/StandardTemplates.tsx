import React from 'react';
import { FaUser, FaMoneyBill, FaHome } from 'react-icons/fa';
import '../styles/StandardTemplates.css';

interface StandardTemplateProps {
  onSelectTemplate: (templateId: string) => void;
}

const StandardTemplates: React.FC<StandardTemplateProps> = ({ onSelectTemplate }) => {
  // Template definitions moved directly into the JSX for clarity

  // Handle template selection with explicit ID
  const handleTemplateClick = (templateId: string) => {
    console.log(`Explicitly selecting template: ${templateId}`);
    // Force a small delay to ensure event propagation is complete
    setTimeout(() => {
      onSelectTemplate(templateId);
    }, 10);
  };

  return (
    <div className="standard-templates-container">
      {/* Subject Template Card - Direct handler */}
      <div 
        className="template-card"
        onClick={() => handleTemplateClick('subject')}
        title="Click to create and fill out this form"
        data-template-id="subject"
        id="subject-template-card"
      >
        <div className="template-header">
          <h3 className="template-title">SUBJECT</h3>
        </div>
        <div className="template-body">
          <div className="template-icon">
            <FaUser size={24} />
          </div>
          <div className="template-description">
            First Name, Middle Name, Last Name, DOB, SSN
          </div>
        </div>
      </div>

      {/* Financial Template Card - Direct handler */}
      <div 
        className="template-card"
        onClick={() => handleTemplateClick('financial')}
        title="Click to create and fill out this form"
        data-template-id="financial"
        id="financial-template-card"
      >
        <div className="template-header">
          <h3 className="template-title">FINANCIAL</h3>
        </div>
        <div className="template-body">
          <div className="template-icon">
            <FaMoneyBill size={24} />
          </div>
          <div className="template-description">
            Bank Name, Account #, Routing #
          </div>
        </div>
      </div>

      {/* Address Template Card - Direct handler */}
      <div 
        className="template-card"
        onClick={() => handleTemplateClick('address')}
        title="Click to create and fill out this form"
        data-template-id="address"
        id="address-template-card"
      >
        <div className="template-header">
          <h3 className="template-title">ADDRESS</h3>
        </div>
        <div className="template-body">
          <div className="template-icon">
            <FaHome size={24} />
          </div>
          <div className="template-description">
            Address Line 1, Address Line 2, City, State, ZIP Code
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandardTemplates;
