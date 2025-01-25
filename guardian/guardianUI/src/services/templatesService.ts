import { apiRoot, handleResponse, jsonHeader } from "./serviceUtils"


export const fetchFields = async () =>
    fetch(`${apiRoot}/fields`, {
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp));

export const fetchTemplates = async () =>
    fetch(`${apiRoot}/fields`, {
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp));

