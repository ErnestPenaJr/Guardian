import { useNavigate } from 'react-router-dom';
import CustomWorkflowTemplateModal from '../../components/CustomWorkflowTemplateModal';

export default function WorkflowTemplatesAdmin() {
  const navigate = useNavigate();
  return (
    <CustomWorkflowTemplateModal
      isOpen={true}
      onClose={() => navigate('/home')}
    />
  );
}
