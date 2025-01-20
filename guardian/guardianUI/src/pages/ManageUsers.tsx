import { Box, Button, Divider, Paper, Stack, Typography } from "@mui/material"
import UserTable from "../components/UserList"
import { useState } from "react";
import { InviteDialog } from "../components/Dialogs";



export const ManageUsers = () => {
    const [openInviteDialog, setInviteDialog] = useState(false);

return (
    <>
    <Paper variant="outlined" sx={{ mt: 10, mb: 4, minWidth: '1300px', minHeight: '600px' }}>
    
    <Typography variant="h5" sx={{mt: 2, ml: 2}} gutterBottom>Manage Users</Typography>
    <Button sx={{ ml: 2, mt: 2 }} variant="contained" size="small" onClick={() => setInviteDialog(true)}>Invite Users</Button>
    <Divider sx={{ mt: 3, width: '100%' }} />
    
    <Box width="100%" />
    <Stack m={2} display={'flex'} justifyContent={'center'}><UserTable /></Stack>
    </Paper>
    {openInviteDialog && (
            <InviteDialog isOpen={openInviteDialog} setIsOpen={setInviteDialog} />
        )}
    </>
)
}