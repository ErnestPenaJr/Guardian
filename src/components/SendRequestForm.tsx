import React, { useState } from 'react';
import { SunMoon, Settings, User, KeyRound, Bell } from 'lucide-react';

interface WorkflowLevel {
  fieldName: string;
  approvalType: string;
  approverList: string;
}

interface SendRequestFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const workflowTypes = [
  {
    value: 'processing',
    label: 'Processing',
    description: 'For requests that involve the generation of a work product, it can include an initial approval, but not required.'
  },
  {
    value: 'approval',
    label: 'Approval',
    description: 'For requests for approval, can include multiple levels of approval, but does not include a work product being generated.'
  },
  {
    value: 'selfservice',
    label: 'Self-Service',
    description: 'For requests where the work product is automatically generated or for solely logging the data included within the request.'
  }
];

const approvalTypes = [
  {
    value: 'predefined-single',
    label: 'Pre-Defined Single-Approver',
    help: 'Will go to all listed approvers, any can approve.'
  },
  {
    value: 'predefined-multi',
    label: 'Pre-Defined Multiple-Approvers',
    help: 'Will go to all listed approvers, all must approve.'
  },
  {
    value: 'requestor-single',
    label: 'Requestor Defined Single-Approver',
    help: 'Requestor can select from list of approvers.'
  }
];

