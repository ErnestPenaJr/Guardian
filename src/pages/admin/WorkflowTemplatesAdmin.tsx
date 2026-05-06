import { useNavigate, useSearchParams } from 'react-router-dom';
import CustomWorkflowTemplateModal from '../../components/CustomWorkflowTemplateModal';

export default function WorkflowTemplatesAdmin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ?type=notice|request scopes the modal so request and notice template lists
  // stay separate (e.g. /admin/workflow-templates?type=notice from the notice
  // creation flow shows only notice templates).
  const rawType = (params.get('type') || '').toLowerCase();
  const formType: 'notice' | 'request' | undefined =
    rawType === 'notice' ? 'notice' : rawType === 'request' ? 'request' : undefined;
  return (
    <CustomWorkflowTemplateModal
      isOpen={true}
      onClose={() => navigate('/home')}
      formType={formType}
    />
  );
}
