import { Paper, Stack } from "@mui/material"
import Grid from '@mui/material/Grid2';
import RequestsDashboard from "../components/LandingComponents/RequestsDashboard"
import NoticesDashboard from "../components/LandingComponents/NoticesDashboard"
import RequestOverview from "../components/LandingComponents/RequestOverview"

export const ProcessorDashboard = () => {

    return (
        <>
            <Grid container spacing={2} sx={{ mt: 10, mb: 5 }}>
                <Grid size={3} sx={{  }}>
                <Paper sx={{mt: 1, width: '100%', height: '98%'}}><RequestOverview /></Paper>
                </Grid>
                <Grid size={8}>
                <RequestsDashboard />
                </Grid>
                <Grid size={11}>
                <NoticesDashboard />
                </Grid>
            </Grid>
        </>
    )
}