import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import RegisterWizard from './RegisterWizard';

type BasicDialogProps = {
  isOpen: boolean,
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export const RegistrationDialog = ({ isOpen, setIsOpen }: BasicDialogProps) => {
  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle sx={{ mb: 2, backgroundColor: "rgba(50,85,151, .09)" }}>Sign Up</DialogTitle>
      <DialogContent>
        <RegisterWizard />
      </DialogContent>
    </Dialog>
  );
}
