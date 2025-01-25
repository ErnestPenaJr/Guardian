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
