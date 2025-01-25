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

export const fetchWorkflow = (id: number) : Promise<WorkflowItemData> => 
    fetch(`${apiRoot}/workflows/${id}`,{
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp))


export const saveWorkflow = async (data: any) => {
    const response = await fetch('http://localhost:3000/workflows');
    return response.json();
}

export const editWorkflow = async (data: any) => {
    const response = await fetch('http://localhost:3000/workflows');
    return response.json();
}
