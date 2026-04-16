import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import FormBuilder from '../components/FormBuilder';
import { FormField } from '../types/formBuilder';
import { UiFieldType } from '../services/fieldTypeService';
import fieldTypeService from '../services/fieldTypeService';
import formService, { DbForm } from '../services/formService';
import customTemplateService from '../services/customTemplateService';
import type { TemplateType, TemplateStatus } from '../types/template';
import { toast } from 'react-toastify';

const LAYOUT_TYPES = ['header', 'divider'];

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = !formId || formId === 'new';
  const returnTo = searchParams.get('returnTo') || '/home';
  const returnSection = searchParams.get('returnSection') || 'admin';

  const [loading, setLoading] = useState(true);
  const [initialFields, setInitialFields] = useState<FormField[]>([]);
  const [fieldTypes, setFieldTypes] = useState<UiFieldType[]>([]);
  const [formName, setFormName] = useState(searchParams.get('name') || 'Untitled Form');
  const [formType, setFormType] = useState(searchParams.get('type') || 'requests');
  const [formDescription, setFormDescription] = useState(searchParams.get('description') || '');
  const [numericFormId, setNumericFormId] = useState<number | null>(isNew ? null : Number(formId));
  const [templateType, setTemplateType] = useState<TemplateType | null>(null);
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const types = await fieldTypeService.getUiFieldTypes();
        setFieldTypes(types);

        if (!isNew && formId) {
          try {
            const tpl = await customTemplateService.getById(Number(formId));
            setFormName(tpl.form.FORM_NAME);
            setFormDescription(tpl.form.FORM_DESCRIPTION || '');
            setTemplateType(tpl.form.TEMPLATE_TYPE);
            setTemplateStatus(tpl.form.STATUS);
            const converted = formService.convertDbFieldsToFormFields(tpl.fields as any);
            setInitialFields(converted);
          } catch {
            const data = await formService.getFormById(Number(formId));
            setFormName(data.form.FORM_NAME);
            setFormDescription(data.form.FORM_DESCRIPTION || '');
            const converted = formService.convertDbFieldsToFormFields(data.fields);
            setInitialFields(converted);
          }
        }
      } catch (error) {
        console.error('Error loading form builder data:', error);
        toast.error('Failed to load form data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [formId, isNew]);

  const handleSave = async (data: {
    name: string;
    description: string;
    type: string;
    fields: FormField[];
  }) => {
    const savableFields = data.fields.filter(
      (f) => !LAYOUT_TYPES.includes(f.fieldType)
    );

    if (numericFormId) {
      // Server PUT expects { name, description, formFields } with camelCase field objects
      // (fieldName, fieldTypeId, dbFieldId, required)
      await formService.updateFormTemplate(numericFormId, {
        name: data.name,
        description: data.description,
        formFields: savableFields,
      });

      // If this is a draft custom template, also publish it (draft -> active).
      let publishedType = templateType;
      if (templateStatus === 'draft' && publishedType) {
        try {
          await customTemplateService.publish(numericFormId);
          setTemplateStatus('active');
        } catch (e) {
          console.warn('publish failed (continuing):', e);
        }
      }
      toast.success(templateStatus === 'draft' ? 'Template published' : 'Form updated successfully');

      if (publishedType === 'notice') {
        const qs = `?published=${encodeURIComponent(data.name)}`;
        navigate(`/my-notices${qs}`);
        return;
      }
    } else {
      const dbForm: DbForm = {
        FORM_NAME: data.name,
        FORM_DESCRIPTION: data.description,
        IS_PUBLIC: false,
        IS_ACTIVE: true,
        IS_DELETED: false,
      };
      const dbFields = formService.convertFormFieldsToDbFields(savableFields);
      const result = await formService.createForm(dbForm, dbFields);
      if (result.form.FORM_ID) {
        setNumericFormId(result.form.FORM_ID);
      }
      toast.success('Form created successfully');
    }

    navigate(returnTo, { state: { activeSection: returnSection } });
  };

  const handleCancel = () => {
    navigate(returnTo, { state: { activeSection: returnSection } });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#F3F5F9',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: '4px solid #E4E6EB',
            borderTopColor: '#3B6EF0', borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ color: '#6B7280', fontSize: 14 }}>Loading form builder…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <FormBuilder
      initialFields={initialFields}
      fieldTypes={fieldTypes}
      formName={formName}
      formType={formType}
      formDescription={formDescription}
      onSave={handleSave}
      onCancel={handleCancel}
      isEditing={!isNew}
    />
  );
}
