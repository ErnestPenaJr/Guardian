import { useQuery } from "@tanstack/react-query";
import { atom, useAtom, useAtomValue } from "jotai"
import { ReactNode, useEffect } from "react"
import { fetchFields, fetchTemplates } from "../services/templatesService";
import { Box, Chip, Stack, TextField } from "@mui/material";
import Grid from '@mui/material/Grid2';

type Section = {
    id: string
    title: string | undefined
    fields: Field[]
}

type Field = {
    id: string
    type: string
    label: string
    name: string
    required: boolean
}

export const sectionsAtom = atom<Section[]>([])

const Spacer = ({ height }: { height?: string | undefined }) => {
    return (
        <div style={{ height: height ?? '10px' }}></div>
    )
}

const FormField = ({ field }: { field: Field }) => {
    return (
        // <div>
        //     <label>{field.label}</label>
        //     <input type={field.type} name={field.name} required={field.required} />
        // </div>
        <Grid size={12}>
            <TextField
                name={field.name}
                required={field.required}
                label={field.label}
                type={field.type}
                size="small"
                fullWidth
                variant="outlined"
                sx={{ m:.5 }}
            />
        </Grid>
    )
}

export const FormPage = () => {

    const [sections, setSections] = useAtom(sectionsAtom)

    //perhaps these should be combined
    const { isLoading: loadingFields, error: fieldsError, data: fieldsData } = useQuery({queryKey: ['workflowFields'], queryFn: () => fetchFields(),  staleTime: 0, gcTime: 0, retry: 2});
    const { isLoading: loadingTemplates, error: templatesError, data: templatesData } = useQuery({queryKey: ['workflowTemplates'], queryFn: () => fetchTemplates(),  staleTime: 0, gcTime: 0, retry: 2});

    if(loadingFields || loadingTemplates) return <div>Loading...</div>
    if(fieldsError || templatesError) return <div>Error: {fieldsError?.message} {templatesError?.message}</div>

    return (
        <Grid container spacing={2} sx={{ marginTop: '50px' }}>            
            <Grid size={2} sx={{ display: 'flex', position: 'fixed' }}>
                <Grid container spacing={1}>
                    <Grid size={12}>
                        <FormSelectorTemplates templates={templatesData} />
                    </Grid>
                </Grid>
            </Grid>           
            <Grid size={10} sx={{ display: 'flex', pl: 30 }}>
                <Grid container spacing={1}>
                    {/* <pre><code>
                        {JSON.stringify(sections, null, "    ")}
                    </code></pre> */}
                    <Spacer height="20px" />
                    {sections.map((section) => {
                        return (
                            <FormSection key={section.id} sectionId={section.id} title={section.title ?? ""}>
                                {section.fields.map((field) => {
                                    return (<>
                                        <Stack direction={'row'} spacing={1}>
                                            <FormField key={field.id} field={field} />
                                            <button onClick={() => {
                                                console.log("removing field", field)

                                                setSections(sections.map(s => ({ ...s, fields: s.fields.filter(f => f.id !== field.id) })))
                                            }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'red' }}>×</span>
                                            </button>
                                        </Stack>
                                    </>)
                                })}
                            </FormSection>
                        )
                    })}
                </Grid>
            </Grid>
            <Spacer height="100px" />
        </Grid>
    )
}

type FormSectionProps = {
    title: string
    sectionId: string
    children: ReactNode
}

export const FormSection = ({ title, sectionId, children }: FormSectionProps) => {

    const [sections, setSections] = useAtom(sectionsAtom)

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => {
                        setSections(sections.filter(s => s.id !== sectionId))
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'red' }}>×</span>
                    </button>
                </div>

                <div style={{ border: '1px solid black', padding: '10px' }}>
                    <h2>{title}</h2>
                    {children}
                </div>
            </div>
        </div>
    )
}

const FormSelectorTemplates = ({templates}: {templates: any}) => {

    const [sections, setSections] = useAtom(sectionsAtom)

    return (
        <div>
            <h4>Templates:</h4>            
            <ul>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Subject", fields: templates.subjectFields }])

                }}>Subject</li>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Financial", fields: templates.financialFields }])

                }}>Financial</li>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Address", fields: templates.addressFields }])

                }}>Address</li>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Vehicle", fields: templates.vehicleFields }])

                }}>Vehicle</li>
            </ul>
        </div>
    )
}

const FormSelectorButtons = ({fields}: {fields: any[]}) => {

    const [sections, setSections] = useAtom(sectionsAtom)

    return (
        <div>
            <h4>Fields</h4>
            {fields.map((field, index) => {
                return (
                    <Chip key={index} label={field.label} sx={{ m: .5 }} size="small" onClick={() => {
                        console.log("adding field", field)
                        setSections([...sections, { id: field.id, title: field.label, fields: [field] }])
                    }} />
                )
            })}
        </div>
    )
}