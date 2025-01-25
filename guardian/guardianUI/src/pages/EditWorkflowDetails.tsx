import { Paper } from "@mui/material"
import Grid from '@mui/material/Grid2';
import { WorkflowDetails } from "../components/AdminComponents/WorkflowDetails";
import { FormSection } from "./FormPage";

export const EditWorkflowDetails = () => {

    return (
        <>
            <Grid container spacing={2} sx={{ mt: 10, mb: 5 }}>
                <Grid size={12} sx={{  }}>
                <Paper sx={{mt: 1, width: '100%', height: '98%'}}><WorkflowDetails /></Paper>
                </Grid>
                <Grid size={12}>
                <FormSection title={""} sectionId={""} children={undefined} />
                </Grid>
            </Grid>
        </>
    )
}