import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from "@mui/material"

type BasicDialogProps = {
    isOpen: boolean,
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  }
  
  export const InviteDialog = ({ isOpen, setIsOpen }: BasicDialogProps) => {
  
    const handleClose = () => setIsOpen(false)
  
    const handleSubmit = () => {
      console.log("lolol idfk")
    }
  
    return (
      <>
        <Dialog
          open={isOpen}
          onClose={handleClose}
          aria-labelledby="invite-title"
          aria-describedby="invite-description"
        >
          <DialogTitle id="invite-title" sx={{ mb: 2, backgroundColor: "rgba(50,85,151, .09)" }}>
            {"Invite People to This Awesome App"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="invite-description">
              Go ahead, invite some peeps
            </DialogContentText>
            <TextField
            required
            autoFocus
            margin="dense"
            label="Email Address"
            fullWidth
          />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} autoFocus>Send</Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
  