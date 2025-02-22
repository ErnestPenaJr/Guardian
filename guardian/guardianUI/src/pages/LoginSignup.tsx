import { Button } from "@mui/material";
import { useState } from "react";
import { RegistrationDialog } from "../components/Registration/Dialogs";


export default function LoginSignupPage() {
    const [openRegDialog, setRegDialog] = useState(false);
    
    return (
    <>
        <Button sx={{mt: 20}} onClick={() => setRegDialog(true)}>Sign Up</Button>
        {openRegDialog && (
            <RegistrationDialog isOpen={openRegDialog} setIsOpen={setRegDialog} />
        )}
    </>
    )
}