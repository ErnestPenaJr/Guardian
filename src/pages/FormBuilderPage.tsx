import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import FormBuilder from '../components/FormBuilder';
import { FormField } from '../types/formBuilder';
import { UiFieldType } from '../services/fieldTypeService';
import fieldTypeService from '../services/fieldTypeService';
import formService, { DbForm } from '../services/formService';
import { toast } from 'react-toastify';

const LAYOUT_TYPES = ['header', 'divider'];

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = !formId || formId === 'new';
  const returnTo = searchParams.get('returnTo') || '/admin';

  const [loading, setLoading] = useState(true);
  const [initialFields, setInitialFields] = useState<FormField[]>([]);
  const [fieldTypes, setFieldTypes] = useState<UiFieldType[]>([]);
  const [formName, setFormName] = useState(searchParams.get('name') || 'Untitled Form');
  const [formType, setFormType] = useState(searchParams.get('type') || 'requests');
  const [formDescription, setFormDescription] = useState(searchParams.get('description') || '');
  const [numericFormId, setNumericFormId] = useState<number | null>(isNew ? null : Number(formId));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const types = await fieldTypeService.getUiFieldTypes();
        setFieldTypes(types);

        if (!isNew && formId) {
          const data = await formService.getFormById(Number(formId));
          setFormName(data.form.FORM_NAME);
          setFormDescription(data.form.FORM_DESCRIPTION || '');
          const converted = formService.convertDbFieldsToFormFields(data.fields);
          setInitialFields(converted);
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
      toast.success('Form updated successfully');
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

    navigate(returnTo);
  };

  const handleCancel = () => {
    navigate(returnTo);
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
