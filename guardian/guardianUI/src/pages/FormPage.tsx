import { atom, useAtom, useAtomValue } from "jotai"
import { ReactNode } from "react"

const formVersion = 69420;

//Account #, Address Line 1, Address Line 2, City, State, Zip Code, Phone Number, Email Address, Routing #
let defaultFields2 = [
    {
        type: 'text',
        label: 'Account #',
        name: 'accountNumber',
        required: true
    },
    {
        type: 'text',
        label: 'Address Line 1',
        name: 'addressLine1',
        required: true
    },
    {
        type: 'text',
        label: 'Address Line 2',
        name: 'addressLine2',
        required: false
    },
    {
        type: 'text',
        label: 'City',
        name: 'city',
        required: true
    },
    {
        type: 'text',
        label: 'State',
        name: 'state',
        required: true
    },
    {
        type: 'text',
        label: 'Zip Code',
        name: 'zipCode',
        required: true
    },
    {
        type: 'text',
        label: 'Phone Number',
        name: 'phoneNumber',
        required: true
    },
    {
        type: 'email',
        label: 'Email Address',
        name: 'emailAddress',
        required: true
    },
    {
        type: 'text',
        label: 'Routing #',
        name: 'routingNumber',
        required: true
    }
]

let f1 = [
    {
        type: 'text',
        label: 'First Name',
        name: 'firstName',
        required: true
    },
    {
        type: 'text',
        label: 'Last Name',
        name: 'lastName',
        required: true
    },
    {
        type: 'email',
        label: 'Email',
        name: 'email',
        required: true
    }
]


let defaultFields = [
    {
        "id": "0baa74bc-3370-4858-bc6b-47d6aa1b6f09",
        "type": "text",
        "label": "Account #",
        "name": "accountNumber",
        "required": true
    },
    {
        "id": "74409eb4-4a33-4d6f-8c8a-bcd33c3306f8",
        "type": "text",
        "label": "Address Line 1",
        "name": "addressLine1",
        "required": true
    },
    {
        "id": "2462ee3d-30de-4358-af90-e484c8647ec8",
        "type": "text",
        "label": "Address Line 2",
        "name": "addressLine2",
        "required": false
    },
    {
        "id": "f049b24d-edc0-4ea6-afe2-6a65359506f5",
        "type": "text",
        "label": "City",
        "name": "city",
        "required": true
    },
    {
        "id": "715b78c0-e057-4af7-940f-7e3d04b2f97d",
        "type": "text",
        "label": "State",
        "name": "state",
        "required": true
    },
    {
        "id": "d71eb496-9ed0-4161-9197-edd40aeb7aa1",
        "type": "text",
        "label": "Zip Code",
        "name": "zipCode",
        "required": true
    },
    {
        "id": "3c9c875c-725b-46fe-a58d-dab645e167b1",
        "type": "text",
        "label": "Phone Number",
        "name": "phoneNumber",
        "required": true
    },
    {
        "id": "c7266ea8-f5ed-4842-bc5c-1edf8d37a5e2",
        "type": "email",
        "label": "Email Address",
        "name": "emailAddress",
        "required": true
    },
    {
        "id": "aa838f30-5eac-4d97-bc3f-8e32bd51abec",
        "type": "text",
        "label": "Routing #",
        "name": "routingNumber",
        "required": true
    }
]
//Contains fields: First Name, Middle Name, Last Name, DOB, SSN, Phone Number
let subject = [
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "First Name",
        "name": "firstName",
        "required": true
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
        "required": true
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "date",
        "label": "DOB",
        "name": "dob",
        "required": true
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "SSN",
        "name": "ssn",
        "required": true
    },
    {
        "id": "f1a9b2c6-6c5b-4b3e-8e0e-2f8e7f4f6c7d",
        "type": "text",
        "label": "Phone Number",
        "name": "phoneNumber",
        "required": true
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

const Spacer = ({height} :{height?: string | undefined}) => {
    return (
        <div style={{ height: height ?? '10px' }}></div>
    )
}

const FormField = ({ field }: { field: Field }) => {
    return (
        <div>
            <label>{field.label}</label>
            <input type={field.type} name={field.name} required={field.required}/>
        </div>
    )
}

export const FormPage = () => {

    const [sections, setSections] = useAtom(sectionsAtom)

    return (
        <div style={{marginTop: '50px'}}>
            <h1>Form Page</h1>
            <div style={{ display: 'flex' }}>
                <div style={{ flex: 1 }}>
                    <FormSelectorTemplates />
                </div>
                <div style={{ flex: 1 }}>
                    <FormSelectorButtons />
                </div>
            </div>
            <Spacer height="20px"/>
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
            <h2>{title}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>{title}</h2>
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

const FormSelectorTemplates = () => {

    const [sections, setSections] = useAtom(sectionsAtom)


    return (
        <div>
            <h1>Templates:</h1>
            <ul>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Subject", fields: defaultFields }])

                }}>Subject</li>
                <li>Financial</li>
                <li>Address</li>
            </ul>
        </div>
    )
}

const FormSelectorButtons = () => {

    const [sections, setSections] = useAtom(sectionsAtom)

    return (
        <div>
            <h1>Form Selector Buttons</h1>
            {defaultFields.map((field, index) => {
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