import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material"
import Grid from '@mui/material/Grid2';
import { Controller, useForm } from 'react-hook-form';
import { boolean, z } from "zod";

export const editWorkflowSchema = z.object({
    name: z.string(),
    workflowType: z.string(),
    description: z.string(),
    isActive: z.string(),
    isExternal: boolean(),
})

export type WorkflowIdentity = z.infer<typeof editWorkflowSchema> & { id:string, workflowDefinition: string}

export const WorkflowDetails = ({details}: {details :WorkflowIdentity}) => {

    const { control, register, formState: { errors } } = useForm<WorkflowIdentity>({
        resolver: zodResolver(editWorkflowSchema),
        defaultValues: {
            name: details.name,
            workflowType: details.workflowType,
            description: details.description,
            isActive: details.isActive,
            isExternal: details.isExternal,
        }
    })

    return (
        <Paper variant="outlined" sx={{ }}>
            <Typography component={'span'} variant="h6" className="displayHeader" sx={{ ml: 2, mt: 4 , fontWeight: 'bold' }} gutterBottom>
                Workflow Details
            </Typography>
            <Stack direction={'row'} spacing={2} ml={2} mt={4} mb={3}>
                <Typography>Workflow Type:</Typography>
                <Typography sx={{ textTransform: 'capitalize'}}>{details.workflowType}</Typography>
            </Stack>
            <Grid container spacing={2} sx={{ m: 2 }}>
                    <Grid size={5}>
                        <TextField
                            {...register("name")}
                            required
                            label="Name"
                            size="small"
                            fullWidth
                            variant="outlined"
                            slotProps={{ inputLabel: { shrink: true }}}
                        />
                    </Grid>
                    <Box width='100%' />                    
                    <Grid size={8}>
                        <TextField
                            {...register("description")}    
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
                            {...register("isExternal")}
                            control={control}
                            render={({ field }) => {
                                return (
                                <FormControlLabel
                                    //required
                                    slotProps={{ typography: { variant: 'body1' } }}
                                    label="Available to approved External Users?"
                                    labelPlacement="start"
                                    control={<Checkbox />}
                                />
                            )}}
                        />                       
                    </Grid>
                    <Grid size={2}>
                        <Controller
                            control={control}
                            name="isActive"
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