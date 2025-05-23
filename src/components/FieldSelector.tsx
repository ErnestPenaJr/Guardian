import React from 'react';
import { FormFieldType } from '../types/formBuilder';
import { 
  FaFont, 
  FaHashtag, 
  FaCalendarAlt, 
  FaListUl, 
  FaCheckSquare,
  FaCreditCard,
  FaBuilding,
  FaMapMarkerAlt,
  FaCity,
  FaPhone,
  FaUniversity,
  FaFileInvoiceDollar
} from 'react-icons/fa';

interface FieldSelectorProps {
  onAddField: (fieldType: string) => void;
}

const FieldSelector: React.FC<FieldSelectorProps> = ({ onAddField }) => {
  // Define available field types
  const fieldTypes: FormFieldType[] = [
    { id: 'account_number', label: 'Account #', icon: 'FaHashtag', category: 'financial' },
    { id: 'address_line_1', label: 'Address Line 1', icon: 'FaBuilding', category: 'address' },
    { id: 'address_line_2', label: 'Address Line 2', icon: 'FaBuilding', category: 'address' },
    { id: 'bank_name', label: 'Bank Name', icon: 'FaUniversity', category: 'financial' },
    { id: 'city', label: 'City', icon: 'FaCity', category: 'address' },
    { id: 'phone', label: 'Phone #', icon: 'FaPhone', category: 'contact' },
    { id: 'routing_number', label: 'Routing #', icon: 'FaHashtag', category: 'financial' },
    { id: 'state', label: 'State', icon: 'FaMapMarkerAlt', category: 'address' },
    { id: 'zip_code', label: 'ZIP Code', icon: 'FaMapMarkerAlt', category: 'address' },
    { id: 'first_name', label: 'First Name', icon: 'FaFont', category: 'personal' },
    { id: 'middle_name', label: 'Middle Name', icon: 'FaFont', category: 'personal' },
    { id: 'last_name', label: 'Last Name', icon: 'FaFont', category: 'personal' },
    { id: 'dob', label: 'DOB', icon: 'FaCalendarAlt', category: 'personal' },
    { id: 'ssn', label: 'SSN', icon: 'FaHashtag', category: 'personal' }
  ];

  // Get icon component based on icon name
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'FaFont':
        return <FaFont />;
      case 'FaHashtag':
        return <FaHashtag />;
      case 'FaCalendarAlt':
        return <FaCalendarAlt />;
      case 'FaListUl':
        return <FaListUl />;
      case 'FaCheckSquare':
        return <FaCheckSquare />;
      case 'FaCreditCard':
        return <FaCreditCard />;
      case 'FaBuilding':
        return <FaBuilding />;
      case 'FaMapMarkerAlt':
        return <FaMapMarkerAlt />;
      case 'FaCity':
        return <FaCity />;
      case 'FaPhone':
        return <FaPhone />;
      case 'FaUniversity':
        return <FaUniversity />;
      case 'FaFileInvoiceDollar':
        return <FaFileInvoiceDollar />;
      default:
        return <FaFont />;
    }
  };

  return (
    <div className="field-selector">
      <h6 className="mb-3">Fields</h6>
      <div className="field-grid">
        {fieldTypes.map((fieldType) => (
          <div 
            key={fieldType.id}
            className="field-item"
            onClick={() => onAddField(fieldType.id)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('fieldType', fieldType.id);
              e.dataTransfer.setData('action', 'add');
            }}
          >
            <div className="field-icon">
              {getIconComponent(fieldType.icon)}
            </div>
            <div className="field-label">
              {fieldType.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FieldSelector;