const SendRequestForm: React.FC<SendRequestFormProps> = ({ onSubmit, onCancel }) => {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({
    name: '',
    abbreviation: '',
    description: '',
    availableToExternal: false,
    active: false
  });

  // Utility to auto-generate abbreviation from name
  const generateAbbreviation = (name: string) => {
    // Take first letter of each word, up to 4 chars, uppercase
    return name
      .split(/\s+/)
      .map(word => word[0] || '')
      .join('')
      .slice(0, 4)
      .toUpperCase();
  };

  const [workflow, setWorkflow] = useState('');
  const [workflowLevels, setWorkflowLevels] = useState<WorkflowLevel[]>([
    { fieldName: 'Approver', approvalType: '', approverList: '' }
  ]);

  // Handlers for each step
  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setDetails(d => {
      const next = { ...d, [name]: type === 'checkbox' ? checked : value };
      if (name === 'name') {
        // Only auto-update abbreviation if user hasn't manually edited it
        if (!d.abbreviation || d.abbreviation === generateAbbreviation(d.name)) {
          next.abbreviation = generateAbbreviation(value);
        }
      }
      return next;
    });
  };

  const handleWorkflowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkflow(e.target.value);
  };

  const handleWorkflowLevelChange = (index: number, field: keyof WorkflowLevel, value: string) => {
    setWorkflowLevels(levels => levels.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const addWorkflowLevel = () => {
    setWorkflowLevels(levels => [...levels, { fieldName: 'Approver', approvalType: '', approverList: '' }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...details, workflow, workflowLevels });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {step === 0 && (
        <div>
          <div className="flex gap-4 mb-4">
            <button type="button" className="px-4 py-2 rounded-full bg-primary text-white font-semibold" disabled>DETAILS</button>
            <button type="button" className="px-4 py-2 rounded-full text-primary font-semibold" disabled>WORKFLOW</button>
            <button type="button" className="px-4 py-2 rounded-full text-primary font-semibold" disabled>WORKFLOW DETAILS</button>
          </div>
          <h2 className="text-lg font-semibold mb-2">Fill in your request details</h2>
          <div className="flex gap-2 mb-2">
            <input name="name" value={details.name} onChange={handleDetailsChange} placeholder="Name" className="flex-1 rounded-full border px-3 py-2" />
            <input name="abbreviation" value={details.abbreviation} onChange={handleDetailsChange} placeholder="Abbreviation" className="w-32 rounded-full border px-3 py-2" />
          </div>
          <textarea name="description" value={details.description} onChange={handleDetailsChange} placeholder="Description" className="w-full rounded border px-3 py-2 mb-2" rows={3} />
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-1">
              <input type="checkbox" name="availableToExternal" checked={details.availableToExternal} onChange={handleDetailsChange} />
              <span className="text-sm">Available to External Users?</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" name="active" checked={details.active} onChange={handleDetailsChange} />
              <span className="text-sm">Active?</span>
            </label>
          </div>
          <div className="flex justify-between mt-4">
            <button type="button" className="px-4 py-2 rounded bg-primary text-white" onClick={onCancel}>Previous</button>
            <button type="button" className="px-4 py-2 rounded bg-primary text-white" onClick={() => setStep(1)}>Continue</button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          <div className="flex gap-4 mb-4">
            <button type="button" className="px-4 py-2 rounded-full text-primary font-semibold" disabled>DETAILS</button>
            <button type="button" className="px-4 py-2 rounded-full bg-primary text-white font-semibold" disabled>WORKFLOW</button>
            <button type="button" className="px-4 py-2 rounded-full text-primary font-semibold" disabled>WORKFLOW DETAILS</button>
          </div>
          <h2 className="text-lg font-semibold mb-2">Select the workflow type</h2>
          <div className="flex flex-col gap-3 mb-4">
            {workflowTypes.map(wf => (
              <label key={wf.value} className="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="workflow" value={wf.value} checked={workflow === wf.value} onChange={handleWorkflowChange} />
                <span><span className="font-semibold">{wf.label}</span> - <span className="text-sm">{wf.description}</span></span>
              </label>
            ))}
          </div>
          <div className="flex justify-between mt-4">
            <button type="button" className="px-4 py-2 rounded bg-primary text-white" onClick={() => setStep(0)}>Previous</button>
            <button type="button" className="px-4 py-2 rounded bg-primary text-white" onClick={() => setStep(2)} disabled={!workflow}>Continue</button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <div className="flex gap-4 mb-4">
            <button type="button" className="px-4 py-2 rounded-full text-primary font-semibold" disabled>DETAILS</button>
            <button type="button" className="px-4 py-2 rounded-full text-primary font-semibold" disabled>WORKFLOW</button>
            <button type="button" className="px-4 py-2 rounded-full bg-primary text-white font-semibold" disabled>WORKFLOW DETAILS</button>
          </div>
          <h2 className="text-lg font-semibold mb-2">Define your approval workflow</h2>
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full border rounded">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-left text-xs font-semibold">Sequence</th>
                  <th className="px-2 py-1 text-left text-xs font-semibold">Field Name</th>
                  <th className="px-2 py-1 text-left text-xs font-semibold">Approval Type <span title="Pre-Defined Single-Approver (Will go to all listed approvers, any can approve)\nPre-Defined Multiple-Approvers (Will go to all listed approvers, all must approve)\nRequestor Defined Single-Approver (Requestor can select from list of approvers)">?</span></th>
                  <th className="px-2 py-1 text-left text-xs font-semibold">Approver List</th>
                </tr>
              </thead>
              <tbody>
                {workflowLevels.map((level, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1">{idx + 1}</td>
                    <td className="px-2 py-1">
                      <input value={level.fieldName} onChange={e => handleWorkflowLevelChange(idx, 'fieldName', e.target.value)} className="border rounded px-2 py-1 w-24" />
                    </td>
                    <td className="px-2 py-1">
                      <select value={level.approvalType} onChange={e => handleWorkflowLevelChange(idx, 'approvalType', e.target.value)} className="border rounded px-2 py-1 w-36">
                        <option value="">Select...</option>
                        {approvalTypes.map(a => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input value={level.approverList} onChange={e => handleWorkflowLevelChange(idx, 'approverList', e.target.value)} className="border rounded px-2 py-1 w-32" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="mb-2 px-4 py-2 rounded bg-primary text-white" onClick={addWorkflowLevel}>Add Additional Level</button>
          <div className="text-xs text-red-600 mb-2">
            Pre-Defined Single-Approver (Will go to all listed approvers, any can approve)<br />
            Pre-Defined Multiple-Approvers (Will go to all listed approvers, all must approve)<br />
            Requestor Defined Single-Approver (Requestor can select from list of approvers)
          </div>
          <div className="flex justify-between mt-4">
            <button type="button" className="px-4 py-2 rounded bg-primary text-white" onClick={() => setStep(1)}>Previous</button>
            <button type="submit" className="px-4 py-2 rounded bg-primary text-white">Continue</button>
          </div>
        </div>
      )}
    </form>
  );
};

export default SendRequestForm;
