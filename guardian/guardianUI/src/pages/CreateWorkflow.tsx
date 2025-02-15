import { Fragment } from "react";
import { Box, Button, Checkbox, FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Step, StepLabel, Stepper, TextField, Typography } from "@mui/material";
import Grid from '@mui/material/Grid2';
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { boolean, z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormPage, sectionsAtom } from "./FormPage";
import { useAtomValue } from "jotai";
import { saveWorkflow } from "../services/workflowService";
import { Description } from "@mui/icons-material";

export type StepNavProps = {
    nextStep: () => void,
    prevStep: () => void,
}

const steps = [ 'Select form type', 'Provide details', 'Design your form' ];

export const workflowSchema = z.object({
    workflowName: z.string(),
    workflowType: z.string(),
    description: z.string(),
    active: z.string(),
    external: boolean(),
    //selfService: boolean(),
    formDefinition: z.string(),
})

export type WorkflowDefinition = z.infer<typeof workflowSchema>;

export const CreateWorkflow = () => {
    const sections = useAtomValue(sectionsAtom);

    const { control, register, formState: { errors } } = useForm<WorkflowDefinition>({
        resolver: zodResolver(workflowSchema),
        defaultValues: {
            workflowName: "",
            workflowType: "",
            description: "",
            active: "true",
        }
    })

    const [activeStep, setActiveStep] = useState(0);

  const handleNext = (finish: string) => {
    if(finish === 'Finish') {
        //submit
        let rand = crypto.randomUUID()
        saveWorkflow({
            id: rand,
            name: `test workflow ${rand}`,
            description: "a great description",
            isActive: true,
            isExternal: false,
            workflowType: "request",
            workflowDefinition: JSON.stringify(sections)
        }).then(() => console.log("success"))

        console.log("finished")
    }
    else{
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }

  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };
  
    return (
        <Box sx={{ minWidth: 500 }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 5, position: "sticky", top: 0 }}>
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {activeStep === steps.length ? (
        <Box sx={{ mt: 2, }}>
          <Typography>Workflow created successfully!</Typography>
          <Button onClick={handleReset}>Create another workflow</Button>
        </Box>
      ): (
        <Fragment>
          {activeStep === 0 && <StepOne /> }
          {activeStep === 1 && <StepTwo /> }
          {activeStep === 2 && <FormPage /> }
          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 4, position: "sticky", bottom: 0 }}>
            <Button
              color="inherit"
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button onClick={() => handleNext(activeStep === steps.length - 1 ? 'Finish' : 'Next')}>
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </Fragment>
      )}
    </Box>
    )
}

export const workflowPart1Schema = z.object({
    workflowType: z.string(),
})

export type CreateWorkflowPart1 = z.infer<typeof workflowPart1Schema>

const StepOne = () => {

    const { control, register, watch, formState: { errors } } = useForm<CreateWorkflowPart1>({
        resolver: zodResolver(workflowPart1Schema),
        defaultValues: {
            workflowType: "",
        }
    })

    const workflowTypeWatch = watch("workflowType")

    return (
            <Grid container spacing={2}>
                <Grid size={12}>
                    <FormControl sx={{ pl: 1 }}>
                        <FormLabel>
                            <Typography component={'span'} variant="subtitle1">* Choose a Workflow Type</Typography>
                        </FormLabel>
                        <Controller
                            control={control}
                            name="workflowType"
                            render={({ field }) => (
                                <RadioGroup {...field}
                                    row
                                    aria-labelledby="workflowType"
                                    sx={{ ml:1}}
                                >
                                    <FormControlLabel value="request" control={<Radio size="small" />} label="Request" />
                                    <FormControlLabel value="notice" control={<Radio size="small" />} label="Notice" />
                                </RadioGroup>)}
                        />
                        {/* <FormHelperText>{errors.workflowType?.message}</FormHelperText> */}
                    </FormControl>
                </Grid>
                <Grid size={12} sx={{ml: 2, minHeight: 30 }}>
                    {workflowTypeWatch != null && workflowTypeWatch === 'request' &&
                        <Typography component={'span'} variant="body2" sx={{  }} gutterBottom>
                            Workflow allows users to submit requests to be fulfilled by processors and results disseminated to requestors.
                        </Typography>
                    }
                    {workflowTypeWatch != null && workflowTypeWatch === 'notice' &&
                        <Typography component={'span'} variant="body2" sx={{ }} gutterBottom>
                            Workflow allows processors and managers to disseminate intelligence and other information to users.
                        </Typography>
                    }
                </Grid>
            </Grid>            
    )
}

export const workflowPart2Schema = z.object({
    workflowName: z.string(),
    workflowDescription: z.string(),
    active: z.string(),
    external: boolean(),
    //selfService: boolean(),
})

export type CreateWorkflowPart2 = z.infer<typeof workflowPart2Schema>

const StepTwo = () => {

    const { control, register, formState: { errors } } = useForm<CreateWorkflowPart2>({
        resolver: zodResolver(workflowPart2Schema),
        defaultValues: {
            workflowName: "",
            workflowDescription: "",
            active: "true",
        }
    })

    return (
            <Grid container spacing={2}>
                <Grid size={12}>
                    <TextField
                        {...register("workflowName")}
                        required
                        label="Name"
                        size="small"
                        fullWidth
                        variant="outlined"
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                </Grid>
                <Box width='100%' />
                <Grid size={12}>
                    <TextField
                        {...register("workflowDescription")}
                        required
                        label="Description"
                        size="small"
                        fullWidth
                        multiline
                        rows={4}
                        variant="outlined"
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                </Grid>
                <Box width='100%' />
                {/* <Grid size={4}>
                            <Controller
                                {...register("selfService")}
                                control={control}
                                render={({ field }) => {
                                    return (
                                    <FormControlLabel
                                        slotProps={{ typography: { variant: 'body1' } }}
                                        label="* Self-Service?"
                                        labelPlacement="start"
                                        control={<Checkbox />}
                                    />
                                )}}
                            />                       
                        </Grid> */}
                <Grid size={6}>
                    <Controller
                        {...register("external")}
                        control={control}
                        render={({ field }) => {
                            return (
                                <FormControlLabel
                                    {...field}
                                    slotProps={{ typography: { variant: 'body1' } }}
                                    label="* Available to approved External Users?"
                                    labelPlacement="start"
                                    control={<Checkbox />}
                                />
                            )
                        }}
                    />
                </Grid>
                <Grid size={4}>
                    <Controller
                        control={control}
                        name="active"
                        render={({ field }) => (
                            <TextField {...field}
                                required
                                select
                                label="Status"
                                size="small"
                                fullWidth
                                slotProps={{ inputLabel: { shrink: true } }}
                            >
                                <MenuItem value={'true'}>Active</MenuItem>
                                <MenuItem value={'false'}>Inactive</MenuItem>
                            </TextField>
                        )}
                    />
                </Grid>               
            </Grid>            
    )
}