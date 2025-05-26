import React from 'react';
import { FaUser, FaMoneyBill, FaHome } from 'react-icons/fa';
import '../styles/StandardTemplates.css';

interface StandardTemplateProps {
  onSelectTemplate: (templateId: string) => void;
}

const StandardTemplates: React.FC<StandardTemplateProps> = ({ onSelectTemplate }) => {
  const templates = [
    {
      id: 'subject',
      name: 'SUBJECT',
      description: 'First Name, Middle Name, Last Name, DOB, SSN',
      icon: <FaUser size={24} />,
      color: '#1a5b87'
    },
    {
      id: 'financial',
      name: 'FINANCIAL',
      description: 'Bank Name, Account #, Routing #',
      icon: <FaMoneyBill size={24} />,
      color: '#1a5b87'
    },
    {
      id: 'address',
      name: 'ADDRESS',
      description: 'Address Line 1, Address Line 2, City, State, ZIP Code',
      icon: <FaHome size={24} />,
      color: '#1a5b87'
    }
  ];

  return (
    <div className="standard-templates-container">
      {templates.map(template => (
        <div 
          key={template.id}
          className="template-card"
          onClick={() => onSelectTemplate(template.id)}
          title="Click to create and fill out this form"
        >
          <div className="template-header">
            <h3 className="template-title">{template.name}</h3>
          </div>
          <div className="template-body">
            <div className="template-icon">
              {template.icon}
            </div>
            <div className="template-description">
              {template.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StandardTemplates;
