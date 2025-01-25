import { Box, Paper, Tab, Tabs, Typography } from "@mui/material";
import { SyntheticEvent, useState } from "react";
import { TabPanel } from "../components/TabPanel";
import { MyRequests } from "../components/MyRequests";

function a11yProps(index: number) {
    return {
      id: `request-tab-${index}`,
      'aria-controls': `request-tabs-${index}`,
    };
  }
  
  export const RequestsPage = () => {
    const [value, setValue] = useState(0);
  
    const handleChange = (event: SyntheticEvent, newValue: number) => setValue(newValue);
  
    return (
        <Paper elevation={0} sx={{ mt: 10 }}>
            <Typography variant='h4' className='displayLabel'sx={{ mt: 2, ml: 2}}>Requests</Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={value} onChange={handleChange} aria-label="Request Tabs" sx={{ ml: 2 }}>
                    <Tab label="My Requests" {...a11yProps(0)} />
                    <Tab label="Requests" {...a11yProps(1)} />
                </Tabs>
            </Box>
            <TabPanel value={value} index={0}>
                <MyRequests />
            </TabPanel>
            <TabPanel value={value} index={1}>
                <div>lotsa requests in the second panel</div>
            </TabPanel>
        </Paper>
    );
  }