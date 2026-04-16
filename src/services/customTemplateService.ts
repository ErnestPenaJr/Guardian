import api from '../utils/api';
import type {
  TemplateSummary,
  TemplateDetail,
  TemplateType,
  TemplateStatus,
  TemplateField,
} from '../types/template';

export interface CreateTemplateInput {
  FORM_NAME: string;
  FORM_DESCRIPTION?: string;
  TEMPLATE_TYPE: TemplateType;
}

export interface UpdateTemplateInput {
  FORM_NAME?: string;
  FORM_DESCRIPTION?: string;
  IS_ACTIVE?: boolean;
}

export interface TemplateFieldDraft {
  FIELD_NAME: string;
  FIELD_TYPE_ID: number;
  IS_REQUIRED?: boolean;
  OPTIONS?: string;
}

const customTemplateService = {
  async list(opts?: { type?: TemplateType; status?: TemplateStatus }): Promise<TemplateSummary[]> {
    const params: Record<string, string> = {};
    if (opts?.type) params.type = opts.type;
    if (opts?.status) params.status = opts.status;
    const { data } = await api.get<TemplateSummary[]>('/api/custom-templates', { params });
    return data;
  },

  async listActiveNoticeTemplates(): Promise<TemplateSummary[]> {
    return customTemplateService.list({ type: 'notice', status: 'active' });
  },

  async getById(id: number): Promise<TemplateDetail> {
    const { data } = await api.get<TemplateDetail>(`/api/custom-templates/${id}`);
    return data;
  },

  async create(input: CreateTemplateInput): Promise<{ FORM_ID: number } & TemplateSummary> {
    const { data } = await api.post('/api/custom-templates', {
      form: {
        FORM_NAME: input.FORM_NAME,
        FORM_DESCRIPTION: input.FORM_DESCRIPTION || '',
        TEMPLATE_TYPE: input.TEMPLATE_TYPE,
      },
      fields: [],
    });
    return data.form;
  },

  async updateFields(
    id: number,
    metadata: UpdateTemplateInput,
    fields: TemplateFieldDraft[],
  ): Promise<void> {
    await api.put(`/api/custom-templates/${id}`, {
      form: metadata,
      fields,
    });
  },

  async publish(id: number): Promise<TemplateSummary> {
    const { data } = await api.patch(`/api/custom-templates/${id}/publish`);
    return data.template;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/api/custom-templates/${id}`);
  },
};

export type { TemplateSummary, TemplateDetail, TemplateField };
export default customTemplateService;
