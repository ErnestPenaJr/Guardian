import { BuildOutlined } from "@mui/icons-material";
import { atom, useAtom, useAtomValue } from "jotai"
import { ReactNode, useEffect } from "react"

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
let subjectFields = [
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

    useEffect(() => {
        console.log("sections", sections)
    }, [sections])

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
            <pre><code>
                {JSON.stringify(sections, null, "    ")}
                </code></pre>
            
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

const FormSelectorTemplates = () => {

    const [sections, setSections] = useAtom(sectionsAtom)


    return (
        <div>
            <h1>Templates:</h1>
            <ul>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Subject", fields: subjectFields }])

                }}>Subject</li>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Financial", fields: financialFields }])

                }}>Financial</li>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Address", fields: addressFields }])

                }}>Address</li>
                <li onClick={() => {
                    setSections([...sections, { id: crypto.randomUUID(), title: "Vehicle", fields: vehicleFields }])

                }}>Vehicle</li>
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