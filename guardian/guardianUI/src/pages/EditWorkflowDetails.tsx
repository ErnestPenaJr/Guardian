import { Paper } from "@mui/material"
import Grid from '@mui/material/Grid2';
import { WorkflowDetails } from "../components/AdminComponents/WorkflowDetails";
import { FormSection } from "./FormPage";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkflow } from "../services/workflowService";
import { useEffect } from "react";

export const EditWorkflowDetails = () => {

    const workflowId = useParams<{id: string}>();

    const { isLoading, error, data } = useQuery({queryKey: ['workflowGrid', workflowId], queryFn: () => fetchWorkflow(workflowId.id!), staleTime: 0, gcTime: 0, retry: 2});

    if(isLoading) return <div>Loading...</div>
    if(error) return <div>Error: {error.message}</div>
    if(!data) return <div>No data found</div>

    useEffect(() => {
        console.log(data)
    }, [data])

    return (
        <>
            <Grid container spacing={2} sx={{ mt: 10, mb: 5 }}>
                <Grid size={12} sx={{  }}>
                <Paper sx={{mt: 1, width: '100%', height: '98%'}}>
                    <WorkflowDetails details={{name: data.name, workflowType: data.workflowType, description: data.description, active: data.active, external: data.external}}/>
                </Paper>
                </Grid>
                <Grid size={12}>
                <FormSection title={""} sectionId={""} children={undefined} />
                </Grid>
            </Grid>
        </>
    )
}