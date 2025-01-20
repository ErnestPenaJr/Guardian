import { Box } from "@mui/material";
import AppDrawer from "./AppDrawer";

export const MainLayout = () => {
    
    return (
        <Box sx={{ display: 'flex', flexGrow: 1 }}>
            <AppDrawer />
        </Box>
    )
}