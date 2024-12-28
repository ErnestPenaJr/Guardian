import { Box, styled } from "@mui/material";
import { TopAppBar } from "./TopAppBar";
import { Outlet } from "react-router-dom";

const drawerWidth = 260;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
    open?: boolean;
}>(({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
    }),
}));


export const MainLayout = () => {
    
    return (
        <>
            <Box sx={{ display: 'flex', flexGrow: 1 }}>
                 <TopAppBar />
                <Main >
                    <Outlet />
                </Main> 
            </Box>
        </>
    )
}