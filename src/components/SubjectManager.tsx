import React, { useState } from 'react';
import { Subject, FormField } from '../types/formBuilder';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash } from 'react-icons/fa';

interface SubjectManagerProps {
  subjects: Subject[];
  onSubjectsChange: (subjects: Subject[]) => void;
  onSelectSubject: (subjectId: string) => void;
  selectedSubjectId?: string;
}

const SubjectManager: React.FC<SubjectManagerProps> = ({ 
  subjects, 
  onSubjectsChange, 
  onSelectSubject,
  selectedSubjectId 
}) => {
  const [newSubjectTitle, setNewSubjectTitle] = useState('');

  const addSubject = () => {
    const title = newSubjectTitle.trim() || `Subject ${subjects.length + 1}`;
    const newSubject: Subject = {
      id: `subject-${uuidv4()}`,
      title,
      fields: []
    };
    
    const updatedSubjects = [...subjects, newSubject];
    onSubjectsChange(updatedSubjects);
    onSelectSubject(newSubject.id);
    setNewSubjectTitle('');
  };

  const removeSubject = (id: string) => {
    const updatedSubjects = subjects.filter(subject => subject.id !== id);
    onSubjectsChange(updatedSubjects);
    
    // If the removed subject was selected, select the first available subject
    if (selectedSubjectId === id && updatedSubjects.length > 0) {
      onSelectSubject(updatedSubjects[0].id);
    }
  };

  const updateSubjectTitle = (id: string, title: string) => {
    const updatedSubjects = subjects.map(subject => 
      subject.id === id ? { ...subject, title } : subject
    );
    onSubjectsChange(updatedSubjects);
  };

  return (
    <div className="subject-manager">
      <h2 className="mb-3">Subjects</h2>
      
      <div className="subject-tabs mb-4">
        {subjects.map((subject) => (
          <div 
            key={subject.id} 
            className={`subject-tab ${selectedSubjectId === subject.id ? 'active' : ''}`}
            onClick={() => onSelectSubject(subject.id)}
          >
            <div className="d-flex align-items-center">
              <span>{subject.title}</span>
              <button 
                className="btn btn-sm btn-link text-danger ms-2"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSubject(subject.id);
                }}
              >
                <FaTrash size={12} />
              </button>
            </div>
          </div>
        ))}
        
        <div className="add-subject-form d-flex align-items-center">
          <input
            type="text"
            className="form-control form-control-sm me-2"
            placeholder="New Subject"
            value={newSubjectTitle}
            onChange={(e) => setNewSubjectTitle(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addSubject();
              }
            }}
          />
          <button 
            className="btn btn-sm btn-success"
            onClick={addSubject}
          >
            <FaPlus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubjectManager;
