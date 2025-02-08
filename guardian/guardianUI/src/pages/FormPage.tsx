import { BuildOutlined } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom, useAtomValue } from "jotai"
import { ReactNode, useEffect } from "react"
import { fetchFields, fetchTemplates } from "../services/templatesService";


//Contains fields: First Name, Middle Name, Last Name, DOB, SSN, Phone Number
let subjectFields = [
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "First Name",
        "name": "firstName",
        "required": false
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "Middle Name",
        "name": "middleName",
        "required": false
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "Last Name",
        "name": "lastName",
        "required": false
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "date",
        "label": "DOB",
        "name": "dob",
        "required": false
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "SSN",
        "name": "ssn",
        "required": false
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "Phone Number",
        "name": "phoneNumber",
        "required": false
    }
]

//Contains fields: Institution, Account#, Account Holder
let financialFields: Field[] = [
    {
        "id": "1a2b3c4d-5678-90ab-cdef-1234567890ab",
        "type": "text",
        "label": "Institution",
        "name": "institution",
        "required": false
    },
    {
        "id": "2b3c4d5e-6789-01ab-cdef-2345678901bc",
        "type": "text",
        "label": "Account#",
        "name": "accountNumber",
        "required": false
    },
    {
        "id": "3c4d5e6f-7890-12ab-cdef-3456789012cd",
        "type": "text",
        "label": "Account Holder",
        "name": "accountHolder",
        "required": false
    }
]

//Contains fields: Street Address, Address 2, City, State, ZIP
let addressFields: Field[] = [
    {
        "id": "3d6ab1e7-7513-44b1-82a5-353705cf46e5",
        "type": "text",
        "label": "Street Address",
        "name": "streetAddress",
        "required": false
    },
    {
        "id": "050c3b84-6e78-4c8a-bb6d-e2a09a0e7abc",
        "type": "text",
        "label": "Address 2",
        "name": "address2",
        "required": false
    },
    {
        "id": "c72b05a7-9159-4371-8450-991671bb524c",
        "type": "text",
        "label": "City",
        "name": "city",
        "required": false
    },
    {
        "id": "c0c6df9f-cb38-4209-bb2a-b6a7bef8b499",
        "type": "text",
        "label": "State",
        "name": "state",
        "required": false
    },
    {
        "id": "d2bac5f3-4510-4a18-b64b-a052df66f846",
        "type": "text",
        "label": "ZIP",
        "name": "zip",
        "required": false
    }
]

let vehicleFields: Field[] =
    [
        {
            "id": "d6753a72-8e39-4e4f-b5b0-e151efe56c42",
            "type": "text",
            "label": "Make",
            "name": "make",
            "required": false
        },
        {
            "id": "38cd9a9d-b14a-42cd-81ed-db981dba1c14",
            "type": "text",
            "label": "Model",
            "name": "model",
            "required": false
        },
        {
            "id": "4f36124d-4023-407b-b128-373fe412ad2d",
            "type": "text",
            "label": "Color",
            "name": "color",
            "required": false
        },
        {
            "id": "70769c62-656e-426f-8846-c3f5f40e5726",
            "type": "text",
            "label": "License Plate",
            "name": "licensePlate",
            "required": false
        },
        {
            "id": "67417344-12a5-4a2a-adf1-f79a93390fda",
            "type": "text",
            "label": "VIN",
            "name": "vin",
            "required": false
        },
        {
            "id": "53f2bbd4-784f-4525-8c6d-00c1cc481837",
            "type": "text",
            "label": "Year",
            "name": "year",
            "required": false
        }
    ]

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

const sectionsAtom = atom<Section[]>([])

const Spacer = ({ height }: { height?: string | undefined }) => {
    return (
        <div style={{ height: height ?? '10px' }}></div>
    )
}

const FormField = ({ field }: { field: Field }) => {
    return (
        <div>
            <label>{field.label}</label>
            <input type={field.type} name={field.name} required={field.required} />
        </div>
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
        <div style={{ marginTop: '50px' }}>
            <h1>Form Page</h1>
            <div style={{ display: 'flex' }}>
                <div style={{ flex: 1 }}>
                    <FormSelectorTemplates templates={templatesData}/>
                </div>
                <div style={{ flex: 1 }}>
                    <FormSelectorButtons fields={fieldsData}/>
                </div>
            </div>
            <Spacer height="20px" />
            <pre><code>
                {JSON.stringify(sections, null, "    ")}
            </code></pre>

            <Spacer height="20px" />
            {sections.map((section, index) => {
                return (
                    <FormSection key={index} sectionId={section.id} title={section.title ?? ""}>
                        {section.fields.map((field) => {
                            return (<>
                                <FormField key={field.id} field={field} />
                                <button onClick={() => {
                                    console.log("removing field", field)

                                    setSections(sections.map(s => ({ ...s, fields: s.fields.filter(f => f.id !== field.id) })))
                                }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'red' }}>×</span>
                                </button>
                            </>)
                        })}
                    </FormSection>
                )
            })}
        </div>
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
            {/* <h2>{title}</h2> */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* <h2>{title}</h2> */}
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
            <h1>Templates:</h1>
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
            <h1>Form Selector Buttons</h1>
            {fields.map((field, index) => {
                return (
                    <button key={index} onClick={() => {
                        console.log("adding field", field)
                        setSections([...sections, { id: field.id, title: field.label, fields: [field] }])
                    }}>{field.label}</button>
                )
            })}
        </div>
    )
}