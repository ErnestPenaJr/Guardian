import { WorkflowIdentity } from "../components/AdminComponents/WorkflowDetails"
import { apiRoot, handleResponse, jsonHeader } from "./serviceUtils"


export type WorkflowGridData = {
    workflowId: number
    name: string
    workflowType: string
    external: boolean
    active: boolean
}

export const fetchWorkflows = () : Promise<WorkflowGridData[]> => 
    fetch(`${apiRoot}/workflows`,{
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp));

export type WorkflowItemData = {
    workflowId: number
    name: string
    workflowType: string
    external: boolean
    active: boolean
    description: string
    customWorkflow: string[]
}   

export const fetchWorkflow = (id: string) : Promise<WorkflowIdentity> => 
    fetch(`${apiRoot}/workflows/${id}`,{
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp))


export const saveWorkflow = async (data: any) => 
    fetch(`${apiRoot}/workflows`,{
        method: 'POST',
        ...jsonHeader,
        body: JSON.stringify(data)
    })

export const editWorkflow = async (data: any) => 
    fetch(`${apiRoot}/workflows/${data.workflowId}`,{
        method: 'PUT',
        ...jsonHeader,
        body: JSON.stringify(data)
    })
