import * as React from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import { useState } from 'react';
import { Button, Typography } from '@mui/material';
import { JoinOrCreate, NewOrganization, RegistrationInfo } from './Registration';

export type StepNavProps = {
  nextStep: () => void,
  prevStep: () => void,
}

const steps = [
  'User Details',
  'Join/Create Org',
  'Organization Details',
  // 'Join Organization',
];

export default function RegisterWizard() {

  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <Box sx={{ minWidth: 500, maxWidth: 600 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {activeStep === steps.length ? (
        <Box sx={{ mt: 2 }}>
          <Typography>Account created successfully!</Typography>
          <Button onClick={handleReset}>Create another account</Button>
        </Box>
      ): (
        <React.Fragment>
          {activeStep === 0 && <RegistrationInfo /> }
          {activeStep === 1 && <JoinOrCreate /> }
          {activeStep === 2 && <NewOrganization /> }
          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Button
              color="inherit"
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button onClick={handleNext}>
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </React.Fragment>
      )}
    </Box>
  );
}
