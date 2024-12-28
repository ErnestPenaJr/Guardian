import { Button } from "@mui/material";
import { useState } from "react";
import { RegistrationDialog } from "../components/Dialogs";

export default function LandingPage() {
    const [openRegDialog, setRegDialog] = useState(false);
    
    return (
    <>
        <Button onClick={() => setRegDialog(true)}>Sign Up</Button>
        {openRegDialog && (
            <RegistrationDialog isOpen={openRegDialog} setIsOpen={setRegDialog} />
        )}
    </>
    )
}