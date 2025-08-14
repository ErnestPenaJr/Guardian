import React from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface FormBuilderTourProps {
  run: boolean;
  onTourEnd: () => void;
}

const FormBuilderTour: React.FC<FormBuilderTourProps> = ({ run, onTourEnd }) => {
  const steps: Step[] = [
    {
      target: '.form-builder-sidebar',
      content: (
        <div>
          <h4>Welcome to the Form Builder!</h4>
          <p>This sidebar contains all the tools you need to build custom forms. Let's explore the three main sections.</p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '.forms-section',
      content: (
        <div>
          <h4>Section 1: Workflow Templates</h4>
          <p>These pre-built templates help you get started quickly. Click any template button to instantly add common field combinations:</p>
          <ul>
            <li><strong>Subject</strong> - Personal information fields</li>
            <li><strong>Financial</strong> - Banking and account details</li>
            <li><strong>Vehicle</strong> - Car and vehicle information</li>
            <li><strong>Address</strong> - Location and contact details</li>
          </ul>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '.field-grid',
      content: (
        <div>
          <h4>Section 2: Field Types</h4>
          <p>This is your field palette! Each icon represents a different type of input field:</p>
          <ul>
            <li><strong>Text fields</strong> - For names, descriptions, etc.</li>
            <li><strong>Numbers</strong> - For quantities, amounts, phone numbers</li>
            <li><strong>Dates</strong> - For birthdays, deadlines, appointments</li>
            <li><strong>Dropdowns</strong> - For multiple choice selections</li>
            <li><strong>Checkboxes</strong> - For yes/no or multiple selections</li>
          </ul>
          <p>You can <strong>drag and drop</strong> these fields into the form area, or simply <strong>click</strong> to add them!</p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '.form-builder-main',
      content: (
        <div>
          <h4>Section 3: The Form Builder Area</h4>
          <p>This is where the magic happens! This is your form canvas where you can:</p>
          <ul>
            <li><strong>See a live preview</strong> of your form as you build it</li>
            <li><strong>Drop fields</strong> from the sidebar by dragging them here</li>
            <li><strong>Rearrange fields</strong> by clicking and dragging within the form</li>
          </ul>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '.form-preview',
      content: (
        <div>
          <h4>Form Preview Canvas</h4>
          <p>This area shows exactly how your form will look to users. The gray dashed border appears when you're dragging fields over it.</p>
          <p><strong>Pro tip:</strong> When the form is empty, you'll see a helpful message guiding you to add your first field!</p>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '.empty-form-message',
      content: (
        <div>
          <h4>Getting Started</h4>
          <p>When your form is empty, this helpful message appears. To add your first field:</p>
          <ol>
            <li><strong>Click</strong> any field type from the sidebar, OR</li>
            <li><strong>Drag</strong> a field type and drop it here, OR</li>
            <li><strong>Click</strong> a workflow template to add multiple fields at once</li>
          </ol>
        </div>
      ),
      placement: 'top',
      disableBeacon: true, // Always show this step even if target is not visible initially
    },
    {
      target: '.form-preview', // Target the form preview area instead
      content: (
        <div>
          <h4>Field Management</h4>
          <p>Once you have fields in your form, each field becomes interactive:</p>
          <ul>
            <li><strong>Click any field</strong> to edit its properties</li>
            <li><strong>Edit button (pencil)</strong> - Modify field name, type, make it required, add help text</li>
            <li><strong>Delete button (trash)</strong> - Remove the field from your form</li>
            <li><strong>Red asterisk (*)</strong> - Shows when a field is marked as required</li>
          </ul>
          <p><strong>Tip:</strong> Try adding a field from the sidebar first to see these management options in action!</p>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '.form-builder-container',
      content: (
        <div>
          <h4>You're Ready to Build!</h4>
          <p>That's the complete tour of the Form Builder. Here's a quick workflow to get started:</p>
          <ol>
            <li><strong>Start with a template</strong> if you want common fields quickly</li>
            <li><strong>Add individual fields</strong> by clicking or dragging from the sidebar</li>
            <li><strong>Customize each field</strong> by clicking on them to edit properties</li>
            <li><strong>Preview your form</strong> in real-time as you build</li>
            <li><strong>Save your template</strong> when you're satisfied</li>
          </ol>
          <p>Happy form building! 🎉</p>
        </div>
      ),
      placement: 'center',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      onTourEnd();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#0d6efd',
          textColor: '#333',
          backgroundColor: '#fff',
          overlayColor: 'rgba(0, 0, 0, 0.4)',
          arrowColor: '#fff',
          width: 400,
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          padding: 20,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          color: '#0d6efd',
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '10px',
        },
        tooltipContent: {
          fontSize: '14px',
          lineHeight: '1.5',
        },
        buttonNext: {
          backgroundColor: '#0d6efd',
          borderRadius: 4,
          color: '#fff',
          fontSize: '14px',
          fontWeight: '500',
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#6c757d',
          marginLeft: 10,
          fontSize: '14px',
        },
        buttonSkip: {
          color: '#6c757d',
          fontSize: '14px',
        },
        buttonClose: {
          display: 'none', // Hide the close button for a cleaner look
        },
      }}
      locale={{
        back: 'Previous',
        close: 'Close',
        last: 'Finish Tour',
        next: 'Next',
        open: 'Open the dialog',
        skip: 'Skip Tour',
      }}
    />
  );
};

export default FormBuilderTour;