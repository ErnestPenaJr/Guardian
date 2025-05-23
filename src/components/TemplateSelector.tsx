import React from 'react';
import { Template, FormField } from '../types/formBuilder';
import { FaChevronRight } from 'react-icons/fa';

interface TemplateSelectorProps {
  templates: Template[];
  onSelectTemplate: (template: Template) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ templates, onSelectTemplate }) => {
  return (
    <div className="template-selector">
      <h6 className="mb-3">Templates</h6>
      <div className="template-list">
        {templates.map((template) => (
          <div 
            key={template.id} 
            className="template-item"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="d-flex align-items-center">
              {template.icon && (
                <span className="template-icon me-2">
                  {template.icon}
                </span>
              )}
              <span className="template-name">{template.name}</span>
            </div>
            <FaChevronRight className="ms-auto" size={12} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;
