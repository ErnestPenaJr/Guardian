import { apiRoot, handleResponse, jsonHeader } from "./serviceUtils"

//specific to form builder

export const fetchFields = async () =>
    fetch(`${apiRoot}/templates/fields`, {
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp));

export const fetchTemplates = async () =>
    fetch(`${apiRoot}/templates`, {
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp));

