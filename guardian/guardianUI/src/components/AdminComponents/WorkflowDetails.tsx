import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material"
import Grid from '@mui/material/Grid2';
import { Controller, useForm } from 'react-hook-form';
import { boolean, z } from "zod";

export const editWorkflowSchema = z.object({
    name: z.string(),
    workflowType: z.string(),
    description: z.string(),
    active: boolean(),
    external: boolean(),
})

export type WorkflowIdentity = z.infer<typeof editWorkflowSchema>;

export const WorkflowDetails = () => {

    const { control, register, formState: { errors } } = useForm<WorkflowIdentity>({
        resolver: zodResolver(editWorkflowSchema),
        defaultValues: {
            name: "",
            workflowType: "",
            description: "",
            active: true,
            external: false,
        }
    })

    return (
        <Paper variant="outlined" sx={{ }}>
            <Typography component={'span'} variant="h6" className="displayHeader" sx={{ ml: 2, mt: 4 , fontWeight: 'bold' }} gutterBottom>
                Workflow Details
            </Typography>
            <Grid container spacing={2} sx={{ m: 2 }}>
                    <Grid size={5}>
                        <TextField
                            required
                            label="Name"
                            size="small"
                            fullWidth
                            variant="outlined"
                            slotProps={{ inputLabel: { shrink: true }}}
                        />
                    </Grid>
                    <Box width='100%' />
                    <Grid size={3}>
                        <Controller
                            control={control}
                            name="workflowType"
                            render={({ field }) => (
                                <TextField {...field}
                                    required
                                    select
                                    label="Workflow Type"
                                    size="small"
                                    fullWidth
                                    slotProps={{ inputLabel: { shrink: true }}}
                                >
                                    <MenuItem value={'request'}>Request</MenuItem>
                                    <MenuItem value={'notice'}>Notice</MenuItem>
                                </TextField>
                            )}
                        />
                    </Grid>
                    
                    <Grid size={8}>
                        <Stack>
                        <Typography component={'span'} variant="body2" sx={{  }} gutterBottom>
                            Request - Workflow allows users to submit requests to be fulfilled by processors and results disseminated to requestors.
                        </Typography>
                        <Typography component={'span'} variant="body2" sx={{  }} gutterBottom>
                            Notice - Workflow allows processors and managers to disseminate intelligence and other information to users.
                        </Typography>
                        </Stack>
                    </Grid>

                    <Box width='100%' />
                    <Grid size={8}>
                        <TextField
                            required
                            label="Description"
                            size="small"
                            fullWidth
                            multiline
                            rows={4}
                            variant="outlined"
                            slotProps={{ inputLabel: { shrink: true }}}
                        />
                    </Grid>
                    <Box width='100%' />
                    <Grid size={4}>
                        <Controller
                            {...register("external")}
                            control={control}
                            render={({ field }) => {
                                return (
                                <FormControlLabel
                                    //required
                                    slotProps={{ typography: { variant: 'body1' } }}
                                    label="* Available to approved External Users?"
                                    labelPlacement="start"
                                    control={<Checkbox />}
                                />
                            )}}
                        />                       
                    </Grid>
                    <Grid size={2}>
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
                                    slotProps={{ inputLabel: { shrink: true }}}
                                >
                                    <MenuItem value={'true'}>Active</MenuItem>
                                    <MenuItem value={'false'}>Inactive</MenuItem>
                                </TextField>
                            )}
                        />
                    </Grid>
                </Grid>
        </Paper>
    )
}